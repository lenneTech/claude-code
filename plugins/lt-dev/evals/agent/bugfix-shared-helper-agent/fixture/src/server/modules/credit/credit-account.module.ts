import { ConfigService } from '@lenne.tech/nest-server';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CreditAccountController } from './credit-account.controller';
import { CreditAccount, CreditAccountSchema } from './credit-account.model';
import { CreditAccountService } from './credit-account.service';

/**
 * Credit account module
 */
@Module({
  controllers: [CreditAccountController],
  exports: [CreditAccountService],
  imports: [MongooseModule.forFeature([{ name: CreditAccount.name, schema: CreditAccountSchema }])],
  providers: [ConfigService, CreditAccountService],
})
export class CreditAccountModule {}
