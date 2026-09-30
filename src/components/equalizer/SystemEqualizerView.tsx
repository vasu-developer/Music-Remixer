import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { VerticalScroller } from '@/components/common/VerticalScroller';
import { useSystemEqualizerStore as useSound } from '@/store/useSystemEqualizerStore';
import { useDeckStore } from '@/store/useDeckStore';
import { EQ_FREQUENCIES } from '@/core/audio/systemEqualizer';
import { getAudioEngine } from '@/core/audio';

const Control = memo(function Control({ index, label, min = -12, max = 12, unit = 'dB' }: {
  index: number; label: string; min?: number; max?: number; unit?: string;
}) {
  const value = useSound(s => s.values[index]);
  return <VerticalScroller label={label} value={value} min={min} max={max} bipolar={min < 0}
    centerDetent={min < 0} displayValue={`${value.toFixed(1)}${unit}`} height={110} width={48}
    accentColor="#00E5FF" onChange={v => useSound.getState().setValue(index, v)} accessibilityLabel={`Master ${label}`} />;
});
export function SystemEqualizerView() {
  const router = useRouter();
  const enabled = useSound(s => s.values[16] === 1);
  const limiter = useSound(s => s.values[5] === 1);
  const error = useSound(s => s.error);
  const trackA = useDeckStore(s => s.deckA.loadedTrack);
  const trackB = useDeckStore(s => s.deckB.loadedTrack);
  const issue = getAudioEngine().masterFxIssue?.() ?? (!getAudioEngine().setMasterFx ? 'Master sound requires the updated Android app.' : null);
  useEffect(() => { useSound.getState().apply(); }, [trackA, trackB]);
  return <SafeAreaView style={s.screen}>
    <View style={s.header}><View style={{ flex: 1 }}><Text style={s.title}>MASTER SOUND</Text><Text style={s.note}>Applies to the combined output of Deck A + B</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')} style={s.button}><Text style={s.action}>MIXER</Text></Pressable></View>
    <ScrollView contentContainerStyle={s.content}>
      <Pressable style={s.button} accessibilityRole="button" onPress={() => router.push('/system-audio')}><Text style={s.action}>SYSTEM AUDIO · OTHER APPS</Text></Pressable>
      <View style={s.card}>
        <View style={s.row}><Text style={s.heading}>{enabled ? 'Processing enabled' : 'Bypass · original mix'}</Text>
          <Switch value={enabled} disabled={!!issue && !enabled} onValueChange={v => useSound.getState().setValue(16, v ? 1 : 0)} accessibilityLabel="Enable master sound" /></View>
        <Text style={s.note}>Settings apply immediately and last for this app session. Enable processing to hear your adjustments.</Text>
        {(issue || error) && <Text accessibilityRole="alert" style={s.error}>{issue || error}</Text>}
      </View>
      <View pointerEvents={issue ? 'none' : 'auto'} style={{ gap: 12, opacity: issue ? .45 : 1 }}>
        <View style={s.card}>
          <Text style={s.heading}>PREAMP & TONE</Text>
          <View style={s.controls}><Control index={0} label="PREAMP" /><Control index={1} label="BASS" /><Control index={2} label="TREBLE" /></View>
          <Text style={s.note}>Lower preamp when boosting EQ to leave headroom. Bass and treble are shelf filters at 250 Hz and 4 kHz.</Text>
        </View>
        <View style={s.card}>
          <Text style={s.heading}>10-BAND EQUALIZER · Hz</Text>
          <View style={s.eqGrid}>{EQ_FREQUENCIES.map((label, i) => <View key={label} style={s.eqCell}><Control index={6 + i} label={label} /></View>)}</View>
          <Text style={s.note}>±12 dB per band. These controls are additional to each deck’s three-band EQ.</Text>
        </View>
        <View style={s.card}>
          <Text style={s.heading}>STEREO</Text>
          <View style={s.controls}><Control index={3} label="BALANCE" min={-1} max={1} unit="" /><Control index={4} label="WIDTH" min={0} max={2} unit="×" /></View>
          <Text style={s.note}>Balance: −1 left, 0 center, +1 right. Width: 0 mono, 1 original, 2 expanded. Widening does not create stereo from mono.</Text>
        </View>
        <View style={s.card}>
          <View style={s.row}><Text style={s.heading}>PEAK LIMITER</Text><Switch value={limiter} onValueChange={v => useSound.getState().setValue(5, v ? 1 : 0)} accessibilityLabel="Enable peak limiter" /></View>
          <Text style={s.note}>Linked stereo peak limiting with a 100 ms release. Helps control overload; large boosts can still audibly change or distort the sound.</Text>
        </View>
        <Pressable style={s.button} accessibilityRole="button" onPress={() => useSound.getState().reset()}><Text style={s.action}>RESET ALL · BYPASS</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090D13' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  title: { color: '#E6EDF7', fontSize: 18, fontWeight: '800' },
  content: { padding: 12, gap: 12, paddingBottom: 28 },
  card: { backgroundColor: '#111923', borderWidth: 1, borderColor: '#293443', borderRadius: 12, padding: 12, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { color: '#DCE7F3', fontWeight: '700', fontSize: 12, flexShrink: 1 },
  note: { color: '#9BACBF', fontSize: 12, lineHeight: 18 },
  error: { color: '#FFBA87', fontSize: 13, lineHeight: 19 },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', gap: 8, paddingVertical: 8 },
  eqGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 },
  eqCell: { width: '20%', minWidth: 48, alignItems: 'center' },
  button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#20303F', borderRadius: 8, paddingHorizontal: 12 },
  action: { color: '#00E5FF', fontSize: 11, fontWeight: '800' },
});
