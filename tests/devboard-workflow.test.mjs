import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addTask, checkAction, decideTask, recordToolCall } from '../devboard/workflow.mjs';
import { readState, setPaused } from '../devboard/state.mjs';

function withState(fn) {
  const directory = mkdtempSync(join(tmpdir(), 'jmptab-devboard-'));
  try { fn(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('big approval creates restore point and changes only task state', () => withState((dir) => {
  addTask({ id: 'test-feature', title: 'Test feature', status: 'waiting', big: true, agent: 'developer' }, dir);
  const tags = [];
  const task = decideTask('test-feature', 'approved', dir, (id) => tags.push(id));
  assert.deepEqual(tags, ['test-feature']);
  assert.equal(task.restore, 'restore/test-feature');
  assert.equal(readState(dir).tasks[0].status, 'approved');
  assert.throws(() => decideTask('test-feature', 'rejected', dir), /not waiting/);
}));

test('pause and protected edits are blocked', () => withState((dir) => {
  setPaused(true, dir);
  assert.match(checkAction({ ...readState(dir), toolName: 'Read', toolInput: {} }), /paused/);
  setPaused(false, dir);
  assert.match(checkAction({ ...readState(dir), toolName: 'apply_patch', toolInput: { path: 'server.mjs' } }), /approved big/);
  assert.equal(checkAction({ paused: false, tasks: [{ big: true, status: 'approved' }], toolName: 'apply_patch', toolInput: { path: 'server.mjs' } }), null);
}));

test('repeated call pauses work', () => withState((dir) => {
  const call = { toolName: 'Read', toolInput: { file: 'x' } };
  for (let index = 0; index < 4; index++) assert.equal(recordToolCall(call, dir), false);
  assert.equal(recordToolCall(call, dir), true);
  assert.equal(readState(dir).paused, true);
}));
