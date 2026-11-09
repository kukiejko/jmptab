import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCsvBuffer, detectCsvDelimiter, parseCsvImport } from '../../dist/csv-import.js';
import { parseCSV } from '../../dist/stats.js';

test('CSV preview detects semicolon and keeps quoted line breaks and decimal commas', () => {
  const text = 'Name;Value\r\n"Pump; A";"1,25"\r\n"Multi\nline";2,50\r\n';
  assert.equal(detectCsvDelimiter(text), 'semicolon');
  const result = parseCsvImport(text, { preview: true });
  assert.equal(result.delimiter, 'semicolon');
  assert.deepEqual(result.data.headers, ['Name', 'Value']);
  assert.deepEqual(result.data.rows, [['Pump; A', '1,25'], ['Multi\nline', '2,50']]);
});

test('headerless tab data retains its first row and leading zeros in text mode', () => {
  const result = parseCsvImport('001\tNorth\n002\tSouth', { firstRowHeaders: false, dataFormat: 'string' });
  assert.equal(result.delimiter, 'tab');
  assert.deepEqual(result.data.headers, ['Column 1', 'Column 2']);
  assert.deepEqual(result.data.rows, [['001', 'North'], ['002', 'South']]);
  assert.deepEqual(result.data.formats, ['string', 'string']);
});

test('consecutive delimiter option removes blank fields only when selected', () => {
  const text = 'A,B\n1,,2';
  assert.throws(() => parseCsvImport(text, { delimiter: 'comma' }), /different numbers of fields/);
  assert.deepEqual(parseCsvImport(text, { delimiter: 'comma', collapseDelimiters: true }).data.rows, [['1', '2']]);
});

test('encoding is explicit and malformed files do not load partially', () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0x2c, 0x42, 0x0a, 0x31, 0x2c, 0x32]);
  assert.equal(decodeCsvBuffer(bytes.buffer), 'A,B\n1,2');
  assert.deepEqual(parseCSV(decodeCsvBuffer(bytes.buffer)).rows, [['1', '2']]);
  assert.throws(() => decodeCsvBuffer(new Uint8Array([0xff]).buffer, 'utf-8'));
  assert.throws(() => parseCsvImport('A,B\n"broken', { delimiter: 'comma' }), /unclosed quoted field/);
});
