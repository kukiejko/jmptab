import { MAX_COLUMNS, MAX_ROWS } from './stats.js';

export function insertColumn(data, index) {
  if (data.headers.length >= MAX_COLUMNS) throw Error('Maximum 16,384 columns.');
  data.headers.splice(index, 0, `Column ${data.headers.length + 1}`);
  data.roles?.splice(index, 0, '');
  data.formats?.splice(index, 0, 'auto');
  data.units?.splice(index, 0, '');
  for (const row of data.rows) if (index < row.length) row.splice(index, 0, '');
}

export function moveColumn(data, from, to) {
  if (to < 0 || to >= data.headers.length) return false;
  for (const values of [data.headers, ...(data.roles ? [data.roles] : []), ...(data.formats ? [data.formats] : []), ...(data.units ? [data.units] : [])]) {
    values.splice(to, 0, values.splice(from, 1)[0]);
  }
  for (const row of data.rows) {
    if (from >= row.length && to >= row.length) continue;
    if (from >= row.length) { row.splice(to, 0, ''); continue; }
    const [value] = row.splice(from, 1);
    if (to >= row.length) {
      if (value !== undefined && value !== '') row[to] = value;
    } else row.splice(to, 0, value ?? '');
  }
  return true;
}

export function deleteColumn(data, index) {
  if (data.headers.length <= 1) throw Error('A worksheet must have at least one column.');
  data.headers.splice(index, 1);
  data.roles?.splice(index, 1);
  data.formats?.splice(index, 1);
  data.units?.splice(index, 1);
  for (const row of data.rows) if (index < row.length) row.splice(index, 1);
}

export function insertRow(data, index) {
  if (data.rows.length >= MAX_ROWS) throw Error('Maximum 1,048,576 rows.');
  data.rows.splice(index, 0, data.headers.length <= 30 ? Array(data.headers.length).fill('') : []);
}

export function deleteRows(data, indices) {
  const selected = new Set(indices);
  const count = data.rows.length;
  data.rows = data.rows.filter((_, index) => !selected.has(index));
  return count - data.rows.length;
}

export function columnClipboardText(data, index) {
  return [data.headers[index], ...data.rows.map(row => row[index] ?? '')].join('\n');
}

export function columnsClipboardText(data, indices) {
  const columns = [...indices].sort((a, b) => a - b);
  if (!columns.length || columns.some(index => index < 0 || index >= data.headers.length)) throw Error('Select at least one column.');
  return [columns.map(index => data.headers[index]), ...data.rows.map(row => columns.map(index => row[index] ?? ''))]
    .map(values => values.join('\t')).join('\n');
}

export function pasteColumns(data, startColumn, text) {
  const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  const cells = lines.map(line => line.split('\t'));
  const width = Math.max(...cells.map(row => row.length));
  if (startColumn < 0 || startColumn + width > MAX_COLUMNS) throw Error('Paste up to 16,384 columns.');
  if (cells.length - 1 > MAX_ROWS) throw Error('Paste up to 1,048,576 rows.');
  while (data.headers.length < startColumn + width) {
    data.headers.push(`Column ${data.headers.length + 1}`);
    data.roles?.push('');
    data.formats?.push('auto');
    data.units?.push('');
  }
  for (let offset = 0; offset < width; offset++) {
    if (cells[0][offset] !== undefined) data.headers[startColumn + offset] = cells[0][offset] || `Column ${startColumn + offset + 1}`;
  }
  while (data.rows.length < cells.length - 1) data.rows.push([]);
  for (const row of data.rows) {
    for (let offset = 0; offset < width; offset++) {
      if (startColumn + offset < row.length) row[startColumn + offset] = '';
    }
  }
  for (let row = 1; row < cells.length; row++) {
    for (let offset = 0; offset < cells[row].length; offset++) data.rows[row - 1][startColumn + offset] = cells[row][offset];
  }
  return { columns: width, rows: cells.length - 1 };
}
