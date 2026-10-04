import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { createApp } from '../src/server.js';

async function startApi(t) {
  const server = createApp({ baseUrl: 'https://sho.rt' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body))
    });
    const body = response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : await response.text();
    return { response, body };
  };
}

test('health check and a fresh link list use data envelopes', async (t) => {
  const request = await startApi(t);
  const health = await request('/api/health');
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.body, { data: { status: 'ok' } });
  assert.deepEqual((await request('/api/links')).body, { data: [] });
});

test('production dashboard and its assets are served from the built frontend', {
  skip: !existsSync(new URL('../../web/dist/index.html', import.meta.url))
}, async (t) => {
  const request = await startApi(t);
  const { response, body } = await request('/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(body, /id="root"/);
  const assets = [...body.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map((match) => match[1]);
  assert.ok(assets.length >= 2);
  for (const asset of assets) {
    assert.equal((await request(asset)).response.status, 200, asset);
  }
});

test('create a generated short link and retrieve it in the list', async (t) => {
  const request = await startApi(t);
  const url = 'https://example.com/article?source=linkforge';
  const { response, body } = await request('/api/links', { method: 'POST', body: { url } });
  assert.equal(response.status, 201);
  assert.match(body.data.code, /^[a-zA-Z0-9_-]+$/);
  assert.equal(body.data.url, url);
  assert.equal(body.data.shortUrl, `https://sho.rt/${body.data.code}`);
  assert.equal(body.data.clicks, 0);
  assert.ok(Number.isFinite(Date.parse(body.data.createdAt)));
  assert.deepEqual((await request('/api/links')).body.data, [body.data]);
});

test('custom aliases retain case and allow hyphens and underscores', async (t) => {
  const request = await startApi(t);
  const { response, body } = await request('/api/links', {
    method: 'POST', body: { url: 'http://example.com/page', customAlias: 'My_Link-42' }
  });
  assert.equal(response.status, 201);
  assert.equal(body.data.code, 'My_Link-42');
  assert.equal(body.data.shortUrl, 'https://sho.rt/My_Link-42');
});

test('duplicate aliases return conflict without replacing the original link', async (t) => {
  const request = await startApi(t);
  const first = await request('/api/links', {
    method: 'POST', body: { url: 'https://example.com/first', customAlias: 'same-code' }
  });
  const duplicate = await request('/api/links', {
    method: 'POST', body: { url: 'https://example.com/second', customAlias: 'same-code' }
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(typeof duplicate.body.error, 'string');
  assert.deepEqual((await request('/api/links')).body.data, [first.body.data]);
});

test('invalid and unsafe destination URLs are rejected without creating links', async (t) => {
  const request = await startApi(t);
  for (const url of [undefined, null, 42, '', 'example.com', '/relative', 'ftp://example.com',
    'javascript:alert(1)', 'https://user:secret@example.com/']) {
    const { response, body } = await request('/api/links', { method: 'POST', body: { url } });
    assert.equal(response.status, 400, `URL ${JSON.stringify(url)}`);
    assert.equal(typeof body.error, 'string');
  }
  assert.deepEqual((await request('/api/links')).body.data, []);
});

test('custom aliases enforce type, length, and allowed characters', async (t) => {
  const request = await startApi(t);
  for (const customAlias of [null, 42, '', 'ab', 'a'.repeat(33), 'has spaces', 'slash/code', 'café']) {
    const { response, body } = await request('/api/links', {
      method: 'POST', body: { url: 'https://example.com/', customAlias }
    });
    assert.equal(response.status, 400, `Alias ${JSON.stringify(customAlias)}`);
    assert.equal(typeof body.error, 'string');
  }
});

test('a redirect returns the destination and counts clicks', async (t) => {
  const request = await startApi(t);
  await request('/api/links', {
    method: 'POST', body: { url: 'https://example.com/target?x=1', customAlias: 'redirect-test' }
  });
  const head = await request('/redirect-test', { method: 'HEAD', redirect: 'manual' });
  assert.equal(head.response.status, 302);
  assert.equal((await request('/api/links')).body.data[0].clicks, 0);
  for (let clicks = 1; clicks <= 2; clicks += 1) {
    // Following the redirect would leave the test server.
    const { response } = await request('/redirect-test', { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://example.com/target?x=1');
    const list = await request('/api/links');
    assert.equal(list.body.data[0].clicks, clicks);
  }
});

test('malformed JSON returns an error envelope instead of an HTML stack trace', async (t) => {
  const request = await startApi(t);
  const { response, body } = await request('/api/links', { method: 'POST', rawBody: '{' });
  assert.equal(response.status, 400);
  assert.equal(typeof body.error, 'string');
  assert.equal(body.data, undefined);
});

test('reserved aliases are rejected regardless of case', async (t) => {
  const request = await startApi(t);
  for (const customAlias of ['api', 'API', 'assets', 'favicon', 'robots']) {
    const { response, body } = await request('/api/links', {
      method: 'POST', body: { url: 'https://example.com/', customAlias }
    });
    assert.equal(response.status, 409);
    assert.equal(typeof body.error, 'string');
  }
});

test('URLs are normalized and links are listed newest first', async (t) => {
  const request = await startApi(t);
  const first = await request('/api/links', {
    method: 'POST', body: { url: '  HTTPS://EXAMPLE.COM  ', customAlias: 'first-link' }
  });
  assert.equal(first.response.status, 201);
  assert.equal(first.body.data.url, 'https://example.com/');
  const second = await request('/api/links', {
    method: 'POST', body: { url: 'https://example.org/', customAlias: 'second-link' }
  });
  assert.deepEqual((await request('/api/links')).body.data, [second.body.data, first.body.data]);
});

test('excessive URLs and request bodies return structured errors', async (t) => {
  const request = await startApi(t);
  const longUrl = await request('/api/links', {
    method: 'POST', body: { url: `https://example.com/${'a'.repeat(8192)}` }
  });
  assert.equal(longUrl.response.status, 400);
  assert.equal(typeof longUrl.body.error, 'string');
  const largeBody = await request('/api/links', {
    method: 'POST', body: { url: 'https://example.com/', padding: 'a'.repeat(20000) }
  });
  assert.equal(largeBody.response.status, 413);
  assert.equal(typeof largeBody.body.error, 'string');
});

test('deleting a link removes it and missing links return JSON errors', async (t) => {
  const request = await startApi(t);
  await request('/api/links', {
    method: 'POST', body: { url: 'https://example.com/', customAlias: 'delete-me' }
  });
  const deleted = await request('/api/links/delete-me', { method: 'DELETE' });
  assert.equal(deleted.response.status, 200);
  assert.deepEqual(deleted.body, { data: { deleted: true } });
  assert.deepEqual((await request('/api/links')).body.data, []);
  for (const [path, method] of [['/api/links/delete-me', 'DELETE'], ['/delete-me', 'GET'], ['/api/nope', 'GET']]) {
    const { response, body } = await request(path, { method });
    assert.equal(response.status, 404);
    assert.equal(typeof body.error, 'string');
  }
});

test('editing a destination preserves its alias, clicks, date, and list position', async (t) => {
  const request = await startApi(t);
  const first = await request('/api/links', {
    method: 'POST', body: { url: 'https://example.com/old', customAlias: 'first-link' }
  });
  await request('/first-link', { redirect: 'manual' });
  const second = await request('/api/links', {
    method: 'POST', body: { url: 'https://example.org/', customAlias: 'second-link' }
  });
  const updated = await request('/api/links/first-link', {
    method: 'PATCH', body: { url: '  HTTPS://EXAMPLE.COM/new  ' }
  });
  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.body.data, { ...first.body.data, url: 'https://example.com/new', clicks: 1 });
  assert.deepEqual((await request('/api/links')).body.data, [second.body.data, updated.body.data]);
  const redirect = await request('/first-link', { redirect: 'manual' });
  assert.equal(redirect.response.headers.get('location'), 'https://example.com/new');
});

test('renaming replaces the old redirect and supports subsequent edits and deletion', async (t) => {
  const request = await startApi(t);
  const original = await request('/api/links', {
    method: 'POST', body: { url: 'https://example.com/', customAlias: 'old-code' }
  });
  await request('/old-code', { redirect: 'manual' });
  const renamed = await request('/api/links/old-code', {
    method: 'PATCH', body: { customAlias: 'New_Code-42' }
  });
  assert.equal(renamed.response.status, 200);
  assert.deepEqual(renamed.body.data, {
    ...original.body.data, code: 'New_Code-42', shortUrl: 'https://sho.rt/New_Code-42', clicks: 1
  });
  assert.equal((await request('/old-code', { redirect: 'manual' })).response.status, 404);
  assert.equal((await request('/New_Code-42', { redirect: 'manual' })).response.status, 302);
  const edited = await request('/api/links/New_Code-42', {
    method: 'PATCH', body: { url: 'https://example.org/new', customAlias: 'New_Code-42' }
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.body.data.clicks, 2);
  assert.equal((await request('/api/links/New_Code-42', { method: 'DELETE' })).response.status, 200);
});

test('invalid and conflicting edits leave all links unchanged', async (t) => {
  const request = await startApi(t);
  for (const customAlias of ['edit-me', 'taken-code']) {
    await request('/api/links', { method: 'POST', body: { url: 'https://example.com/', customAlias } });
  }
  const before = (await request('/api/links')).body;
  for (const body of [null, [], {}, { unrelated: true }, { url: null }, { url: 'ftp://example.com' },
    { url: 'https://user:secret@example.com/' }, { url: `https://example.com/${'a'.repeat(8192)}` },
    { customAlias: '' }, { customAlias: null }, { customAlias: 'ab' },
    { customAlias: 'a'.repeat(33) }, { customAlias: 'has spaces' }]) {
    const updated = await request('/api/links/edit-me', { method: 'PATCH', body });
    assert.equal(updated.response.status, 400);
    assert.equal(typeof updated.body.error, 'string');
  }
  for (const customAlias of ['taken-code', 'API', 'assets', 'robots', 'favicon']) {
    const updated = await request('/api/links/edit-me', {
      method: 'PATCH', body: { url: 'https://example.org/changed', customAlias }
    });
    assert.equal(updated.response.status, 409);
    assert.equal(typeof updated.body.error, 'string');
  }
  assert.deepEqual((await request('/api/links')).body, before);
  const missing = await request('/api/links/missing-code', { method: 'PATCH', body: { customAlias: 'new-code' } });
  assert.equal(missing.response.status, 404);
  assert.equal(typeof missing.body.error, 'string');
});
