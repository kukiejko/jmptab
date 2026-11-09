import test from 'node:test';
import assert from 'node:assert/strict';
import { scatterPoints } from '../../dist/graph-builder.js';
import { axisLabel } from '../../dist/axis-label.js';

test('zoom resamples all worksheet rows, including a point absent from the overview', () => {
  const rows = Array.from({ length: 2_000 }, (_, index) => [index, index === 1 ? 50 : 0]);
  const overview = scatterPoints(rows, 0, 1);
  assert.equal(overview.n, 2_000);
  assert.ok(overview.points.length <= 800);
  assert.equal(overview.points.some(point => point[0] === 1), false);
  const zoom = scatterPoints(rows, 0, 1, null, 'float', { xmin: 0, xmax: 2, ymin: 40, ymax: 60 });
  assert.equal(zoom.n, 1);
  assert.deepEqual(zoom.points.map(point => point.slice(0, 2)), [[1, 50]]);
  assert.equal(scatterPoints(rows, 0, 1, null, 'float', { xmin: 0, xmax: 2, ymin: 60, ymax: 70 }).n, 0);
});

test('axis labels only show declared units, including explicit sample arbitrary units', () => {
  assert.equal(axisLabel({ headers: ['Pressure'], formats: ['float'], units: [''] }, 0), 'Pressure');
  assert.equal(axisLabel({ headers: ['Value'], formats: ['float'], units: ['a.u.'] }, 0), 'Value (a.u.)');
  assert.equal(axisLabel({ headers: ['Date'], formats: ['date'], units: [''] }, 0), 'Date (day)');
  assert.equal(axisLabel({ headers: ['Recorded'], formats: ['timestamp'], units: [''] }, 0), 'Recorded (UTC)');
});
