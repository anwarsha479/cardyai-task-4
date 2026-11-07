/** Business defaults and allowed ranges (FR-10). These are rules, not environment values. */
export const SETTING_DEFINITIONS = {
  loanPeriodDays: { defaultValue: 14, min: 1, max: 90 },
  finePerDayCents: { defaultValue: 25, min: 0, max: 10_000 },
  maxFinePerLoanCents: { defaultValue: 1000, min: 0, max: 100_000 },
  maxActiveLoans: { defaultValue: 5, min: 1, max: 20 },
  reservationHoldHours: { defaultValue: 48, min: 1, max: 336 },
  fineBlockThresholdCents: { defaultValue: 1000, min: 0, max: 100_000 },
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

export type Limits = Record<SettingKey, number>;

export function defaultLimits(): Limits {
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, SETTING_DEFINITIONS[k].defaultValue])) as Limits;
}
