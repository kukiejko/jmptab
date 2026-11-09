const DEFAULTS = Object.freeze({ xAxis: true, yAxis: true, gridlines: true, xTitle: true, yTitle: true, dataLabels: false, legend: true, legendPosition: 'bottom', xTitleText: '', yTitleText: '' });

export function normalizeChartFormatting(value = {}) {
  const settings = { ...DEFAULTS };
  for (const key of ['xAxis', 'yAxis', 'gridlines', 'xTitle', 'yTitle', 'dataLabels', 'legend']) {
    if (typeof value[key] === 'boolean') settings[key] = value[key];
  }
  if (['top', 'bottom'].includes(value.legendPosition)) settings.legendPosition = value.legendPosition;
  for (const key of ['xTitleText', 'yTitleText']) if (typeof value[key] === 'string') settings[key] = value[key].trim().slice(0, 100);
  return settings;
}

export function readChartFormatting(svg) {
  try { return normalizeChartFormatting(JSON.parse(svg.dataset.chartFormatting || '{}')); }
  catch { return normalizeChartFormatting(); }
}

export function applyChartFormatting(svg, value, { strict = true } = {}) {
  const settings = normalizeChartFormatting(value);
  const marks = [...svg.querySelectorAll('.chart-data-mark')];
  if (strict && settings.dataLabels && marks.length > 50) throw new Error('Data labels need 50 or fewer visible marks. Zoom in or hide data labels.');
  svg.dataset.chartFormatting = JSON.stringify(settings);
  let style = svg.querySelector(':scope > style[data-chart-format-style]');
  if (!style) {
    style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.dataset.chartFormatStyle = '';
    svg.append(style);
  }
  style.textContent = [
    !settings.xAxis && '.x-axis-tick{display:none}',
    !settings.yAxis && '.chart-y-tick{display:none}',
    !settings.gridlines && '.chart-gridline{display:none}',
    !settings.xTitle && '.chart-x-title{display:none}',
    !settings.yTitle && '.chart-y-title{display:none}'
  ].filter(Boolean).join('');
  for (const [selector, text] of [['.chart-x-title', settings.xTitleText], ['.chart-y-title', settings.yTitleText]]) {
    const title = svg.querySelector(selector);
    if (title && text) title.textContent = text;
  }
  svg.querySelector(':scope > g.chart-data-labels')?.remove();
  if (settings.dataLabels && marks.length && marks.length <= 50) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'chart-data-labels');
    group.setAttribute('font-size', '10');
    group.setAttribute('fill', '#17334f');
    group.setAttribute('pointer-events', 'none');
    for (const mark of marks) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const x = mark.tagName.toLowerCase() === 'circle' ? Number(mark.getAttribute('cx')) : Number(mark.getAttribute('x')) + Number(mark.getAttribute('width')) / 2;
      const y = mark.tagName.toLowerCase() === 'circle' ? Number(mark.getAttribute('cy')) : Number(mark.getAttribute('y'));
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(Math.max(12, y - 7)));
      label.setAttribute('text-anchor', 'middle');
      label.textContent = mark.dataset.chartValue;
      group.append(label);
    }
    svg.append(group);
  }
  const legend = svg.nextElementSibling;
  if (legend?.classList.contains('chart-legend')) {
    legend.hidden = !settings.legend;
    legend.style.order = settings.legendPosition === 'top' ? '-1' : '';
  }
  return settings;
}

export function copyChartFormatting(source, target) {
  if (source.dataset.chartFormatting) applyChartFormatting(target, readChartFormatting(source), { strict: false });
  return target;
}
