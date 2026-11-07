import { execFileSync } from 'node:child_process';
import { appendEvent, readJson, root, setPaused, stateDir, writeJson } from './state.mjs';

const statuses = new Set(['todo', 'approved', 'in_progress', 'waiting', 'done', 'rejected', 'open']);
const roles = new Set(['owner', 'lead', 'product', 'architect', 'developer', 'ux', 'tester', 'security', 'maintainer']);

export function validateTask(task) {
  if (!task || typeof task !== 'object' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(task.id)) throw new Error('Invalid task id');
  if (typeof task.title !== 'string' || !task.title.trim() || task.title.length > 200) throw new Error('Invalid title');
  if (!statuses.has(task.status)) throw new Error('Invalid task status');
  if (task.agent != null && !roles.has(task.agent)) throw new Error('Invalid role');
  if (task.budget != null && (!Number.isSafeInteger(task.budget) || task.budget < 0)) throw new Error('Invalid budget');
  if (task.steps != null && (!Number.isSafeInteger(task.steps) || task.steps < 0)) throw new Error('Invalid steps');
  if (task.detail != null && (typeof task.detail !== 'string' || task.detail.length > 4000)) throw new Error('Invalid detail');
  return task;
}

export function addTask(task, directory = stateDir) {
  validateTask(task);
  const tasks = readJson('tasks.json', [], directory);
  if (!Array.isArray(tasks)) throw new Error('Invalid task list');
  if (tasks.some((item) => item.id === task.id)) throw new Error('Task already exists');
  tasks.push(task);
  writeJson('tasks.json', tasks, directory);
  appendEvent('task', `Created ${task.id}`, directory);
  return task;
}

export function decideTask(id, decision, directory = stateDir, tagRestore = defaultTagRestore) {
  if (decision !== 'approved' && decision !== 'rejected') throw new Error('Invalid decision');
  const tasks = readJson('tasks.json', [], directory);
  if (!Array.isArray(tasks)) throw new Error('Invalid task list');
  const task = tasks.find((item) => item.id === id);
  if (!task || task.status !== 'waiting') throw new Error('Task is not waiting for approval');
  validateTask(task);
  if (decision === 'approved' && task.big) {
    tagRestore(task.id);
    task.restore = `restore/${task.id}`;
  }
  task.status = decision;
  writeJson('tasks.json', tasks, directory);
  appendEvent(decision, `${id}: ${task.title}`, directory);
  return task;
}

function defaultTagRestore(id) {
  const tag = `restore/${id}`;
  execFileSync('git', ['tag', tag, 'HEAD'], { cwd: root, stdio: 'pipe' });
}

const protectedPaths = [
  /^server\.mjs$/i,
  /^devboard\/(?:server|workflow|state)\.mjs$/i,
  /^\.github\/workflows\//i,
  /^deploy(?:ment)?[^/]*$/i,
];

export function checkAction({ paused, tasks, toolName = '', toolInput = {} }) {
  if (paused) return 'Work is paused in devboard.';
  const input = JSON.stringify(toolInput).replaceAll('\\\\', '/');
  const command = String(toolInput.cmd || toolInput.command || '');
  const edits = /apply_patch|edit|write/i.test(toolName) || (/exec_command|shell/i.test(toolName) && /Set-Content|Add-Content|Out-File|Move-Item|Remove-Item|git apply|\bpatch\b|\btee\b/i.test(command));
  const paths = [String(toolInput.path || ''), ...[...input.matchAll(/(?:server\.mjs|devboard\/(?:server|workflow|state)\.mjs|\.github\/workflows\/[^\s"']+|deploy(?:ment)?[^\s"']*)/gi)].map((match) => match[0])];
  if (edits && paths.some((path) => protectedPaths.some((pattern) => pattern.test(path.replaceAll('\\', '/').replace(/^.*?minitab-redesign\//, ''))))) {
    if (!tasks.some((task) => task.big && (task.status === 'approved' || task.status === 'in_progress'))) {
      return 'Protected file edit requires an approved big task.';
    }
  }
  if (/\bssh\b/i.test(input) && /sqlite3|\bselect\b|\.data\//i.test(input)) return 'Production data access requires explicit owner approval.';
  return null;
}

export function recordToolCall(call, directory = stateDir) {
  const history = readJson('calls.json', [], directory);
  if (!Array.isArray(history)) throw new Error('Invalid call history');
  const signature = JSON.stringify(call);
  const recent = [...history.slice(-19), signature];
  writeJson('calls.json', recent, directory);
  if (recent.filter((entry) => entry === signature).length >= 5) {
    setPaused(true, directory);
    appendEvent('loop', 'Same tool call repeated five times in the last twenty calls', directory);
    return true;
  }
  return false;
}
