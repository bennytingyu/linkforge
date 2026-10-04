import { randomBytes } from 'node:crypto';

export const reservedCodes = new Set(['api', 'assets', 'favicon', 'robots']);

function copy(link) {
  return link ? { ...link } : undefined;
}

export function createStore() {
  const links = new Map();

  return {
    list() {
      return [...links.values()].reverse().map(copy);
    },
    get(code) {
      return copy(links.get(code));
    },
    create({ url, customAlias }) {
      let code = customAlias;
      if (code && (links.has(code) || reservedCodes.has(code.toLowerCase()))) {
        const error = new Error('That alias is already in use. Choose another.');
        error.status = 409;
        throw error;
      }
      if (!code) {
        do {
          code = randomBytes(5).toString('base64url');
        } while (links.has(code) || reservedCodes.has(code.toLowerCase()));
      }
      const link = { code, url, createdAt: new Date().toISOString(), clicks: 0 };
      links.set(code, link);
      return copy(link);
    },
    delete(code) {
      return links.delete(code);
    },
    incrementClicks(code) {
      const link = links.get(code);
      if (!link) return undefined;
      link.clicks += 1;
      return copy(link);
    }
  };
}
