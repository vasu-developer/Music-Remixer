package expo.modules.audioplayback

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.android.asCoroutineDispatcher
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class AudioPlaybackModule : Module() {
  companion object {
    private const val TAG = "AudioPlaybackModule"
    private const val POSITION_TICK_INTERVAL_MS = 50L
  }

  private val deckA by lazy {
    DeckPlayer("A") { appContext.reactContext }.also { wireDeckCallbacks(it) }
  }

  private val deckB by lazy {
    DeckPlayer("B") { appContext.reactContext }.also { wireDeckCallbacks(it) }
  }

  private var audioManager: AudioManager? = null
  private var audioFocusRequest: AudioFocusRequest? = null
  private var hasAudioFocus = false
  private var wasPlayingAOnFocusLoss = false
  private var wasPlayingBOnFocusLoss = false

  private var tickerJob: Job? = null
  private val audioThread = HandlerThread("RemixerAudio").apply { start() }
  private val audioHandler = Handler(audioThread.looper)
  private val moduleScope = CoroutineScope(SupervisorJob() + audioHandler.asCoroutineDispatcher("RemixerAudio"))

  private var isNoisyReceiverRegistered = false
  private val becomingNoisyReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
        moduleScope.launch {
          wasPlayingAOnFocusLoss = false
          wasPlayingBOnFocusLoss = false
          deckA.pause()
          deckB.pause()
        }
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AudioPlayback")

    Events(
      "onPositionUpdate",
      "onPlaybackStateChange",
      "onTrackCompleted",
      "onError"
    )

    OnCreate {
      val context = appContext.reactContext
      if (context != null) {
        audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        try {
          val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
          context.registerReceiver(becomingNoisyReceiver, filter)
          isNoisyReceiverRegistered = true
        } catch (e: Exception) {
          Log.w(TAG, "Failed to register becoming noisy receiver: ${e.message}")
        }
      }
    }

    OnDestroy {
      tickerJob?.cancel()
      tickerJob = null

      val context = appContext.reactContext
      if (context != null && isNoisyReceiverRegistered) {
        try {
          context.unregisterReceiver(becomingNoisyReceiver)
        } catch (_: Exception) {}
        isNoisyReceiverRegistered = false
      }

      moduleScope.launch {
        deckA.release()
        deckB.release()
        abandonAudioFocusInternal()
        moduleScope.cancel()
        audioThread.quitSafely()
      }
    }

    AsyncFunction("loadTrack") { deckId: String, uri: String, promise: Promise ->
      val deck = getDeck(deckId)
      if (deck == null) {
        promise.reject("INVALID_DECK", "Invalid deck identifier: $deckId", null)
        return@AsyncFunction
      }
      moduleScope.launch {
        try {
          val duration = deck.load(uri)
          promise.resolve(mapOf(
            "deckId" to deck.deckId,
            "duration" to duration
          ))
        } catch (e: Exception) {
          promise.reject("LOAD_ERROR", e.message ?: "Failed to load audio track", e)
        }
      }
    }.runOnQueue(moduleScope)

    AsyncFunction("play") { deckId: String ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      if (!requestAudioFocusInternal()) {
        Log.w(TAG, "Audio focus not granted for deck $deckId")
      }
      val started = deck.play()
      if (started) {
        startPositionTickerIfNeeded()
      }
      started
    }.runOnQueue(moduleScope)

    AsyncFunction("pause") { deckId: String ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      val paused = deck.pause()
      checkAndAbandonAudioFocusIfIdle()
      paused
    }.runOnQueue(moduleScope)

    AsyncFunction("seek") { deckId: String, positionSeconds: Double, revision: Long ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      deck.seek(positionSeconds, revision)
    }.runOnQueue(moduleScope)

    AsyncFunction("stop") { deckId: String ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      val stopped = deck.stop()
      checkAndAbandonAudioFocusIfIdle()
      stopped
    }.runOnQueue(moduleScope)

    AsyncFunction("setMixerVolumes") { volumeA: Double, volumeB: Double ->

      deckA.setVolume(volumeA.toFloat())
      deckB.setVolume(volumeB.toFloat())
    }.runOnQueue(moduleScope)

    AsyncFunction("setDeckRate") { deckId: String, tempo: Double, pitchBend: Double ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      deck.setRate(tempo.toFloat(), pitchBend.toFloat())
    }.runOnQueue(moduleScope)

    AsyncFunction("getControlDiagnostics") {
      mapOf("thread" to Thread.currentThread().name,
        "seekCallsA" to deckA.seekCalls, "seekRequestsA" to deckA.seekRequests,
        "seekCallsB" to deckB.seekCalls, "seekRequestsB" to deckB.seekRequests,
        "lastSeekLatencyMsA" to deckA.lastSeekLatencyMs, "lastSeekLatencyMsB" to deckB.lastSeekLatencyMs,
        "seekingA" to deckA.isSeeking(), "seekingB" to deckB.isSeeking(),
        "volumeA" to deckA.volume, "volumeB" to deckB.volume,
        "tempoA" to deckA.tempo, "tempoB" to deckB.tempo,
        "pitchBendA" to deckA.pitchBend, "pitchBendB" to deckB.pitchBend)
    }.runOnQueue(moduleScope)

    AsyncFunction("setVolume") { deckId: String, volume: Double ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      deck.setVolume(volume.toFloat())
    }.runOnQueue(moduleScope)

    AsyncFunction("setTempo") { deckId: String, rate: Double ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      deck.setTempo(rate.toFloat())
    }.runOnQueue(moduleScope)

    AsyncFunction("setPitchBend") { deckId: String, amount: Double ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      deck.setPitchBend(amount.toFloat())
    }.runOnQueue(moduleScope)

    AsyncFunction("setLoop") { deckId: String, isLooping: Boolean ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      deck.isLooping = isLooping
    }.runOnQueue(moduleScope)

    AsyncFunction("getPosition") { deckId: String ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      deck.getPosition()
    }.runOnQueue(moduleScope)

    AsyncFunction("getDuration") { deckId: String ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      deck.getDuration()
    }.runOnQueue(moduleScope)

    AsyncFunction("getPlaybackState") { deckId: String ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      mapOf(
        "deckId" to deck.deckId,
        "isPlaying" to deck.isPlaying(),
        "position" to deck.getPosition(),
        "duration" to deck.getDuration()
      )
    }.runOnQueue(moduleScope)

    AsyncFunction("isDeckPlaying") { deckId: String ->
      val deck = getDeck(deckId) ?: error("Invalid deck identifier: $deckId")
      deck.isPlaying()
    }.runOnQueue(moduleScope)
  }

  private fun getDeck(deckId: String): DeckPlayer? {
    return when (deckId.trim().uppercase()) {
      "A" -> deckA
      "B" -> deckB
      else -> null
    }
  }

  private fun wireDeckCallbacks(deck: DeckPlayer) {
    deck.onSeekSettledListener = { position, revision ->
      sendEvent("onPositionUpdate", mapOf("deckId" to deck.deckId,
        "position" to position, "seekRevision" to revision, "isSeeking" to false))
    }
    deck.onPlaybackStateChangeListener = { isPlaying ->
      sendEvent("onPlaybackStateChange", mapOf(
        "deckId" to deck.deckId,
        "isPlaying" to isPlaying,
        "isEnded" to false
      ))
      if (isPlaying) {
        startPositionTickerIfNeeded()
      } else {
        checkAndAbandonAudioFocusIfIdle()
      }
    }

    deck.onCompletionListener = {
      sendEvent("onTrackCompleted", mapOf(
        "deckId" to deck.deckId
      ))
      sendEvent("onPlaybackStateChange", mapOf(
        "deckId" to deck.deckId,
        "isPlaying" to false,
        "isEnded" to true
      ))
      checkAndAbandonAudioFocusIfIdle()
    }

    deck.onErrorListener = { code, message ->
      sendEvent("onError", mapOf(
        "deckId" to deck.deckId,
        "code" to code,
        "message" to message
      ))
      checkAndAbandonAudioFocusIfIdle()
    }
  }

  @Synchronized
  private fun startPositionTickerIfNeeded() {
    if (tickerJob?.isActive == true) return

    tickerJob = moduleScope.launch {
      while (isActive) {
        val playingA = deckA.isPlaying()
        val playingB = deckB.isPlaying()

        if (!playingA && !playingB) {
          break
        }

        if (playingA) {
          sendEvent("onPositionUpdate", mapOf(
            "deckId" to "A",
            "position" to deckA.getPosition(),
            "seekRevision" to deckA.seekRevision, "isSeeking" to deckA.isSeeking()
          ))
        }

        if (playingB) {
          sendEvent("onPositionUpdate", mapOf(
            "deckId" to "B",
            "position" to deckB.getPosition(),
            "seekRevision" to deckB.seekRevision, "isSeeking" to deckB.isSeeking()
          ))
        }

        delay(POSITION_TICK_INTERVAL_MS)
      }
      tickerJob = null
    }
  }

  @Synchronized
  private fun requestAudioFocusInternal(): Boolean {
    val manager = audioManager ?: return false
    if (hasAudioFocus) return true

    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        )
        .setAcceptsDelayedFocusGain(false)
        .setOnAudioFocusChangeListener({ focusChange -> moduleScope.launch { handleAudioFocusChange(focusChange) } }, audioHandler)
        .build()
      audioFocusRequest = request
      manager.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      manager.requestAudioFocus(
        { focusChange -> moduleScope.launch { handleAudioFocusChange(focusChange) } },
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN
      )
    }

    hasAudioFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED)
    return hasAudioFocus
  }

  @Synchronized
  private fun abandonAudioFocusInternal() {
    if (!hasAudioFocus) return
    val manager = audioManager ?: return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      audioFocusRequest?.let { manager.abandonAudioFocusRequest(it) }
      audioFocusRequest = null
    } else {
      @Suppress("DEPRECATION")
      manager.abandonAudioFocus { }
    }
    hasAudioFocus = false
  }

  private fun checkAndAbandonAudioFocusIfIdle() {
    if (!deckA.isPlaying() && !deckB.isPlaying()) {
      abandonAudioFocusInternal()
    }
  }

  private fun handleAudioFocusChange(focusChange: Int) {
    when (focusChange) {
      AudioManager.AUDIOFOCUS_LOSS -> {
        hasAudioFocus = false
        wasPlayingAOnFocusLoss = false
        wasPlayingBOnFocusLoss = false
        deckA.pause()
        deckB.pause()
      }
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
        wasPlayingAOnFocusLoss = deckA.isPlaying()
        wasPlayingBOnFocusLoss = deckB.isPlaying()
        deckA.pause()
        deckB.pause()
      }
      AudioManager.AUDIOFOCUS_GAIN -> {
        hasAudioFocus = true
        if (wasPlayingAOnFocusLoss) {
          wasPlayingAOnFocusLoss = false
          deckA.play()
        }
        if (wasPlayingBOnFocusLoss) {
          wasPlayingBOnFocusLoss = false
          deckB.play()
        }
      }
    }
  }
}
