import { numeric } from './stats.js';

export function isDateValue(value) {
  const text = String(value ?? '').trim();
  if (!/^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{2,4})(?:[ T].*)?$/.test(text)) return false;
  return Number.isFinite(Date.parse(text));
}

export function inferColumnType(rows, column) {
  let numbers = 0, dates = 0, text = 0;
  for (let index = 0; index < Math.min(rows.length,512); index++) {
    const value = rows[index]?.[column];
    if (value === undefined || value === null || String(value).trim() === '') continue;
    if (numeric(value) !== null) numbers++;
    else if (isDateValue(value)) dates++;
    else text++;
    if (numbers + dates + text >= 100) break;
  }
  if (!numbers && !dates && !text) return '';
  if (dates && !text && !numbers) return 'D';
  if (text && !dates && !numbers) return 'T';
  return numbers >= dates + text ? '' : 'T';
}
