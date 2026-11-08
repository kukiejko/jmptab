import test from 'node:test';
import assert from 'node:assert/strict';
import { columnTypeLabel, customNumberIsRed, formatCellValue, isValidColumnFormat, validateCustomNumberPattern } from '../../dist/column-format.js';
import { insertColumn, moveColumn, deleteColumn } from '../../dist/worksheet-structure.js';
import { sessionEntries, decodeSessionRecords } from '../../dist/session.js';
import { validWorksheet } from '../../dist/workbook.js';

test('column formats display values without changing stored values', () => {
  assert.equal(formatCellValue('12.678', 'integer'), '13');
  assert.equal(formatCellValue('12.678', 'float'), '12.68');
  assert.equal(formatCellValue('12.678', 'scientific'), '1.268e+1');
  assert.equal(formatCellValue('0', 'timestamp'), '1970-01-01 00:00:00 UTC');
  assert.equal(formatCellValue('abc', 'float'), 'abc');
  assert.equal(formatCellValue('12.678', 'string'), '12.678');
});

test('column headers describe the selected type', () => {
  assert.equal(columnTypeLabel('scientific'), 'Scientific');
  assert.equal(columnTypeLabel('timestamp'), 'Timestamp');
  assert.equal(columnTypeLabel('auto', 'T'), 'Auto · Text');
  assert.equal(columnTypeLabel('date'), 'Date');
  assert.equal(columnTypeLabel('time'), 'Time');
  assert.equal(columnTypeLabel('custom:0.00'), 'Custom number');
});

test('date, time and timestamp display the same stored instant', () => {
  assert.equal(formatCellValue('2026-11-08T15:04:05Z', 'date'), '2026-11-08');
  assert.equal(formatCellValue('2026-11-08T15:04:05Z', 'time'), '15:04:05 UTC');
  assert.equal(formatCellValue('2026-11-08T15:04:05Z', 'timestamp'), '2026-11-08 15:04:05 UTC');
  assert.equal(formatCellValue('12:34', 'time'), '12:34:00 UTC');
  assert.equal(formatCellValue('invalid', 'date'), 'invalid');
});

test('currency presets format numeric values without changing the stored value', () => {
  for (const [format, locale, currency] of [
    ['currency:PLN', 'pl-PL', 'PLN'], ['currency:EUR', 'de-DE', 'EUR'],
    ['currency:USD', 'en-US', 'USD'], ['currency:GBP', 'en-GB', 'GBP']
  ]) {
    assert.equal(isValidColumnFormat(format), true);
    assert.equal(columnTypeLabel(format), `Currency · ${currency}`);
    assert.equal(formatCellValue('1234.5', format), new Intl.NumberFormat(locale, {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(1234.5));
    assert.equal(formatCellValue('text', format), 'text');
  }
  assert.equal(isValidColumnFormat('currency:XXX'), false);
});

test('custom number patterns cover grouping, decimals, percentages, currency and negative style', () => {
  assert.equal(formatCellValue('1234.567', 'custom:#,##0.00'), '1,234.57');
  assert.equal(formatCellValue('0.125', 'custom:0.0%'), '12.5%');
  assert.equal(formatCellValue('1234.5', 'custom:€ #,##0.00'), '€ 1,234.50');
  assert.equal(formatCellValue('-1234.5', 'custom:#,##0.00;[Red](#,##0.00)'), '(1,234.50)');
  assert.equal(customNumberIsRed(-1234.5, 'custom:#,##0.00;[Red](#,##0.00)'), true);
  assert.equal(customNumberIsRed(NaN, 'custom:#,##0.00;[Red](#,##0.00)'), false);
  assert.equal(isValidColumnFormat('custom:0.00'), true);
  assert.equal(isValidColumnFormat('custom:<script>'), false);
  assert.equal(formatCellValue('text', 'custom:0.00;[Red](0.00);"zero" 0;"Text: "@'), 'Text: text');
  assert.equal(formatCellValue('0', 'custom:0.00;[Red](0.00);"zero" 0;"Text: "@'), 'zero 0');
  assert.equal(formatCellValue('12000', 'custom:#,'), '12');
  assert.equal(formatCellValue('12200000', 'custom:0.0,,"M"'), '12.2M');
  assert.equal(formatCellValue('1234', 'custom:0.00E+00'), '1.23E+03');
  assert.equal(formatCellValue('1234', 'custom:"2026 "0'), '2026 1234');
  assert.throws(() => validateCustomNumberPattern('0.00;0;0;@;extra'), /four sections/);
});

test('column formats follow column structure changes and survive session restore', () => {
  const data = { headers: ['A', 'B'], formats: ['float', 'string'], units: ['mm', ''], rows: [['12.678', 'text']] };
  insertColumn(data, 1);
  assert.deepEqual(data.formats, ['float', 'auto', 'string']);
  assert.deepEqual(data.units, ['mm', '', '']);
  moveColumn(data, 2, 0);
  assert.deepEqual(data.formats, ['string', 'float', 'auto']);
  assert.deepEqual(data.units, ['', 'mm', '']);
  deleteColumn(data, 2);
  assert.deepEqual(data.formats, ['string', 'float']);
  const sheet = { name: 'Worksheet 1', data, page: 1 };
  assert.equal(validWorksheet(sheet), true);
  const records = [...sessionEntries({ worksheets: [sheet] })].map(([, value]) => value);
  assert.deepEqual(decodeSessionRecords(records).worksheets[0].data, data);
});
