import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const consoleColors = { bg: '#10091B', panel: '#20132F', edge: '#49305F', text: '#E6EDF6', muted: '#A897C0', cyan: '#C18BFF', amber: '#51F3D0' };
export function ConsoleButton({ label, onPress, active = false, disabled = false, color = consoleColors.cyan, accessibilityLabel = label }: {
  label: string; onPress: () => void; active?: boolean; disabled?: boolean; color?: string; accessibilityLabel?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.button, active && { backgroundColor: `${color}19`, borderColor: `${color}88` }, { opacity: disabled ? .3 : pressed ? .6 : 1 }]}>
    <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[ui.buttonText, active && { color }]}>{label}</Text>
  </Pressable>;
}
export function SectionLabel({ title, detail }: { title: string; detail?: string }) {
  return <View style={ui.sectionHeader}><Text maxFontSizeMultiplier={1.2} style={ui.sectionTitle}>{title}</Text>{detail && <Text maxFontSizeMultiplier={1.2} style={ui.detail}>{detail}</Text>}</View>;
}
export const ui = StyleSheet.create({
  panel: { backgroundColor: consoleColors.panel, borderColor: consoleColors.edge, borderWidth: 1, borderRadius: 14, padding: 12, gap: 8, minWidth: 0 },
  button: { flex: 1, minHeight: 44, borderRadius: 6, backgroundColor: '#302044', borderWidth: 1, borderColor: '#583976', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  buttonText: { color: '#B9C8D8', fontSize: 9, fontWeight: '800', letterSpacing: .5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  sectionTitle: { color: '#B9C8D8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  detail: { color: consoleColors.muted, fontSize: 8, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 6 },
});
