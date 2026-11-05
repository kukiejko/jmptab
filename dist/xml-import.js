import { MAX_COLUMNS, MAX_ROWS } from './stats.js';

const SPREADSHEET_NS = 'urn:schemas-microsoft-com:office:spreadsheet';
const ROW_NAMES = new Set(['row', 'record', 'item', 'entry', 'observation']);

function elements(parent, name) {
  return Array.from(parent.children).filter(child => child.localName.toLowerCase() === name.toLowerCase());
}

function first(parent, name) {
  return elements(parent, name)[0];
}

function fieldName(element) {
  return element.getAttribute('name') || element.getAttribute('key') || element.localName;
}

function rowFields(row) {
  const children = Array.from(row.children);
  if (children.length) {
    return children.map(child => {
      if (child.children.length) throw Error('XML fields must contain text, not nested elements.');
      return [fieldName(child), child.textContent.trim()];
    });
  }
  return Array.from(row.attributes)
    .filter(attribute => attribute.namespaceURI !== 'http://www.w3.org/2000/xmlns/')
    .map(attribute => [attribute.localName, attribute.value]);
}

export function recordsToWorksheet(records) {
  const headers = [];
  const columnByName = new Map();
  const rows = [];
  for (const fields of records) {
    if (rows.length >= MAX_ROWS) throw Error('Import up to 30 columns and 1,000,000 rows.');
    const row = [];
    const seen = new Set();
    for (const [rawName, rawValue] of fields) {
      const name = String(rawName).trim();
      if (!name) throw Error('XML fields need a column name.');
      if (seen.has(name)) throw Error(`XML row has duplicate field “${name}”.`);
      seen.add(name);
      if (!columnByName.has(name)) {
        if (headers.length >= MAX_COLUMNS) throw Error('Import up to 30 columns and 1,000,000 rows.');
        columnByName.set(name, headers.length);
        headers.push(name);
      }
      row[columnByName.get(name)] = String(rawValue ?? '');
    }
    rows.push(row);
  }
  if (!rows.length) throw Error('XML must include at least one data row.');
  if (!headers.length) throw Error('XML rows must contain fields or attributes.');
  for (const row of rows) {
    for (let index = 0; index < headers.length; index++) row[index] ??= '';
  }
  return { headers, rows };
}

function findRecordRows(root) {
  const queue = [root];
  for (let index = 0; index < queue.length; index++) {
    const parent = queue[index];
    const children = Array.from(parent.children);
    const named = children.filter(child => ROW_NAMES.has(child.localName.toLowerCase()));
    if (named.length && named.every(child => child.localName === named[0].localName)) return named;
    const groups = new Map();
    for (const child of children) {
      const name = child.localName;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(child);
    }
    for (const group of groups.values()) {
      if (group.length > 1 && group.every(child => child.children.length || child.attributes.length)) return group;
    }
    for (const child of children) queue.push(child);
  }
  if (ROW_NAMES.has(root.localName.toLowerCase())) return [root];
  throw Error('No tabular XML rows found. Use repeated row or record elements with named fields.');
}

function spreadsheetCells(row) {
  const values = [];
  let nextIndex = 0;
  for (const cell of elements(row, 'Cell')) {
    const indexed = cell.getAttributeNS(SPREADSHEET_NS, 'Index') || cell.getAttribute('Index');
    if (indexed) {
      nextIndex = Number(indexed) - 1;
      if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= MAX_COLUMNS) {
        throw Error('SpreadsheetML cell index must be between 1 and 30.');
      }
    }
    if (nextIndex >= MAX_COLUMNS) throw Error('Import up to 30 columns and 1,000,000 rows.');
    values[nextIndex++] = first(cell, 'Data')?.textContent ?? '';
  }
  return values;
}

function spreadsheetToWorksheet(root) {
  const worksheet = first(root, 'Worksheet');
  const table = worksheet && first(worksheet, 'Table');
  const xmlRows = table ? elements(table, 'Row') : [];
  if (xmlRows.length < 2) throw Error('SpreadsheetML must include a header row and at least one data row.');
  if (xmlRows.length - 1 > MAX_ROWS) throw Error('Import up to 30 columns and 1,000,000 rows.');
  const cells = xmlRows.map(spreadsheetCells);
  const width = cells.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  if (!width) throw Error('SpreadsheetML rows must contain cells.');
  const headers = Array.from({ length: width }, (_, index) => String(cells[0][index] ?? '').trim() || `Column ${index + 1}`);
  const rows = cells.slice(1).map(row => Array.from({ length: width }, (_, index) => String(row[index] ?? '')));
  return { headers, rows };
}

export function parseXML(text, parser = new DOMParser()) {
  const document = parser.parseFromString(text.replace(/^\uFEFF/, ''), 'application/xml');
  if (document.querySelector('parsererror') || !document.documentElement) throw Error('XML is malformed. Check the file syntax.');
  if (document.doctype) throw Error('XML files with a DOCTYPE are not supported.');
  const root = document.documentElement;
  if (root.localName.toLowerCase() === 'workbook' && first(root, 'Worksheet')) return spreadsheetToWorksheet(root);
  const xmlRows = findRecordRows(root);
  return recordsToWorksheet((function* () {
    for (const row of xmlRows) yield rowFields(row);
  })());
}
