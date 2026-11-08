import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleData } from '../../dist/sample-data.js';
import { validWorksheet } from '../../dist/workbook.js';
import { formatCellValue } from '../../dist/column-format.js';

test('generated worksheets have aligned units, roles and display formats', () => {
  for (const [settings, roles, formats, units] of [
    [{ type: 'histogram', valueUnit: 'mm' }, ['Y1'], ['float'], ['mm']],
    [{ type: 'boxplot', valueUnit: 'kg' }, ['Y1', 'G'], ['float', 'string'], ['kg', '']],
    [{ type: 'scatterplot', xUnit: '°C', yUnit: 'mm' }, ['X1', 'Y1'], ['float', 'float'], ['°C', 'mm']]
  ]) {
    const data = generateSampleData({ ...settings, count: 12 });
    assert.deepEqual(data.roles, roles);
    assert.deepEqual(data.formats, formats);
    assert.deepEqual(data.units, units);
    assert.equal(validWorksheet({ name: 'Sample', data }), true);
    assert.equal(formatCellValue(data.rows[0][0], data.formats[0]), Number(data.rows[0][0]).toFixed(2));
  }
});

test('sample generator rejects oversized units and keeps raw numeric precision', () => {
  assert.throws(() => generateSampleData({ type: 'histogram', valueUnit: 'x'.repeat(101) }), /Unit/);
  const data = generateSampleData({ type: 'histogram', count: 12 });
  assert.equal(data.units[0], '');
  assert.ok(data.rows.some(row => row[0] !== formatCellValue(row[0], data.formats[0])));
});
