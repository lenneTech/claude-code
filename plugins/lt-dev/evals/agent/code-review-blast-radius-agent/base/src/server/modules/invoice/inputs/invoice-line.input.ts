import { CoreInput, Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { InputType } from '@nestjs/graphql';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Input to add a line to an invoice
 */
@InputType({ description: 'Invoice line input' })
@Restricted(RoleEnum.ADMIN)
export class InvoiceLineInput extends CoreInput {
  @UnifiedField({ description: 'What was sold', roles: RoleEnum.S_USER })
  description: string = undefined;

  @UnifiedField({ description: 'Net unit price in euros', roles: RoleEnum.S_USER, validator: () => [Min(0)] })
  net: number = undefined;

  @UnifiedField({ description: 'Quantity', roles: RoleEnum.S_USER, validator: () => [IsInt(), Min(1)] })
  quantity: number = undefined;

  @UnifiedField({
    description: 'Tax rate, for example 0.19',
    roles: RoleEnum.S_USER,
    validator: () => [Min(0), Max(1)],
  })
  taxRate: number = undefined;
}
