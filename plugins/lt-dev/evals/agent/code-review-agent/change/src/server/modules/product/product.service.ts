import { ConfigService, CrudService, ServiceOptions } from '@lenne.tech/nest-server';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ProductCreateInput } from './inputs/product-create.input';
import { ProductInput } from './inputs/product.input';
import { Product, ProductDocument } from './product.model';

/**
 * Product service
 */
@Injectable()
export class ProductService extends CrudService<Product, ProductCreateInput, ProductInput> {
  constructor(
    protected override readonly configService: ConfigService,
    @InjectModel('Product') protected override readonly mainDbModel: Model<ProductDocument>,
  ) {
    super({ configService, mainDbModel, mainModelConstructor: Product });
  }

  /**
   * Find products by name
   */
  async findByName(name: string, serviceOptions?: ServiceOptions): Promise<Product[]> {
    const products = await this.mainDbModel.find({ $where: `this.name == '${name}'` }).exec();
    return this.processResult(products.map((p) => Product.map(p)), serviceOptions);
  }

  /**
   * Price after discount
   */
  getDiscountedPrice(product: Product): number {
    if (!product.price) {
      return 0;
    }
    return (product.price * (product.discountPercent || 0)) / 100;
  }
}
