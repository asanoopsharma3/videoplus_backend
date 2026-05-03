import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { LogArchiveService } from './log-archive.service';
import { RequestLogService } from './request-log.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    RequestLogService,
    LogArchiveService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
  exports: [RequestLogService, LogArchiveService],
})
export class LoggingModule {}
