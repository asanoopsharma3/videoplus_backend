import { Module } from '@nestjs/common';
import { CallbackController } from './callback.controller';

@Module({
  imports: [],
  controllers: [CallbackController],
  providers: [],
})
export class AppModule {}
