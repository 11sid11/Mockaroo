// timer.js — countdown timer for timed mocks.

export class Timer {
  constructor({ seconds, onTick, onExpire }) {
    this.totalSeconds = seconds;
    this.remaining = seconds;
    this.onTick = onTick || (() => {});
    this.onExpire = onExpire || (() => {});
    this._handle = null;
    this._lastTick = 0;
  }
  start() {
    if (this._handle) return;
    this._lastTick = performance.now();
    this._handle = setInterval(() => {
      const now = performance.now();
      const delta = (now - this._lastTick) / 1000;
      this._lastTick = now;
      this.remaining = Math.max(0, this.remaining - delta);
      this.onTick(this.remaining, this.totalSeconds);
      if (this.remaining <= 0) {
        this.stop();
        this.onExpire();
      }
    }, 250);
  }
  stop() {
    if (this._handle) {
      clearInterval(this._handle);
      this._handle = null;
    }
  }
  pause() { this.stop(); }
  resume() { this.start(); }
  isRunning() { return this._handle != null; }
  static format(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
}