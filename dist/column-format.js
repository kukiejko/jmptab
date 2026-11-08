export const COLUMN_FORMATS = {
  auto: 'Automatic', integer: 'Integer', float: 'Float (2 decimals)',
  scientific: 'Scientific (3 decimals)', date: 'Date (UTC)', time: 'Time (UTC)',
  timestamp: 'Timestamp (UTC)', string: 'String'
};

export const CURRENCY_FORMATS = {
  'currency:PLN': { label: 'PLN (zł)', locale: 'pl-PL', currency: 'PLN' },
  'currency:EUR': { label: 'EUR (€)', locale: 'de-DE', currency: 'EUR' },
  'currency:USD': { label: 'USD ($)', locale: 'en-US', currency: 'USD' },
  'currency:GBP': { label: 'GBP (£)', locale: 'en-GB', currency: 'GBP' }
};

const CUSTOM_PREFIX = 'custom:';
const NUMERIC_PATTERN = /[0#?][0#?,]*(?:\.[0#?]+)?(?:[Ee][+-]0+)?(?:,+)?/;
const LITERAL_PATTERN = /^(?:[\s$€£¥%()+\-A-Za-z@]|"[^"]*"|\\.)*$/;

function sectionsOf(pattern) {
  const sections = [''];
  let quoted = false;
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '\\' && index + 1 < pattern.length) { sections[sections.length - 1] += char + pattern[++index]; continue; }
    if (char === '"') quoted = !quoted;
    if (char === ';' && !quoted) sections.push('');
    else sections[sections.length - 1] += char;
  }
  if (quoted) throw Error('Close quoted text in the format code.');
  return sections;
}

function numberMatch(body) {
  let quoted = false;
  for (let index = 0; index < body.length; index++) {
    if (body[index] === '\\') { index++; continue; }
    if (body[index] === '"') { quoted = !quoted; continue; }
    if (!quoted && /[0#?]/.test(body[index])) {
      const match = NUMERIC_PATTERN.exec(body.slice(index));
      if (match?.index === 0) return { code: match[0], index };
    }
  }
  return null;
}

function literal(text) { return text.replace(/"([^"]*)"|\\(.)/g, (_, quoted, escaped) => quoted ?? escaped); }

export function validateCustomNumberPattern(pattern) {
  if (typeof pattern !== 'string' || !pattern || pattern.length > 80) throw Error('Enter a format code of up to 80 characters.');
  const sections = sectionsOf(pattern);
  if (sections.length > 4 || !sections[0]) throw Error('Use up to four sections: positive;negative;zero;text.');
  for (const [index, section] of sections.entries()) {
    if (!section) continue;
    const body = section.replace(/^\[Red\]/i, '');
    if (index === 3) {
      if (!LITERAL_PATTERN.test(body)) throw Error('Text section supports quoted text and @ as the cell value.');
      continue;
    }
    const match = numberMatch(body);
    if (!match) throw Error('Each numeric section needs a placeholder such as 0, # or ?.');
    const before = body.slice(0, match.index), after = body.slice(match.index + match.code.length);
    if (!LITERAL_PATTERN.test(before) || !LITERAL_PATTERN.test(after)) throw Error('Unsupported format code. Use 0, #, grouping, decimals, %, E+00, currency symbols, quotes or [Red].');
    const decimal = match.code.split('.')[1]?.split(/[Ee,]/)[0] || '';
    if (decimal.length > 12) throw Error('Use at most 12 decimal places.');
  }
  return pattern;
}

export function isValidColumnFormat(format) {
  if (Object.hasOwn(COLUMN_FORMATS, format) || Object.hasOwn(CURRENCY_FORMATS, format)) return true;
  if (typeof format !== 'string' || !format.startsWith(CUSTOM_PREFIX)) return false;
  try { validateCustomNumberPattern(format.slice(CUSTOM_PREFIX.length)); return true; }
  catch { return false; }
}

export function formatLabel(format = 'auto') {
  return format.startsWith(CUSTOM_PREFIX) ? `Custom: ${format.slice(CUSTOM_PREFIX.length)}` : CURRENCY_FORMATS[format]?.label || COLUMN_FORMATS[format] || 'Automatic';
}

export function columnTypeLabel(format = 'auto', inferred = '') {
  if (format === 'integer') return 'Integer';
  if (format === 'float') return 'Float';
  if (format === 'scientific') return 'Scientific';
  if (format === 'date') return 'Date';
  if (format === 'time') return 'Time';
  if (format === 'timestamp') return 'Timestamp';
  if (format === 'string') return 'Text';
  if (CURRENCY_FORMATS[format]) return `Currency · ${CURRENCY_FORMATS[format].currency}`;
  if (format.startsWith(CUSTOM_PREFIX)) return 'Custom number';
  return inferred === 'D' ? 'Auto · Date' : inferred === 'T' ? 'Auto · Text' : 'Automatic';
}

function dateValue(raw) {
  const timeOnly = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (timeOnly) {
    const [, hours, minutes, seconds = '0'] = timeOnly;
    if (+hours > 23 || +minutes > 59 || +seconds > 59) return null;
    return new Date(Date.UTC(1970, 0, 1, +hours, +minutes, +seconds));
  }
  const milliseconds = /^[-+]?\d+(?:\.\d+)?$/.test(raw.trim()) ? Number(raw) : Date.parse(raw);
  const date = new Date(milliseconds);
  return Number.isFinite(milliseconds) && !Number.isNaN(date.getTime()) ? date : null;
}

function customNumber(number, pattern) {
  const sections = sectionsOf(pattern);
  const section = number < 0 && sections.length > 1 ? sections[1] : number === 0 && sections.length > 2 ? sections[2] : sections[0];
  const body = section.replace(/^\[Red\]/i, '');
  const match = numberMatch(body);
  if (!match) return '';
  const code = match.code;
  const prefix = literal(body.slice(0, match.index));
  const suffix = literal(body.slice(match.index + code.length));
  const percent = (prefix + suffix).includes('%');
  const scalingCommas = (code.match(/,+$/) || [''])[0].length;
  const magnitude = Math.abs(number) * (percent ? 100 : 1) / 1000 ** scalingCommas;
  const exponent = /[Ee][+-]0+$/.exec(code);
  const decimalPart = code.split('.')[1]?.split(/[Ee,]/)[0] || '';
  const decimals = decimalPart.length;
  let formatted;
  if (exponent) {
    const [mantissa, power] = magnitude.toExponential(decimals).split('e');
    formatted = `${mantissa}${exponent[0][0]}${Number(power) < 0 ? '-' : '+'}${String(Math.abs(Number(power))).padStart(exponent[0].length - 2, '0')}`;
  } else {
    const fixed = magnitude.toFixed(decimals);
    let [integer, fraction = ''] = fixed.split('.');
    const integerCode = code.split('.')[0].replace(/,+$/, '');
    const minimumInteger = (integerCode.match(/0/g) || []).length;
    integer = integer.padStart(minimumInteger, '0');
    if (!minimumInteger && Number(integer) === 0) integer = '';
    if (/,[0#?]/.test(integerCode) && integer) integer = Number(integer).toLocaleString('en-US', { maximumFractionDigits: 0 });
    const minimumDecimals = (decimalPart.match(/0/g) || []).length;
    while (fraction.length > minimumDecimals && fraction.endsWith('0')) fraction = fraction.slice(0, -1);
    const optionalSpace = decimalPart.slice(minimumDecimals).replace(/[^?]/g, '').length;
    fraction = fraction.padEnd(minimumDecimals + optionalSpace, ' ');
    formatted = integer + (fraction ? `.${fraction}` : '');
  }
  const sign = number < 0 && sections.length < 2 ? '-' : '';
  return sign + prefix + formatted + suffix;
}

export function customNumberIsRed(number, format) {
  if (typeof format !== 'string' || !format.startsWith(CUSTOM_PREFIX) || !Number.isFinite(number) || number >= 0) return false;
  return /^\[Red\]/i.test(sectionsOf(format.slice(CUSTOM_PREFIX.length))[1] || '');
}

export function formatCellValue(value, format = 'auto') {
  const raw = String(value ?? '');
  if (!raw.trim() || format === 'auto' || format === 'string') return raw;
  if (['date', 'time', 'timestamp'].includes(format)) {
    const date = dateValue(raw);
    if (!date) return raw;
    const iso = date.toISOString();
    if (format === 'date') return iso.slice(0, 10);
    if (format === 'time') return iso.slice(11, 19) + ' UTC';
    return iso.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  }
  const number = Number(raw);
  if (!Number.isFinite(number)) {
    if (format.startsWith(CUSTOM_PREFIX) && isValidColumnFormat(format)) {
      const section = sectionsOf(format.slice(CUSTOM_PREFIX.length))[3];
      return section === undefined ? raw : literal(section).replaceAll('@', raw);
    }
    return raw;
  }
  if (format === 'integer') return String(Math.round(number));
  if (format === 'float') return number.toFixed(2);
  if (format === 'scientific') return number.toExponential(3);
  if (CURRENCY_FORMATS[format]) {
    const { locale, currency } = CURRENCY_FORMATS[format];
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  }
  if (format.startsWith(CUSTOM_PREFIX) && isValidColumnFormat(format)) return customNumber(number, format.slice(CUSTOM_PREFIX.length));
  return raw;
}
