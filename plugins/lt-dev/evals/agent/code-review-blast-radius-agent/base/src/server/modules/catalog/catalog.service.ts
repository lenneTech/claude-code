import { Injectable } from '@nestjs/common';

import { PricedItem, PricingService } from '../pricing/pricing.service';

/**
 * Catalog views on priced items
 */
@Injectable()
export class CatalogService {
  constructor(protected readonly pricingService: PricingService) {}

  /**
   * Items ordered by gross price, cheapest first
   */
  cheapestFirst<T extends PricedItem>(items: T[]): T[] {
    return [...items].sort(
      (a, b) => this.pricingService.grossPrice(a.net, a.taxRate) - this.pricingService.grossPrice(b.net, b.taxRate),
    );
  }

  /**
   * Items that cost nothing, listed under "Gratis"
   */
  freeItems<T extends PricedItem>(items: T[]): T[] {
    return items.filter((item) => this.pricingService.grossPrice(item.net, item.taxRate) === 0);
  }
}
