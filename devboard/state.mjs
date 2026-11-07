import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const stateDir = join(root, '.devboard', 'state');

export function readJson(name, fallback, directory = stateDir) {
  try {
    return JSON.parse(readFileSync(join(directory, name), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export function writeJson(name, value, directory = stateDir) {
  mkdirSync(directory, { recursive: true });
  const target = join(directory, name);
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, target);
}

export function appendEvent(type, detail, directory = stateDir) {
  mkdirSync(directory, { recursive: true });
  appendFileSync(join(directory, 'events.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), type, detail })}\n`);
}

export function readState(directory = stateDir) {
  const tasks = readJson('tasks.json', [], directory);
  if (!Array.isArray(tasks)) throw new Error('tasks.json must contain an array');
  const eventFile = join(directory, 'events.jsonl');
  const events = existsSync(eventFile)
    ? readFileSync(eventFile, 'utf8').trim().split('\n').filter(Boolean).slice(-60).map((line) => JSON.parse(line)).reverse()
    : [];
  return {
    paused: existsSync(join(directory, 'PAUSE')),
    tasks,
    events,
    tests: readJson('tests.json', null, directory),
  };
}

export function setPaused(paused, directory = stateDir) {
  mkdirSync(directory, { recursive: true });
  const pauseFile = join(directory, 'PAUSE');
  if (paused) writeFileSync(pauseFile, `${new Date().toISOString()}\n`);
  else if (existsSync(pauseFile)) unlinkSync(pauseFile);
  appendEvent(paused ? 'pause' : 'resume', paused ? 'Work paused' : 'Work resumed', directory);
}
