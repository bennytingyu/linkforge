import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

test('running API supports the complete short-link lifecycle', {
  skip: process.env.RUN_INTEGRATION !== '1'
}, async (t) => {
  const code = `test-${crypto.randomUUID().slice(0, 8)}`;
  const destination = 'https://example.com/integration';
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { data: { status: 'ok' } });

  const created = await fetch(`${baseUrl}/api/links`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: destination, customAlias: code })
  });
  assert.equal(created.status, 201);
  t.after(async () => { await fetch(`${baseUrl}/api/links/${code}`, { method: 'DELETE' }); });
  const link = (await created.json()).data;
  assert.equal(link.code, code);
  assert.equal(link.url, destination);

  const redirect = await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), destination);
  const list = await (await fetch(`${baseUrl}/api/links`)).json();
  assert.equal(list.data.find((entry) => entry.code === code).clicks, 1);

  const deleted = await fetch(`${baseUrl}/api/links/${code}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { data: { deleted: true } });
  const missing = await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });
  assert.equal(missing.status, 404);
  assert.equal(typeof (await missing.json()).error, 'string');
});
