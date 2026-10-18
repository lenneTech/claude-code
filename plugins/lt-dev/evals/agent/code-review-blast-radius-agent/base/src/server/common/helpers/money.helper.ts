/**
 * Money helpers
 *
 * Amounts that leave the API (payments, stored invoice totals) are whole cents. Prices are entered as net euro
 * amounts with a tax rate such as 0.19.
 */

/**
 * Rounds a euro amount to two decimals
 */
export function roundEuros(euros: number): number {
  return Math.round(euros * 100) / 100;
}

/**
 * Converts a euro amount to whole cents. Rejects NaN and Infinity, which would otherwise be stored as amounts.
 */
export function toCents(euros: number): number {
  if (!Number.isFinite(euros)) {
    throw new RangeError(`Not a finite amount: ${euros}`);
  }
  return Math.round(euros * 100);
}
