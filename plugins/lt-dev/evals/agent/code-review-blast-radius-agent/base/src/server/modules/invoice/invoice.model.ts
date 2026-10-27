import { equalIds, Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { ObjectType } from '@nestjs/graphql';
import { Schema as MongooseSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema } from 'mongoose';

import { PersistenceModel } from '../../common/models/persistence.model.js';
import { User } from '../user/user.model.js';

export type InvoiceDocument = Document & Invoice;

/**
 * Invoice line
 */
@MongooseSchema({ _id: false })
@ObjectType({ description: 'Invoice line' })
@Restricted(RoleEnum.ADMIN)
export class InvoiceLine {
  @UnifiedField({ description: 'What was sold', mongoose: true, roles: RoleEnum.S_USER })
  description: string = undefined;

  @UnifiedField({ description: 'Net unit price in euros', mongoose: true, roles: RoleEnum.S_USER })
  net: number = undefined;

  @UnifiedField({ description: 'Quantity', mongoose: true, roles: RoleEnum.S_USER })
  quantity: number = undefined;

  @UnifiedField({ description: 'Tax rate, for example 0.19', mongoose: true, roles: RoleEnum.S_USER })
  taxRate: number = undefined;
}

/**
 * Invoice model
 */
@MongooseSchema({ timestamps: true })
@ObjectType({ description: 'Invoice' })
@Restricted(RoleEnum.ADMIN)
export class Invoice extends PersistenceModel {
  /**
   * Customer the invoice is addressed to
   */
  @UnifiedField({
    description: 'Customer the invoice is addressed to',
    mongoose: { ref: 'User', type: Schema.Types.ObjectId },
    roles: RoleEnum.S_USER,
    type: () => String,
  })
  customer: string = undefined;

  /**
   * Invoice lines
   */
  @UnifiedField({
    description: 'Invoice lines',
    isArray: true,
    mongoose: { type: [InvoiceLine] },
    roles: RoleEnum.S_USER,
    type: () => InvoiceLine,
  })
  lines: InvoiceLine[] = undefined;

  /**
   * Gross total of all lines in whole cents
   */
  @UnifiedField({ description: 'Gross total in whole cents', mongoose: { default: 0 }, roles: RoleEnum.S_USER })
  totalCents: number = undefined;

  /**
   * Only the user who created the invoice and admins see it
   */
  override securityCheck(user: User, force?: boolean): this | undefined {
    if (force || user?.hasRole(RoleEnum.ADMIN) || equalIds(user, this.createdBy)) {
      return this;
    }
    return undefined;
  }
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
