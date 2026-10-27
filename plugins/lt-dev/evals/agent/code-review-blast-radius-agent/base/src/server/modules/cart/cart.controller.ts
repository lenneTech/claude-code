import { AuthGuard, AuthGuardStrategy, CurrentUser, RoleEnum, Roles } from '@lenne.tech/nest-server';
import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { User } from '../user/user.model.js';
import { Cart } from './cart.model.js';
import { CartService } from './cart.service.js';

/**
 * Controller for cart REST endpoints
 */
@ApiTags('carts')
@Controller('carts')
@Roles(RoleEnum.ADMIN)
@UseGuards(AuthGuard(AuthGuardStrategy.BETTER_AUTH))
export class CartController {
  constructor(protected readonly cartService: CartService) {}

  /**
   * Checkout: pay the cart. The service lets only the cart's owner or an admin through.
   */
  @Post(':id/checkout')
  @Roles(RoleEnum.S_USER)
  async checkout(@CurrentUser() currentUser: User, @Param('id') id: string): Promise<Cart> {
    return await this.cartService.checkout(id, { currentUser });
  }
}
