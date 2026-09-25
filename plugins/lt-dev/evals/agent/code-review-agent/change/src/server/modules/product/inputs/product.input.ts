import { CoreInput, Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { InputType } from '@nestjs/graphql';

/**
 * Product input to update an existing product
 */
@InputType({ description: 'Product input' })
@Restricted(RoleEnum.ADMIN)
export class ProductInput extends CoreInput {
  @UnifiedField({ description: 'Discount in percent', isOptional: true, roles: RoleEnum.ADMIN })
  discountPercent?: number = undefined;

  @UnifiedField({ description: 'Name of the product', isOptional: true, roles: RoleEnum.ADMIN })
  name?: string = undefined;

  @UnifiedField({ description: 'Sales price', isOptional: true, roles: RoleEnum.ADMIN })
  price?: number = undefined;

  @UnifiedField({ description: 'Purchase price', isOptional: true, roles: RoleEnum.ADMIN })
  purchasePrice?: number = undefined;
}
