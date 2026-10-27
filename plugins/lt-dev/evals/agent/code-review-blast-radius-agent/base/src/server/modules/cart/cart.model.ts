import { equalIds, Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { ObjectType } from '@nestjs/graphql';
import { Schema as MongooseSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema } from 'mongoose';

import { PersistenceModel } from '../../common/models/persistence.model.js';
import { User } from '../user/user.model.js';

export type CartDocument = Document & Cart;

/**
 * Status of a cart
 */
export enum CartStatus {
  OPEN = 'open',
  PAID = 'paid',
}

/**
 * Cart item: a product snapshot with net unit price, tax rate and quantity
 */
@MongooseSchema({ _id: false })
@ObjectType({ description: 'Cart item' })
@Restricted(RoleEnum.ADMIN)
export class CartItem {
  @UnifiedField({ description: 'Net unit price in euros', mongoose: true, roles: RoleEnum.S_USER })
  net: number = undefined;

  @UnifiedField({ description: 'Product name', mongoose: true, roles: RoleEnum.S_USER })
  product: string = undefined;

  @UnifiedField({ description: 'Quantity', mongoose: true, roles: RoleEnum.S_USER })
  quantity: number = undefined;

  @UnifiedField({ description: 'Tax rate, for example 0.19', mongoose: true, roles: RoleEnum.S_USER })
  taxRate: number = undefined;
}

/**
 * Cart model
 */
@MongooseSchema({ timestamps: true })
@ObjectType({ description: 'Cart' })
@Restricted(RoleEnum.ADMIN)
export class Cart extends PersistenceModel {
  /**
   * Customer who owns the cart and pays at checkout
   */
  @UnifiedField({
    description: 'Customer who owns the cart',
    mongoose: { ref: 'User', type: Schema.Types.ObjectId },
    roles: RoleEnum.S_USER,
    type: () => String,
  })
  customer: string = undefined;

  /**
   * Items in the cart
   */
  @UnifiedField({
    description: 'Items in the cart',
    isArray: true,
    mongoose: { type: [CartItem] },
    roles: RoleEnum.S_USER,
    type: () => CartItem,
  })
  items: CartItem[] = undefined;

  /**
   * Status of the cart
   */
  @UnifiedField({
    description: 'Status of the cart',
    mongoose: { default: CartStatus.OPEN, enum: CartStatus },
    roles: RoleEnum.S_USER,
    type: () => String,
  })
  status: CartStatus = undefined;

  /**
   * Only the customer who created the cart and admins see it
   */
  override securityCheck(user: User, force?: boolean): this | undefined {
    if (force || user?.hasRole(RoleEnum.ADMIN) || equalIds(user, this.createdBy)) {
      return this;
    }
    return undefined;
  }
}

export const CartSchema = SchemaFactory.createForClass(Cart);
