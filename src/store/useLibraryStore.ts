import { create } from 'zustand';
import { Track } from '@/types';
import { checkMusicPermission, requestMusicPermission, scanLocalMusic, MusicPermission } from '@/core/library/localMusic';

interface LibraryStore {
  tracks: Track[];
  isLoading: boolean;
  permission: MusicPermission;
  error: string | null;
  searchQuery: string;
  loadTracks: () => Promise<void>;
  refreshTracks: () => Promise<void>;
  requestAccess: () => Promise<void>;
  setSearchQuery: (query: string) => void;
}

// All scan/permission requests share one flight, including focus + pull-to-refresh.
// This store is consumed by the library only; decks keep their selected Track.
let inFlight: Promise<void> | null = null;
export const useLibraryStore = create<LibraryStore>((set, get) => {
  const load = (request: boolean): Promise<void> => {
    if (inFlight) return inFlight;
    set({ isLoading: true, error: null });
    inFlight = (async () => {
      try {
        const checked = request ? await requestMusicPermission() : await checkMusicPermission();
        const permission = checked === 'denied' && get().permission === 'blocked' ? 'blocked' : checked;
        set({ permission });
        if (permission !== 'granted') {
          set({ tracks: [] });
          return;
        }
        const tracks = await scanLocalMusic();
        set({ tracks });
      } catch {
        // Permission can be revoked during a query (including app auto-reset).
        const permission = await checkMusicPermission().catch(() => get().permission);
        set({
          permission,
          ...(permission !== 'granted' ? { tracks: [] } : {}),
          error: permission === 'granted'
            ? 'Could not read your music library. Please try again.'
            : 'Music access is unavailable. Allow access to scan this device.',
        });
      } finally {
        set({ isLoading: false });
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
  return {
    tracks: [], isLoading: false, permission: 'unknown', error: null, searchQuery: '',
    loadTracks: () => load(false), refreshTracks: () => load(false),
    requestAccess: () => load(true), setSearchQuery: (searchQuery) => set({ searchQuery }),
  };
});
