import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Must run before anything imports src/db/index.js, which opens DB_PATH at
// import time.
export function useTempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'psuparlay-test-'));
  process.env.DB_PATH = join(dir, 'test.db');
  delete process.env.ODDS_API_KEY;
  return () => rmSync(dir, { recursive: true, force: true });
}

export function startServer(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise(done => server.close(done)),
      });
    });
    server.on('error', reject);
  });
}

// Records and rejects any outbound request that is not to the local test
// server, so a probe that reaches ESPN or The Odds API fails the suite.
export async function guardNetwork() {
  const { default: axios } = await import('axios');
  const blocked = [];
  const realFetch = globalThis.fetch;
  const realAdapter = axios.defaults.adapter;

  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== '127.0.0.1') {
      blocked.push(url.href);
      return Promise.reject(new Error(`Blocked outbound fetch to ${url.href}`));
    }
    return realFetch(input, init);
  };
  axios.defaults.adapter = config => {
    blocked.push(config.url);
    return Promise.reject(new Error(`Blocked outbound axios request to ${config.url}`));
  };

  return {
    blocked,
    restore() {
      globalThis.fetch = realFetch;
      axios.defaults.adapter = realAdapter;
    },
  };
}
