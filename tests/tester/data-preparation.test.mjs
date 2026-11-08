import test from 'node:test';
import assert from 'node:assert/strict';
import { stackWorksheets, recodeColumn, assignFormula, recalculateFormulas, renameFormulaReference, removeFormulaDependencies } from '../../dist/data-preparation.js';
import { sessionEntries, decodeSessionRecords } from '../../dist/session.js';
import { inferColumnType } from '../../dist/column-types.js';

test('stack aligns same-name columns and records source worksheet', () => {
  const sheets = [
    { name:'East', data:{ headers:['Days','Center'], rows:[[2,'East']] } },
    { name:'West', data:{ headers:['Center','Days','Status'], rows:[['West',3,'On time']] } }
  ];
  const stacked = stackWorksheets(sheets,[0,1],'Combined');
  assert.deepEqual(stacked.data.headers, ['Source','Days','Center','Status']);
  assert.deepEqual(stacked.data.rows[0].slice(0,3), ['East',2,'East']);
  assert.deepEqual(stacked.data.rows[1], ['West',3,'West','On time']);
  assert.deepEqual(sheets[0].data.rows, [[2,'East']]);
});

test('recode maps text values without changing source data', () => {
  const source = { headers:['Center'], rows:[['East.MTW'],['West.txt'],['Other']] };
  const result = recodeColumn(source,0,[{from:'East.MTW',to:'East'},{from:'West.txt',to:'West'}]);
  assert.deepEqual(result.rows.map(row => row[0]), ['East','West','Other']);
  assert.equal(source.rows[0][0], 'East.MTW');
});

test('date subtraction formula refreshes after editing and survives session encoding', () => {
  const sheet = { name:'Orders', data:{ headers:['Order','Arrival','Days'], rows:[['2024-03-04','2024-03-08','']] } };
  assignFormula(sheet,'Days','Arrival - Order');
  assert.equal(sheet.data.rows[0][2],4);
  sheet.data.rows[0][1] = '2024-03-09';
  recalculateFormulas(sheet,[0]);
  assert.equal(sheet.data.rows[0][2],5);
  const entries = [...sessionEntries({ worksheets:[sheet] })].map(([,value]) => value);
  assert.deepEqual(decodeSessionRecords(entries).worksheets[0].formulas, sheet.formulas);
});

test('formula cycles are rejected', () => {
  const sheet = { name:'Calc', data:{ headers:['A','B','C'], rows:[[1,2,'']] } };
  assignFormula(sheet,'C','A + B');
  assert.throws(() => assignFormula(sheet,'A','C + B'),/cycle/);
  assert.equal(sheet.formulas.length,1);
});

test('renaming and deleting formula sources update or remove dependent formulas', () => {
  const sheet = { name:'Calc', data:{ headers:['A','B','C','D'], rows:[[1,2,'','']] } };
  assignFormula(sheet,'C','A + B');
  assignFormula(sheet,'D','C + B');
  sheet.data.headers[0] = 'First value';
  renameFormulaReference(sheet,'A','First value');
  sheet.data.rows[0][0] = 4;
  recalculateFormulas(sheet,[0]);
  assert.equal(sheet.data.rows[0][3],8);
  sheet.data.headers.splice(0,1);
  sheet.data.rows[0].splice(0,1);
  removeFormulaDependencies(sheet,'First value');
  assert.deepEqual(sheet.formulas,[]);
  assert.deepEqual(sheet.data.rows[0], [2,'','']);
});

test('worksheet distinguishes date, text, and numeric columns', () => {
  const rows = [['2024-03-04','East','2.5'],['2024-03-05','West','3.1']];
  assert.equal(inferColumnType(rows,0),'D');
  assert.equal(inferColumnType(rows,1),'T');
  assert.equal(inferColumnType(rows,2),'');
});
