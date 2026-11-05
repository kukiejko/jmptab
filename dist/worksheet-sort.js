export function sortWorksheetRows(rows, column, direction = 'ascending') {
  const sign = direction === 'descending' ? -1 : 1;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    const a = String(left.row[column] ?? '').trim();
    const b = String(right.row[column] ?? '').trim();
    if (!a || !b) return (!a) - (!b) || left.index - right.index;
    const aNumber = Number(a), bNumber = Number(b);
    const bothNumeric = Number.isFinite(aNumber) && Number.isFinite(bNumber);
    const comparison = bothNumeric ? Math.sign(aNumber - bNumber) : collator.compare(a, b);
    return comparison * sign || left.index - right.index;
  }).map(entry => entry.row);
}
