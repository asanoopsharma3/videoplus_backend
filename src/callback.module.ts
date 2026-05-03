import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallbackController } from './callback.controller';
import { CallbackService } from './callback.service';
import { CallbackTransaction } from './entities/callback-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CallbackTransaction])],
  controllers: [CallbackController],
  providers: [CallbackService],
})
export class CallbackModule {}
