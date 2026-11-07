import { AppError, RuleReason } from '../../common/exceptions/app-error';
import {
  assertNotBlocked,
  computeFine,
  copiesAbove,
  DAY_MS,
  daysLate,
  dueAt,
  holdExpiresAt,
  isBlocked,
  isHoldExpired,
  lowestFreeCopy,
} from './lending-rules.util';

const due = new Date('2026-03-24T12:00:00.000Z');
const at = (ms: number) => new Date(due.getTime() + ms);

describe('lending rules', () => {
  it('T-UNIT-01: due date is the checkout instant plus the loan period in days', () => {
    expect(dueAt(new Date('2026-03-10T12:00:00Z'), 14).toISOString()).toBe('2026-03-24T12:00:00.000Z');
    expect(dueAt(new Date('2026-03-10T12:00:00Z'), 1).toISOString()).toBe('2026-03-11T12:00:00.000Z');
  });

  it('T-UNIT-02: days late counts every started day after the due instant', () => {
    expect(daysLate(due, at(-1))).toBe(0);
    expect(daysLate(due, due)).toBe(0);
    expect(daysLate(due, at(1))).toBe(1);
    expect(daysLate(due, at(DAY_MS))).toBe(1);
    expect(daysLate(due, at(DAY_MS + 1))).toBe(2);
    expect(daysLate(due, at(3 * DAY_MS))).toBe(3);
  });

  it('T-UNIT-03: the fine is days late times the daily fine, up to the cap', () => {
    expect(computeFine(0, 25, 1000)).toBe(0);
    expect(computeFine(3, 25, 1000)).toBe(75);
    expect(computeFine(40, 25, 1000)).toBe(1000);
    expect(computeFine(41, 25, 1000)).toBe(1000);
    expect(computeFine(5, 0, 1000)).toBe(0);
  });

  it('T-UNIT-04: borrowing is blocked only when the balance is over the threshold', () => {
    expect(isBlocked(1000, 1000)).toBe(false);
    expect(isBlocked(1001, 1000)).toBe(true);
    expect(isBlocked(0, 0)).toBe(false);
    expect(() => assertNotBlocked(1000, 1000)).not.toThrow();
    try {
      assertNotBlocked(1500, 1000);
      throw new Error('expected a rule error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).reason).toBe(RuleReason.BORROWING_BLOCKED);
      expect((error as AppError).details).toEqual({ balanceCents: 1500, thresholdCents: 1000 });
    }
  });

  it('T-UNIT-05: a hold lasts the window in hours and is expired from its exact end', () => {
    const end = holdExpiresAt(new Date('2026-03-10T12:00:00Z'), 48);
    expect(end.toISOString()).toBe('2026-03-12T12:00:00.000Z');
    expect(isHoldExpired(end, new Date(end.getTime() - 1))).toBe(false);
    expect(isHoldExpired(end, end)).toBe(true);
  });

  it('T-UNIT-06: the lowest free copy is chosen, or none when all are taken', () => {
    expect(lowestFreeCopy(3, [])).toBe(1);
    expect(lowestFreeCopy(3, [1, 3])).toBe(2);
    expect(lowestFreeCopy(3, [1, 2, 3])).toBeNull();
    expect(lowestFreeCopy(0, [])).toBeNull();
  });

  it('T-UNIT-07: copies above a lower count are the ones a change would remove', () => {
    expect(copiesAbove([4, 1, 3], 2)).toEqual([3, 4]);
    expect(copiesAbove([1, 2], 2)).toEqual([]);
  });
});
