import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UpdateController, type UpdateAdapter } from '../src/update-controller';
const adapter = (overrides: Partial<UpdateAdapter> = {}): UpdateAdapter => ({
  check: async () => ({ isAvailable: true }), download: async () => ({ isNew: true }), reload: async () => {}, ...overrides,
});
test('unsupported builds never call native update methods', async () => {
  let called = false;
  const controller = new UpdateController(adapter({ check: async () => { called = true; return { isAvailable: true }; } }), false, 'Configure a release build.');
  await controller.check(); await controller.download(); await controller.restart();
  assert.equal(called, false); assert.equal(controller.getSnapshot().status, 'disabled');
});
test('downloads do not reload the app until restart is explicitly requested', async () => {
  let reloads = 0;
  const controller = new UpdateController(adapter({ reload: async () => { reloads++; } }), true);
  await controller.check(); assert.equal(controller.getSnapshot().status, 'available');
  await controller.download(); assert.equal(controller.getSnapshot().status, 'ready'); assert.equal(reloads, 0);
  await controller.restart(); assert.equal(reloads, 1); assert.equal(controller.getSnapshot().status, 'restarting');
});
test('concurrent checks and repeated downloads are deduplicated', async () => {
  let checks = 0, downloads = 0;
  let resolveCheck!: (value: { isAvailable: boolean }) => void;
  const controller = new UpdateController(adapter({ check: () => { checks++; return new Promise(resolve => { resolveCheck = resolve; }); },
    download: async () => { downloads++; return { isNew: true }; } }), true);
  const checking = controller.check(); await controller.check(); assert.equal(checks, 1);
  resolveCheck({ isAvailable: true }); await checking;
  await Promise.all([controller.download(), controller.download()]); assert.equal(downloads, 1);
});
test('a no-update response does not offer a download', async () => {
  const controller = new UpdateController(adapter({ check: async () => ({ isAvailable: false }) }), true);
  await controller.check(); assert.equal(controller.getSnapshot().status, 'idle');
  assert.match(controller.getSnapshot().message, /up to date/); assert.ok(controller.getSnapshot().lastChecked);
});
test('network and download failures remain retryable without losing the running app', async () => {
  let failCheck = true, failDownload = true;
  const controller = new UpdateController(adapter({ check: async () => { if (failCheck) throw Error('offline'); return { isAvailable: true }; },
    download: async () => { if (failDownload) throw Error('offline'); return { isNew: true }; } }), true);
  await controller.check(); assert.equal(controller.getSnapshot().status, 'error');
  failCheck = false; await controller.check(); await controller.download(); assert.equal(controller.getSnapshot().status, 'available');
  failDownload = false; await controller.download(); assert.equal(controller.getSnapshot().status, 'ready');
});
test('a reload failure keeps the downloaded update available for retry', async () => {
  const controller = new UpdateController(adapter({ reload: async () => { throw Error('reload failed'); } }), true);
  controller.markReady(); await controller.restart(); assert.equal(controller.getSnapshot().status, 'ready');
  assert.match(controller.getSnapshot().message, /close and reopen/);
});
test('native pending-update notification wins a race against an older check result', async () => {
  let complete!: (value: { isAvailable: boolean }) => void;
  const controller = new UpdateController(adapter({ check: () => new Promise(resolve => { complete = resolve; }) }), true);
  const checking = controller.check(); controller.markReady(); complete({ isAvailable: false }); await checking;
  assert.equal(controller.getSnapshot().status, 'ready');
});
test('supports server rollback directives and unavailable downloads', async () => {
  const rollback = new UpdateController(adapter({ check: async () => ({ isAvailable: false, isRollBackToEmbedded: true }), download: async () => ({ isNew: false, isRollBackToEmbedded: true }) }), true);
  await rollback.check(); await rollback.download(); assert.equal(rollback.getSnapshot().status, 'ready');
  const gone = new UpdateController(adapter({ download: async () => ({ isNew: false }) }), true);
  await gone.check(); await gone.download(); assert.equal(gone.getSnapshot().status, 'idle');
});
