import { CoreInput, Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { InputType } from '@nestjs/graphql';
import { Min } from 'class-validator';

/**
 * Product input to update an existing product
 */
@InputType({ description: 'Product input' })
@Restricted(RoleEnum.ADMIN)
export class ProductInput extends CoreInput {
  @UnifiedField({ description: 'Creator of the product', isOptional: true, roles: RoleEnum.S_USER })
  createdBy?: string = undefined;

  @UnifiedField({ description: 'Name of the product', isOptional: true, roles: RoleEnum.S_USER })
  name?: string = undefined;

  @UnifiedField({ description: 'Sales price', isOptional: true, roles: RoleEnum.S_USER, validator: () => [Min(0)] })
  price?: number = undefined;

  @UnifiedField({ description: 'Purchase price', isOptional: true, roles: RoleEnum.S_USER, validator: () => [Min(0)] })
  purchasePrice?: number = undefined;

  @UnifiedField({ description: 'Units in stock', isOptional: true, roles: RoleEnum.ADMIN, validator: () => [Min(0)] })
  stock?: number = undefined;
}
