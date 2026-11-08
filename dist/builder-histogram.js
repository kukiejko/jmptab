import { numeric } from './stats.js';

const MAX_PANELS = 24;
const MAX_SERIES = 16;
const colors = ['#3877c7', '#d47434', '#25856e', '#8b59ab', '#b64e71', '#587d2c', '#346c88', '#915b3d',
  '#5273aa', '#ab7e25', '#66738b', '#007f9c', '#a04d43', '#6554a0', '#427744', '#8a6480'];

export function buildHistogram(data, options) {
  const { columns, overlay, group, by, combinations, binCount, percent, sameX, sameY } = options;
  if (!columns.length) throw Error('Select at least one continuous variable.');
  const panels = new Map();
  const seriesColors = new Map();
  const bySets = by.length > 1 && !combinations ? by.map(column => [column]) : [by];

  function visit(row, callback) {
    const groupValue = group === null ? '' : String(row[group] ?? '');
    if (group !== null && !groupValue.trim()) return;
    for (const byColumns of bySets) {
      const values = byColumns.map(column => String(row[column] ?? ''));
      if (values.some(value => !value.trim())) continue;
      const facetKey = byColumns.length ? JSON.stringify([byColumns, values]) : '';
      for (const column of columns) {
        const value = numeric(row[column]);
        if (value === null) continue;
        const panelKey = (overlay ? '*' : column) + ':' + facetKey;
        const seriesKey = JSON.stringify([column, groupValue]);
        callback(value, panelKey, seriesKey, column, groupValue, byColumns, values);
      }
    }
  }

  for (const row of data.rows) {
    visit(row, (value, panelKey, seriesKey, column, groupValue, byColumns, levels) => {
      if (!panels.has(panelKey)) {
        if (panels.size >= MAX_PANELS) throw Error('This selection creates more than 24 histograms. Choose fewer By variables or levels.');
        const facet = byColumns.map((index, i) => data.headers[index] + ' = ' + levels[i]).join(' · ');
        const variable = overlay ? 'Overlaid variables' : data.headers[column];
        panels.set(panelKey, { title: facet ? variable + ' · ' + facet : variable, min: value, max: value, n: 0, series: new Map() });
      }
      const panel = panels.get(panelKey);
      if (!panel.series.has(seriesKey)) {
        if (panel.series.size >= MAX_SERIES) throw Error('This selection creates more than 16 series in one graph. Choose fewer variables or groups.');
        if (!seriesColors.has(seriesKey)) seriesColors.set(seriesKey, colors[seriesColors.size % colors.length]);
        const label = group === null ? data.headers[column] : overlay ? data.headers[column] + ' · ' + groupValue : groupValue;
        panel.series.set(seriesKey, { label, color: seriesColors.get(seriesKey), n: 0, sum: 0, sumSquares: 0 });
      }
      const series = panel.series.get(seriesKey);
      series.n++;
      series.sum += value;
      series.sumSquares += value * value;
      panel.n++;
      panel.min = Math.min(panel.min, value);
      panel.max = Math.max(panel.max, value);
    });
  }
  if (!panels.size) throw Error('The selected columns contain no numeric observations with complete group labels.');

  const plots = [...panels.values()];
  const sharedMin = Math.min(...plots.map(panel => panel.min));
  const sharedMax = Math.max(...plots.map(panel => panel.max));
  const sharedBins = Math.min(20, Math.ceil(Math.sqrt(Math.max(...plots.map(panel => panel.n)))));
  for (const panel of plots) {
    let min = sameX ? sharedMin : panel.min;
    let max = sameX ? sharedMax : panel.max;
    if (min === max) {
      const padding = Math.max(.5, Math.abs(min) * .01);
      min -= padding;
      max += padding;
    }
    panel.min = min;
    panel.max = max;
    panel.binCount = binCount || (sameX ? sharedBins : Math.min(20, Math.ceil(Math.sqrt(panel.n))));
    for (const series of panel.series.values()) series.bins = Array(panel.binCount).fill(0);
  }
  for (const row of data.rows) {
    visit(row, (value, panelKey, seriesKey) => {
      const panel = panels.get(panelKey);
      const index = Math.min(panel.binCount - 1, Math.floor((value - panel.min) / (panel.max - panel.min) * panel.binCount));
      panel.series.get(seriesKey).bins[index]++;
    });
  }

  for (const panel of plots) {
    panel.series = [...panel.series.values()];
    let maxHeight = 0;
    for (const series of panel.series) {
      series.heights = series.bins.map(count => percent ? count / series.n * 100 : count);
      series.mean = series.sum / series.n;
      series.sd = series.n > 1 ? Math.sqrt(Math.max(0, (series.sumSquares - series.sum * series.sum / series.n) / (series.n - 1))) : 0;
      maxHeight = Math.max(maxHeight, ...series.heights);
      if (options.normalFit && series.sd > 0) {
        const binWidth = (panel.max - panel.min) / panel.binCount;
        maxHeight = Math.max(maxHeight, (percent ? 100 : series.n) * binWidth / (series.sd * Math.sqrt(2*Math.PI)));
      }
    }
    panel.yMax = Math.max(4, Math.ceil(maxHeight / 4) * 4);
  }
  if (sameY) {
    const max = Math.max(...plots.map(panel => panel.yMax));
    for (const panel of plots) panel.yMax = max;
  }
  return plots;
}

export function drawHistogram(plots, { percent, legend, normalFit = false, escape }) {
  const width = 620;
  const left = 63;
  const chartWidth = 535;
  const chartHeight = 145;
  const top = 45;
  const base = top + chartHeight;
  const format = value => escape(value.toLocaleString('en-US', { maximumSignificantDigits: 7 }));
  const clip = (value, max) => value.length > max ? value.slice(0, max - 1) + '…' : value;
  let offset = 0;
  const content = plots.map(panel => {
    const showLegend = legend || panel.series.length > 1;
    const legendHeight = showLegend ? Math.ceil(panel.series.length / 3) * 19 : 0;
    const yPosition = height => base - chartHeight * height / panel.yMax;
    const interval = chartWidth / panel.binCount;
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const height = i / 4 * panel.yMax;
      const y = yPosition(height);
      const x = left + i / 4 * chartWidth;
      const value = panel.min + i / 4 * (panel.max - panel.min);
      grid += `<line x1="${left}" x2="${left + chartWidth}" y1="${y}" y2="${y}" stroke="#e2e9f1"/>
        <text x="${left - 8}" y="${y + 3}" text-anchor="end">${format(height)}${percent ? '%' : ''}</text>
        <text x="${x}" y="${base + 17}" text-anchor="middle">${format(value)}</text>`;
    }
    const bars = panel.series.map(series => series.heights.map((height, index) => {
      if (!height) return '';
      const y = yPosition(height);
      const binStart = panel.min + index / panel.binCount * (panel.max - panel.min);
      const binEnd = panel.min + (index + 1) / panel.binCount * (panel.max - panel.min);
      return `<rect x="${left + interval * index + 1}" y="${y}" width="${interval - 2}" height="${base - y}"
        fill="${series.color}" fill-opacity="${panel.series.length > 1 ? '.48' : '.85'}" stroke="${series.color}">
        <title>${escape(series.label)} · ${format(binStart)} to ${format(binEnd)} · ${format(height)}${percent ? '%' : ''}</title></rect>`;
    }).join('')).join('');
    const curves = normalFit ? panel.series.filter(series => series.sd > 0).map(series => {
      const binWidth = (panel.max - panel.min) / panel.binCount;
      const points = Array.from({ length: 101 }, (_, index) => {
        const xValue = panel.min + (panel.max - panel.min) * index / 100;
        const z = (xValue - series.mean) / series.sd;
        const height = (percent ? 100 : series.n) * binWidth * Math.exp(-z*z/2) / (series.sd * Math.sqrt(2*Math.PI));
        return `${left + chartWidth*index/100},${yPosition(height)}`;
      }).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${series.color}" stroke-width="2.4"/>`;
    }).join('') : '';
    const keys = showLegend ? panel.series.map((series, index) => {
      const x = left + (index % 3) * 179;
      const y = base + 40 + Math.floor(index / 3) * 19;
      return `<rect x="${x}" y="${y - 9}" width="10" height="10" fill="${series.color}"/>
        <text x="${x + 15}" y="${y}"><title>${escape(series.label)}</title>${escape(clip(series.label, 25))}</text>`;
    }).join('') : '';
    const plot = `<g transform="translate(0 ${offset})">
      <text x="${left}" y="20" style="font-size:14px;font-weight:600"><title>${escape(panel.title)}</title>${escape(clip(panel.title, 75))}</text>
      <text x="${left}" y="36">${percent ? 'Percent' : 'Frequency'}</text>${grid}${bars}${curves}${keys}</g>`;
    offset += base + 31 + legendHeight;
    return plot;
  }).join('');
  return `<svg class="chart histogram-chart" viewBox="0 0 ${width} ${offset}" role="img" aria-label="${plots.length} histogram panels">${content}</svg>`;
}
