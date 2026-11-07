import { Injectable } from '@nestjs/common';

/** Source of "now" for every business rule, replaceable in tests. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
