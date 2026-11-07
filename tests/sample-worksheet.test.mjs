import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSampleWorksheet } from '../dist/sample-worksheet.js';
import { generateSampleData } from '../dist/sample-data.js';

test('sample data is appended in a new active worksheet without changing earlier sheets', () => {
  const existing = { name: 'Worksheet 1', data: { headers: ['Original'], rows: [['keep']] }, page: 3 };
  const source = [existing, { name: 'Worksheet 3', data: existing.data, page: 1 }];
  const sample = generateSampleData({ type: 'boxplot', count: 12 });
  const result = appendSampleWorksheet(source, sample);
  assert.equal(result.activeSheetIndex, 2);
  assert.equal(result.worksheets[2].name, 'Worksheet 2');
  assert.equal(result.worksheets[2].data, sample);
  assert.equal(result.worksheets[2].page, 1);
  assert.equal(source.length, 2);
  assert.equal(source[0], existing);
  assert.deepEqual(existing.data.rows, [['keep']]);
});

test('sample worksheet creation respects the project sheet limit', () => {
  const worksheets = Array.from({ length: 100 }, (_, index) => ({ name: `Worksheet ${index + 1}` }));
  assert.throws(() => appendSampleWorksheet(worksheets, generateSampleData({ type: 'histogram' })), /Maximum 100/);
});
