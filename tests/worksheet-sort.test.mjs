import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortWorksheetRows } from '../dist/worksheet-sort.js';

test('sorting a column moves complete rows, compares numbers, and leaves blanks last', () => {
  const rows = [['10', 'A'], ['2', 'B'], ['', 'C'], ['2', 'D']];
  assert.deepEqual(sortWorksheetRows(rows, 0), [['2', 'B'], ['2', 'D'], ['10', 'A'], ['', 'C']]);
  assert.deepEqual(sortWorksheetRows(rows, 0, 'descending'), [['10', 'A'], ['2', 'B'], ['2', 'D'], ['', 'C']]);
  assert.deepEqual(rows[0], ['10', 'A']);
});
