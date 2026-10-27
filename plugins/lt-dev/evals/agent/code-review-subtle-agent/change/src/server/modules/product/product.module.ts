import { ConfigService } from '@lenne.tech/nest-server';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ProductController } from './product.controller.js';
import { Product, ProductSchema } from './product.model.js';
import { ProductService } from './product.service.js';

/**
 * Product module
 */
@Module({
  controllers: [ProductController],
  exports: [ProductService],
  imports: [MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }])],
  providers: [ConfigService, ProductService],
})
export class ProductModule {}
