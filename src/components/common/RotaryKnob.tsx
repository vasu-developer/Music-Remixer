import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { DJColors, DJFonts } from '@/constants/theme';

export interface RotaryKnobProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  displayValue?: string;
  accentColor?: string;
  size?: number;
  centerDetent?: boolean;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  value,
  min = -1.0,
  max = 1.0,
  step = 0.02,
  onChange,
  label,
  displayValue,
  accentColor = DJColors.deckA,
  size = 52,
  centerDetent = true,
}) => {
  const position = useSharedValue(value);
  const start = useSharedValue(value);
  const dragging = useSharedValue(false);
  const lastCommit = useSharedValue(0);
  useEffect(() => { if (!dragging.value) position.value = value; }, [value, position, dragging]);
  const gesture = Gesture.Pan().minDistance(0)
    .onStart(() => { dragging.value = true; start.value = position.value; lastCommit.value = 0; })
    .onUpdate((e) => {
      let next = start.value - e.translationY / 150 * (max - min);
      if (centerDetent && min < 0 && max > 0 && Math.abs(next) < 0.05) next = 0;
      if (step > 0) next = Math.round(next / step) * step;
      position.value = Math.max(min, Math.min(max, next));
      if (Date.now() - lastCommit.value >= 50) {
        scheduleOnRN(onChange, position.value);
        lastCommit.value = Date.now();
      }
    })
    .onFinalize(() => {
      if (dragging.value) scheduleOnRN(onChange, position.value);
      dragging.value = false;
    });
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-135 + (position.value - min) / (max - min) * 270}deg` }] }));

  const formattedValue =
    displayValue !== undefined
      ? displayValue
      : min < 0
      ? `${value > 0 ? '+' : ''}${(value * 12).toFixed(1)} dB`
      : `${Math.round(value * 100)}%`;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label}: ${formattedValue}`}>
      <Text style={styles.label}>{label}</Text>

      <GestureDetector gesture={gesture}>
      <View
        style={[
          styles.knobOuter,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}>
        <Animated.View
          style={[
            styles.knobFace,
            {
              width: size - 8,
              height: size - 8,
              borderRadius: (size - 8) / 2,

            },
            faceStyle,
          ]}>
          <View
            style={[
              styles.pointerNotch,
              {
                backgroundColor: accentColor,
              },
            ]}
          />
        </Animated.View>

        <View style={styles.centerDot} />
      </View>
      </GestureDetector>

      <Text style={styles.valueText}>{formattedValue}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 56,
  },
  label: {
    fontFamily: DJFonts.condensed,
    fontSize: 10,
    fontWeight: '700',
    color: DJColors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  knobOuter: {
    backgroundColor: DJColors.knobBase,
    borderColor: DJColors.borderStrong,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  knobFace: {
    backgroundColor: DJColors.knobCap,
    borderColor: DJColors.borderSubtle,
    borderWidth: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 3,
  },
  pointerNotch: {
    width: 3,
    height: 10,
    borderRadius: 1.5,
  },
  centerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DJColors.chassis,
  },
  valueText: {
    fontFamily: DJFonts.mono,
    fontSize: 9,
    color: DJColors.textMuted,
    marginTop: 3,
  },
});

export default RotaryKnob;
