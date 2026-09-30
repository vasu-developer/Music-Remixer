package expo.modules.audioplayback

import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.service.notification.NotificationListenerService

// Notification access is used only for MediaSessionManager authorization.
// No notification contents are inspected or stored.
class RemixerMediaListener : NotificationListenerService()

internal object MediaTransport {
  private fun controllers(context: Context): List<MediaController> =
    context.getSystemService(MediaSessionManager::class.java)
      .getActiveSessions(ComponentName(context, RemixerMediaListener::class.java))
      .filter { it.packageName != context.packageName }

  fun snapshot(context: Context): Map<String, Any> = try {
    mapOf("access" to true, "players" to controllers(context).map { c ->
      val state = c.playbackState
      val actions = state?.actions ?: 0L
      val playing = state?.state == PlaybackState.STATE_PLAYING
      mapOf("id" to c.sessionToken.hashCode().toString(), "packageName" to c.packageName,
        "title" to (c.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: c.packageName),
        "artist" to (c.metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: ""),
        "playing" to playing,
        "canPlay" to (actions and (PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PLAY_PAUSE) != 0L),
        "canPause" to (actions and (PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE) != 0L),
        "canNext" to (actions and PlaybackState.ACTION_SKIP_TO_NEXT != 0L),
        "canPrevious" to (actions and PlaybackState.ACTION_SKIP_TO_PREVIOUS != 0L))
    })
  } catch (_: SecurityException) { mapOf("access" to false, "players" to emptyList<Any>()) }

  fun command(context: Context, id: String, command: String) {
    val player = controllers(context).firstOrNull { it.sessionToken.hashCode().toString() == id }
      ?: error("This player session has ended. Select a player again.")
    val actions = player.playbackState?.actions ?: 0L
    val required = when(command) {
      "play" -> PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PLAY_PAUSE
      "pause" -> PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE
      "next" -> PlaybackState.ACTION_SKIP_TO_NEXT
      "previous" -> PlaybackState.ACTION_SKIP_TO_PREVIOUS
      else -> error("Unknown transport command")
    }
    check(actions and required != 0L) { "This player does not support $command" }
    if (command == "play" || command == "pause") {
      val direct = if (command == "play") PlaybackState.ACTION_PLAY else PlaybackState.ACTION_PAUSE
      if (actions and direct == 0L) {
        val playing = player.playbackState?.state == PlaybackState.STATE_PLAYING
        if (playing != (command == "play")) {
          player.dispatchMediaButtonEvent(android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
          player.dispatchMediaButtonEvent(android.view.KeyEvent(android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
        }
        return
      }
    }
    when(command) {
      "play" -> player.transportControls.play()
      "pause" -> player.transportControls.pause()
      "next" -> player.transportControls.skipToNext()
      "previous" -> player.transportControls.skipToPrevious()
    }
  }
}
