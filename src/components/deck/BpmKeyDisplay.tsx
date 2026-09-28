import React, { useEffect } from 'react';
import { getAudioEngine } from '@/core/audio';
import { useDeckStore } from '@/store/useDeckStore';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { DeckId } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { TactileButton } from '@/components/common/TactileButton';

export interface BpmKeyDisplayProps {
  deckId: DeckId;
  bpm: number;
  tempo: number;
  musicalKey: string;
  isSyncActive: boolean;
  isMaster: boolean;
  onToggleSync: () => void;
  onTempoChange: (tempo: number) => void;
  onPitchBend: (amount: number) => void;
}

export const BpmKeyDisplay: React.FC<BpmKeyDisplayProps> = ({
  deckId,
  bpm,
  tempo,
  musicalKey,
  isSyncActive,
  isMaster,
  onToggleSync,
  onTempoChange,
  onPitchBend,
}) => {
  useEffect(() => () => {
    const store = useDeckStore.getState();
    if ((deckId === 'A' ? store.deckA : store.deckB).pitchBend !== 0) void store.setPitchBend(deckId, 0);
    getAudioEngine().flushControls?.();
  }, [deckId]);
  const changeBend = (value: number) => {
    onPitchBend(value);
    getAudioEngine().flushControls?.();
  };
  const changeTempo = (value: number) => {
    onTempoChange(value);
    getAudioEngine().flushControls?.();
  };
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const isDeckA = deckId === 'A';
  const accentColor = isDeckA ? DJColors.deckA : DJColors.deckB;
  const pitchPercent = ((tempo - 1.0) * 100).toFixed(1);

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={styles.metadataGroup}>
      <View style={styles.bpmBox}>
        <View style={styles.headerLabelRow}>
          <Text style={styles.microLabel}>BPM</Text>
          <Text style={[styles.pitchPercent, { color: Number(pitchPercent) === 0 ? DJColors.textMuted : accentColor }]}>
            {Number(pitchPercent) > 0 ? `+${pitchPercent}%` : `${pitchPercent}%`}
          </Text>
        </View>
        <Text style={[styles.bpmValue, { color: accentColor }]}>
          {bpm > 0 ? bpm.toFixed(2) : '--.--'}
        </Text>
      </View>

      <View style={styles.keyBox}>
        <Text style={styles.microLabel}>KEY</Text>
        <Text style={styles.keyValue}>{musicalKey || '--'}</Text>
        {isMaster && (
          <View style={styles.masterTag}>
            <Text style={styles.masterTagText}>MASTER</Text>
          </View>
        )}
      </View>

      </View>
      <View style={styles.controlsGroup}>
      <View style={styles.pitchNudgeGroup}>
        <Pressable
          onPressIn={() => changeBend(-0.5)}
          onPressOut={() => changeBend(0)}
          style={({ pressed }) => [
            styles.nudgeButton,
            pressed && styles.nudgeButtonPressed,
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Nudge pitch down">
          <Text style={styles.nudgeText}>−</Text>
        </Pressable>

        <Pressable
          onPress={() => changeTempo(1.0)}
          style={styles.nudgeCenter}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Reset pitch to zero">
          <Text style={styles.nudgeCenterText}>0%</Text>
        </Pressable>

        <Pressable
          onPressIn={() => changeBend(0.5)}
          onPressOut={() => changeBend(0)}
          style={({ pressed }) => [
            styles.nudgeButton,
            pressed && styles.nudgeButtonPressed,
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Nudge pitch up">
          <Text style={styles.nudgeText}>+</Text>
        </Pressable>
      </View>

      <TactileButton
        label="SYNC"
        variant="sync"
        size="small"
        isActive={isSyncActive}
        onPress={onToggleSync}
        style={styles.syncBtn}
      />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: DJColors.surfaceInset,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    gap: 6,
  },
  compactContainer: { flexDirection: 'column', alignItems: 'stretch' },
  metadataGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  controlsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexGrow: 0, flexShrink: 0 },
  bpmBox: {
    flexGrow: 0,
    flexShrink: 1,
  },
  headerLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  microLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 7.5,
    fontWeight: '700',
    color: DJColors.textMuted,
    letterSpacing: 0.5,
  },
  pitchPercent: {
    fontFamily: DJFonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
  },
  bpmValue: {
    fontFamily: DJFonts.mono,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  keyBox: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: DJColors.borderSubtle,
    paddingHorizontal: 4,
  },
  keyValue: {
    fontFamily: DJFonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: DJColors.textPrimary,
  },
  masterTag: {
    backgroundColor: DJColors.surfaceRaised,
    paddingHorizontal: 3,
    borderRadius: 1,
    marginTop: 1,
  },
  masterTagText: {
    fontFamily: DJFonts.mono,
    fontSize: 6.5,
    color: DJColors.sync,
    fontWeight: '700',
  },
  pitchNudgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DJColors.surfaceRaised,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    overflow: 'hidden',
  },
  nudgeButton: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DJColors.surfaceRaised,
  },
  nudgeButtonPressed: {
    backgroundColor: DJColors.borderHighlight,
  },
  nudgeText: {
    fontFamily: DJFonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: DJColors.textSecondary,
  },
  nudgeCenter: {
    paddingHorizontal: 4,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  nudgeCenterText: {
    fontFamily: DJFonts.mono,
    fontSize: 7.5,
    color: DJColors.textMuted,
  },
  syncBtn: {
    minHeight: 32,
    paddingHorizontal: 8,
  },
});
