import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useControlGesture } from '@/hooks/useControlGesture';
import { DJColors, DJFonts } from '@/constants/theme';

export interface VerticalScrollerProps {
  value: number; // e.g. -1.0 to 1.0 (center 0) or 0.0 to 1.0
  min?: number;
  max?: number;
  onChange: (value: number, seq?: number, tGesture?: number) => void;
  label: string;
  displayValue?: string;
  accentColor?: string;
  height?: number;
  width?: number;
  railWidth?: number;
  dragOnly?: boolean;
  centerDetent?: boolean;
  bipolar?: boolean;
  showValue?: boolean;
  showTicks?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export const VerticalScroller: React.FC<VerticalScrollerProps> = ({
  value,
  min = -1.0,
  max = 1.0,
  onChange,
  label,
  displayValue,
  accentColor = DJColors.deckA,
  height = 80,
  width = 34,
  railWidth = width,
  dragOnly = false,
  centerDetent = true,
  bipolar = true,
  showValue = true,
  showTicks = true,
  disabled = false,
  accessibilityLabel,
}) => {
  const capHeight = 14;
  const { position, dragging, gesture } = useControlGesture(
    value, min, max, height, capHeight, false, onChange, disabled, bipolar && centerDetent, accessibilityLabel || label, dragOnly);
  const isAtCenter = bipolar && Math.abs(value) < 0.04;
  const capStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - (position.value - min) / (max - min)) * (height - capHeight) }],
    borderColor: dragging.value ? accentColor : DJColors.faderCapBorder,
  }));
  const trackStyle = useAnimatedStyle(() => ({ borderColor: dragging.value ? accentColor : '#1E232B' }));
  const notchStyle = useAnimatedStyle(() => ({ backgroundColor: dragging.value ? accentColor : '#FFFFFF' }));
  const fillStyle = useAnimatedStyle(() => {
    const ratio = (position.value - min) / (max - min);
    const center = bipolar ? (0 - min) / (max - min) : 0;
    const amount = Math.abs(ratio - center);
    return { opacity: dragging.value ? 0.75 : 0.5,
      transform: [{ translateY: (1 - Math.max(ratio, center)) * height - (1 - amount) * height / 2 }, { scaleY: amount }] };
  });

  const formattedValue =
    displayValue !== undefined
      ? displayValue
      : bipolar
      ? isAtCenter
        ? '0.0dB'
        : (value > 0 ? '+' : '') + (value * 12).toFixed(1) + 'dB'
      : Math.round(value * 100) + '%';

  return (
    <View
      style={[styles.container, { width, opacity: disabled ? 0.35 : 1 }]}
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityState={{ disabled }}
      accessibilityValue={{ min, max, now: value, text: formattedValue }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        if (disabled) return;
        const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        onChange(Math.max(min, Math.min(max, value + direction * (max - min) / 30)));
      }}
      accessibilityLabel={accessibilityLabel || (label + ': ' + formattedValue)}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>

      {showValue && (
        <View style={styles.valueBadge}>
          <Text
            style={[
              styles.valueText,
              { color: isAtCenter ? DJColors.textSecondary : accentColor },
            ]}
            numberOfLines={1}>
            {formattedValue}
          </Text>
        </View>
      )}

      <GestureDetector gesture={gesture}>
      <View style={{ width, height, alignItems: 'center' }}>
      <Animated.View
        style={[
          styles.trackArea,
          { height, width: railWidth },
          trackStyle,
        ]}>
        {showTicks && (
          <View style={styles.ticksContainer} pointerEvents="none">
            <Text style={styles.tickLabel}>+</Text>
            {bipolar && <Text style={styles.tickLabelCenter}>0</Text>}
            <Text style={styles.tickLabel}>−</Text>
          </View>
        )}

        {bipolar && <View style={[styles.centerZeroLine, { top: height / 2 - 0.5 }]} />}

        <Animated.View pointerEvents="none" style={[styles.meterFill,
          { top: 0, height, backgroundColor: accentColor }, fillStyle]} />
        <Animated.View pointerEvents="none" style={[styles.cap, { top: 0, height: capHeight }, capStyle]}>
          <Animated.View style={[styles.capCenterNotch, notchStyle]} />
        </Animated.View>
      </Animated.View>
      </View>
      </GestureDetector>
    </View>
  );
};

export default VerticalScroller;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontFamily: DJFonts.condensed,
    fontSize: 9,
    fontWeight: '800',
    color: DJColors.textSecondary,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  valueBadge: {
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: '#090B0E',
    borderWidth: 0.5,
    borderColor: DJColors.borderSubtle,
    minWidth: 26,
    alignItems: 'center',
    marginBottom: 1,
  },
  valueText: {
    fontFamily: DJFonts.mono,
    fontSize: 7.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  trackArea: {
    backgroundColor: '#07090C',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1E232B',
    position: 'relative',
    alignItems: 'center',
    overflow: 'hidden',
  },
  ticksContainer: {
    position: 'absolute',
    left: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 2,
    zIndex: 1,
  },
  tickLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 6,
    color: '#3F4855',
    fontWeight: '700',
  },
  tickLabelCenter: {
    fontFamily: DJFonts.mono,
    fontSize: 6,
    color: '#657285',
    fontWeight: '800',
  },
  centerZeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#353E4D',
    zIndex: 2,
  },
  meterFill: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 1,
    zIndex: 3,
  },
  cap: {
    position: 'absolute',
    left: 2,
    right: 2,
    backgroundColor: '#1E222A',
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 0,
  },
  capCenterNotch: {
    width: '60%',
    height: 1.5,
    borderRadius: 0.75,
  },
});
