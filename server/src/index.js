import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './server.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const parsedBaseUrl = new URL(baseUrl);
if (!['http:', 'https:'].includes(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password || parsedBaseUrl.search || parsedBaseUrl.hash || parsedBaseUrl.pathname !== '/') {
  throw new Error('BASE_URL must be an HTTP or HTTPS origin without credentials, a path, query, or fragment.');
}

const server = createApp({ baseUrl }).listen(port, () => {
  console.log(`Linkforge API listening at http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
