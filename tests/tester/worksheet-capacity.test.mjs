import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_COLUMNS, MAX_ROWS } from '../../dist/stats.js';
import { validWorksheet } from '../../dist/workbook.js';
import { insertColumn, insertRow } from '../../dist/worksheet-structure.js';

test('worksheet accepts both maximum dimensions together and rejects either excess', () => {
  const sheet = {
    name: 'Capacity boundary',
    data: {
      headers: Array.from({ length: MAX_COLUMNS }, (_, index) => `C${index + 1}`),
      rows: Array.from({ length: MAX_ROWS }, () => [])
    }
  };
  sheet.data.rows[MAX_ROWS - 1][MAX_COLUMNS - 1] = 'last cell';
  assert.equal(validWorksheet(sheet), true);
  assert.equal(sheet.data.rows.length, 1_048_576);
  assert.equal(sheet.data.headers.length, 16_384);
  assert.equal(sheet.data.rows[MAX_ROWS - 1][MAX_COLUMNS - 1], 'last cell');
  assert.throws(() => insertRow(sheet.data, MAX_ROWS), /Maximum 1,048,576 rows/);
  assert.throws(() => insertColumn(sheet.data, MAX_COLUMNS), /Maximum 16,384 columns/);
  assert.equal(sheet.data.rows.length, MAX_ROWS);
  assert.equal(sheet.data.headers.length, MAX_COLUMNS);

  sheet.data.rows.push([]);
  assert.equal(validWorksheet(sheet), false);
  sheet.data.rows.pop();

  sheet.data.headers.push('too many');
  assert.equal(validWorksheet(sheet), false);
});
