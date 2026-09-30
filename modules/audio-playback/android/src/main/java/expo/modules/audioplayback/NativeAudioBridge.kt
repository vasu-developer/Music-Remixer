package expo.modules.audioplayback

import android.content.Context
import android.content.res.AssetFileDescriptor
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.ParcelFileDescriptor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.android.asCoroutineDispatcher
import org.json.JSONObject
import java.io.File
import java.io.IOException

/** One control queue shared by Expo and the debug-only device harness. */
object NativeAudioBridge {
  init { System.loadLibrary("remixer_audio") }
  private val thread = HandlerThread("RemixerOboeControl").apply { start() }
  val scope = CoroutineScope(SupervisorJob() + Handler(thread.looper).asCoroutineDispatcher())

  fun deckToIndex(deckId: String): Int = if (deckId.equals("B", ignoreCase = true)) 1 else 0

  external fun setMasterFx(index: Int, value: Float)
  external fun initialize(): Boolean
  external fun loadTrackFd(deckIndex: Int, fd: Int, offset: Long, length: Long): Boolean
  external fun playDeck(deckIndex: Int): Boolean
  external fun pauseDeck(deckIndex: Int): Boolean
  external fun start(): Boolean
  external fun stop(): Boolean
  external fun pause(): Boolean
  external fun seekTo(deckIndex: Int, positionSeconds: Double): Boolean
  external fun getPosition(deckIndex: Int): Double
  external fun getDuration(deckIndex: Int): Double
  external fun isDeckPlaying(deckIndex: Int): Boolean
  external fun release()
  external fun setEq(deckIndex: Int, band: Int, value: Float, kill: Boolean)
  external fun setRate(deckIndex: Int, rate: Float)
  external fun setTestToneVolume(volume: Float)
  external fun setVolume(deckIndex: Int, volume: Float, seq: Int, tGesture: Long)
  fun setVolume(deckIndex: Int, volume: Float) = setVolume(deckIndex, volume, 0, 0L)
  fun setVolume(volume: Float) = setVolume(0, volume, 0, 0L)
  private external fun diagnosticsJson(): String

  fun loadTrackUri(context: Context, deckId: String, uriString: String): Map<String, Any> {
    val deckIndex = deckToIndex(deckId)
    val uri = Uri.parse(uriString)
    val afd = if (uri.scheme == "content") {
      context.contentResolver.openAssetFileDescriptor(uri, "r")
        ?: throw IOException("Could not open AssetFileDescriptor for $uri")
    } else {
      val path = if (uri.scheme == "file") uri.path ?: uriString else uriString
      val file = File(path)
      if (!file.exists()) throw IOException("File does not exist: $path")
      val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
      AssetFileDescriptor(pfd, 0, file.length())
    }

    val loaded = afd.use { descriptor ->
      val dupPfd = descriptor.parcelFileDescriptor.dup()
      val nativeFd = dupPfd.detachFd()
      loadTrackFd(deckIndex, nativeFd, descriptor.startOffset, descriptor.length)
    }

    val duration = if (loaded) getDuration(deckIndex) else 0.0
    return mapOf("success" to loaded, "duration" to duration)
  }

  // Backwards compatibility overload
  fun loadTrackUri(context: Context, uriString: String): Map<String, Any> =
    loadTrackUri(context, "A", uriString)

  fun getDiagnostics(): Map<String, Any> {
    val json = JSONObject(diagnosticsJson())
    return json.keys().asSequence().associateWith { json.get(it) } + mapOf(
      "deviceModel" to Build.MODEL,
      "androidVersion" to Build.VERSION.RELEASE,
      "controlThread" to Thread.currentThread().name
    )
  }
}
