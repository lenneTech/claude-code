import { Module } from '@nestjs/common';

import { PaymentService } from './payment.service.js';

/**
 * Payment module
 */
@Module({
  exports: [PaymentService],
  providers: [PaymentService],
})
export class PaymentModule {}
