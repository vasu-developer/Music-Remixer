import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DJColors, DJFonts } from '@/constants/theme';

export interface TabItem {
  id: string;
  label: string;
  route: '/' | '/library' | '/settings';
  icon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
  { id: 'mixer', label: 'MIXER', route: '/', icon: 'disc-outline' },
  { id: 'library', label: 'LIBRARY', route: '/library', icon: 'musical-notes-outline' },
  { id: 'settings', label: 'SETTINGS', route: '/settings', icon: 'settings-outline' },
];

export const BottomNavBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isCurrent = (route: string) => {
    if (route === '/') return pathname === '/' || pathname === '/index';
    return pathname.startsWith(route);
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(8, insets.bottom) }]}>
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const active = isCurrent(tab.route);
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                if (!active) {
                  router.dismissTo(tab.route);
                }
              }}
              style={({ pressed }) => [
                styles.tabItem,
                active && styles.tabItemActive,
                pressed && styles.tabItemPressed,
              ]}
              accessible={true}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${tab.label} tab`}>
              {active && <View style={styles.activeNotch} />}

              <Ionicons
                name={tab.icon}
                size={20}
                color={active ? DJColors.deckA : DJColors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? DJColors.deckA : DJColors.textSecondary },
                ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DJColors.surface,
    borderTopWidth: 1,
    borderTopColor: DJColors.borderSubtle,
    paddingTop: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    position: 'relative',
    minHeight: 48,
  },
  tabItemActive: {
    backgroundColor: DJColors.surfaceRaised,
  },
  tabItemPressed: {
    opacity: 0.8,
  },
  activeNotch: {
    position: 'absolute',
    top: 0,
    width: '40%',
    height: 2,
    backgroundColor: DJColors.deckA,
    borderRadius: 1,
  },
  tabLabel: {
    fontFamily: DJFonts.condensed,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
