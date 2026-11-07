import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleData, SAMPLE_DEFAULTS } from '../dist/sample-data.js';

for (const type of Object.keys(SAMPLE_DEFAULTS)) {
  test(`${type} non-normal sample respects point count and ranges`, () => {
    const settings = { type, distribution: 'uniform', count: 31, min: -4, max: 8, ...(type === 'scatterplot' ? { yMin: 20, yMax: 30 } : {}), ...(type === 'boxplot' ? { groups: 3 } : {}) };
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
    { type: 'histogram', count: 1 }, { type: 'histogram', count: 1_048_577 },
    { type: 'boxplot', distribution: 'uniform', min: 5, max: 5 }, { type: 'boxplot', groups: 9 },
    { type: 'scatterplot', distribution: 'uniform', yMin: 10, yMax: 2 },
    { type: 'histogram', distribution: 'normal', sigma: 0 },
    { type: 'histogram', distribution: 'normal', outliers: true, outlierPercent: 26 },
    { type: 'histogram', distribution: 'unknown' }
  ]) assert.throws(() => generateSampleData(settings));
});

test('normal samples use mean and sigma without clipping to range fields', () => {
  for (const type of Object.keys(SAMPLE_DEFAULTS)) {
    const sample = generateSampleData({ type, count: 1000, mean: 10, sigma: 2, min: 0, max: 1, yMin: 0, yMax: 1 });
    const x = sample.rows.map(row => Number(row[0]));
    assert.ok(x.some(value => value > 1));
    assert.ok(x.some(value => value < 10));
    assert.ok(x.some(value => value > 10));
    if (type === 'scatterplot') assert.ok(sample.rows.some(row => Number(row[1]) > 1));
  }
});

test('normal samples default to mean zero and sigma one, with optional outliers', () => {
  const settings = { type: 'histogram', count: 10000 };
  const base = generateSampleData(settings).rows.map(row => Number(row[0]));
  const mean = base.reduce((sum, value) => sum + value, 0) / base.length;
  const sigma = Math.sqrt(base.reduce((sum, value) => sum + (value - mean) ** 2, 0) / base.length);
  assert.ok(Math.abs(mean) < 0.05);
  assert.ok(Math.abs(sigma - 1) < 0.05);
  const withOutliers = generateSampleData({ ...settings, outliers: true, outlierPercent: 5 }).rows.map(row => Number(row[0]));
  assert.equal(withOutliers.slice(0, 500).filter(value => Math.abs(value) === 4.5).length, 500);
  assert.ok(base.slice(0, 500).every(value => Math.abs(value) !== 4.5));
});

test('uniform, exponential and bimodal samples have distinct shapes', () => {
  const sample = distribution => generateSampleData({ type: 'histogram', distribution, count: 5000, min: 0, max: 10 }).rows.map(row => Number(row[0]));
  const uniform = sample('uniform');
  const exponential = sample('exponential');
  const bimodal = sample('bimodal');
  assert.ok(uniform.filter(value => value < 2).length < 1400);
  assert.ok(exponential.filter(value => value < 2).length > 2500);
  assert.ok(bimodal.filter(value => value > 4 && value < 6).length < 200);
});
