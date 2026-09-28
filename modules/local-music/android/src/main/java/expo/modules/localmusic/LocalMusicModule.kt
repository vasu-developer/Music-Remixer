package expo.modules.localmusic

import android.Manifest
import android.content.ContentUris
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel

class LocalMusicModule : Module() {
  private val waveformExecutor = java.util.concurrent.Executors.newSingleThreadExecutor { task ->
    Thread({ android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_BACKGROUND); task.run() }, "WaveformAnalysis")
  }
  private val waveformScope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + waveformExecutor.asCoroutineDispatcher())
  override fun definition() = ModuleDefinition {
    Name("LocalMusic")
    OnDestroy { waveformScope.cancel(); waveformExecutor.shutdownNow() }
    AsyncFunction("getWaveform") { uri: String, version: String, seconds: Double ->
      val context = appContext.reactContext ?: error("Android context is unavailable")
      WaveformAnalyzer.analyze(context, uri, version, seconds)
    }.runOnQueue(waveformScope)

    // Module AsyncFunction runs on Expo's worker queue, not the UI thread.
    // Keyset pagination bounds the metadata crossing into JS on each call.
    AsyncFunction("getLocalAudioTracks") { afterId: String?, requestedLimit: Int ->
      val context = appContext.reactContext ?: error("Android context is unavailable")
      val permission = if (Build.VERSION.SDK_INT >= 33) {
        Manifest.permission.READ_MEDIA_AUDIO
      } else {
        Manifest.permission.READ_EXTERNAL_STORAGE
      }
      if (context.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("Music access has not been granted")
      }
      val limit = requestedLimit.coerceIn(1, 200)
      val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
      val projection = arrayOf(
        MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.DISPLAY_NAME, MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.ALBUM, MediaStore.Audio.Media.ALBUM_ID,
        MediaStore.Audio.Media.DURATION, MediaStore.Audio.Media.MIME_TYPE,
        MediaStore.Audio.Media.DATE_MODIFIED
      )
      val selection = "${MediaStore.Audio.Media._ID} > ?"
      val args = arrayOf((afterId?.toLongOrNull() ?: -1L).toString())
      val rows = mutableListOf<Map<String, Any?>>()
      var nextCursor: String? = null
      // Audio collection only. Do not filter IS_MUSIC: user audio is often
      // indexed without that flag. No raw filesystem paths or decoding.
      val cursor = context.contentResolver.query(collection, projection, selection, args,
        "${MediaStore.Audio.Media._ID} ASC") ?: error("MediaStore query returned no cursor")
      cursor.use {
        while (it.moveToNext()) {
          if (rows.size == limit) {
            nextCursor = rows.last()["id"] as String
            break
          }
          val id = it.getLong(it.getColumnIndexOrThrow(MediaStore.Audio.Media._ID))
          val albumId = it.text(MediaStore.Audio.Media.ALBUM_ID)?.toLongOrNull()
          rows.add(mapOf(
            "id" to id.toString(),
            "uri" to ContentUris.withAppendedId(collection, id).toString(),
            "title" to it.text(MediaStore.Audio.Media.TITLE),
            "displayName" to it.text(MediaStore.Audio.Media.DISPLAY_NAME),
            "artist" to it.text(MediaStore.Audio.Media.ARTIST),
            "album" to it.text(MediaStore.Audio.Media.ALBUM),
            "durationMs" to it.text(MediaStore.Audio.Media.DURATION)?.toDoubleOrNull(),
            "mimeType" to it.text(MediaStore.Audio.Media.MIME_TYPE),
            "dateModified" to it.text(MediaStore.Audio.Media.DATE_MODIFIED)?.toDoubleOrNull(),
            // Best-effort provider artwork; the UI falls back when unavailable.
            "artworkUrl" to albumId?.takeIf { album -> album > 0 }?.let { album ->
              ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), album).toString()
            }
          ))
        }
      }
      mapOf("tracks" to rows, "nextCursor" to nextCursor)
    }
  }
}

private fun Cursor.text(column: String): String? {
  val index = getColumnIndex(column)
  return if (index < 0 || isNull(index)) null else getString(index)
}
