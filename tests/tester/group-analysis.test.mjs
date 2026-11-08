import test from 'node:test';
import assert from 'node:assert/strict';
import { groupedSummary, oneWayAnova, tukeyPValue } from '../../dist/group-analysis.js';
import { tCdf } from '../../dist/inference.js';

test('grouped summary separates numeric observations and counts excluded rows', () => {
  const rows = [[1,'A'],[2,'A'],[4,'B'],[6,'B'],['','B'],[3,'']];
  const result = groupedSummary(rows, 0, 1);
  assert.equal(result.excluded, 2);
  assert.deepEqual(result.groups.map(group => group.mean), [1.5,5]);
});

test('one-way ANOVA partitions sums of squares and adjusts pairwise comparisons', () => {
  const rows = [[1,'A'],[2,'A'],[3,'A'],[5,'B'],[6,'B'],[7,'B'],[8,'C'],[9,'C'],[10,'C']];
  const result = oneWayAnova(rows, 0, 1);
  assert.equal(result.dfBetween, 2);
  assert.equal(result.dfWithin, 6);
  assert.ok(Math.abs(result.withinSS - 6) < 1e-9);
  assert.ok(result.pValue < .001);
  assert.equal(result.comparisons.length, 3);
  assert.ok(result.comparisons.every(item => item.pValue >= 0 && item.pValue <= 1));
  assert.equal(tukeyPValue(0, 3, 6), 1);
});

test('Tukey range distribution agrees with two-group t test', () => {
  const q = 3, df = 20;
  assert.ok(Math.abs(tukeyPValue(q,2,df) - 2*(1-tCdf(q/Math.sqrt(2),df))) < 1e-4);
});

test('identical constant groups do not report a significant ANOVA result', () => {
  const result = oneWayAnova([[1,'A'],[1,'A'],[1,'B'],[1,'B']],0,1);
  assert.equal(result.f,0);
  assert.equal(result.pValue,1);
  assert.equal(result.comparisons[0].pValue,1);
});
