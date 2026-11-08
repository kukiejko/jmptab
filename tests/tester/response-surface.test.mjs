import test from 'node:test';
import assert from 'node:assert/strict';
import { fitResponseSurface } from '../../dist/response-surface.js';
import { drawContourPlot, drawSurfacePlot } from '../../dist/response-surface-render.js';

const sample = () => ({ headers: ['Response', 'X', 'Y', 'Batch'], rows: Array.from({ length: 54 }, (_, i) => {
  const x = i % 9 - 4, y = Math.floor(i / 9) - 2.5, batch = i % 2;
  return [5 + 2*x - 3*y + 1.5*x*x + .5*y*y + .25*x*y + 4*batch, x, y, batch];
}) });

test('quadratic response surface recovers nonlinear response and fixed factor', () => {
  const data = sample();
  const model = fitResponseSurface(data, { responseColumn: 0, xColumn: 1, yColumn: 2, fixedFactors: [{ column: 3, value: 1 }] });
  assert.ok(Math.abs(model.evaluate(2, -1) - (5 + 4 + 3 + 6 + .5 - .5 + 4)) < 1e-8);
  assert.ok(Math.abs(model.rSquared - 1) < 1e-10);
  assert.equal(model.grid.length, 33);
  assert.ok(model.zDomain[1] > model.zDomain[0]);
});

test('surface validation rejects duplicate, sparse and rank-deficient inputs', () => {
  const data = sample();
  assert.throws(() => fitResponseSurface(data, { responseColumn: 0, xColumn: 1, yColumn: 1 }), /different/);
  assert.throws(() => fitResponseSurface({ headers: data.headers, rows: data.rows.slice(0, 3) }, { responseColumn: 0, xColumn: 1, yColumn: 2 }), /At least/);
  assert.throws(() => fitResponseSurface({ headers: ['Z','X','Y'], rows: Array.from({length: 10}, (_, i) => [i,i,i]) }, { responseColumn: 0, xColumn: 1, yColumn: 2 }), /independent/);
});

test('contour includes colored cells and isolines; 3D plot responds to rotation', () => {
  const data = sample();
  const model = fitResponseSurface(data, { responseColumn: 0, xColumn: 1, yColumn: 2 });
  const contour = drawContourPlot(model, data);
  assert.match(contour, /Contour Plot of Response/);
  assert.match(contour, /<rect/);
  assert.match(contour, /<path/);
  const original = drawSurfacePlot(model, data);
  const rotated = drawSurfacePlot(model, data, { yaw: 45, pitch: 10, roll: 20 });
  assert.match(original, /<polygon/);
  assert.notEqual(original, rotated);
});
