import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useControlGesture } from '@/hooks/useControlGesture';
import { DJColors, DJFonts } from '@/constants/theme';

export interface FaderSliderProps {
  value: number;
  min?: number;
  max?: number;
  orientation?: 'vertical' | 'horizontal';
  length?: number;
  trackThickness?: number;
  onChange: (value: number, seq?: number, tGesture?: number) => void;
  accentColor?: string;
  label?: string;
  traceLabel?: string;
  showNotches?: boolean;
}

export const FaderSlider: React.FC<FaderSliderProps> = ({
  value,
  min = 0.0,
  max = 1.0,
  orientation = 'vertical',
  length = 130,
  trackThickness = 8,
  onChange,
  accentColor = DJColors.deckA,
  label,
  traceLabel,
  showNotches = true,
}) => {
  const isHorizontal = orientation === 'horizontal';
  const capWidth = isHorizontal ? 26 : 38;
  const capHeight = isHorizontal ? 38 : 22;
  const { position, gesture } = useControlGesture(value, min, max, length,
    isHorizontal ? capWidth : capHeight, isHorizontal, onChange, false, false, traceLabel || label || 'fader');
  const capStyle = useAnimatedStyle(() => {
    const normalized = (position.value - min) / (max - min);
    return { transform: isHorizontal
      ? [{ translateX: normalized * (length - capWidth) }]
      : [{ translateY: (1 - normalized) * (length - capHeight) }] };
  });
  const fillStyle = useAnimatedStyle(() => {
    const ratio = (position.value - min) / (max - min);
    return { transform: isHorizontal
      ? [{ translateX: -(1 - ratio) * length / 2 }, { scaleX: ratio }]
      : [{ translateY: (1 - ratio) * length / 2 }, { scaleY: ratio }] };
  });

  return (
    <View style={[styles.wrapper, isHorizontal ? styles.row : styles.column]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <GestureDetector gesture={gesture}>
      <View
        style={[
          styles.touchArea,
          isHorizontal
            ? { width: length, height: 48, justifyContent: 'center' }
            : { height: length, width: 48, alignItems: 'center' },
        ]}
        accessible={true}
        accessibilityRole="adjustable"
        accessibilityLabel={`${label || 'Fader'}: ${Math.round(value * 100)}%`}>
        {showNotches && (
          <View
            style={[
              styles.notchesContainer,
              isHorizontal ? styles.horizontalNotches : styles.verticalNotches,
              isHorizontal ? { width: length } : { height: length },
            ]}>
            {[0, 0.25, 0.5, 0.75, 1.0].map((step) => (
              <View
                key={step}
                style={[
                  styles.notch,
                  isHorizontal ? styles.notchVertical : styles.notchHorizontal,
                  step === 0.5 && styles.centerNotch,
                ]}
              />
            ))}
          </View>
        )}

        <View
          style={[
            styles.track,
            isHorizontal
              ? { width: length, height: trackThickness }
              : { height: length, width: trackThickness },
          ]}>
          <Animated.View style={[styles.activeFill,
            { width: '100%', height: '100%', backgroundColor: accentColor }, fillStyle]} />
        </View>

        <Animated.View
          style={[
            styles.cap,
            {
              width: capWidth,
              height: capHeight,
              left: isHorizontal ? 0 : (48 - capWidth) / 2,
              top: isHorizontal ? (48 - capHeight) / 2 : 0,

            },
            capStyle,
          ]}>
          <View
            style={[
              styles.capLine,
              isHorizontal ? styles.capLineVertical : styles.capLineHorizontal,
            ]}
          />
        </Animated.View>
      </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'column',
  },
  column: {
    flexDirection: 'column',
  },
  label: {
    fontFamily: DJFonts.condensed,
    fontSize: 10,
    fontWeight: '700',
    color: DJColors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  touchArea: {
    position: 'relative',
  },
  track: {
    backgroundColor: DJColors.faderTrack,
    borderColor: DJColors.borderStrong,
    borderWidth: 1,
    borderRadius: 2,
    overflow: 'hidden',
  },
  activeFill: {
    opacity: 0.65,
  },
  notchesContainer: {
    position: 'absolute',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  verticalNotches: {
    width: 28,
    flexDirection: 'column',
  },
  horizontalNotches: {
    height: 28,
    flexDirection: 'row',
  },
  notch: {
    backgroundColor: DJColors.borderHighlight,
  },
  notchHorizontal: {
    width: 6,
    height: 1,
    alignSelf: 'flex-start',
  },
  notchVertical: {
    height: 6,
    width: 1,
    alignSelf: 'flex-start',
  },
  centerNotch: {
    backgroundColor: DJColors.textSecondary,
    width: 10,
  },
  cap: {
    position: 'absolute',
    backgroundColor: DJColors.faderCap,
    borderColor: DJColors.faderCapBorder,
    borderWidth: 1.5,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    zIndex: 10,
  },
  capLine: {
    backgroundColor: DJColors.textPrimary,
  },
  capLineHorizontal: {
    width: '70%',
    height: 2,
  },
  capLineVertical: {
    height: '70%',
    width: 2,
  },
});

export default FaderSlider;
