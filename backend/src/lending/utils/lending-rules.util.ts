import { AppError, RuleReason } from '../../common/exceptions/app-error';

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MAX_COPIES = 100;

export function dueAt(checkedOutAt: Date, loanPeriodDays: number): Date {
  return new Date(checkedOutAt.getTime() + loanPeriodDays * DAY_MS);
}

/** On time up to and including the due instant; after it, every started day counts as one day late. */
export function daysLate(due: Date, at: Date): number {
  const late = at.getTime() - due.getTime();
  return late <= 0 ? 0 : Math.ceil(late / DAY_MS);
}

export function computeFine(lateDays: number, finePerDayCents: number, maxFinePerLoanCents: number): number {
  return Math.min(lateDays * finePerDayCents, maxFinePerLoanCents);
}

export function isBlocked(balanceCents: number, thresholdCents: number): boolean {
  return balanceCents > thresholdCents;
}

export function assertNotBlocked(balanceCents: number, thresholdCents: number): void {
  if (isBlocked(balanceCents, thresholdCents)) {
    throw AppError.rule(
      RuleReason.BORROWING_BLOCKED,
      'Unpaid fines are over the limit. Pay at the desk to borrow again.',
      { balanceCents, thresholdCents },
    );
  }
}

export function holdExpiresAt(start: Date, reservationHoldHours: number): Date {
  return new Date(start.getTime() + reservationHoldHours * HOUR_MS);
}

/** A hold is expired from the exact instant it expires. */
export function isHoldExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/** Lowest copy number in 1..totalCopies that is not taken, or null when every copy is taken. */
export function lowestFreeCopy(totalCopies: number, taken: Iterable<number>): number | null {
  const used = new Set(taken);
  for (let copy = 1; copy <= totalCopies; copy++) {
    if (!used.has(copy)) return copy;
  }
  return null;
}

export function copiesAbove(copies: number[], totalCopies: number): number[] {
  return copies.filter((c) => c > totalCopies).sort((a, b) => a - b);
}
