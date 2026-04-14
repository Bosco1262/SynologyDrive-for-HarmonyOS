export interface SpeedLimiter {
  throttle(bytes: number): Promise<void>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class FixedRateSpeedLimiter implements SpeedLimiter {
  constructor(private readonly bytesPerSecond?: number) {}

  async throttle(bytes: number): Promise<void> {
    if (!this.bytesPerSecond || this.bytesPerSecond <= 0) {
      return;
    }
    const clampedBytes = Math.max(0, bytes);
    if (clampedBytes === 0) {
      return;
    }
    const delayMs = Math.ceil((clampedBytes / this.bytesPerSecond) * 1000);
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
}

