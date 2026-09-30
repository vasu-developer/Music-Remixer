package expo.modules.audioplayback

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.launch

/** Phase 3.3.2: Dual-Deck Native PCM Audio Decoding & Playback through Oboe. */
class NativeAudioModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeAudioEngine")
    Function("setMasterFx") { index: Int, value: Double ->
      require(index in 0..16 && value.isFinite()) { "Invalid master audio control" }
      NativeAudioBridge.setMasterFx(index, value.toFloat())
    }

    AsyncFunction("initialize") {
      NativeAudioBridge.initialize()
    }.runOnQueue(NativeAudioBridge.scope)

    AsyncFunction("loadTrack") { deckId: String, uriString: String ->
      val context = appContext.reactContext ?: error("Context unavailable")
      NativeAudioBridge.loadTrackUri(context, deckId, uriString)
    }.runOnQueue(NativeAudioBridge.scope)

    AsyncFunction("play") { deckId: String ->
      val idx = NativeAudioBridge.deckToIndex(deckId)
      NativeAudioBridge.playDeck(idx)
    }.runOnQueue(NativeAudioBridge.scope)

    AsyncFunction("pause") { deckId: String ->
      val idx = NativeAudioBridge.deckToIndex(deckId)
      NativeAudioBridge.pauseDeck(idx)
    }.runOnQueue(NativeAudioBridge.scope)

    AsyncFunction("start") {
      NativeAudioBridge.playDeck(0)
    }.runOnQueue(NativeAudioBridge.scope)

    AsyncFunction("stop") {
      NativeAudioBridge.stop()
    }.runOnQueue(NativeAudioBridge.scope)

    AsyncFunction("seek") { deckId: String, positionSeconds: Double ->
      val idx = NativeAudioBridge.deckToIndex(deckId)
      check(NativeAudioBridge.seekTo(idx, positionSeconds)) { "Native seek failed" }
      NativeAudioBridge.getPosition(idx)
    }.runOnQueue(NativeAudioBridge.scope)

    AsyncFunction("release") {
      NativeAudioBridge.release()
    }.runOnQueue(NativeAudioBridge.scope)

    Function("setTestToneVolume") { volume: Double ->
      NativeAudioBridge.setTestToneVolume(volume.toFloat())
    }

    Function("setVolume") { deckId: String, volume: Double, seq: Int?, tGesture: Double? ->
      val s = seq ?: 0
      val t = tGesture?.toLong() ?: 0L
      val idx = NativeAudioBridge.deckToIndex(deckId)
      NativeAudioBridge.setVolume(idx, volume.toFloat(), s, t)
    }

    Function("setEQ") { deckId: String, band: Int, value: Double, kill: Boolean ->
      require(band in 0..2) { "Invalid EQ band" }
      NativeAudioBridge.setEq(NativeAudioBridge.deckToIndex(deckId), band, value.toFloat(), kill)
    }

    Function("setRate") { deckId: String, rate: Double ->
      NativeAudioBridge.setRate(NativeAudioBridge.deckToIndex(deckId), rate.toFloat())
    }

    Function("getPosition") { deckId: String ->
      val idx = NativeAudioBridge.deckToIndex(deckId)
      NativeAudioBridge.getPosition(idx)
    }

    Function("getDuration") { deckId: String ->
      val idx = NativeAudioBridge.deckToIndex(deckId)
      NativeAudioBridge.getDuration(idx)
    }

    Function("isPlaying") { deckId: String ->
      val idx = NativeAudioBridge.deckToIndex(deckId)
      NativeAudioBridge.isDeckPlaying(idx)
    }

    AsyncFunction("getDiagnostics") {
      NativeAudioBridge.getDiagnostics()
    }.runOnQueue(NativeAudioBridge.scope)

    OnActivityEntersBackground {
      NativeAudioBridge.scope.launch { NativeAudioBridge.stop() }
    }

    OnDestroy {
      NativeAudioBridge.scope.launch { NativeAudioBridge.release() }
    }
  }
}
