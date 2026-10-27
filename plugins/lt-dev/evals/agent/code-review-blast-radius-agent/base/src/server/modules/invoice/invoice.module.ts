import { ConfigService } from '@lenne.tech/nest-server';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PricingModule } from '../pricing/pricing.module.js';
import { InvoiceController } from './invoice.controller.js';
import { Invoice, InvoiceSchema } from './invoice.model.js';
import { InvoiceService } from './invoice.service.js';

/**
 * Invoice module
 */
@Module({
  controllers: [InvoiceController],
  exports: [InvoiceService],
  imports: [MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }]), PricingModule],
  providers: [ConfigService, InvoiceService],
})
export class InvoiceModule {}
