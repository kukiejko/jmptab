import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideTask } from './workflow.mjs';
import { agents } from './agents.mjs';
import { readState, setPaused, stateDir } from './state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')).version;

function reply(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(typeof body === 'string' ? body : JSON.stringify(body));
}

export function createDevboardServer({ directory = stateDir, tagRestore } = {}) {
  const startedAt = new Date().toISOString();
  return createServer(async (request, response) => {
    try {
      const host = request.headers.host;
      if (host && !/^127\.0\.0\.1(?::\d+)?$/.test(host) && !/^localhost(?::\d+)?$/.test(host)) return reply(response, 403, { error: 'Local access only' });
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/') return reply(response, 200, readFileSync(join(here, 'index.html'), 'utf8'), 'text/html; charset=utf-8');
      if (request.method === 'GET' && url.pathname === '/api/state') return reply(response, 200, { ...readState(directory), agents, version, startedAt });
      if (request.method !== 'POST') return reply(response, 404, { error: 'Not found' });
      const origin = request.headers.origin;
      if (origin && origin !== `http://${host}`) return reply(response, 403, { error: 'Invalid origin' });
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') return reply(response, 415, { error: 'JSON required' });
      let raw = '';
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 8192) return reply(response, 413, { error: 'Request too large' });
      }
      const body = JSON.parse(raw || '{}');
      if (url.pathname === '/api/pause' && typeof body.paused === 'boolean') {
        setPaused(body.paused, directory);
        return reply(response, 200, { paused: body.paused });
      }
      const match = /^\/api\/tasks\/([a-z0-9][a-z0-9-]{0,63})\/decision$/.exec(url.pathname);
      if (match && (body.decision === 'approved' || body.decision === 'rejected')) {
        return reply(response, 200, decideTask(match[1], body.decision, directory, tagRestore));
      }
      return reply(response, 400, { error: 'Invalid action' });
    } catch (error) {
      const status = error instanceof SyntaxError || /Invalid|not waiting|already exists/.test(error.message) ? 400 : 500;
      return reply(response, status, { error: error.message });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv[2] || 8765);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be 1–65535');
  createDevboardServer().listen(port, '127.0.0.1', () => console.log(`Devboard: http://127.0.0.1:${port}`));
}
