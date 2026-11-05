import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeAnalysis } from '../dist/analysis-execution.js';

const rows = [[1, 2], [2, 4], [3, 6], [4, 8], [5, 10]];
const run = (type, options = {}) => executeAnalysis({
  type, rows, responseIndex: 1, predictorIndex: 0, options
});

test('analysis dispatcher uses the selected worksheet columns', () => {
  const regression = run('regression');
  assert.equal(regression.slope, 2);
  assert.equal(regression.n, rows.length);
  assert.equal(run('correlation').r, 1);
  assert.equal(run('histogram').mean, 6);
});

test('analysis dispatcher accepts dialog options without a browser', () => {
  const t = run('one-sample-t', {
    source: 'summary', n: 5, mean: 3, sd: 1, confidence: 95,
    alternative: 'two-sided', nullMean: null
  });
  assert.equal(t.n, 5);
  assert.equal(t.mean, 3);
  assert.equal(run('moving-average', { span: 2 }).forecast, 9);
});

test('analysis dispatcher rejects invalid selections', () => {
  assert.throws(() => executeAnalysis({
    type: 'regression', rows, responseIndex: 0, predictorIndex: 0
  }), /different response and predictor/);
  assert.throws(() => run('unknown'), /Unknown analysis/);
});
