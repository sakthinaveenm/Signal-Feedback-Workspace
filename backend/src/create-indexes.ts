import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from './app.module';
import { Feedback, Project } from './models';
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await app.get<Model<Project>>(getModelToken(Project.name)).createIndexes();
    await app.get<Model<Feedback>>(getModelToken(Feedback.name)).createIndexes();
    console.log('Signal indexes created.');
  } finally { await app.close(); }
}
void run().catch(() => { console.error('Unable to create indexes. Check database configuration.'); process.exitCode = 1; });
