import React, { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, StyleSheet, Text } from 'react-native';
import { DeckId } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { useDeckStore } from '@/store/useDeckStore';
import { TrackInfo } from './TrackInfo';
import { BpmKeyDisplay } from './BpmKeyDisplay';
import { JogWheel } from './JogWheel';
import { TransportControls } from './TransportControls';
import { useLibraryStore } from '@/store/useLibraryStore';
import { MOCK_TRACKS } from '@/constants/mockTracks';

export interface DeckContainerProps {
  deckId: DeckId;
}

export const DeckContainer: React.FC<DeckContainerProps> = ({ deckId }) => {
  const [platterSize, setPlatterSize] = useState(135);
  const isDeckA = deckId === 'A';
  const deck = useDeckStore(useShallow((s) => {
    const d = isDeckA ? s.deckA : s.deckB;
    return { loadedTrack: d.loadedTrack, duration: d.duration, bpm: d.bpm, tempo: d.tempo,
      key: d.key, isSyncActive: d.isSyncActive, isMaster: d.isMaster,
      isPlaying: d.isPlaying, isCuePressed: d.isCuePressed, isLooping: d.isLooping,
      loopLengthBars: d.loopLengthBars };
  }));
  const handleScratch = useCallback((velocity: number) => {
    void useDeckStore.getState().scratch(deckId, velocity);
  }, [deckId]);
  const togglePlay = useDeckStore((s) => s.togglePlay);
  const pressCue = useDeckStore((s) => s.pressCue);
  const releaseCue = useDeckStore((s) => s.releaseCue);
  const toggleSync = useDeckStore((s) => s.toggleSync);
  const setTempo = useDeckStore((s) => s.setTempo);
  const setPitchBend = useDeckStore((s) => s.setPitchBend);
  const toggleLoop = useDeckStore((s) => s.toggleLoop);
  const loadTrack = useDeckStore((s) => s.loadTrack);

  const accentColor = isDeckA ? DJColors.deckA : DJColors.deckB;
  const darkAccentColor = isDeckA ? DJColors.deckADark : DJColors.deckBDark;

  const handlePrevTrack = () => {
    if (!deck.loadedTrack) return;
    const tracks = deck.loadedTrack.uri ? useLibraryStore.getState().tracks : MOCK_TRACKS;
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === deck.loadedTrack?.id);
    if (currentIndex < 0) return;
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    loadTrack(deckId, tracks[prevIndex]);
  };

  const handleNextTrack = () => {
    if (!deck.loadedTrack) return;
    const tracks = deck.loadedTrack.uri ? useLibraryStore.getState().tracks : MOCK_TRACKS;
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === deck.loadedTrack?.id);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + 1) % tracks.length;
    loadTrack(deckId, tracks[nextIndex]);
  };

  return (
    <View style={[styles.deckCard, { borderColor: DJColors.borderSubtle }]}>
      <View style={styles.deckHeader}>
        <View style={[styles.badge, { backgroundColor: darkAccentColor, borderColor: accentColor }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>DECK {deckId}</Text>
        </View>
        <Text style={styles.syncStatusText} numberOfLines={1}>
          {deck.isSyncActive ? '● SYNC LOCKED' : deck.isMaster ? '★ MASTER CLOCK' : 'MANUAL'}
        </Text>
      </View>

      <TrackInfo
        deckId={deckId}
        track={deck.loadedTrack}
        duration={deck.duration}
      />

      <BpmKeyDisplay
        deckId={deckId}
        bpm={deck.bpm}
        tempo={deck.tempo}
        musicalKey={deck.key}
        isSyncActive={deck.isSyncActive}
        isMaster={deck.isMaster}
        onToggleSync={() => toggleSync(deckId)}
        onTempoChange={(t) => setTempo(deckId, t)}
        onPitchBend={(bend) => setPitchBend(deckId, bend)}
      />

      <View style={styles.platterSection} onLayout={(e) => setPlatterSize(Math.min(135, Math.floor(e.nativeEvent.layout.width)))}>
        <JogWheel
          deckId={deckId}
          isPlaying={deck.isPlaying}
          tempo={deck.tempo}
          onScratch={handleScratch}
          size={platterSize}
        />
      </View>

      <TransportControls
        deckId={deckId}
        isPlaying={deck.isPlaying}
        isCuePressed={deck.isCuePressed}
        isLooping={deck.isLooping}
        loopBars={deck.loopLengthBars}
        onTogglePlay={(trace) => togglePlay(deckId, trace)}
        onPressCue={() => pressCue(deckId)}
        onReleaseCue={() => releaseCue(deckId)}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        onToggleLoop={() => toggleLoop(deckId)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  deckCard: {
    backgroundColor: DJColors.surface,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 8,
  },
  deckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: DJFonts.condensed,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
  syncStatusText: {
    fontFamily: DJFonts.mono,
    flexShrink: 1,
    fontSize: 8.5,
    fontWeight: '700',
    color: DJColors.textMuted,
  },
  platterSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});

export default DeckContainer;
