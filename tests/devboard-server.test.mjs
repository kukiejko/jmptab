import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { createDevboardServer } from '../devboard/server.mjs';
import { addTask } from '../devboard/workflow.mjs';

test('devboard API reads state and validates local mutations', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'jmptab-devboard-api-'));
  const server = createDevboardServer({ directory, tagRestore: () => {} });
  async function request(path, method = 'GET', body = '', headers = {}) {
    const input = Readable.from(body ? [body] : []);
    input.url = path; input.method = method; input.headers = { host: '127.0.0.1:8765', ...headers };
    let output = '';
    const response = new Writable({ write(chunk, encoding, callback) { output += chunk.toString(); callback(); } });
    response.writeHead = (status) => { response.statusCode = status; };
    server.emit('request', input, response);
    await new Promise((resolve) => response.on('finish', resolve));
    return { status: response.statusCode, json: () => JSON.parse(output) };
  }
  try {
    addTask({ id: 'review', title: 'Review', status: 'waiting', big: true }, directory);
    const state = (await request('/api/state')).json();
    assert.equal(state.tasks.length, 1);
    const hostile = await request('/api/pause', 'POST', '{"paused":true}', { origin: 'https://example.com', 'content-type': 'application/json' });
    assert.equal(hostile.status, 403);
    const approve = await request('/api/tasks/review/decision', 'POST', '{"decision":"approved"}', { 'content-type': 'application/json' });
    assert.equal(approve.status, 200);
    assert.equal(approve.json().restore, 'restore/review');
    const pause = await request('/api/pause', 'POST', '{"paused":true}', { 'content-type': 'application/json' });
    assert.equal(pause.json().paused, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
