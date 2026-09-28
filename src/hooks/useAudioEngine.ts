import { useEffect } from 'react';
import { getAudioEngine } from '@/core/audio';
import { useDeckStore } from '@/store/useDeckStore';
import { useMixerStore } from '@/store/useMixerStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';

export function useAudioEngine() {
  const updatePosition = useDeckStore((s) => s.updatePosition);
  const updatePlaybackState = useDeckStore((s) => s.updatePlaybackState);
  const loadInitialTracks = useDeckStore((s) => s.loadInitialTracks);
  const updateMeters = useMixerStore((s) => s.updateMeters);
  const setEngineStatus = usePlaybackStore((s) => s.setEngineStatus);
  const setCpuLoad = usePlaybackStore((s) => s.setCpuLoad);

  useEffect(() => {
    const engine = getAudioEngine();
    let isSubscribed = true;

    async function init() {
      try {
        await engine.initialize();
        if (!isSubscribed) return;
        setEngineStatus('ready');
        await loadInitialTracks();
      } catch (err) {
        if (!isSubscribed) return;
        console.error('Failed to initialize AudioEngine:', err);
        setEngineStatus('error');
      }
    }

    init();

    const unsubscribePosition = engine.addPositionListener((deckId, pos) => {
      if (isSubscribed) {
        updatePosition(deckId, pos);
      }
    });

    const unsubscribeMeters = engine.addMetersListener((meters) => {
      if (isSubscribed) {
        updateMeters(meters);
      }
    });
    const unsubscribePlayback = engine.addPlaybackStateListener?.((deckId, playing) => {
      if (isSubscribed) updatePlaybackState(deckId, playing);
    });

    const statsInterval = setInterval(() => {
      if (!isSubscribed) return;
      const stats = engine.getEngineStats();
      setCpuLoad(stats.cpuLoadPercent);
    }, 2000);

    return () => {
      engine.flushControls?.();
      isSubscribed = false;
      unsubscribePosition();
      unsubscribeMeters();
      unsubscribePlayback?.();
      clearInterval(statsInterval);
    };
  }, [updatePosition, updatePlaybackState, loadInitialTracks, updateMeters, setEngineStatus, setCpuLoad]);
}
