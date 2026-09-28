import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { DeckId } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { EffectUnit } from './EffectUnit';
import { RotaryKnob } from '@/components/common/RotaryKnob';
import { TactileButton } from '@/components/common/TactileButton';
import { useEffectsStore } from '@/store/useEffectsStore';

export const EffectsSection: React.FC = () => {
  const targetDeck = useEffectsStore((s) => s.targetDeck);
  const setTargetDeck = useEffectsStore((s) => s.setTargetDeck);
  const activeAccent =
    targetDeck === 'A'
      ? DJColors.deckA
      : targetDeck === 'B'
      ? DJColors.deckB
      : DJColors.master;

  const targets: (DeckId | 'master')[] = ['A', 'B', 'master'];
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>DSP EFFECTS RACK</Text>
          <Text style={styles.subtitle}>REAL-TIME MULTI-FX PROCESSOR</Text>
        </View>

        <View style={styles.targetButtonGroup}>
          <Text style={styles.assignLabel}>ROUTE TO:</Text>
          {targets.map((t) => (
            <TactileButton
              key={t}
              label={t === 'master' ? 'MST' : `DECK ${t}`}
              size="small"
              isActive={targetDeck === t}
              onPress={() => setTargetDeck(t)}
              style={styles.targetBtn}
              labelStyle={styles.targetBtnLabel}
              accessibilityLabel={`Route effects to ${t === 'master' ? 'Master' : `Deck ${t}`}`}
            />
          ))}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.fxUnitsRow}>
        <FilterControls activeAccent={activeAccent} />

        <EchoControls activeAccent={activeAccent} />

        <ReverbControls activeAccent={activeAccent} />

        <StutterControls activeAccent={activeAccent} />
      </ScrollView>
    </View>
  );
};

const FilterControls = React.memo(function FilterControls({ activeAccent }: { activeAccent: string }) {
  const filter = useEffectsStore((s) => s.filter);
  const setFilterParams = useEffectsStore((s) => s.setFilterParams);
  const toggleEffect = useEffectsStore((s) => s.toggleEffect);
  return (
        <EffectUnit
          type="filter"
          title="BI-QUAD FILTER"
          enabled={filter.enabled}
          onToggle={() => toggleEffect('filter')}
          accentColor={activeAccent}>
          <View style={styles.fxControlsRow}>
            <RotaryKnob
              label="HPF / LPF"
              value={filter.params.cutoff}
              min={0.0}
              max={1.0}
              displayValue={
                filter.params.cutoff < 0.45
                  ? `LP ${Math.round(filter.params.cutoff * 2000)}Hz`
                  : filter.params.cutoff > 0.55
                  ? `HP ${Math.round(filter.params.cutoff * 5000)}Hz`
                  : 'FLAT'
              }
              onChange={(val) => setFilterParams({ cutoff: val })}
              accentColor={activeAccent}
              size={40}
            />
            <RotaryKnob
              label="RESONANCE"
              value={filter.params.resonance}
              min={0.0}
              max={1.0}
              onChange={(val) => setFilterParams({ resonance: val })}
              accentColor={activeAccent}
              size={40}
            />
            <RotaryKnob
              label="DRY/WET"
              value={filter.params.dryWet}
              min={0.0}
              max={1.0}
              onChange={(val) => setFilterParams({ dryWet: val })}
              accentColor={activeAccent}
              size={40}
            />
          </View>
        </EffectUnit>
  );
});

const EchoControls = React.memo(function EchoControls({ activeAccent }: { activeAccent: string }) {
  const echo = useEffectsStore((s) => s.echo);
  const setEchoParams = useEffectsStore((s) => s.setEchoParams);
  const toggleEffect = useEffectsStore((s) => s.toggleEffect);
  const echoBeats = [0.25, 0.5, 0.75, 1.0];
  return (
        <EffectUnit
          type="echo"
          title="TAPE ECHO DELAY"
          enabled={echo.enabled}
          onToggle={() => toggleEffect('echo')}
          accentColor={activeAccent}>
          <View style={styles.fxControlsRow}>
            <View style={styles.beatsColumn}>
              <Text style={styles.miniLabel}>BEATS</Text>
              <View style={styles.beatsGrid}>
                {echoBeats.map((b) => (
                  <TactileButton
                    key={b}
                    label={b === 0.25 ? '1/4' : b === 0.5 ? '1/2' : b === 0.75 ? '3/4' : '1'}
                    size="small"
                    isActive={echo.params.beats === b}
                    onPress={() => setEchoParams({ beats: b })}
                    style={styles.beatBtn}
                    labelStyle={styles.beatBtnText}
                    accessibilityLabel={`Echo time: ${b} beats`}
                  />
                ))}
              </View>
            </View>

            <RotaryKnob
              label="FEEDBACK"
              value={echo.params.feedback}
              min={0.0}
              max={0.9}
              onChange={(val) => setEchoParams({ feedback: val })}
              accentColor={activeAccent}
              size={40}
            />
            <RotaryKnob
              label="DRY/WET"
              value={echo.params.dryWet}
              min={0.0}
              max={1.0}
              onChange={(val) => setEchoParams({ dryWet: val })}
              accentColor={activeAccent}
              size={40}
            />
          </View>
        </EffectUnit>
  );
});

const ReverbControls = React.memo(function ReverbControls({ activeAccent }: { activeAccent: string }) {
  const reverb = useEffectsStore((s) => s.reverb);
  const setReverbParams = useEffectsStore((s) => s.setReverbParams);
  const toggleEffect = useEffectsStore((s) => s.toggleEffect);
  return (
        <EffectUnit
          type="reverb"
          title="SPACE REVERB"
          enabled={reverb.enabled}
          onToggle={() => toggleEffect('reverb')}
          accentColor={activeAccent}>
          <View style={styles.fxControlsRow}>
            <RotaryKnob
              label="ROOM SIZE"
              value={reverb.params.size}
              min={0.0}
              max={1.0}
              onChange={(val) => setReverbParams({ size: val })}
              accentColor={activeAccent}
              size={40}
            />
            <RotaryKnob
              label="DECAY"
              value={reverb.params.decay}
              min={0.0}
              max={1.0}
              onChange={(val) => setReverbParams({ decay: val })}
              accentColor={activeAccent}
              size={40}
            />
            <RotaryKnob
              label="DRY/WET"
              value={reverb.params.dryWet}
              min={0.0}
              max={1.0}
              onChange={(val) => setReverbParams({ dryWet: val })}
              accentColor={activeAccent}
              size={40}
            />
          </View>
        </EffectUnit>
  );
});

const StutterControls = React.memo(function StutterControls({ activeAccent }: { activeAccent: string }) {
  const stutter = useEffectsStore((s) => s.stutter);
  const setStutterParams = useEffectsStore((s) => s.setStutterParams);
  const toggleEffect = useEffectsStore((s) => s.toggleEffect);
  const stutterDivisions: ('1/4' | '1/8' | '1/16' | '1/32')[] = ['1/4', '1/8', '1/16', '1/32'];
  return (
        <EffectUnit
          type="stutter"
          title="STUTTER ROLL"
          enabled={stutter.enabled}
          onToggle={() => toggleEffect('stutter')}
          accentColor={activeAccent}>
          <View style={styles.fxControlsRow}>
            <View style={styles.beatsColumn}>
              <Text style={styles.miniLabel}>DIV</Text>
              <View style={styles.beatsGrid}>
                {stutterDivisions.map((div) => (
                  <TactileButton
                    key={div}
                    label={div}
                    size="small"
                    isActive={stutter.params.division === div}
                    onPress={() => setStutterParams({ division: div })}
                    style={styles.beatBtn}
                    labelStyle={styles.beatBtnText}
                    accessibilityLabel={`Stutter division: ${div}`}
                  />
                ))}
              </View>
            </View>

            <View style={styles.holdPadBox}>
              <TactileButton
                label="HOLD ROLL"
                size="standard"
                isActive={stutter.params.isHeld}
                onPressIn={() => setStutterParams({ isHeld: true })}
                onPressOut={() => setStutterParams({ isHeld: false })}
                style={styles.holdPad}
                labelStyle={styles.holdPadText}
                accessibilityLabel="Momentary stutter roll hold"
              />
            </View>

            <RotaryKnob
              label="DRY/WET"
              value={stutter.params.dryWet}
              min={0.0}
              max={1.0}
              onChange={(val) => setStutterParams({ dryWet: val })}
              accentColor={activeAccent}
              size={40}
            />
          </View>
        </EffectUnit>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: DJColors.surface,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
    paddingBottom: 4,
  },
  title: {
    fontFamily: DJFonts.condensed,
    fontSize: 10,
    fontWeight: '900',
    color: DJColors.textSecondary,
    letterSpacing: 1.0,
  },
  subtitle: {
    fontFamily: DJFonts.mono,
    fontSize: 7.5,
    color: DJColors.textMuted,
  },
  targetButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 8,
    fontWeight: '700',
    color: DJColors.textMuted,
    marginRight: 2,
  },
  targetBtn: {
    minHeight: 22,
    minWidth: 42,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  targetBtnLabel: {
    fontSize: 8.5,
  },
  fxUnitsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  fxControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  beatsColumn: {
    alignItems: 'center',
    gap: 2,
  },
  miniLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 8,
    color: DJColors.textMuted,
    fontWeight: '700',
  },
  beatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 60,
    gap: 2,
  },
  beatBtn: {
    minHeight: 18,
    width: 28,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  beatBtnText: {
    fontSize: 7.5,
  },
  holdPadBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdPad: {
    minHeight: 38,
    paddingHorizontal: 8,
  },
  holdPadText: {
    fontSize: 9,
    fontWeight: '900',
  },
});
