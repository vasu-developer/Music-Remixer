import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, FlatList, Modal, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VerticalScroller } from '@/components/common/VerticalScroller';
import { externalAudio, SystemAudioStatus } from '@/core/audio/externalAudio';
import { MediaTransportPanel } from './MediaTransportPanel';
import { ConsoleButton, consoleColors as c, SectionLabel, ui } from './ConsoleUI';

const EMPTY: SystemAudioStatus = { running: false, sessions: [], bands: [] };
const help = 'Enable processing, then restart playback in your music app. App Session uses sessions announced by compatible players. Global is an experimental output mode and can also affect Remixer. Stop processing before changing modes.\n\nDrag faders to adjust; touching a fader alone does not jump its value. Lower preamp when boosting EQ. The limiter and compressor depend on phone support.\n\nVisualization uses Android’s playback Visualizer and requires microphone permission; no recording is saved. It stops when this panel leaves the foreground. Changing home panels does not stop audio processing.\n\nSystem Audio controls are separate from the DJ deck controls.';
export function SystemAudioPanel({ width, height }: { width: number; height: number }) {
  const [status, setStatus] = useState<SystemAudioStatus>(() => { try { return externalAudio?.status() ?? EMPTY; } catch { return EMPTY; } });
  const [error, setError] = useState<string | null>(null);
  const [global, setGlobal] = useState(!!status.global);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => {
    try { if (externalAudio) { const next = externalAudio.status(); setStatus(next); if (next.running) setGlobal(!!next.global); } }
    catch (e) { setError(String(e)); }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 350);
    const stopVisualization = () => { try { externalAudio?.visualize(false); } catch { /* Native module may be unavailable during teardown. */ } };
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') stopVisualization(); else refresh();
    });
    return () => { clearInterval(timer); listener.remove(); stopVisualization(); };
  }, [refresh]);
  const act = (fn: () => void) => {
    try { fn(); setError(null); refresh(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!status.running && Platform.OS === 'android' && Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      act(() => status.running ? externalAudio?.stop() : externalAudio?.start(global));
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const visualize = async () => {
    try {
      if (!status.visualizing) {
        const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: 'Live audio visualization', message: 'Android requires microphone permission to visualize playback. Remixer does not save recordings.', buttonPositive: 'Continue', buttonNegative: 'Cancel',
        });
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) { setError('Visualization permission denied. Equalization still works.'); return; }
      }
      act(() => externalAudio?.visualize(!status.visualizing));
    } catch (e) { setError(String(e)); }
  };
  const control = (name: string, value: number) => act(() => externalAudio?.setControl(name, value));
  const attached = status.running && (status.selected ?? -1) >= 0;
  const wide = width > height * 1.25;
  const short = height < 530;
  const bands = status.bands;
  const eqWidth = wide ? width * .64 - 26 : width - 26;
  const columnWidth = Math.max(40, Math.min(56, eqWidth / Math.max(5, bands.length)));
  const eqHeight = Math.max(48, Math.min(230, wide ? height - 180 : height - (short ? 290 : 330)));
  const toneHeight = wide ? Math.max(40, eqHeight - 36) : short ? 48 : 78;
  const issue = !externalAudio ? 'Install the native Android build to use System Audio.' : error || status.error || status.visualizationError || (attached && !status.eqControl ? 'EQ control unavailable. Disable other equalizers and reselect the session.' : null);
  const packageName = status.sessions.find(s => s.id === status.selected)?.packageName;
  const source = status.selected === 0 ? 'Global output' : packageName?.split('.').pop() || 'No player connected';
  const equalizer = <View style={[ui.panel, s.eq, wide && { flex: 1.8 }]}>
    <SectionLabel title="GRAPHIC EQUALIZER" detail={bands.length ? `${bands.length} BANDS · Hz` : 'WAITING FOR AUDIO'} />
    <View style={s.eqRow}>{bands.length ? bands.map(b => <VerticalScroller key={`${status.selected}:${b.index}`} label={b.hz >= 1000 ? `${b.hz / 1000}k` : `${Math.round(b.hz)}`} value={b.value}
      min={status.min ?? -12} max={status.max ?? 12} bipolar centerDetent height={eqHeight} width={columnWidth} railWidth={Math.min(20, columnWidth - 6)} dragOnly
      displayValue={`${b.value > 0 ? '+' : ''}${b.value.toFixed(1)}`} disabled={!status.eqControl} accentColor={c.cyan}
      accessibilityLabel={`System EQ ${b.hz} Hz`} onChange={v => control(`band:${b.index}`, v)} />) :
      <View style={[s.empty, { height: eqHeight + 32 }]}><Ionicons name="options-outline" size={28} color={c.muted} /><Text style={s.emptyTitle}>{status.running ? 'Ready for your music' : 'Your sound. Your control.'}</Text><Text style={s.note}>{status.running ? 'Start or restart playback in a compatible player, then choose its session above.' : 'Select App Session, tap the power button, then play music in a compatible app.'}</Text></View>}
    </View>
    <View style={s.legend}><Text style={s.micro}>LOW</Text><Text style={s.micro}>{status.min ?? -12} / +{status.max ?? 12} dB</Text><Text style={s.micro}>HIGH</Text></View>
  </View>;
  const dynamics = <View style={[ui.panel, wide && { flex: 1 }, !wide && { flexShrink: 0 }]}>
    <SectionLabel title="TONE & DYNAMICS" detail={attached ? 'SESSION CONTROLS' : 'AWAITING SOURCE'} />
    <View style={[s.toneRow, wide && { flexWrap: 'wrap' }]}>
      <View style={s.toneFaders}>
        <VerticalScroller label="BASS" value={status.bass ?? 0} min={0} max={1000} bipolar={false} height={toneHeight} width={44} railWidth={20} dragOnly disabled={!status.bassSupported} displayValue={`${Math.round((status.bass ?? 0) / 10)}%`} accessibilityLabel="System bass boost" onChange={v => control('bass', v)} />
        <VerticalScroller label="PREAMP" value={status.preamp ?? 0} min={-12} max={12} height={toneHeight} width={44} railWidth={20} dragOnly disabled={!status.dynamicsSupported} displayValue={`${(status.preamp ?? 0).toFixed(1)}dB`} accessibilityLabel="System preamp" onChange={v => control('preamp', v)} />
      </View>
      <View style={[s.dynamicsButtons, wide && { flexDirection: 'row', flexBasis: '100%' }]}>
        <ConsoleButton label="LIMITER" active={!!status.limiter && !!status.dynamicsSupported} disabled={!status.dynamicsSupported} accessibilityLabel="System limiter" onPress={() => control('limiter', status.limiter ? 0 : 1)} />
        <ConsoleButton label="COMPRESS" active={!!status.compressor} disabled={!status.dynamicsSupported} accessibilityLabel="System compressor" onPress={() => control('compressor', status.compressor ? 0 : 1)} />
      </View>
    </View>
  </View>;
  return <View style={[s.root, { minHeight: height }]}>
    <View style={s.hero}>
      <View style={s.heroIcon}><Ionicons name="radio-outline" size={24} color={c.cyan} /></View>
      <View style={{ flex: 1 }}><Text style={s.eyebrow}>REMIXER / AUDIO LAB</Text><Text style={s.heroTitle}>System Audio</Text></View>
      <View style={s.statePill}><View style={[s.dot, { backgroundColor: attached ? c.cyan : c.muted }]} /><Text style={s.micro}>{attached ? 'CONNECTED' : status.running ? 'DISCOVERING' : 'STANDBY'}</Text></View>
    </View>
    <MediaTransportPanel effectPackage={packageName} />
    <View style={s.sourceRow}>
      <Pressable style={s.source} accessibilityRole="button" accessibilityLabel="Select audio session" onPress={() => setSessionsOpen(true)}>
        <View style={[s.dot, { backgroundColor: attached ? c.cyan : c.muted }]} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={s.sourceTitle}>{source}</Text><Text style={s.micro}>{status.running ? attached ? 'SESSION CONNECTED' : 'LISTENING FOR A PLAYER' : 'PROCESSING OFF'}</Text></View><Ionicons name="chevron-down" size={14} color={c.muted} />
      </Pressable>
      <Pressable accessibilityRole="switch" accessibilityLabel="Enable system audio" accessibilityState={{ checked: status.running, disabled: busy || !externalAudio }} disabled={busy || !externalAudio} onPress={enable} style={[s.power, status.running && s.powerOn]}><Ionicons name="power" size={21} color={status.running ? c.cyan : c.muted} /></Pressable>
    </View>
    <View style={s.routing}>
      <ConsoleButton label="APP SESSION" active={!global} disabled={status.running} onPress={() => setGlobal(false)} />
      <ConsoleButton label="GLOBAL" active={global} disabled={status.running} onPress={() => setGlobal(true)} />
      <Pressable accessibilityRole="button" accessibilityLabel="System audio help" style={s.icon} onPress={() => Alert.alert('System audio', help)}><Ionicons name="information-circle-outline" size={20} color={c.muted} /></Pressable>
      <ConsoleButton label="RESET" disabled={!attached} onPress={() => act(() => {
        bands.forEach(b => externalAudio?.setControl(`band:${b.index}`, 0));
        if (status.bassSupported) externalAudio?.setControl('bass', 0);
        if (status.dynamicsSupported) { externalAudio?.setControl('preamp', 0); externalAudio?.setControl('limiter', 1); externalAudio?.setControl('compressor', 0); }
      })} />
    </View>
    {issue && <Pressable accessibilityRole="button" accessibilityLabel={`Audio status: ${issue}`} onPress={() => Alert.alert('Audio status', issue)}><Text numberOfLines={1} style={s.error}>ⓘ {issue}</Text></Pressable>}
    <View style={[s.body, wide && { flexDirection: 'row' }]}>{equalizer}{dynamics}</View>
    <View style={[ui.panel, s.visualizer]}>
      <View style={s.meterTitle}><Text style={s.micro}>{status.visualizing ? 'PLAYBACK SIGNAL' : 'SIGNAL MONITOR · OFF'}</Text><Pressable disabled={!attached} onPress={visualize} accessibilityRole="switch" accessibilityLabel="System visualizer" accessibilityState={{ checked: !!status.visualizing, disabled: !attached }} style={s.visualizerButton}><Text style={[s.micro, { color: status.visualizing ? c.cyan : c.muted }]}>{status.visualizing ? '● ON' : '○ OFF'}</Text></Pressable></View>
      <View style={s.meter}>{Array.from({ length: 24 }, (_, i) => <View key={i} style={[s.meterBar, { height: Math.max(2, (status.waveform?.[i] ?? 0) * 28), opacity: status.visualizing ? 1 : .18 }]} />)}</View>
    </View>
    <Modal visible={sessionsOpen} transparent animationType="fade" onRequestClose={() => setSessionsOpen(false)}>
      <View style={s.scrim}><View style={s.dialog}><SectionLabel title="AUDIO SESSIONS" detail={global ? 'GLOBAL SELECTED' : 'CHOOSE A PLAYER'} /><Text style={s.note}>Enable App Session mode before restarting playback. Global mode does not require a session selection.</Text>
        <FlatList style={{ maxHeight: 280 }} data={status.sessions} keyExtractor={item => String(item.id)} ListEmptyComponent={<Text style={s.note}>No player sessions announced yet.</Text>} renderItem={({ item }) => <Pressable disabled={global} style={s.sessionItem} onPress={() => { act(() => externalAudio?.select(item.id)); setSessionsOpen(false); }}><Text style={s.sourceTitle}>{item.packageName}</Text><Text style={s.micro}>SESSION {item.id}{status.selected === item.id ? ' · SELECTED' : ''}</Text></Pressable>} />
        <View style={{ height: 44 }}><ConsoleButton label="DONE" onPress={() => setSessionsOpen(false)} /></View>
      </View></View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  root: { gap: 12, paddingBottom: 8 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#3A2057', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -.5 },
  eyebrow: { color: c.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1.6, marginBottom: 4 },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#38224E', paddingHorizontal: 8, paddingVertical: 8, borderRadius: 20 },
  sourceRow: { flexDirection: 'row', gap: 8, minHeight: 64 },
  source: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 9, paddingHorizontal: 12, backgroundColor: c.panel, borderWidth: 1, borderColor: c.edge },
  sourceTitle: { color: c.text, fontSize: 13, fontWeight: '800', letterSpacing: .7 }, dot: { width: 6, height: 6, borderRadius: 3 },
  power: { width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: c.panel, borderWidth: 1, borderColor: c.edge }, powerOn: { borderColor: '#287783', backgroundColor: '#10303A' },
  routing: { flexDirection: 'row', minHeight: 44, gap: 6 }, icon: { width: 36, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 12, flexShrink: 0 }, eq: { justifyContent: 'space-between', gap: 16 }, eqRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, alignItems: 'center', justifyContent: 'space-around' },
  legend: { flexDirection: 'row', justifyContent: 'space-between' }, micro: { fontSize: 8, color: c.muted, fontWeight: '700', letterSpacing: .7, marginTop: 2 },
  toneRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'stretch', gap: 12 }, toneFaders: { flexDirection: 'row', flex: 1, justifyContent: 'space-around' }, dynamicsButtons: { flex: 1, gap: 6 },
  visualizer: { height: 76, gap: 2, paddingVertical: 5 }, meterTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, visualizerButton: { minWidth: 48, alignItems: 'flex-end', paddingVertical: 5 }, meter: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }, meterBar: { flex: 1, backgroundColor: c.cyan, borderTopLeftRadius: 2, borderTopRightRadius: 2, maxHeight: 24 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', paddingHorizontal: 14 }, emptyTitle: { color: c.text, fontSize: 13, fontWeight: '600' }, note: { color: c.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' }, error: { color: c.amber, fontSize: 10 },
  scrim: { flex: 1, backgroundColor: '#000B', alignItems: 'center', justifyContent: 'center', padding: 24 }, dialog: { width: '100%', maxWidth: 440, backgroundColor: c.panel, borderColor: c.edge, borderWidth: 1, borderRadius: 14, padding: 18, gap: 16 }, sessionItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: c.edge, gap: 5 },
});
