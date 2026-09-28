import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getAudioEngine } from '@/core/audio';
import { CrossfaderCurve } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { FaderSlider } from '@/components/common/FaderSlider';
import { TactileButton } from '@/components/common/TactileButton';
import { useMixerStore } from '@/store/useMixerStore';

export const Crossfader: React.FC = () => {
  const [sliderWidth, setSliderWidth] = useState(220);
  const crossfader = useMixerStore((s) => s.crossfader);
  const setCrossfader = useMixerStore((s) => s.setCrossfader);
  const curve = useMixerStore((s) => s.crossfaderCurve);
  const setCurve = useMixerStore((s) => s.setCrossfaderCurve);

  const snap = (value: number) => {
    void setCrossfader(value);
    getAudioEngine().flushControls?.();
  };
  const curves: CrossfaderCurve[] = ['linear', 'cut', 'smooth'];

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.deckTag}>
          <Text style={[styles.deckLetter, { color: DJColors.deckA }]}>DECK A</Text>
        </View>

        <View style={styles.curveButtonGroup}>
          {curves.map((c) => (
            <TactileButton
              key={c}
              label={c.toUpperCase()}
              size="small"
              isActive={curve === c}
              onPress={() => setCurve(c)}
              style={styles.curveBtn}
              labelStyle={styles.curveBtnLabel}
              accessibilityLabel={`Crossfader curve: ${c}`}
            />
          ))}
        </View>

        <View style={styles.deckTag}>
          <Text style={[styles.deckLetter, { color: DJColors.deckB }]}>DECK B</Text>
        </View>
      </View>

      <View style={styles.sliderRow} onLayout={(e) => setSliderWidth(Math.min(220, e.nativeEvent.layout.width))}>
        <FaderSlider
          value={crossfader}
          min={-1.0}
          max={1.0}
          orientation="horizontal"
          length={sliderWidth}
          trackThickness={10}
          onChange={setCrossfader}
          accentColor={crossfader < 0 ? DJColors.deckA : DJColors.deckB}
          label=""
        />
      </View>

      <View style={styles.snapRow}>
        <TactileButton
          label="◀ FULL A"
          size="small"
          onPress={() => snap(-1.0)}
          style={styles.snapBtn}
          accessibilityLabel="Snap crossfader to Deck A"
        />
        <TactileButton
          label="CENTER"
          size="small"
          isActive={Math.abs(crossfader) < 0.05}
          onPress={() => snap(0.0)}
          style={styles.snapBtn}
          accessibilityLabel="Center crossfader"
        />
        <TactileButton
          label="FULL B ▶"
          size="small"
          onPress={() => snap(1.0)}
          style={styles.snapBtn}
          accessibilityLabel="Snap crossfader to Deck B"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DJColors.surfaceRaised,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  deckTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: DJColors.surfaceInset,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  deckLetter: {
    fontFamily: DJFonts.condensed,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  curveButtonGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  curveBtn: {
    minHeight: 22,
    minWidth: 46,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  curveBtnLabel: {
    fontSize: 8.5,
  },
  sliderRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  snapRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  snapBtn: {
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});

export default Crossfader;
