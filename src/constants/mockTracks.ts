import { Track } from '@/types';

function generateWaveform(seed: number, length = 100): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < length; i++) {
    const progress = i / length;
    let base = 0.3;
    if (progress < 0.15) {
      base = 0.2 + progress * 2.0;
    } else if (progress >= 0.15 && progress < 0.45) {
      base = 0.75 + Math.sin(i * 0.8 + seed) * 0.2;
    } else if (progress >= 0.45 && progress < 0.6) {
      base = 0.3 + Math.sin(i * 0.4 + seed) * 0.15;
    } else if (progress >= 0.6 && progress < 0.7) {
      base = 0.45 + (progress - 0.6) * 4.5;
    } else if (progress >= 0.7 && progress < 0.9) {
      base = 0.85 + Math.sin(i * 0.9 + seed) * 0.15;
    } else {
      base = 0.7 - (progress - 0.9) * 4.5;
    }

    const beatPulse = (i % 4 === 0) ? 0.2 : 0;
    const peak = Math.max(0.08, Math.min(1.0, base + beatPulse + ((i * seed) % 7) * 0.02));
    peaks.push(Number(peak.toFixed(2)));
  }
  return peaks;
}

export const MOCK_TRACKS: Track[] = [
  {
    id: 'track-1',
    title: 'Neon Odyssey',
    artist: 'Cyberpulse',
    album: 'Hyperdrive EP',
    duration: 224,
    bpm: 126.0,
    musicalKey: '8A / Am',
    genre: 'Deep Tech',
    year: 2026,
    waveformData: generateWaveform(1.4),
  },
  {
    id: 'track-2',
    title: 'Solar Eclipse',
    artist: 'Astra Void',
    album: 'Dark Matter Sessions',
    duration: 256,
    bpm: 128.0,
    musicalKey: '9A / Em',
    genre: 'Peak Time Techno',
    year: 2026,
    waveformData: generateWaveform(2.8),
  },
  {
    id: 'track-3',
    title: 'Midnight Resonance',
    artist: 'Kroma Sound',
    album: 'Subterranean',
    duration: 210,
    bpm: 128.0,
    musicalKey: '8A / Am',
    genre: 'Melodic House',
    year: 2025,
    waveformData: generateWaveform(3.3),
  },
  {
    id: 'track-4',
    title: 'Sub Zero Bassline',
    artist: 'Vektor Nine',
    album: 'Low End Theory',
    duration: 198,
    bpm: 130.0,
    musicalKey: '4A / Fm',
    genre: 'Bass House',
    year: 2026,
    waveformData: generateWaveform(4.1),
  },
  {
    id: 'track-5',
    title: 'Kinetic Motion',
    artist: 'Sinthetic & Pulse',
    album: 'Neuro Matrix',
    duration: 272,
    bpm: 174.0,
    musicalKey: '11B / A',
    genre: 'Drum & Bass',
    year: 2026,
    waveformData: generateWaveform(5.5),
  },
];
