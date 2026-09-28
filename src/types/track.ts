export interface Track {
  id: string;
  uri?: string; // Android MediaStore content URI; absent on demo tracks
  mimeType?: string;
  dateModified?: number; // MediaStore Unix timestamp in seconds
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  duration: number; // in seconds
  bpm: number;
  musicalKey: string; // Camelot or standard (e.g. '8A / Am')
  waveformData: number[]; // Normalized amplitude peaks (0.0 - 1.0)
  genre?: string;
  year?: number;
}
