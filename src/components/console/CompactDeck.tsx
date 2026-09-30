import React, { memo, useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DeckId, EQBand } from '@/types';
import { useDeckStore } from '@/store/useDeckStore';
import { useMixerStore } from '@/store/useMixerStore';
import { VerticalScroller } from '@/components/common/VerticalScroller';
import { WaveformDisplay } from '@/components/waveform/WaveformDisplay';
import { JogWheel } from '@/components/deck/JogWheel';
import { DJColors } from '@/constants/theme';
const Tone = memo(function Tone({ id, band, height }: { id: DeckId; band: EQBand; height: number }) {
  const value = useMixerStore(s => (id === 'A' ? s.eqA : s.eqB)[band]);
  const killed = useMixerStore(s => (id === 'A' ? s.eqA : s.eqB)[`${band}Kill`]);
  const color = id === 'A' ? DJColors.deckA : DJColors.deckB;
  return <View style={s.tone}><VerticalScroller dragOnly label={band === 'low' ? 'BASS' : band === 'mid' ? 'MID' : 'TREBLE'} value={value} onChange={v => { void useMixerStore.getState().setEQ(id, band, v); }} height={height} width={40} railWidth={18} accentColor={color} displayValue={killed ? 'CUT' : `${(value * 12).toFixed(1)}`} accessibilityLabel={`Deck ${id} ${band} EQ`} />
    <Pressable style={[s.kill, killed && { backgroundColor: color }]} accessibilityRole="switch" accessibilityLabel={`Kill Deck ${id} ${band}`} accessibilityState={{ checked: killed }} onPress={() => { void useMixerStore.getState().toggleEQKill(id, band); }}><Text style={[s.small, killed && { color: '#10091A' }]}>KILL</Text></Pressable></View>;
});
const Levels = memo(function Levels({ id, height }: { id: DeckId; height: number }) {
  const key = id === 'A' ? 'deckA' : 'deckB';
  const volume = useDeckStore(s => s[key].volume), gain = useDeckStore(s => s[key].gain), tempo = useDeckStore(s => s[key].tempo);
  const color = id === 'A' ? DJColors.deckA : DJColors.deckB;
  return <View style={s.sliders}>
    <VerticalScroller dragOnly label="GAIN" value={gain} min={0} max={1} bipolar={false} height={height} width={40} railWidth={18} accentColor={color} onChange={v => { void useDeckStore.getState().setGain(id, v); }} accessibilityLabel={`Deck ${id} gain`} />
    <VerticalScroller dragOnly label="VOL" value={volume} min={0} max={1} bipolar={false} height={height} width={40} railWidth={18} accentColor={color} onChange={(v, seq, t) => { void useDeckStore.getState().setVolume(id, v, seq, t); }} accessibilityLabel={`Deck ${id} volume`} />
    <VerticalScroller dragOnly label="TEMPO" value={tempo} min={.5} max={2} bipolar={false} height={height} width={40} railWidth={18} accentColor={color} displayValue={`${tempo.toFixed(2)}×`} onChange={v => { void useDeckStore.getState().setTempo(id, v); }} accessibilityLabel={`Deck ${id} tempo`} />
  </View>;
});
export const CompactDeck = memo(function CompactDeck({ id, availableHeight, wide }: { id: DeckId; availableHeight: number; wide: boolean }) {
  const router = useRouter();
  const key = id === 'A' ? 'deckA' : 'deckB';
  const track = useDeckStore(s => s[key].loadedTrack), playing = useDeckStore(s => s[key].isPlaying), tempo = useDeckStore(s => s[key].tempo);
  const canSync = useDeckStore(s => s.deckA.bpm > 0 && s.deckB.bpm > 0);
  const closeTools = () => { setTools(false); void useDeckStore.getState().setPitchBend(id, 0); };
  const [tools, setTools] = useState(false);
  const color = id === 'A' ? DJColors.deckA : DJColors.deckB;
  // Wide banks share a row. Short displays keep secondary controls in Tools.
  const full = !wide && availableHeight >= 550;
  const rail = Math.max(28, Math.min(100, wide ? availableHeight - 220 : (availableHeight - (full ? 460 : 270)) / 2));
  const scratch = useCallback((v: number) => { void useDeckStore.getState().scratch(id, v); }, [id]);
  const jog = <View style={s.jog}><Pressable accessibilityRole="button" accessibilityLabel={`Deck ${id} bend down`} style={s.bend} onPressIn={() => { void useDeckStore.getState().setPitchBend(id, -1); }} onPressOut={() => { void useDeckStore.getState().setPitchBend(id, 0); }}><Text style={s.small}>−</Text></Pressable><JogWheel deckId={id} size={64} tempo={tempo} isPlaying={playing} onScratch={scratch} /><Pressable accessibilityRole="button" accessibilityLabel={`Deck ${id} bend up`} style={s.bend} onPressIn={() => { void useDeckStore.getState().setPitchBend(id, 1); }} onPressOut={() => { void useDeckStore.getState().setPitchBend(id, 0); }}><Text style={s.small}>+</Text></Pressable></View>;
  const reset = <View style={s.resetRow}><Pressable style={[s.reset, { flex: 1 }]} accessibilityRole="button" accessibilityLabel={`Reset Deck ${id} EQ`} onPress={() => { void useMixerStore.getState().resetEQ(id); }}><Text style={s.small}>EQ 0</Text></Pressable><Pressable style={[s.reset, { flex: 1 }]} accessibilityRole="button" accessibilityLabel={`Reset Deck ${id} tempo`} onPress={() => { void useDeckStore.getState().setTempo(id, 1); }}><Text style={s.small}>1×</Text></Pressable></View>;
  return <View style={[s.card, { borderTopColor: color }]}>
    <View style={s.header}><Pressable style={s.track} accessibilityRole="button" accessibilityLabel={`Load Deck ${id}`} onPress={() => router.dismissTo('/library')}><Text style={[s.badge, { color }]}>{id}</Text><Text numberOfLines={1} style={s.title}>{track?.title ?? 'Load track'}</Text></Pressable><Pressable style={s.more} accessibilityRole="button" accessibilityLabel={`Deck ${id} tools`} onPress={() => setTools(true)}><Ionicons name="ellipsis-horizontal" size={18} color={color} /></Pressable></View>
    <WaveformDisplay deckId={id} height={32} />
    <View style={[s.banks, wide && { flexDirection: 'row' }]}>
      <View style={[s.sliders, wide && { flex: 1 }]}>{(['low', 'mid', 'high'] as const).map(b => <Tone key={b} id={id} band={b} height={rail} />)}</View>
      <View style={wide ? { flex: 1 } : undefined}><Levels id={id} height={rail} /></View>
    </View>
    {full && <>{jog}{reset}</>}
    <View style={s.transport}><Pressable style={s.cue} accessibilityRole="button" accessibilityLabel={`Deck ${id} cue`} onPressIn={() => { void useDeckStore.getState().pressCue(id); }} onPressOut={() => { void useDeckStore.getState().releaseCue(id); }}><Text style={s.small}>CUE</Text></Pressable><Pressable disabled={!track} style={[s.play, { backgroundColor: color, opacity: track ? 1 : .4 }]} accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Play'} Deck ${id}`} onPress={() => { void useDeckStore.getState().togglePlay(id); }}><Ionicons name={playing ? 'pause' : 'play'} size={20} color="#130A20" /><Text style={s.playText}>{playing ? 'PAUSE' : 'PLAY'}</Text></Pressable></View>
    <Modal visible={tools} transparent animationType="fade" onRequestClose={closeTools}><View style={s.scrim}><View style={s.sheet}><Text style={[s.sheetTitle, { color }]}>DECK {id} · TOOLS</Text>{jog}{reset}<Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSync }} disabled={!canSync} style={[s.reset, !canSync && { opacity: .4 }]} onPress={() => { const d = useDeckStore.getState(); if (d.deckA.bpm > 0 && d.deckB.bpm > 0) void d.toggleSync(id); }}><Text style={s.small}>SYNC · requires BPM on both decks</Text></Pressable><Text style={s.note}>Loop playback is not available yet. Hold − / + to bend pitch.</Text><Pressable style={s.reset} accessibilityRole="button" onPress={closeTools}><Text style={s.small}>DONE</Text></Pressable></View></View></Modal>
  </View>;
});
const s = StyleSheet.create({
  card: { flex: 1, minWidth: 0, padding: 5, gap: 4, borderWidth: 1, borderTopWidth: 2, borderColor: '#3B2556', borderRadius: 12, backgroundColor: '#181023' },
  header: { height: 32, flexDirection: 'row', alignItems: 'center' }, track: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }, badge: { fontSize: 18, fontWeight: '900' }, title: { flex: 1, color: '#F3E9FF', fontSize: 10, fontWeight: '700' }, more: { width: 28, height: 32, justifyContent: 'center', alignItems: 'center' },
  banks: { gap: 6, flexGrow: 1, justifyContent: 'space-evenly' }, sliders: { flexDirection: 'row', justifyContent: 'space-around', gap: 2 }, tone: { alignItems: 'center', gap: 3 }, kill: { height: 28, width: 40, borderRadius: 5, backgroundColor: '#30203F', alignItems: 'center', justifyContent: 'center' }, small: { color: '#D8C5EF', fontSize: 9, fontWeight: '800' },
  jog: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, bend: { width: 28, height: 44, backgroundColor: '#30203F', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, resetRow: { flexDirection: 'row', gap: 5 }, reset: { minHeight: 32, backgroundColor: '#30203F', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 6 },
  transport: { flexDirection: 'row', gap: 4, height: 44 }, cue: { flex: 1, backgroundColor: '#36204C', alignItems: 'center', justifyContent: 'center', borderRadius: 7 }, play: { flex: 2, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 7 }, playText: { color: '#130A20', fontSize: 10, fontWeight: '900' },
  scrim: { flex: 1, backgroundColor: '#080310DD', alignItems: 'center', justifyContent: 'center', padding: 24 }, sheet: { width: '100%', maxWidth: 340, backgroundColor: '#21132F', borderRadius: 20, borderWidth: 1, borderColor: '#7545A8', padding: 18, gap: 14 }, sheetTitle: { fontSize: 16, fontWeight: '800' }, note: { color: '#BBA5D0', fontSize: 12, lineHeight: 18 },
});
