import { numeric } from './stats.js';

export function scatterRowsInBounds(rows, { xColumn, yColumn, groupColumn = null, xFormat = 'float' }, bounds) {
  const selected = new Set();
  const temporal = xFormat === 'date' || xFormat === 'timestamp';
  rows.forEach((row, index) => {
    const x = temporal ? Date.parse(row[xColumn]) : numeric(row[xColumn]);
    const y = numeric(row[yColumn]);
    if (!Number.isFinite(x) || y === null ||
        (groupColumn !== null && !String(row[groupColumn] ?? '').trim())) return;
    if (x >= bounds.xmin && x <= bounds.xmax && y >= bounds.ymin && y <= bounds.ymax) selected.add(index);
  });
  return selected;
}
