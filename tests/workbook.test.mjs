import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankWorksheet, COLUMN_ROLES, nextWorksheetName, renameWorksheet, validWorksheet } from '../dist/workbook.js';
import { decodeSessionRecords, sessionEntries } from '../dist/session.js';

test('new worksheets have independent blank cells and unique names', () => {
  const first = blankWorksheet('Worksheet 1');
  const second = blankWorksheet(nextWorksheetName([first]));
  first.data.rows[0][0] = 'changed';
  assert.equal(second.name, 'Worksheet 2');
  assert.equal(second.data.rows[0][0], '');
  assert.equal(first.data.headers.length, 15);
  assert.ok(validWorksheet(first));
});

test('worksheet names are trimmed, unique, and kept in saved data', () => {
  const worksheets = [blankWorksheet('Worksheet 1'), blankWorksheet('Worksheet 2')];
  assert.equal(renameWorksheet(worksheets, 0, ' Process data '), 'Worksheet 1');
  assert.equal(worksheets[0].name, 'Process data');
  assert.throws(() => renameWorksheet(worksheets, 1, 'process data'), /already/);
  assert.throws(() => renameWorksheet(worksheets, 1, '  '), /1 to 50/);
});

test('column roles use the requested labels and survive session serialization', () => {
  assert.deepEqual(COLUMN_ROLES, ['X1', 'X2', 'Y1', 'Y2', 'Y3', 'Z1', 'Z2', 'Z3', 'G']);
  const sheet = blankWorksheet('Worksheet 1');
  sheet.data.roles[0] = 'X1';
  sheet.data.roles[1] = 'Y2';
  sheet.data.roles[2] = 'G';
  const records = [...sessionEntries({ worksheets: [sheet] })].map(([, value]) => value);
  assert.deepEqual(decodeSessionRecords(records).worksheets[0].data.roles.slice(0, 3), ['X1', 'Y2', 'G']);
  assert.ok(validWorksheet(sheet));
});

test('saved workbook restores every sheet, active tab, and page', () => {
  const worksheets = [
    { name: 'Worksheet 1', data: { headers: ['A'], rows: [['1'], ['2']] }, page: 2 },
    { name: 'Worksheet 2', data: { headers: ['B', 'C'], rows: [['3', '4']] }, page: 1 }
  ];
  const records = [...sessionEntries({ worksheets, activeSheetIndex: 1, name: 'Study' })]
    .sort(([left], [right]) => left - right).map(([, value]) => value);
  assert.deepEqual(decodeSessionRecords(records), { name: 'Study', worksheets, activeSheetIndex: 1 });
});

test('saved worksheet chunks do not leak into the next worksheet', () => {
  const worksheets = [
    { name: 'Worksheet 1', data: { headers: ['A'], rows: Array.from({ length: 5_002 }, (_, index) => [String(index)]) }, page: 1 },
    { name: 'Worksheet 2', data: { headers: ['B'], rows: [['separate']] }, page: 1 }
  ];
  const entries = [...sessionEntries({ worksheets })];
  assert.equal(entries.length, 4);
  assert.deepEqual(decodeSessionRecords(entries.map(([, value]) => value)).worksheets, worksheets);
});

test('sessions saved before workbook support remain readable', () => {
  const records = [{ headers: ['Diameter'], name: 'Old study' }, [['10.1'], ['10.2']]];
  assert.deepEqual(decodeSessionRecords(records), {
    name: 'Old study', data: { headers: ['Diameter'], rows: [['10.1'], ['10.2']] }
  });
});
