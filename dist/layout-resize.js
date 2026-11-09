import { fittedColumnWidth } from './column-autofit.js';

const STORAGE_KEY = 'jmptab-layout-v1';
const MIN_COLUMN_WIDTH = 96;
const MAX_COLUMN_WIDTH = 16384;
const ROW_NUMBER_WIDTH = 72;
const SPLITTER_WIDTH = 8;

function measurementFont(style) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createStorage() {
  let state = {};
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { /* Layout still works without storage. */ }
  return {
    get: key => state[key],
    set(key, value) {
      state[key] = value;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Keep the current layout. */ }
    }
  };
}

function attachSplitter({ handle, container, axis, limits, getSize, setSize, resetSize }) {
  const coordinate = event => axis === 'x' ? event.clientX : event.clientY;
  const origin = rect => axis === 'x' ? rect.left : rect.top;
  let activePointerId = null;

  function move(event) {
    if (event.pointerId !== activePointerId) return;
    const rect = container.getBoundingClientRect();
    const [minimum, maximum] = limits(rect);
    setSize(clamp(coordinate(event) - origin(rect), minimum, maximum));
  }

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('is-resizing');
    document.body.dataset.resizeAxis = axis;
    move(event);
  });
  handle.addEventListener('pointermove', move);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    handle.addEventListener(name, event => {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      document.body.classList.remove('is-resizing');
      delete document.body.dataset.resizeAxis;
    });
  }
  handle.addEventListener('dblclick', resetSize);
  handle.addEventListener('keydown', event => {
    const rect = container.getBoundingClientRect();
    const [minimum, maximum] = limits(rect);
    const previous = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
    const next = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
    let size;
    if (event.key === previous) size = getSize() - 16;
    else if (event.key === next) size = getSize() + 16;
    else if (event.key === 'Home') size = minimum;
    else if (event.key === 'End') size = maximum;
    else return;
    event.preventDefault();
    setSize(clamp(size, minimum, maximum));
  });
}

export function createResizableLayout({ workbench, navigator, navHandle, panes, paneHandle, table, tableScroll, getWorksheet, getPageSize }) {
  const storage = createStorage();
  let columnWidths = Array.isArray(storage.get('columnWidths'))
    ? storage.get('columnWidths').filter(width => Number.isFinite(width) && width >= MIN_COLUMN_WIDTH && width <= MAX_COLUMN_WIDTH)
    : [];
  let outputRatio = Number.isFinite(storage.get('outputRatio'))
    ? clamp(storage.get('outputRatio'), 0.1, 0.9) : 0.5;
  let navigatorWidth;

  function navLimits(rect) {
    return [120, Math.max(120, rect.width - 240 - SPLITTER_WIDTH)];
  }
  function setNavigatorWidth(width) {
    const value = Math.round(width);
    navigatorWidth = value;
    workbench.style.setProperty('--navigator-width', `${value}px`);
    navHandle.setAttribute('aria-valuenow', value);
    navHandle.setAttribute('aria-valuemax', Math.round(navLimits(workbench.getBoundingClientRect())[1]));
    storage.set('navigatorWidth', value);
  }
  function outputLimits(rect) {
    return [120, Math.max(120, rect.height - 260 - SPLITTER_WIDTH)];
  }
  function setOutputHeight(height) {
    outputRatio = height / Math.max(1, panes.getBoundingClientRect().height);
    panes.style.setProperty('--output-height', `${outputRatio * 100}%`);
    paneHandle.setAttribute('aria-valuenow', Math.round(outputRatio * 100));
    storage.set('outputRatio', outputRatio);
  }

  attachSplitter({
    handle: navHandle, container: workbench, axis: 'x', limits: navLimits,
    getSize: () => navigator.getBoundingClientRect().width,
    setSize: setNavigatorWidth,
    resetSize: () => setNavigatorWidth(clamp(workbench.clientWidth * 0.19, ...navLimits(workbench.getBoundingClientRect())))
  });
  attachSplitter({
    handle: paneHandle, container: panes, axis: 'y', limits: outputLimits,
    getSize: () => outputRatio * panes.clientHeight,
    setSize: setOutputHeight,
    resetSize: () => setOutputHeight(0.5 * panes.clientHeight)
  });

  function defaultColumnWidth(count) {
    return clamp(Math.floor((tableScroll.clientWidth - ROW_NUMBER_WIDTH - pageNumberWidth()) / Math.max(1, count)), 130, 360);
  }
  function pageNumberWidth() {
    const pageCount = Math.max(1, Math.ceil(getWorksheet().rows.length / getPageSize()));
    return Math.max(38, String(pageCount).length * 7 + 10);
  }
  function widthsFor(count) {
    const width = defaultColumnWidth(count);
    if (columnWidths.length < count) columnWidths.push(...Array(count - columnWidths.length).fill(width));
    if (columnWidths.length > count) columnWidths = columnWidths.slice(0, count);
    return columnWidths;
  }
  function applyColumnWidths(first = 0, last = columnWidths.length) {
    const columns = table.querySelectorAll('col');
    if (columns.length !== last - first + 2) return;
    const pageWidth = pageNumberWidth();
    columns[0].style.width = `${pageWidth}px`;
    columns[1].style.width = `${ROW_NUMBER_WIDTH}px`;
    for (let index = first; index < last; index++) {
      const width = columnWidths[index];
      columns[index - first + 2].style.width = `${width}px`;
      table.querySelector(`[data-resize-column="${index}"]`)?.setAttribute('aria-valuenow', width);
    }
    table.style.width = `${pageWidth + ROW_NUMBER_WIDTH + columnWidths.slice(first, last).reduce((sum, width) => sum + width, 0)}px`;
  }
  function setColumnWidth(index, width, persist = true) {
    columnWidths[index] = Math.round(clamp(width, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH));
    const visible = table.querySelectorAll('[data-resize-column]');
    applyColumnWidths(Number(visible[0]?.dataset.resizeColumn) || 0, (Number(visible[visible.length - 1]?.dataset.resizeColumn) || 0) + 1);
    if (persist) storage.set('columnWidths', columnWidths);
  }

  function autoFitColumn(index) {
    const worksheet = getWorksheet();
    const headerInput = table.querySelector(`thead input[data-col="${index}"]`);
    const cellInput = table.querySelector(`tbody input[data-col="${index}"]`);
    const headerStyle = getComputedStyle(headerInput);
    const cellStyle = getComputedStyle(cellInput || headerInput);
    const context = document.createElement('canvas').getContext('2d');
    context.font = measurementFont(headerStyle);
    const headerWidth = context.measureText(worksheet.headers[index]).width;
    context.font = measurementFont(cellStyle);
    const padding = Math.max(
      parseFloat(headerStyle.paddingLeft) + parseFloat(headerStyle.paddingRight),
      parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.paddingRight)
    ) + 4;
    const width = fittedColumnWidth({
      header: worksheet.headers[index], rows: worksheet.rows, columnIndex: index,
      measureHeader: () => headerWidth,
      measureCell: value => context.measureText(String(value)).width,
      padding, minimum: MIN_COLUMN_WIDTH
    });
    setColumnWidth(index, width);
  }

  let columnDrag = null;
  table.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-resize-column]');
    if (!handle || event.button !== 0) return;
    event.preventDefault();
    const index = Number(handle.dataset.resizeColumn);
    columnDrag = { index, pointerId: event.pointerId, startX: event.clientX, startWidth: columnWidths[index] };
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('is-resizing');
    document.body.dataset.resizeAxis = 'x';
  });
  table.addEventListener('pointermove', event => {
    if (!columnDrag || event.pointerId !== columnDrag.pointerId) return;
    setColumnWidth(columnDrag.index, columnDrag.startWidth + event.clientX - columnDrag.startX, false);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    table.addEventListener(name, event => {
      if (!columnDrag || event.pointerId !== columnDrag.pointerId) return;
      if (columnDrag) storage.set('columnWidths', columnWidths);
      columnDrag = null;
      document.body.classList.remove('is-resizing');
      delete document.body.dataset.resizeAxis;
    });
  }
  table.addEventListener('keydown', event => {
    const handle = event.target.closest('[data-resize-column]');
    if (!handle) return;
    const index = Number(handle.dataset.resizeColumn);
    let width;
    if (event.key === 'ArrowLeft') width = columnWidths[index] - 16;
    else if (event.key === 'ArrowRight') width = columnWidths[index] + 16;
    else if (event.key === 'Home') width = MIN_COLUMN_WIDTH;
    else if (event.key === 'End') width = MAX_COLUMN_WIDTH;
    else return;
    event.preventDefault();
    setColumnWidth(index, width);
  });
  table.addEventListener('dblclick', event => {
    const handle = event.target.closest('[data-resize-column]');
    if (handle) autoFitColumn(Number(handle.dataset.resizeColumn));
  });

  const savedNavWidth = storage.get('navigatorWidth');
  const initialNavWidth = Number.isFinite(savedNavWidth)
    ? savedNavWidth : clamp(workbench.clientWidth * 0.19, 160, 288);
  setNavigatorWidth(clamp(initialNavWidth, ...navLimits(workbench.getBoundingClientRect())));
  setOutputHeight(clamp(outputRatio * panes.clientHeight, ...outputLimits(panes.getBoundingClientRect())));
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 620) return;
    setNavigatorWidth(clamp(navigatorWidth, ...navLimits(workbench.getBoundingClientRect())));
    setOutputHeight(clamp(outputRatio * panes.clientHeight, ...outputLimits(panes.getBoundingClientRect())));
  });

  return { widthsFor, applyColumnWidths };
}
