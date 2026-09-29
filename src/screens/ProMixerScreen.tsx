import React, { memo, useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DJColors, DJFonts } from '@/constants/theme';
import { WaveformDisplay } from '@/components/waveform/WaveformDisplay';
import { FaderSlider } from '@/components/common/FaderSlider';
import { VerticalScroller } from '@/components/common/VerticalScroller';
import { JogWheel } from '@/components/deck/JogWheel';
import { SystemAudioPanel } from '@/components/console/SystemAudioPanel';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useDeckStore } from '@/store/useDeckStore';
import { useMixerStore } from '@/store/useMixerStore';
import { DeckId, EQBand } from '@/types';

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
const Tone = memo(function Tone({ deckId, band }: { deckId: DeckId; band: EQBand }) {
  const value = useMixerStore((st) => (deckId === 'A' ? st.eqA : st.eqB)[band]);
  const killed = useMixerStore((st) => (deckId === 'A' ? st.eqA : st.eqB)[`${band}Kill`]);
  const color = deckId === 'A' ? DJColors.deckA : DJColors.deckB;
  const change = useCallback(
    (v: number) => {
      void useMixerStore.getState().setEQ(deckId, band, v);
    },
    [deckId, band]
  );
  const name = band === 'low' ? 'BASS' : band === 'high' ? 'TREBLE' : 'MID';

  return (
    <View style={s.tone}>
      <VerticalScroller
        label={name}
        value={value}
        onChange={change}
        height={64}
        width={40}
        accentColor={color}
        displayValue={killed ? 'CUT' : `${(value * 12).toFixed(1)}dB`}
        accessibilityLabel={`Deck ${deckId} ${name}`}
      />
      <Pressable
        style={[s.kill, killed && { backgroundColor: color }]}
        accessibilityRole="switch"
        accessibilityState={{ checked: killed }}
        accessibilityLabel={`Kill Deck ${deckId} ${name}`}
        onPress={() => {
          void useMixerStore.getState().toggleEQKill(deckId, band);
        }}>
        <Text style={[s.small, killed && { color: '#080B10' }]}>KILL</Text>
      </Pressable>
    </View>
  );
});

// Deck Levels (Gain, Volume, Tempo)
const Levels = memo(function Levels({ deckId, wide }: { deckId: DeckId; wide: boolean }) {
  const key = deckId === 'A' ? 'deckA' : 'deckB';
  const gain = useDeckStore((st) => st[key].gain);
  const volume = useDeckStore((st) => st[key].volume);
  const tempo = useDeckStore((st) => st[key].tempo);
  const color = deckId === 'A' ? DJColors.deckA : DJColors.deckB;

  return (
    <View style={[s.levels, wide && s.wideBank]}>
      <View style={s.sliderRow}>
        <VerticalScroller
          label="GAIN"
          value={gain}
          min={0}
          max={1}
          bipolar={false}
          height={80}
          width={40}
          accentColor={color}
          displayValue={`${Math.round(gain * 100)}%`}
          onChange={(v) => {
            void useDeckStore.getState().setGain(deckId, v);
          }}
          accessibilityLabel={`Deck ${deckId} gain`}
        />
        <VerticalScroller
          label="VOL"
          value={volume}
          min={0}
          max={1}
          bipolar={false}
          height={80}
          width={40}
          accentColor={color}
          displayValue={`${Math.round(volume * 100)}%`}
          onChange={(v, seq, t) => {
            void useDeckStore.getState().setVolume(deckId, v, seq, t);
          }}
          accessibilityLabel={`Deck ${deckId} volume`}
        />
        <VerticalScroller
          label="TEMPO"
          value={tempo}
          min={0.5}
          max={2}
          bipolar={false}
          height={80}
          width={40}
          accentColor={color}
          displayValue={`${tempo.toFixed(2)}×`}
          onChange={(v) => {
            void useDeckStore.getState().setTempo(deckId, v);
          }}
          accessibilityLabel={`Deck ${deckId} tempo`}
        />
      </View>
      <Pressable
        style={s.reset}
        accessibilityRole="button"
        accessibilityLabel={`Restore Deck ${deckId} original tempo`}
        onPress={() => {
          void useDeckStore.getState().setTempo(deckId, 1);
        }}>
        <Text style={s.small}>TEMPO · RESET</Text>
      </Pressable>
    </View>
  );
});

// Single DJ Deck Container
const Deck = memo(function Deck({
  deckId,
  wide,
  waveformHeight,
}: {
  deckId: DeckId;
  wide: boolean;
  waveformHeight: number;
}) {
  const router = useRouter();
  const key = deckId === 'A' ? 'deckA' : 'deckB';
  const track = useDeckStore((st) => st[key].loadedTrack);
  const playing = useDeckStore((st) => st[key].isPlaying);
  const tempo = useDeckStore((st) => st[key].tempo);
  const sync = useDeckStore((st) => st[key].isSyncActive);
  const bpm = useDeckStore((st) => st[key].bpm);
  const otherBpm = useDeckStore((st) => st[deckId === 'A' ? 'deckB' : 'deckA'].bpm);
  const scratch = useCallback(
    (delta: number) => {
      void useDeckStore.getState().scratch(deckId, delta);
    },
    [deckId]
  );
  const color = deckId === 'A' ? DJColors.deckA : DJColors.deckB;

  return (
    <View style={[s.deck, { borderTopColor: color, padding: wide ? 4 : 6 }]}>
      {/* Track Header */}
      <Pressable
        style={s.track}
        accessibilityRole="button"
        accessibilityLabel={`Load song on Deck ${deckId}`}
        onPress={() => router.dismissTo('/library')}>
        <Text style={[s.badge, { color }]}>{deckId}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={s.title}>
            {track?.title ?? 'Load a song'}
          </Text>
          <Text numberOfLines={1} style={s.artist}>
            {track?.artist ?? 'Tap to open library'}
          </Text>
        </View>
        <Text style={{ color, fontSize: 16, fontWeight: '700' }}>＋</Text>
      </Pressable>

      {/* Waveform */}
      <WaveformDisplay deckId={deckId} height={waveformHeight} />

      {/* Equalizer & Levels Bank */}
      <View style={[s.banks, wide && { flexDirection: 'row' }]}>
        <View style={[s.eqBank, wide && s.wideBank]}>
          <View style={s.sliderRow}>
            {(['low', 'mid', 'high'] as const).map((b) => (
              <Tone key={b} deckId={deckId} band={b} />
            ))}
          </View>
          <Pressable
            style={s.reset}
            accessibilityRole="button"
            accessibilityLabel={`Reset Deck ${deckId} EQ`}
            onPress={() => {
              void useMixerStore.getState().resetEQ(deckId);
            }}>
            <Text style={s.small}>RESET EQ</Text>
          </Pressable>
        </View>
        <Levels deckId={deckId} wide={wide} />
      </View>

      {/* Jog Wheel & Sync */}
      <View style={s.jogRow}>
        <View style={s.jogSide}>
          <Pressable
            style={s.auxButton}
            accessibilityRole="button"
            accessibilityLabel={`Deck ${deckId} sync`}
            onPress={() => {
              if (bpm <= 0 || otherBpm <= 0)
                Alert.alert(
                  'Sync needs BPM',
                  'These songs do not have analyzed BPM yet. Use the tempo slider to match them manually.'
                );
              else void useDeckStore.getState().toggleSync(deckId);
            }}>
            <Text style={[s.small, sync && { color, fontWeight: '900' }]}>
              {sync ? 'SYNC ON' : 'SYNC'}
            </Text>
          </Pressable>
          <Pressable
            style={s.auxButton}
            accessibilityRole="button"
            accessibilityLabel={`Deck ${deckId} loop information`}
            onPress={() =>
              Alert.alert(
                'Loop playback',
                'Loop audio playback is not implemented yet. This control will be available in a future update.'
              )
            }>
            <Text style={s.small}>LOOP · SOON</Text>
          </Pressable>
        </View>
        <JogWheel
          deckId={deckId}
          isPlaying={playing}
          tempo={tempo}
          onScratch={scratch}
          size={72}
        />
      </View>

      {/* Pitch Bend Buttons */}
      <View style={s.transport}>
        {([-1, 1] as const).map((direction) => (
          <Pressable
            key={direction}
            style={s.button}
            accessibilityRole="button"
            accessibilityLabel={`Deck ${deckId} pitch bend ${direction < 0 ? 'down' : 'up'}`}
            onPressIn={() => {
              void useDeckStore.getState().setPitchBend(deckId, direction);
            }}
            onPressOut={() => {
              void useDeckStore.getState().setPitchBend(deckId, 0);
            }}>
            <Text style={s.small}>BEND {direction < 0 ? '−' : '+'}</Text>
          </Pressable>
        ))}
      </View>

      {/* Cue & Play Transport */}
      <View style={s.transport}>
        <Pressable
          style={s.button}
          accessibilityRole="button"
          accessibilityLabel={`Deck ${deckId} cue`}
          onPressIn={() => {
            void useDeckStore.getState().pressCue(deckId);
          }}
          onPressOut={() => {
            void useDeckStore.getState().releaseCue(deckId);
          }}>
          <Text style={s.small}>CUE</Text>
        </Pressable>
        <Pressable
          disabled={!track}
          style={[
            s.button,
            { flex: 2, backgroundColor: playing ? color : '#263340', opacity: track ? 1 : 0.4 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${playing ? 'Pause' : 'Play'} Deck ${deckId}`}
          onPress={() => {
            void useDeckStore.getState().togglePlay(deckId);
          }}>
          <Text style={[s.small, playing && { color: '#080B10', fontWeight: '900' }]}>
            {playing ? 'Ⅱ PAUSE' : '▶ PLAY'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

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

export function ProMixerScreen() {
  useAudioEngine();
  const { width, height } = useWindowDimensions();
  const wide = width > height;
  const waveformHeight = wide ? 36 : 44;
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<'mixer' | 'system'>('mixer');

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Header with Brand, Mode Toggle, and Navigation */}
      <View style={s.header}>
        <View style={s.brandGroup}>
          <Text style={s.brand}>REMIXER</Text>
          <Text style={s.appSub}>PRO CONSOLE</Text>
        </View>

        {/* Pro Pill Mode Toggle */}
        <View style={s.modeGroup}>
          <Pressable
            style={[s.modeBtn, activeMode === 'mixer' && s.modeBtnActive]}
            onPress={() => setActiveMode('mixer')}
            accessibilityRole="tab"
            accessibilityLabel="DJ Mixer mode">
            <Text style={[s.modeText, activeMode === 'mixer' && s.modeTextActive]}>
              🎛️ MIXER
            </Text>
          </Pressable>
          <Pressable
            style={[s.modeBtn, activeMode === 'system' && s.modeBtnActive]}
            onPress={() => setActiveMode('system')}
            accessibilityRole="tab"
            accessibilityLabel="System Audio mode">
            <Text style={[s.modeText, activeMode === 'system' && s.modeTextActive]}>
              🔊 SYSTEM
            </Text>
          </Pressable>
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
            accessibilityRole="button">
            <Ionicons name="settings-outline" size={17} color="#95A6BA" />
          </Pressable>
        </View>
      </View>

      {/* Screen Body */}
      {activeMode === 'mixer' ? (
        <>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 2 }}>
            <View style={s.decks}>
              <Deck deckId="A" wide={wide} waveformHeight={waveformHeight} />
              <Deck deckId="B" wide={wide} waveformHeight={waveformHeight} />
            </View>
          </ScrollView>
          <Output wide={wide} />
        </>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
          <SystemAudioPanel width={width - 12} height={height - 120} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export const MixerScreen = ProMixerScreen;
export default ProMixerScreen;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090D13', paddingHorizontal: 6 },
  header: {
    height: 48,
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
    fontSize: 16,
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
    flexDirection: 'row',
    backgroundColor: '#111923',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#263340',
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: DJColors.deckA,
  },
  modeText: {
    color: '#899AB0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modeTextActive: {
    color: '#080B10',
    fontWeight: '900',
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 5,
    backgroundColor: '#131C27',
  },
  decks: { flexShrink: 0, flexDirection: 'row', gap: 6 },
  deck: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#111923',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263340',
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
    minHeight: 28,
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
    height: 24,
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
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#263340',
  },
  output: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 8,
    paddingTop: 4,
    height: 64,
    backgroundColor: '#0D141D',
    borderTopWidth: 1,
    borderTopColor: '#1A2533',
  },
});
