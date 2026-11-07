import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_COLUMNS, MAX_ROWS } from '../../dist/stats.js';
import { validWorksheet } from '../../dist/workbook.js';

test('worksheet accepts both maximum dimensions together and rejects either excess', () => {
  const sheet = {
    name: 'Capacity boundary',
    data: {
      headers: Array.from({ length: MAX_COLUMNS }, (_, index) => `C${index + 1}`),
      rows: Array.from({ length: MAX_ROWS }, () => [])
    }
  };
  sheet.data.rows[0][MAX_COLUMNS - 1] = 'edge';
  assert.equal(validWorksheet(sheet), true);

  sheet.data.rows.push([]);
  assert.equal(validWorksheet(sheet), false);
  sheet.data.rows.pop();

  sheet.data.headers.push('too many');
  assert.equal(validWorksheet(sheet), false);
});
