import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXML, recordsToWorksheet } from '../dist/xml-import.js';

function element(localName, children = [], textContent = '', attributes = {}, namespaceURI = '') {
  return {
    localName, children, textContent, namespaceURI,
    attributes: Object.entries(attributes).map(([name, value]) => ({ localName: name, value, namespaceURI: '' })),
    getAttribute: name => attributes[name] ?? null,
    getAttributeNS: (_namespace, name) => attributes[name] ?? null
  };
}

function parsed(root, extras = {}) {
  return { parseFromString: () => ({
    documentElement: root, doctype: null, querySelector: () => null, ...extras
  }) };
}

test('XML records align reordered and missing fields across rows', () => {
  assert.deepEqual(recordsToWorksheet([
    [['Diameter', '10'], ['Line', 'A']],
    [['Line', 'B'], ['Diameter', '11'], ['Temperature', '21']]
  ]), {
    headers: ['Diameter', 'Line', 'Temperature'],
    rows: [['10', 'A', ''], ['11', 'B', '21']]
  });
  assert.throws(() => recordsToWorksheet([[['A', '1'], ['A', '2']]]), /duplicate field/);
  assert.throws(() => recordsToWorksheet([Array.from({ length: 16_385 }, (_, index) => [`C${index}`, 'x'])]), /16,384 columns/);
});

test('row-based XML maps named child fields and attributes', () => {
  const root = element('data', [element('records', [
    element('record', [element('field', [], '10', { name: 'Diameter' }), element('Line', [], 'A')]),
    element('record', [element('Line', [], 'B'), element('field', [], '11', { name: 'Diameter' })])
  ])]);
  assert.deepEqual(parseXML('', parsed(root)), {
    headers: ['Diameter', 'Line'], rows: [['10', 'A'], ['11', 'B']]
  });

  const attributeRows = element('data', [element('row', [], '', { x: '1', y: '2' })]);
  assert.deepEqual(parseXML('', parsed(attributeRows)), {
    headers: ['x', 'y'], rows: [['1', '2']]
  });
});

test('SpreadsheetML uses the first row as headers and honors sparse cell positions', () => {
  const cell = (text, attributes = {}) => element('Cell', [element('Data', [], text)], '', attributes);
  const root = element('Workbook', [element('Worksheet', [element('Table', [
    element('Row', [cell('Diameter'), cell('Line', { Index: '3' })]),
    element('Row', [cell('10'), cell('A', { Index: '3' })])
  ])])], '', {}, 'urn:schemas-microsoft-com:office:spreadsheet');
  assert.deepEqual(parseXML('', parsed(root)), {
    headers: ['Diameter', 'Column 2', 'Line'], rows: [['10', '', 'A']]
  });
});

test('XML rejects malformed documents, DTDs, and non-tabular structure', () => {
  const root = element('document', [element('title', [], 'Not a table')]);
  assert.throws(() => parseXML('', parsed(root, { querySelector: () => ({}) })), /malformed/);
  assert.throws(() => parseXML('', parsed(root, { doctype: {} })), /DOCTYPE/);
  assert.throws(() => parseXML('', parsed(root)), /No tabular XML rows/);
});
