import React, { useEffect, useState } from 'react';
import { Alert, AppState, Modal, FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { externalAudio, MediaPlayerStatus } from '@/core/audio/externalAudio';
import { consoleColors as c, ui } from './ConsoleUI';
export function MediaTransportPanel({ effectPackage }: { effectPackage?: string }) {
  const [players, setPlayers] = useState<MediaPlayerStatus[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [access, setAccess] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const available = !!externalAudio?.mediaPlayers && !!externalAudio?.mediaCommand;
  useEffect(() => {
    const refresh = () => {
      if (AppState.currentState !== 'active') return;
      try { const state = externalAudio?.mediaPlayers?.(); setPlayers(state?.players ?? []); setAccess(state?.access ?? false); }
      catch { setPlayers([]); setAccess(false); }
    };
    refresh(); const timer = setInterval(refresh, 1000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  const matches = players.filter(p => p.packageName === effectPackage);
  const player = selection ? players.find(p => p.id === selection) : (matches.length === 1 ? matches[0] : players.length === 1 ? players[0] : undefined);
  const choose = () => setChoosing(true);
  const command = (action: 'play' | 'pause' | 'next' | 'previous') => {
    if (!player) return;
    try { externalAudio?.mediaCommand?.(player.id, action); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return <View style={[ui.panel, s.panel]}>
    <Text style={s.tag}>NOW PLAYING · EXTERNAL PLAYER</Text>
    {!available ? <Text style={s.note}>Playback controls need the updated native module in your next Android build.</Text> : !access ?
      <Pressable style={s.connect} accessibilityRole="button" onPress={() => Alert.alert('Connect playback controls', 'Android requires notification access to discover media players. Remixer uses their playback metadata and controls; it does not read or store notification contents.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Open settings', onPress: () => { try { externalAudio?.openMediaAccess?.(); } catch { setError('Could not open Android notification access settings.'); } } },
      ])}><Ionicons name="link-outline" size={20} color={c.cyan} /><Text style={s.title}>Connect your music player</Text></Pressable> :
      <Pressable onPress={choose} accessibilityRole="button" accessibilityLabel="Select playback player"><Text numberOfLines={1} style={s.title}>{player?.title ?? (players.length ? 'Choose a player' : 'Start music in another app')}</Text><Text numberOfLines={1} style={s.note}>{player ? `${player.artist || player.packageName} · ${player.playing ? 'Playing' : 'Paused / stopped'}` : 'Compatible media sessions appear here.'}</Text></Pressable>}
    <View style={s.buttons}>{([
      ['previous', 'play-skip-back', player?.canPrevious],
      [player?.playing ? 'pause' : 'play', player?.playing ? 'pause' : 'play', player?.playing ? player.canPause : player?.canPlay],
      ['next', 'play-skip-forward', player?.canNext],
    ] as const).map(([action, icon, supported], i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`External player ${action}`} disabled={!access || !supported} accessibilityState={{ disabled: !access || !supported }}
      onPress={() => command(action)} style={[s.transport, i === 1 && s.play, (!access || !supported) && { opacity: .3 }]}><Ionicons name={icon} size={i === 1 ? 25 : 20} color="#F8F2FF" /></Pressable>)}</View>
    <Modal visible={choosing} transparent animationType="fade" onRequestClose={() => setChoosing(false)}>
      <View style={s.scrim}><View style={s.sheet}>
        <Text style={s.title}>Control a player</Text>
        <Text style={s.note}>Playback selection does not change the EQ audio session.</Text>
        <FlatList data={players} keyExtractor={p => p.id} ListEmptyComponent={<Text style={s.note}>Start playback in your music app first.</Text>}
          renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: player?.id === item.id }} style={s.playerRow} onPress={() => { setSelection(item.id); setError(null); setChoosing(false); }}>
            <Text numberOfLines={1} style={s.title}>{item.title}</Text><Text numberOfLines={1} style={s.note}>{item.packageName}{player?.id === item.id ? ' · Selected' : ''}</Text>
          </Pressable>} />
        <Pressable accessibilityRole="button" style={s.playerRow} onPress={() => setChoosing(false)}><Text style={s.title}>Done</Text></Pressable>
      </View></View>
    </Modal>
    {error && <Text accessibilityRole="alert" style={s.note}>{error}</Text>}
  </View>;
}
const s = StyleSheet.create({ scrim: { flex: 1, backgroundColor: '#080411CC', justifyContent: 'center', padding: 24 }, sheet: { maxHeight: '80%', backgroundColor: '#20132F', borderColor: '#54347D', borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 }, playerRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#49305F' }, panel: { borderColor: '#54347D', backgroundColor: '#20132F' }, tag: { color: '#C098F3', fontSize: 9, letterSpacing: 1.4, fontWeight: '800' }, title: { color: '#F3EAFF', fontSize: 15, fontWeight: '700' }, note: { color: '#B3A3C6', fontSize: 11, lineHeight: 17, marginTop: 4 }, connect: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }, buttons: { flexDirection: 'row', justifyContent: 'center', gap: 18 }, transport: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#35214C', alignItems: 'center', justifyContent: 'center' }, play: { width: 62, backgroundColor: '#8645E6', borderColor: '#CF95FF', borderWidth: 1 } });
