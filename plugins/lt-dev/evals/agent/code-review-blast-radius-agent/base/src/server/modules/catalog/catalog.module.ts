import { Module } from '@nestjs/common';

import { PricingModule } from '../pricing/pricing.module.js';
import { CatalogService } from './catalog.service.js';

/**
 * Catalog module
 */
@Module({
  exports: [CatalogService],
  imports: [PricingModule],
  providers: [CatalogService],
})
export class CatalogModule {}
