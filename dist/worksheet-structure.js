import { MAX_COLUMNS, MAX_ROWS } from './stats.js';

export function insertColumn(data, index) {
  if (data.headers.length >= MAX_COLUMNS) throw Error('Maximum 30 columns.');
  data.headers.splice(index, 0, `Column ${data.headers.length + 1}`);
  data.roles?.splice(index, 0, '');
  for (const row of data.rows) row.splice(index, 0, '');
}

export function moveColumn(data, from, to) {
  if (to < 0 || to >= data.headers.length) return false;
  for (const values of [data.headers, ...(data.roles ? [data.roles] : [])]) {
    values.splice(to, 0, values.splice(from, 1)[0]);
  }
  for (const row of data.rows) row.splice(to, 0, row.splice(from, 1)[0]);
  return true;
}

export function insertRow(data, index) {
  if (data.rows.length >= MAX_ROWS) throw Error('Maximum 1,000,000 rows.');
  data.rows.splice(index, 0, Array(data.headers.length).fill(''));
}

export function columnClipboardText(data, index) {
  return [data.headers[index], ...data.rows.map(row => row[index])].join('\n');
}
