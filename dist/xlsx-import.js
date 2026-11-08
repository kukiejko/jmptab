import { MAX_ROWS, MAX_COLUMNS } from './stats.js';

const decoder = new TextDecoder();
const xmlParser = text => {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw Error('XLSX XML declarations with external entities are not supported.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('The Excel file contains invalid XML.');
  return doc;
};
const children = (element, name) => [...element.children].filter(child => child.localName === name);
const descendants = (element, name) => [...element.getElementsByTagName('*')].filter(child => child.localName === name);
const first = (element, name) => descendants(element, name)[0];

export async function unzipXLSX(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer), files = new Map();
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (view.getUint32(index, true) === 0x06054b50) { end = index; break; }
  }
  if (end < 0) throw Error('This is not a valid XLSX workbook.');
  let offset = view.getUint32(end + 16, true);
  const entries = view.getUint16(end + 10, true);
  for (let index = 0; index < entries; index++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw Error('Invalid XLSX ZIP directory.');
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true), expanded = view.getUint32(offset + 24, true);
    if (compressed === 0xffffffff || expanded === 0xffffffff) throw Error('Zip64 XLSX workbooks are not supported.');
    const nameLength = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const local = view.getUint32(offset + 42, true);
    if (view.getUint32(local, true) !== 0x04034b50) throw Error('Invalid XLSX ZIP entry.');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (expanded > 128 * 1024 * 1024) throw Error('An XLSX part exceeds the 128 MB import limit.');
    if (name.startsWith('xl/')) {
      let output;
      if (method === 0) output = bytes.subarray(start, start + compressed);
      else if (method === 8) {
        const stream = new Blob([bytes.subarray(start, start + compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        output = new Uint8Array(await new Response(stream).arrayBuffer());
      } else throw Error('Unsupported XLSX compression method.');
      files.set(name, decoder.decode(output));
    }
    offset += 46 + nameLength + extra + comment;
  }
  return files;
}

export const xlsxColumnIndex = reference => [...(reference.match(/^[A-Z]+/i)?.[0].toUpperCase() || '')].reduce((index, letter) => index*26 + letter.charCodeAt(0) - 64, 0) - 1;
const excelDate = (number, use1904) => new Date(Date.UTC(use1904 ? 1904 : 1899, use1904 ? 0 : 11, use1904 ? 1 : 30) + number*86400000).toISOString().replace('T00:00:00.000Z','').replace('.000Z','Z');

export async function parseXLSX(buffer) {
  const files = await unzipXLSX(buffer);
  const workbook = xmlParser(files.get('xl/workbook.xml') || '');
  const sheet = first(workbook, 'sheet');
  if (!sheet) throw Error('The workbook has no worksheets.');
  const relationshipId = [...sheet.attributes].find(attribute => attribute.localName === 'id')?.value;
  const relationships = xmlParser(files.get('xl/_rels/workbook.xml.rels') || '');
  const relation = descendants(relationships, 'Relationship').find(item => item.getAttribute('Id') === relationshipId);
  if (!relation) throw Error('Cannot locate the first worksheet.');
  const target = relation.getAttribute('Target').replace(/^\//,'');
  const path = target.startsWith('xl/') ? target : 'xl/' + target.replace(/^\.\//,'');
  const worksheet = xmlParser(files.get(path) || '');
  const shared = files.has('xl/sharedStrings.xml') ? descendants(xmlParser(files.get('xl/sharedStrings.xml')), 'si').map(item => descendants(item,'t').map(text => text.textContent).join('')) : [];
  const styles = files.has('xl/styles.xml') ? xmlParser(files.get('xl/styles.xml')) : null;
  const customFormats = new Map(styles ? descendants(styles,'numFmt').map(item => [Number(item.getAttribute('numFmtId')), item.getAttribute('formatCode')]) : []);
  const formatIds = styles ? children(first(styles,'cellXfs') || styles,'xf').map(item => Number(item.getAttribute('numFmtId'))) : [];
  const use1904 = first(workbook,'workbookPr')?.getAttribute('date1904') === '1';
  const isDate = styleIndex => {
    const id = formatIds[styleIndex];
    if ([14,15,16,17,18,19,20,21,22,45,46,47].includes(id)) return true;
    const code = (customFormats.get(id) || '').replace(/"[^"]*"|\[[^\]]*\]/g,'');
    return /[ymdhHsS]/.test(code);
  };
  const values = [];
  let width = 0;
  for (const item of descendants(worksheet,'row')) {
    const rowIndex = Number(item.getAttribute('r')) - 1;
    if (!Number.isSafeInteger(rowIndex) || rowIndex < 0 || rowIndex >= MAX_ROWS + 1) throw Error('XLSX exceeds the worksheet row limit.');
    const row = values[rowIndex] ||= [];
    for (const cell of children(item,'c')) {
      const index = xlsxColumnIndex(cell.getAttribute('r') || '');
      if (index < 0 || index >= MAX_COLUMNS) throw Error('XLSX exceeds the worksheet column limit.');
      const type = cell.getAttribute('t');
      let value = first(cell,'v')?.textContent ?? '';
      if (type === 's') value = shared[Number(value)] ?? '';
      else if (type === 'inlineStr') value = descendants(cell,'t').map(text => text.textContent).join('');
      else if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
      else if (value !== '' && isDate(Number(cell.getAttribute('s') || 0))) value = excelDate(Number(value), use1904);
      row[index] = value;
      width = Math.max(width, index+1);
    }
  }
  if (!values.length || !width) throw Error('The first XLSX worksheet is empty.');
  const headers = Array.from({ length: width }, (_, index) => String(values[0]?.[index] ?? '').trim() || `Column ${index+1}`);
  const rows = Array.from({ length: values.length - 1 }, (_, index) => values[index+1] || []);
  return { headers, rows };
}
