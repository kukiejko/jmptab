import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleData, SAMPLE_DEFAULTS } from '../dist/sample-data.js';

for (const type of Object.keys(SAMPLE_DEFAULTS)) {
  test(`${type} sample respects point count and ranges`, () => {
    const settings = { type, count: 31, min: -4, max: 8, ...(type === 'scatterplot' ? { yMin: 20, yMax: 30 } : {}), ...(type === 'boxplot' ? { groups: 3 } : {}) };
    const first = generateSampleData(settings);
    assert.deepEqual(first, generateSampleData(settings));
    assert.equal(first.rows.length, 31);
    assert.ok(first.rows.every(row => Number(row[0]) >= -4 && Number(row[0]) <= 8));
    if (type === 'scatterplot') assert.ok(first.rows.every(row => Number(row[1]) >= 20 && Number(row[1]) <= 30));
    if (type === 'boxplot') assert.deepEqual(new Set(first.rows.map(row => row[1])), new Set(['Group 1', 'Group 2', 'Group 3']));
  });
}

test('sample settings reject counts, ranges, and groups outside limits', () => {
  for (const settings of [
    { type: 'histogram', count: 1 }, { type: 'histogram', count: 100001 },
    { type: 'boxplot', min: 5, max: 5 }, { type: 'boxplot', groups: 9 },
    { type: 'scatterplot', yMin: 10, yMax: 2 }
  ]) assert.throws(() => generateSampleData(settings));
});
