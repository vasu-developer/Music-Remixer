import { ControlTrace } from '@/core/audio/controlTrace';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeckId } from '@/types';
import { DJColors } from '@/constants/theme';
import { TactileButton } from '@/components/common/TactileButton';

export interface TransportControlsProps {
  deckId: DeckId;
  isPlaying: boolean;
  isCuePressed: boolean;
  isLooping: boolean;
  loopBars: number;
  onTogglePlay: (trace?: ControlTrace) => void;
  onPressCue: () => void;
  onReleaseCue: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onToggleLoop: () => void;
}

export const TransportControls: React.FC<TransportControlsProps> = ({
  deckId,
  isPlaying,
  isCuePressed,
  isLooping,
  loopBars,
  onTogglePlay,
  onPressCue,
  onReleaseCue,
  onPrevTrack,
  onNextTrack,
  onToggleLoop,
}) => {
  const isDeckA = deckId === 'A';

  return (
    <View style={styles.container}>
      <View style={styles.auxRow}>
        <TactileButton
          size="small"
          onPress={onPrevTrack}
          style={styles.auxBtn}
          accessibilityLabel="Previous track">
          <Ionicons name="play-skip-back" size={14} color={DJColors.textSecondary} />
        </TactileButton>

        <TactileButton
          size="small"
          label={`LOOP ${loopBars}`}
          variant={isLooping ? (isDeckA ? 'deckA' : 'deckB') : 'default'}
          isActive={isLooping}
          onPress={onToggleLoop}
          style={styles.loopBtn}
          accessibilityLabel={`Toggle loop ${loopBars} bars`}
        />

        <TactileButton
          size="small"
          onPress={onNextTrack}
          style={styles.auxBtn}
          accessibilityLabel="Next track">
          <Ionicons name="play-skip-forward" size={14} color={DJColors.textSecondary} />
        </TactileButton>
      </View>

      <View style={styles.mainTransportRow}>
        <TactileButton
          label="CUE"
          variant="cue"
          size="large"
          isActive={isCuePressed}
          onPressIn={onPressCue}
          onPressOut={onReleaseCue}
          style={styles.cueButton}
          labelStyle={styles.cueLabel}
          accessibilityLabel={`Deck ${deckId} Cue`}
        />

        <TactileButton
          variant="play"
          size="large"
          isActive={isPlaying}
          onPress={onTogglePlay}
          style={styles.playButton}
          accessibilityLabel={isPlaying ? `Pause Deck ${deckId}` : `Play Deck ${deckId}`}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={22}
            color={isPlaying ? DJColors.sync : DJColors.textPrimary}
          />
        </TactileButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  auxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  auxBtn: {
    flex: 1,
    minHeight: 32,
    paddingHorizontal: 0,
  },
  loopBtn: {
    flex: 2,
    minHeight: 32,
  },
  mainTransportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cueButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 4,
  },
  cueLabel: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  playButton: {
    flex: 1.2,
    minHeight: 46,
    borderRadius: 4,
  },
});
