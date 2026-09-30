package expo.modules.audioplayback

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SystemEqualizerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SystemEqualizer")
    Function("mediaPlayers") {
      MediaTransport.snapshot(appContext.reactContext ?: error("Android context unavailable"))
    }
    Function("mediaCommand") { id: String, command: String ->
      MediaTransport.command(appContext.reactContext ?: error("Android context unavailable"), id, command)
    }
    Function("openMediaAccess") {
      val context = appContext.reactContext ?: error("Android context unavailable")
      context.startActivity(Intent(android.provider.Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    Function("status") { SystemAudioService.snapshot() }
    Function("start") { global: Boolean ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      check(appContext.currentActivity != null) { "Open Remixer before enabling system audio" }
      val intent = Intent(context, SystemAudioService::class.java).putExtra("global", global)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
    }
    Function("stop") {
      appContext.reactContext?.let { it.stopService(Intent(it, SystemAudioService::class.java)) }
    }
    Function("select") { id: Int -> SystemAudioService.select(id) }
    Function("setControl") { name: String, value: Double -> SystemAudioService.control(name, value) }
    Function("visualize") { enabled: Boolean -> SystemAudioService.visualize(enabled) }
  }
}
