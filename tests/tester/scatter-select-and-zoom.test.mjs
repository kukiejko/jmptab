import test from 'node:test';
import assert from 'node:assert/strict';
import { svgChart } from '../../dist/chart.js';
import { scatterRowsInBounds } from '../../dist/scatter-row-selection.js';

test('scatter marks retain precise coordinates for highlighting selected records', () => {
  const svg = svgChart({ points: [[1.25, 2.5], [3, 4]], rectZoom: true });
  assert.match(svg, /data-point-x="1\.25" data-point-y="2\.5"/);
  assert.match(svg, /data-point-x="3" data-point-y="4"/);
  assert.deepEqual([...scatterRowsInBounds([[1.25, 2.5], [3, 4]],
    { xColumn: 0, yColumn: 1 }, { xmin: 1, xmax: 2, ymin: 2, ymax: 3 })], [0]);
});
