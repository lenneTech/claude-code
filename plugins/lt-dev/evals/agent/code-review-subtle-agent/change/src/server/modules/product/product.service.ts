import { ConfigService, CrudService, ServiceOptions } from '@lenne.tech/nest-server';
import { BadRequestException, Injectable } from '@nestjs/common';
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
   * Search products by name, paginated. `page` starts at 1.
   */
  async search(name: string, page: number, limit: number, serviceOptions?: ServiceOptions): Promise<Product[]> {
    const products = await this.mainDbModel
      .find({ name: new RegExp(name, 'i') })
      .sort({ name: 1 })
      .skip(page * limit)
      .limit(limit)
      .exec();
    return this.processResult(products.map((p) => Product.map(p)), serviceOptions);
  }

  /**
   * Take units out of stock for an order. Stock must never become negative.
   */
  async reserveStock(id: string, quantity: number, serviceOptions?: ServiceOptions): Promise<Product> {
    const product = await this.mainDbModel.findById(id).exec();
    if (!product || product.stock < quantity) {
      throw new BadRequestException('Not enough stock');
    }
    product.stock -= quantity;
    await product.save();
    return this.processResult(Product.map(product), serviceOptions);
  }
}
