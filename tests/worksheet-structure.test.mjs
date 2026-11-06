import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnClipboardText, insertColumn, insertRow, moveColumn } from '../dist/worksheet-structure.js';

test('column insertion and movement keep headers, roles, and row values together', () => {
  const data = { headers: ['A', 'B'], roles: ['X1', 'Y1'], rows: [['1', '2'], ['3', '4']] };
  insertColumn(data, 1);
  assert.deepEqual(data.roles, ['X1', '', 'Y1']);
  assert.deepEqual(data.rows[0], ['1', '', '2']);
  moveColumn(data, 2, 0);
  assert.deepEqual(data.headers, ['B', 'A', 'Column 3']);
  assert.deepEqual(data.roles, ['Y1', 'X1', '']);
  assert.deepEqual(data.rows, [['2', '1', ''], ['4', '3', '']]);
});

test('row insertion adds a complete blank row at the chosen position', () => {
  const data = { headers: ['A', 'B'], rows: [['1', '2'], ['3', '4']] };
  insertRow(data, 1);
  assert.deepEqual(data.rows, [['1', '2'], ['', ''], ['3', '4']]);
});

test('copying a column includes its name and every row, including blanks', () => {
  const data = { headers: ['A', 'B'], rows: [['1', 'x'], ['', 'y'], ['3', 'z']] };
  assert.equal(columnClipboardText(data, 0), 'A\n1\n\n3');
});
