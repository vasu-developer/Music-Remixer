import React, { memo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { getAudioEngine } from '@/core/audio';
import { DeckId } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';

export interface JogWheelProps {
  deckId: DeckId;
  isPlaying: boolean;
  tempo: number;
  onScratch: (deltaVelocity: number) => void;
  size?: number;
}

export const JogWheel = memo(function JogWheel({
  deckId,
  isPlaying,
  tempo,
  onScratch,
  size = 140,
}: JogWheelProps) {
  const isDeckA = deckId === 'A';
  const accentColor = isDeckA ? DJColors.deckA : DJColors.deckB;
  const darkAccentColor = isDeckA ? DJColors.deckADark : DJColors.deckBDark;

  const rotation = useSharedValue(0);
  const lastAngle = useSharedValue(0);
  const scratching = useSharedValue(false);
  const pending = useSharedValue(0);
  const lastCommit = useSharedValue(0);
  const delivered = useRef(0);
  const callback = useRef(onScratch);
  callback.current = onScratch;
  const mounted = useRef(true);
  const commitScratch = useCallback((total: number, final: boolean) => {
    if (!mounted.current) return;
    const delta = total - delivered.current;
    delivered.current = total;
    if (delta !== 0) callback.current(delta);
    if (final) getAudioEngine().flushControls?.();
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      commitScratch(pending.value, true);
      mounted.current = false;
    };
  }, [pending, commitScratch]);
  const resume = () => {
    'worklet';
    if (isPlaying && !scratching.value) {
      rotation.value = rotation.value % 360;
      rotation.value = withRepeat(withTiming(rotation.value + 360,
        { duration: Math.max(500, 1800 / Math.max(0.5, tempo)), easing: Easing.linear }), -1, false);
    }
  };
  useEffect(() => {
    cancelAnimation(rotation);
    resume();
    return () => cancelAnimation(rotation);
  }, [isPlaying, tempo]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value % 360}deg` }],
    };
  });

  const gesture = Gesture.Pan().minDistance(0)
    .onStart((e) => {
      scratching.value = true;
      cancelAnimation(rotation);
      lastCommit.value = Date.now();
      lastAngle.value = Math.atan2(e.y - size / 2, e.x - size / 2) * 180 / Math.PI;
    })
    .onUpdate((e) => {
      const angle = Math.atan2(e.y - size / 2, e.x - size / 2) * 180 / Math.PI;
      let delta = angle - lastAngle.value;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastAngle.value = angle;
      rotation.value += delta;
      pending.value += delta;
      if (Date.now() - lastCommit.value >= 40) {
        scheduleOnRN(commitScratch, pending.value, false);
        lastCommit.value = Date.now();
      }
    })
    .onFinalize(() => {
      if (!scratching.value) return;
      scheduleOnRN(commitScratch, pending.value, true);
      scratching.value = false;
      resume();
    });

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityLabel={`Deck ${deckId} Jog Wheel Platter`}>
      <GestureDetector gesture={gesture}>
      <View
        style={[
          styles.platterOuter,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: isPlaying ? accentColor : DJColors.borderStrong,
          },
        ]}>
        <View
          style={[
            styles.vinylGroove1,
            { width: size - 16, height: size - 16, borderRadius: (size - 16) / 2 },
          ]}
        />
        <View
          style={[
            styles.vinylGroove2,
            { width: size - 36, height: size - 36, borderRadius: (size - 36) / 2 },
          ]}
        />

        <Animated.View
          style={[
            styles.slipmatCenter,
            {
              width: size - 56,
              height: size - 56,
              borderRadius: (size - 56) / 2,
              borderColor: accentColor,
              backgroundColor: darkAccentColor,
            },
            animatedStyle,
          ]}>
          <View style={[styles.needleMarker, { backgroundColor: accentColor }]} />
          <View style={styles.spindle}>
            <Text style={[styles.deckText, { color: accentColor }]}>{deckId}</Text>
          </View>
        </Animated.View>
      </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  platterOuter: {
    backgroundColor: DJColors.platter,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  vinylGroove1: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#1C2028',
  },
  vinylGroove2: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#191C23',
  },
  slipmatCenter: {
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  needleMarker: {
    position: 'absolute',
    top: 2,
    width: 3.5,
    height: 14,
    borderRadius: 2,
  },
  spindle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: DJColors.surfaceInset,
    borderWidth: 1,
    borderColor: DJColors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckText: {
    fontFamily: DJFonts.condensed,
    fontSize: 12,
    fontWeight: '900',
  },
});
