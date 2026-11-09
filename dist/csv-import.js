import { delimitedRecords, MAX_ROWS } from './stats.js';

export const CSV_DELIMITERS = { comma: ',', semicolon: ';', tab: '\t', pipe: '|' };

export function decodeCsvBuffer(buffer, encoding = 'auto') {
  const bytes = new Uint8Array(buffer);
  const selected = encoding === 'auto'
    ? bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : 'utf-8'
    : encoding;
  if (!['utf-8', 'utf-16le', 'windows-1250'].includes(selected)) throw Error('Unsupported text encoding.');
  return new TextDecoder(selected, { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
}

export function detectCsvDelimiter(text) {
  let best = { key: 'comma', score: 0 };
  for (const [key, delimiter] of Object.entries(CSV_DELIMITERS)) {
    let records;
    try { records = delimitedRecords(text, delimiter, { maxRecords: 8 }); }
    catch { continue; }
    if (!records.length || records[0].length < 2) continue;
    const width = records[0].length;
    const consistent = records.filter(row => row.length === width).length;
    const score = consistent * 10 + Math.min(width, 20) - (records.length - consistent) * 12;
    if (score > best.score) best = { key, score };
  }
  return best.key;
}

export function parseCsvImport(text, {
  delimiter = 'auto', firstRowHeaders = true, collapseDelimiters = false,
  dataFormat = 'auto', preview = false
} = {}) {
  const delimiterKey = delimiter === 'auto' ? detectCsvDelimiter(text) : delimiter;
  const character = CSV_DELIMITERS[delimiterKey];
  if (!character) throw Error('Choose a valid CSV delimiter.');
  if (!['auto', 'string'].includes(dataFormat)) throw Error('Choose Automatic or Text data format.');
  const records = delimitedRecords(text, character, { maxRecords: preview ? 11 : Infinity, collapseDelimiters });
  const minimum = firstRowHeaders ? 2 : 1;
  if (records.length < minimum) throw Error('The file must contain at least one data row.');
  const width = records[0].length;
  const headers = firstRowHeaders
    ? records.shift().map((value, index) => value.trim() || `Column ${index + 1}`)
    : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
  if (records.some(row => row.length !== width)) throw Error('Rows have different numbers of fields. Check the delimiter and quoted values.');
  if (!preview && records.length > MAX_ROWS) throw Error('Import up to 16,384 columns and 1,048,576 rows.');
  const data = { headers, rows: records, formats: Array(width).fill(dataFormat) };
  return { data, delimiter: delimiterKey };
}
