export function fittedColumnWidth({ header, rows, columnIndex, measureHeader, measureCell, padding, minimum }) {
  let widest = measureHeader(header);
  for (const row of rows) {
    widest = Math.max(widest, measureCell(row[columnIndex] ?? ''));
  }
  return Math.max(minimum, Math.ceil(widest + padding));
}
