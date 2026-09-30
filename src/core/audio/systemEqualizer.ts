// Parameter IDs are shared with MasterDsp.h. Units are dB except balance,
// width, limiter and enabled. These affect Remixer's own output, not other apps.
export const MASTER_DEFAULTS = [0, 0, 0, 0, 1, 1, ...Array<number>(10).fill(0), 0];
export const EQ_FREQUENCIES = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
export function clampMasterValue(index: number, value: number): number {
  if (!Number.isInteger(index) || index < 0 || index > 16 || !Number.isFinite(value)) throw new Error('Invalid sound control');
  if (index === 5 || index === 16) return value >= .5 ? 1 : 0;
  const min = index === 3 ? -1 : index === 4 ? 0 : -12;
  const max = index === 3 ? 1 : index === 4 ? 2 : 12;
  return Math.max(min, Math.min(max, value));
}
