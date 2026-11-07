export const VISIBLE_COLUMNS = 40;

export function columnWindow(total, start = 0) {
  const windowed = total > VISIBLE_COLUMNS;
  const first = windowed ? Math.max(0, Math.min(Math.trunc(start) || 0, total - VISIBLE_COLUMNS)) : 0;
  const last = windowed ? first + VISIBLE_COLUMNS : total;
  return { first, last, windowed };
}
