import { ConfigService, CrudService, RoleEnum, ServiceOptions } from '@lenne.tech/nest-server';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ErrorCode } from '../../common/errors/project-errors';
import { CreditAccount, CreditAccountDocument } from './credit-account.model';

/**
 * Credit accounts: users hold credits, send them to other accounts and redeem them for vouchers
 */
@Injectable()
export class CreditAccountService extends CrudService<CreditAccount> {
  constructor(
    protected override readonly configService: ConfigService,
    @InjectModel('CreditAccount') protected override readonly mainDbModel: Model<CreditAccountDocument>,
  ) {
    super({ configService, mainDbModel, mainModelConstructor: CreditAccount });
  }

  /**
   * Adds credits to an account (admins only, enforced by the controller)
   */
  async topUp(accountId: string, amount: number, serviceOptions: ServiceOptions): Promise<CreditAccount> {
    await this.get(accountId, serviceOptions);
    await this.credit(accountId, amount);
    return this.get(accountId, serviceOptions);
  }

  /**
   * Sends credits from an account to another one. Only the owner of the sending account or an admin.
   */
  async transfer(fromId: string, toId: string, amount: number, serviceOptions: ServiceOptions): Promise<CreditAccount> {
    const account = await this.get(fromId, { ...serviceOptions, roles: [RoleEnum.ADMIN, RoleEnum.S_CREATOR] });
    if (account.balance < amount) {
      throw new UnprocessableEntityException(ErrorCode.INSUFFICIENT_CREDITS);
    }
    await this.assertExists(toId);
    await this.debit(fromId, amount);
    await this.credit(toId, amount);
    return this.get(fromId, serviceOptions);
  }

  /**
   * Pays a voucher order with credits from the account. Only the owner of the account or an admin.
   */
  async redeem(accountId: string, amount: number, serviceOptions: ServiceOptions): Promise<CreditAccount> {
    await this.get(accountId, { ...serviceOptions, roles: [RoleEnum.ADMIN, RoleEnum.S_CREATOR] });
    await this.debit(accountId, amount);
    return this.get(accountId, serviceOptions);
  }

  // ===================================================================================================================
  // Bookings
  //
  // this.mainDbModel used instead of this.update because:
  //   - atomic $inc, so concurrent bookings on one account do not overwrite each other (CrudService.update has no $inc)
  // Standard-path logic considered:
  //   - checkRights and securityCheck: the public methods load the account with this.get before and after a booking
  // ===================================================================================================================

  /**
   * Throws when the account does not exist
   */
  private async assertExists(accountId: string): Promise<void> {
    if (!(await this.mainDbModel.exists({ _id: accountId }))) {
      throw new NotFoundException(ErrorCode.CREDIT_ACCOUNT_NOT_FOUND);
    }
  }

  /**
   * Takes credits off an account
   */
  private async debit(accountId: string, amount: number): Promise<void> {
    await this.mainDbModel.updateOne({ _id: accountId }, { $inc: { balance: -amount } }).exec();
  }

  /**
   * Adds credits to an account
   */
  private async credit(accountId: string, amount: number): Promise<void> {
    await this.mainDbModel.updateOne({ _id: accountId }, { $inc: { balance: amount } }).exec();
  }
}
