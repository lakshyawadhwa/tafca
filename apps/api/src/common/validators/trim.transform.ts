import { Transform } from 'class-transformer';

/**
 * Trims surrounding whitespace before validation runs.
 *
 * @IsNotEmpty() does not trim, so "   " passed every required-string check and
 * persisted as a blank-looking row. Applying this first means the emptiness
 * check sees the real content.
 */
export const TrimmedString = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
