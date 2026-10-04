import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createStore, reservedCodes } from './store.js';

const webDist = fileURLToPath(new URL('../../web/dist/', import.meta.url));

function validateInput(body) {
  if (!body || typeof body.url !== 'string' || !/^https?:\/\//i.test(body.url.trim())) {
    return 'Enter an absolute HTTP or HTTPS URL.';
  }
  if (body.url.length > 8192) return 'URL must be 8192 characters or fewer.';
  try {
    const url = new URL(body.url.trim());
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
      return 'Enter an absolute HTTP or HTTPS URL.';
    }
    if (url.username || url.password) return 'URLs containing credentials are not allowed.';
  } catch {
    return 'Enter an absolute HTTP or HTTPS URL.';
  }
  if (body.customAlias !== undefined && (
    typeof body.customAlias !== 'string' || !/^[A-Za-z0-9_-]{3,32}$/.test(body.customAlias)
  )) {
    return 'Custom alias must contain 3–32 letters, numbers, underscores, or hyphens.';
  }
  return undefined;
}

export function createApp({ store = createStore(), baseUrl = 'http://localhost:3000' } = {}) {
  const app = express();
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const serialize = (link) => ({ ...link, shortUrl: `${normalizedBaseUrl}/${link.code}` });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (req, res) => {
    res.json({ data: { status: 'ok' } });
  });

  app.get('/api/links', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ data: store.list().map(serialize) });
  });

  app.post('/api/links', (req, res) => {
    const error = validateInput(req.body);
    if (error) return res.status(400).json({ error });
    const link = store.create({ url: new URL(req.body.url.trim()).href, customAlias: req.body.customAlias });
    return res.status(201).json({ data: serialize(link) });
  });

  app.patch('/api/links/:code', (req, res) => {
    const current = store.get(req.params.code);
    if (!current) return res.status(404).json({ error: 'Short link not found.' });
    const body = req.body;
    if (!body || Array.isArray(body) || typeof body !== 'object' ||
      (!Object.hasOwn(body, 'url') && !Object.hasOwn(body, 'customAlias'))) {
      return res.status(400).json({ error: 'Provide a destination URL or custom alias to update.' });
    }
    const input = {
      url: Object.hasOwn(body, 'url') ? body.url : current.url,
      customAlias: Object.hasOwn(body, 'customAlias') ? body.customAlias : current.code
    };
    const error = validateInput(input);
    if (error) return res.status(400).json({ error });
    const link = store.update(current.code, { ...input, url: new URL(input.url.trim()).href });
    return res.json({ data: serialize(link) });
  });

  app.delete('/api/links/:code', (req, res) => {
    if (!store.delete(req.params.code)) {
      return res.status(404).json({ error: 'Short link not found.' });
    }
    return res.json({ data: { deleted: true } });
  });

  // Keep unknown API paths out of the short-link redirect route.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (existsSync(`${webDist}/index.html`)) {
    app.use('/assets', express.static(`${webDist}/assets`));
    // The trusted build path may live inside a hidden directory (such as .codex).
    app.get('/', (req, res) => res.sendFile(`${webDist}/index.html`, { dotfiles: 'allow' }));
  }

  app.get('/:code', (req, res) => {
    if (reservedCodes.has(req.params.code.toLowerCase())) {
      return res.status(404).json({ error: 'Short link not found.' });
    }
    const link = req.method === 'HEAD'
      ? store.get(req.params.code)
      : store.incrementClicks(req.params.code);
    if (!link) return res.status(404).json({ error: 'Short link not found.' });
    res.set('Cache-Control', 'no-store');
    return res.redirect(302, link.url);
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found.' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    return res.status(status).json({ error: status === 500 ? 'An unexpected server error occurred.' : error.message });
  });

  return app;
}
