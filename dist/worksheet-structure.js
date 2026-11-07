import { MAX_COLUMNS, MAX_ROWS } from './stats.js';

export function insertColumn(data, index) {
  if (data.headers.length >= MAX_COLUMNS) throw Error('Maximum 16,384 columns.');
  data.headers.splice(index, 0, `Column ${data.headers.length + 1}`);
  data.roles?.splice(index, 0, '');
  for (const row of data.rows) if (index < row.length) row.splice(index, 0, '');
}

export function moveColumn(data, from, to) {
  if (to < 0 || to >= data.headers.length) return false;
  for (const values of [data.headers, ...(data.roles ? [data.roles] : [])]) {
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
