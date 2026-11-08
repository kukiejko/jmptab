import test from 'node:test';
import assert from 'node:assert/strict';
import { createFactorialDesign, fitFactorialDesign, predictFactorial } from '../../dist/factorial-design.js';
import { sessionEntries, decodeSessionRecords } from '../../dist/session.js';

test('factorial design has reproducible random order and balanced levels', () => {
  const options = { name:'Experiment', factors:[{name:'System',low:'New',high:'Current'},{name:'Pack',low:'A',high:'B'}], replicates:3, seed:9 };
  const first = createFactorialDesign(options), second = createFactorialDesign(options);
  assert.deepEqual(first.data.rows, second.data.rows);
  assert.equal(first.data.rows.length,12);
  assert.equal(new Set(first.data.rows.map(row => `${row[4]}:${row[5]}`)).size,4);
  assert.deepEqual(first.data.rows.map(row => row[1]), Array.from({length:12},(_,i)=>i+1));
});

test('factorial regression recovers main effects and interaction then predicts', () => {
  const sheet = createFactorialDesign({ factors:[{name:'A',low:'Low',high:'High'},{name:'B',low:'Low',high:'High'}], replicates:3 });
  sheet.data.rows.forEach((row,index) => {
    const a = row[4] === 'High' ? 1 : -1, b = row[5] === 'High' ? 1 : -1;
    row[6] = 10 + 2*a - 3*b + 4*a*b + (index % 3 - 1)*.1;
  });
  const model = fitFactorialDesign(sheet,6);
  assert.ok(model.rSquared > .99);
  assert.ok(Math.abs(model.coefficients[1]-2) < .2);
  assert.ok(Math.abs(model.coefficients[2]+3) < .2);
  assert.ok(Math.abs(model.coefficients[3]-4) < .2);
  const prediction = predictFactorial(model,['High','Low']);
  assert.ok(Math.abs(prediction.fitted-11) < .2);
  assert.ok(prediction.pi[0] < prediction.fitted && prediction.pi[1] > prediction.fitted);
  const entries = [...sessionEntries({worksheets:[sheet]})].map(([,value])=>value);
  assert.equal(decodeSessionRecords(entries).worksheets[0].doe.model.response,'Response');
});
