import React, { useRef } from 'react';
import { ControlTrace, createControlTrace, logControlTrace } from '@/core/audio/controlTrace';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { DJColors, DJFonts, DJTouchTargets } from '@/constants/theme';

export interface TactileButtonProps {
  label?: string;
  children?: React.ReactNode;
  onPress?: (trace?: ControlTrace) => void;
  onPressIn?: (trace?: ControlTrace) => void;
  onPressOut?: (trace?: ControlTrace) => void;
  isActive?: boolean;
  variant?: 'default' | 'deckA' | 'deckB' | 'sync' | 'cue' | 'play' | 'kill';
  size?: 'small' | 'standard' | 'large';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  label,
  children,
  onPress,
  onPressIn,
  onPressOut,
  isActive = false,
  variant = 'default',
  size = 'standard',
  disabled = false,
  style,
  labelStyle,
  accessibilityLabel,
}) => {
  const activeTrace = useRef<ControlTrace | undefined>(undefined);
  const traceEvent = (stage: string, handler?: (trace?: ControlTrace) => void) => {
    if (!__DEV__) { handler?.(); return; }
    if (stage === 'UI_PRESS_IN' || !activeTrace.current) activeTrace.current = createControlTrace();
    const trace = activeTrace.current;
    logControlTrace(trace, stage, `control=${JSON.stringify(accessibilityLabel || label || variant)}`);
    if (stage === 'UI_PRESS') activeTrace.current = undefined;
    handler?.(trace);
  };
  const getVariantStyles = (pressed: boolean) => {
    switch (variant) {
      case 'deckA':
        return {
          borderColor: isActive ? DJColors.deckA : DJColors.borderSubtle,
          backgroundColor: isActive
            ? DJColors.deckADark
            : pressed
            ? DJColors.surfaceRaised
            : DJColors.surface,
          textColor: isActive ? DJColors.deckA : DJColors.textPrimary,
        };
      case 'deckB':
        return {
          borderColor: isActive ? DJColors.deckB : DJColors.borderSubtle,
          backgroundColor: isActive
            ? DJColors.deckBDark
            : pressed
            ? DJColors.surfaceRaised
            : DJColors.surface,
          textColor: isActive ? DJColors.deckB : DJColors.textPrimary,
        };
      case 'sync':
        return {
          borderColor: isActive ? DJColors.sync : DJColors.borderSubtle,
          backgroundColor: isActive
            ? '#083B1E'
            : pressed
            ? DJColors.surfaceRaised
            : DJColors.surface,
          textColor: isActive ? DJColors.sync : DJColors.textSecondary,
        };
      case 'cue':
        return {
          borderColor: isActive ? DJColors.cue : DJColors.borderStrong,
          backgroundColor: isActive
            ? '#0A3254'
            : pressed
            ? DJColors.surfaceRaised
            : DJColors.surface,
          textColor: isActive ? DJColors.cue : DJColors.textPrimary,
        };
      case 'play':
        return {
          borderColor: isActive ? DJColors.sync : DJColors.borderStrong,
          backgroundColor: isActive
            ? '#093B1F'
            : pressed
            ? DJColors.surfaceRaised
            : DJColors.surface,
          textColor: isActive ? DJColors.sync : DJColors.textPrimary,
        };
      case 'kill':
        return {
          borderColor: isActive ? DJColors.master : DJColors.borderSubtle,
          backgroundColor: isActive
            ? '#450D15'
            : pressed
            ? DJColors.surfaceRaised
            : DJColors.surfaceInset,
          textColor: isActive ? DJColors.master : DJColors.textMuted,
        };
      default:
        return {
          borderColor: isActive ? DJColors.borderHighlight : DJColors.borderSubtle,
          backgroundColor: isActive
            ? DJColors.surfaceRaised
            : pressed
            ? DJColors.surfaceInset
            : DJColors.surface,
          textColor: isActive ? DJColors.textPrimary : DJColors.textSecondary,
        };
    }
  };

  const getHeight = () => {
    switch (size) {
      case 'small':
        return DJTouchTargets.buttonSmall;
      case 'large':
        return DJTouchTargets.buttonLarge;
      default:
        return DJTouchTargets.buttonStandard;
    }
  };

  return (
    <Pressable
      onPress={() => traceEvent('UI_PRESS', onPress)}
      onPressIn={() => traceEvent('UI_PRESS_IN', onPressIn)}
      onPressOut={() => traceEvent('UI_PRESS_OUT', onPressOut)}
      disabled={disabled}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected: isActive, disabled }}
      style={({ pressed }) => {
        const vStyle = getVariantStyles(pressed);
        return [
          styles.button,
          {
            minHeight: getHeight(),
            minWidth: getHeight(),
            borderColor: vStyle.borderColor,
            backgroundColor: vStyle.backgroundColor,
            opacity: disabled ? 0.4 : 1.0,
          },
          isActive && styles.activeGlow,
          style,
        ];
      }}>
      {({ pressed }) => {
        const vStyle = getVariantStyles(pressed);
        if (children) return children;
        return (
          <Text
            style={[
              styles.label,
              { color: vStyle.textColor },
              size === 'small' && styles.smallLabel,
              size === 'large' && styles.largeLabel,
              labelStyle,
            ]}>
            {label}
          </Text>
        );
      }}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 4,
  },
  activeGlow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontFamily: DJFonts.condensed,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  smallLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  largeLabel: {
    fontSize: 15,
    letterSpacing: 1.0,
  },
});

export default TactileButton;
