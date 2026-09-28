import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';
import { Track } from '@/types';
import { normalizeLocalTrack } from './normalizeTrack';

export type MusicPermission = 'unknown' | 'granted' | 'denied' | 'blocked' | 'unavailable';
interface LocalMusicModule {
  getLocalAudioTracks(afterId: string | null, limit: number): Promise<{ tracks: unknown[]; nextCursor: string | null }>;
}
const native = Platform.OS === 'android' ? requireOptionalNativeModule<LocalMusicModule>('LocalMusic') : null;
const audioPermission = () => Number(Platform.Version) >= 33
  ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

export async function checkMusicPermission(): Promise<MusicPermission> {
  if (!native) return 'unavailable';
  return await PermissionsAndroid.check(audioPermission()) ? 'granted' : 'denied';
}
export async function requestMusicPermission(): Promise<MusicPermission> {
  if (!native) return 'unavailable';
  const result = await PermissionsAndroid.request(audioPermission());
  return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted'
    : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
}
export async function scanLocalMusic(): Promise<Track[]> {
  if (!native) throw new Error('Local music requires the Remixer Android build.');
  const tracks = new Map<string, Track>();
  let cursor: string | null = null;
  do {
    const page = await native.getLocalAudioTracks(cursor, 200);
    for (const row of page.tracks) {
      const track = normalizeLocalTrack(row);
      if (track) tracks.set(track.id, track);
    }
    if (page.nextCursor !== null && page.nextCursor === cursor) throw new Error('MediaStore scan could not advance.');
    cursor = page.nextCursor;
    // Yield between pages so search/navigation/touch events remain responsive.
    if (cursor !== null) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  } while (cursor !== null);
  return Array.from(tracks.values()).sort((a, b) => a.title.localeCompare(b.title));
}
