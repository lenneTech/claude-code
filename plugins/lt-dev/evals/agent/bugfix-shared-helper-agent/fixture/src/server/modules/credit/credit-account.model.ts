import { equalIds, Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { ObjectType } from '@nestjs/graphql';
import { Schema as MongooseSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { PersistenceModel } from '../../common/models/persistence.model';
import { User } from '../user/user.model';

export type CreditAccountDocument = Document & CreditAccount;

/**
 * Credit account of a user
 */
@MongooseSchema({ timestamps: true })
@ObjectType({ description: 'Credit account' })
@Restricted(RoleEnum.ADMIN)
export class CreditAccount extends PersistenceModel {
  /**
   * Current balance in credits
   */
  @UnifiedField({ description: 'Balance in credits', mongoose: { default: 0 }, roles: RoleEnum.S_USER })
  balance: number = undefined;

  /**
   * Name of the account, chosen by its owner
   */
  @UnifiedField({ description: 'Name of the account', mongoose: { trim: true }, roles: RoleEnum.S_USER })
  name: string = undefined;

  /**
   * Only the owner (the user who created the account) and admins see it
   */
  override securityCheck(user: User, force?: boolean): this | undefined {
    if (force || user?.hasRole(RoleEnum.ADMIN) || equalIds(user, this.createdBy)) {
      return this;
    }
    return undefined;
  }
}

export const CreditAccountSchema = SchemaFactory.createForClass(CreditAccount);
