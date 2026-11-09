export const DEFAULT_PAGE_SIZE = 200;
export const MAX_PAGE_SIZE = 1000;
export const PAGE_VIEW_MODES = ['first', 'edges', 'all', 'sample', 'selected'];

export function validPageSize(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= MAX_PAGE_SIZE;
}

export function pageNumberForRow(index, pageSize = DEFAULT_PAGE_SIZE) {
  if (!Number.isInteger(index) || index < 0 || !validPageSize(pageSize)) throw Error('Invalid worksheet row or page size.');
  return Math.floor(index / pageSize) + 1;
}

export function worksheetRowsForView(rows, page, mode = 'edges', pageSize = DEFAULT_PAGE_SIZE, selectedRows = new Set()) {
  if (!validPageSize(pageSize)) throw Error('Rows per page must be between 1 and 1,000.');
  if (!PAGE_VIEW_MODES.includes(mode)) throw Error('Unknown worksheet page view.');
  if (mode === 'selected') {
    const indices = [...selectedRows].filter(index => Number.isInteger(index) && index >= 0 && index < rows.length).sort((a, b) => a - b);
    return indices.slice((page - 1) * pageSize, page * pageSize).map(index => ({ row: rows[index], index }));
  }
  if (mode === 'edges' && rows.length > pageSize * 2) {
    const head = rows.slice(0, pageSize).map((row, index) => ({ row, index }));
    const tailStart = Math.floor((rows.length - 1) / pageSize) * pageSize;
    const tail = rows.slice(tailStart).map((row, offset) => ({ row, index: tailStart + offset }));
    return [...head, { omitted: tailStart - pageSize, first: pageSize + 1, last: tailStart }, ...tail];
  }
  if (mode === 'sample') {
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);
    const count = Math.ceil(pageRows.length * 0.3);
    return Array.from({ length: count }, (_, sampleIndex) => {
      const offset = count === 1 ? 0 : Math.round(sampleIndex * (pageRows.length - 1) / (count - 1));
      return { row: pageRows[offset], index: start + offset };
    });
  }
  const start = mode === 'first' || mode === 'edges' ? 0 : (page - 1) * pageSize;
  const count = mode === 'edges' ? rows.length : pageSize;
  return rows.slice(start, start + count).map((row, offset) => ({ row, index: start + offset }));
}
