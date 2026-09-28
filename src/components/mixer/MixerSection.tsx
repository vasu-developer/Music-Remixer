import { EqDeckPanel } from './EqDeckPanel';
import React, { useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeckId } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { VerticalScroller } from '@/components/common/VerticalScroller';
import { FaderSlider } from '@/components/common/FaderSlider';
import { VuMeter } from '@/components/common/VuMeter';
import { TactileButton } from '@/components/common/TactileButton';
import { Crossfader } from './Crossfader';
import { useMixerStore } from '@/store/useMixerStore';
import { useDeckStore } from '@/store/useDeckStore';

type ScrollerVisualProps = Omit<React.ComponentProps<typeof VerticalScroller>, 'value' | 'onChange'>;
type DeckControl = { deckId: DeckId; field: 'gain' | 'volume' };
function useDeckControl({ deckId, field }: DeckControl) {
  const value = useDeckStore((s) => (deckId === 'A' ? s.deckA : s.deckB)[field]);
  const onChange = useCallback((v: number, seq?: number, tGesture?: number) => {
    const store = useDeckStore.getState();
    if (field === 'volume') void store.setVolume(deckId, v, seq, tGesture);
    else void store.setGain(deckId, v);
  }, [deckId, field]);
  return { value, onChange };
}
const DeckScroller = React.memo(function DeckScroller({ deckId, field, ...props }: ScrollerVisualProps & DeckControl) {
  const control = useDeckControl({ deckId, field });
  return <VerticalScroller {...props} {...control} />;
});
const DeckFader = React.memo(function DeckFader({ deckId, field, ...props }:
  Omit<React.ComponentProps<typeof FaderSlider>, 'value' | 'onChange'> & DeckControl) {
  const control = useDeckControl({ deckId, field });
  return <FaderSlider {...props} {...control} traceLabel={`Deck ${deckId} ${field}`} />;
});
const MasterScroller = React.memo(function MasterScroller({ field, ...props }:
  ScrollerVisualProps & { field: 'masterVolume' | 'headphoneVolume' | 'cueMix' }) {
  const value = useMixerStore((s) => s[field]);
  const onChange = useCallback((v: number) => {
    const s = useMixerStore.getState();
    void (field === 'masterVolume' ? s.setMasterVolume : field === 'headphoneVolume' ? s.setHeadphoneVolume : s.setCueMix)(v);
  }, [field]);
  return <VerticalScroller {...props} value={value} onChange={onChange} />;
});

export const MixerSection: React.FC = () => {
  const { width } = useWindowDimensions();
  const resetEQ = useMixerStore((s) => s.resetEQ);
  const cueA = useMixerStore((s) => s.cueA);
  const cueB = useMixerStore((s) => s.cueB);
  const toggleCue = useMixerStore((s) => s.toggleCue);

  return (
    <View style={styles.container}>
      {/* Top Plate Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>HARDWARE MIXER</Text>
          <Text style={styles.modelNumber}>2-CHANNEL ISOLATOR CONSOLE</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.systemLed} />
          <Text style={styles.statusLabel}>DSP BUS ACTIVE</Text>
        </View>
      </View>

      {/* ROW 1: TRIM / GAIN Horizontal Row for Channel A, Master & Channel B */}
      <View style={styles.trimRow}>
        {/* Channel A Trim & Header */}
        <View style={styles.trimChannelBay}>
          <View style={styles.channelBadge}>
            <View style={[styles.channelLed, { backgroundColor: DJColors.deckA }]} />
            <Text style={[styles.channelTitle, { color: DJColors.deckA }]}>CH A</Text>
          </View>

          <DeckScroller
            label="TRIM"
            deckId="A" field="gain"
            min={0.0}
            max={1.0}
            bipolar={false}

            accentColor={DJColors.deckA}
            height={52}
            width={38}
            showValue={true}
            showTicks={true}
            accessibilityLabel="Channel A Trim Gain"
          />

          <TactileButton
            label="RST"
            size="small"
            onPress={() => resetEQ('A')}
            style={styles.rstBtn}
            labelStyle={styles.rstBtnText}
            accessibilityLabel="Reset Channel A EQ"
          />
        </View>

        {/* Master Center Header Marker */}
        <View style={styles.trimMasterBay}>
          <Text style={styles.masterTagTitle}>MASTER</Text>
          <View style={styles.outputStatusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.outputStatusText}>MST ON</Text>
          </View>
        </View>

        {/* Channel B Trim & Header */}
        <View style={styles.trimChannelBay}>
          <TactileButton
            label="RST"
            size="small"
            onPress={() => resetEQ('B')}
            style={styles.rstBtn}
            labelStyle={styles.rstBtnText}
            accessibilityLabel="Reset Channel B EQ"
          />

          <DeckScroller
            label="TRIM"
            deckId="B" field="gain"
            min={0.0}
            max={1.0}
            bipolar={false}

            accentColor={DJColors.deckB}
            height={52}
            width={38}
            showValue={true}
            showTicks={true}
            accessibilityLabel="Channel B Trim Gain"
          />

          <View style={styles.channelBadge}>
            <Text style={[styles.channelTitle, { color: DJColors.deckB }]}>CH B</Text>
            <View style={[styles.channelLed, { backgroundColor: DJColors.deckB }]} />
          </View>
        </View>
      </View>

      <View style={styles.toneSection}>
        <View style={styles.toneHeader}>
          <Text style={styles.toneTitle}>TONE CONTROL</Text>
          <Text style={styles.toneHint}>DRAG UP / DOWN · ±12 dB</Text>
        </View>
        <View style={[styles.toneCards, width >= 600 && { flexDirection: 'row' }]}>
          <EqDeckPanel deckId="A" />
          <EqDeckPanel deckId="B" />
        </View>
      </View>

      {/* ROW 3: CHANNEL FADERS, CUE BUTTONS & CENTER MASTER SECTION */}
      <View style={styles.fadersAndMasterRow}>
        {/* Left: Channel A Fader, Cue & Meter */}
        <View style={styles.channelFaderBay}>
          <Pressable
            onPress={() => toggleCue('A')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Cue Channel A to headphones"
            accessibilityState={{ selected: cueA }}
            style={({ pressed }) => [
              styles.cueButton,
              cueA && {
                borderColor: DJColors.cue,
                backgroundColor: '#072A42',
                shadowColor: DJColors.cue,
                shadowOpacity: 0.6,
                shadowRadius: 3,
                elevation: 2,
              },
              pressed && styles.cueButtonPressed,
            ]}>
            <View style={styles.cueInner}>
              <Ionicons
                name="headset"
                size={12}
                color={cueA ? DJColors.cue : DJColors.textSecondary}
              />
              <Text
                style={[
                  styles.cueBtnText,
                  { color: cueA ? DJColors.cue : DJColors.textSecondary },
                ]}>
                CUE A
              </Text>
            </View>
          </Pressable>

          <View style={styles.faderAndMeterGroup}>
            <DeckFader
              deckId="A" field="volume"
              min={0.0}
              max={1.0}
              orientation="vertical"
              length={105}

              accentColor={DJColors.deckA}
            />
            <VuMeter
              source="channelVuA"
              height={98}
              segmentsCount={12}
              showStereo={true}
              showLabels={true}
              showPeakClip={true}
              channelWidth={4}
            />
          </View>
        </View>

        {/* Center: Master Volume, Stereo L/R VU Meter & Headphone Monitor */}
        <View style={styles.masterBay}>
          <View style={styles.masterOutputRow}>
            <MasterScroller
              label="MST"
              field="masterVolume"
              min={0.0}
              max={1.0}
              bipolar={false}

              accentColor={DJColors.master}
              height={98}
              width={32}
              showValue={true}
              showTicks={true}
              accessibilityLabel="Master Output Level"
            />

            <View style={styles.masterVuBox}>
              <VuMeter
                source="masterVu"
                height={98}
                segmentsCount={12}
                showStereo={true}
                showLabels={true}
                showPeakClip={true}
                channelWidth={4}
              />
            </View>
          </View>

          {/* Headphone Monitor Scrollers */}
          <View style={styles.hpSection}>
            <Text style={styles.hpTitle}>MONITOR / HP</Text>
            <View style={styles.hpScrollersRow}>
              <MasterScroller
                label="HP"
                field="headphoneVolume"
                min={0.0}
                max={1.0}
                bipolar={false}

                accentColor={DJColors.cue}
                height={48}
                width={30}
                showValue={true}
                showTicks={false}
                accessibilityLabel="Headphone Volume"
              />
              <MasterScroller
                label="MIX"
                field="cueMix"
                min={0.0}
                max={1.0}
                bipolar={false}
                centerDetent={true}

                accentColor={DJColors.cue}
                height={48}
                width={30}
                showValue={true}
                showTicks={false}
                accessibilityLabel="Cue Mix Balance"
              />
            </View>
            <Text style={styles.cueMixSub}>CUE ◀ ▶ MST</Text>
          </View>
        </View>

        {/* Right: Channel B Fader, Cue & Meter */}
        <View style={styles.channelFaderBay}>
          <Pressable
            onPress={() => toggleCue('B')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Cue Channel B to headphones"
            accessibilityState={{ selected: cueB }}
            style={({ pressed }) => [
              styles.cueButton,
              cueB && {
                borderColor: DJColors.cue,
                backgroundColor: '#072A42',
                shadowColor: DJColors.cue,
                shadowOpacity: 0.6,
                shadowRadius: 3,
                elevation: 2,
              },
              pressed && styles.cueButtonPressed,
            ]}>
            <View style={styles.cueInner}>
              <Ionicons
                name="headset"
                size={12}
                color={cueB ? DJColors.cue : DJColors.textSecondary}
              />
              <Text
                style={[
                  styles.cueBtnText,
                  { color: cueB ? DJColors.cue : DJColors.textSecondary },
                ]}>
                CUE B
              </Text>
            </View>
          </Pressable>

          <View style={styles.faderAndMeterGroup}>
            <VuMeter
              source="channelVuB"
              height={98}
              segmentsCount={12}
              showStereo={true}
              showLabels={true}
              showPeakClip={true}
              channelWidth={4}
            />
            <DeckFader
              deckId="B" field="volume"
              min={0.0}
              max={1.0}
              orientation="vertical"
              length={105}

              accentColor={DJColors.deckB}
            />
          </View>
        </View>
      </View>

      {/* ROW 4: BOTTOM CENTERPIECE CROSSFADER */}
      <Crossfader />
    </View>
  );
};

export default MixerSection;

const styles = StyleSheet.create({
  toneSection: { gap: 10 },
  toneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', paddingHorizontal: 2 },
  toneTitle: { color: '#DDE6F2', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  toneHint: { color: '#748194', fontSize: 8, letterSpacing: .6 },
  toneCards: { gap: 12 },
  container: {
    backgroundColor: DJColors.surface,
    padding: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  headerLeft: {
    gap: 1,
  },
  title: {
    fontFamily: DJFonts.condensed,
    fontSize: 10.5,
    fontWeight: '900',
    color: DJColors.textPrimary,
    letterSpacing: 1.0,
  },
  modelNumber: {
    fontFamily: DJFonts.mono,
    fontSize: 7,
    fontWeight: '700',
    color: DJColors.textMuted,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DJColors.surfaceInset,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  systemLed: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: DJColors.sync,
    shadowColor: DJColors.sync,
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  statusLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 7.5,
    fontWeight: '800',
    color: DJColors.sync,
    letterSpacing: 0.4,
  },
  trimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: DJColors.surfaceInset,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  trimChannelBay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  channelLed: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  channelTitle: {
    fontFamily: DJFonts.condensed,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  rstBtn: {
    minHeight: 18,
    minWidth: 26,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#151921',
    borderColor: DJColors.borderSubtle,
  },
  rstBtnText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: DJColors.textMuted,
  },
  trimMasterBay: {
    alignItems: 'center',
    gap: 2,
  },
  masterTagTitle: {
    fontFamily: DJFonts.condensed,
    fontSize: 9.5,
    fontWeight: '900',
    color: DJColors.master,
    letterSpacing: 0.8,
  },
  outputStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0E1318',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#1D2A20',
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: DJColors.sync,
  },
  outputStatusText: {
    fontFamily: DJFonts.mono,
    fontSize: 6.5,
    fontWeight: '800',
    color: DJColors.sync,
  },
  mainEqBankContainer: {
    backgroundColor: DJColors.surfaceInset,
    padding: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    gap: 4,
  },
  eqBankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
  },
  eqBankChannelLabel: {
    fontFamily: DJFonts.condensed,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  eqBankSectionTitle: {
    fontFamily: DJFonts.mono,
    fontSize: 7,
    fontWeight: '800',
    color: DJColors.textMuted,
    letterSpacing: 0.5,
  },
  sixSliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  channelEqGroup: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    justifyContent: 'space-around',
  },
  eqSliderColumn: {
    alignItems: 'center',
    gap: 3,
  },
  eqCenterDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dividerNotch: {
    width: 4,
    height: 1,
    backgroundColor: DJColors.borderStrong,
  },
  dividerText: {
    fontFamily: DJFonts.mono,
    fontSize: 14,
    color: DJColors.borderStrong,
  },
  killButton: {
    width: 32,
    height: 18,
    backgroundColor: '#12161E',
    borderWidth: 1,
    borderColor: '#242C38',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  killButtonPressed: {
    backgroundColor: '#1E2530',
  },
  killInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  killLed: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  killLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 6.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  fadersAndMasterRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
    width: '100%',
  },
  channelFaderBay: {
    flex: 1,
    backgroundColor: DJColors.surfaceInset,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    padding: 4,
    alignItems: 'center',
    gap: 4,
  },
  cueButton: {
    width: '100%',
    height: 24,
    backgroundColor: '#141820',
    borderWidth: 1,
    borderColor: '#2A3340',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cueButtonPressed: {
    backgroundColor: '#1E2632',
  },
  cueInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cueBtnText: {
    fontFamily: DJFonts.condensed,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  faderAndMeterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
  },
  masterBay: {
    width: 82,
    backgroundColor: '#090B0E',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderStrong,
    padding: 3,
    alignItems: 'center',
    gap: 3,
  },
  masterOutputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    paddingVertical: 2,
  },
  masterVuBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
  },
  hpSection: {
    borderTopWidth: 1,
    borderTopColor: DJColors.borderSubtle,
    paddingTop: 3,
    gap: 2,
    alignItems: 'center',
    width: '100%',
  },
  hpTitle: {
    fontFamily: DJFonts.mono,
    fontSize: 6.5,
    fontWeight: '800',
    color: DJColors.textMuted,
    letterSpacing: 0.3,
  },
  hpScrollersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
  },
  cueMixSub: {
    fontFamily: DJFonts.mono,
    fontSize: 5.5,
    color: DJColors.textMuted,
    letterSpacing: 0.2,
  },
});
