import { readChartFormatting } from './chart-formatting.js';

function entriesFor(svg) {
  if (svg.dataset.legendNative === 'true' || svg.classList.contains('response-surface-chart')) return [];
  if (svg.dataset.legend) {
    try { return JSON.parse(decodeURIComponent(svg.dataset.legend)); } catch { /* Use a visible fallback. */ }
  }
  if (svg.classList.contains('boxplot-chart')) return [
    { label: 'Q1–Q3', color: '#c9def5' },
    { label: 'Median', color: '#143d6b', line: true },
    { label: 'Whiskers', color: '#42678e', line: true },
    { label: 'Outliers', color: '#315d8f' }
  ];
  if (svg.getAttribute('aria-label')?.startsWith('Mean intervals')) return [
    { label: 'Group mean', color: '#285b9c' }, { label: '95% confidence interval', color: '#285b9c', line: true }
  ];
  if (svg.getAttribute('aria-label')?.startsWith('Factorial')) return [
    { label: 'Main effect / low level', color: '#285b9c', line: true },
    { label: 'High level', color: '#bf5942', line: true }
  ];
  const source = svg.querySelector('circle[fill],rect[fill],polyline[stroke],path[stroke]');
  const color = source?.getAttribute('fill') || source?.getAttribute('stroke') || '#3975dc';
  const label = svg.getAttribute('aria-label')?.startsWith('Category frequency') ? 'Frequency' : svg.getAttribute('aria-label') || 'Data';
  return [{ label, color }];
}

export function ensureChartLegends(container) {
  for (const svg of container.querySelectorAll('svg.chart')) {
    if (svg.nextElementSibling?.classList.contains('chart-legend')) continue;
    const entries = entriesFor(svg);
    if (!entries.length) continue;
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.setAttribute('aria-label', 'Chart legend');
    for (const entry of entries) {
      const item = document.createElement('span');
      item.className = 'chart-legend-item';
      const swatch = document.createElement('i');
      swatch.className = entry.line ? 'chart-legend-line' : 'chart-legend-swatch';
      swatch.style.setProperty('--legend-color', entry.color);
      const label = document.createElement('span');
      label.textContent = entry.label;
      item.append(swatch, label);
      legend.append(item);
    }
    svg.after(legend);
    const formatting = readChartFormatting(svg);
    legend.hidden = !formatting.legend;
    legend.style.order = formatting.legendPosition === 'top' ? '-1' : '';
  }
}

export function appendLegendToSvgClone(source, clone) {
  const legend = source.nextElementSibling;
  if (!legend?.classList.contains('chart-legend') || legend.hidden) return clone;
  const parts = (clone.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isFinite(value))) return clone;
  const items = [...legend.querySelectorAll('.chart-legend-item')];
  const rows = Math.ceil(items.length / 3);
  const extraHeight = 20 + rows * 20;
  const top = readChartFormatting(source).legendPosition === 'top';
  clone.setAttribute('viewBox', `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3] + extraHeight}`);
  const namespace = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(namespace, 'g');
  group.setAttribute('font-family', 'Segoe UI, sans-serif');
  group.setAttribute('font-size', '11');
  group.setAttribute('fill', '#354b66');
  items.forEach((item, index) => {
    const marker = item.querySelector('i');
    const x = 48 + index % 3 * 175, y = (top ? 17 : parts[3] + 17) + Math.floor(index / 3) * 20;
    const color = marker.style.getPropertyValue('--legend-color') || '#3975dc';
    const shape = document.createElementNS(namespace, marker.classList.contains('chart-legend-line') ? 'line' : 'rect');
    if (shape.tagName.toLowerCase() === 'line') {
      shape.setAttribute('x1', String(x)); shape.setAttribute('x2', String(x + 12));
      shape.setAttribute('y1', String(y - 4)); shape.setAttribute('y2', String(y - 4));
      shape.setAttribute('stroke', color); shape.setAttribute('stroke-width', '2');
    } else {
      shape.setAttribute('x', String(x)); shape.setAttribute('y', String(y - 10));
      shape.setAttribute('width', '10'); shape.setAttribute('height', '10'); shape.setAttribute('fill', color);
    }
    const text = document.createElementNS(namespace, 'text');
    text.setAttribute('x', String(x + 17)); text.setAttribute('y', String(y));
    text.textContent = item.lastElementChild?.textContent || '';
    group.append(shape, text);
  });
  if (top) {
    const chart = document.createElementNS(namespace, 'g');
    chart.setAttribute('transform', `translate(0 ${extraHeight})`);
    chart.append(...clone.childNodes);
    clone.append(chart);
  }
  clone.append(group);
  return clone;
}

export function appendExportContext(chart, { title, sheetName, observations }) {
  const namespace = 'http://www.w3.org/2000/svg';
  const { width, height } = chart.viewBox.baseVal;
  const headerHeight = 68;
  const wrapper = document.createElementNS(namespace, 'svg');
  wrapper.setAttribute('xmlns', namespace);
  wrapper.setAttribute('viewBox', `0 0 ${width} ${height + headerHeight}`);
  wrapper.setAttribute('font-family', 'Segoe UI, sans-serif');
  wrapper.setAttribute('font-size', '12');
  const background = document.createElementNS(namespace, 'rect');
  for (const [name, value] of Object.entries({ x: 0, y: 0, width, height: height + headerHeight, fill: '#fff' })) background.setAttribute(name, String(value));
  wrapper.append(background);
  const heading = document.createElementNS(namespace, 'text');
  for (const [name, value] of Object.entries({ x: 20, y: 29, fill: '#183552', 'font-size': 18, 'font-weight': 600 })) heading.setAttribute(name, String(value));
  heading.textContent = title;
  wrapper.append(heading);
  const subtitle = document.createElementNS(namespace, 'text');
  for (const [name, value] of Object.entries({ x: 20, y: 49, fill: '#526987', 'font-size': 11 })) subtitle.setAttribute(name, String(value));
  subtitle.textContent = `${sheetName} · ${Number.isFinite(Number(observations)) ? `${Number(observations).toLocaleString('en-US').replaceAll(',', ' ')} observations` : 'Observations unavailable'}`;
  wrapper.append(subtitle);
  chart.setAttribute('x', '0');
  chart.setAttribute('y', String(headerHeight));
  chart.setAttribute('width', String(width));
  chart.setAttribute('height', String(height));
  wrapper.append(chart);
  const metadata = document.createElementNS(namespace, 'title');
  metadata.textContent = `${title} — ${sheetName}`;
  wrapper.prepend(metadata);
  return wrapper;
}

