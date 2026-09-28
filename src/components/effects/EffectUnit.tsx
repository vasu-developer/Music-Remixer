import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EffectType } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { TactileButton } from '@/components/common/TactileButton';

export interface EffectUnitProps {
  type: EffectType;
  title: string;
  enabled: boolean;
  onToggle: () => void;
  accentColor?: string;
  children: React.ReactNode;
}

export const EffectUnit: React.FC<EffectUnitProps> = ({
  type,
  title,
  enabled,
  onToggle,
  accentColor = DJColors.deckA,
  children,
}) => {
  return (
    <View
      style={[
        styles.container,
        {
          borderColor: enabled ? accentColor : DJColors.borderSubtle,
          backgroundColor: DJColors.surfaceInset,
        },
      ]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: enabled ? accentColor : DJColors.textSecondary }]}>
          {title}
        </Text>
        <TactileButton
          label={enabled ? 'ON' : 'OFF'}
          size="small"
          isActive={enabled}
          onPress={onToggle}
          style={styles.powerButton}
          labelStyle={styles.powerLabel}
          accessibilityLabel={`Toggle ${title} effect`}
        />
      </View>

      <View style={[styles.content, { opacity: enabled ? 1.0 : 0.65 }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    borderWidth: 1,
    padding: 6,
    flex: 1,
    minWidth: 140,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
    paddingBottom: 4,
    marginBottom: 4,
  },
  title: {
    fontFamily: DJFonts.condensed,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  powerButton: {
    minHeight: 20,
    minWidth: 34,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  powerLabel: {
    fontSize: 8.5,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
