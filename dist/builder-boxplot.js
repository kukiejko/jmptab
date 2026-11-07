import { numeric } from './stats.js';

const MAX_BOXES = 80;
const format = value => Number(value).toLocaleString('en-US', { maximumSignificantDigits: 7 });
const quantile = (sorted, p) => {
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  return sorted[low] + (sorted[Math.ceil(position)] - sorted[low]) * (position - low);
};
function valueBounds(result, axis, references) {
  let low = Infinity, high = -Infinity;
  for (const panel of result.panels) for (const box of panel.boxes) for (const value of box.values) {
    const position = axis(value);
    low = Math.min(low, position);
    high = Math.max(high, position);
  }
  for (const value of references) {
    const position = axis(value);
    low = Math.min(low, position);
    high = Math.max(high, position);
  }
  return { low, high, span: high - low || 1 };
}

export function boxStatistics(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) throw Error('Each box needs at least one numeric value.');
  const n = sorted.length;
  const q1 = quantile(sorted, .25);
  const median = quantile(sorted, .5);
  const q3 = quantile(sorted, .75);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  const inliers = sorted.filter(value => value >= lowFence && value <= highFence);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  const confidenceHalfWidth = 1.57 * iqr / Math.sqrt(n);
  return {
    n, q1, median, q3, iqr, mean,
    whiskerLow: inliers[0], whiskerHigh: inliers.at(-1),
    outliers: sorted.filter(value => value < lowFence || value > highFence),
    ciLow: Math.max(q1, median - confidenceHalfWidth),
    ciHigh: Math.min(q3, median + confidenceHalfWidth)
  };
}

function passesFilter(row, filter) {
  if (!filter || filter.column === null || filter.column === undefined) return true;
  const actual = numeric(row[filter.column]);
  const expected = Number(filter.value);
  if (actual === null || !Number.isFinite(expected)) return false;
  if (filter.operator === '>') return actual > expected;
  if (filter.operator === '>=') return actual >= expected;
  if (filter.operator === '<') return actual < expected;
  if (filter.operator === '<=') return actual <= expected;
  if (filter.operator === '=') return actual === expected;
  throw Error('Choose a supported data filter.');
}

export function buildBoxplot(data, options) {
  const { layout, yColumns, groupColumns = [], panelColumn = null, filter = null, scaleType = 'linear' } = options;
  const multiple = layout.startsWith('multiple');
  const grouped = layout.endsWith('groups');
  if (!['one-simple', 'one-groups', 'multiple-simple', 'multiple-groups'].includes(layout)) throw Error('Choose a boxplot layout.');
  if (!Array.isArray(yColumns) || yColumns.length < 1 || (!multiple && yColumns.length !== 1)) throw Error('Choose the required Y columns.');
  if (yColumns.some(index => !Number.isInteger(index) || index < 0 || index >= data.headers.length)) throw Error('Choose valid Y columns.');
  if (grouped && (groupColumns.length < 1 || groupColumns.length > 4)) throw Error('Choose 1 to 4 grouping columns.');
  if (!grouped && groupColumns.length) throw Error('This layout does not use grouping columns.');
  if (groupColumns.some(index => !Number.isInteger(index) || index < 0 || index >= data.headers.length || yColumns.includes(index))) throw Error('Choose distinct categorical columns.');
  if (panelColumn !== null && (!Number.isInteger(panelColumn) || panelColumn < 0 || panelColumn >= data.headers.length || yColumns.includes(panelColumn) || groupColumns.includes(panelColumn))) throw Error('Choose a separate panel column.');
  if (!['linear', 'log10', 'ln'].includes(scaleType)) throw Error('Choose a supported scale.');
  const panels = new Map();
  let observations = 0;
  for (const row of data.rows) {
    if (!passesFilter(row, filter)) continue;
    const panelLabel = panelColumn === null ? '' : `${data.headers[panelColumn]}: ${String(row[panelColumn] ?? '').trim()}`;
    if (panelColumn !== null && !String(row[panelColumn] ?? '').trim()) continue;
    const category = groupColumns.map(index => `${data.headers[index]}: ${String(row[index] ?? '').trim()}`);
    if (groupColumns.some(index => !String(row[index] ?? '').trim())) continue;
    if (!panels.has(panelLabel)) panels.set(panelLabel, new Map());
    const boxes = panels.get(panelLabel);
    for (const column of yColumns) {
      const value = numeric(row[column]);
      if (value === null || (scaleType !== 'linear' && value <= 0)) continue;
      const label = [data.headers[column], ...category].join(' · ');
      if (!boxes.has(label)) {
        if ([...panels.values()].reduce((sum, item) => sum + item.size, 0) >= MAX_BOXES) throw Error('Too many boxplot groups (maximum 80).');
        boxes.set(label, { label, values: [] });
      }
      boxes.get(label).values.push(value);
      observations++;
    }
  }
  const result = [...panels].map(([label, boxes]) => ({
    label, boxes: [...boxes.values()].map(box => ({ label: box.label, values: box.values, ...boxStatistics(box.values) }))
  })).filter(panel => panel.boxes.length);
  if (!result.length) throw Error('No numeric observations match the selected variables and filter.');
  return { panels: result, observations, boxCount: result.reduce((sum, panel) => sum + panel.boxes.length, 0) };
}

function drawHorizontalBoxplot(result, options, escape, view, scale) {
  const axis = value => scale.type === 'log10' ? Math.log10(value) : scale.type === 'ln' ? Math.log(value) : value;
  const references = scale.referenceLines.filter(value => Number.isFinite(value) && (scale.type === 'linear' || value > 0));
  const { low, span } = valueBounds(result, axis, references);
  const xFor = value => 185 + (axis(value) - low) / span * 420;
  return `<div class="boxplot-panels">${result.panels.map(panel => {
    const height = Math.max(150, 80 + panel.boxes.length * 70);
    const bottom = height - 35;
    const lines = [];
    if (scale.showAxes) lines.push(`<path d="M185 24V${bottom}H605" fill="none" stroke="#6b819b"/>`);
    if (scale.showTicks) for (let tick = 0; tick <= 4; tick++) {
      const position = 185 + tick * 105;
      const transformedValue = low + tick * span / 4;
      const value = scale.type === 'log10' ? 10 ** transformedValue : scale.type === 'ln' ? Math.exp(transformedValue) : transformedValue;
      lines.push(`<line x1="${position}" y1="${bottom}" x2="${position}" y2="${bottom + 5}" stroke="#6b819b"/><text x="${position}" y="${bottom + 20}" text-anchor="middle">${escape(format(value))}</text>`);
    }
    for (const value of references) lines.push(`<line x1="${xFor(value)}" y1="24" x2="${xFor(value)}" y2="${bottom}" stroke="#c96354" stroke-dasharray="5 4"/><text x="${xFor(value) + 3}" y="20">${escape(format(value))}</text>`);
    const means = [], medians = [];
    panel.boxes.forEach((box, index) => {
      const y = 54 + index * 70;
      const q1 = xFor(box.q1), q3 = xFor(box.q3), median = xFor(box.median);
      const parts = [];
      if (view.whiskers) {
        parts.push(`<line x1="${xFor(box.whiskerLow)}" y1="${y}" x2="${xFor(box.whiskerHigh)}" y2="${y}" stroke="#42678e"/>`);
        for (const value of [box.whiskerLow, box.whiskerHigh]) parts.push(`<line x1="${xFor(value)}" y1="${y - 12}" x2="${xFor(value)}" y2="${y + 12}" stroke="#42678e"/>`);
      }
      if (view.box) parts.push(`<rect x="${Math.min(q1, q3)}" y="${y - 22}" width="${Math.max(1, Math.abs(q3 - q1))}" height="44" fill="#c9def5" stroke="#315d8f"/>`);
      if (view.confidence) parts.push(`<rect x="${xFor(box.ciLow)}" y="${y - 14}" width="${Math.max(1, xFor(box.ciHigh) - xFor(box.ciLow))}" height="28" fill="none" stroke="#154a80" stroke-dasharray="3 2"/>`);
      if (view.median) parts.push(`<line x1="${median}" y1="${y - 22}" x2="${median}" y2="${y + 22}" stroke="#143d6b" stroke-width="2"/>`);
      if (view.mean) parts.push(`<circle cx="${xFor(box.mean)}" cy="${y}" r="4" fill="#d5573b"/>`);
      const tooltip = `Group: ${box.label}\nQuartile 1: ${format(box.q1)}\nMedian: ${format(box.median)}\nQuartile 3: ${format(box.q3)}\nInterquartile Range (IQR): ${format(box.iqr)}\nWhiskers: ${format(box.whiskerLow)}, ${format(box.whiskerHigh)}\nN: ${box.n}`;
      parts.push(`<rect x="${Math.min(q1, q3) - 5}" y="${y - 25}" width="${Math.max(12, Math.abs(q3 - q1) + 10)}" height="50" fill="transparent" tabindex="0" data-box-tooltip="${escape(tooltip).replaceAll('\n', '&#10;')}"/>`);
      if (view.outliers) box.outliers.forEach((value, point) => parts.push(`<text class="boxplot-outlier" x="${xFor(value)}" y="${y + 4 + (point % 3 - 1) * 5}" text-anchor="middle" tabindex="0" data-box-tooltip="Value: ${escape(format(value))}&#10;N: 1">*</text>`));
      if (view.points) box.values.slice(0, 600).forEach((value, point) => parts.push(`<circle cx="${xFor(value)}" cy="${y + ((point * 37) % 31) - 15}" r="2" fill="#5b86bb" opacity=".55"/>`));
      means.push(`${xFor(box.mean)},${y}`);
      medians.push(`${median},${y}`);
      lines.push(`<text x="175" y="${y + 4}" text-anchor="end">${escape(box.label.length > 22 ? box.label.slice(0, 21) + '…' : box.label)}</text><g class="boxplot-box">${parts.join('')}</g>`);
      if (options.labels?.showValues) lines.push(`<text x="${median + 4}" y="${y - 26}">${escape(format(box.median))}</text>`);
    });
    if (view.meanLine && means.length > 1) lines.push(`<polyline points="${means.join(' ')}" fill="none" stroke="#d5573b" stroke-width="2"/>`);
    if (view.medianLine && medians.length > 1) lines.push(`<polyline points="${medians.join(' ')}" fill="none" stroke="#143d6b" stroke-width="2"/>`);
    return `<section class="boxplot-panel">${panel.label ? `<h4>${escape(panel.label)}</h4>` : ''}<svg class="chart boxplot-chart" viewBox="0 0 680 ${height}" role="img" aria-label="Horizontal boxplot ${escape(panel.label || 'all data')}">${lines.join('')}</svg></section>`;
  }).join('')}</div>`;
}

export function drawBoxplot(result, options, escape) {
  const view = { box: true, outliers: true, whiskers: true, mean: false, median: true,
    medianLine: false, meanLine: false, points: false, confidence: false, ...options.view };
  const scale = { showAxes: true, showTicks: true, transpose: false, type: 'linear', referenceLines: [], ...options.scale };
  if (scale.transpose) return drawHorizontalBoxplot(result, options, escape, view, scale);
  const axis = value => scale.type === 'log10' ? Math.log10(value) : scale.type === 'ln' ? Math.log(value) : value;
  const references = scale.referenceLines.filter(value => Number.isFinite(value) && (scale.type === 'linear' || value > 0));
  const { low, high, span } = valueBounds(result, axis, references);
  const mapValue = value => 350 - (axis(value) - low) / span * 275;
  const tooltip = box => `Group: ${box.label}\nQuartile 1: ${format(box.q1)}\nMedian: ${format(box.median)}\nQuartile 3: ${format(box.q3)}\nInterquartile Range (IQR): ${format(box.iqr)}\nWhiskers: ${format(box.whiskerLow)}, ${format(box.whiskerHigh)}\nN: ${box.n}`;
  const panels = result.panels.map(panel => {
    const width = Math.max(680, 110 + panel.boxes.length * 100);
    const xFor = index => 85 + index * 100;
    const line = (x1, y1, x2, y2, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`;
    const paths = [];
    const meanPoints = [];
    const medianPoints = [];
    panel.boxes.forEach((box, index) => {
      const x = xFor(index);
      const y1 = mapValue(box.q1), y3 = mapValue(box.q3), ym = mapValue(box.median);
      const tooltipText = escape(tooltip(box));
      const parts = [];
      if (view.whiskers) {
        parts.push(line(x, mapValue(box.whiskerHigh), x, mapValue(box.whiskerLow), 'stroke="#42678e"'));
        for (const value of [box.whiskerLow, box.whiskerHigh]) parts.push(line(x - 12, mapValue(value), x + 12, mapValue(value), 'stroke="#42678e"'));
      }
      if (view.box) parts.push(`<rect x="${x - 25}" y="${Math.min(y1, y3)}" width="50" height="${Math.max(1, Math.abs(y3 - y1))}" fill="#c9def5" stroke="#315d8f"/>`);
      if (view.confidence) parts.push(`<rect x="${x - 15}" y="${mapValue(box.ciHigh)}" width="30" height="${Math.max(1, mapValue(box.ciLow) - mapValue(box.ciHigh))}" fill="none" stroke="#154a80" stroke-dasharray="3 2"/>`);
      if (view.median) parts.push(line(x - 25, ym, x + 25, ym, 'stroke="#143d6b" stroke-width="2"'));
      if (view.mean) parts.push(`<circle cx="${x}" cy="${mapValue(box.mean)}" r="4" fill="#d5573b"/>`);
      parts.push(`<rect x="${x - 28}" y="${Math.min(y1, y3) - 5}" width="56" height="${Math.max(12, Math.abs(y3 - y1) + 10)}" fill="transparent" tabindex="0" data-box-tooltip="${tooltipText.replaceAll('\n', '&#10;')}"/>`);
      if (view.outliers) box.outliers.forEach((value, point) => {
        const px = x + (point % 3 - 1) * 7;
        parts.push(`<text class="boxplot-outlier" x="${px}" y="${mapValue(value) + 4}" text-anchor="middle" tabindex="0" data-box-tooltip="Value: ${escape(format(value))}&#10;N: 1">*</text>`);
      });
      if (view.points) box.values.slice(0, 600).forEach((value, point) => {
        const px = x + ((point * 37) % 41) - 20;
        parts.push(`<circle cx="${px}" cy="${mapValue(value)}" r="2" fill="#5b86bb" opacity=".55"/>`);
      });
      meanPoints.push(`${x},${mapValue(box.mean)}`);
      medianPoints.push(`${x},${ym}`);
      paths.push(`<g class="boxplot-box">${parts.join('')}</g><text x="${x}" y="382" text-anchor="middle">${escape(box.label.length > 18 ? box.label.slice(0, 17) + '…' : box.label)}</text>`);
      if (options.labels?.showValues) paths.push(`<text x="${x}" y="${ym - 7}" text-anchor="middle">${escape(format(box.median))}</text>`);
    });
    const connections = [view.meanLine && meanPoints.length > 1 ? `<polyline points="${meanPoints.join(' ')}" fill="none" stroke="#d5573b" stroke-width="2"/>` : '',
      view.medianLine && medianPoints.length > 1 ? `<polyline points="${medianPoints.join(' ')}" fill="none" stroke="#143d6b" stroke-width="2"/>` : ''].join('');
    const axisMarkup = scale.showAxes ? `${line(52, 350, width - 20, 350, 'stroke="#6b819b"')}${line(52, 45, 52, 350, 'stroke="#6b819b"')}` : '';
    const ticks = scale.showTicks ? Array.from({ length: 5 }, (_, i) => {
      const value = low + span * i / 4;
      const y = 350 - i * 275 / 4;
      const tickValue = scale.type === 'log10' ? 10 ** value : scale.type === 'ln' ? Math.exp(value) : value;
      return `${line(48, y, 52, y, 'stroke="#6b819b"')}<text x="44" y="${y + 4}" text-anchor="end">${escape(format(tickValue))}</text>`;
    }).join('') : '';
    const refs = references.map(value => `${line(52, mapValue(value), width - 20, mapValue(value), 'stroke="#c96354" stroke-dasharray="5 4"')}<text x="${width - 23}" y="${mapValue(value) - 4}" text-anchor="end">${escape(format(value))}</text>`).join('');
    const raw = `<svg class="chart boxplot-chart" viewBox="0 0 ${width} 420" role="img" aria-label="Boxplot ${escape(panel.label || 'all data')}">${axisMarkup}${ticks}${refs}${connections}${paths.join('')}</svg>`;
    return `<section class="boxplot-panel">${panel.label ? `<h4>${escape(panel.label)}</h4>` : ''}${raw}</section>`;
  }).join('');
  return `<div class="boxplot-panels">${panels}</div>`;
}
