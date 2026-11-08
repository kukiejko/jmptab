import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleData } from '../../dist/sample-data.js';

test('million-point histogram fills every row and spreads outliers across pages', () => {
  const sample = generateSampleData({
    type: 'histogram', count: 1_000_000, distribution: 'normal',
    mean: 0, sigma: 2, outliers: true, outlierPercent: 5
  });
  assert.equal(sample.rows.length, 1_000_000);
  assert.ok(sample.rows.every(row => row.length === 1 && Number.isFinite(Number(row[0]))));
  const outlier = row => Math.abs(Number(row[0])) === 9;
  assert.equal(sample.rows.filter(outlier).length, 50_000);
  assert.equal(sample.rows.slice(0, 200).filter(outlier).length, 10);
  assert.equal(sample.rows.slice(-200).filter(outlier).length, 10);
});
