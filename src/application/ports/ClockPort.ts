// Time, named without the browser.

export interface Timer {
  cancel(): void;
}

export interface ClockPort {
  now(): number;
  setTimeout(callback: () => void, ms: number): Timer;
}
