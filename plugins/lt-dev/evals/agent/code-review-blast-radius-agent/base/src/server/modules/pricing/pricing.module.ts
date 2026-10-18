import { Module } from '@nestjs/common';

import { PricingService } from './pricing.service';

/**
 * Pricing module
 */
@Module({
  exports: [PricingService],
  providers: [PricingService],
})
export class PricingModule {}
