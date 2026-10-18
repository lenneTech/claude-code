import { ConfigService } from '@lenne.tech/nest-server';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PaymentModule } from '../payment/payment.module';
import { PricingModule } from '../pricing/pricing.module';
import { CartController } from './cart.controller';
import { Cart, CartSchema } from './cart.model';
import { CartService } from './cart.service';

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
