import { Module } from '@nestjs/common';

import { PricingModule } from '../pricing/pricing.module';
import { CatalogService } from './catalog.service';

/**
 * Catalog module
 */
@Module({
  exports: [CatalogService],
  imports: [PricingModule],
  providers: [CatalogService],
})
export class CatalogModule {}
