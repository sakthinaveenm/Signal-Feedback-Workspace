import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './setup';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  configureApp(app);
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'), '0.0.0.0');
}
void bootstrap().catch(() => { console.error('Signal API failed to start. Check environment configuration and database connectivity.'); process.exitCode = 1; });
