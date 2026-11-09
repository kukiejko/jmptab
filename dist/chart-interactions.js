import { svgChart } from './chart.js';
import { copyChartFormatting } from './chart-formatting.js';

export function highlightScatterPoints(svg, bounds) {
  if (!bounds) {
    delete svg.dataset.selectedBounds;
  } else {
    svg.dataset.selectedBounds = encodeURIComponent(JSON.stringify(bounds));
  }
  for (const mark of svg.querySelectorAll('circle.chart-data-mark[data-point-x]')) {
    const x = Number(mark.dataset.pointX), y = Number(mark.dataset.pointY);
    const selected = Boolean(bounds && x >= bounds.xmin && x <= bounds.xmax && y >= bounds.ymin && y <= bounds.ymax);
    mark.dataset.baseFill ||= mark.getAttribute('fill') || '#3975dc';
    mark.classList.toggle('chart-selected-point', selected);
    mark.setAttribute('fill', selected ? '#f0a021' : mark.dataset.baseFill);
    mark.setAttribute('fill-opacity', !bounds ? '.8' : selected ? '1' : '.25');
    mark.setAttribute('r', selected ? '5' : '3.5');
    if (selected) { mark.setAttribute('stroke', '#684000'); mark.setAttribute('stroke-width', '1.6'); }
    else { mark.removeAttribute('stroke'); mark.removeAttribute('stroke-width'); }
  }
}

function xTicks(svg) {
  const marked = [...svg.querySelectorAll('text.x-axis-tick')];
  if (marked.length) return marked;
  const texts = [...svg.querySelectorAll('text[x][y]')].filter(text => text.getAttribute('text-anchor') === 'middle');
  const positions = [...new Set(texts.map(text => Number(text.getAttribute('y'))).filter(Number.isFinite))].sort((a, b) => b - a);
  if (positions.length < 2) return [];
  const tickY = positions[1];
  const ticks = texts.filter(text => Math.abs(Number(text.getAttribute('y')) - tickY) < 1);
  ticks.forEach(text => text.classList.add('x-axis-tick'));
  return ticks;
}

export function setChartXLabelAngle(svg, angle) {
    if (svg.hasAttribute('data-rect-zoom')) {
      const mode = document.getElementById('scatterDragMode')?.value;
      svg.setAttribute('aria-description', mode === 'select' ? 'Drag a rectangle to select worksheet rows within its X and Y bounds.' : mode === 'select-and-zoom' ? 'Drag a rectangle to select worksheet rows and zoom the X and Y axes. Double-click to reset the zoom.' : 'Drag a rectangle to zoom the X and Y axes. Double-click to reset.');
      const figure = svg.closest('.graph-result-figure');
      if (figure) figure.title = mode === 'select' ? 'Drag inside the plot to select worksheet rows. Drag the lower-right corner to resize.' : mode === 'select-and-zoom' ? 'Drag inside the plot to select rows and zoom; double-click to reset the zoom.' : 'Drag inside the plot to zoom X and Y; double-click to reset. Drag the lower-right corner to resize.';
    }
    for (const tick of xTicks(svg)) {
      const x = tick.getAttribute('x'), y = tick.getAttribute('y');
      tick.setAttribute('transform', angle ? `rotate(${angle} ${x} ${y})` : '');
      tick.setAttribute('text-anchor', angle < 0 ? 'start' : angle > 0 ? 'end' : 'middle');
    }
    svg.dataset.xLabelAngle = String(angle);
}

export function setXLabelAngle(container, angle) {
  for (const svg of container.querySelectorAll('svg.chart')) {
    setChartXLabelAngle(svg, Number(svg.dataset.xLabelAngle ?? angle));
  }
}

export function setupChartInteractions(container, onChange, resampleScatter, selectScatterRows) {
  let selection = null;
  const pointOnChart = (svg, event) => {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  };
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  container.addEventListener('pointerdown', event => {
    const svg = event.target.closest('svg.chart[data-rect-zoom]');
    if (!svg || event.button !== 0) return;
    const point = pointOnChart(svg, event);
    const plot = { left: 48, right: 534, top: 20, bottom: 214 };
    if (point.x < plot.left || point.x > plot.right || point.y < plot.top || point.y > plot.bottom) return;
    event.preventDefault();
    const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    box.setAttribute('class', 'chart-zoom-selection');
    box.setAttribute('x', String(point.x));
    box.setAttribute('y', String(point.y));
    box.setAttribute('width', '0');
    box.setAttribute('height', '0');
    svg.append(box);
    svg.setPointerCapture(event.pointerId);
    selection = { svg, box, start: point, plot, pointerId: event.pointerId };
  });
  container.addEventListener('pointermove', event => {
    if (!selection || event.pointerId !== selection.pointerId) return;
    const { svg, box, start, plot } = selection;
    const point = pointOnChart(svg, event);
    const x = clamp(point.x, plot.left, plot.right), y = clamp(point.y, plot.top, plot.bottom);
    box.setAttribute('x', String(Math.min(start.x, x)));
    box.setAttribute('y', String(Math.min(start.y, y)));
    box.setAttribute('width', String(Math.abs(x - start.x)));
    box.setAttribute('height', String(Math.abs(y - start.y)));
  });
  const finishSelection = (event, apply) => {
    if (!selection || event.pointerId !== selection.pointerId) return;
    const { svg, box, plot } = selection;
    selection = null;
    const left = Number(box.getAttribute('x')), top = Number(box.getAttribute('y'));
    const right = left + Number(box.getAttribute('width'));
    const bottom = top + Number(box.getAttribute('height'));
    box.remove();
    if (!apply || right - left < 6 || bottom - top < 6) return;
    const current = JSON.parse(decodeURIComponent(svg.dataset.axisBounds));
    const x = position => current.xmin + (position - plot.left) / (plot.right - plot.left) * (current.xmax - current.xmin);
    const y = position => current.ymax - (position - plot.top) / (plot.bottom - plot.top) * (current.ymax - current.ymin);
    const model = JSON.parse(decodeURIComponent(svg.dataset.rectZoom));
    const next = { xmin: x(left), xmax: x(right), ymin: y(bottom), ymax: y(top) };
    const mode = document.getElementById('scatterDragMode')?.value;
    if (mode === 'select' || mode === 'select-and-zoom') {
      if (selectScatterRows(next) === null) return;
      if (mode === 'select') {
        highlightScatterPoints(svg, next);
        onChange();
        return;
      }
    }
    const sample = resampleScatter(next);
    if (!sample) return;
    const template = document.createElement('template');
    template.innerHTML = svgChart({ ...model, points: sample.points, axisBounds: next });
    const replacement = template.content.firstElementChild;
    replacement.dataset.xLabelAngle = svg.dataset.xLabelAngle || '0';
    svg.replaceWith(replacement);
    copyChartFormatting(svg, replacement);
    if (mode === 'select-and-zoom') highlightScatterPoints(replacement, next);
    else if (svg.dataset.selectedBounds) highlightScatterPoints(replacement, JSON.parse(decodeURIComponent(svg.dataset.selectedBounds)));
    setXLabelAngle(container, Number(document.getElementById('xLabelAngle')?.value || 0));
    onChange();
  };
  container.addEventListener('pointerup', event => finishSelection(event, true));
  container.addEventListener('pointercancel', event => finishSelection(event, false));
  container.addEventListener('dblclick', event => {
    const svg = event.target.closest('svg.chart');
    if (svg?.hasAttribute('data-rect-zoom')) {
      const model = JSON.parse(decodeURIComponent(svg.dataset.rectZoom));
      const sample = resampleScatter(null);
      if (!sample) return;
      const template = document.createElement('template');
      template.innerHTML = svgChart({ ...model, points: sample.points });
      const replacement = template.content.firstElementChild;
      replacement.dataset.xLabelAngle = svg.dataset.xLabelAngle || '0';
      svg.replaceWith(replacement);
      copyChartFormatting(svg, replacement);
      if (svg.dataset.selectedBounds) highlightScatterPoints(replacement, JSON.parse(decodeURIComponent(svg.dataset.selectedBounds)));
      setXLabelAngle(container, Number(document.getElementById('xLabelAngle')?.value || 0));
      onChange();
    }
  });
}

