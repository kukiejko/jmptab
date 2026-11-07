import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { writeJson } from './state.mjs';

const state = { status: 'running', startedAt: new Date().toISOString(), done: 0, total: null, failures: 0, current: '' };
writeJson('tests.json', state);
const files = readdirSync('tests').filter((name) => name.endsWith('.test.mjs')).map((name) => `tests/${name}`);
const child = spawn(process.execPath, ['--test', '--test-reporter=tap', ...files], { stdio: ['inherit', 'pipe', 'inherit'] });
let pending = '';
child.stdout.on('data', (data) => {
  process.stdout.write(data);
  pending += data.toString();
  const lines = pending.split(/\r?\n/);
  pending = lines.pop();
  for (const line of lines) {
    const current = /^# Subtest: (.+)$/.exec(line);
    if (current) state.current = current[1];
    if (/^ok \d+ - /.test(line)) state.done++;
    if (/^not ok \d+ - /.test(line)) { state.done++; state.failures++; }
    const total = /^1\.\.(\d+)$/.exec(line);
    if (total) state.total = Number(total[1]);
    writeJson('tests.json', state);
  }
});
child.on('close', (code) => {
  state.status = code === 0 ? 'finished' : 'failed';
  state.finishedAt = new Date().toISOString();
  state.current = '';
  writeJson('tests.json', state);
  process.exitCode = code ?? 1;
});
