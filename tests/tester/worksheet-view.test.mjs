import test from 'node:test';
import assert from 'node:assert/strict';
import { validPageSize, worksheetRowsForView, pageNumberForRow } from '../../dist/worksheet-view.js';
import { groupedNumber } from '../../dist/number-display.js';
import { fmt } from '../../dist/result-format.js';

test('first and last page mode shows each edge page with an omitted range', () => {
  const rows = Array.from({ length: 1_000_000 }, (_, index) => [index + 1]);
  const view = worksheetRowsForView(rows, 1, 'edges');
  assert.equal(view.length, 401);
  assert.deepEqual(view[0], { row: rows[0], index: 0 });
  assert.deepEqual(view[199], { row: rows[199], index: 199 });
  assert.deepEqual(view[200], { omitted: 999_600, first: 201, last: 999_800 });
  assert.deepEqual(view[201], { row: rows[999_800], index: 999_800 });
  assert.deepEqual(view[400], { row: rows[999_999], index: 999_999 });
  assert.deepEqual(worksheetRowsForView(rows, 1, 'first').map(item => item.index), Array.from({ length: 200 }, (_, index) => index));
  assert.deepEqual(worksheetRowsForView(rows, 2, 'all').map(item => item.index), Array.from({ length: 200 }, (_, index) => index + 200));
});

test('small worksheet stays fully visible and large chart numbers use spaces', () => {
  const rows = Array.from({ length: 200 }, (_, index) => [index]);
  assert.equal(worksheetRowsForView(rows, 1, 'edges').length, 200);
  assert.equal(groupedNumber(1_000_000), '1 000 000');
  assert.equal(fmt(190_716, 0), '190 716');
});

test('user page size changes full-page and edge boundaries', () => {
  const rows = Array.from({ length: 251 }, (_, index) => [index]);
  assert.equal(validPageSize(1), true);
  assert.equal(validPageSize(1000), true);
  assert.equal(validPageSize(0), false);
  assert.equal(validPageSize(1001), false);
  assert.equal(validPageSize(2.5), false);
  assert.deepEqual(worksheetRowsForView(rows, 2, 'all', 50).map(item => item.index), Array.from({ length: 50 }, (_, index) => index + 50));
  assert.equal(worksheetRowsForView(rows, 1, 'edges', 50)[50].omitted, 200);
  assert.deepEqual([0, 49, 50, 99, 100].map(index => pageNumberForRow(index, 50)), [1, 1, 2, 2, 3]);
  assert.equal(pageNumberForRow(999_999, 200), 5000);
});

test('30% row sample is spread across each browsable page', () => {
  const rows = Array.from({ length: 450 }, (_, index) => [String(index)]);
  for (const [page, start, end, count] of [[1, 0, 199, 60], [2, 200, 399, 60], [3, 400, 449, 15]]) {
    const indices = worksheetRowsForView(rows, page, 'sample').map(item => item.index);
    assert.equal(indices.length, count);
    assert.equal(indices[0], start);
    assert.equal(indices.at(-1), end);
    assert.equal(new Set(indices).size, count);
    assert.ok(indices.every(index => index >= start && index <= end));
  }
});
