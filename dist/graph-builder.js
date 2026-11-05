import { chartObservations, numeric, regression, summary } from './stats.js';
import { buildHistogram, drawHistogram } from './builder-histogram.js';

const candidates = [
  { id: 'gallery', label: 'Gallery', icon: 'M3 3h5v5H3zm9 0h5v5h-5zM3 12h5v5H3zm9 0h5v5h-5z' },
  { id: 'histogram', label: 'Histogram', icon: 'M3 17h14M4 17v-5h4v5m0 0V5h4v12m0 0V8h4v9' },
  { id: 'box', label: 'Boxplot', icon: 'M3 10h4m6 0h4M3 7v6m14-6v6M7 5h6v10H7zm3 0v10' },
  { id: 'bar', label: 'Bar chart', icon: 'M3 3v14h14M6 14V8m4 6V5m4 9v-4' },
  { id: 'scatter', label: 'Scatterplot', icon: 'M3 3v14h14M6 13h.1m2-4h.1m3 2h.1m1-5h.1m3 1h.1' },
  { id: 'series', label: 'Time series', icon: 'M3 3v14h14M5 13l3-5 3 3 4-6 2 2' }
];
const labels = Object.fromEntries(candidates.map(({ id, label }) => [id, label]));
const POINT_LIMIT = 800;
const $ = id => document.getElementById(id);

function icon(path) {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${path}"/></svg>`;
}

function boxSvg(stats, escape) {
  const { min, q1, median, q3, max } = stats;
  const scale = value => 45 + 510 * (value - min) / (max - min || 1);
  const middle = max === min ? 300 : scale(median);
  const left = max === min ? middle : scale(q1);
  const right = max === min ? middle : scale(q3);
  const low = max === min ? middle : scale(min);
  const high = max === min ? middle : scale(max);
  const format = value => escape(value.toLocaleString('en-US', { maximumSignificantDigits: 7 }));
  return `<svg class="chart" viewBox="0 0 600 190" role="img" aria-label="Boxplot with minimum and maximum whiskers">
    <line x1="${low}" y1="79" x2="${high}" y2="79" stroke="#416186"/>
    <path d="M${low} 65v28M${high} 65v28" stroke="#416186"/>
    <rect x="${left}" y="52" width="${Math.max(1, right - left)}" height="54" fill="#cbdff7" stroke="#416186"/>
    <line x1="${middle}" x2="${middle}" y1="52" y2="106" stroke="#224e83" stroke-width="2"/>
    <text x="${low}" y="135" text-anchor="middle">${format(min)}</text>
    ${max !== min ? `<text x="${high}" y="135" text-anchor="middle">${format(max)}</text>` : ''}
    <text x="300" y="168" text-anchor="middle">Median ${format(median)} · whiskers show minimum and maximum</text>
  </svg>`;
}

function categoryCounts(rows, column) {
  const counts = new Map();
  let n = 0;
  for (const row of rows) {
    const label = String(row[column] ?? '').trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
    n++;
  }
  if (!n) throw Error('Choose a column with at least one nonblank value.');
  const top = [];
  for (const entry of counts) {
    if (top.length === 10 && entry[1] <= top.at(-1)[1]) continue;
    top.push(entry);
    top.sort((a, b) => b[1] - a[1]);
    if (top.length > 10) top.pop();
  }
  const remainder = n - top.reduce((total, entry) => total + entry[1], 0);
  if (remainder) top.push(['Other categories', remainder]);
  return { entries: top, n };
}

function barSvg(entries, escape) {
  const max = Math.max(...entries.map(([, count]) => count));
  const height = 40 + entries.length * 27;
  const bars = entries.map(([label, count], index) => {
    const y = 16 + index * 27;
    const width = count / max * 385;
    const short = label.length > 21 ? label.slice(0, 20) + '…' : label;
    return `<text x="131" y="${y + 12}" text-anchor="end">${escape(short)}</text>
      <rect x="140" y="${y}" width="${width}" height="17" fill="#5c89d0"><title>${escape(label)} · ${count.toLocaleString('en-US')}</title></rect>
      <text x="${148 + width}" y="${y + 12}">${count.toLocaleString('en-US')}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 600 ${height}" role="img" aria-label="Category frequency bar chart">${bars}</svg>`;
}

function scatterPoints(rows, xColumn, yColumn) {
  let count = 0;
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const row of rows) {
    const x = numeric(row[xColumn]);
    const y = numeric(row[yColumn]);
    if (x === null || y === null) continue;
    count++;
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  if (!count) throw Error('Choose two columns with complete numeric pairs.');
  const points = [];
  const take = Math.min(count, POINT_LIMIT);
  let index = 0;
  for (const row of rows) {
    const x = numeric(row[xColumn]);
    const y = numeric(row[yColumn]);
    if (x === null || y === null) continue;
    if (index === Math.round(points.length * (count - 1) / Math.max(1, take - 1))) points.push([x, y]);
    index++;
  }
  return { points, n: count, bounds: { xmin, xmax, ymin, ymax } };
}

export function setupGraphBuilder({ getData, drawChart, escape, onCreate }) {
  const dialog = $('graphBuilder');
  const variable = $('gbVariable');
  const xField = $('gbX');
  const continuous = $('gbContinuous');
  const group = $('gbGroup');
  const byField = $('gbBy');
  const canvas = $('gbCanvas');
  const apply = $('gbApply');
  let data;
  let active;
  let preview;
  let sourceKey;
  let histogramKey;
  let histogramResult;
  const cache = new Map();

  function cached(key, compute) {
    if (!cache.has(key)) cache.set(key, compute());
    return cache.get(key);
  }

  const selected = field => Array.from(field.selectedOptions, option => Number(option.value));

  function histogramGraph(thumbnail) {
    const columns = thumbnail ? [Number(variable.value)] : selected(continuous);
    const options = {
      columns,
      overlay: !thumbnail && $('gbHistogramLayout').value === 'overlay',
      group: !thumbnail && group.value !== '' ? Number(group.value) : null,
      by: thumbnail ? [] : selected(byField),
      combinations: !thumbnail && $('gbCombinations').checked,
      binCount: thumbnail ? 0 : Number($('gbBins').value),
      percent: !thumbnail && $('gbYScale').value === 'percent',
      sameX: !thumbnail && $('gbSameX').checked,
      sameY: !thumbnail && $('gbSameY').checked
    };
    const key = JSON.stringify(options);
    if (key !== histogramKey) {
      const plots = buildHistogram(data, options);
      histogramResult = {
        svg: drawHistogram(plots, { percent: options.percent, legend: options.group !== null || options.overlay, escape }),
        note: plots.length === 1
          ? plots[0].n.toLocaleString('en-US') + ' observations plotted'
          : plots.length + ' histograms · ' + plots.reduce((total, panel) => total + panel.n, 0).toLocaleString('en-US') + ' observations plotted across panels'
      };
      histogramKey = key;
    }
    const column = columns.map(index => data.headers[index]).join(', ');
    const title = $('gbTitle').value.trim() || (columns.length === 1 ? 'Histogram of ' + column : 'Histograms');
    return { ...histogramResult, title, column, type: 'histogram', label: 'Histogram' };
  }

  function graph(type, thumbnail = false) {
    if (type === 'histogram') return histogramGraph(thumbnail);
    const y = Number(variable.value);
    const x = Number(xField.value);
    const yName = data.headers[y];
    const xName = data.headers[x];
    const rows = data.rows;
    if (variable.value === '') throw Error('Select a worksheet column.');
    const title = $('gbTitle').value.trim() || (type === 'scatter' ? yName + ' vs ' + xName : labels[type] + ' of ' + yName);
    let svg;
    let n;
    let shown;
    const numericSummary = () => cached('summary:' + y, () => summary(rows.map(row => row[y])));
    if (type === 'box') {
      const stats = numericSummary();
      n = stats.n;
      svg = boxSvg(stats, escape);
    } else if (type === 'bar') {
      const counts = cached('categories:' + y, () => categoryCounts(rows, y));
      n = counts.n;
      svg = barSvg(counts.entries, escape);
    } else if (type === 'scatter') {
      if (xField.value === '' || x === y) throw Error('Choose a different X column for the scatterplot.');
      const scatter = cached('scatter:' + x + ':' + y, () => scatterPoints(rows, x, y));
      n = scatter.n;
      const fit = $('gbFit').checked && !thumbnail
        ? cached('fit:' + x + ':' + y, () => regression(rows.map(row => row[x]), rows.map(row => row[y]), POINT_LIMIT))
        : null;
      const points = thumbnail && scatter.points.length > 100 ? scatter.points.filter((_, index) => index % 8 === 0) : scatter.points;
      shown = points.length;
      svg = drawChart({ points, fit, bounds: scatter.bounds, xLabel: xName, yLabel: yName });
    } else {
      const series = cached('series:' + y, () => {
        const values = [];
        const rowNumbers = [];
        rows.forEach((row, index) => {
          const value = numeric(row[y]);
          if (value === null) return;
          values.push(value);
          rowNumbers.push(index + 1);
        });
        if (values.length < 2) throw Error('Time series needs at least two numeric observations.');
        const points = chartObservations(values, -Infinity, Infinity).map(([index, value]) => [rowNumbers[index - 1], value]);
        return { points, n: values.length };
      });
      n = series.n;
      const points = thumbnail && series.points.length > 100 ? series.points.filter((_, index) => index % 8 === 0) : series.points;
      shown = points.length;
      svg = drawChart({ points, connect: true, xLabel: 'Worksheet row', yLabel: yName });
    }
    const note = n.toLocaleString('en-US') + ' observations' + (shown && shown < n ? ' · ' + shown.toLocaleString('en-US') + ' points displayed' : '');
    return { title, svg, note, type, column: yName, label: labels[type] };
  }

  function render() {
    const nextSourceKey = variable.value + ':' + xField.value;
    if (sourceKey !== nextSourceKey) cache.clear();
    sourceKey = nextSourceKey;
    const gallery = active === 'gallery';
    const histogram = active === 'histogram';
    $('gbVariableField').hidden = histogram;
    $('gbHistogramSource').hidden = !histogram;
    $('gbHistogramScale').hidden = !histogram;
    $('gbCombinations').disabled = byField.selectedOptions.length < 2;
    $('gbXField').hidden = !(gallery || active === 'scatter');
    $('gbBinsField').hidden = active !== 'histogram';
    $('gbFitField').hidden = active !== 'scatter';
    $('gbFilterLabel').hidden = !gallery;
    $('gbCanvasTitle').textContent = labels[active];
    for (const button of $('gbCandidates').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.graph === active));
    }
    for (const button of $('gbColumns').querySelectorAll('button')) {
      const isSelected = histogram
        ? continuous.options[Number(button.dataset.column)].selected
        : button.dataset.column === variable.value;
      button.setAttribute('aria-pressed', String(isSelected));
    }
    preview = null;
    apply.disabled = true;
    if (gallery) {
      const filter = $('gbFilter').value;
      const cards = candidates.slice(1).filter(({ id }) => filter === 'all' || (filter === 'two') === (id === 'scatter'));
      canvas.innerHTML = '<div class="gb-gallery">' + cards.map(({ id, label }) => {
        try {
          const item = graph(id, true);
          return `<button class="gb-card" data-graph="${id}"><strong>${label}</strong>${item.svg}</button>`;
        } catch (error) {
          return `<button class="gb-card" data-graph="${id}"><strong>${label}</strong><p>${escape(error.message)}</p></button>`;
        }
      }).join('') + '</div>';
      $('gbStatus').textContent = 'Select a graph to continue.';
      return;
    }
    try {
      preview = graph(active);
      canvas.innerHTML = `<article class="gb-document"><h3>${escape(preview.title)}</h3>${preview.svg}<p>${escape(preview.note)}</p></article>`;
      $('gbStatus').textContent = preview.note;
      apply.disabled = false;
    } catch (error) {
      canvas.innerHTML = `<p class="gb-empty">${escape(error.message)}</p>`;
      $('gbStatus').textContent = 'Select compatible source data.';
    }
  }

  function reset(initial = 'gallery') {
    active = initial;
    variable.selectedIndex = 0;
    xField.selectedIndex = data.headers.length > 1 ? 2 : 0;
    continuous.selectedIndex = 0;
    group.value = '';
    byField.selectedIndex = -1;
    $('gbHistogramLayout').value = 'separate';
    $('gbCombinations').checked = false;
    $('gbYScale').value = 'frequency';
    $('gbSameY').checked = true;
    $('gbSameX').checked = false;
    $('gbTitle').value = '';
    $('gbBins').value = '0';
    $('gbFit').checked = false;
    $('gbFilter').value = 'all';
    render();
  }

  function open(initial) {
    data = getData();
    cache.clear();
    histogramKey = undefined;
    const options = data.headers.map((name, index) => `<option value="${index}">C${index + 1} · ${escape(name)}</option>`).join('');
    variable.innerHTML = options;
    continuous.innerHTML = byField.innerHTML = options;
    group.innerHTML = '<option value="">None</option>' + options;
    xField.innerHTML = '<option value="">Select a column</option>' + options;
    $('gbColumns').innerHTML = data.headers.map((name, index) =>
      `<button draggable="true" data-column="${index}"><span>C${index + 1}</span><span>${escape(name)}</span></button>`
    ).join('');
    reset(initial);
    dialog.showModal();
  }

  $('gbCandidates').innerHTML = candidates.map(({ id, label, icon: path }) =>
    `<button data-graph="${id}">${icon(path)}${label}</button>`
  ).join('');
  dialog.addEventListener('click', event => {
    const candidate = event.target.closest('[data-graph]');
    if (candidate) {
      active = candidate.dataset.graph;
      canvas.scrollTop = 0;
      render();
      $('gbCandidates').querySelector(`[data-graph="${active}"]`).focus();
    }
    const column = event.target.closest('[data-column]');
    if (column) {
      if (active === 'histogram') {
        const option = continuous.options[Number(column.dataset.column)];
        option.selected = !option.selected;
      } else {
        variable.value = column.dataset.column;
        continuous.selectedIndex = variable.selectedIndex;
      }
      render();
    }
  });
  $('gbColumns').addEventListener('dragstart', event => {
    const column = event.target.closest('[data-column]');
    if (column) event.dataTransfer.setData('text/plain', column.dataset.column);
  });
  for (const select of [variable, xField, continuous, group, byField]) {
    select.addEventListener('dragover', event => event.preventDefault());
    select.addEventListener('drop', event => {
      event.preventDefault();
      const column = event.dataTransfer.getData('text/plain');
      if (!/^\d+$/.test(column) || Number(column) >= data.headers.length) return;
      if (select.multiple) select.options[Number(column)].selected = true;
      else select.value = column;
      if (select === variable) continuous.selectedIndex = variable.selectedIndex;
      render();
    });
  }
  dialog.addEventListener('change', event => {
    if (event.target === variable) continuous.selectedIndex = variable.selectedIndex;
    if (event.target === byField && byField.selectedOptions.length < 2) $('gbCombinations').checked = false;
    render();
  });
  $('gbTitle').addEventListener('input', () => { if (active !== 'gallery') render(); });
  $('gbReset').onclick = () => reset(active);
  $('gbCancel').onclick = $('closeGraphBuilder').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    cache.clear();
    histogramResult = undefined;
    preview = null;
    data = undefined;
    canvas.replaceChildren();
  });
  apply.onclick = () => {
    if (!preview) return;
    onCreate(preview);
    dialog.close();
  };
  return open;
}
