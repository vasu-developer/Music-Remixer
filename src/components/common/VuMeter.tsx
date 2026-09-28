import React, { memo, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DJColors, DJFonts } from '@/constants/theme';
import { StereoMeter } from '@/types';
import { useMixerStore } from '@/store/useMixerStore';

export interface VuMeterProps {
  source?: 'channelVuA' | 'channelVuB' | 'masterVu';
  levels?: StereoMeter;
  height?: number;
  segmentsCount?: number;
  showStereo?: boolean;
  showLabels?: boolean;
  showPeakClip?: boolean;
  channelWidth?: number;
}
const MeterSegment = memo(function MeterSegment({ level, threshold, lit, off, peak = false }:
  { level: SharedValue<number>; threshold: number; lit: string; off: string; peak?: boolean }) {
  const style = useAnimatedStyle(() => ({ backgroundColor: level.value > threshold ? lit : off }));
  return <Animated.View style={[peak ? styles.peakLed : styles.segment, style]} />;
});
export const VuMeter = memo(function VuMeter({ source, levels, height = 90, segmentsCount = 12,
  showStereo = true, showLabels = false, showPeakClip = false, channelWidth = 5 }: VuMeterProps) {
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  useEffect(() => {
    if (!source) {
      left.value = withTiming(levels?.left ?? 0, { duration: 50 });
      right.value = withTiming(levels?.right ?? 0, { duration: 50 });
      return;
    }
    const update = (state: ReturnType<typeof useMixerStore.getState>) => {
      left.value = withTiming(state[source].left, { duration: 50 });
      right.value = withTiming(state[source].right, { duration: 50 });
    };
    update(useMixerStore.getState());
    return useMixerStore.subscribe((state, previous) => {
      if (state[source] !== previous[source]) update(state);
    });
  }, [source, levels, left, right]);
  const channel = (level: SharedValue<number>, label: string) => (
    <View style={styles.columnWrapper}>
      {showPeakClip && <View style={{ width: channelWidth }}>
        <MeterSegment level={level} threshold={0.92} lit={DJColors.vuRed} off="#24080D" peak />
      </View>}
      <View style={[styles.channelColumn, { height, width: channelWidth }]}>
        {Array.from({ length: segmentsCount }, (_, i) => {
          const seg = segmentsCount - 1 - i;
          const red = seg >= segmentsCount - 2;
          const yellow = seg >= Math.floor(segmentsCount * 0.65);
          return <MeterSegment key={seg} level={level} threshold={seg / segmentsCount}
            lit={red ? DJColors.vuRed : yellow ? DJColors.vuYellow : DJColors.vuGreen}
            off={red ? '#240A0D' : yellow ? '#211C06' : '#091A10'} />;
        })}
      </View>
      {showLabels && <Text style={styles.channelLabel}>{label}</Text>}
    </View>
  );
  return <View style={styles.container}>{channel(left, 'L')}{showStereo && channel(right, 'R')}</View>;
});
export default VuMeter;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#07090C',
    padding: 3,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    borderRadius: 3,
  },
  columnWrapper: {
    alignItems: 'center',
    gap: 2,
  },
  peakLed: {
    height: 3,
    borderRadius: 1,
    borderWidth: 0.5,
    marginBottom: 1,
  },
  channelColumn: {
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  segment: {
    width: '100%',
    height: 4,
    borderRadius: 0.5,
  },
  channelLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 7,
    fontWeight: '700',
    color: DJColors.textMuted,
    textAlign: 'center',
    marginTop: 1,
  },
});
