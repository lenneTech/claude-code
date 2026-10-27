import { AuthGuard, AuthGuardStrategy, CurrentUser, RoleEnum, Roles } from '@lenne.tech/nest-server';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { User } from '../user/user.model.js';
import { InvoiceLineInput } from './inputs/invoice-line.input.js';
import { Invoice } from './invoice.model.js';
import { InvoiceService } from './invoice.service.js';

/**
 * Controller for invoice REST endpoints
 */
@ApiTags('invoices')
@Controller('invoices')
@Roles(RoleEnum.ADMIN)
@UseGuards(AuthGuard(AuthGuardStrategy.BETTER_AUTH))
export class InvoiceController {
  constructor(protected readonly invoiceService: InvoiceService) {}

  @Get(':id')
  @Roles(RoleEnum.S_USER)
  async getInvoice(@CurrentUser() currentUser: User, @Param('id') id: string): Promise<Invoice> {
    return await this.invoiceService.get(id, { currentUser, roles: [RoleEnum.ADMIN, RoleEnum.S_CREATOR] });
  }

  @Post(':id/lines')
  @Roles(RoleEnum.S_USER)
  async addLine(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
    @Body() input: InvoiceLineInput,
  ): Promise<Invoice> {
    return await this.invoiceService.addLine(id, input, { currentUser, inputType: InvoiceLineInput });
  }
}
