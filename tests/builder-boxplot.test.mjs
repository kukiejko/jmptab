import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxStatistics, buildBoxplot, drawBoxplot } from '../dist/builder-boxplot.js';

test('Tukey whiskers stop at inliers and outliers keep their precise values', () => {
  const stats = boxStatistics([1, 2, 2, 3, 4, 5, 40]);
  assert.equal(stats.n, 7);
  assert.equal(stats.q1, 2);
  assert.equal(stats.median, 3);
  assert.equal(stats.q3, 4.5);
  assert.equal(stats.iqr, 2.5);
  assert.equal(stats.whiskerLow, 1);
  assert.equal(stats.whiskerHigh, 5);
  assert.deepEqual(stats.outliers, [40]);
});

test('four layouts, nested groups, panels, and filters leave worksheet unchanged', () => {
  const data = { headers: ['Y1', 'Y2', 'Group', 'Batch'], rows: [
    ['1', '10', 'A', 'P'], ['2', '20', 'A', 'P'], ['3', '30', 'B', 'P'], ['4', '40', 'B', 'Q']
  ] };
  const original = structuredClone(data);
  assert.equal(buildBoxplot(data, { layout: 'one-simple', yColumns: [0] }).boxCount, 1);
  assert.equal(buildBoxplot(data, { layout: 'one-groups', yColumns: [0], groupColumns: [2] }).boxCount, 2);
  assert.equal(buildBoxplot(data, { layout: 'multiple-simple', yColumns: [0, 1] }).boxCount, 2);
  const result = buildBoxplot(data, { layout: 'multiple-groups', yColumns: [0, 1], groupColumns: [2], panelColumn: 3,
    filter: { column: 0, operator: '>', value: 1 } });
  assert.equal(result.panels.length, 2);
  assert.equal(result.boxCount, 6);
  assert.equal(result.observations, 6);
  assert.deepEqual(data, original);
});

test('boxplot SVG includes box and outlier hover statistics and optional layers', () => {
  const data = { headers: ['Y'], rows: [1, 2, 2, 3, 4, 5, 40].map(value => [String(value)]) };
  const result = buildBoxplot(data, { layout: 'one-simple', yColumns: [0] });
  const svg = drawBoxplot(result, { view: { mean: true, confidence: true }, labels: { showValues: true },
    scale: { referenceLines: [10] } }, value => String(value).replaceAll('&', '&amp;'));
  assert.match(svg, /Quartile 1:/);
  assert.match(svg, /Interquartile Range/);
  assert.match(svg, /Whiskers:/);
  assert.match(svg, /Value: 40/);
  assert.match(svg, /boxplot-outlier/);
  assert.match(svg, /stroke-dasharray/);
  assert.ok(svg.indexOf('data-box-tooltip="Group:') < svg.indexOf('class="boxplot-outlier"'));
  const horizontal = drawBoxplot(result, { view: { outliers: true }, scale: { transpose: true } }, value => String(value));
  assert.match(horizontal, /Horizontal boxplot/);
  assert.doesNotMatch(horizontal, /rotate\(90deg\)/);
});

test('log scale excludes nonpositive values and rejects an empty result', () => {
  const data = { headers: ['Y'], rows: [['-1'], ['0'], ['2']] };
  assert.equal(buildBoxplot(data, { layout: 'one-simple', yColumns: [0], scaleType: 'log10' }).observations, 1);
  assert.throws(() => buildBoxplot(data, { layout: 'one-simple', yColumns: [0], filter: { column: 0, operator: '>', value: 10 } }), /No numeric observations/);
});

test('rendering a large column computes axis bounds without spreading all values', () => {
  const data = { headers: ['Y'], rows: Array.from({ length: 100_000 }, (_, index) => [String(index % 101 + 1)]) };
  const result = buildBoxplot(data, { layout: 'one-simple', yColumns: [0] });
  assert.match(drawBoxplot(result, {}, String), /boxplot-chart/);
});
