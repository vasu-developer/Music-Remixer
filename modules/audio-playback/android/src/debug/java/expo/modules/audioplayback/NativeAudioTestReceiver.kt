package expo.modules.audioplayback

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.launch
import org.json.JSONObject

/** ADB verification for Phase 3.2 and Phase 3.3 dual-deck native audio decoding and Oboe playback. */
class NativeAudioTestReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    val command = intent.getStringExtra("command") ?: "diagnostics"
    val requestId = intent.getStringExtra("requestId") ?: "manual"
    NativeAudioBridge.scope.launch {
      try {
        val result: Any = when (command) {
          "initialize" -> NativeAudioBridge.initialize()
          "loadTrack" -> {
            val uri = intent.getStringExtra("uri") ?: ""
            val deckId = intent.getStringExtra("deckId") ?: intent.getStringExtra("deck") ?: "A"
            val res = NativeAudioBridge.loadTrackUri(context, deckId, uri)
            res["success"] == true
          }
          "start" -> NativeAudioBridge.start()
          "play" -> {
            val deckId = intent.getStringExtra("deckId") ?: intent.getStringExtra("deck") ?: "A"
            val deckIndex = NativeAudioBridge.deckToIndex(deckId)
            NativeAudioBridge.playDeck(deckIndex)
          }
          "pause" -> {
            val deckId = intent.getStringExtra("deckId") ?: intent.getStringExtra("deck") ?: "A"
            val deckIndex = NativeAudioBridge.deckToIndex(deckId)
            NativeAudioBridge.pauseDeck(deckIndex)
          }
          "stop" -> NativeAudioBridge.stop()
          "release" -> { NativeAudioBridge.release(); true }
          "volume" -> {
            val deckId = intent.getStringExtra("deckId") ?: intent.getStringExtra("deck") ?: "A"
            val deckIndex = NativeAudioBridge.deckToIndex(deckId)
            val volume = intent.getFloatExtra("volume", 0.5f)
            NativeAudioBridge.setVolume(deckIndex, volume)
            true
          }
          "eq" -> {
            val deckId = intent.getStringExtra("deck") ?: "A"
            val band = intent.getIntExtra("band", 0)
            require(band in 0..2)
            NativeAudioBridge.setEq(NativeAudioBridge.deckToIndex(deckId), band,
              intent.getFloatExtra("value", 0f), intent.getBooleanExtra("kill", false))
            true
          }
          "rate" -> {
            val deckId = intent.getStringExtra("deck") ?: "A"
            NativeAudioBridge.setRate(NativeAudioBridge.deckToIndex(deckId), intent.getFloatExtra("rate", 1f))
            true
          }
          "toneVolume" -> {
            NativeAudioBridge.setTestToneVolume(intent.getFloatExtra("volume", 0.05f))
            true
          }
          else -> command == "diagnostics"
        }
        Log.i("RemixerOboeTest", "id=$requestId $command result=$result ${JSONObject(NativeAudioBridge.getDiagnostics())}")
      } catch (error: Throwable) {
        Log.e("RemixerOboeTest", "$command failed", error)
      } finally { pending.finish() }
    }
  }
}
