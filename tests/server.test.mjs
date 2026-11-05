import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequestHandler } from '../server.mjs';

function request(handler, url) {
  return new Promise(resolve => {
    const response = {
      status: 200,
      headers: {},
      writeHead(status, headers = {}) { this.status = status; Object.assign(this.headers, headers); },
      setHeader(name, value) { this.headers[name] = value; },
      end(body = '') { resolve({ status: this.status, headers: this.headers, body: String(body) }); }
    };
    handler({ url }, response);
  });
}

test('server exposes deployment metadata and serves the app', async () => {
  const deployedAt = '2026-11-05T12:34:56.000Z';
  const handler = createRequestHandler({ deployedAt });
  const info = await request(handler, '/app-info.json');
  assert.equal(info.status, 200);
  assert.equal(info.headers['Cache-Control'], 'no-store');
  const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(JSON.parse(info.body), { version, deployedAt });

  const page = await request(handler, '/');
  assert.equal(page.status, 200);
  assert.match(page.body, /id="appVersion"/);

  assert.equal((await request(handler, '/missing.txt')).status, 404);
  assert.equal((await request(handler, '/%ZZ')).status, 400);
});
