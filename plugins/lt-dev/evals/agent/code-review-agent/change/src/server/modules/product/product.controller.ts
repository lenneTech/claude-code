import { AuthGuard, AuthGuardStrategy, CurrentUser, RoleEnum, Roles, ServiceOptions } from '@lenne.tech/nest-server';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
export class ProductController {
  constructor(protected readonly productService: ProductService) {}

  @Get()
  @Roles(RoleEnum.S_USER)
  @UseGuards(AuthGuard(AuthGuardStrategy.BETTER_AUTH))
  async findProducts(@CurrentUser() currentUser: User): Promise<Product[]> {
    return await this.productService.find({}, { currentUser });
  }

  @Get('search')
  @Roles(RoleEnum.S_USER)
  @UseGuards(AuthGuard(AuthGuardStrategy.BETTER_AUTH))
  async searchProducts(@CurrentUser() currentUser: User, @Query('name') name: string): Promise<Product[]> {
    return await this.productService.findByName(name, { currentUser });
  }

  @Get(':id')
  @Roles(RoleEnum.S_USER)
  @UseGuards(AuthGuard(AuthGuardStrategy.BETTER_AUTH))
  async getProduct(@CurrentUser() currentUser: User, @Param('id') id: string): Promise<Product> {
    return await this.productService.get(id, { currentUser });
  }

  @Post()
  @Roles(RoleEnum.S_EVERYONE)
  async createProduct(@CurrentUser() currentUser: User, @Body() input: ProductCreateInput): Promise<Product> {
    const serviceOptions: ServiceOptions = { currentUser, inputType: ProductCreateInput };
    return await this.productService.create(input, serviceOptions);
  }

  @Patch(':id')
  @Roles(RoleEnum.ADMIN)
  @UseGuards(AuthGuard(AuthGuardStrategy.BETTER_AUTH))
  async updateProduct(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
    @Body() input: ProductInput,
  ): Promise<Product> {
    return await this.productService.update(id, input, { currentUser, inputType: ProductInput });
  }

  @Delete(':id')
  @Roles(RoleEnum.S_EVERYONE)
  async deleteProduct(@CurrentUser() currentUser: User, @Param('id') id: string): Promise<Product> {
    return await this.productService.delete(id, { currentUser });
  }
}
