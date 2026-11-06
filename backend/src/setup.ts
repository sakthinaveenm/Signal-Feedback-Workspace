import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('v1');
  app.getHttpAdapter().getInstance().set('trust proxy', config.get<number>('TRUST_PROXY_HOPS', 0));
  app.use(helmet());
  app.use((_: unknown, res: { setHeader: (key: string, value: string) => void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store'); next();
  });
  const origins = config.get<string>('CORS_ORIGINS', '').split(',').filter(Boolean);
  app.enableCors({ origin: origins, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Project-Key'], maxAge: 600 });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }));
  app.enableShutdownHooks();
}
