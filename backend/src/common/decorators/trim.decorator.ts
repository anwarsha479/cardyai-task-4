import { Transform } from 'class-transformer';

/** Trims strings; leaves other values untouched so type validators still report them. */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Trims strings and turns an empty optional text into null. */
export const TrimToNull = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
