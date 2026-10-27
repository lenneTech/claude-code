import { AuthGuard, AuthGuardStrategy, CurrentUser, RoleEnum, Roles } from '@lenne.tech/nest-server';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { User } from '../user/user.model.js';
import { CreditAccount } from './credit-account.model.js';
import { CreditAccountService } from './credit-account.service.js';
import { CreditAccountCreateInput } from './inputs/credit-account-create.input.js';
import { CreditAmountInput } from './inputs/credit-amount.input.js';
import { CreditTransferInput } from './inputs/credit-transfer.input.js';

/**
 * Controller for credit account REST endpoints
 */
@ApiTags('credit-accounts')
@Controller('credit-accounts')
@Roles(RoleEnum.ADMIN)
@UseGuards(AuthGuard(AuthGuardStrategy.BETTER_AUTH))
export class CreditAccountController {
  constructor(protected readonly creditAccountService: CreditAccountService) {}

  /**
   * Opens a credit account for the current user
   */
  @Post()
  @Roles(RoleEnum.S_USER)
  async createAccount(
    @CurrentUser() currentUser: User,
    @Body() input: CreditAccountCreateInput,
  ): Promise<CreditAccount> {
    return await this.creditAccountService.create(input, { currentUser, inputType: CreditAccountCreateInput });
  }

  /**
   * Gets an account. Only its owner or an admin.
   */
  @Get(':id')
  @Roles(RoleEnum.S_USER)
  async getAccount(@CurrentUser() currentUser: User, @Param('id') id: string): Promise<CreditAccount> {
    return await this.creditAccountService.get(id, { currentUser, roles: [RoleEnum.ADMIN, RoleEnum.S_CREATOR] });
  }

  /**
   * Adds credits to an account (admins only)
   */
  @Post(':id/top-up')
  async topUp(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
    @Body() input: CreditAmountInput,
  ): Promise<CreditAccount> {
    return await this.creditAccountService.topUp(id, input.amount, { currentUser });
  }

  /**
   * Sends credits to another account
   */
  @Post(':id/transfer')
  @Roles(RoleEnum.S_USER)
  async transfer(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
    @Body() input: CreditTransferInput,
  ): Promise<CreditAccount> {
    return await this.creditAccountService.transfer(id, input.toAccountId, input.amount, { currentUser });
  }

  /**
   * Pays a voucher order with credits
   */
  @Post(':id/redeem')
  @Roles(RoleEnum.S_USER)
  async redeem(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
    @Body() input: CreditAmountInput,
  ): Promise<CreditAccount> {
    return await this.creditAccountService.redeem(id, input.amount, { currentUser });
  }
}
