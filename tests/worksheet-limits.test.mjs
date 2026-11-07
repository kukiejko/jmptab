import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ROWS, MAX_COLUMNS, csv } from '../dist/stats.js';
import { validWorksheet } from '../dist/workbook.js';
import { columnWindow } from '../dist/column-window.js';
import { insertColumn, insertRow } from '../dist/worksheet-structure.js';
import { sessionEntries, decodeSessionRecords } from '../dist/session.js';

test('worksheet accepts Excel row and column limits with sparse rows', () => {
  const data = { headers: Array.from({ length: MAX_COLUMNS }, (_, index) => `C${index + 1}`), rows: [[]] };
  assert.equal(MAX_ROWS, 1_048_576);
  assert.equal(MAX_COLUMNS, 16_384);
  assert.ok(validWorksheet({ name: 'Wide', data }));
  assert.equal(data.rows[0].length, 0);
  assert.throws(() => insertColumn(data, 0), /16,384/);
  assert.deepEqual(columnWindow(MAX_COLUMNS, MAX_COLUMNS).last, MAX_COLUMNS);
  assert.deepEqual(columnWindow(MAX_COLUMNS, 100), { first: 100, last: 140, windowed: true });
});

test('blank rows can be added to a wide worksheet without filling every column', () => {
  const data = { headers: Array.from({ length: MAX_COLUMNS }, (_, index) => `C${index}`), rows: [] };
  insertRow(data, 0);
  assert.deepEqual(data.rows[0], []);
  data.rows[0][MAX_COLUMNS - 1] = 'last';
  assert.ok(csv({ headers: data.headers.slice(0, 3), rows: [[]] }).endsWith('\r\n"","",""'));
  assert.ok(validWorksheet({ name: 'Wide', data }));
});

test('wide worksheet values survive session encoding and decoding', () => {
  const headers = Array.from({ length: MAX_COLUMNS }, (_, index) => `C${index + 1}`);
  const last = [];
  last[MAX_COLUMNS - 1] = 'far value';
  const sheet = { name: 'Wide', data: { headers, rows: [[], last] }, page: 1 };
  const records = [...sessionEntries({ worksheets: [sheet] })].map(([, value]) => value);
  const restored = decodeSessionRecords(records).worksheets[0];
  assert.equal(restored.data.headers.length, MAX_COLUMNS);
  assert.equal(restored.data.rows[1][MAX_COLUMNS - 1], 'far value');
  assert.equal(restored.data.rows[0].length, 0);
});
