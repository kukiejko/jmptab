import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { unzipXLSX, xlsxColumnIndex } from '../../dist/xlsx-import.js';
import { parseTextFile } from '../../dist/stats.js';

function zip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const [name, content, method] of entries) {
    const filename = Buffer.from(name), raw = Buffer.from(content);
    const encoded = method === 8 ? deflateRawSync(raw) : raw;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0); header.writeUInt16LE(method,8);
    header.writeUInt32LE(encoded.length,18); header.writeUInt32LE(raw.length,22); header.writeUInt16LE(filename.length,26);
    local.push(header,filename,encoded);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50,0); record.writeUInt16LE(method,10);
    record.writeUInt32LE(encoded.length,20); record.writeUInt32LE(raw.length,24);
    record.writeUInt16LE(filename.length,28); record.writeUInt32LE(offset,42);
    central.push(record,filename);
    offset += header.length + filename.length + encoded.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}

test('XLSX ZIP reader handles stored and deflated workbook parts', async () => {
  const bytes = zip([['xl/workbook.xml','<workbook/>',0],['xl/worksheets/sheet1.xml','<sheetData><row/></sheetData>',8]]);
  const files = await unzipXLSX(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert.equal(files.get('xl/workbook.xml'),'<workbook/>');
  assert.equal(files.get('xl/worksheets/sheet1.xml'),'<sheetData><row/></sheetData>');
});

test('XLSX column addresses include the maximum worksheet column', () => {
  assert.equal(xlsxColumnIndex('A1'),0);
  assert.equal(xlsxColumnIndex('AA32'),26);
  assert.equal(xlsxColumnIndex('XFD1048576'),16383);
});

test('tab-delimited text import uses the same worksheet shape as CSV', () => {
  assert.deepEqual(parseTextFile('Center\tDays\nEast\t2.5\nWest\t3.1'),
    { headers:['Center','Days'], rows:[['East','2.5'],['West','3.1']] });
});
