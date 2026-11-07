import { Clock } from '../../src/common/clock/clock';

export class FixedClock implements Clock {
  private current: Date;

  constructor(now: Date | string) {
    this.current = new Date(now);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(now: Date | string): void {
    this.current = new Date(now);
  }
}
