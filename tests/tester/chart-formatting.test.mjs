import test from 'node:test';
import assert from 'node:assert/strict';
import { svgChart } from '../../dist/chart.js';
import { normalizeChartFormatting } from '../../dist/chart-formatting.js';
import { scatterTrendline } from '../../dist/graph-builder.js';

test('common chart exposes axis, gridline and data-mark targets for formatting', () => {
  const svg = svgChart({ points: [[1, 2], [2, 3]], xLabel: 'Time (s)', yLabel: 'Pressure (Pa)', rectZoom: true });
  assert.match(svg, /class="chart-x-title"[^>]*>Time \(s\)/);
  assert.match(svg, /class="chart-y-title"[^>]*>Pressure \(Pa\)/);
  assert.match(svg, /class="chart-gridline"/);
  assert.match(svg, /class="chart-data-mark" data-chart-value="2\.000"/);
});

test('format settings allow valid positions and bounded axis-title text', () => {
  const options = normalizeChartFormatting({ legendPosition: 'top', legend: false, dataLabels: true, xTitleText: '  Elapsed time  ', yTitleText: 'P'.repeat(120) });
  assert.equal(options.legendPosition, 'top');
  assert.equal(options.legend, false);
  assert.equal(options.dataLabels, true);
  assert.equal(options.xTitleText, 'Elapsed time');
  assert.equal(options.yTitleText.length, 100);
  assert.equal(normalizeChartFormatting({ legendPosition: 'side' }).legendPosition, 'bottom');
});

test('linear trendline uses all complete worksheet pairs', () => {
  const rows = Array.from({ length: 2_000 }, (_, index) => [index, 3 + 2 * index]);
  rows[1_999][1] = 10_000;
  const fit = scatterTrendline(rows, 0, 1);
  assert.ok(fit.slope > 2);
  assert.equal(fit.xmin, 0);
  assert.equal(fit.xmax, 1_999);
  assert.throws(() => scatterTrendline([[1, 2], [1, 3]], 0, 1), /distinct X/);
});
