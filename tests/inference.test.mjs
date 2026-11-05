import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oneSampleT, oneSampleTFromValues, pearsonCorrelation, tCdf } from '../dist/inference.js';

const near = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('one-sample t uses Student distribution for interval and test', () => {
  const result = oneSampleTFromValues([1, 2, 3, 4, 5, '', 'missing'], { nullMean: 3 });
  assert.equal(result.n, 5);
  assert.equal(result.excluded, 2);
  assert.equal(result.df, 4);
  near(result.mean, 3);
  near(result.statistic, 0);
  near(result.pValue, 1);
  near(result.lower, 1.0367568385);
  near(result.upper, 4.9632431615);
  const summarized = oneSampleT({ n: 5, mean: 3, sd: Math.sqrt(2.5), nullMean: 3 });
  near(summarized.lower, result.lower);
});

test('one-sided tests and confidence bounds use matching tails', () => {
  const options = { n: 10, mean: 2, sd: 1, nullMean: 0 };
  const greater = oneSampleT({ ...options, alternative: 'greater' });
  const less = oneSampleT({ ...options, alternative: 'less' });
  near(greater.pValue + less.pValue, 1);
  assert.equal(greater.upper, Infinity);
  assert.equal(less.lower, -Infinity);
  near(tCdf(2.262157, 9), 0.975, 1e-6);
});

test('interval-only mode and invalid summary inputs', () => {
  const result = oneSampleT({ n: 5, mean: 3, sd: 1 });
  assert.equal(result.pValue, null);
  assert.throws(() => oneSampleT({ n: 1, mean: 3, sd: 1 }));
  assert.throws(() => oneSampleT({ n: 5, mean: 3, sd: 0 }));
  assert.throws(() => oneSampleT({ n: 5, mean: 3, sd: 1, confidence: 100 }));
});

test('Pearson correlation uses complete numeric pairs', () => {
  const positive = pearsonCorrelation([1, 2, 3, 4, ''], [2, 4, 6, 8, 10]);
  near(positive.r, 1);
  assert.equal(positive.pValue, 0);
  assert.equal(positive.excluded, 1);
  near(pearsonCorrelation([1, 2, 3, 4], [4, 3, 2, 1]).r, -1);
  assert.throws(() => pearsonCorrelation([1, 1, 1], [2, 3, 4]));
});
