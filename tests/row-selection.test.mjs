import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRows } from '../dist/row-selection.js';

test('row selection supports single, range, and toggled rows', () => {
  const first = selectRows(new Set(), 2, null);
  assert.deepEqual([...first.selected], [2]);
  const range = selectRows(first.selected, 5, first.anchor, { shift: true });
  assert.deepEqual([...range.selected], [2, 3, 4, 5]);
  const toggled = selectRows(range.selected, 3, range.anchor, { toggle: true });
  assert.deepEqual([...toggled.selected], [2, 4, 5]);
});
