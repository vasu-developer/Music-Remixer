/** Debug timestamps are JS handler times, not hardware touch or audible-output times. */
export interface ControlTrace { id: string; tClick: number }
let sequence = 0;
const session = Date.now().toString(36);
export function createControlTrace(): ControlTrace {
  return { id: `${session}-${++sequence}`, tClick: Date.now() };
}
export function logControlTrace(trace: ControlTrace | undefined, stage: string, detail: string) {
  if (!trace || typeof __DEV__ === 'undefined' || !__DEV__) return;
  const now = Date.now();
  console.log(`[${stage.startsWith('UI_') ? 'CLICK_TRACE' : 'ACTION_TRACE'}] id=${trace.id} stage=${stage} t=${now} deltaFromClick=${now - trace.tClick}ms ${detail}`);
}
