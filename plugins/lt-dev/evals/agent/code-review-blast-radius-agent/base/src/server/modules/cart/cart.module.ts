import { ConfigService } from '@lenne.tech/nest-server';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PaymentModule } from '../payment/payment.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { CartController } from './cart.controller.js';
import { Cart, CartSchema } from './cart.model.js';
import { CartService } from './cart.service.js';

/**
 * Cart module
 */
@Module({
  controllers: [CartController],
  exports: [CartService],
  imports: [MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]), PaymentModule, PricingModule],
  providers: [ConfigService, CartService],
})
export class CartModule {}
