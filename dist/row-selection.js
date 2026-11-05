export function selectRows(selected, row, anchor, { shift = false, toggle = false } = {}) {
  const next = new Set(toggle ? selected : []);
  if (shift && anchor !== null) {
    for (let index = Math.min(anchor, row); index <= Math.max(anchor, row); index++) next.add(index);
    return { selected: next, anchor };
  }
  if (toggle && next.has(row)) next.delete(row);
  else next.add(row);
  return { selected: next, anchor: row };
}
