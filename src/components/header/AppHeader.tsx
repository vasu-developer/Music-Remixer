import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DJColors, DJFonts } from '@/constants/theme';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { VuMeter } from '@/components/common/VuMeter';

export const AppHeader: React.FC = () => {
  const router = useRouter();
  const engineStatus = usePlaybackStore((s) => s.engineStatus);
  const sampleRate = usePlaybackStore((s) => s.sampleRate);
  const bufferLatencyMs = usePlaybackStore((s) => s.bufferLatencyMs);
  const cpuLoadPercent = usePlaybackStore((s) => s.cpuLoadPercent);

  const isEngineReady = engineStatus === 'ready' || engineStatus === 'active';

  return (
    <View style={styles.headerContainer}>
      {/* Brand logo & title */}
      <View style={styles.brandSection}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>✕</Text>
        </View>
        <View>
          <Text style={styles.appName}>REMIXER</Text>
          <Text style={styles.appSub}>PRO DJ CONSOLE</Text>
        </View>
      </View>

      {/* Audio Status Indicator */}
      <View style={styles.statusSection} accessible={true} accessibilityLabel={`Audio engine status: ${engineStatus}`}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.ledDot,
              {
                backgroundColor: isEngineReady ? DJColors.sync : DJColors.master,
                shadowColor: isEngineReady ? DJColors.sync : DJColors.master,
              },
            ]}
          />
          <Text style={styles.statusText}>
            {isEngineReady ? 'DSP READY' : 'OFFLINE'}
          </Text>
        </View>
        <Text style={styles.statsMetrics}>
          {sampleRate / 1000}kHz • {bufferLatencyMs.toFixed(1)}ms • CPU {cpuLoadPercent.toFixed(0)}%
        </Text>
      </View>

      {/* Master VU preview & Settings button */}
      <View style={styles.rightSection}>
        <View style={styles.miniVuWrapper}>
          <VuMeter source="masterVu" height={24} segmentsCount={6} />
          <Text style={styles.miniVuLabel}>MST</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.settingsButton,
            pressed && styles.settingsButtonPressed,
          ]}
          onPress={() => router.push('/settings')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Open Settings">
          <Ionicons name="settings-outline" size={20} color={DJColors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    height: 54,
    backgroundColor: DJColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 20,
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 3,
    backgroundColor: DJColors.surfaceRaised,
    borderColor: DJColors.deckA,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    color: DJColors.deckA,
    fontSize: 14,
    fontWeight: '900',
  },
  appName: {
    fontFamily: DJFonts.condensed,
    fontSize: 16,
    fontWeight: '900',
    color: DJColors.textPrimary,
    letterSpacing: 2.0,
  },
  appSub: {
    fontFamily: DJFonts.mono,
    fontSize: 7.5,
    fontWeight: '700',
    color: DJColors.textMuted,
    letterSpacing: 1.0,
  },
  statusSection: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DJColors.surfaceInset,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ledDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 2,
  },
  statusText: {
    fontFamily: DJFonts.condensed,
    fontSize: 10,
    fontWeight: '800',
    color: DJColors.textPrimary,
    letterSpacing: 0.8,
  },
  statsMetrics: {
    fontFamily: DJFonts.mono,
    fontSize: 8.5,
    color: DJColors.textMuted,
    marginTop: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniVuWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniVuLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 8,
    color: DJColors.textMuted,
    fontWeight: '700',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: DJColors.surfaceRaised,
    borderColor: DJColors.borderSubtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonPressed: {
    backgroundColor: DJColors.borderHighlight,
  },
});
