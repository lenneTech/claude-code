import { ConfigService, CrudService, RoleEnum, ServiceOptions } from '@lenne.tech/nest-server';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ErrorCode } from '../../common/errors/project-errors';
import { toCents } from '../../common/helpers/money.helper';
import { PaymentService } from '../payment/payment.service';
import { PricingService } from '../pricing/pricing.service';
import { Cart, CartDocument, CartStatus } from './cart.model';

/**
 * Cart service
 */
@Injectable()
export class CartService extends CrudService<Cart> {
  constructor(
    protected override readonly configService: ConfigService,
    @InjectModel('Cart') protected override readonly mainDbModel: Model<CartDocument>,
    protected readonly paymentService: PaymentService,
    protected readonly pricingService: PricingService,
  ) {
    super({ configService, mainDbModel, mainModelConstructor: Cart });
  }

  /**
   * Charges the cart's gross total to its customer and marks the cart as paid
   */
  async checkout(id: string, serviceOptions: ServiceOptions): Promise<Cart> {
    const cart = await this.get(id, { ...serviceOptions, roles: [RoleEnum.ADMIN, RoleEnum.S_CREATOR] });
    if (cart.status !== CartStatus.OPEN) {
      throw new ConflictException(ErrorCode.CART_NOT_OPEN);
    }
    const gross = (cart.items ?? []).reduce(
      (sum, item) => sum + this.pricingService.grossPrice(item.net * item.quantity, item.taxRate),
      0,
    );
    // The payment provider expects whole cents
    await this.paymentService.charge(cart.customer, toCents(gross));
    return this.update(id, { status: CartStatus.PAID }, serviceOptions);
  }
}
