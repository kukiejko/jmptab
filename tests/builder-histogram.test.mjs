import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHistogram } from '../dist/builder-histogram.js';

const data = {
  headers: ['X', 'Y', 'Group', 'Site'],
  rows: [[0, 10, 'A', 'East'], [1, 11, 'A', 'West'], [2, 12, 'B', 'East'], [3, 13, 'A', 'East']]
};
const options = { columns: [0], overlay: false, group: null, by: [], combinations: false, binCount: 2, percent: false, sameX: false, sameY: false };

test('overlaid columns and groups use common bins, with percent normalized within each series', () => {
  const [panel] = buildHistogram(data, { ...options, columns: [0, 1], overlay: true, group: 2, percent: true });
  assert.equal(panel.n, 8);
  assert.deepEqual([panel.min, panel.max], [0, 13]);
  assert.deepEqual(panel.series.map(series => series.bins), [[3, 0], [0, 3], [1, 0], [0, 1]]);
  assert.deepEqual(panel.series.map(series => series.heights), [[100, 0], [0, 100], [100, 0], [0, 100]]);
});

test('By variables create individual or combined facets with optional common axes', () => {
  const individual = buildHistogram(data, { ...options, by: [2, 3], sameX: true, sameY: true });
  assert.equal(individual.length, 4);
  assert.deepEqual(individual.map(panel => panel.n), [3, 3, 1, 1]);
  assert.ok(individual.every(panel => panel.min === 0 && panel.max === 3 && panel.yMax === individual[0].yMax));
  const combinations = buildHistogram(data, { ...options, by: [2, 3], combinations: true });
  assert.deepEqual(combinations.map(panel => panel.n), [2, 1, 1]);
});
