import { Any, CoreModule, DateScalar, JSON, TusModule } from '@lenne.tech/nest-server';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import envConfig from '../config.env';
import { CronJobs } from './common/services/cron-jobs.service';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FileModule } from './modules/file/file.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { MetaModule } from './modules/meta/meta.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { UserModule } from './modules/user/user.module';
import { ServerController } from './server.controller';

// Export imports for reuse (e.g. in tests)
export const imports = [
  // Include CoreModule for standard processes
  CoreModule.forRoot(envConfig),

  // Include cron job handling
  ScheduleModule.forRoot(),

  // Include MetaModule to offer information about the server
  MetaModule,

  // Include FileModule for file handling
  FileModule,

  // Include TusModule for resumable file uploads
  TusModule.forRoot(),

  // Include UserModule for user management
  UserModule,

  // Shop
  PricingModule,
  PaymentModule,
  CatalogModule,
  CartModule,
  InvoiceModule,
];

/**
 * Server module (dynamic)
 *
 * This is the server module, which includes all modules which are necessary
 * for the project API
 */
@Module({
  // Include REST controllers
  controllers: [ServerController],

  // Export modules for reuse in other modules
  exports: [CoreModule, MetaModule, FileModule, TusModule, UserModule],

  // Include modules
  imports,

  // Include services and scalars
  providers: [
    // #region graphql
    Any,
    DateScalar,
    JSON,
    // #endregion graphql
    CronJobs,
  ],
})
export class ServerModule {}
