import { groupedNumber } from './number-display.js';

export const esc = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

export const fmt = (value, digits = 3) => value === null || !Number.isFinite(value)
  ? '—'
  : groupedNumber(value, {
      maximumFractionDigits: digits,
      minimumFractionDigits: Math.abs(value) < 100 ? digits : 0
    });
