import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { DeckId } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { useDeckStore } from '@/store/useDeckStore';
import { useControlGesture } from '@/hooks/useControlGesture';

import { getTrackWaveform, waveformKey } from '@/core/library/waveform';
const EMPTY_PEAKS: number[] = [];
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${Math.floor((seconds % 1) * 10)}`;
};
// Two static layers preserve the played/unplayed artwork. Only the clipping
// boundary and playhead change during playback; peaks never remap per tick.
const WaveformBars = memo(function WaveformBars({ peaks, height, color, played }:
  { peaks: number[]; height: number; color: string; played: boolean }) {
  return <View style={styles.barsContainer}>
    {peaks.map((peak, idx) => {
      const h = Math.max(1, Math.sqrt(peak) * (height - 14));
      const backgroundColor = played ? color : idx % 4 === 0 ? DJColors.borderHighlight : DJColors.borderStrong;
      return <View key={idx} style={styles.barColumn}>
        <View style={[styles.bar, { height: h / 2, backgroundColor, opacity: played ? 1 : 0.6 }]} />
        <View style={[styles.bar, { height: h * 0.3, backgroundColor, opacity: played ? 0.7 : 0.35 }]} />
      </View>;
    })}
  </View>;
});
function WaveformTime({ deckId, color }: { deckId: DeckId; color: string }) {
  const time = useDeckStore((s) => Math.floor((deckId === 'A' ? s.deckA : s.deckB).currentTime * 10) / 10);
  const duration = useDeckStore((s) => (deckId === 'A' ? s.deckA : s.deckB).duration);
  return <View style={styles.timeOverlay}>
    <Text style={[styles.timeText, { color }]}>{formatTime(time)}</Text>
    <Text style={styles.remainingText}>-{formatTime(Math.max(0, duration - time))}</Text>
  </View>;
}
export const WaveformDisplay = memo(function WaveformDisplay({ deckId, height = 54, compact = false }:
  { deckId: DeckId; height?: number; compact?: boolean }) {
  const key = deckId === 'A' ? 'deckA' : 'deckB';
  const track = useDeckStore((s) => s[key].loadedTrack);
  const duration = useDeckStore((s) => s[key].duration);
  const [width, setWidth] = useState(1);
  const accentColor = deckId === 'A' ? DJColors.deckA : DJColors.deckB;
  const darkAccentColor = deckId === 'A' ? DJColors.deckADark : DJColors.deckBDark;
  const seek = useCallback((ratio: number) => { void useDeckStore.getState().seek(deckId, ratio * duration); }, [deckId, duration]);
  const { position, dragging, gesture } = useControlGesture(0, 0, 1, width, 0, true, seek, duration <= 0);
  useEffect(() => {
    const update = (state: ReturnType<typeof useDeckStore.getState>) => {
      if (dragging.value) return;
      const d = state[key];
      const ratio = d.duration > 0 ? Math.max(0, Math.min(1, d.currentTime / d.duration)) : 0;
      position.value = withTiming(ratio, { duration: d.isPlaying ? 50 : 0, easing: Easing.linear });
    };
    update(useDeckStore.getState());
    return useDeckStore.subscribe((s, prev) => {
      if (s[key].currentTime !== prev[key].currentTime || s[key].loadedTrack !== prev[key].loadedTrack || s[key].isPlaying !== prev[key].isPlaying) update(s);
    });
  }, [key, position, dragging]);
  const playheadStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * Math.max(0, width - 2) }] }));
  const clipStyle = useAnimatedStyle(() => ({ width: position.value * width }));
  const [analysis, setAnalysis] = useState<{ key: string; peaks: number[]; error?: boolean } | null>(null);
  const trackKey = track ? waveformKey(track) : '';
  useEffect(() => {
    if (!track || track.waveformData.length) return;
    let active = true;
    getTrackWaveform(track).then(peaks => {
      if (active) setAnalysis({ key: waveformKey(track), peaks });
    }).catch(error => {
      if (active) {
        console.warn('[WAVEFORM]', error instanceof Error ? error.message : error);
        setAnalysis({ key: waveformKey(track), peaks: EMPTY_PEAKS, error: true });
      }
    });
    return () => { active = false; };
  }, [track]);
  const rawPeaks = track?.waveformData.length ? track.waveformData
    : analysis?.key === trackKey ? analysis.peaks : EMPTY_PEAKS;
  const peaks = useMemo(() => {
    const count = Math.min(rawPeaks.length, Math.max(1, Math.min(128, Math.floor(width / 3))));
    return Array.from({ length: count }, (_, i) => {
      let peak = 0;
      for (let j = Math.floor(i * rawPeaks.length / count); j < Math.floor((i + 1) * rawPeaks.length / count); j++) peak = Math.max(peak, rawPeaks[j]);
      return peak;
    });
  }, [rawPeaks, width]);
  const status = !track ? 'Load a track' : analysis?.key === trackKey && analysis.error ? 'Waveform unavailable' : 'Analyzing audio…';
  return <GestureDetector gesture={gesture}>
    <View style={[styles.container, { height, borderColor: deckId === 'A' ? 'rgba(0,229,255,0.2)' : 'rgba(255,145,0,0.2)' }]}
      onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width - 2))}
      accessible accessibilityRole="adjustable" accessibilityLabel={`Deck ${deckId} waveform`}>
      <View style={[styles.deckBadge, { backgroundColor: darkAccentColor, borderColor: accentColor }]}>
        <Text style={[styles.deckBadgeText, { color: accentColor }]}>DECK {deckId}</Text>
      </View>
      <WaveformBars peaks={peaks} height={height} color={accentColor} played={false} />
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' }, clipStyle]}>
        <View style={{ width, flex: 1 }}><WaveformBars peaks={peaks} height={height} color={accentColor} played /></View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.playhead, { left: 0 }, playheadStyle]}>
        <View style={[styles.playheadCap, { backgroundColor: accentColor }]} />
      </Animated.View>
      {peaks.length === 0 && <View pointerEvents="none" style={styles.status}><Text style={styles.statusText}>{status}</Text></View>}
      {!compact && <WaveformTime deckId={deckId} color={accentColor} />}
    </View>
  </GestureDetector>;
});

const styles = StyleSheet.create({
  status: { position: 'absolute', alignSelf: 'center' },
  statusText: { color: DJColors.textMuted, fontSize: 10 },
  container: {
    backgroundColor: DJColors.surfaceInset,
    borderWidth: 1,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    marginVertical: 4,
  },
  deckBadge: {
    position: 'absolute',
    top: 4,
    left: 6,
    zIndex: 15,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 1,
  },
  deckBadgeText: {
    fontFamily: DJFonts.condensed,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFFFFF',
    zIndex: 20,
    shadowColor: '#FFF',
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  playheadCap: {
    position: 'absolute',
    top: 0,
    left: -3,
    width: 8,
    height: 6,
    borderRadius: 1,
  },
  timeOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 6,
    flexDirection: 'row',
    gap: 8,
    zIndex: 15,
    backgroundColor: 'rgba(9,10,13,0.75)',
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  timeText: {
    fontFamily: DJFonts.mono,
    fontSize: 9,
    fontWeight: '700',
  },
  remainingText: {
    fontFamily: DJFonts.mono,
    fontSize: 9,
    color: DJColors.textMuted,
  },
});
