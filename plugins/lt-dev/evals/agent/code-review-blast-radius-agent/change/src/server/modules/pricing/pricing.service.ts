import { Injectable } from '@nestjs/common';

import { roundEuros } from '../../common/helpers/money.helper';

/**
 * Anything with a net price and a tax rate
 */
export interface PricedItem {
  net: number;
  taxRate: number;
}

/**
 * Price calculations shared by the cart, the catalog and invoicing
 */
@Injectable()
export class PricingService {
  /**
   * Converts a euro amount to whole cents
   *
   * @deprecated Use toCents() from common/helpers/money.helper, which also rejects NaN and Infinity. Kept until the
   * CSV price import is migrated.
   */
  centsOf(euros: number): number {
    return Math.round(euros * 100);
  }

  /**
   * Gross price in whole cents, so sums of prices carry no floating-point error
   */
  grossPrice(net: number, taxRate: number): number {
    return this.centsOf(net * (1 + taxRate));
  }

  /**
   * Tax share of a net price in euros, rounded to two decimals
   */
  taxAmount(net: number, taxRate: number): number {
    return roundEuros(net * taxRate);
  }
}
