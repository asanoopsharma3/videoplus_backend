import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CallbackModule } from './callback.module';
import { CallbackTransaction } from './entities/callback-transaction.entity';
import { LoggingModule } from './logging/logging.module';

function envBool(
  config: ConfigService,
  key: string,
  defaultValue = false,
): boolean {
  const v = config.get<string>(key);
  if (v === undefined || v === '') return defaultValue;
  return v === 'true' || v === '1' || v === 'yes';
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const ssl = envBool(config, 'DB_SSL');
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST', 'localhost'),
          port: parseInt(config.get<string>('DB_PORT') ?? '5432', 10),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_DATABASE'),
          entities: [CallbackTransaction],
          synchronize: false,
          logging: envBool(config, 'DB_LOGGING'),
          ssl: ssl
            ? {
                rejectUnauthorized: envBool(
                  config,
                  'DB_SSL_REJECT_UNAUTHORIZED',
                  true,
                ),
              }
            : false,
        };
      },
      inject: [ConfigService],
    }),
    CallbackModule,
    LoggingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
