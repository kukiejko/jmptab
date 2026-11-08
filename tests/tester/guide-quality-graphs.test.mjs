import test from 'node:test';
import assert from 'node:assert/strict';
import { xbarSChart, capabilityBySubgroup } from '../../dist/quality.js';
import { capabilityWithOptionalLimits } from '../../dist/stats.js';
import { buildHistogram, drawHistogram } from '../../dist/builder-histogram.js';
import { scatterPoints } from '../../dist/graph-builder.js';

test('Xbar-S uses dated equal-size subgroups and computes both control limits', () => {
  const rows = [[2,'Day 1'],[3,'Day 1'],[4,'Day 1'],[3,'Day 2'],[4,'Day 2'],[5,'Day 2']];
  const result = xbarSChart(rows, 0, { subgroupColumn: 1 });
  assert.deepEqual(result.labels, ['Day 1','Day 2']);
  assert.equal(result.groups, 2);
  assert.ok(result.sUcl > result.sCenter);
  assert.ok(result.ucl > result.lcl);
  assert.throws(() => xbarSChart(rows.slice(0, 5), 0, { subgroupColumn: 1 }), /equal subgroup/);
});

test('one-sided capability reports Cpk and Ppk without two-sided indices', () => {
  const result = capabilityWithOptionalLimits([1,2,3,4,5], null, 6);
  assert.equal(result.cp, null);
  assert.equal(result.pp, null);
  assert.ok(result.cpk > 0);
  assert.ok(result.ppk > 0);
  assert.equal(result.outside, 0);
});

test('capability can estimate within variation from labeled subgroups', () => {
  const rows = [[2,'D1'],[3,'D1'],[4,'D1'],[3,'D2'],[4,'D2'],[5,'D2']];
  const result = capabilityBySubgroup(rows,0,1,null,8);
  assert.equal(result.subgroupCount,2);
  assert.match(result.withinMethod,/subgroup/);
  assert.equal(result.cp,null);
  assert.ok(result.cpk > 0);
});

test('histogram normal fit draws a curve over existing bars', () => {
  const data = { headers: ['Value'], rows: [[1],[2],[3],[4],[5],[6]] };
  const options = { columns:[0], overlay:false, group:null, by:[], combinations:false, binCount:5, percent:false, sameX:false, sameY:false, normalFit:true };
  const plots = buildHistogram(data, options);
  assert.ok(plots[0].series[0].sd > 0);
  const svg = drawHistogram(plots, { percent:false, legend:false, normalFit:true, escape: String });
  assert.match(svg, /<polyline/);
  assert.match(svg, /<rect/);
});

test('grouped scatter keeps a rare group when sampling over 800 rows', () => {
  const rows = Array.from({length:2001},(_,index) => [index,index*2,index === 1001 ? 'Rare' : 'Common']);
  const scatter = scatterPoints(rows,0,1,2);
  assert.equal(scatter.n,2001);
  assert.ok(scatter.points.length <= 800);
  assert.deepEqual(scatter.groups,['Common','Rare']);
  assert.ok(scatter.points.some(point => point[4] === 'Rare'));
});
