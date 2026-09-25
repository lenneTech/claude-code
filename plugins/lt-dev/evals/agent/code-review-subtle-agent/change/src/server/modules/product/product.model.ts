import { Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { ObjectType } from '@nestjs/graphql';
import { Schema as MongooseSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema, Types } from 'mongoose';

import { PersistenceModel } from '../../common/models/persistence.model';
import { User } from '../user/user.model';

export type ProductDocument = Document & Product;

/**
 * Product model
 */
@MongooseSchema({ timestamps: true })
@ObjectType({ description: 'Product' })
@Restricted(RoleEnum.ADMIN)
export class Product extends PersistenceModel {
  /**
   * ID of the user who created the product
   */
  @UnifiedField({
    description: 'ID of the user who created the product',
    isOptional: true,
    mongoose: { ref: 'User', type: Schema.Types.ObjectId },
    roles: RoleEnum.S_USER,
    type: () => String,
  })
  createdBy: Types.ObjectId = undefined;

  /**
   * Name of the product
   */
  @UnifiedField({ description: 'Name of the product', mongoose: { trim: true }, roles: RoleEnum.S_USER })
  name: string = undefined;

  /**
   * Sales price
   */
  @UnifiedField({ description: 'Sales price', isOptional: true, mongoose: true, roles: RoleEnum.S_USER })
  price: number = undefined;

  /**
   * Purchase price (internal cost), visible to admins and to the user who created the product
   */
  @UnifiedField({ description: 'Purchase price', isOptional: true, mongoose: true, roles: RoleEnum.S_USER })
  purchasePrice: number = undefined;

  /**
   * Units in stock
   */
  @UnifiedField({ description: 'Units in stock', mongoose: { default: 0, min: 0 }, roles: RoleEnum.S_USER })
  stock: number = undefined;

  override securityCheck(user: User, force?: boolean): this {
    if (force || user?.roles?.includes(RoleEnum.ADMIN)) {
      return this;
    }
    if (this.createdBy !== user?.id) {
      this.purchasePrice = undefined;
    }
    return this;
  }
}

export const ProductSchema = SchemaFactory.createForClass(Product);
