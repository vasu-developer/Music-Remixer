import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DJColors, DJFonts } from '@/constants/theme';
import { FaderSlider } from '@/components/common/FaderSlider';
import { CompactDeck } from '@/components/console/CompactDeck';
import { SystemAudioPanel } from '@/components/console/SystemAudioPanel';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useMixerStore } from '@/store/useMixerStore';

// Horizontal continuous fader strip
function Strip({
  label,
  value,
  min = 0,
  max = 1,
  color,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  color: string;
  onChange: (v: number, seq?: number, time?: number) => void;
}) {
  const [width, setWidth] = useState(100);
  return (
    <View style={s.strip} onLayout={(e) => setWidth(Math.max(48, e.nativeEvent.layout.width))}>
      <Text numberOfLines={1} style={s.label}>
        {label}
      </Text>
      <FaderSlider
        value={value}
        min={min}
        max={max}
        length={width}
        orientation="horizontal"
        accentColor={color}
        onChange={onChange}
        traceLabel={label}
      />
    </View>
  );
}

// 3-Band Deck Tone Controls (Bass, Mid, Treble)
// Master & Crossfader Output Bar
function Output({ wide }: { wide: boolean }) {
  const cross = useMixerStore((st) => st.crossfader);
  const master = useMixerStore((st) => st.masterVolume);

  return (
    <View style={[s.output, wide && { height: 62, paddingTop: 0 }]}>
      <View style={{ flex: 2 }}>
        <Strip
          label="A ← CROSSFADER → B"
          value={cross}
          min={-1}
          max={1}
          color={DJColors.deckA}
          onChange={(v) => {
            void useMixerStore.getState().setCrossfader(v);
          }}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Strip
          label={`MASTER ${Math.round(master * 100)}%`}
          value={master}
          color={DJColors.master}
          onChange={(v) => {
            void useMixerStore.getState().setMasterVolume(v);
          }}
        />
      </View>
    </View>
  );
}

export function MixerScreen() {
  useAudioEngine();
  const { width, height } = useWindowDimensions();
  const wide = width > height && width >= 680;
  const [deckHeight, setDeckHeight] = useState(450);
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const activeMode = mode === 'system' ? 'system' : 'mixer';
  const setActiveMode = (next: 'mixer' | 'system') => router.setParams({ mode: next });
  const [panelSize, setPanelSize] = useState({ width: width - 20, height: height - 150 });

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Header with Brand, Mode Toggle, and Navigation */}
      <View style={wide ? { flexDirection: 'row', alignItems: 'center', gap: 12 } : undefined}>
      <View style={[s.header, wide && { flex: 1 }]}>
        <View style={s.brandGroup}>
          <Text style={s.brand}>REMIXER</Text>
          <Text style={s.appSub}>DUAL DECK • AUDIO LAB</Text>
        </View>

        {/* Quick Nav */}
        <View style={s.nav}>
          <Pressable
            style={s.navButton}
            onPress={() => router.push('/equalizer')}
            accessibilityRole="button"
            accessibilityLabel="Master sound equalizer">
            <Text style={s.small}>EQ</Text>
          </Pressable>
          <Pressable
            style={s.navButton}
            onPress={() => router.dismissTo('/library')}
            accessibilityRole="button">
            <Text style={s.small}>LIBRARY</Text>
          </Pressable>
          <Pressable
            style={s.navButton}
            onPress={() => router.dismissTo('/settings')}
            accessibilityRole="button" accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={17} color="#95A6BA" />
          </Pressable>
        </View>
      </View>

        {/* Pro Pill Mode Toggle */}
        <View style={[s.modeGroup, wide && { flex: 1 }]}>
          <Pressable
            style={[s.modeBtn, activeMode === 'mixer' && s.modeBtnActive]}
            onPress={() => setActiveMode('mixer')}
            accessibilityRole="tab"
            accessibilityLabel="DJ Mixer mode" accessibilityState={{ selected: activeMode === 'mixer' }}>
            <Text style={[s.modeText, activeMode === 'mixer' && s.modeTextActive]}>
              DJ DECKS
            </Text>
          </Pressable>
          <Pressable
            style={[s.modeBtn, activeMode === 'system' && s.modeBtnActive]}
            onPress={() => setActiveMode('system')}
            accessibilityRole="tab"
            accessibilityLabel="System Audio mode" accessibilityState={{ selected: activeMode === 'system' }}>
            <Text style={[s.modeText, activeMode === 'system' && s.modeTextActive]}>
              SYSTEM AUDIO
            </Text>
          </Pressable>
        </View>

      </View>
      {/* Screen Body */}
      {activeMode === 'mixer' ? (
        <>
          <View style={[s.decks, { flex: 1 }]} onLayout={e => setDeckHeight(e.nativeEvent.layout.height)}>
            <CompactDeck id="A" wide={wide} availableHeight={deckHeight} />
            <CompactDeck id="B" wide={wide} availableHeight={deckHeight} />
          </View>
          <Output wide={wide} />
        </>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          onLayout={e => setPanelSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
          <SystemAudioPanel width={panelSize.width} height={panelSize.height} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export const ProMixerScreen = MixerScreen;
export default MixerScreen;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#10091B', paddingHorizontal: 10 },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#17222E',
    marginBottom: 4,
  },
  brandGroup: {
    gap: 1,
  },
  brand: {
    color: '#E4EDF7',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 2,
  },
  appSub: {
    color: '#657B95',
    fontSize: 7.5,
    fontWeight: '700',
    fontFamily: DJFonts.mono,
    letterSpacing: 1,
  },
  modeGroup: {
    marginBottom: 6,
    flexDirection: 'row',
    backgroundColor: '#21132F',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#48305F',
    gap: 2,
  },
  modeBtn: {
    flex: 1,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#512785',
    borderWidth: 1,
    borderColor: '#B16AFF',
  },
  modeText: {
    color: '#899AB0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modeTextActive: {
    color: '#E7CDFF',
    fontWeight: '900',
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 5,
    backgroundColor: '#2D1A43',
  },
  decks: { flexShrink: 0, flexDirection: 'row', gap: 6 },
  deck: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#21132F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#48305F',
    borderTopWidth: 2,
    padding: 6,
    gap: 6,
  },
  track: { minHeight: 40, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { fontSize: 20, fontWeight: '900' },
  title: { color: '#DCE7F3', fontSize: 11, fontWeight: '600' },
  banks: { gap: 6, flexShrink: 0 },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  jogRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 4 },
  jogSide: { flex: 1, gap: 4 },
  auxButton: {
    minHeight: 34,
    backgroundColor: '#1B2734',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eqBank: { minWidth: 0, flexShrink: 0, gap: 2 },
  levels: { minWidth: 0, flexShrink: 0, gap: 2 },
  wideBank: { flex: 1 },
  artist: { color: '#899AB0', fontSize: 9.5, marginTop: 2 },
  reset: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: '#1B2734',
    marginTop: 2,
  },
  tone: { flexShrink: 0, alignItems: 'center', gap: 3 },
  label: { color: '#95A6BA', fontSize: 9.5, fontWeight: '700' },
  kill: {
    width: 38,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: '#1B2734',
  },
  small: { color: '#DCE7F3', fontSize: 9, fontWeight: '800' },
  strip: { minHeight: 58, flexShrink: 0, justifyContent: 'center' },
  transport: { flexDirection: 'row', gap: 6, marginTop: 2 },
  button: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#48305F',
  },
  output: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 8,
    paddingTop: 4,
    height: 64,
    backgroundColor: '#170D25',
    borderTopWidth: 1,
    borderTopColor: '#1A2533',
  },
});
