import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config';
import { AdminKeyGuard } from './auth';
import { Project, ProjectSchema, Feedback, FeedbackSchema } from './models';
import { SignalService } from './signal.service';
import { SignalController } from './signal.controller';
import { LegacyController } from './legacy.controller';
import { HealthController } from './health.controller';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    MongooseModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({
      uri: config.getOrThrow<string>('MONGODB_URI'), dbName: config.getOrThrow<string>('MONGODB_DB_NAME'),
      serverSelectionTimeoutMS: 10000, maxPoolSize: 10, retryAttempts: 2, retryDelay: 1000,
      autoIndex: config.get('NODE_ENV') !== 'production',
    }) }),
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }, { name: Feedback.name, schema: FeedbackSchema }]),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [SignalController, LegacyController, HealthController],
  providers: [SignalService, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: AdminKeyGuard }],
})
export class AppModule {}
