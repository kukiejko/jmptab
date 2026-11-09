import test from 'node:test';
import assert from 'node:assert/strict';
import { scatterRowsInBounds } from '../../dist/scatter-row-selection.js';
import { worksheetRowsForView } from '../../dist/worksheet-view.js';

test('scatter rectangle selects every source row, including points beyond the drawn sample', () => {
  const rows = Array.from({ length: 2000 }, (_, index) => [String(index), String(index % 5)]);
  const selected = scatterRowsInBounds(rows, { xColumn: 0, yColumn: 1 },
    { xmin: 900, xmax: 1100, ymin: 2, ymax: 3 });
  assert.equal(selected.size, 80);
  assert.ok(selected.has(902));
  assert.ok(selected.has(1098));
  assert.deepEqual(worksheetRowsForView(rows, 1, 'selected', 2, selected).map(item => item.index), [902, 903]);
});

test('scatter rectangle uses date coordinates and excludes incomplete grouped pairs', () => {
  const rows = [
    ['2025-01-01', '2', 'A'],
    ['2025-01-02', '3', 'A'],
    ['2025-01-02', '3', ''],
    ['bad date', '3', 'A'],
    ['2025-01-03', '', 'A']
  ];
  const selected = scatterRowsInBounds(rows,
    { xColumn: 0, yColumn: 1, groupColumn: 2, xFormat: 'date' },
    { xmin: Date.parse('2025-01-02'), xmax: Date.parse('2025-01-02'), ymin: 3, ymax: 3 });
  assert.deepEqual([...selected], [1]);
});
