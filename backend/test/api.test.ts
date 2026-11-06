import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { configureApp } from '../src/setup';
import { validateEnvironment } from '../src/config';

let mongo: MongoMemoryServer;
let app: INestApplication;
let projectId: string;
let feedbackId: string;
let ingestionKey: string;
const token = 'test-only-admin-key-with-more-than-32-characters';
const auth = { Authorization: `Bearer ${token}` };
before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB_NAME = 'signal_test';
  process.env.ADMIN_API_KEY = token;
  process.env.CORS_ORIGINS = 'https://dashboard.example.com';
  process.env.NODE_ENV = 'test';
  const { AppModule } = await import('../src/app.module');
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  configureApp(app);
  await app.init();
}, { timeout: 240000 });
after(async () => { if (app) await app.close(); if (mongo) await mongo.stop(); });

test('configuration rejects placeholder URI and weak admin keys', () => {
  assert.throws(() => validateEnvironment({ MONGODB_URI: 'placeholder' }));
  assert.throws(() => validateEnvironment({ MONGODB_URI: 'mongodb://localhost/test', ADMIN_API_KEY: 'short' }));
});
test('health reports real connectivity; admin data requires a token', async () => {
  await request(app.getHttpServer()).get('/v1/health/ready').expect(200);
  await request(app.getHttpServer()).get('/v1/projects').expect(401);
  await request(app.getHttpServer()).get('/v1/projects').set({ Authorization: 'Bearer wrong' }).expect(401);
});
test('validation rejects whitespace-only names, unsafe URLs, null and extra fields', async () => {
  await request(app.getHttpServer()).post('/v1/projects').set(auth).send({ name: ' ', platform: 'Web' }).expect(400);
  await request(app.getHttpServer()).post('/v1/projects').set(auth).send({ name: 'x', platform: 'Web', url: 'javascript:alert(1)' }).expect(400);
  await request(app.getHttpServer()).post('/v1/projects').set(auth).send({ name: 'x', platform: 'Web', url: null }).expect(400);
  await request(app.getHttpServer()).post('/v1/projects').set(auth).send({ name: 'x', platform: 'Web', admin: true }).expect(400);
});
test('project creation returns a key once, without exposing its hash', async () => {
  const response = await request(app.getHttpServer()).post('/v1/projects').set(auth)
    .send({ name: 'CaptionCopy', platform: 'Web & Mobile', url: 'https://example.com' }).expect(201);
  projectId = response.body.project.id;
  ingestionKey = response.body.ingestionKey;
  assert.match(projectId, /^[a-f0-9-]{36}$/);
  assert.equal(ingestionKey.length, 64);
  assert.equal(response.body.project.ingestionKeyHash, undefined);
  const list = await request(app.getHttpServer()).get('/v1/projects').set(auth).expect(200);
  assert.equal(list.body[0].id, projectId);
  assert.equal(list.body[0].ingestionKeyHash, undefined);
  assert.equal(list.body[0]._id, undefined);
});
test('feedback requires a valid existing project', async () => {
  const dto = { projectId: randomUUID(), title: 'Missing project', type: 'Bug', source: 'Web' };
  await request(app.getHttpServer()).post('/v1/feedback').set(auth).send(dto).expect(404);
  await request(app.getHttpServer()).post('/v1/feedback').set(auth).send({ ...dto, projectId: 'bad' }).expect(400);
});
test('creates feedback, paginates, filters and searches literal regex characters', async () => {
  const response = await request(app.getHttpServer()).post('/v1/feedback').set(auth)
    .send({ projectId, title: '=SUM(1,2)', description: 'Crash [on launch]', type: 'Bug', source: 'Mobile', priority: 'High' }).expect(201);
  feedbackId = response.body.id;
  assert.equal(response.body.status, 'New');
  const list = await request(app.getHttpServer()).get('/v1/feedback').query({ projectId, search: '[on', limit: 1 }).set(auth).expect(200);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].id, feedbackId);
  await request(app.getHttpServer()).get('/v1/feedback').query({ limit: 1000 }).set(auth).expect(400);
  await request(app.getHttpServer()).get('/v1/feedback').query({ status: { $ne: 'Resolved' } }).set(auth).expect(400);
});
test('public submissions cannot choose status, priority, notes, or access admin data', async () => {
  const dto = { title: 'Feature idea', type: 'Feature', source: 'Web' };
  await request(app.getHttpServer()).post(`/v1/ingest/${projectId}`).send(dto).expect(401);
  await request(app.getHttpServer()).post(`/v1/ingest/${projectId}`).set('X-Project-Key', ingestionKey).send({ ...dto, status: 'Resolved' }).expect(400);
  const response = await request(app.getHttpServer()).post(`/v1/ingest/${projectId}`).set('X-Project-Key', ingestionKey).send(dto).expect(201);
  assert.equal(response.body.status, 'New');
  assert.equal(response.body.notes, undefined);
  await request(app.getHttpServer()).get('/v1/feedback').set('X-Project-Key', ingestionKey).expect(401);
});
test('a project key cannot submit into another project; rotation revokes the old key', async () => {
  const other = await request(app.getHttpServer()).post('/v1/projects').set(auth).send({ name: 'Other', platform: 'Web' }).expect(201);
  const dto = { title: 'Idea', type: 'Feedback', source: 'Web' };
  await request(app.getHttpServer()).post(`/v1/ingest/${other.body.project.id}`).set('X-Project-Key', ingestionKey).send(dto).expect(401);
  const rotated = await request(app.getHttpServer()).post(`/v1/projects/${projectId}/rotate-key`).set(auth).expect(200);
  await request(app.getHttpServer()).post(`/v1/ingest/${projectId}`).set('X-Project-Key', ingestionKey).send(dto).expect(401);
  ingestionKey = rotated.body.ingestionKey;
});
test('updates persist; summary reflects resolution and rejects null', async () => {
  await request(app.getHttpServer()).patch(`/v1/feedback/${feedbackId}`).set(auth).send({ status: null }).expect(400);
  await request(app.getHttpServer()).patch(`/v1/feedback/${feedbackId}`).set(auth)
    .send({ status: 'Resolved', notes: 'Fixed on mobile', priority: 'Low' }).expect(200);
  const report = await request(app.getHttpServer()).get(`/v1/feedback/${feedbackId}`).set(auth).expect(200);
  assert.equal(report.body.notes, 'Fixed on mobile');
  const summary = await request(app.getHttpServer()).get('/v1/summary').query({ projectId }).set(auth).expect(200);
  assert.equal(summary.body.total, 2);
  assert.equal(summary.body.byStatus.Resolved, 1);
  assert.equal(summary.body.byType.Bug, 1);
});
test('CSV export applies filters, quotes values, and neutralizes spreadsheet formulas', async () => {
  const csv = await request(app.getHttpServer()).get('/v1/feedback/export.csv').query({ type: 'Bug' }).set(auth).expect(200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.ok(csv.text.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.text.includes('CaptionCopy'));
  assert.ok(!csv.text.includes('Feature idea'));
});
test('legacy adapter preserves the existing dashboard contract', async () => {
  await request(app.getHttpServer()).post('/v1/data').set(auth).send({ action: 'report', projectId, title: 'Legacy report', type: 'Feedback', source: 'Email', priority: 'Medium', contact: 'Tester' }).expect(200);
  const workspace = await request(app.getHttpServer()).get('/v1/data').set(auth).expect(200);
  assert.equal(workspace.body.reports.length, 3);
  assert.equal(workspace.body.projects.length, 2);
  assert.ok(workspace.body.reports.every((r: { id?: string; createdAt?: string }) => r.id && r.createdAt));
});
test('archive stops new submissions while retaining historical feedback', async () => {
  await request(app.getHttpServer()).patch(`/v1/projects/${projectId}`).set(auth).send({ archived: true }).expect(200);
  await request(app.getHttpServer()).post(`/v1/ingest/${projectId}`).set('X-Project-Key', ingestionKey)
    .send({ title: 'blocked', type: 'Bug', source: 'Web' }).expect(401);
  await request(app.getHttpServer()).post('/v1/feedback').set(auth)
    .send({ projectId, title: 'blocked', type: 'Bug', source: 'Web' }).expect(404);
  await request(app.getHttpServer()).get(`/v1/feedback/${feedbackId}`).set(auth).expect(200);
});
test('deletes return 404 when absent; invalid identifiers cannot reach Mongo queries', async () => {
  await request(app.getHttpServer()).delete(`/v1/feedback/${feedbackId}`).set(auth).expect(204);
  await request(app.getHttpServer()).get(`/v1/feedback/${feedbackId}`).set(auth).expect(404);
  await request(app.getHttpServer()).delete(`/v1/feedback/${feedbackId}`).set(auth).expect(404);
  await request(app.getHttpServer()).get('/v1/projects/invalid').set(auth).expect(400);
});
test('ingestion is rate limited', async () => {
  const dto = { title: 'test', type: 'Bug', source: 'Web' };
  let limited = false;
  for (let i = 0; i < 12; i++) {
    const response = await request(app.getHttpServer()).post(`/v1/ingest/${randomUUID()}`).send(dto);
    if (response.status === 429) { limited = true; break; }
  }
  assert.equal(limited, true);
});
