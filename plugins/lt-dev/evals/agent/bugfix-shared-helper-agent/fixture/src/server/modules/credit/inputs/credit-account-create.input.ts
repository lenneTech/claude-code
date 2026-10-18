import { CoreInput, Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { InputType } from '@nestjs/graphql';

/**
 * Input to open a credit account for the current user (the balance starts at 0)
 */
@InputType({ description: 'Credit account create input' })
@Restricted(RoleEnum.ADMIN)
export class CreditAccountCreateInput extends CoreInput {
  @UnifiedField({ description: 'Name of the account', roles: RoleEnum.S_USER })
  name: string = undefined;
}
