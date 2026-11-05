import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summary,regression,control,capability,pChart,parseCSV,csv,csvChunks,numeric,histogram,chartObservations,MAX_ROWS} from '../dist/stats.js';
import {movingAverage,exponentialSmoothing} from '../dist/time-series.js';
import {xbarChart} from '../dist/quality.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('sample summary and interpolated quartiles',()=>{const s=summary([1,2,3,4,5,'', 'text']);near(s.mean,3);near(s.sd,Math.sqrt(2.5));assert.equal(s.n,5);assert.equal(s.missing,2);assert.equal(s.q1,2);assert.equal(s.median,3);assert.throws(()=>summary([1]));});
test('regression fits known equation and excludes incomplete pairs',()=>{const r=regression([1,2,3,4,''],[3,5,7,9,20]);near(r.slope,2);near(r.intercept,1);near(r.r2,1);assert.equal(r.n,4);assert.throws(()=>regression([1,1,1],[1,2,3]));});
test('individual chart uses consecutive moving range',()=>{const r=control([1,2,3,4,5]);near(r.mrbar,1);near(r.sigma,1/1.128);near(r.ucl,3+3/1.128);assert.throws(()=>control([1,'',3]));assert.throws(()=>control([2,2,2]));});
test('capability distinguishes within and overall variation',()=>{const r=capability([1,2,3,4,5],0,6);near(r.cp,6/(6/1.128));near(r.cpk,r.cp);near(r.pp,1/Math.sqrt(2.5));assert.equal(r.outside,0);assert.throws(()=>capability([1,2,3],4,2));assert.throws(()=>capability([1,2,3],null,3));});
test('P chart calculates binomial limits and rejects invalid counts',()=>{const r=pChart([0,3,5,10],10,0.3);near(r.center,0.3);near(r.lcl,0);near(r.ucl,0.3+3*Math.sqrt(0.3*0.7/10));assert.deepEqual(r.signals,[3]);near(pChart([1,2,3],10).center,0.2);assert.throws(()=>pChart([1,11],10));assert.throws(()=>pChart([1,2],10,1.1));});
test('moving average uses preceding observations for each fit and forecast',()=>{const r=movingAverage([1,2,3,4,5],2);assert.deepEqual(r.fitted,[[3,1.5],[4,2.5],[5,3.5]]);near(r.forecast,4.5);near(r.mae,1.5);assert.throws(()=>movingAverage([1,'',3],2));assert.throws(()=>movingAverage([1,2],2));});
test('exponential smoothing fits from prior smoothed value',()=>{const r=exponentialSmoothing([1,2,3,4],0.5);assert.deepEqual(r.fitted,[[2,1],[3,1.5],[4,2.25]]);near(r.forecast,3.125);near(r.mae,(1+1.5+1.75)/3);const seeded=exponentialSmoothing([1,3,5],0.5,2);assert.deepEqual(seeded.fitted,[[3,2]]);assert.throws(()=>exponentialSmoothing([1,2,3],0));assert.throws(()=>exponentialSmoothing([1,2,3],0.5,3));});
test('Xbar chart uses subgroup means and known or estimated sigma',()=>{const r=xbarChart([1,2,3,4,5,6,7,8,9,10],5,5,2);near(r.lcl,5-6/Math.sqrt(5));near(r.ucl,5+6/Math.sqrt(5));assert.deepEqual(r.means,[3,8]);assert.deepEqual(r.signals,[1]);const estimated=xbarChart([1,2,3,4,5,6],3);near(estimated.center,3.5);assert.ok(estimated.sigma>0);assert.throws(()=>xbarChart([1,2,3,4,5],3));assert.throws(()=>xbarChart([1,2,3,4],2,null,0));});
test('CSV roundtrips quotes, commas, newlines and BOM',()=>{const d={headers:['a','b'],rows:[['a,b','x"y'],['line\nbreak','3']]};assert.deepEqual(parseCSV(csv(d)),d);assert.deepEqual(parseCSV('\uFEFFa,b\r\n1,2\r\n'),{headers:['a','b'],rows:[['1','2']]});assert.throws(()=>parseCSV('a,b\n1'));assert.throws(()=>parseCSV('a\n"x'));});
test('histogram preserves all values including identical samples',()=>{for(const v of [[1,2,3,4,5],[2,2,2,2]])assert.equal(histogram(v).bins.reduce((a,b)=>a+b),v.length);assert.equal(numeric(''),null);assert.equal(numeric('Infinity'),null);assert.equal(numeric('0'),0);});

test('a million-row CSV preserves every row for analysis and export', () => {
  const text = 'X,Y\n' + '0,1000001\n1,1000003\n2,1000005\n3,1000007\n'.repeat(MAX_ROWS / 4);
  const dataset = parseCSV(text);
  assert.equal(dataset.rows.length, MAX_ROWS);
  assert.deepEqual(dataset.rows.at(-1), ['3', '1000007']);

  const x = dataset.rows.map(row => row[0]);
  const y = dataset.rows.map(row => row[1]);
  const fit = regression(x, y, 800);
  assert.equal(fit.n, MAX_ROWS);
  near(fit.slope, 2);
  near(fit.intercept, 1_000_001);
  assert.equal(fit.pairs.length, 800);
  assert.equal(histogram(x).bins.reduce((total, count) => total + count), MAX_ROWS);
  const process = capability(y, 1_000_002, 1_000_006);
  assert.equal(process.outside, MAX_ROWS / 2);
  const points = chartObservations(process.values, process.lsl, process.usl);
  assert.ok(points.length <= 800);
  assert.deepEqual(points.at(-1), [MAX_ROWS, 1_000_007, true]);

  const exported = new Blob(csvChunks(dataset));
  assert.equal(exported.size, 15 * MAX_ROWS + 7);
});
