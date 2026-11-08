import { MAX_ROWS, MAX_COLUMNS, numeric } from './stats.js';

export function stackWorksheets(worksheets, indices, name, includeSource = true) {
  if (!Array.isArray(indices) || indices.length < 2 || new Set(indices).size !== indices.length ||
      indices.some(index => !Number.isInteger(index) || index < 0 || index >= worksheets.length))
    throw Error('Select at least two different worksheets to stack.');
  const outputName = String(name || '').trim();
  if (!outputName || outputName.length > 50 || worksheets.some(sheet => sheet.name.toLowerCase() === outputName.toLowerCase()))
    throw Error('Enter a unique worksheet name of 1 to 50 characters.');
  const headers = [];
  for (const index of indices) for (const header of worksheets[index].data.headers) if (!headers.includes(header)) headers.push(header);
  let sourceHeader = 'Source';
  if (includeSource) { while (headers.includes(sourceHeader)) sourceHeader += ' worksheet'; headers.unshift(sourceHeader); }
  if (headers.length > MAX_COLUMNS) throw Error('Stacked worksheet exceeds the column limit.');
  const positions = new Map(headers.map((header, index) => [header, index]));
  const rows = [];
  for (const index of indices) {
    const sheet = worksheets[index];
    for (const source of sheet.data.rows) {
      const row = [];
      if (includeSource) row[positions.get(sourceHeader)] = sheet.name;
      sheet.data.headers.forEach((header, column) => { row[positions.get(header)] = source[column] ?? ''; });
      rows.push(row);
      if (rows.length > MAX_ROWS) throw Error('Stacked worksheet exceeds 1,048,576 rows.');
    }
  }
  return { name: outputName, data: { headers, rows }, page: 1 };
}

export function recodeColumn(data, column, replacements, newName = null) {
  if (!Number.isInteger(column) || column < 0 || column >= data.headers.length) throw Error('Choose a valid column to recode.');
  if (!Array.isArray(replacements) || !replacements.length) throw Error('Enter at least one replacement.');
  const headers = [...data.headers];
  if (newName !== null) {
    if (!newName.trim() || headers.length >= MAX_COLUMNS) throw Error('Enter a name for the new column, within the worksheet column limit.');
    headers.push(newName.trim());
  }
  const target = newName === null ? column : headers.length - 1;
  const mapping = new Map(replacements.map(({ from, to }) => [String(from), String(to)]));
  const rows = data.rows.map(source => {
    const row = [...source];
    const value = String(source[column] ?? '');
    row[target] = mapping.has(value) ? mapping.get(value) : value;
    return row;
  });
  return { ...data, headers, rows, ...(data.roles ? { roles: newName === null ? [...data.roles] : [...data.roles, ''] } : {}) };
}

function parseExpression(expression) {
  const match = String(expression).trim().match(/^(.+?)\s+([+*/-])\s+(.+)$/);
  if (!match) throw Error('Use an expression such as Arrival - Order or "Column A" + 2.');
  return { left: match[1].replace(/^['"]|['"]$/g,''), operator: match[2], right: match[3].replace(/^['"]|['"]$/g,'') };
}

const quoteOperand = value => /\s/.test(value) ? `"${value}"` : value;

export function renameFormulaReference(sheet, previous, next) {
  if (!sheet.formulas?.length || previous === next) return;
  sheet.formulas = sheet.formulas.map(item => {
    const { left, right, operator } = parseExpression(item.expression);
    const replacement = value => value === previous ? next : value;
    return { target: replacement(item.target), expression: `${quoteOperand(replacement(left))} ${operator} ${quoteOperand(replacement(right))}` };
  });
}

export function removeFormulaDependencies(sheet, removedHeader) {
  if (!sheet.formulas?.length) return;
  const invalid = new Set([removedHeader]);
  let changed;
  do {
    changed = false;
    for (const item of sheet.formulas) {
      const { left, right } = parseExpression(item.expression);
      if ((invalid.has(left) || invalid.has(right)) && !invalid.has(item.target)) { invalid.add(item.target); changed = true; }
    }
  } while (changed);
  sheet.formulas = sheet.formulas.filter(item => !invalid.has(item.target));
  for (const target of invalid) {
    const column = sheet.data.headers.indexOf(target);
    if (column >= 0) for (const row of sheet.data.rows) row[column] = '';
  }
}

function valueOf(operand, row, headers) {
  const index = headers.indexOf(operand);
  if (index >= 0) return row[index];
  const literal = numeric(operand);
  if (literal !== null) return literal;
  throw Error(`Unknown column in formula: ${operand}`);
}

function quantity(value) {
  const number = numeric(value);
  if (number !== null) return { value: number, date: false };
  if (typeof value === 'string' && /\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(value)) {
    const time = Date.parse(value);
    if (Number.isFinite(time)) return { value: time/86400000, date: true };
  }
  return null;
}

export function recalculateFormulas(sheet, rowIndices = null) {
  const formulas = sheet.formulas || [];
  const headers = sheet.data.headers;
  const parsed = formulas.map(item => ({ ...item, ...parseExpression(item.expression) }));
  const byTarget = new Map(parsed.map(item => [item.target, item]));
  const visited = new Set(), ordered = [], visiting = new Set();
  function visit(item) {
    if (visited.has(item.target)) return;
    if (visiting.has(item.target)) throw Error('Formula columns cannot reference each other in a cycle.');
    visiting.add(item.target);
    for (const source of [item.left, item.right]) if (byTarget.has(source)) visit(byTarget.get(source));
    visiting.delete(item.target);
    visited.add(item.target);
    ordered.push(item);
  }
  parsed.forEach(visit);
  for (const item of ordered) {
    const target = headers.indexOf(item.target);
    if (target < 0) throw Error(`Formula result column is missing: ${item.target}`);
    for (const index of rowIndices || sheet.data.rows.keys()) {
      const row = sheet.data.rows[index];
      const left = quantity(valueOf(item.left, row, headers)), right = quantity(valueOf(item.right, row, headers));
      if (!left || !right) { row[target] = ''; continue; }
      if (item.operator === '-' && left.date && right.date) row[target] = left.value - right.value;
      else if (left.date || right.date) row[target] = '';
      else if (item.operator === '+') row[target] = left.value + right.value;
      else if (item.operator === '-') row[target] = left.value - right.value;
      else if (item.operator === '*') row[target] = left.value * right.value;
      else row[target] = right.value === 0 ? '' : left.value / right.value;
    }
  }
  return sheet;
}

export function assignFormula(sheet, target, expression) {
  if (!sheet.data.headers.includes(target)) throw Error('Choose a result column.');
  const formula = { target, expression: String(expression).trim() };
  parseExpression(formula.expression);
  const prior = sheet.formulas || [];
  sheet.formulas = [...prior.filter(item => item.target !== target), formula];
  try { recalculateFormulas(sheet); }
  catch (error) { sheet.formulas = prior; throw error; }
  return sheet;
}
