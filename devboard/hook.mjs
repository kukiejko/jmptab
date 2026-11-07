import { readFileSync } from 'node:fs';
import { appendEvent, readState } from './state.mjs';
import { checkAction, recordToolCall } from './workflow.mjs';

const mode = process.argv[2];
try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const call = { toolName: input.tool_name || '', toolInput: input.tool_input || {} };
  if (mode === 'pre') {
    const state = readState();
    const reason = checkAction({ paused: state.paused, tasks: state.tasks, ...call });
    if (reason) { appendEvent('blocked', reason); console.error(reason); process.exitCode = 2; }
  } else if (mode === 'post') {
    if (recordToolCall(call)) { console.error('Repeated tool call loop detected. Work paused; diagnose before resuming.'); process.exitCode = 2; }
  } else throw new Error('Expected pre or post');
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
