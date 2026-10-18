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
    await this.get(id, { ...serviceOptions, roles: [RoleEnum.ADMIN, RoleEnum.S_CREATOR] });
    const amt = this.pricingService.grossPrice(line.net * line.quantity, line.taxRate);
    // this.mainDbModel.findByIdAndUpdate used instead of this.update because:
    //   - atomic $push and $inc, so lines added at the same time both count (lines is a subdocument array)
    // Standard-path logic considered:
    //   - checkRights by the this.get above; securityCheck and output preparation by the this.get below
    await this.mainDbModel.findByIdAndUpdate(id, { $inc: { totalCents: amt }, $push: { lines: line } }).exec();
    return this.get(id, serviceOptions);
  }
}
