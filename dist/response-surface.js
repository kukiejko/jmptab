import { numeric } from './stats.js';

const finite = value => { const number = numeric(value); return number !== null && Number.isFinite(number) ? number : null; };

function solve(matrix, vector) {
  const a = matrix.map((row, index) => [...row, vector[index]]);
  const n = a.length;
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    if (Math.abs(a[pivot][column]) < 1e-10) throw new Error('The columns do not contain enough independent variation to fit a quadratic surface.');
    [a[column], a[pivot]] = [a[pivot], a[column]];
    const divisor = a[column][column];
    for (let j = column; j <= n; j++) a[column][j] /= divisor;
    for (let row = 0; row < n; row++) if (row !== column) {
      const factor = a[row][column];
      for (let j = column; j <= n; j++) a[row][j] -= factor * a[column][j];
    }
  }
  return a.map(row => row[n]);
}

export function fitResponseSurface(data, { responseColumn, xColumn, yColumn, fixedFactors = [] }) {
  const columns = [responseColumn, xColumn, yColumn, ...fixedFactors.map(factor => factor.column)];
  if (columns.some(column => !Number.isInteger(column) || column < 0 || column >= data.headers.length) || new Set(columns).size !== columns.length)
    throw new Error('Choose different worksheet columns for response, X, Y, and fixed factors.');
  const observations = data.rows.map(row => columns.map(column => finite(row[column]))).filter(row => row.every(value => value !== null));
  const count = 6 + fixedFactors.length;
  if (observations.length < count) throw new Error(`At least ${count} complete numeric rows are needed for a quadratic surface.`);
  const dimensions = columns.length - 1;
  const means = Array.from({ length: dimensions }, (_, index) => observations.reduce((sum, row) => sum + row[index + 1], 0) / observations.length);
  const scales = means.map((mean, index) => observations.reduce((maximum, row) => Math.max(maximum, Math.abs(row[index + 1] - mean)), 0));
  if (scales.some(scale => scale === 0)) throw new Error('X, Y, and each additional factor must vary across the observations.');
  const features = row => {
    const values = row.slice(1).map((value, index) => (value - means[index]) / scales[index]);
    return [1, values[0], values[1], values[0] ** 2, values[1] ** 2, values[0] * values[1], ...values.slice(2)];
  };
  const design = observations.map(features);
  const matrix = Array.from({ length: count }, (_, i) => Array.from({ length: count }, (_, j) => design.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const vector = Array.from({ length: count }, (_, i) => design.reduce((sum, row, index) => sum + row[i] * observations[index][0], 0));
  const coefficients = solve(matrix, vector);
  const fixed = fixedFactors.map(factor => {
    const value = finite(factor.value);
    if (value === null) throw new Error('Enter a numeric value for every fixed factor.');
    return value;
  });
  const evaluate = (x, y) => features([0, x, y, ...fixed]).reduce((sum, feature, index) => sum + feature * coefficients[index], 0);
  const xValues = observations.map(row => row[1]);
  const yValues = observations.map(row => row[2]);
  const xDomain = xValues.reduce((range, value) => [Math.min(range[0], value), Math.max(range[1], value)], [Infinity, -Infinity]);
  const yDomain = yValues.reduce((range, value) => [Math.min(range[0], value), Math.max(range[1], value)], [Infinity, -Infinity]);
  const size = 32;
  const grid = Array.from({ length: size + 1 }, (_, row) => Array.from({ length: size + 1 }, (_, column) =>
    evaluate(xDomain[0] + (xDomain[1] - xDomain[0]) * column / size, yDomain[0] + (yDomain[1] - yDomain[0]) * row / size)));
  const values = grid.flat();
  const zDomain = [Math.min(...values), Math.max(...values)];
  const meanResponse = observations.reduce((sum, row) => sum + row[0], 0) / observations.length;
  const total = observations.reduce((sum, row) => sum + (row[0] - meanResponse) ** 2, 0);
  const residual = observations.reduce((sum, row) => sum + (row[0] - features(row).reduce((value, feature, index) => value + feature * coefficients[index], 0)) ** 2, 0);
  return { responseColumn, xColumn, yColumn, fixedFactors, observations: observations.length, coefficients, xDomain, yDomain, zDomain, grid,
    rSquared: total ? 1 - residual / total : 1, evaluate };
}
