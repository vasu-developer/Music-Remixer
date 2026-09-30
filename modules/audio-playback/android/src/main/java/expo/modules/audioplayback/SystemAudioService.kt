package expo.modules.audioplayback

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.audiofx.*
import android.os.Build
import android.os.IBinder
import kotlin.math.abs

/** Owns external-session effects independently of the React screen's lifetime. */
class SystemAudioService : Service() {
  companion object {
    private var active: SystemAudioService? = null
    private var failure: String? = null
    @Synchronized fun snapshot(): Map<String, Any?> = active?.state() ?: mapOf("running" to false, "error" to failure, "sessions" to emptyList<Any>(), "bands" to emptyList<Any>())
    @Synchronized fun select(id: Int) { active?.attach(id) ?: error("Enable system audio first") }
    @Synchronized fun control(name: String, value: Double) { require(value.isFinite()); active?.change(name, value) ?: error("Enable system audio first") }
    @Synchronized fun visualize(enabled: Boolean) { active?.setVisualizer(enabled) }
  }
  private val sessions = linkedMapOf<Int, String>()
  private var selected = -1
  private var global = false
  private var eq: Equalizer? = null
  private var bass: BassBoost? = null
  private var dynamics: DynamicsProcessing? = null
  private var visualizer: Visualizer? = null
  private var error: String? = null
  private var visualizationError: String? = null
  private var registered = false
  private var preamp = 0f
  private var limiting = true
  private var compressing = false
  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = synchronized(Companion) {
      val id = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, -1)
      val owner = intent.getStringExtra(AudioEffect.EXTRA_PACKAGE_NAME) ?: return@synchronized
      if (id <= 0 || owner == packageName) return@synchronized
      when (intent.action) {
        AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION -> {
          if (sessions.size >= 64 && id !in sessions) return@synchronized
          sessions[id] = owner
          if (!global && selected == -1) attach(id)
        }
        AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION -> {
          if (sessions[id] != owner) return@synchronized
          sessions.remove(id)
          if (selected == id) { releaseEffects(); sessions.keys.firstOrNull()?.let { attach(it) } }
        }
      }
    }
  }
  override fun onCreate() {
    super.onCreate()
    synchronized(Companion) { active = this; failure = null }
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "stop") { stopSelf(); return START_NOT_STICKY }
    try {
      val manager = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("system_audio", "System audio controls", NotificationManager.IMPORTANCE_LOW))
      val stop = PendingIntent.getService(this, 1, Intent(this, javaClass).setAction("stop"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      val launch = packageManager.getLaunchIntentForPackage(packageName)
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "system_audio") else Notification.Builder(this)
      builder.setContentTitle("Remixer system audio").setContentText("Listening for compatible audio sessions").setSmallIcon(android.R.drawable.ic_media_play).setOngoing(true)
        .addAction(Notification.Action.Builder(null, "Stop", stop).build())
      if (launch != null) builder.setContentIntent(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
      if (Build.VERSION.SDK_INT >= 34) startForeground(9021, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(9021, builder.build())
      synchronized(Companion) {
        if (!registered) {
          val filter = IntentFilter(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION).apply { addAction(AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION) }
          if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED) else registerReceiver(receiver, filter)
          registered = true
        }
        val nextGlobal = intent?.getBooleanExtra("global", false) ?: false
        if (nextGlobal != global || selected == -1) {
          releaseEffects(); global = nextGlobal
          if (global) attach(0) else sessions.keys.firstOrNull()?.let { attach(it) }
        }
      }
    } catch (e: Exception) {
      synchronized(Companion) { failure = "Cannot start system audio: ${e.message}" }
      stopSelf()
    }
    return START_NOT_STICKY
  }
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onDestroy() {
    synchronized(Companion) {
      if (registered) unregisterReceiver(receiver)
      releaseEffects(); sessions.clear(); if (active === this) active = null
    }
    super.onDestroy()
  }
  private fun releaseEffects() {
    listOfNotNull(visualizer).forEach { runCatching { it.release() } }; visualizer = null
    listOfNotNull(eq, bass, dynamics).forEach { runCatching { it.release() } }
    eq = null; bass = null; dynamics = null; selected = -1
    visualizationError = null
  }
  private fun <T : AudioEffect> effect(label: String, create: () -> T, configure: (T) -> Unit = {}): T? {
    var value: T? = null
    return try {
      value = create()
      check(value.hasControl()) { "another equalizer owns this effect" }
      configure(value)
      check(value.setEnabled(true) == AudioEffect.SUCCESS) { "could not enable effect" }
      value
    } catch (e: Exception) {
      runCatching { value?.release() }; error = listOfNotNull(error, "$label: ${e.message}").joinToString("\n"); null
    }
  }
  private fun attach(id: Int) {
    require((global && id == 0) || (!global && sessions.containsKey(id))) { "Session is no longer available" }
    releaseEffects(); selected = id; error = null; preamp = 0f; limiting = true; compressing = false
    eq = effect("Equalizer", { Equalizer(0, id) }, { e ->
      for (b in 0 until e.numberOfBands.toInt()) e.setBandLevel(b.toShort(), 0)
    })
    bass = effect("Bass boost", { BassBoost(0, id) }, { it.setStrength(0) })
    if (Build.VERSION.SDK_INT >= 28) dynamics = effect("Dynamics", {
      val config = DynamicsProcessing.Config.Builder(0, 2, false, 0, true, 1, false, 0, true).build()
      DynamicsProcessing(0, id, config)
    }, { configureDynamics(it) })
  }
  private fun configureDynamics(d: DynamicsProcessing) {
    d.setInputGainAllChannelsTo(preamp)
    d.setLimiterAllChannelsTo(DynamicsProcessing.Limiter(true, limiting, 0, 1f, 60f, 20f, -1f, 0f))
    d.setMbcBandAllChannelsTo(0, DynamicsProcessing.MbcBand(compressing, 20000f, 10f, 100f, 3f, -18f, 6f, -90f, 1f, 0f, 0f))
  }
  private fun change(name: String, value: Double) {
    when {
      name.startsWith("band:") -> {
        val e = eq ?: error("Equalizer unavailable")
        check(e.hasControl()) { "Equalizer control lost to another app" }
        val b = name.substringAfter(":").toInt(); require(b in 0 until e.numberOfBands.toInt())
        e.setBandLevel(b.toShort(), (value * 100).toInt().coerceIn(e.bandLevelRange[0].toInt(), e.bandLevelRange[1].toInt()).toShort())
      }
      name == "bass" -> { val b = bass ?: error("Bass boost unavailable"); check(b.hasControl()); check(b.strengthSupported); b.setStrength(value.toInt().coerceIn(0, 1000).toShort()) }
      name in listOf("preamp", "limiter", "compressor") -> {
        val d = dynamics ?: error("Dynamics processing unavailable"); check(d.hasControl())
        when (name) { "preamp" -> preamp = value.toFloat().coerceIn(-12f, 12f); "limiter" -> limiting = value >= .5; "compressor" -> compressing = value >= .5 }
        configureDynamics(d)
      }
      else -> error("Unknown system sound control")
    }
  }
  private fun setVisualizer(enabled: Boolean) {
    runCatching { visualizer?.release() }; visualizer = null; visualizationError = null
    if (!enabled) return
    var v: Visualizer? = null
    try {
      check(selected >= 0) { "Select an audio session first" }
      check(checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { "Microphone permission is required by Android's Visualizer API" }
      v = Visualizer(selected)
      check(v.setCaptureSize(Visualizer.getCaptureSizeRange()[0]) == Visualizer.SUCCESS)
      check(v.setEnabled(true) == Visualizer.SUCCESS)
      visualizer = v
    } catch (e: Exception) { runCatching { v?.release() }; visualizationError = e.message }
  }
  private fun state(): Map<String, Any?> {
    try {
      val e = eq
      val bands = if (e == null) emptyList() else (0 until e.numberOfBands.toInt()).map { i -> mapOf("index" to i, "hz" to e.getCenterFreq(i.toShort()) / 1000.0, "value" to e.getBandLevel(i.toShort()) / 100.0) }
      val waveform = visualizer?.let { v ->
        try {
          val data = ByteArray(v.captureSize)
          check(v.getWaveForm(data) == Visualizer.SUCCESS) { "Audio visualization unavailable" }
          (0 until 24).map { bar ->
            val start = bar * data.size / 24; val end = (bar + 1) * data.size / 24
            (start until end).maxOf { abs((data[it].toInt() and 255) - 128) } / 128.0
          }
        } catch (ex: Exception) { visualizationError = ex.message; emptyList<Double>() }
      } ?: emptyList()
      return mapOf("running" to true, "global" to global, "selected" to selected,
        "sessions" to sessions.map { mapOf("id" to it.key, "packageName" to it.value) },
        "bands" to bands, "min" to (e?.bandLevelRange?.get(0)?.div(100.0) ?: -12), "max" to (e?.bandLevelRange?.get(1)?.div(100.0) ?: 12),
        "eqControl" to (e?.hasControl() == true && e.enabled), "bassSupported" to (bass?.let { it.hasControl() && it.strengthSupported && it.enabled } ?: false),
        "bass" to (bass?.roundedStrength?.toInt() ?: 0), "dynamicsSupported" to (dynamics?.let { it.hasControl() && it.enabled } ?: false),
        "preamp" to preamp, "limiter" to limiting, "compressor" to compressing,
        "visualizing" to (visualizer != null), "waveform" to waveform, "visualizationError" to visualizationError, "error" to error)
    } catch (ex: Exception) {
      releaseEffects(); error = "Audio session ended or effect failed: ${ex.message}"
      return mapOf("running" to true, "global" to global, "selected" to -1, "sessions" to sessions.map { mapOf("id" to it.key, "packageName" to it.value) }, "bands" to emptyList<Any>(), "error" to error)
    }
  }
}
