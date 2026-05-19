import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.setGlobalPrefix('api/v1');
  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  console.log(`Application listening on port ${port}`);
}
bootstrap();
