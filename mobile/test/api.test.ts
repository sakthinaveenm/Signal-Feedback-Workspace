import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, normalizeUrl, SignalApi } from '../src/api';
const connection = { url: 'https://api.example.com', key: 'test-only-key-never-used-for-real-access' };
test('normalizes backend origins and rejects credentials, unsafe protocols and paths', () => {
  assert.equal(normalizeUrl(' https://api.example.com/v1/ '), connection.url);
  assert.throws(() => normalizeUrl('http://api.example.com'));
  assert.equal(normalizeUrl('http://10.0.2.2:3001', true), 'http://10.0.2.2:3001');
  for (const url of ['https://user:password@api.example.com', 'https://api.example.com/admin', 'file:///tmp/api', 'https://api.example.com?key=secret']) assert.throws(() => normalizeUrl(url));
});
test('authenticates and encodes filters and pagination without putting the key in URLs', async () => {
  let seenUrl = ''; let seenOptions: RequestInit | undefined;
  const transport: typeof fetch = async (url, options) => {
    seenUrl = String(url); seenOptions = options;
    return Response.json({ items: [], total: 0, page: 2, pages: 0, limit: 25 });
  };
  const api = new SignalApi(connection, transport);
  await api.feedback({ search: 'a & b', status: 'In progress', projectId: 'project-id' }, 2);
  const url = new URL(seenUrl);
  assert.equal(url.searchParams.get('search'), 'a & b');
  assert.equal(url.searchParams.get('status'), 'In progress');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(new Headers(seenOptions?.headers).get('Authorization'), `Bearer ${connection.key}`);
  assert.ok(!seenUrl.includes(connection.key));
});
test('sends creation and updates using the backend field names', async () => {
  const requests: { url: string; options?: RequestInit }[] = [];
  const api = new SignalApi(connection, async (url, options) => { requests.push({ url: String(url), options }); return Response.json({ id: 'report' }); });
  await api.createFeedback({ projectId: 'p', title: 'Crash', description: '', type: 'Bug', source: 'Mobile', priority: 'High', contact: '' });
  await api.updateFeedback('report-id', { status: 'Resolved', priority: 'Low', notes: 'Fixed' });
  assert.equal(requests[0].options?.method, 'POST');
  assert.equal(JSON.parse(String(requests[0].options?.body)).projectId, 'p');
  assert.equal(requests[1].options?.method, 'PATCH');
  assert.equal(requests[1].url, `${connection.url}/v1/feedback/report-id`);
  assert.equal(JSON.parse(String(requests[1].options?.body)).status, 'Resolved');
});
test('handles authentication and rate limiting with actionable messages', async () => {
  for (const status of [401, 429]) {
    const api = new SignalApi(connection, async () => Response.json({ message: 'error' }, { status }));
    await assert.rejects(() => api.projects(), error => error instanceof ApiError && error.status === status && /key|minute/.test(error.message));
  }
});
test('preserves validation messages and handles unreachable or invalid backends', async () => {
  const invalid = new SignalApi(connection, async () => Response.json({ message: ['title is required', 'invalid source'] }, { status: 400 }));
  await assert.rejects(() => invalid.projects(), /title is required\ninvalid source/);
  const network = new SignalApi(connection, async () => { throw new TypeError('Network request failed'); });
  await assert.rejects(() => network.projects(), /Cannot reach/);
  const html = new SignalApi(connection, async () => new Response('<html>wrong host</html>'));
  await assert.rejects(() => html.projects(), /invalid response/);
});
