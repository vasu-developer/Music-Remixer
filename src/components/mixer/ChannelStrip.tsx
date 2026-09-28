import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeckId, EQBand } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { RotaryKnob } from '@/components/common/RotaryKnob';
import { FaderSlider } from '@/components/common/FaderSlider';
import { VuMeter } from '@/components/common/VuMeter';
import { TactileButton } from '@/components/common/TactileButton';
import { useMixerStore } from '@/store/useMixerStore';
import { useDeckStore } from '@/store/useDeckStore';

export interface ChannelStripProps {
  deckId: DeckId;
}

export const ChannelStrip: React.FC<ChannelStripProps> = ({ deckId }) => {
  const isDeckA = deckId === 'A';
  const accentColor = isDeckA ? DJColors.deckA : DJColors.deckB;

  const eq = useMixerStore((s) => (isDeckA ? s.eqA : s.eqB));
  const setEQ = useMixerStore((s) => s.setEQ);
  const toggleEQKill = useMixerStore((s) => s.toggleEQKill);
  const resetEQ = useMixerStore((s) => s.resetEQ);
  const isCueActive = useMixerStore((s) => (isDeckA ? s.cueA : s.cueB));
  const toggleCue = useMixerStore((s) => s.toggleCue);

  const deck = useDeckStore(useShallow((s) => { const d = isDeckA ? s.deckA : s.deckB; return { volume: d.volume, gain: d.gain }; }));
  const setVolume = useDeckStore((s) => s.setVolume);
  const setGain = useDeckStore((s) => s.setGain);

  const renderEQBand = (band: EQBand, label: string) => {
    const isKilled = eq[`${band}Kill`];
    const value = eq[band];

    return (
      <View style={styles.eqBandRow} key={band}>
        <RotaryKnob
          label={label}
          value={value}
          min={-1.0}
          max={1.0}
          onChange={(val) => setEQ(deckId, band, val)}
          accentColor={accentColor}
          size={42}
        />
        <TactileButton
          label="KILL"
          variant="kill"
          size="small"
          isActive={isKilled}
          onPress={() => toggleEQKill(deckId, band)}
          style={styles.killButton}
          accessibilityLabel={`Kill ${label} EQ on Deck ${deckId}`}
        />
      </View>
    );
  };

  return (
    <View style={styles.channelContainer}>
      <View style={styles.channelHeader}>
        <Text style={[styles.channelTitle, { color: accentColor }]}>CH {deckId}</Text>
        <TactileButton
          label="RST"
          size="small"
          onPress={() => resetEQ(deckId)}
          style={styles.resetBtn}
          accessibilityLabel={`Reset EQ for Deck ${deckId}`}
        />
      </View>

      <View style={styles.gainWrapper}>
        <RotaryKnob
          label="TRIM"
          value={deck.gain}
          min={0.0}
          max={1.0}
          onChange={(val) => setGain(deckId, val)}
          accentColor={accentColor}
          size={38}
        />
      </View>

      <View style={styles.eqSection}>
        {renderEQBand('high', 'HI')}
        {renderEQBand('mid', 'MID')}
        {renderEQBand('low', 'LOW')}
      </View>

      <TactileButton
        variant="cue"
        size="small"
        isActive={isCueActive}
        onPress={() => toggleCue(deckId)}
        style={styles.headphoneCueBtn}
        accessibilityLabel={`Cue Deck ${deckId} to headphones`}>
        <Ionicons
          name="headset"
          size={14}
          color={isCueActive ? DJColors.cue : DJColors.textSecondary}
        />
        <Text style={[styles.cueBtnText, { color: isCueActive ? DJColors.cue : DJColors.textSecondary }]}>
          CUE
        </Text>
      </TactileButton>

      <View style={styles.faderVuSection}>
        <FaderSlider
          value={deck.volume}
          min={0.0}
          max={1.0}
          orientation="vertical"
          length={110}
          onChange={(val, seq, tGesture) => {
            setVolume(deckId, val, seq, tGesture);
          }}
          accentColor={accentColor}
        />
        <VuMeter source={isDeckA ? 'channelVuA' : 'channelVuB'} height={104} segmentsCount={10} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  channelContainer: {
    backgroundColor: DJColors.surfaceInset,
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
    paddingBottom: 4,
  },
  channelTitle: {
    fontFamily: DJFonts.condensed,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  resetBtn: {
    minHeight: 20,
    minWidth: 32,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  gainWrapper: {
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
  },
  eqSection: {
    gap: 4,
    alignItems: 'center',
  },
  eqBandRow: {
    alignItems: 'center',
    gap: 2,
  },
  killButton: {
    minHeight: 18,
    minWidth: 36,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  headphoneCueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  cueBtnText: {
    fontFamily: DJFonts.condensed,
    fontSize: 10,
    fontWeight: '800',
  },
  faderVuSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 4,
  },
});

export default ChannelStrip;
