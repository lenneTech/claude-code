import { AuthGuard, AuthGuardStrategy, CurrentUser, RoleEnum, Roles, ServiceOptions } from '@lenne.tech/nest-server';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { User } from '../user/user.model';
import { ProductCreateInput } from './inputs/product-create.input';
import { ProductInput } from './inputs/product.input';
import { Product } from './product.model';
import { ProductService } from './product.service';

/**
 * Controller for product REST endpoints
 */
@ApiTags('products')
@Controller('products')
@Roles(RoleEnum.ADMIN)
@UseGuards(AuthGuard(AuthGuardStrategy.BETTER_AUTH))
export class ProductController {
  constructor(protected readonly productService: ProductService) {}

  @Get('search')
  @Roles(RoleEnum.S_USER)
  async search(
    @CurrentUser() currentUser: User,
    @Query('name') name: string,
    @Query('page', ParseIntPipe) page: number,
    @Query('limit', ParseIntPipe) limit: number,
  ): Promise<Product[]> {
    return await this.productService.search(name, page, Math.min(limit, 100), { currentUser });
  }

  @Get(':id')
  @Roles(RoleEnum.S_USER)
  async getProduct(@CurrentUser() currentUser: User, @Param('id') id: string): Promise<Product> {
    return await this.productService.get(id, { currentUser });
  }

  @Post()
  @Roles(RoleEnum.S_USER)
  async createProduct(@CurrentUser() currentUser: User, @Body() input: ProductCreateInput): Promise<Product> {
    const serviceOptions: ServiceOptions = { currentUser, inputType: ProductCreateInput };
    return await this.productService.create(input, serviceOptions);
  }

  @Patch(':id')
  @Roles(RoleEnum.S_USER)
  async updateProduct(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
    @Body() input: ProductInput,
  ): Promise<Product> {
    const serviceOptions: ServiceOptions = {
      currentUser,
      inputType: ProductInput,
      roles: [RoleEnum.ADMIN, RoleEnum.S_CREATOR],
    };
    return await this.productService.update(id, input, serviceOptions);
  }

  @Post(':id/reserve')
  @Roles(RoleEnum.S_USER)
  async reserve(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
    @Body('quantity', ParseIntPipe) quantity: number,
  ): Promise<Product> {
    return await this.productService.reserveStock(id, quantity, { currentUser });
  }
}
