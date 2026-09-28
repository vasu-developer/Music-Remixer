import { useCallback, useEffect, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useFrameCallback } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { getAudioEngine } from '@/core/audio';

// One pending JS delivery per control. The UI retains the newest value while JS is busy.
export function useControlGesture(value: number, min: number, max: number,
  length: number, cap: number, horizontal: boolean, onChange: (value: number, seq?: number, tGesture?: number) => void,
  disabled = false, detent = false, traceLabel = 'control', relative = false) {
  const position = useSharedValue(value);
  const dragging = useSharedValue(false);
  const hasInteracted = useSharedValue(false);
  const lastCommit = useSharedValue(0);
  const pending = useSharedValue(false);
  const delivered = useSharedValue(0);
  const latest = useSharedValue({ value, revision: 0, final: false, time: 0 });
  const start = useSharedValue(value);
  const callback = useRef(onChange);
  callback.current = onChange;
  const labelRef = useRef(traceLabel);
  labelRef.current = traceLabel;
  const mounted = useRef(true);
  const summary = useRef({ count: 0, replaced: 0, maxAgeMs: 0, maxWakeDelayMs: 0, lastRevision: 0, lastReport: 0 });
  const commit = useCallback((scheduledAt: number) => {
    if (!mounted.current) return;
    // Read once on delivery, not when scheduling: stale positions never form a FIFO.
    const snapshot = latest.value;
    try {
      callback.current(snapshot.value);
      if (snapshot.final) getAudioEngine().flushControls?.();
      if (__DEV__) {
        const now = Date.now();
        const stats = summary.current;
        stats.count++;
        stats.maxWakeDelayMs = Math.max(stats.maxWakeDelayMs, now - scheduledAt);
        stats.replaced += Math.max(0, snapshot.revision - stats.lastRevision - 1);
        stats.lastRevision = snapshot.revision;
        stats.maxAgeMs = Math.max(stats.maxAgeMs, now - snapshot.time);
        if (now - stats.lastReport >= 2000) {
          console.log(`[CONTROL_STATS] control=${JSON.stringify(labelRef.current)} delivered=${stats.count} coalesced=${stats.replaced} maxLatestAgeMs=${stats.maxAgeMs} maxWakeDelayMs=${stats.maxWakeDelayMs} final=${snapshot.final}`);
          stats.count = stats.replaced = stats.maxAgeMs = stats.maxWakeDelayMs = 0;
          stats.lastReport = now;
        }
      }
    } finally {
      scheduleOnUI((revision: number) => {
        'worklet';
        delivered.value = revision;
        pending.value = false;
      }, snapshot.revision);
    }
  }, [latest, delivered, pending]);
  useFrameCallback(() => {
    'worklet';
    const snapshot = latest.value;
    const now = Date.now();
    if (!pending.value && snapshot.revision > delivered.value &&
        (snapshot.final || now - lastCommit.value >= 16)) {
      pending.value = true;
      lastCommit.value = now;
      scheduleOnRN(commit, now);
    }
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      // Flush the UI's latest value, including moves not yet sent to JS.
      // Finalize may have run on UI while its JS callback is still queued.
      const snapshot = latest.value;
      if (hasInteracted.value && snapshot.revision > delivered.value) callback.current(snapshot.value);
      getAudioEngine().flushControls?.();
      mounted.current = false;
    };
  }, [latest, hasInteracted]);
  useEffect(() => {
    scheduleOnUI((external: number) => {
      'worklet';
      if (!dragging.value && latest.value.revision === delivered.value) position.value = external;
    }, value);
  }, [value, position, dragging, latest, delivered]);
  const update = (next: number, final = false) => {
    'worklet';
    let v = Math.max(min, Math.min(max, next));
    if (detent && Math.abs(v) < (max - min) * 0.045) v = 0;
    position.value = v;
    latest.value = { value: v, revision: latest.value.revision + 1, final, time: Date.now() };
  };
  const gesture = Gesture.Pan().enabled(!disabled).minDistance(0)
    .onStart((e) => {
      dragging.value = true;
      hasInteracted.value = true;
      const travel = Math.max(1, length - cap);
      const ratio = Math.max(0, Math.min(1, ((horizontal ? e.x : e.y) - cap / 2) / travel));
      update(relative ? position.value : min + (horizontal ? ratio : 1 - ratio) * (max - min), false);
      start.value = position.value;
    })
    .onUpdate((e) => {
      update(start.value + (horizontal ? e.translationX : -e.translationY) /
        Math.max(1, length - cap) * (max - min));
    })
    .onFinalize(() => {
      if (dragging.value) update(position.value, true);
      dragging.value = false;
    });
  return { position, dragging, gesture };
}
