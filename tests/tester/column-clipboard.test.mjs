import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRows } from '../../dist/row-selection.js';
import { columnsClipboardText, pasteColumns } from '../../dist/worksheet-structure.js';

test('Shift selects a column range and Ctrl toggles individual columns', () => {
  const first = selectRows(new Set(), 1, null);
  const range = selectRows(first.selected, 3, first.anchor, { shift: true });
  assert.deepEqual([...range.selected], [1, 2, 3]);
  const added = selectRows(range.selected, 5, range.anchor, { toggle: true });
  assert.deepEqual([...added.selected], [1, 2, 3, 5]);
  const removed = selectRows(added.selected, 2, added.anchor, { toggle: true });
  assert.deepEqual([...removed.selected], [1, 3, 5]);
});

test('copying selected columns preserves worksheet order, headers, and blank cells', () => {
  const data = { headers: ['A', 'B', 'C'], rows: [['1', 'x', '3'], ['', 'y', '']] };
  assert.equal(columnsClipboardText(data, new Set([2, 0])), 'A\tC\n1\t3\n\t');
});

test('pasting whole columns at a header replaces headers and cells and adds columns when needed', () => {
  const data = { headers: ['Old', 'Other'], roles: ['X1', 'Y1'], rows: [['a', 'b'], ['c', 'd']] };
  assert.deepEqual(pasteColumns(data, 1, 'New\tExtra\n7\t8\n\t9'), { columns: 2, rows: 2 });
  assert.deepEqual(data.headers, ['Old', 'New', 'Extra']);
  assert.deepEqual(data.roles, ['X1', 'Y1', '']);
  assert.deepEqual(data.rows, [['a', '7', '8'], ['c', '', '9']]);
});

test('oversized column paste leaves worksheet unchanged', () => {
  const data = { headers: ['A'], rows: [['1']] };
  assert.throws(() => pasteColumns(data, 16_383, 'A\tB\n1\t2'), /16,384 columns/);
  assert.deepEqual(data, { headers: ['A'], rows: [['1']] });
});

test('pasting a whole column clears old values below the copied data', () => {
  const data = { headers: ['A'], rows: [['old'], ['stale'], ['stale']] };
  pasteColumns(data, 0, 'New\nfresh');
  assert.deepEqual(data.rows, [['fresh'], [''], ['']]);
});
