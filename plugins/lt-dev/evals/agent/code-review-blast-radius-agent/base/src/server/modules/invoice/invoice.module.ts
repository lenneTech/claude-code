import { ConfigService } from '@lenne.tech/nest-server';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PricingModule } from '../pricing/pricing.module';
import { InvoiceController } from './invoice.controller';
import { Invoice, InvoiceSchema } from './invoice.model';
import { InvoiceService } from './invoice.service';

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
