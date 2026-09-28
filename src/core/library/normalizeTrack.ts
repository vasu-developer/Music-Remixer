import { Track } from '@/types';

// MediaStore data is untrusted metadata. Preserve the existing Track shape;
// zero BPM / '--' key / empty peaks mean analysis has not been performed.
export function normalizeLocalTrack(value: unknown): Track | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const text = (v: unknown) => typeof v === 'string' && v.trim() && v.trim() !== '<unknown>' ? v.trim() : undefined;
  const uri = text(row.uri);
  if (!uri || !/^content:\/\/media\/[^/]+\/audio\/media\/\d+$/.test(uri)) return null;
  const mimeType = text(row.mimeType);
  if (mimeType && !mimeType.toLowerCase().startsWith('audio/')) return null;
  const durationMs = Number(row.durationMs);
  const modified = Number(row.dateModified);
  const artwork = text(row.artworkUrl);
  return {
    id: `mediastore:${uri}`, uri,
    title: text(row.title) ?? text(row.displayName) ?? 'Untitled track',
    artist: text(row.artist) ?? 'Unknown artist',
    album: text(row.album),
    artworkUrl: artwork?.startsWith('content://media/') ? artwork : undefined,
    duration: Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : 0,
    mimeType,
    dateModified: Number.isFinite(modified) && modified > 0 ? modified : undefined,
    bpm: 0, musicalKey: '--', waveformData: [],
  };
}
