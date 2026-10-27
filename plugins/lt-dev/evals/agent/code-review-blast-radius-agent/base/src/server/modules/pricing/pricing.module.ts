import { Module } from '@nestjs/common';

import { PricingService } from './pricing.service.js';

/**
 * Pricing module
 */
@Module({
  exports: [PricingService],
  providers: [PricingService],
})
export class PricingModule {}
