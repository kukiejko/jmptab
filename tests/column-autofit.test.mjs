import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fittedColumnWidth } from '../dist/column-autofit.js';

test('auto-fit considers the header and rows beyond the visible worksheet page', () => {
  const rows = Array.from({ length: 201 }, () => ['short', 'x']);
  rows[200][1] = 'long value on next page';
  const options = {
    header: 'Response', rows, columnIndex: 1,
    measureHeader: text => text.length * 8,
    measureCell: text => text.length * 7,
    padding: 16, minimum: 96
  };

  assert.equal(fittedColumnWidth(options), 177);
  assert.equal(fittedColumnWidth({ ...options, header: 'Very long column name' }), 184);
  assert.equal(fittedColumnWidth({ ...options, header: 'A', rows: [['x']] }), 96);
});
