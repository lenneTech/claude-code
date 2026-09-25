import { Restricted, RoleEnum, UnifiedField } from '@lenne.tech/nest-server';
import { InputType } from '@nestjs/graphql';

import { ProductInput } from './product.input';

/**
 * Product input to create a new product
 */
@InputType({ description: 'Product create input' })
@Restricted(RoleEnum.ADMIN)
export class ProductCreateInput extends ProductInput {
  @UnifiedField({ description: 'Name of the product', roles: RoleEnum.S_USER })
  override name: string = undefined;
}
