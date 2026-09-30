package expo.modules.audioplayback

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.PlaybackParams
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.util.Log
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class DeckPlayer(
  val deckId: String,
  private val getContext: () -> Context?
) {
  companion object {
    private const val TAG = "DeckPlayer"
    private const val PREPARE_TIMEOUT_MS = 10000L
  }

  enum class State {
    IDLE,
    INITIALIZED,
    PREPARING,
    PREPARED,
    STARTED,
    PAUSED,
    STOPPED,
    COMPLETED,
    ERROR
  }

  @Volatile
  var state: State = State.IDLE
    private set

  private var mediaPlayer: MediaPlayer? = null
  private var currentUri: String? = null

  var volume: Float = 0.85f
    private set
  var tempo: Float = 1.0f
    private set
  var pitchBend: Float = 0.0f
    private set
  var isLooping: Boolean = false

  var onCompletionListener: (() -> Unit)? = null
  var onErrorListener: ((code: String, message: String) -> Unit)? = null
  var onPlaybackStateChangeListener: ((isPlaying: Boolean) -> Unit)? = null

  private val lock = Any()
  private var seekInFlight = false
  private var pendingSeek: Pair<Double, Long>? = null
  var seekRevision: Long = 0
    private set
  private var seekStartedAt = 0L
  var lastSeekLatencyMs: Long = 0
    private set
  var seekRequests: Long = 0
    private set
  var seekCalls: Long = 0
    private set
  var onSeekSettledListener: ((Double, Long) -> Unit)? = null
  fun isSeeking(): Boolean = synchronized(lock) { seekInFlight || pendingSeek != null }


  suspend fun load(uriString: String): Double = withTimeoutOrNull(PREPARE_TIMEOUT_MS) {
    val context = getContext() ?: throw IOException("Android context unavailable")
    val uri = Uri.parse(uriString)

    suspendCancellableCoroutine { continuation ->
      synchronized(lock) {
        releaseInternal()

        try {
          val player = MediaPlayer()
          mediaPlayer = player

          val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
          player.setAudioAttributes(attributes)

          if (uri.scheme == "content") {
            try {
              context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { afd ->
                player.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
              } ?: player.setDataSource(context, uri)
            } catch (e: Exception) {
              Log.w(TAG, "AssetFileDescriptor failed, falling back to setDataSource: " + e.message)
              player.setDataSource(context, uri)
            }
          } else if (uri.scheme == "file" || uriString.startsWith("/")) {
            val p = if (uri.scheme == "file") uri.path ?: uriString else uriString
            player.setDataSource(p)
          } else {
            player.setDataSource(context, uri)
          }
          currentUri = uriString
          state = State.INITIALIZED

          player.setOnPreparedListener { mp ->
            synchronized(lock) {
              if (mediaPlayer === mp) {
                state = State.PREPARED
                applyVolumeInternal()
                val durationSec = (mp.duration.toDouble() / 1000.0).coerceAtLeast(0.0)
                if (continuation.isActive) {
                  continuation.resume(durationSec)
                }
              }
            }
          }

          player.setOnSeekCompleteListener { mp ->
            synchronized(lock) {
              if (mediaPlayer === mp) {
                lastSeekLatencyMs = SystemClock.elapsedRealtime() - seekStartedAt
                seekInFlight = false
                val next = pendingSeek
                pendingSeek = null
                if (next != null) {
                  startSeekInternal(next.first, next.second)
                } else {
                  onSeekSettledListener?.invoke(getPosition(), seekRevision)
                }
              }
            }
          }

          player.setOnCompletionListener { mp ->
            synchronized(lock) {
              if (mediaPlayer === mp) {
                if (isLooping) {
                  seek(0.0)
                  play()
                } else {
                  state = State.COMPLETED
                  onPlaybackStateChangeListener?.invoke(false)
                  onCompletionListener?.invoke()
                }
              }
            }
          }

          player.setOnErrorListener { mp, what, extra ->
            synchronized(lock) {
              if (mediaPlayer === mp) {
                state = State.ERROR
                val errorMsg = "MediaPlayer error on deck $deckId: what=$what, extra=$extra"
                Log.e(TAG, errorMsg)
                if (continuation.isActive) {
                  continuation.resumeWithException(IOException(errorMsg))
                } else {
                  onErrorListener?.invoke("MEDIA_PLAYER_ERROR", errorMsg)
                }
                onPlaybackStateChangeListener?.invoke(false)
              }
            }
            true
          }

          state = State.PREPARING
          player.prepareAsync()
        } catch (e: Exception) {
          state = State.ERROR
          Log.e(TAG, "Failed to initialize player for deck $deckId", e)
          if (continuation.isActive) {
            continuation.resumeWithException(e)
          } else {
            onErrorListener?.invoke("INIT_ERROR", e.message ?: "Failed to set data source")
          }
        }
      }

      continuation.invokeOnCancellation {
        synchronized(lock) {
          if (state == State.PREPARING) {
            releaseInternal()
          }
        }
      }
    }
  } ?: throw IOException("Timed out preparing track on deck $deckId")

  fun play(): Boolean = synchronized(lock) {
    val player = mediaPlayer ?: return false
    return try {
      when (state) {
        State.PREPARED, State.PAUSED, State.COMPLETED -> {
          applyVolumeInternal()
          player.start()
          state = State.STARTED
          applyPlaybackParamsInternal()
          onPlaybackStateChangeListener?.invoke(true)
          true
        }
        State.STARTED -> true
        else -> {
          Log.w(TAG, "Cannot play deck $deckId in state $state")
          false
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error starting playback on deck $deckId", e)
      state = State.ERROR
      onErrorListener?.invoke("PLAY_ERROR", e.message ?: "Error starting playback")
      false
    }
  }

  fun pause(): Boolean = synchronized(lock) {
    val player = mediaPlayer ?: return false
    return try {
      if (state == State.STARTED) {
        player.pause()
        state = State.PAUSED
        onPlaybackStateChangeListener?.invoke(false)
        true
      } else {
        false
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error pausing deck $deckId", e)
      false
    }
  }

  fun seek(positionSeconds: Double, revision: Long = seekRevision + 1): Double = synchronized(lock) {
    val target = positionSeconds.coerceIn(0.0, getDuration())
    if (revision < seekRevision) return target
    seekRequests++
    seekRevision = revision
    if (seekInFlight) {
      // MediaPlayer seekTo is asynchronous. Keep only the newest target until
      // OnSeekComplete; do not fill MediaPlayer's internal seek queue.
      pendingSeek = Pair(target, revision)
    } else {
      startSeekInternal(target, revision)
    }
    target
  }

  private fun startSeekInternal(positionSeconds: Double, revision: Long) {
    val player = mediaPlayer ?: return
    if (state !in listOf(State.PREPARED, State.STARTED, State.PAUSED, State.COMPLETED)) return
    try {
      val targetMs = (positionSeconds * 1000.0).toLong().coerceIn(0L, player.duration.toLong().coerceAtLeast(0L))
      seekRevision = revision
      seekInFlight = true
      seekStartedAt = SystemClock.elapsedRealtime()
      seekCalls++
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) player.seekTo(targetMs, MediaPlayer.SEEK_CLOSEST)
      else player.seekTo(targetMs.toInt())
    } catch (e: Exception) {
      seekInFlight = false
      pendingSeek = null
      onErrorListener?.invoke("SEEK_ERROR", e.message ?: "Seek failed")
      onSeekSettledListener?.invoke(getPosition(), seekRevision)
    }
  }

  fun stop(): Boolean = synchronized(lock) {
    val player = mediaPlayer ?: return false
    return try {
      if (state == State.STARTED || state == State.PAUSED) {
        player.stop()
        state = State.STOPPED
        onPlaybackStateChangeListener?.invoke(false)
        true
      } else {
        false
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error stopping deck $deckId", e)
      false
    }
  }

  fun setVolume(vol: Float) = synchronized(lock) {
    val next = vol.coerceIn(0f, 1f)
    if (volume == next) return@synchronized
    volume = next
    applyVolumeInternal()
  }

  fun setTempo(rate: Float) = setRate(rate, pitchBend)

  fun setPitchBend(bend: Float) = setRate(tempo, bend)

  fun setRate(rate: Float, bend: Float) = synchronized(lock) {
    val nextTempo = rate.coerceIn(0.5f, 2f)
    val nextBend = bend.coerceIn(-1f, 1f)
    if (tempo == nextTempo && pitchBend == nextBend) return@synchronized
    tempo = nextTempo
    pitchBend = nextBend
    // Store while paused/prepared. setPlaybackParams(nonzero speed) can start
    // a paused MediaPlayer, so only apply live rate changes while STARTED.
    if (state == State.STARTED) applyPlaybackParamsInternal()
  }

  fun getPosition(): Double = synchronized(lock) {
    val player = mediaPlayer ?: return 0.0
    if (state == State.PREPARED || state == State.STARTED || state == State.PAUSED || state == State.COMPLETED) {
      try {
        return (player.currentPosition.toDouble() / 1000.0).coerceAtLeast(0.0)
      } catch (_: Exception) {}
    }
    return 0.0
  }

  fun getDuration(): Double = synchronized(lock) {
    val player = mediaPlayer ?: return 0.0
    if (state == State.PREPARED || state == State.STARTED || state == State.PAUSED || state == State.COMPLETED) {
      try {
        return (player.duration.toDouble() / 1000.0).coerceAtLeast(0.0)
      } catch (_: Exception) {}
    }
    return 0.0
  }

  fun isPlaying(): Boolean = synchronized(lock) {
    return state == State.STARTED
  }

  fun release() = synchronized(lock) {
    releaseInternal()
  }

  private fun applyVolumeInternal() {
    val player = mediaPlayer ?: return
    if (state != State.IDLE && state != State.INITIALIZED && state != State.PREPARING && state != State.ERROR) {
      try {

        player.setVolume(volume, volume)
      } catch (e: Exception) {
        Log.w(TAG, "Failed to apply volume on deck $deckId: ${e.message}")
      }
    }
  }

  private fun applyPlaybackParamsInternal() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val player = mediaPlayer ?: return
      if (state == State.STARTED) {
        try {
          val effectiveSpeed = (tempo * (1f + pitchBend * 0.08f)).coerceIn(0.5f, 2.0f)
          val params = player.playbackParams ?: PlaybackParams()
          params.speed = effectiveSpeed
          player.playbackParams = params
        } catch (e: Exception) {
          Log.w(TAG, "Failed to apply playbackParams on deck $deckId: ${e.message}")
        }
      }
    }
  }

  private fun releaseInternal() {
    try {
      mediaPlayer?.setOnSeekCompleteListener(null)
      seekInFlight = false
      pendingSeek = null
      seekRevision = 0
      mediaPlayer?.setOnPreparedListener(null)
      mediaPlayer?.setOnCompletionListener(null)
      mediaPlayer?.setOnErrorListener(null)
      if (mediaPlayer?.isPlaying == true) {
        mediaPlayer?.stop()
      }
      mediaPlayer?.reset()
      mediaPlayer?.release()
    } catch (e: Exception) {
      Log.w(TAG, "Exception during release of deck $deckId: ${e.message}")
    } finally {
      mediaPlayer = null
      currentUri = null
      state = State.IDLE
    }
  }
}
