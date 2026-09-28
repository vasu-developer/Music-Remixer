/** One in-flight write + one replaceable pending value; never a FIFO of gestures. */
export class LatestValueWriter<T> {
  private pending: { value: T } | null = null;
  private desired: { value: T } | null = null;
  private inFlight = false;
  private urgent = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSent = -Infinity;
  private waiters: Array<() => void> = [];
  readonly stats = { requested: 0, sent: 0, replaced: 0, failed: 0, maxInFlight: 0 };

  constructor(private readonly write: (value: T) => Promise<unknown>,
    private readonly equals: (a: T, b: T) => boolean = Object.is,
    private readonly onError: (error: unknown) => void = () => {},
    private readonly intervalMs = 40) {}

  submit(value: T): void {
    this.stats.requested++;
    if (this.desired && this.equals(this.desired.value, value)) return;
    this.desired = { value };
    if (this.pending) this.stats.replaced++;
    this.pending = { value };
    this.schedule();
  }

  /** Bypass the cadence; if busy, this final value is the very next write. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.urgent = true;
    this.dispatch();
  }

  /** Drop obsolete work on track replacement. An already dispatched call drains. */
  clearPending(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = this.desired = null;
    this.urgent = false;
    this.resolveIdle();
  }

  isBusy(): boolean { return this.inFlight || this.pending !== null; }
  whenIdle(): Promise<void> {
    return this.isBusy() ? new Promise((resolve) => this.waiters.push(resolve)) : Promise.resolve();
  }

  private schedule(): void {
    if (this.inFlight || this.timer || !this.pending) return;
    if (this.urgent) { this.dispatch(); return; }
    const delay = Math.max(0, this.intervalMs - (Date.now() - this.lastSent));
    this.timer = setTimeout(() => { this.timer = null; this.dispatch(); }, delay);
  }

  private dispatch(): void {
    if (this.inFlight) return;
    if (!this.pending) { this.urgent = false; this.resolveIdle(); return; }
    const { value } = this.pending;
    this.pending = null;
    this.urgent = false;
    this.inFlight = true;
    this.lastSent = Date.now();
    this.stats.sent++;
    this.stats.maxInFlight = 1;
    let operation: Promise<unknown>;
    try { operation = this.write(value); }
    catch (error) { operation = Promise.reject(error); }
    void operation.catch((error) => {
      this.stats.failed++;
      // Allow the same value to be retried after a failed write.
      if (!this.pending) this.desired = null;
      this.onError(error);
    }).finally(() => {
      this.inFlight = false;
      this.schedule();
      this.resolveIdle();
    });
  }

  private resolveIdle(): void {
    if (this.isBusy()) return;
    for (const resolve of this.waiters.splice(0)) resolve();
  }
}
