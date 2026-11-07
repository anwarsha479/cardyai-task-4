const CURRENCY = import.meta.env.VITE_CURRENCY;
if (!CURRENCY) {
  throw new Error('VITE_CURRENCY is missing from the .env file');
}

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY });
const date = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function formatMoney(cents: number): string {
  return money.format(cents / 100);
}

export const CURRENCY_SYMBOL = money.formatToParts(0).find((p) => p.type === 'currency')?.value ?? CURRENCY;

/** Smallest currency unit per major unit, e.g. 100 cents per dollar. */
export const MINOR_UNITS = 10 ** (money.resolvedOptions().maximumFractionDigits ?? 2);

export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
