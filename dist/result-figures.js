export function wrapResultCharts(html, document) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('svg.chart').forEach((chart, index) => {
    if (chart.closest('.graph-result-figure')) return;
    const figure = document.createElement('div');
    figure.className = 'graph-result-figure analysis-figure';
    figure.setAttribute('role', 'group');
    figure.setAttribute('aria-label', `Resizable graph ${index + 1}`);
    figure.title = 'Drag the lower-right corner to resize';
    chart.replaceWith(figure);
    figure.append(chart);
  });
  return template.innerHTML;
}

export function applyFigureSizes(container, sizes) {
  if (!sizes) return;
  container.querySelectorAll('.graph-result-figure').forEach((figure, index) => {
    const size = sizes[index];
    if (!size) return;
    figure.classList.add('manual-figure-size');
    figure.style.width = `${size.width}px`;
    figure.style.height = `${size.height}px`;
  });
}

export function measureFigureSizes(container) {
  return [...container.querySelectorAll('.graph-result-figure')].map(figure => {
    const { width, height } = figure.getBoundingClientRect();
    return { width: Math.round(width), height: Math.round(height) };
  });
}
