import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WaveformDisplay } from './WaveformDisplay';
import { DJColors, DJFonts } from '@/constants/theme';

export const DualWaveformView: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>PARALLEL BEAT-MATCH WAVEFORMS</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DJColors.deckA }]} />
            <Text style={styles.legendText}>DECK A</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DJColors.deckB }]} />
            <Text style={styles.legendText}>DECK B</Text>
          </View>
        </View>
      </View>

      <View style={styles.waveformsWrapper}>
        <WaveformDisplay
          deckId="A"
          height={48}
        />
        <WaveformDisplay
          deckId="B"
          height={48}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DJColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontFamily: DJFonts.condensed,
    fontSize: 9,
    fontWeight: '800',
    color: DJColors.textSecondary,
    letterSpacing: 0.8,
  },
  legend: {
    flexDirection: 'row',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: DJFonts.mono,
    fontSize: 8,
    color: DJColors.textMuted,
  },
  waveformsWrapper: {
    gap: 2,
  },
});
