import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCommand, parseCommands } from '../../dist/command-script.js';

test('analysis command roundtrips options and column positions', () => {
  const spec = { type:'capability', responseIndex:2, predictorIndex:0, options:{lsl:null,usl:6} };
  assert.deepEqual(parseCommands(formatCommand(spec)), [spec]);
});

test('command file rejects unknown commands and excessive length', () => {
  assert.throws(() => parseCommands('RUN eval RESPONSE C1 PREDICTOR C2 OPTIONS {}'),/Invalid command/);
  assert.throws(() => parseCommands('RUN summary RESPONSE C0 PREDICTOR C2 OPTIONS {}'),/Invalid command/);
  assert.throws(() => parseCommands(Array(101).fill(formatCommand({type:'summary',responseIndex:0,predictorIndex:1})).join('\n')),/1 to 100/);
});
