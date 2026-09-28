import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DJColors, DJFonts } from '@/constants/theme';
import { useMixerStore } from '@/store/useMixerStore';
import { useDeckStore } from '@/store/useDeckStore';
import { BottomNavBar } from '@/components/navigation/BottomNavBar';
import { CrossfaderCurve } from '@/types';

const curves: { id: CrossfaderCurve; label: string; desc: string }[] = [
  { id: 'linear', label: 'Linear', desc: 'Even fade with each deck at 50% in the center.' },
  { id: 'smooth', label: 'Smooth', desc: 'Equal-power blend for gradual transitions between songs.' },
  { id: 'cut', label: 'Sharp cut', desc: 'Both decks stay loud through the middle, with quick cuts at the edges.' },
];
function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.action, pressed && { opacity: .6 }]}>
    <Text style={styles.actionText}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={DJColors.textMuted} />
  </Pressable>;
}
export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const curve = useMixerStore(s => s.crossfaderCurve);
  const volume = useMixerStore(s => s.masterVolume);
  const tempoA = useDeckStore(s => s.deckA.tempo);
  const tempoB = useDeckStore(s => s.deckB.tempo);
  const open = (url?: string) => {
    void (url ? Linking.openURL(url) : Linking.openSettings()).catch(() =>
      Alert.alert('Unable to open', url ? 'Please open Instagram and search for vasu_developer.' : 'Please open your phone settings and select Remixer.'));
  };
  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
    <View style={styles.header}>
      <View><Text style={styles.headerTitle}>SETTINGS</Text><Text style={styles.headerSub}>YOUR MIXER · YOUR SOUND</Text></View>
      <Pressable style={styles.backBtn} onPress={() => router.dismissTo('/')} accessibilityRole="button" accessibilityLabel="Back to mixer">
        <Ionicons name="close" size={20} color={DJColors.textPrimary} />
      </Pressable>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.noticeText}>Mixer changes apply immediately to this session.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>MASTER OUTPUT</Text>
        <Text style={styles.curveDesc}>Adjust the combined output of both decks.</Text>
        <View style={styles.volumeRow}>
          <Pressable style={styles.volumeButton} accessibilityRole="button" accessibilityLabel="Lower master volume"
            onPress={() => { void useMixerStore.getState().setMasterVolume(volume - .05); }}><Text style={styles.actionText}>−</Text></Pressable>
          <Text style={styles.volumeValue}>{Math.round(volume * 100)}%</Text>
          <Pressable style={styles.volumeButton} accessibilityRole="button" accessibilityLabel="Raise master volume"
            onPress={() => { void useMixerStore.getState().setMasterVolume(volume + .05); }}><Text style={styles.actionText}>+</Text></Pressable>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>CROSSFADER CURVE</Text>
        {curves.map(c => <Pressable key={c.id} onPress={() => useMixerStore.getState().setCrossfaderCurve(c.id)}
          accessibilityRole="radio" accessibilityState={{ checked: curve === c.id }} accessibilityLabel={`${c.label}. ${c.desc}`}
          style={[styles.curveCard, curve === c.id && styles.curveCardActive]}>
          <View style={styles.curveHeader}><Text style={styles.curveLabel}>{c.label}</Text>
            {curve === c.id && <Ionicons name="checkmark-circle" size={18} color={DJColors.deckB} />}</View>
          <Text style={styles.curveDesc}>{c.desc}</Text>
        </Pressable>)}
        <Action label="Center crossfader" onPress={() => { void useMixerStore.getState().setCrossfader(0); }} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>EQUALIZERS</Text>
        <Text style={styles.curveDesc}>Reset bass, mid and treble to neutral and turn off all band kills.</Text>
        <Action label="Reset Deck A EQ" onPress={() => { void useMixerStore.getState().resetEQ('A'); }} />
        <Action label="Reset Deck B EQ" onPress={() => { void useMixerStore.getState().resetEQ('B'); }} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>SONG PLAYBACK</Text>
        <Text style={styles.curveDesc}>Tempo changes speed and pitch together. Restore a song’s original speed below.</Text>
        <Action label={`Deck A · ${tempoA.toFixed(2)}× · Reset to 1×`} onPress={() => { void useDeckStore.getState().setTempo('A', 1); }} />
        <Action label={`Deck B · ${tempoB.toFixed(2)}× · Reset to 1×`} onPress={() => { void useDeckStore.getState().setTempo('B', 1); }} />
        <View style={styles.noticeBox}><Text style={styles.noticeText}>Background playback is not supported yet. Keep the app open while mixing.</Text></View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>MUSIC & APP ACCESS</Text>
        <Action label="Open music library" onPress={() => router.dismissTo('/library')} />
        <Action label="Android app settings & permissions" onPress={() => open()} />
      </View>
      <View style={styles.credit}>
        <Text style={styles.creditTitle}>Developed by Vasudev Verma</Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Instagram vasu_developer" onPress={() => open('https://www.instagram.com/vasu_developer/')} style={styles.social}>
          <Ionicons name="logo-instagram" size={18} color={DJColors.deckA} />
          <Text style={styles.socialText}>Instagram · @vasu_developer</Text>
        </Pressable>
      </View>
    </ScrollView>
    <BottomNavBar />
  </SafeAreaView>;
};

const styles = StyleSheet.create({
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: DJColors.surfaceInset },
  actionText: { color: DJColors.textPrimary, fontSize: 13, flexShrink: 1 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, paddingVertical: 8 },
  volumeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: DJColors.surfaceRaised, borderRadius: 12 },
  volumeValue: { color: DJColors.deckA, fontFamily: DJFonts.mono, fontSize: 24, minWidth: 80, textAlign: 'center' },
  credit: { alignItems: 'center', paddingTop: 20, paddingBottom: 10, gap: 8 },
  creditTitle: { color: DJColors.textPrimary, fontSize: 14, fontWeight: '700' },
  social: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  socialText: { color: DJColors.deckA, fontSize: 12 },
  safeArea: {
    flex: 1,
    backgroundColor: DJColors.chassis,
  },
  header: {
    backgroundColor: DJColors.surface,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: DJFonts.condensed,
    fontSize: 16,
    fontWeight: '900',
    color: DJColors.textPrimary,
    letterSpacing: 1.0,
  },
  headerSub: {
    fontFamily: DJFonts.mono,
    fontSize: 8.5,
    color: DJColors.textMuted,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: DJColors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: DJColors.surface,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
    paddingBottom: 6,
  },
  cardTitle: {
    fontFamily: DJFonts.condensed,
    fontSize: 12,
    fontWeight: '900',
    color: DJColors.textPrimary,
    letterSpacing: 0.8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  infoLabel: {
    fontFamily: DJFonts.display,
    fontSize: 12,
    color: DJColors.textSecondary,
  },
  infoValue: {
    fontFamily: DJFonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: DJColors.textPrimary,
  },
  noticeBox: {
    backgroundColor: DJColors.surfaceInset,
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    marginTop: 4,
  },
  noticeText: {
    fontFamily: DJFonts.display,
    fontSize: 11,
    color: DJColors.textSecondary,
    lineHeight: 16,
  },
  buttonList: {
    gap: 6,
  },
  profileBtn: {
    minHeight: 38,
    alignItems: 'flex-start',
    paddingHorizontal: 12,
  },
  curvesList: {
    gap: 6,
  },
  curveCard: {
    backgroundColor: DJColors.surfaceInset,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    gap: 2,
  },
  curveCardActive: {
    borderColor: DJColors.deckB,
    backgroundColor: DJColors.deckBDark,
  },
  curveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  curveLabel: {
    fontFamily: DJFonts.condensed,
    fontSize: 13,
    fontWeight: '800',
    color: DJColors.textPrimary,
  },
  curveDesc: {
    fontFamily: DJFonts.display,
    fontSize: 11,
    color: DJColors.textSecondary,
  },
  roadmapItem: {
    gap: 2,
    paddingVertical: 2,
  },
  roadmapStep: {
    fontFamily: DJFonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: DJColors.deckA,
  },
  roadmapDesc: {
    fontFamily: DJFonts.display,
    fontSize: 11.5,
    color: DJColors.textSecondary,
    lineHeight: 16,
  },
});
