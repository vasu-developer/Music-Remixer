import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { DeckId, EQBand } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { useMixerStore } from '@/store/useMixerStore';
import { useControlGesture } from '@/hooks/useControlGesture';

const bands: { band: EQBand; name: string; frequency: string }[] = [
  { band: 'low', name: 'BASS', frequency: '250 Hz' },
  { band: 'mid', name: 'MID', frequency: '1 kHz' },
  { band: 'high', name: 'TREBLE', frequency: '4 kHz' },
];
const EqDial = memo(function EqDial({ deckId, band, name, frequency }: typeof bands[number] & { deckId: DeckId }) {
  const value = useMixerStore(s => (deckId === 'A' ? s.eqA : s.eqB)[band]);
  const killed = useMixerStore(s => (deckId === 'A' ? s.eqA : s.eqB)[`${band}Kill`]);
  const accent = deckId === 'A' ? DJColors.deckA : DJColors.deckB;
  const onChange = useCallback((next: number) => { void useMixerStore.getState().setEQ(deckId, band, next); }, [deckId, band]);
  const { position, gesture } = useControlGesture(value, -1, 1, 180, 0, false, onChange,
    false, true, `Deck ${deckId} ${name}`, true);
  const pointerStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${position.value * 135}deg` }] }));
  const db = value * 12;
  return <View style={styles.band}>
    <Text style={styles.bandName}>{name}</Text>
    <Text style={styles.frequency}>{frequency}</Text>
    <GestureDetector gesture={gesture}>
      <View style={styles.touchArea} accessible accessibilityRole="adjustable"
        accessibilityLabel={`Deck ${deckId} ${name} EQ`}
        accessibilityValue={{ min: -12, max: 12, now: Math.round(db), text: killed ? 'Cut' : `${db.toFixed(1)} decibels` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => onChange(Math.max(-1, Math.min(1,
          value + (event.nativeEvent.actionName === 'increment' ? 1 : -1) / 12)))}>
        <View style={[styles.outerRing, { borderColor: killed ? '#30343D' : `${accent}55` }]}>
          <View style={[styles.zeroMark, { backgroundColor: accent }]} />
          <View style={styles.dialFace}>
            <View style={styles.innerRing} />
            <Animated.View style={[styles.pointerRotor, pointerStyle]}>
              <View style={[styles.pointer, { backgroundColor: killed ? '#67717D' : accent }]} />
            </Animated.View>
            <View style={styles.centerDot} />
          </View>
        </View>
        <Text style={[styles.rangeMark, styles.minus]}>−</Text>
        <Text style={[styles.rangeMark, styles.plus]}>+</Text>
      </View>
    </GestureDetector>
    <Text style={[styles.readout, { color: killed ? DJColors.textMuted : accent }]}>
      {killed ? 'CUT' : `${db > 0.05 ? '+' : ''}${Math.abs(db) < .05 ? '0.0' : db.toFixed(1)} dB`}
    </Text>
    <Pressable accessibilityRole="switch" accessibilityLabel={`Kill ${name} on Deck ${deckId}`}
      accessibilityState={{ checked: killed }}
      onPress={() => { void useMixerStore.getState().toggleEQKill(deckId, band); }}
      style={({ pressed }) => [styles.kill, killed && { backgroundColor: `${accent}20`, borderColor: accent }, pressed && { opacity: .65 }]}>
      <View style={[styles.led, { backgroundColor: killed ? accent : '#46505D' }]} />
      <Text style={[styles.killText, { color: killed ? accent : '#97A2B2' }]}>{killed ? 'KILLED' : 'KILL'}</Text>
    </Pressable>
  </View>;
});

export const EqDeckPanel = memo(function EqDeckPanel({ deckId }: { deckId: DeckId }) {
  const accent = deckId === 'A' ? DJColors.deckA : DJColors.deckB;
  return <View style={[styles.card, { borderTopColor: accent }]}>
    <View style={styles.header}>
      <View style={styles.identity}>
        <View style={[styles.badge, { backgroundColor: `${accent}18`, borderColor: `${accent}55` }]}>
          <Text style={[styles.badgeText, { color: accent }]}>{deckId}</Text>
        </View>
        <View><Text style={styles.deckTitle}>DECK {deckId}</Text><Text style={styles.subtitle}>3-BAND EQUALIZER</Text></View>
      </View>
      <Pressable onPress={() => { void useMixerStore.getState().resetEQ(deckId); }}
        accessibilityRole="button" accessibilityLabel={`Reset Deck ${deckId} equalizer`}
        style={({ pressed }) => [styles.reset, pressed && { opacity: .6 }]}>
        <Ionicons name="refresh-outline" size={13} color="#B5BFCD" />
        <Text style={styles.resetText}>RESET</Text>
      </Pressable>
    </View>
    <View style={styles.controls}>{bands.map(b => <EqDial key={b.band} deckId={deckId} {...b} />)}</View>
  </View>;
});

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#11171F', borderRadius: 12, borderWidth: 1, borderColor: '#29323F', borderTopWidth: 2, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#242D38' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  badge: { width: 30, height: 32, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 18, fontWeight: '900' },
  deckTitle: { color: '#E6EDF7', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  subtitle: { color: '#768497', fontSize: 8, letterSpacing: 1, marginTop: 3 },
  reset: { flexDirection: 'row', gap: 5, alignItems: 'center', minHeight: 44, paddingHorizontal: 9, borderRadius: 7, backgroundColor: '#1B232E' },
  resetText: { color: '#B5BFCD', fontSize: 9, fontWeight: '700', letterSpacing: .6 },
  controls: { flexDirection: 'row', paddingTop: 14, gap: 8 },
  band: { flex: 1, alignItems: 'center' },
  bandName: { color: '#DBE4F0', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  frequency: { color: '#748194', fontFamily: DJFonts.mono, fontSize: 9, marginTop: 4 },
  touchArea: { width: 80, height: 82, justifyContent: 'center', alignItems: 'center' },
  outerRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#090D13' },
  zeroMark: { position: 'absolute', top: -4, width: 3, height: 7, borderRadius: 2 },
  dialFace: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#242E3B', borderWidth: 2, borderTopColor: '#516075', borderLeftColor: '#354355', borderRightColor: '#18212C', borderBottomColor: '#121924', alignItems: 'center', justifyContent: 'center' },
  innerRing: { position: 'absolute', width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#344052', backgroundColor: '#1C2531' },
  pointerRotor: { position: 'absolute', width: 48, height: 48, alignItems: 'center' },
  pointer: { width: 3, height: 13, marginTop: 2, borderRadius: 2 },
  centerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#556477' },
  rangeMark: { position: 'absolute', bottom: 0, fontSize: 11, color: '#667486' },
  minus: { left: 8 }, plus: { right: 8 },
  readout: { fontFamily: DJFonts.mono, fontSize: 12, fontWeight: '700', marginTop: 3, marginBottom: 9 },
  kill: { minHeight: 44, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#0C1118', borderWidth: 1, borderColor: '#2B3542', borderRadius: 6 },
  killText: { fontSize: 9, fontWeight: '800', letterSpacing: .8 },
  led: { width: 4, height: 4, borderRadius: 2 },
});
