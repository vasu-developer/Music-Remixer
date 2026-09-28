import React, { memo, useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DJColors } from '@/constants/theme';
import { WaveformDisplay } from '@/components/waveform/WaveformDisplay';
import { FaderSlider } from '@/components/common/FaderSlider';
import { VerticalScroller } from '@/components/common/VerticalScroller';
import { JogWheel } from '@/components/deck/JogWheel';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useDeckStore } from '@/store/useDeckStore';
import { useMixerStore } from '@/store/useMixerStore';
import { DeckId, EQBand } from '@/types';

// Small continuous controls keep the same bounded UI-to-JS gesture mailbox.
function Strip({ label, value, min = 0, max = 1, color, onChange }: {
  label: string; value: number; min?: number; max?: number; color: string;
  onChange: (v: number, seq?: number, time?: number) => void;
}) {
  const [width, setWidth] = useState(100);
  return <View style={s.strip} onLayout={e => setWidth(Math.max(48, e.nativeEvent.layout.width))}>
    <Text numberOfLines={1} style={s.label}>{label}</Text>
    <FaderSlider value={value} min={min} max={max} length={width} orientation="horizontal" accentColor={color} onChange={onChange} traceLabel={label} />
  </View>;
}
const Tone = memo(function Tone({ deckId, band }: { deckId: DeckId; band: EQBand }) {
  const value = useMixerStore(s => (deckId === 'A' ? s.eqA : s.eqB)[band]);
  const killed = useMixerStore(s => (deckId === 'A' ? s.eqA : s.eqB)[`${band}Kill`]);
  const color = deckId === 'A' ? DJColors.deckA : DJColors.deckB;
  const change = useCallback((v: number) => { void useMixerStore.getState().setEQ(deckId, band, v); }, [deckId, band]);
  const name = band === 'low' ? 'BASS' : band === 'high' ? 'TREBLE' : 'MID';
  return <View style={s.tone}>
    <VerticalScroller label={name} value={value} onChange={change} height={64} width={40}
      accentColor={color} displayValue={killed ? 'CUT' : `${(value * 12).toFixed(1)}dB`} accessibilityLabel={`Deck ${deckId} ${name}`} />
    <Pressable style={[s.kill, killed && { backgroundColor: color }]} accessibilityRole="switch" accessibilityState={{ checked: killed }} accessibilityLabel={`Kill Deck ${deckId} ${name}`}
      onPress={() => { void useMixerStore.getState().toggleEQKill(deckId, band); }}><Text style={[s.small, killed && { color: '#080B10' }]}>KILL</Text></Pressable>
  </View>;
});
const Levels = memo(function Levels({ deckId, wide }: { deckId: DeckId; wide: boolean }) {
  const key = deckId === 'A' ? 'deckA' : 'deckB';
  const gain = useDeckStore(s => s[key].gain);
  const volume = useDeckStore(s => s[key].volume);
  const tempo = useDeckStore(s => s[key].tempo);
  const color = deckId === 'A' ? DJColors.deckA : DJColors.deckB;
  return <View style={[s.levels, wide && s.wideBank]}>
    <View style={s.sliderRow}>
      <VerticalScroller label="GAIN" value={gain} min={0} max={1} bipolar={false} height={80} width={40} accentColor={color} onChange={v => { void useDeckStore.getState().setGain(deckId, v); }} accessibilityLabel={`Deck ${deckId} gain`} />
      <VerticalScroller label="VOL" value={volume} min={0} max={1} bipolar={false} height={80} width={40} accentColor={color} onChange={(v, seq, t) => { void useDeckStore.getState().setVolume(deckId, v, seq, t); }} accessibilityLabel={`Deck ${deckId} volume`} />
      <VerticalScroller label="TEMPO" value={tempo} min={.5} max={2} bipolar={false} height={80} width={40} accentColor={color} displayValue={`${tempo.toFixed(2)}×`} onChange={v => { void useDeckStore.getState().setTempo(deckId, v); }} accessibilityLabel={`Deck ${deckId} tempo`} />
    </View>
    <Pressable style={s.reset} accessibilityRole="button" accessibilityLabel={`Restore Deck ${deckId} original tempo`} onPress={() => { void useDeckStore.getState().setTempo(deckId, 1); }}><Text style={s.small}>TEMPO · RESET</Text></Pressable>
  </View>;
});
const Deck = memo(function Deck({ deckId, wide, waveformHeight }: { deckId: DeckId; wide: boolean; waveformHeight: number }) {
  const router = useRouter();
  const key = deckId === 'A' ? 'deckA' : 'deckB';
  const track = useDeckStore(s => s[key].loadedTrack);
  const playing = useDeckStore(s => s[key].isPlaying);
  const tempo = useDeckStore(s => s[key].tempo);
  const sync = useDeckStore(s => s[key].isSyncActive);
  const bpm = useDeckStore(s => s[key].bpm);
  const otherBpm = useDeckStore(s => s[deckId === 'A' ? 'deckB' : 'deckA'].bpm);
  const scratch = useCallback((delta: number) => { void useDeckStore.getState().scratch(deckId, delta); }, [deckId]);
  const color = deckId === 'A' ? DJColors.deckA : DJColors.deckB;
  return <View style={[s.deck, { borderTopColor: color, padding: wide ? 4 : 6 }]}>
    <Pressable style={s.track} accessibilityRole="button" accessibilityLabel={`Load song on Deck ${deckId}`} onPress={() => router.dismissTo('/library')}>
      <Text style={[s.badge, { color }]}>{deckId}</Text><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={s.title}>{track?.title ?? 'Load a song'}</Text><Text numberOfLines={1} style={s.artist}>{track?.artist ?? 'Tap to open library'}</Text></View><Text style={{ color }}>＋</Text>
    </Pressable>
    <WaveformDisplay deckId={deckId} height={waveformHeight} />
    <View style={[s.banks, wide && { flexDirection: 'row' }]}>
      <View style={[s.eqBank, wide && s.wideBank]}><View style={s.sliderRow}>{(['low', 'mid', 'high'] as const).map(b => <Tone key={b} deckId={deckId} band={b} />)}</View>
        <Pressable style={s.reset} accessibilityRole="button" accessibilityLabel={`Reset Deck ${deckId} EQ`} onPress={() => { void useMixerStore.getState().resetEQ(deckId); }}><Text style={s.small}>RESET EQ</Text></Pressable>
      </View>
      <Levels deckId={deckId} wide={wide} />
    </View>
    <View style={s.jogRow}>
      <View style={s.jogSide}>
        <Pressable style={s.auxButton} accessibilityRole="button" accessibilityLabel={`Deck ${deckId} sync`} onPress={() => {
          if (bpm <= 0 || otherBpm <= 0) Alert.alert('Sync needs BPM', 'These songs do not have analyzed BPM yet. Use the tempo slider to match them manually.');
          else void useDeckStore.getState().toggleSync(deckId);
        }}><Text style={[s.small, sync && { color }]}>{sync ? 'SYNC ON' : 'SYNC'}</Text></Pressable>
        <Pressable style={s.auxButton} accessibilityRole="button" accessibilityLabel={`Deck ${deckId} loop information`} onPress={() => Alert.alert('Loop playback', 'Loop audio playback is not implemented yet. This control will be available in a future update.')}><Text style={s.small}>LOOP · SOON</Text></Pressable>
      </View>
      <JogWheel deckId={deckId} isPlaying={playing} tempo={tempo} onScratch={scratch} size={72} />
    </View>
    <View style={s.transport}>
      {([-1, 1] as const).map(direction => <Pressable key={direction} style={s.button} accessibilityRole="button" accessibilityLabel={`Deck ${deckId} pitch bend ${direction < 0 ? 'down' : 'up'}`}
        onPressIn={() => { void useDeckStore.getState().setPitchBend(deckId, direction); }}
        onPressOut={() => { void useDeckStore.getState().setPitchBend(deckId, 0); }}><Text style={s.small}>BEND {direction < 0 ? '−' : '+'}</Text></Pressable>)}
    </View>
    <View style={s.transport}>
      <Pressable style={s.button} accessibilityRole="button" accessibilityLabel={`Deck ${deckId} cue`} onPressIn={() => { void useDeckStore.getState().pressCue(deckId); }} onPressOut={() => { void useDeckStore.getState().releaseCue(deckId); }}><Text style={s.small}>CUE</Text></Pressable>
      <Pressable disabled={!track} style={[s.button, { flex: 2, backgroundColor: playing ? color : '#263340', opacity: track ? 1 : .4 }]} accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Play'} Deck ${deckId}`} onPress={() => { void useDeckStore.getState().togglePlay(deckId); }}><Text style={[s.small, playing && { color: '#080B10' }]}>{playing ? 'Ⅱ PAUSE' : '▶ PLAY'}</Text></Pressable>
    </View>
  </View>;
});
function Output({ wide }: { wide: boolean }) {
  const cross = useMixerStore(s => s.crossfader);
  const master = useMixerStore(s => s.masterVolume);
  return <View style={[s.output, wide && { height: 62, paddingTop: 0 }]}>
    <View style={{ flex: 2 }}><Strip label="A ← CROSSFADER → B" value={cross} min={-1} max={1} color={DJColors.deckA} onChange={v => { void useMixerStore.getState().setCrossfader(v); }} /></View>
    <View style={{ flex: 1 }}><Strip label={`MASTER ${Math.round(master * 100)}%`} value={master} color={DJColors.master} onChange={v => { void useMixerStore.getState().setMasterVolume(v); }} /></View>
  </View>;
}
export function MixerScreen() {
  useAudioEngine();
  const { width, height } = useWindowDimensions();
  const wide = width > height;
  const waveformHeight = wide ? 36 : 44;
  const router = useRouter();
  return <SafeAreaView style={s.screen} edges={['top', 'bottom', 'left', 'right']}>
    <View style={s.header}><Text style={s.brand}>REMIXER</Text><View style={s.nav}>
      <Pressable style={s.navButton} onPress={() => router.dismissTo('/library')} accessibilityRole="button"><Text style={s.small}>LIBRARY</Text></Pressable>
      <Pressable style={s.navButton} onPress={() => router.dismissTo('/settings')} accessibilityRole="button"><Text style={s.small}>SETTINGS</Text></Pressable>
    </View></View>
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator bounces={false}
      contentContainerStyle={{ flexGrow: 1 }}>
      <View style={s.decks}>
        <Deck deckId="A" wide={wide} waveformHeight={waveformHeight} />
        <Deck deckId="B" wide={wide} waveformHeight={waveformHeight} />
      </View>
    </ScrollView>
    <Output wide={wide} />
  </SafeAreaView>;
}
export default MixerScreen;
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090D13', paddingHorizontal: 6 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#E4EDF7', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  nav: { flexDirection: 'row', gap: 8 }, navButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  decks: { flexShrink: 0, flexDirection: 'row', gap: 6 },
  deck: { flex: 1, minWidth: 0, backgroundColor: '#111923', borderRadius: 10, borderWidth: 1, borderColor: '#263340', borderTopWidth: 2, padding: 6, gap: 6 },
  track: { minHeight: 44, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }, badge: { fontSize: 20, fontWeight: '900' },
  title: { color: '#DCE7F3', fontSize: 11, fontWeight: '600' },
  banks: { gap: 6, flexShrink: 0 },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  jogRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 4 },
  jogSide: { flex: 1, gap: 4 },
  auxButton: { minHeight: 36, backgroundColor: '#1B2734', borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  eqBank: { minWidth: 0, flexShrink: 0, gap: 2 },
  levels: { minWidth: 0, flexShrink: 0, gap: 2 },
  wideBank: { flex: 1 },
  artist: { color: '#899AB0', fontSize: 10, marginTop: 3 },
  reset: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#1B2734' },
  tone: { flexShrink: 0, alignItems: 'center', gap: 3 },
  label: { color: '#95A6BA', fontSize: 10, fontWeight: '700' }, db: { fontSize: 10 },
  kill: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: '#1B2734' },
  small: { color: '#DCE7F3', fontSize: 9, fontWeight: '800' },
  strip: { minHeight: 62, flexShrink: 0, justifyContent: 'center' },
  transport: { flexDirection: 'row', gap: 6, marginTop: 4 },
  button: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#263340' },
  output: { flexDirection: 'row', gap: 18, paddingHorizontal: 6, paddingTop: 4, height: 70 },
});
