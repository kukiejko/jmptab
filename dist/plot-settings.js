import { svgChart } from './chart.js';

export function parsePlotBound(value, format) {
  const text = String(value).trim();
  if (!text) throw new Error('Enter all four axis limits.');
  const parsed = format === 'date' || format === 'timestamp' ? Date.parse(text) : Number(text);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${format === 'date' || format === 'timestamp' ? 'date/time' : 'number'}: ${text}`);
  return parsed;
}

export function formatPlotBound(value, format) {
  if (format === 'date') return new Date(value).toISOString().slice(0, 10);
  if (format === 'timestamp') return new Date(value).toISOString().slice(0, 16) + 'Z';
  return String(Number(value.toPrecision(12)));
}

export function renderScatterWithBounds(svg, bounds, points = null, fit = undefined) {
  const model = JSON.parse(decodeURIComponent(svg.dataset.rectZoom));
  if (bounds && (!(bounds.xmin < bounds.xmax) || !(bounds.ymin < bounds.ymax))) throw new Error('Minimum must be less than maximum on both axes.');
  const template = document.createElement('template');
  template.innerHTML = svgChart({ ...model, points: points ?? model.points, fit: fit === undefined ? model.fit : fit, axisBounds: bounds });
  return template.content.firstElementChild;
}

export function preparePlotSettingsButtons(container) {
  for (const figure of container.querySelectorAll('.graph-result-figure')) {
    if (figure.querySelector(':scope > [data-plot-settings]')) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plot-settings-handle';
    button.dataset.plotSettings = '';
    button.setAttribute('aria-label', 'Plot settings');
    button.title = 'Format chart elements and axes';
    button.textContent = '⚙';
    figure.append(button);
  }
}
