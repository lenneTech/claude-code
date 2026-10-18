import { Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { InputType } from '@nestjs/graphql';
import { IsMongoId } from 'class-validator';

import { CreditAmountInput } from './credit-amount.input';

/**
 * Transfer of credits to another account
 */
@InputType({ description: 'Credit transfer input' })
@Restricted(RoleEnum.ADMIN)
export class CreditTransferInput extends CreditAmountInput {
  @UnifiedField({ description: 'ID of the receiving account', roles: RoleEnum.S_USER, validator: () => [IsMongoId()] })
  toAccountId: string = undefined;
}
