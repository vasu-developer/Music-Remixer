import { CrossfaderCurve, DeckId } from '@/types';

/** Smooth = equal power; linear = equal amplitude; cut = 5% edge fade. */
export function crossfaderGain(position: number, deck: DeckId, curve: CrossfaderCurve): number {
  const x = (Math.max(-1, Math.min(1, Number.isFinite(position) ? position : 0)) + 1) / 2;
  const amount = deck === 'A' ? 1 - x : x;
  if (curve === 'linear') return amount;
  if (curve === 'cut') return Math.min(1, amount / 0.05);
  return amount === 0 ? 0 : Math.sin(amount * Math.PI / 2);
}
