import { Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { ObjectType } from '@nestjs/graphql';
import { Schema as MongooseSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { PersistenceModel } from '../../common/models/persistence.model';

export type ProductDocument = Document & Product;

/**
 * Product model
 */
@MongooseSchema({ timestamps: true })
@ObjectType({ description: 'Product' })
@Restricted(RoleEnum.ADMIN)
export class Product extends PersistenceModel {
  /**
   * Discount in percent (0-100)
   */
  @UnifiedField({
    description: 'Discount in percent',
    isOptional: true,
    mongoose: { default: 0, max: 100, min: 0 },
    roles: RoleEnum.S_USER,
  })
  discountPercent: number = undefined;

  /**
   * Name of the product
   */
  @UnifiedField({
    description: 'Name of the product',
    mongoose: { trim: true },
    roles: RoleEnum.S_USER,
  })
  name: string = undefined;

  /**
   * Sales price
   */
  @UnifiedField({
    description: 'Sales price',
    isOptional: true,
    mongoose: true,
    roles: RoleEnum.S_USER,
  })
  price: number = undefined;

  /**
   * Purchase price (internal cost)
   */
  @UnifiedField({
    description: 'Purchase price',
    isOptional: true,
    mongoose: true,
    roles: RoleEnum.S_USER,
  })
  purchasePrice: number = undefined;

  override init(): this {
    super.init();
    return this;
  }

  override map(input: Partial<this> | Record<string, any>): this {
    super.map(input);
    return this;
  }

  override securityCheck(user: any, force?: boolean): this {
    if (force) {
      return this;
    }
    return this;
  }
}

export const ProductSchema = SchemaFactory.createForClass(Product);
