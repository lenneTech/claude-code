import { ConfigService, CrudService, RoleEnum, ServiceOptions } from '@lenne.tech/nest-server';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PricingService } from '../pricing/pricing.service';
import { InvoiceLineInput } from './inputs/invoice-line.input';
import { Invoice, InvoiceDocument } from './invoice.model';

/**
 * Invoice service
 */
@Injectable()
export class InvoiceService extends CrudService<Invoice> {
  constructor(
    protected override readonly configService: ConfigService,
    @InjectModel('Invoice') protected override readonly mainDbModel: Model<InvoiceDocument>,
    protected readonly pricingService: PricingService,
  ) {
    super({ configService, mainDbModel, mainModelConstructor: Invoice });
  }

  /**
   * Adds a line to an invoice and updates the gross total. Only the invoice's creator or an admin.
   */
  async addLine(id: string, line: InvoiceLineInput, serviceOptions: ServiceOptions): Promise<Invoice> {
    const invoice = await this.get(id, { ...serviceOptions, roles: [RoleEnum.ADMIN, RoleEnum.S_CREATOR] });
    const lines = [...(invoice.lines ?? []), line];
    const total = lines.reduce((sum, l) => sum + this.pricingService.grossPrice(l.net * l.quantity, l.taxRate), 0);
    return this.update(id, { lines, totalCents: Math.round(total * 100) }, serviceOptions);
  }
}
