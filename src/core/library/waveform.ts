import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { Track } from '@/types';

const native = Platform.OS === 'android' ? requireOptionalNativeModule<{
  getWaveform?: (uri: string, version: string, duration: number) => Promise<number[]>;
}>('LocalMusic') : null;
const pending = new Map<string, Promise<number[]>>();
const cache = new Map<string, number[]>();
export const waveformKey = (track: Track) => `${track.uri ?? track.id}:${track.dateModified ?? 0}:${track.duration}`;

export function getTrackWaveform(track: Track): Promise<number[]> {
  if (track.waveformData.length) return Promise.resolve(track.waveformData);
  if (!track.uri || !native?.getWaveform) return Promise.reject(new Error('Waveform analysis requires the updated Android build.'));
  const key = waveformKey(track);
  const saved = cache.get(key);
  if (saved) return Promise.resolve(saved);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = native.getWaveform(track.uri, String(track.dateModified ?? 0), track.duration).then(values => {
    if (!Array.isArray(values) || values.length !== 192 || values.some(v => !Number.isFinite(v) || v < 0 || v > 1)) {
      throw new Error('Invalid waveform data');
    }
    cache.set(key, values);
    if (cache.size > 32) cache.delete(cache.keys().next().value!);
    return values;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
