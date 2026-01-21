export class RateLimiter {
  private sentCount = 0;
  private dailyLimit: number;
  private delayBetweenEmails: number;

  constructor(dailyLimit: number, delayMs: number = 2000) {
    this.dailyLimit = dailyLimit;
    this.delayBetweenEmails = delayMs;
  }

  canSend(): boolean {
    return this.sentCount < this.dailyLimit;
  }

  recordSent(): void {
    this.sentCount++;
  }

  getSentCount(): number {
    return this.sentCount;
  }

  getRemainingQuota(): number {
    return Math.max(0, this.dailyLimit - this.sentCount);
  }

  async waitForNextSlot(): Promise<void> {
    // Add random jitter (0-1 second) to avoid patterns
    const jitter = Math.random() * 1000;
    const delay = this.delayBetweenEmails + jitter;
    await this.sleep(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
