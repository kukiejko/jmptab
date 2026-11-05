import { MAX_COLUMNS, MAX_ROWS } from './stats.js';

export function nextWorksheetName(worksheets) {
  const used = new Set(worksheets.map(sheet => sheet.name));
  let number = 1;
  while (used.has(`Worksheet ${number}`)) number++;
  return `Worksheet ${number}`;
}

export function blankWorksheet(name) {
  const headers = Array.from({ length: 15 }, (_, index) => `Column ${index + 1}`);
  return { name, data: { headers, rows: Array.from({ length: 20 }, () => Array(headers.length).fill('')) }, page: 1 };
}

export function renameWorksheet(worksheets, index, requestedName) {
  const name = requestedName.trim();
  if (!name || name.length > 50) throw Error('Worksheet name must contain 1 to 50 characters.');
  if (worksheets.some((sheet, position) => position !== index && sheet.name.toLowerCase() === name.toLowerCase())) {
    throw Error('Another worksheet already has that name.');
  }
  const previous = worksheets[index].name;
  worksheets[index].name = name;
  return previous;
}

export function validWorksheet(sheet) {
  const data = sheet?.data;
  return typeof sheet.name === 'string' && sheet.name.length > 0 &&
    Array.isArray(data?.headers) && data.headers.length > 0 && data.headers.length <= MAX_COLUMNS &&
    Array.isArray(data.rows) && data.rows.length <= MAX_ROWS &&
    data.rows.every(row => Array.isArray(row) && row.length === data.headers.length);
}
