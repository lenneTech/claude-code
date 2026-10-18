import { CoreInput, Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { InputType } from '@nestjs/graphql';
import { IsInt, Min } from 'class-validator';

/**
 * Amount of credits for a booking (top-up, redeem)
 */
@InputType({ description: 'Credit amount input' })
@Restricted(RoleEnum.ADMIN)
export class CreditAmountInput extends CoreInput {
  @UnifiedField({ description: 'Amount in credits', roles: RoleEnum.S_USER, validator: () => [IsInt(), Min(1)] })
  amount: number = undefined;
}
