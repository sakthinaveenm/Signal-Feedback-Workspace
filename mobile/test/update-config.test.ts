import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
type ExpoConfig = { extra?: Record<string, unknown>; updates?: Record<string, unknown>; [key: string]: unknown };
const configure = require(path.resolve(__dirname, '../../app.config.js')) as (input: { config: ExpoConfig }) => ExpoConfig;
const projectId = '12345678-1234-4234-8234-123456789abc'; // fixture only, never persisted as app configuration
function isolated(run: () => void) {
  const keys = ['EAS_PROJECT_ID', 'EXPO_UPDATE_CHANNEL', 'EAS_BUILD_PROFILE'] as const;
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  keys.forEach(key => { delete process.env[key]; });
  try { run(); } finally { keys.forEach(key => { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }); }
}
test('updates stay disabled without a real configured project, while app settings are preserved', () => isolated(() => {
  const result = configure({ config: { name: 'Signal', extra: { other: true } } });
  assert.equal(result.updates?.enabled, false); assert.equal(result.updates?.url, undefined);
  assert.deepEqual(result.runtimeVersion, { policy: 'fingerprint' }); assert.equal(result.extra?.other, true);
}));
test('configures project URL, production channel, manual checks, and runtime compatibility', () => isolated(() => {
  const result = configure({ config: { extra: { eas: { projectId } } } });
  assert.equal(result.updates?.url, `https://u.expo.dev/${projectId}`);
  assert.equal(result.updates?.enabled, true); assert.equal(result.updates?.checkAutomatically, 'ON_ERROR_RECOVERY');
  assert.deepEqual(result.updates?.requestHeaders, { 'expo-channel-name': 'production' });
}));
test('preview native builds use the preview channel; malformed configuration fails early', () => isolated(() => {
  process.env.EAS_PROJECT_ID = projectId; process.env.EAS_BUILD_PROFILE = 'preview';
  const result = configure({ config: {} });
  assert.deepEqual(result.updates?.requestHeaders, { 'expo-channel-name': 'preview' });
  process.env.EAS_PROJECT_ID = 'not-a-project-uuid'; assert.throws(() => configure({ config: {} }), /UUID/);
  process.env.EAS_PROJECT_ID = projectId; process.env.EXPO_UPDATE_CHANNEL = 'typo';
  assert.throws(() => configure({ config: {} }), /preview or production/);
}));
