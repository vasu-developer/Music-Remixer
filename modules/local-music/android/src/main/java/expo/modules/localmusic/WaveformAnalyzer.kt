package expo.modules.localmusic

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.SystemClock
import java.io.File
import java.nio.ByteOrder
import java.security.MessageDigest
import kotlin.math.abs
import kotlin.math.max

/** Separate decoder, bounded memory, no interaction with playback buffers. */
internal object WaveformAnalyzer {
  fun analyze(context: Context, uri: String, version: String, seconds: Double): List<Double> {
    require(Regex("content://media/[^/]+/audio/media/\\d+").matches(uri)) { "Invalid audio URI" }
    require(seconds.isFinite() && seconds > 0) { "Invalid audio duration" }
    val count = 192
    val key = MessageDigest.getInstance("SHA-256").digest("v1:$uri:$version:$seconds".toByteArray())
      .joinToString("") { "%02x".format(it) }
    val directory = File(context.cacheDir, "waveforms")
    val cache = File(directory, key)
    runCatching {
      val values = cache.readText().split(',').map { it.toDouble() }
      if (values.size == count && values.all { it.isFinite() && it in 0.0..1.0 }) return values
    }
    val peaks = DoubleArray(count)
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      extractor.setDataSource(context, Uri.parse(uri), null)
      val track = (0 until extractor.trackCount).firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: error("No audio stream")
      extractor.selectTrack(track)
      val format = extractor.getTrackFormat(track)
      val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION).toDouble() else seconds * 1e6
      require(durationUs > 0)
      val decoder = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
      codec = decoder
      decoder.configure(format, null, null, 0)
      decoder.start()
      var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      var encoding = 2 // Android PCM_16BIT; decoder output format may override.
      var inputDone = false
      var outputDone = false
      var decodedFrames = 0L
      val info = MediaCodec.BufferInfo()
      val deadline = SystemClock.elapsedRealtime() + 120_000
      while (!outputDone) {
        check(!Thread.currentThread().isInterrupted && SystemClock.elapsedRealtime() < deadline) { "Waveform analysis interrupted or timed out" }
        if (!inputDone) {
          val index = decoder.dequeueInputBuffer(1000)
          if (index >= 0) {
            val input = decoder.getInputBuffer(index)!!
            input.clear()
            val size = extractor.readSampleData(input, 0)
            if (size < 0) {
              decoder.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              decoder.queueInputBuffer(index, 0, size, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }
        val index = decoder.dequeueOutputBuffer(info, 1000)
        if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          val output = decoder.outputFormat
          rate = output.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          channels = output.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          encoding = if (output.containsKey(MediaFormat.KEY_PCM_ENCODING)) output.getInteger(MediaFormat.KEY_PCM_ENCODING) else 2
          require(rate > 0 && channels > 0)
        } else if (index >= 0) {
          try {
            val buffer = decoder.getOutputBuffer(index)!!.order(ByteOrder.LITTLE_ENDIAN)
            buffer.limit(info.offset + info.size)
            buffer.position(info.offset)
            val bytes = when (encoding) { 2 -> 2; 4, 22 -> 4; 21 -> 3; 3 -> 1; else -> error("Unsupported PCM encoding: $encoding") }
            var frame = 0
            while (buffer.remaining() >= bytes * channels) {
              var peak = 0.0
              repeat(channels) {
                val sample = when (encoding) {
                  4 -> buffer.float.toDouble()
                  22 -> buffer.int / 2147483648.0
                  21 -> { val a = buffer.get().toInt() and 255; val b = buffer.get().toInt() and 255; val c = buffer.get().toInt(); ((c shl 16) or (b shl 8) or a) / 8388608.0 }
                  3 -> ((buffer.get().toInt() and 255) - 128) / 128.0
                  else -> buffer.short / 32768.0
                }
                if (sample.isFinite()) peak = max(peak, abs(sample).coerceAtMost(1.0))
              }
              val time = info.presentationTimeUs + frame * 1e6 / rate
              val bin = (time / durationUs * count).toInt().coerceIn(0, count - 1)
              peaks[bin] = max(peaks[bin], peak)
              frame++
              decodedFrames++
            }
          } finally { decoder.releaseOutputBuffer(index, false) }
          outputDone = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
        }
      }
      check(decodedFrames > 0) { "No decoded audio samples" }
    } finally {
      runCatching { codec?.stop() }
      runCatching { codec?.release() }
      extractor.release()
    }
    runCatching {
      directory.mkdirs()
      cache.writeText(peaks.joinToString(","))
      directory.listFiles()?.sortedByDescending { it.lastModified() }?.drop(32)?.forEach { it.delete() }
    }
    return peaks.toList()
  }
}
