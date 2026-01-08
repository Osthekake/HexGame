/**
 * WakeLock manager to prevent screen from sleeping during active gameplay
 */
export class WakeLockManager {
  private wakeLock: WakeLockSentinel | null = null;
  private isSupported: boolean;

  constructor() {
    this.isSupported = 'wakeLock' in navigator;

    if (!this.isSupported) {
      console.warn('WakeLock API is not supported in this browser');
    }

    // Re-acquire wakelock when page becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.wakeLock !== null) {
        this.request();
      }
    });
  }

  /**
   * Request a wakelock to keep the screen on
   */
  async request(): Promise<void> {
    if (!this.isSupported) {
      return;
    }

    try {
      // Release existing lock if any
      await this.release();

      // Request new wakelock
      this.wakeLock = await navigator.wakeLock.request('screen');

      console.log('WakeLock acquired');

      // Handle wakelock release events
      this.wakeLock.addEventListener('release', () => {
        console.log('WakeLock released');
      });
    } catch (err) {
      console.error('Failed to acquire WakeLock:', err);
    }
  }

  /**
   * Release the wakelock and allow screen to sleep
   */
  async release(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
      } catch (err) {
        console.error('Failed to release WakeLock:', err);
      }
    }
  }

  /**
   * Check if wakelock is currently active
   */
  isActive(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }
}
