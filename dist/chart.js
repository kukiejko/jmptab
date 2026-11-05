import { esc, fmt } from './result-format.js';

export function svgChart({
  points = [], bars = null, lines = [], xLabel = '', yLabel = '',
  connect = false, fit = null, bounds = null
}) {
  const width = 600;
  const height = 255;
  const padding = { left: 48, right: 66, top: 20, bottom: 41 };
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);

  if (bars) {
    xs.push(bars.min, bars.max);
    ys.push(0, ...bars.bins);
  }
  lines.forEach(line => ys.push(line.y));
  if (bounds) {
    xs.push(bounds.xmin, bounds.xmax);
    ys.push(bounds.ymin, bounds.ymax);
  }
  if (fit) {
    xs.push(fit.xmin, fit.xmax);
    ys.push(fit.ymin, fit.ymax,
      fit.intercept + fit.slope * fit.xmin,
      fit.intercept + fit.slope * fit.xmax);
  }

  let xmin = Math.min(...xs);
  let xmax = Math.max(...xs);
  let ymin = Math.min(...ys);
  let ymax = Math.max(...ys);
  if (xmin === xmax) { xmin -= 0.5; xmax += 0.5; }
  if (ymin === ymax) { ymin -= 0.5; ymax += 0.5; }
  if (bars) ymax = Math.ceil(ymax / 4) * 4;
  else {
    const margin = (ymax - ymin) * 0.12;
    ymin -= margin;
    ymax += margin;
  }

  const X = x => padding.left + (x - xmin) / (xmax - xmin) * (width - padding.left - padding.right);
  const Y = y => height - padding.bottom - (y - ymin) / (ymax - ymin) * (height - padding.top - padding.bottom);
  let body = '';

  for (let index = 0; index <= 4; index++) {
    const y = ymin + (ymax - ymin) * index / 4;
    body += `<line x1="${padding.left}" y1="${Y(y)}" x2="${width - padding.right}" y2="${Y(y)}" stroke="#e7ecf3"/><text x="${padding.left - 10}" y="${Y(y) + 3}" text-anchor="end">${fmt(y, bars ? 0 : 2)}</text>`;
    const x = xmin + (xmax - xmin) * index / 4;
    body += `<text x="${X(x)}" y="${height - padding.bottom + 18}" text-anchor="middle">${fmt(x, 1)}</text>`;
  }

  if (bars) {
    const barWidth = (width - padding.left - padding.right) / bars.bins.length;
    body += bars.bins.map((count, index) =>
      `<rect x="${padding.left + index * barWidth + 2}" y="${Y(count)}" width="${Math.max(1, barWidth - 4)}" height="${Y(0) - Y(count)}" fill="#5c89e4" rx="2"><title>${fmt(bars.min + index * bars.width)} – ${fmt(bars.min + (index + 1) * bars.width)}: ${count} observations</title></rect>`
    ).join('');
  }

  for (const line of lines) {
    body += `<line x1="${padding.left}" x2="${width - padding.right}" y1="${Y(line.y)}" y2="${Y(line.y)}" stroke="${line.color || '#9baabd'}" stroke-dasharray="5 4"/><text x="${width - padding.right + 7}" y="${Y(line.y) + 3}">${esc(line.label)}</text>`;
  }
  if (connect) {
    body += `<polyline points="${points.map(point => `${X(point[0])},${Y(point[1])}`).join(' ')}" fill="none" stroke="#386ed5" stroke-width="1.5"/>`;
  }
  if (fit) {
    body += `<line x1="${X(xmin)}" y1="${Y(fit.intercept + fit.slope * xmin)}" x2="${X(xmax)}" y2="${Y(fit.intercept + fit.slope * xmax)}" stroke="#203f76" stroke-width="2"/>`;
  }
  body += points.map(point =>
    `<circle cx="${X(point[0])}" cy="${Y(point[1])}" r="3.5" fill="${point[2] ? '#bf4848' : '#3975dc'}" fill-opacity=".8"><title>${fmt(point[0])}, ${fmt(point[1])}${point[2] ? ' · outside limits' : ''}</title></circle>`
  ).join('');

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(yLabel)} by ${esc(xLabel)}"><title>${esc(yLabel)} by ${esc(xLabel)}</title>${body}<text x="${width / 2}" y="${height - 3}" text-anchor="middle">${esc(xLabel)}</text></svg>`;
}
