import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';

import { ErrorCode } from '../../common/errors/project-errors.js';

/**
 * Client for the payment provider
 *
 * The provider call itself is not part of this trimmed project; the amount contract is.
 */
@Injectable()
export class PaymentService {
  protected readonly logger = new Logger(PaymentService.name);

  /**
   * Charges a customer
   *
   * @param customerId ID of the user who pays
   * @param amountCents Amount in whole cents, as the provider's API expects it (1999 = 19.99 EUR)
   */
  async charge(customerId: string, amountCents: number): Promise<void> {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new UnprocessableEntityException(ErrorCode.INVALID_AMOUNT);
    }
    this.logger.debug(`charge of ${amountCents} cents for user ${customerId}`);
    // Provider request omitted in this trimmed project
  }
}
