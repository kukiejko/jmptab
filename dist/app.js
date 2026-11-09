import { setupGraphBuilder, scatterPoints, scatterTrendline, SCATTER_GROUP_COLORS } from './graph-builder.js';
import { scatterRowsInBounds } from './scatter-row-selection.js';
import { axisLabel } from './axis-label.js';
import { setupBoxplotBuilder } from './boxplot-builder.js';
import { buildBoxplot, drawBoxplot } from './builder-boxplot.js';
import { buildHistogram, drawHistogram } from './builder-histogram.js';
import { setupResponseSurfaceDialog, attachSurfaceRotation } from './response-surface-dialog.js';
import { setupGroupAnalysisDialog } from './group-analysis-dialog.js';
import { setupGraphLayoutDialog } from './graph-layout-dialog.js';
import { setupDataPreparationDialog } from './data-preparation-dialog.js';
import { recalculateFormulas, renameFormulaReference, removeFormulaDependencies } from './data-preparation.js';
import { setupFactorialDialog } from './factorial-dialog.js';
import { formatCommand, parseCommands } from './command-script.js';
import { setupCommandDialog } from './command-dialog.js';
import { inferColumnType } from './column-types.js';
import { COLUMN_FORMATS, CURRENCY_FORMATS, columnTypeLabel, customNumberIsRed, formatCellValue, formatLabel, validateCustomNumberPattern } from './column-format.js';
import { setupSampleDataDialog } from './sample-data-dialog.js';
import { setupCsvImportDialog } from './csv-import-dialog.js';
import { appendSampleWorksheet } from './sample-worksheet.js';
import { columnWindow, VISIBLE_COLUMNS } from './column-window.js';
import { DEFAULT_PAGE_SIZE, PAGE_VIEW_MODES, validPageSize, worksheetRowsForView, pageNumberForRow } from './worksheet-view.js';
import { groupedNumber } from './number-display.js';
import { executeAnalysis } from './analysis-execution.js';
import { esc, fmt, svgChart, renderAnalysisResult } from './analysis-rendering.js';
import { wrapResultCharts, applyFigureSizes, measureFigureSizes } from './result-figures.js';
import { ensureChartLegends, appendLegendToSvgClone, appendExportContext } from './result-legends.js';
import { highlightScatterPoints, setXLabelAngle, setChartXLabelAngle, setupChartInteractions } from './chart-interactions.js';
import { parsePlotBound, formatPlotBound, renderScatterWithBounds, preparePlotSettingsButtons } from './plot-settings.js';
import { applyChartFormatting, readChartFormatting } from './chart-formatting.js';
import { prepareMovableResults, setupResultDragging } from './result-drag.js';
import { createResizableLayout } from './layout-resize.js';
import { parseXML } from './xml-import.js';
import { parseXLSX } from './xlsx-import.js';
import { blankWorksheet, COLUMN_ROLE_GROUPS, nextWorksheetName, renameWorksheet, validWorksheet, visibleWorksheetIndices, moveWorksheet, hideWorksheet, showWorksheet, deleteWorksheet } from './workbook.js';
import { sortWorksheetRows } from './worksheet-sort.js';
import { selectRows } from './row-selection.js';
import { columnsClipboardText, pasteColumns, deleteColumn, deleteRows, insertColumn, insertRow, moveColumn } from './worksheet-structure.js';
import { saveSession, loadSession } from './session.js';
import {summary,csvChunks,numeric,MAX_ROWS,MAX_COLUMNS} from './stats.js';
const $ = id => document.getElementById(id);
document.querySelector('#analysisDialog .analysis-bar').insertAdjacentHTML('beforeend', '<div class="field" id="capGroupField" hidden><label for="capGroup">Capability subgroup column (optional)</label><select id="capGroup"><option value="">Use individual observations</option></select></div>');
const names={summary:'Descriptive statistics',histogram:'Histogram',regression:'Linear regression',control:'Individuals control chart','p-chart':'P chart','moving-average':'Moving average','exponential-smoothing':'Single exponential smoothing',capability:'Process capability','one-sample-t':'1-Sample t',correlation:'Correlation','xbar-chart':'Xbar chart','xbar-s-chart':'Xbar-S chart'};
function sample(){return{headers:['Diameter (mm)','Temperature (°C)','Line'],rows:Array.from({length:48},(_,i)=>{const t=20+Math.sin(i*1.7)*2.4+(i%5)*.6;return[(10+.045*(t-21)+Math.sin(i*2.1)*.082+Math.cos(i*.7)*.052).toFixed(3),t.toFixed(2),i%2?'B':'A'];})};}
let data=sample(),history=[],lastReport='',revision=0,unsaved=false,activeResult=null;const storeKey='statlab-session-v1';
let worksheets = [{ name: 'Worksheet 1', data, page: 1, scrollLeft: 0 }];
let activeSheetIndex = 0;
let columnStart = 0;
let enterDirection = (() => { try { return localStorage.getItem('jmptab-enter-direction') === 'right' ? 'right' : 'down'; } catch { return 'down'; } })();
let pageSize = (() => { try { const saved = Number(localStorage.getItem('jmptab-rows-per-page')); return validPageSize(saved) ? saved : DEFAULT_PAGE_SIZE; } catch { return DEFAULT_PAGE_SIZE; } })();
const activeSheet = () => worksheets[activeSheetIndex];
const selectedColumns = () => activeSheet().selectedColumns || new Set(activeSheet().selectedColumn == null ? [] : [activeSheet().selectedColumn]);
const isSelectedColumn = index => selectedColumns().has(index);
function invalidateReport(){lastReport='';$('results').innerHTML='<div class="empty">No result for this worksheet. Choose numeric columns and run an analysis.</div>';$('resultSubtitle').textContent='No analysis yet';$('scatterDragMode').closest('label').hidden=true;}
function message(text) {
  const outputError = $('error');
  const dialogError = $('analysisError');
  const target = $('analysisDialog').open ? dialogError : outputError;
  outputError.hidden = true;
  dialogError.hidden = true;
  target.textContent = text;
  target.hidden = !text;
}
function dirty(){if(activeSheet().doe?.model){delete activeSheet().doe.model;document.querySelector('[data-model-badge]')?.remove();}unsaved=true;revision++;$('saveState').textContent='Unsaved changes';$('resultSubtitle').textContent='Worksheet changed · run analysis to refresh';}
let page = 1;
const layout = createResizableLayout({
  workbench: document.querySelector('.workbench'),
  navigator: $('navigator'),
  navHandle: $('navResizer'),
  panes: document.querySelector('.panes'),
  paneHandle: $('paneResizer'),
  table: $('worksheet'),
  tableScroll: document.querySelector('.table-scroll'),
  getWorksheet: () => data,
  getPageSize: () => pageSize
});

function renderSheet() {
  if (data.formats) while (data.formats.length < data.headers.length) data.formats.push('auto');
  if (data.units) while (data.units.length < data.headers.length) data.units.push('');
  const mode = PAGE_VIEW_MODES.includes(activeSheet().viewMode) ? activeSheet().viewMode : 'edges';
  const pageCount = Math.max(1, Math.ceil((mode === 'selected' ? activeSheet().selectedRows?.size || 0 : data.rows.length) / pageSize));
  page = Math.min(page, pageCount);
  if (mode === 'first' || mode === 'edges') page = 1;
  activeSheet().page = page;
  const visible = columnWindow(data.headers.length, columnStart);
  columnStart = visible.first;
  const widths = layout.widthsFor(data.headers.length);
  const colgroup = '<colgroup><col><col>' + widths.slice(visible.first, visible.last).map(() => '<col>').join('') + '</colgroup>';
  const headers = data.headers.slice(visible.first, visible.last).map((_, offset) => { const index = visible.first + offset; const formula = activeSheet().formulas?.find(item => item.target === data.headers[index]); const format = data.formats?.[index] || 'auto'; const type = ['date', 'time', 'timestamp'].includes(format) ? 'D' : format === 'string' ? 'T' : format === 'auto' ? inferColumnType(data.rows,index) : ''; const role = data.roles?.[index] || ''; const typeLabel = columnTypeLabel(format, type); const model = activeSheet().doe?.model?.response === data.headers[index]; return `<th scope="col" data-column-index="${index}" data-selected-column="${isSelectedColumn(index)}" aria-sort="${activeSheet().sort?.column === index ? activeSheet().sort.direction : 'none'}"><button type="button" class="sort-column" data-sort-column="${index}" aria-label="Select column ${index + 1}, type ${typeLabel}${role ? `, role ${role}` : ''}; Shift-click for range, Ctrl-click to add" aria-pressed="${isSelectedColumn(index)}" title="${formula ? esc(formula.expression) : model ? 'Factorial model stored' : 'Click to select column; Shift-click for range; Ctrl-click to add; right-click for actions'}">C${index + 1}${role ? ` <span class="column-role-badge">${esc(role)}</span>` : ''} <span class="column-type-badge">${esc(typeLabel)}</span>${formula ? ' ƒx' : ''}${model ? ' <span data-model-badge>✓</span>' : ''}${activeSheet().sort?.column === index ? (activeSheet().sort.direction === 'ascending' ? ' ↑' : ' ↓') : ''}</button><button type="button" class="column-resize-handle" data-resize-column="${index}" role="separator" aria-orientation="vertical" aria-label="Resize column ${index + 1}" aria-valuemin="96" aria-valuemax="16384" title="Drag to resize column; double-click to fit text"></button></th>`
  }).join('');
  const names = data.headers.slice(visible.first, visible.last).map((name, offset) => { const column = visible.first + offset; return `<th data-column-index="${column}" data-selected-column="${isSelectedColumn(column)}"><div class="column-heading-fields"><input aria-label="Column ${column + 1} name" data-col="${column}" value="${esc(name)}"><input aria-label="Column ${column + 1} unit (optional)" data-unit="${column}" placeholder="Unit (optional)" maxlength="100" value="${esc(data.units?.[column] || '')}"></div></th>`
  }).join('');
  const rows = worksheetRowsForView(data.rows, page, mode, pageSize, activeSheet().selectedRows).map(({ row, index, omitted, first, last }) => {
    if (omitted) return `<tr class="omitted-rows"><td colspan="${visible.last - visible.first + 2}" role="status">⋯ ${groupedNumber(omitted)} rows hidden (${groupedNumber(first)}–${groupedNumber(last)}). Use Show pages or Go to open them. ⋯</td></tr>`;
    const cells = Array.from({ length: visible.last - visible.first }, (_, offset) => { const column = visible.first + offset; const value = row[column] ?? ''; const format = data.formats?.[column] || 'auto'; const calculated = activeSheet().formulas?.some(item => item.target === data.headers[column]); const red = customNumberIsRed(Number(value), format); return `<td data-column-index="${column}" data-selected-column="${isSelectedColumn(column)}"><input class="${format === 'string' || ['date', 'time', 'timestamp'].includes(format) || numeric(value) === null ? 'text-value' : 'numeric-value'}${red ? ' negative-red' : ''}" aria-label="Row ${index + 1}, ${esc(data.headers[column])}" data-row="${index}" data-col="${column}" value="${esc(formatCellValue(value, format))}"${calculated ? ' readonly title="Calculated column"' : ''}></td>`
    }).join('');
    const selected = activeSheet().selectedRows?.has(index) || false;
    const pageNumber = pageNumberForRow(index, pageSize);
    return `<tr data-selected="${selected}"><td class="page-number-cell" aria-label="Page ${pageNumber}">${pageNumber}</td><td class="row-heading"><button type="button" data-select-row="${index}" aria-label="Select row ${index + 1}${selected ? ', selected' : ''}" aria-pressed="${selected}">${selected ? '<span class="selected-row-star" aria-hidden="true">★</span>' : ''}${groupedNumber(index + 1)}</button></td>${cells}</tr>`;
  }).join('');
  $('worksheet').innerHTML = `${colgroup}<thead><tr><th scope="col" class="page-number-heading" title="Page number based on rows per page">Page</th><th scope="col" class="row-number-heading"><label for="enterDirection">#</label><select id="enterDirection" aria-label="Enter direction" title="Enter moves down or right"><option value="down">↓</option><option value="right">→</option></select></th>${headers}</tr><tr><th></th><th></th>${names}</tr></thead><tbody>${rows}</tbody>`;
  if (visible.windowed) $('tableScroll').scrollLeft = 0;
  $('enterDirection').value = enterDirection;
  layout.applyColumnWidths(visible.first, visible.last);
  $('sheetCount').textContent = `${groupedNumber(data.rows.length)} rows · ${groupedNumber(data.headers.length)} columns`;
  updateSheetSelectionControls();
  $('sheetViewMode').value = mode;
  $('sheetPage').value = page;
  $('sheetPage').max = pageCount;
  $('sheetPage').disabled = mode === 'first' || mode === 'edges' || pageCount <= 1;
  $('sheetPage').title = pageCount <= 1 ? 'This worksheet has only one page' : 'Use ↑/↓, the number spinner, or Enter to open a page';
  const sampledRows = Math.ceil(Math.min(pageSize, Math.max(0, data.rows.length - (page - 1) * pageSize)) * 0.3);
  $('pageCount').textContent = 'of ' + groupedNumber(pageCount) + (mode === 'sample' ? ` · ${sampledRows} rows sampled` : '');
  $('pageSizeShortcut').hidden = pageCount > 1 || data.rows.length < 2;
  $('previousPage').disabled = mode === 'first' || mode === 'edges' || page <= 1;
  $('nextPage').disabled = mode === 'first' || mode === 'edges' || page >= pageCount;
  renderColumns();
  renderSheetTabs();
  updateHorizontalScroll();
}

function updateSheetSelectionControls() {
  const columns = selectedColumns().size;
  const rows = activeSheet().selectedRows?.size || 0;
  $('sheetSelectionStatus').textContent = columns ? `${groupedNumber(columns)} column${columns === 1 ? '' : 's'} marked` : activeSheet().viewMode === 'selected' ? `${groupedNumber(rows)} selected ★` : '';
  $('copySelectedColumns').hidden = columns === 0;
  $('deselectAll').hidden = !(columns || rows || (activeResult?.sheetName === activeSheet().name && $('results').querySelector('svg.chart[data-selected-bounds]')));
}

function renderSheetTabs() {
  const visible = visibleWorksheetIndices(worksheets);
  $('worksheetTabs').innerHTML = visible.map(index =>
    `<button type="button" data-sheet-index="${index}" aria-current="${index === activeSheetIndex}" aria-label="Open ${esc(worksheets[index].name)}" title="Double-click or press F2 to rename; right-click for options">${esc(worksheets[index].name)}</button>`
  ).join('');
  const hidden = worksheets.flatMap((sheet, index) => sheet.hidden ? [index] : []);
  $('hiddenSheetMenu').hidden = hidden.length === 0;
  $('hiddenSheetMenu').querySelector('summary').textContent = `Hidden (${hidden.length})`;
  $('hiddenSheetList').innerHTML = hidden.map(index => `<button type="button" data-show-sheet="${index}">Show ${esc(worksheets[index].name)}</button>`).join('');
  const position = visible.indexOf(activeSheetIndex);
  $('firstSheet').disabled = $('previousSheet').disabled = position <= 0;
  $('lastSheet').disabled = $('nextSheet').disabled = position >= visible.length - 1;
  $('graphBuilderSheetName').textContent = activeSheet().name;
  const strip = $('worksheetTabs');
  const selected = strip.querySelector('[aria-current="true"]');
  const stripRect = strip.getBoundingClientRect();
  const selectedRect = selected.getBoundingClientRect();
  if (selectedRect?.left < stripRect.left) strip.scrollLeft += selectedRect.left - stripRect.left;
  else if (selectedRect?.right > stripRect.right) strip.scrollLeft += selectedRect.right - stripRect.right;
}

function updateHorizontalScroll() {
  const viewport = $('tableScroll');
  const slider = $('sheetHorizontalScroll');
  if (data.headers.length > VISIBLE_COLUMNS) {
    slider.max = data.headers.length - VISIBLE_COLUMNS;
    slider.value = columnStart;
    slider.disabled = false;
    $('scrollSheetLeft').disabled = columnStart === 0;
    $('scrollSheetRight').disabled = columnStart >= Number(slider.max);
    return;
  }
  const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  slider.max = maximum;
  slider.value = Math.min(maximum, viewport.scrollLeft);
  slider.disabled = maximum === 0;
  $('scrollSheetLeft').disabled = viewport.scrollLeft <= 0;
  $('scrollSheetRight').disabled = viewport.scrollLeft >= maximum;
}

function showPage(number) {
  const mode = activeSheet().viewMode || 'edges';
  if (mode === 'first' || mode === 'edges') return;
  const count = mode === 'selected' ? activeSheet().selectedRows?.size || 0 : data.rows.length;
  const candidate = Math.min(Math.max(1, Math.trunc(number) || page), Math.max(1, Math.ceil(count / pageSize)));
  page = candidate;
  activeSheet().page = page;
  renderSheet();
  document.querySelector('.table-scroll').scrollTop = 0;
}
$('sheetViewMode').onchange = () => {
  activeSheet().viewMode = $('sheetViewMode').value;
  page = 1;
  activeSheet().page = 1;
  renderSheet();
  $('tableScroll').scrollTop = 0;
};

$('previousPage').onclick = () => showPage(page - 1);
$('nextPage').onclick = () => showPage(page + 1);
$('sheetPage').onkeydown = event => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();
    showPage(page + (event.key === 'ArrowUp' ? 1 : -1));
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  event.stopPropagation();
  showPage(Number(event.currentTarget.value));
};
$('sheetPage').onchange = event => showPage(Number(event.currentTarget.value));
$('pageSizeSettingsBtn').onclick = () => {
  $('rowsPerPage').value = pageSize;
  $('pageSizeDialog').showModal();
};
$('pageSizeShortcut').onclick = () => $('pageSizeSettingsBtn').click();
$('cancelPageSize').onclick = () => $('pageSizeDialog').close();
$('pageSizeForm').onsubmit = event => {
  event.preventDefault();
  const next = Number($('rowsPerPage').value);
  if (!validPageSize(next)) { $('rowsPerPage').setCustomValidity('Enter a whole number from 1 to 1,000.'); $('rowsPerPage').reportValidity(); return; }
  $('rowsPerPage').setCustomValidity('');
  $('pageSizeDialog').close();
  if (next === pageSize) return;
  pageSize = next;
  try { localStorage.setItem('jmptab-rows-per-page', String(pageSize)); } catch { /* Keep the setting for this session. */ }
  for (const sheet of worksheets) sheet.page = 1;
  page = 1;
  renderSheet();
  $('tableScroll').scrollTop = 0;
};
$('rowsPerPage').oninput = () => $('rowsPerPage').setCustomValidity('');

function switchSheet(index) {
  if (!Number.isInteger(index) || index < 0 || index >= worksheets.length || worksheets[index].hidden || index === activeSheetIndex) return;
  activeSheet().page = page;
  activeSheet().scrollLeft = $('tableScroll').scrollLeft;
  activeSheet().columnStart = columnStart;
  activeSheetIndex = index;
  data = activeSheet().data;
  page = activeSheet().page || 1;
  columnStart = activeSheet().columnStart || 0;
  renderSheet();
  $('tableScroll').scrollLeft = data.headers.length > VISIBLE_COLUMNS ? 0 : activeSheet().scrollLeft || 0;
  updateHorizontalScroll();
  const priorResult = history.find(result => result.sheetName === activeSheet().name);
  if (priorResult) showResult(priorResult);
  else invalidateReport();
  unsaved = true;
  $('saveState').textContent = 'Unsaved changes';
}

$('worksheetTabs').onclick = event => {
  const tab = event.target.closest('[data-sheet-index]');
  if (tab) switchSheet(Number(tab.dataset.sheetIndex));
};
$('worksheetTabs').oncontextmenu = event => {
  const tab = event.target.closest('[data-sheet-index]');
  if (!tab) return;
  event.preventDefault();
  openSheetMenu('sheet-tab', Number(tab.dataset.sheetIndex), event.clientX, event.clientY);
};
$('hiddenSheetList').onclick = event => {
  const button = event.target.closest('[data-show-sheet]');
  if (!button) return;
  const index = Number(button.dataset.showSheet);
  showWorksheet(worksheets, index);
  $('hiddenSheetMenu').open = false;
  revision++;
  switchSheet(index);
};
function editSheetName(tab) {
  const index = Number(tab.dataset.sheetIndex);
  const input = document.createElement('input');
  input.className = 'sheet-name-editor';
  input.setAttribute('aria-label', 'Worksheet name');
  input.maxLength = 50;
  input.value = worksheets[index].name;
  tab.replaceWith(input);
  input.focus();
  input.select();
  let finished = false;
  function finish(save) {
    if (finished) return;
    finished = true;
    if (save) {
      try {
        const previous = renameWorksheet(worksheets, index, input.value);
        if (previous !== worksheets[index].name) {
          for (const result of history) if (result.sheetName === previous) result.sheetName = worksheets[index].name;
          revision++;
          unsaved = true;
          $('saveState').textContent = 'Unsaved changes';
          renderHistory();
        }
        message('');
      } catch (error) { message(error.message); }
    }
    renderSheetTabs();
  }
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}
$('worksheetTabs').ondblclick = event => {
  const tab = event.target.closest('[data-sheet-index]');
  if (tab) editSheetName(tab);
};
$('worksheetTabs').onkeydown = event => {
  if (event.key === 'F2' && event.target.matches('[data-sheet-index]')) {
    event.preventDefault();
    editSheetName(event.target);
  }
};
$('firstSheet').onclick = () => switchSheet(visibleWorksheetIndices(worksheets)[0]);
$('previousSheet').onclick = () => { const visible = visibleWorksheetIndices(worksheets); switchSheet(visible[visible.indexOf(activeSheetIndex) - 1]); };
$('nextSheet').onclick = () => { const visible = visibleWorksheetIndices(worksheets); switchSheet(visible[visible.indexOf(activeSheetIndex) + 1]); };
$('lastSheet').onclick = () => switchSheet(visibleWorksheetIndices(worksheets).at(-1));
$('addSheet').onclick = () => {
  if (worksheets.length >= 100) return message('Maximum 100 worksheets per project.');
  worksheets.push(blankWorksheet(nextWorksheetName(worksheets)));
  switchSheet(worksheets.length - 1);
};

$('sheetHorizontalScroll').oninput = event => {
  if (data.headers.length > VISIBLE_COLUMNS) { columnStart = Number(event.target.value); renderSheet(); return; }
  $('tableScroll').scrollLeft = Number(event.target.value);
};
$('scrollSheetLeft').onclick = () => {
  if (data.headers.length > VISIBLE_COLUMNS) { columnStart = Math.max(0, columnStart - 10); renderSheet(); return; }
  $('tableScroll').scrollLeft -= Math.max(100, $('tableScroll').clientWidth * .75);
};
$('scrollSheetRight').onclick = () => {
  if (data.headers.length > VISIBLE_COLUMNS) { columnStart = Math.min(data.headers.length - VISIBLE_COLUMNS, columnStart + 10); renderSheet(); return; }
  $('tableScroll').scrollLeft += Math.max(100, $('tableScroll').clientWidth * .75);
};
$('tableScroll').addEventListener('scroll', updateHorizontalScroll);
new ResizeObserver(updateHorizontalScroll).observe($('worksheet'));
new ResizeObserver(updateHorizontalScroll).observe($('tableScroll'));
let renderedColumnNames = '';
function renderColumns(){const names = data.headers.join('\u0000');if(names===renderedColumnNames)return;renderedColumnNames=names;for(const id of ['response','predictor','xbarGroup','xbarStage','capGroup']){const prev=$(id).value;$(id).innerHTML=(id.startsWith('xbar')||id==='capGroup'?`<option value="">${id==='xbarGroup'?'Use subgroup size':id==='xbarStage'?'No stages':'Use individual observations'}</option>`:'')+data.headers.map((h,i)=>`<option value="${i}">${esc(h)}</option>`).join('');if(prev!==''&&Number(prev)<data.headers.length)$(id).value=prev;}if($('predictor').value===$('response').value&&data.headers.length>1)$('predictor').value=String((+$('response').value+1)%data.headers.length);}
$('worksheet').addEventListener('input',e=>{const el=e.target;if(!el.matches('input'))return;if(el.dataset.unit!==undefined){data.units ||= Array(data.headers.length).fill('');data.units[Number(el.dataset.unit)]=el.value;dirty();return;}const c=+el.dataset.col;if(el.dataset.row!==undefined){data.rows[+el.dataset.row][c]=el.value;el.classList.toggle('numeric-value',numeric(el.value)!==null);el.classList.toggle('text-value',numeric(el.value)===null);}else data.headers[c]=el.value;dirty();});
$('worksheet').addEventListener('focusin', e => {
  if (e.target.matches('thead input[data-col]')) e.target.dataset.previousName = data.headers[Number(e.target.dataset.col)];
  if (e.target.matches('tbody input[data-row]')) e.target.value = data.rows[Number(e.target.dataset.row)]?.[Number(e.target.dataset.col)] ?? '';
});
$('worksheet').addEventListener('focusout', e => {
  if (!e.target.matches('tbody input[data-row]')) return;
  const input = e.target;
  const row = Number(input.dataset.row), column = Number(input.dataset.col);
  input.value = formatCellValue(data.rows[row]?.[column], data.formats?.[column]);
});
$('worksheet').addEventListener('change', e => {
  if (e.target.matches('thead input[data-col]')) { renameFormulaReference(activeSheet(),e.target.dataset.previousName,e.target.value); renderColumns(); renderSheet(); }
  if (e.target.matches('thead input[data-unit]')) renderSheet();
  if (e.target.matches('tbody input[data-row]') && activeSheet().formulas?.length) {
    try { recalculateFormulas(activeSheet(), [Number(e.target.dataset.row)]); renderSheet(); }
    catch (error) { message(error.message); }
  }
});
const sheetMenu = document.createElement('div');
sheetMenu.className = 'sheet-context-menu';
sheetMenu.setAttribute('role', 'menu');
sheetMenu.hidden = true;
document.body.append(sheetMenu);
sheetMenu.addEventListener('click', event => {
  if (!event.target.matches('summary')) return;
  requestAnimationFrame(() => {
    if (!sheetMenu.hidden) sheetMenu.style.top = `${Math.max(8, Math.min(parseFloat(sheetMenu.style.top), innerHeight - sheetMenu.offsetHeight - 8))}px`;
  });
});
function closeSheetMenu() { sheetMenu.hidden = true; sheetMenu.replaceChildren(); }
function markWorkbookChanged() {
  revision++;
  unsaved = true;
  $('saveState').textContent = 'Unsaved changes';
}
let pendingDeleteSheet = null;
$('cancelDeleteSheet').onclick = () => $('deleteSheetDialog').close();
$('confirmDeleteSheet').onclick = () => {
  const index = pendingDeleteSheet;
  $('deleteSheetDialog').close();
  if (!Number.isInteger(index) || !worksheets[index] || worksheets.length <= 1) return;
  const name = worksheets[index].name;
  if (index === activeSheetIndex) {
    if (visibleWorksheetIndices(worksheets).length === 1) {
      const other = worksheets.findIndex((sheet, position) => position !== index);
      showWorksheet(worksheets, other);
    }
    switchSheet(visibleWorksheetIndices(worksheets).find(position => position !== index));
  }
  deleteWorksheet(worksheets, index);
  if (index < activeSheetIndex) activeSheetIndex--;
  history = history.filter(result => result.sheetName !== name);
  markWorkbookChanged();
  renderSheetTabs();
  renderHistory();
};
function applyColumnFormat(index, format) {
  data.formats ||= Array(data.headers.length).fill('auto');
  const columns = isSelectedColumn(index) ? selectedColumns() : new Set([index]);
  for (const column of columns) data.formats[column] = format;
  unsaved = true;
  $('saveState').textContent = 'Unsaved changes';
  renderSheet();
}
const formatDialog = document.createElement('dialog');
formatDialog.setAttribute('aria-label', 'Custom number format');
formatDialog.innerHTML = `<div class="dialog-heading"><h2>Custom number format</h2></div><div class="analysis-bar"><label class="field">Format code<input data-format-code maxlength="80" value="#,##0.00" spellcheck="false"></label><p class="muted">Up to four sections: positive;negative;zero;text. Use 0, #, ?, %, grouping commas, E+00, currency symbols, quoted text and [Red].</p><p class="muted">Examples: #,##0.00 · 0.0% · € #,##0.00 · #,##0.00;[Red](#,##0.00);0.00;"Text: "@</p><div data-format-preview class="format-preview"></div><p data-format-error class="field-error" role="alert" hidden></p></div><footer class="dialog-actions"><button type="button" data-format-cancel>Cancel</button><button type="button" data-format-apply class="primary">Apply</button></footer>`;
document.body.append(formatDialog);
let customFormatColumn = 0;
function updateFormatPreview() {
  const code = formatDialog.querySelector('[data-format-code]').value;
  const preview = formatDialog.querySelector('[data-format-preview]');
  const error = formatDialog.querySelector('[data-format-error]');
  try {
    validateCustomNumberPattern(code);
    preview.textContent = [1234.567, -1234.567, 0, 'Text'].map(value => formatCellValue(value, `custom:${code}`)).join('     |     ');
    error.hidden = true;
  } catch (cause) { preview.textContent = ''; error.textContent = cause.message; error.hidden = false; }
}
formatDialog.querySelector('[data-format-code]').addEventListener('input', updateFormatPreview);
formatDialog.querySelector('[data-format-cancel]').onclick = () => formatDialog.close();
formatDialog.querySelector('[data-format-apply]').onclick = () => {
  const code = formatDialog.querySelector('[data-format-code]').value;
  try { validateCustomNumberPattern(code); }
  catch { updateFormatPreview(); return; }
  formatDialog.close();
  applyColumnFormat(customFormatColumn, `custom:${code}`);
};
function sortColumn(column, direction) {
  data.rows = sortWorksheetRows(data.rows, column, direction);
  activeSheet().sort = { column, direction };
  activeSheet().selectedRows = new Set();
  activeSheet().selectionAnchor = null;
  page = 1;
  dirty();
  renderSheet();
}
async function copyColumns(columns) {
  try {
    await navigator.clipboard.writeText(columnsClipboardText(data, columns));
    message(`Copied ${columns.size} column${columns.size === 1 ? '' : 's'}.`);
  } catch { message('Clipboard access was denied. Allow clipboard access and try again.'); }
}
function changeColumn(index, action) {
  try {
    if (action === 'insert-left') insertColumn(data, index);
    else if (action === 'insert-right') insertColumn(data, index + 1);
    else if (action === 'delete') { const removed = data.headers[index]; deleteColumn(data, index); removeFormulaDependencies(activeSheet(), removed); }
    else if (action === 'move-left' && !moveColumn(data, index, index - 1)) return;
    else if (action === 'move-right' && !moveColumn(data, index, index + 1)) return;
    activeSheet().sort = null;
    activeSheet().selectedColumn = null;
    activeSheet().selectedColumns = new Set();
    dirty();
    renderSheet();
  } catch (error) { message(error.message); }
}
function menuButton(label, action, role = 'menuitem') {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('role', role);
  button.textContent = label;
  button.onclick = action;
  return button;
}
function openSheetMenu(kind, index, x, y) {
  const buttons = [];
  if (kind === 'sheet-tab') {
    buttons.push(menuButton('Rename worksheet', () => {
      closeSheetMenu();
      editSheetName($('worksheetTabs').querySelector(`[data-sheet-index="${index}"]`));
    }));
    for (const [direction, label] of [[-1, 'Move worksheet left'], [1, 'Move worksheet right']]) {
      const button = menuButton(label, () => {
        closeSheetMenu();
        const current = activeSheet();
        if (!moveWorksheet(worksheets, index, index + direction)) return;
        activeSheetIndex = worksheets.indexOf(current);
        markWorkbookChanged();
        renderSheetTabs();
      });
      button.disabled = index + direction < 0 || index + direction >= worksheets.length;
      buttons.push(button);
    }
    const hide = menuButton('Hide worksheet', () => {
      closeSheetMenu();
      try {
        hideWorksheet(worksheets, index);
        markWorkbookChanged();
        if (index === activeSheetIndex) switchSheet(visibleWorksheetIndices(worksheets)[0]);
        else renderSheetTabs();
      } catch (error) { message(error.message); }
    });
    hide.disabled = visibleWorksheetIndices(worksheets).length <= 1;
    buttons.push(hide);
    const remove = menuButton('Delete worksheet…', () => {
      closeSheetMenu();
      pendingDeleteSheet = index;
      $('deleteSheetName').textContent = worksheets[index].name;
      $('deleteSheetDialog').showModal();
    });
    remove.disabled = worksheets.length <= 1;
    buttons.push(remove);
  } else if (kind === 'column-context') {
    buttons.push(menuButton(isSelectedColumn(index) && selectedColumns().size > 1 ? 'Copy selected columns' : 'Copy column', () => {
      closeSheetMenu();
      copyColumns(isSelectedColumn(index) ? selectedColumns() : new Set([index]));
    }));
    for (const [action, label] of [['sort-ascending', 'Sort ascending'], ['sort-descending', 'Sort descending']]) {
      buttons.push(menuButton(label, () => { closeSheetMenu(); sortColumn(index, action === 'sort-ascending' ? 'ascending' : 'descending'); }));
    }
    for (const [action, label] of [['insert-left', 'Insert column left'], ['insert-right', 'Insert column right'],
      ['move-left', 'Move column left'], ['move-right', 'Move column right'], ['delete', 'Delete column']]) {
      buttons.push(menuButton(label, () => { closeSheetMenu(); changeColumn(index, action); }));
    }
    const formatMenu = document.createElement('details');
    formatMenu.className = 'menu-section-start';
    const formatSummary = document.createElement('summary');
    formatSummary.textContent = `Type: ${formatLabel(data.formats?.[index] || 'auto')}`;
    formatMenu.append(formatSummary);
    const numberMenu = document.createElement('details');
    const numberSummary = document.createElement('summary');
    numberSummary.textContent = 'Number';
    numberMenu.append(numberSummary);
    const dateMenu = document.createElement('details');
    const dateSummary = document.createElement('summary');
    dateSummary.textContent = 'Date and time';
    dateMenu.append(dateSummary);
    const currencyMenu = document.createElement('details');
    const currencySummary = document.createElement('summary');
    currencySummary.textContent = 'Currency';
    currencyMenu.append(currencySummary);
    for (const [format, label] of Object.entries(COLUMN_FORMATS)) {
      const selected = (data.formats?.[index] || 'auto') === format;
      const button = menuButton(`${selected ? '✓ ' : ''}${label}`, () => {
        closeSheetMenu();
        applyColumnFormat(index, format);
      }, 'menuitemradio');
      button.setAttribute('aria-checked', String(selected));
      (['integer', 'float', 'scientific'].includes(format) ? numberMenu : ['date', 'time', 'timestamp'].includes(format) ? dateMenu : formatMenu).append(button);
    }
    numberMenu.append(menuButton('Custom number format…', () => {
      closeSheetMenu();
      customFormatColumn = index;
      const current = data.formats?.[index] || 'auto';
      formatDialog.querySelector('[data-format-code]').value = current.startsWith('custom:') ? current.slice(7) : '#,##0.00';
      updateFormatPreview();
      formatDialog.showModal();
    }));
    formatMenu.append(numberMenu);
    for (const [format, option] of Object.entries(CURRENCY_FORMATS)) {
      const selected = data.formats?.[index] === format;
      const button = menuButton(`${selected ? '✓ ' : ''}${option.label}`, () => {
        closeSheetMenu();
        applyColumnFormat(index, format);
      }, 'menuitemradio');
      button.setAttribute('aria-checked', String(selected));
      currencyMenu.append(button);
    }
    formatMenu.append(currencyMenu);
    formatMenu.append(dateMenu);
    buttons.push(formatMenu);
    const roleMenu = document.createElement('details');
    roleMenu.className = 'menu-section-start';
    const roleSummary = document.createElement('summary');
    roleSummary.textContent = `Role: ${data.roles?.[index] || 'none'}`;
    roleMenu.append(roleSummary);
    const roleChoice = (role, label) => {
      const selected = (data.roles?.[index] || '') === role;
      const button = menuButton(`${selected ? '✓ ' : ''}${label}`, () => {
        closeSheetMenu();
        data.roles ||= Array(data.headers.length).fill('');
        data.roles[index] = role;
        dirty();
        renderSheet();
      }, 'menuitemradio');
      button.setAttribute('aria-checked', String(selected));
      return button;
    };
    roleMenu.append(roleChoice('', 'None'));
    for (const [group, roles] of Object.entries(COLUMN_ROLE_GROUPS)) {
      const groupMenu = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = group === 'G' ? 'G (group)' : group;
      groupMenu.append(summary, ...roles.map(role => roleChoice(role, role === 'G' ? 'G (group)' : role)));
      roleMenu.append(groupMenu);
    }
    buttons.push(roleMenu);
  } else {
    for (const [action, label] of [['above', 'Insert row above'], ['below', 'Insert row below'],
      ['delete', activeSheet().selectedRows?.size > 1 ? 'Delete selected rows' : 'Delete row']]) {
      buttons.push(menuButton(label, () => {
        closeSheetMenu();
        try {
          if (action === 'delete') deleteRows(data, activeSheet().selectedRows || [index]);
          else { const position = index + (action === 'below' ? 1 : 0); insertRow(data, position); if(activeSheet().formulas?.length)recalculateFormulas(activeSheet(),[position]); }
          activeSheet().selectedRows = new Set();
          activeSheet().selectionAnchor = null;
          activeSheet().sort = null;
          dirty();
          renderSheet();
        } catch (error) { message(error.message); }
      }));
    }
  }
  sheetMenu.replaceChildren(...buttons);
  sheetMenu.hidden = false;
  sheetMenu.style.left = `${Math.max(0, Math.min(x, innerWidth - sheetMenu.offsetWidth - 8))}px`;
  sheetMenu.style.top = `${Math.max(0, Math.min(y, innerHeight - sheetMenu.offsetHeight - 8))}px`;
  sheetMenu.querySelector('button')?.focus();
}
$('worksheet').addEventListener('contextmenu', event => {
  const header = event.target.closest('thead tr:first-child th[data-column-index]');
  if (header) {
    event.preventDefault();
    openSheetMenu('column-context', Number(header.dataset.columnIndex), event.clientX, event.clientY);
    return;
  }
  const rowButton = event.target.closest('[data-select-row]');
  if (!rowButton) return;
  event.preventDefault();
  const index = Number(rowButton.dataset.selectRow);
  if (!activeSheet().selectedRows?.has(index)) {
    activeSheet().selectedRows = new Set([index]);
    activeSheet().selectionAnchor = index;
    activeSheet().selectedColumn = null;
    activeSheet().selectedColumns = new Set();
    renderSheet();
  }
  openSheetMenu('row', index, event.clientX, event.clientY);
});
document.addEventListener('pointerdown', event => { if (!sheetMenu.hidden && !sheetMenu.contains(event.target)) closeSheetMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !sheetMenu.hidden) { closeSheetMenu(); event.preventDefault(); } });
$('worksheet').addEventListener('click', event => {
  const button = event.target.closest('[data-select-row]');
  if (!button) return;
  const sheet = activeSheet();
  const result = selectRows(sheet.selectedRows || new Set(), Number(button.dataset.selectRow),
    sheet.selectionAnchor ?? null, { shift: event.shiftKey, toggle: event.ctrlKey || event.metaKey });
  sheet.selectedRows = result.selected;
  sheet.selectionAnchor = result.anchor;
  sheet.selectedColumn = null;
  sheet.selectedColumns = new Set();
  renderSheet();
});
$('worksheet').addEventListener('change', event => {
  if (event.target.id !== 'enterDirection') return;
  enterDirection = event.target.value;
  try { localStorage.setItem('jmptab-enter-direction', enterDirection); } catch { /* Keep the current selection. */ }
});
$('worksheet').addEventListener('click', event => {
  const button = event.target.closest('[data-sort-column]');
  if (!button) return;
  const column = Number(button.dataset.sortColumn);
  const sheet = activeSheet();
  const result = selectRows(selectedColumns(), column, sheet.columnSelectionAnchor ?? null,
    { shift: event.shiftKey, toggle: event.ctrlKey || event.metaKey });
  sheet.selectedColumns = result.selected;
  sheet.selectedColumn = null;
  sheet.columnSelectionAnchor = result.anchor;
  sheet.selectedRows = new Set();
  sheet.selectionAnchor = null;
  $('worksheet').querySelectorAll('[data-selected-column]').forEach(cell => {
    cell.dataset.selectedColumn = String(result.selected.has(Number(cell.dataset.columnIndex)));
  });
  $('worksheet').querySelectorAll('[data-sort-column]').forEach(header => {
    header.setAttribute('aria-pressed', String(result.selected.has(Number(header.dataset.sortColumn))));
  });
  $('worksheet').querySelectorAll('tbody tr[data-selected="true"]').forEach(row => { row.dataset.selected = 'false'; row.querySelector('[data-select-row]').setAttribute('aria-pressed', 'false'); });
  updateSheetSelectionControls();
});
$('markColumns').onclick = () => {
  const sheet = activeSheet();
  sheet.selectedColumns = new Set(data.headers.map((_, index) => index));
  sheet.selectedColumn = null;
  sheet.columnSelectionAnchor = 0;
  sheet.selectedRows = new Set();
  sheet.selectionAnchor = null;
  renderSheet();
};
$('copySelectedColumns').onclick = () => copyColumns(selectedColumns());
$('worksheet').addEventListener('copy', event => {
  if (!event.target.closest('[data-sort-column]') || !selectedColumns().size) return;
  event.clipboardData.setData('text/plain', columnsClipboardText(data, selectedColumns()));
  event.preventDefault();
  message(`Copied ${selectedColumns().size} column${selectedColumns().size === 1 ? '' : 's'}.`);
});
$('worksheet').addEventListener('paste', event => {
  const header = event.target.closest('[data-sort-column]');
  if (!header) return;
  event.preventDefault();
  try {
    const start = Number(header.dataset.sortColumn);
    const text = event.clipboardData.getData('text/plain');
    if (!text) return;
    const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
    const width = Math.max(...lines.map(line => line.split('\t').length));
    if (start + width > MAX_COLUMNS || lines.length - 1 > MAX_ROWS) throw Error('Paste up to 16,384 columns and 1,048,576 rows.');
    const oldHeaders = data.headers.slice(start, start + width);
    for (const name of oldHeaders) removeFormulaDependencies(activeSheet(), name);
    const pasted = pasteColumns(data, start, text);
    if (activeSheet().formulas?.length) recalculateFormulas(activeSheet());
    activeSheet().sort = null;
    activeSheet().selectedColumns = new Set(Array.from({ length: pasted.columns }, (_, offset) => start + offset));
    activeSheet().columnSelectionAnchor = start;
    dirty();
    renderSheet();
    $('worksheet').querySelector(`[data-sort-column="${start}"]`)?.focus();
    message(`Pasted ${pasted.columns} column${pasted.columns === 1 ? '' : 's'}.`);
  } catch (error) { message(error.message); }
});
$('worksheet').addEventListener('keydown', event => {
  const cell = event.target;
  if (event.key !== 'Enter' || event.isComposing || !cell.matches('td input')) return;
  event.preventDefault();
  let row = Number(cell.dataset.row);
  let column = Number(cell.dataset.col);
  if (enterDirection === 'right') {
    if (++column >= data.headers.length) { column = 0; row++; }
  } else row++;
  if (row >= MAX_ROWS) return;
  if (row >= data.rows.length) {
    data.rows.push(data.headers.length <= 30 ? Array(data.headers.length).fill('') : []);
    if(activeSheet().formulas?.length)recalculateFormulas(activeSheet(),[row]);
    dirty();
  }
  if (data.headers.length > VISIBLE_COLUMNS && (column < columnStart || column >= columnStart + VISIBLE_COLUMNS)) {
    columnStart = Math.min(column, data.headers.length - VISIBLE_COLUMNS);
    renderSheet();
  }
  if (Math.floor(row / PAGE_SIZE) + 1 !== page || row >= data.rows.length - 1) {
    page = Math.floor(row / PAGE_SIZE) + 1;
    renderSheet();
  }
  $('worksheet').querySelector(`td input[data-row="${row}"][data-col="${column}"]`)?.focus();
});
$('worksheet').addEventListener('paste',e=>{const el=e.target;if(!el.matches('td input')||el.readOnly)return;const text=e.clipboardData.getData('text');if(!/[\t\n]/.test(text))return;e.preventDefault();const incoming=text.replace(/\r/g,'').trimEnd().split('\n').map(r=>r.split('\t')),r=+el.dataset.row,c=+el.dataset.col;if(r+incoming.length>MAX_ROWS||c+incoming.reduce((width, row) => Math.max(width, row.length), 0)>MAX_COLUMNS){message('Paste up to 1,048,576 rows and 16,384 columns.');return;}while(data.headers.length<c+incoming.reduce((width, row) => Math.max(width, row.length), 0))data.headers.push(`Column ${data.headers.length+1}`);if(data.roles)while(data.roles.length<data.headers.length)data.roles.push('');while(data.rows.length<r+incoming.length)data.rows.push(data.headers.length <= 30 ? Array(data.headers.length).fill('') : []);incoming.forEach((row,i)=>row.forEach((v,j)=>{if(!activeSheet().formulas?.some(item=>item.target===data.headers[c+j]))data.rows[r+i][c+j]=v;}));if(activeSheet().formulas?.length)try{recalculateFormulas(activeSheet(),incoming.map((_,index)=>r+index));}catch(error){message(error.message);}dirty();renderSheet();});
function updateSettings(){const type=$('analysis').value;$('predictorField').hidden=type!=='regression'&&type!=='correlation';document.querySelectorAll('.spec').forEach(el=>el.hidden=type!=='capability');$('capGroupField').hidden=type!=='capability';$('pFields').hidden=type!=='p-chart';$('xbarFields').hidden=!['xbar-chart','xbar-s-chart'].includes(type);$('xbarGroupField').hidden=type!=='xbar-s-chart';$('xbarStageField').hidden=type!=='xbar-s-chart';$('maFields').hidden=type!=='moving-average';$('esFields').hidden=type!=='exponential-smoothing';$('tFields').hidden=type!=='one-sample-t';$('responseField').hidden=type==='one-sample-t'&&$('tSource').value==='summary';$('tSummaryFields').hidden=$('tSource').value!=='summary';$('tNullField').hidden=!$('tTest').checked;}
$('analysis').onchange=updateSettings;
$('tSource').onchange=updateSettings;
$('tTest').onchange=updateSettings;

function requiredNumber(id, label) {
  const raw = $(id).value.trim();
  if (raw === '' || !Number.isFinite(Number(raw))) throw Error('Enter a numeric ' + label + '.');
  return Number(raw);
}
function readAnalysisOptions(type) {
  switch (type) {
    case 'one-sample-t': {
      const source = $('tSource').value;
      return {
        source,
        confidence: requiredNumber('tConfidence', 'confidence level'),
        alternative: $('tAlternative').value,
        nullMean: $('tTest').checked ? requiredNumber('tNull', 'hypothesized mean') : null,
        ...(source === 'summary' ? {
          n: requiredNumber('tN', 'sample size'),
          mean: requiredNumber('tMean', 'sample mean'),
          sd: requiredNumber('tSd', 'sample standard deviation')
        } : {})
      };
    }
    case 'moving-average':
      return { span: requiredNumber('maSpan', 'moving-average span') };
    case 'exponential-smoothing':
      return {
        weight: requiredNumber('esWeight', 'smoothing weight'),
        initialPeriods: requiredNumber('esInitial', 'initial periods')
      };
    case 'xbar-chart':
      return {
        subgroupSize: requiredNumber('xbarSize', 'subgroup size'),
        targetMean: $('xbarTarget').value.trim() === '' ? null : requiredNumber('xbarTarget', 'target mean'),
        sigma: $('xbarSigma').value.trim() === '' ? null : requiredNumber('xbarSigma', 'known process standard deviation')
      };
    case 'xbar-s-chart':
      return { subgroupSize: requiredNumber('xbarSize', 'subgroup size'), subgroupColumn: $('xbarGroup').value === '' ? null : Number($('xbarGroup').value),
        stageColumn: $('xbarStage').value === '' ? null : Number($('xbarStage').value) };
    case 'p-chart':
      return {
        subgroupSize: requiredNumber('pSize', 'subgroup size'),
        targetProportion: $('pTarget').value.trim() === '' ? null : requiredNumber('pTarget', 'target proportion')
      };
    case 'capability':
      return { lsl: numeric($('lsl').value), usl: numeric($('usl').value), subgroupColumn: $('capGroup').value === '' ? null : Number($('capGroup').value) };
    default:
      return {};
  }
}

function run(record = true) {
  message('');
  const type = $('analysis').value;
  const responseIndex = Number($('response').value);
  const predictorIndex = Number($('predictor').value);

  try {
    const options = readAnalysisOptions(type);
    const column = data.headers[responseIndex];
    const resultColumn = type === 'one-sample-t' && options.source === 'summary' ? 'Summarized data' : column;
    const result = executeAnalysis({
      type, rows: data.rows, responseIndex, predictorIndex, options
    });
    const badge = ['control', 'capability', 'p-chart', 'xbar-chart', 'xbar-s-chart'].includes(type)
      ? 'Quality analysis' : 'Statistical analysis';
    const title = `<div class="result-title"><div><h3>${esc(resultColumn)}</h3><p>${esc(names[type])} · ${esc(activeSheet().name)}</p></div><span class="badge">${badge}</span></div>`;
    const { html, report } = renderAnalysisResult({
      type, s: result, column, predictorColumn: data.headers[predictorIndex], rowCount: data.rows.length,
      responseAxisLabel: axisLabel(data, responseIndex), predictorAxisLabel: axisLabel(data, predictorIndex)
    });
    const now = new Date();
    lastReport = `jmptab — ${names[type]}\nWorksheet: ${activeSheet().name}\nColumn: ${resultColumn}\nGenerated: ${now.toISOString()}\nWorksheet revision: ${revision}\n\n${report}`;
    $('results').innerHTML = title + wrapResultCharts(html, document);
    const metricsBox = $('results').querySelector('.metrics');
    const analysisLabel = $('results').querySelector('.result-title .badge');
    if (metricsBox && analysisLabel) {
      const collapsibleMetrics = document.createElement('details');
      collapsibleMetrics.className = 'metrics';
      collapsibleMetrics.open = true;
      collapsibleMetrics.title = 'Drag the lower-right corner to resize; click the heading to hide or show statistics';
      const heading = document.createElement('summary');
      heading.className = 'metrics-heading';
      heading.textContent = analysisLabel.textContent;
      collapsibleMetrics.append(heading, ...metricsBox.childNodes);
      metricsBox.replaceWith(collapsibleMetrics);
      analysisLabel.remove();
    }
    prepareMovableResults($('results'));
    setXLabelAngle($('results'), Number($('xLabelAngle').value));
    ensureChartLegends($('results'));
    preparePlotSettingsButtons($('results'));
    const resultHtml = $('results').innerHTML;
    $('resultSubtitle').textContent = `${names[type]} · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (record) {
      history.unshift({
        type, column: resultColumn, sheetName: activeSheet().name,
        time: now.toISOString(), html: resultHtml, report: lastReport, revision,
        observations: result.n,
        scatterSource: ['regression', 'correlation'].includes(type) ? { xColumn: predictorIndex, yColumn: responseIndex, groupColumn: null, xFormat: data.formats?.[predictorIndex] || 'float', groups: [] } : null,
        command: formatCommand({ type, responseIndex, predictorIndex, options })
      });
      history = history.slice(0, 20);
      activeResult = history[0];
      $('scatterDragMode').closest('label').hidden = !activeResult.scatterSource;
      setXLabelAngle($('results'), Number($('xLabelAngle').value));
      renderHistory();
    }
    $('outputScroll').scrollTop = 0;
    return true;
  } catch (error) {
    message(error.message);
    return false;
  }
}
function renderHistory() {
  $('historyCount').textContent = history.length;
  $('historyList').innerHTML = history.length
    ? history.map((result, index) => `
        <button class="history-entry" data-history="${index}" aria-current="${result === activeResult}">
          <strong>${esc(result.label || names[result.type])}</strong>
          <small>${esc(result.column)} · ${esc(result.sheetName || 'Worksheet 1')}</small>
        </button>`).join('')
    : '<p class="empty">Run an analysis to add a result.</p>';
}

$('addRow').onclick=()=>{if(data.rows.length>=MAX_ROWS)return message('Maximum 1,048,576 rows.');data.rows.push(data.headers.length <= 30 ? Array(data.headers.length).fill('') : []);if(activeSheet().formulas?.length)try{recalculateFormulas(activeSheet(),[data.rows.length-1]);}catch(error){message(error.message);}dirty();showPage(Math.ceil(data.rows.length / pageSize));const scroll=document.querySelector('.table-scroll');scroll.scrollTop=scroll.scrollHeight;};$('addCol').onclick=()=>{if(data.headers.length>=MAX_COLUMNS)return message('Maximum 16,384 columns.');data.headers.push(`Column ${data.headers.length+1}`);data.roles?.push('');dirty();renderSheet();};
function download(name,content,type){const url=URL.createObjectURL(new Blob(typeof content === "string" ? [content] : content,{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('exportBtn').onclick=()=>download('worksheet.csv',csvChunks(data),'text/csv;charset=utf-8');$('reportBtn').onclick=()=>lastReport?download('jmptab-report.txt',lastReport,'text/plain;charset=utf-8'):message('Run an analysis before exporting a report.');
const openCsvImportDialog = setupCsvImportDialog({ onImport: (next, fileName, destination) => {
  if (destination === 'new') {
    const appended = appendSampleWorksheet(worksheets, next);
    worksheets = appended.worksheets;
    switchSheet(appended.activeSheetIndex);
  } else if (destination === 'replace') {
    if (unsaved && !confirm('Replace the current worksheet? Save or export it first to keep your work.')) return false;
    activeSheet().data = next;
    data = next;
    activeSheet().page = 1;
    activeSheet().scrollLeft = 0;
    page = 1;
    history = history.filter(result => result.sheetName !== activeSheet().name);
    activeResult = null;
    invalidateReport();
    renderSheet();
    renderHistory();
  } else throw Error('Choose where to import the data.');
  revision++;
  unsaved = true;
  $('saveState').textContent = 'Unsaved changes';
  $('projectName').textContent = fileName.replace(/\.(csv|txt)$/i, '');
  message('');
  return true;
} });
$('importBtn').onclick = () => $('file').click();
$('file').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const format = file.name.toLowerCase().endsWith('.xml') ? 'XML' : file.name.toLowerCase().endsWith('.xlsx') ? 'XLSX' : file.name.toLowerCase().endsWith('.txt') ? 'TXT' : 'CSV';
    if (format === 'CSV' || format === 'TXT') { await openCsvImportDialog(file); return; }
    const next = format === 'XML' ? parseXML(await file.text()) : await parseXLSX(await file.arrayBuffer());
    if (unsaved && !confirm(`Replace your unsaved worksheet with this ${format}? Export or save first to keep your work.`)) return;
    data = next;
    activeSheet().data = next;
    activeSheet().page = 1;
    activeSheet().scrollLeft = 0;
    page = 1;
    history = history.filter(result => result.sheetName !== activeSheet().name);
    activeResult = null;
    revision++;
    unsaved = true;
    invalidateReport();
    renderSheet();
    renderHistory();
    $('projectName').textContent = file.name.replace(/\.(csv|xml|xlsx|txt)$/i, '');
    $('saveState').textContent = 'Unsaved changes';
    run();
  } catch (error) {
    message(error.message);
  } finally {
    $('file').value = '';
  }
};
const openSampleDataDialog = setupSampleDataDialog({ onGenerate: (next, type) => {
  const appended = appendSampleWorksheet(worksheets, next);
  worksheets = appended.worksheets;
  switchSheet(appended.activeSheetIndex);
  activeResult = null;
  revision++;
  $('analysis').value = 'summary';
  $('response').value = '0';
  $('predictor').value = '1';
  updateSettings();
  if (type === 'scatterplot') {
    const scatter = scatterPoints(next.rows, 0, 1, null, next.formats[0]);
    const svg = svgChart({ points: scatter.points, bounds: scatter.bounds, xLabel: axisLabel(next, 0), yLabel: axisLabel(next, 1), xFormat: next.formats[0], rectZoom: true });
    addGraphResult({ title: `${next.headers[1]} vs ${next.headers[0]}`, label: 'Scatterplot', type: 'scatter', column: next.headers[1], svg,
      observations: scatter.n, scatterSource: { xColumn: 0, yColumn: 1, groupColumn: null, xFormat: next.formats[0], groups: [] },
      note: `${groupedNumber(scatter.n)} observations${scatter.points.length < scatter.n ? ` · ${groupedNumber(scatter.points.length)} points displayed` : ''}` });
  } else if (type === 'boxplot') {
    const options = { layout: 'one-groups', yColumns: [0], groupColumns: [1] };
    const result = buildBoxplot(next, options);
    addGraphResult({ title: `Boxplot of ${next.headers[0]}`, label: 'Boxplot', type: 'box', column: next.headers[0],
      svg: drawBoxplot(result, options, esc), note: `${result.boxCount} boxes · ${groupedNumber(result.observations)} observations` });
  } else {
    const options = { columns: [0], overlay: false, group: null, by: [], combinations: false, binCount: 0, percent: false, sameX: false, sameY: false };
    const plots = buildHistogram(next, options);
    addGraphResult({ title: `Histogram of ${next.headers[0]}`, label: 'Histogram', type: 'histogram', column: next.headers[0],
      svg: drawHistogram(plots, { percent: false, legend: false, escape: esc }), note: `${groupedNumber(next.rows.length)} observations plotted` });
  }
  return true;
} });
$('sampleBtn').onclick = openSampleDataDialog;
$('saveBtn').onclick = async () => {
  const button = $('saveBtn');
  if (button.disabled) return;
  button.disabled = true;
  const savedData = data;
  const savedRevision = revision;
  const savedSheetIndex = activeSheetIndex;
  try {
    await saveSession({
      worksheets,
      activeSheetIndex,
      revision,
      history: history.map(result => result.surface ? { ...result, surface: { model: { ...result.surface.model, evaluate: undefined }, data: { headers: result.surface.data.headers } } } : result),
      name: $('projectName').textContent,
      settings: { ...Object.fromEntries(analysisFields.map(id => [id, $(id).value])), tTest: $('tTest').checked }
    });
    if (data === savedData && revision === savedRevision && activeSheetIndex === savedSheetIndex) {
      unsaved = false;
      $('saveState').textContent = 'Saved on this device';
    }
  } catch {
    message('Browser storage is unavailable or full. Export the CSV to keep your data.');
  } finally {
    button.disabled = false;
  }
};
const analysisDialog = $('analysisDialog');
const menus = [...document.querySelectorAll('.menubar > details')];
const analysisFields = ['analysis', 'response', 'predictor', 'lsl', 'usl', 'capGroup', 'pSize', 'pTarget', 'xbarSize', 'xbarTarget', 'xbarSigma', 'xbarGroup', 'xbarStage', 'maSpan', 'esWeight', 'esInitial', 'tSource', 'tN', 'tMean', 'tSd', 'tConfidence', 'tAlternative', 'tNull'];
let analysisDraft;

function openAnalysis(type) {
  analysisDraft = { values: analysisFields.map(id => $(id).value), tTest: $('tTest').checked };
  if (type) $('analysis').value = type;
  updateSettings();
  $('analysisError').hidden = true;
  analysisDialog.showModal();
}

function closeMenus(except) {
  for (const menu of menus) {
    if (menu !== except) menu.open = false;
  }
}

const viewActions = {
  toggleNavigator: () => { $('navigator').hidden = !$('navigator').hidden; },
  focusOutput: () => $('outputTitle').focus(),
  focusSheet: () => $('worksheet').querySelector('tbody input')?.focus()
};

document.querySelector('.menubar').addEventListener('click', event => {
  const summary = event.target.closest('summary');
  if (summary) {
    closeMenus(summary.closest('.menubar > details'));
    return;
  }

  const command = event.target.closest('button');
  if (!command) return;
  const menuSummary = command.closest('details').querySelector('summary');
  closeMenus();
  menuSummary.focus();

  const { action, analysis } = command.dataset;
  if (analysis) openAnalysis(analysis);
  if (action) {
    const viewAction = viewActions[action];
    if (viewAction) viewAction();
    else $(action).click();
  }
});

document.addEventListener('click', event => {
  if (!event.target.closest('.menubar')) closeMenus();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    const openMenu = menus.find(menu => menu.open);
    if (openMenu) {
      closeMenus();
      openMenu.querySelector('summary').focus();
    }
  }

  if (event.key === 'F3' && analysisDialog.open) {
    event.preventDefault();
    $('response').selectedIndex = 0;
    $('predictor').selectedIndex = Math.min(1, $('predictor').options.length - 1);
    $('lsl').value = $('lsl').defaultValue;
    $('usl').value = $('usl').defaultValue;
    $('maSpan').value = '3';
    $('esWeight').value = '0.2';
    $('esInitial').value = '1';
    $('pSize').value = '10';
    $('xbarSize').value = '5';
    $('xbarTarget').value = '';
    $('xbarSigma').value = '';
    $('pTarget').value = '';
    $('tSource').value = 'column';
    $('tN').value = '';
    $('tMean').value = '';
    $('tSd').value = '';
    $('tConfidence').value = '95';
    $('tAlternative').value = 'two-sided';
    $('tTest').checked = true;
    $('tNull').value = '0';
    updateSettings();
    $('analysisError').hidden = true;
  }
});

$('configureBtn').onclick = () => openAnalysis();
$('closeAnalysis').onclick = $('cancelAnalysis').onclick = () => analysisDialog.close();
analysisDialog.addEventListener('close', () => {
  if (!analysisDraft) return;
  analysisFields.forEach((id, index) => { $(id).value = analysisDraft.values[index]; });
  $('tTest').checked = analysisDraft.tTest;
  analysisDraft = undefined;
  updateSettings();
});
$('runBtn').onclick = () => {
  if (!run()) return;
  analysisDraft = undefined;
  analysisDialog.close();
};

$('clearHistory').onclick = () => {
  history = [];
  activeResult = null;
  invalidateReport();
  renderHistory();
};

$('historyList').onclick = event => {
  const entry = event.target.closest('[data-history]');
  if (!entry) return;

  const result = history[Number(entry.dataset.history)];
  showResult(result);
  for (const button of $('historyList').querySelectorAll('button')) {
    button.setAttribute('aria-current', String(button === entry));
  }
};

function formatRolloutTime(deployedAt) {
  const date = new Date(deployedAt);
  if (!Number.isFinite(date.getTime())) throw Error('App information is invalid.');
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
  });
}

async function loadReleaseInfo() {
  try {
    const [infoResponse, notesResponse] = await Promise.all([
      fetch('/app-info.json', { cache: 'no-store' }),
      fetch('/release-notes.json', { cache: 'no-store' })
    ]);
    if (!infoResponse.ok || !notesResponse.ok) throw Error('Release information is unavailable.');
    const { version, deployedAt } = await infoResponse.json();
    const notes = await notesResponse.json();
    if (!version || !Array.isArray(notes)) throw Error('Release information is invalid.');
    const rolloutTime = formatRolloutTime(deployedAt);
    $('appVersion').textContent = version;
    $('deploymentTime').textContent = rolloutTime;
    $('helpMenuVersion').textContent = version;
    $('helpMenuRollout').textContent = rolloutTime;
    const list = $('helpChangesList');
    list.replaceChildren();
    for (const release of notes) {
      const heading = document.createElement('h3');
      heading.textContent = `Version ${release.version}`;
      const changes = document.createElement('ul');
      for (const change of release.changes) {
        const item = document.createElement('li');
        item.textContent = change;
        changes.append(item);
      }
      list.append(heading, changes);
    }
  } catch {
    $('appVersion').textContent = 'Unavailable';
    $('deploymentTime').textContent = 'Unavailable';
    $('helpMenuVersion').textContent = 'Unavailable';
    $('helpMenuRollout').textContent = 'Unavailable';
    $('helpChangesList').textContent = 'Changes unavailable.';
  }
}
$('helpMenu').addEventListener('toggle', () => { if ($('helpMenu').open) loadReleaseInfo(); });
$('helpBtn').onclick = () => { $('help').showModal(); loadReleaseInfo(); };
$('closeHelp').onclick = () => $('help').close();
function addGraphResult(graph) {
  const html = graphResultHtml(graph.title, graph.label, activeSheet().name, graph.svg, graph.note);
  const report = ['jmptab — ' + graph.label, 'Worksheet: ' + activeSheet().name, graph.title, graph.note, 'Worksheet revision: ' + revision].join('\n');
  history.unshift({ type: graph.type, label: graph.label, column: graph.column,
    sheetName: activeSheet().name, html, report, revision, surface: graph.surface,
    graphTitle: graph.title, graphNote: graph.note, graphSvg: graph.svg,
    scatterSource: graph.scatterSource,
    observations: graph.observations ?? (Number(String(graph.note || '').replaceAll(' ', '').match(/([\d,]+)observations/)?.[1]?.replaceAll(',', '')) || undefined) });
  history = history.slice(0, 20);
  showResult(history[0]);
  renderHistory();
}

function graphResultHtml(title, label, sheetName, svg, noteText) {
  return `<div class="result-title"><div><h3>${esc(title)}</h3><p>${esc(label)} · ${esc(sheetName)}</p></div>
    <button data-edit-graph>Edit graph</button><button data-export-graph>Export SVG</button></div>
    <div class="graph-result-figure" role="group" aria-label="Resizable graph" title="Drag the lower-right corner to resize; use Edit graph for exact dimensions">${svg}<p class="muted">${esc(noteText)}</p></div>`;
}

function showResult(result) {
  activeResult = result;
  $('results').innerHTML = result.html;
  $('scatterDragMode').closest('label').hidden = !result.scatterSource;
  prepareMovableResults($('results'));
  setXLabelAngle($('results'), Number($('xLabelAngle').value));
  ensureChartLegends($('results'));
  preparePlotSettingsButtons($('results'));
  applyFigureSizes($('results'), result.figureSizes || (result.figureSize ? [result.figureSize] : null));
  attachSurfaceRotation($('results'), result);
  lastReport = result.report;
  $('resultSubtitle').textContent = (result.label || names[result.type]) + ' · worksheet revision ' + result.revision;
  $('outputScroll').scrollTop = 0;
}
function resampleActiveScatter(bounds) {
  const source = activeResult?.scatterSource;
  const sheet = worksheets.find(item => item.name === activeResult?.sheetName);
  if (!source || !sheet) { message('Original scatterplot data is unavailable. Recreate the graph.'); return null; }
  if (activeResult.revision !== revision) { message('Worksheet data has changed. Recreate the graph before zooming.'); return null; }
  const sample = scatterPoints(sheet.data.rows, source.xColumn, source.yColumn, source.groupColumn, source.xFormat, bounds);
  if (source.groupColumn !== null) for (const point of sample.points) point[3] = SCATTER_GROUP_COLORS[source.groups.indexOf(point[4])] || SCATTER_GROUP_COLORS[0];
  message('');
  return sample;
}
function selectActiveScatterRows(bounds) {
  const source = activeResult?.scatterSource;
  const targetIndex = worksheets.findIndex(sheet => sheet.name === activeResult?.sheetName);
  if (!source || targetIndex < 0 || activeResult.revision !== revision) {
    message('Worksheet data has changed. Recreate the scatterplot before selecting rows.');
    return null;
  }
  const sheet = worksheets[targetIndex];
  const selected = scatterRowsInBounds(sheet.data.rows, source, bounds);
  sheet.selectedRows = selected;
  sheet.selectionAnchor = selected.size ? selected.values().next().value : null;
  sheet.viewMode = 'selected';
  sheet.page = 1;
  if (targetIndex !== activeSheetIndex) switchSheet(targetIndex);
  else { page = 1; renderSheet(); }
  $('tableScroll').scrollTop = 0;
  message('');
  return selected;
}
$('deselectAll').onclick = () => {
  const sheet = activeSheet();
  sheet.selectedRows = new Set();
  sheet.selectionAnchor = null;
  sheet.selectedColumns = new Set();
  sheet.selectedColumn = null;
  sheet.columnSelectionAnchor = null;
  if (sheet.viewMode === 'selected') { sheet.viewMode = 'edges'; sheet.page = page = 1; }
  for (const result of history) {
    if (result.sheetName !== sheet.name || !result.html?.includes('data-selected-bounds')) continue;
    const container = result === activeResult ? $('results') : document.createElement('div');
    if (result !== activeResult) container.innerHTML = result.html;
    for (const svg of container.querySelectorAll('svg.chart[data-selected-bounds]')) highlightScatterPoints(svg, null);
    result.html = container.innerHTML;
  }
  renderSheet();
};
setupChartInteractions($('results'), () => {
  if (activeResult) activeResult.html = $('results').innerHTML;
  updateSheetSelectionControls();
}, resampleActiveScatter, selectActiveScatterRows);
$('scatterDragMode').addEventListener('change', () => setXLabelAngle($('results'), Number($('xLabelAngle').value)));
$('xLabelAngle').addEventListener('change', () => {
  for (const svg of $('results').querySelectorAll('svg.chart')) delete svg.dataset.xLabelAngle;
  setXLabelAngle($('results'), Number($('xLabelAngle').value));
  if (activeResult) activeResult.html = $('results').innerHTML;
});
let selectedPlot = null;
$('results').addEventListener('click', event => {
  const button = event.target.closest('[data-plot-settings]');
  if (!button) return;
  selectedPlot = button.closest('.graph-result-figure')?.querySelector('svg.chart') || null;
  if (!selectedPlot) return;
  const isScatter = selectedPlot.hasAttribute('data-rect-zoom');
  const supportsElements = Boolean(selectedPlot.querySelector('.chart-x-title'));
  for (const field of $('plotSettingsDialog').querySelectorAll('.plot-common-field')) field.hidden = !supportsElements;
  const model = isScatter ? JSON.parse(decodeURIComponent(selectedPlot.dataset.rectZoom)) : null;
  const supportsTrend = Boolean(model && !activeResult?.scatterSource?.groups?.length);
  for (const field of $('plotSettingsDialog').querySelectorAll('.plot-trend-field')) field.hidden = !supportsTrend;
  $('plotTrendline').checked = Boolean(model?.fit);
  const formatting = readChartFormatting(selectedPlot);
  $('plotXAxis').checked = formatting.xAxis;
  $('plotYAxis').checked = formatting.yAxis;
  $('plotLegend').checked = formatting.legend;
  $('plotLegendPosition').value = formatting.legendPosition;
  $('plotGridlines').checked = formatting.gridlines;
  $('plotXTitle').checked = formatting.xTitle;
  $('plotYTitle').checked = formatting.yTitle;
  $('plotXTitleText').value = formatting.xTitleText || selectedPlot.querySelector('.chart-x-title')?.textContent || '';
  $('plotYTitleText').value = formatting.yTitleText || selectedPlot.querySelector('.chart-y-title')?.textContent || '';
  $('plotDataLabels').checked = formatting.dataLabels;
  $('plotXAngle').value = selectedPlot.dataset.xLabelAngle ?? $('xLabelAngle').value;
  for (const field of $('plotSettingsDialog').querySelectorAll('.plot-scale-field')) field.hidden = !isScatter;
  if (isScatter) {
    const bounds = JSON.parse(decodeURIComponent(selectedPlot.dataset.axisBounds));
    const model = JSON.parse(decodeURIComponent(selectedPlot.dataset.rectZoom));
    $('plotFixedScale').checked = selectedPlot.hasAttribute('data-fixed-axes');
    for (const [id, value] of [['plotXMin', bounds.xmin], ['plotXMax', bounds.xmax], ['plotYMin', bounds.ymin], ['plotYMax', bounds.ymax]])
      $(id).value = formatPlotBound(value, id.startsWith('plotX') ? model.xFormat : null);
  }
  $('plotSettingsError').hidden = true;
  $('plotSettingsDialog').showModal();
});
$('plotSettingsCancel').onclick = () => $('plotSettingsDialog').close();
$('plotSettingsForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!selectedPlot?.isConnected) return;
  try {
    const angle = Number($('plotXAngle').value);
    if (!Number.isInteger(angle) || angle < -90 || angle > 90) throw new Error('X label angle must be from −90° to 90°.');
    const formatting = {
      xAxis: $('plotXAxis').checked, yAxis: $('plotYAxis').checked,
      gridlines: $('plotGridlines').checked, xTitle: $('plotXTitle').checked, yTitle: $('plotYTitle').checked,
      xTitleText: $('plotXTitleText').value, yTitleText: $('plotYTitleText').value,
      dataLabels: $('plotDataLabels').checked, legend: $('plotLegend').checked,
      legendPosition: $('plotLegendPosition').value
    };
    let chart = selectedPlot;
    if (chart.hasAttribute('data-rect-zoom')) {
      const model = JSON.parse(decodeURIComponent(chart.dataset.rectZoom));
      const bounds = $('plotFixedScale').checked ? {
        xmin: parsePlotBound($('plotXMin').value, model.xFormat), xmax: parsePlotBound($('plotXMax').value, model.xFormat),
        ymin: parsePlotBound($('plotYMin').value), ymax: parsePlotBound($('plotYMax').value)
      } : null;
      const sample = resampleActiveScatter(bounds);
      if (!sample) throw new Error('Recreate the scatterplot before changing its scale.');
      let fit = null;
      if ($('plotTrendline').checked) {
        const source = activeResult.scatterSource;
        const sheet = worksheets.find(item => item.name === activeResult.sheetName);
        fit = model.fit || scatterTrendline(sheet.data.rows, source.xColumn, source.yColumn, source.xFormat);
      }
      const replacement = renderScatterWithBounds(chart, bounds, sample.points, fit);
      if (chart.dataset.selectedBounds) highlightScatterPoints(replacement, JSON.parse(decodeURIComponent(chart.dataset.selectedBounds)));
      if ($('plotDataLabels').checked && sample.points.length > 50) throw new Error('Data labels need 50 or fewer visible marks. Zoom in or hide data labels.');
      const previousLegend = chart.nextElementSibling;
      chart.replaceWith(replacement);
      if (previousLegend?.classList.contains('chart-legend')) previousLegend.remove();
      chart = replacement;
      ensureChartLegends($('results'));
    }
    applyChartFormatting(chart, formatting);
    for (const plot of chart.closest('.graph-result-figure')?.querySelectorAll('svg.chart') || [chart]) setChartXLabelAngle(plot, angle);
    if (activeResult) {
      activeResult.html = $('results').innerHTML;
      if (activeResult.graphSvg?.trimStart().startsWith('<svg')) activeResult.graphSvg = chart.outerHTML;
    }
    $('plotSettingsDialog').close();
  } catch (error) {
    $('plotSettingsError').textContent = error.message;
    $('plotSettingsError').hidden = false;
  }
});
setupResultDragging($('results'), () => {
  if (activeResult) activeResult.html = $('results').innerHTML;
});
$('results').addEventListener('pointerup', event => {
  const figure = event.target.closest('.graph-result-figure');
  if (!figure || !activeResult) return;
  activeResult.figureSizes = measureFigureSizes($('results'));
  activeResult.figureSize = activeResult.figureSizes[0];
});

const openBoxplotBuilder = setupBoxplotBuilder({ getData: () => data, onCreate: addGraphResult, escape: esc });
const openGraphLayout = setupGraphLayoutDialog({ getResults: () => history, onCreate: addGraphResult, escape: esc });
$('graphLayoutBtn').onclick = openGraphLayout;
const openDataPreparation = setupDataPreparationDialog({ getWorksheets: () => worksheets, getActiveIndex: () => activeSheetIndex, escape: esc,
  onStack: sheet => { if (worksheets.length >= 100) throw Error('Maximum 100 worksheets per project.'); worksheets.push(sheet); revision++; switchSheet(worksheets.length-1); },
  onChange: next => { data = next; activeSheet().data = next; if(activeSheet().formulas?.length)recalculateFormulas(activeSheet()); dirty(); renderSheet(); invalidateReport(); } });
$('stackWorksheetsBtn').onclick = () => openDataPreparation('stack');
$('recodeColumnBtn').onclick = () => openDataPreparation('recode');
$('formulaColumnBtn').onclick = () => openDataPreparation('formula');
const openFactorial = setupFactorialDialog({ getWorksheets: () => worksheets, getActiveIndex: () => activeSheetIndex, escape: esc,
  onSheet: sheet => { if (worksheets.length >= 100) throw Error('Maximum 100 worksheets per project.'); if (worksheets.some(existing => existing.name.toLowerCase() === sheet.name.toLowerCase())) throw Error('Choose a unique worksheet name.'); worksheets.push(sheet); revision++; switchSheet(worksheets.length-1); },
  onFit: () => { unsaved = true; revision++; $('saveState').textContent = 'Unsaved changes'; renderSheet(); }, onCreate: addGraphResult });
for (const [id,mode] of [['factorialCreateBtn','create'],['factorialAnalyzeBtn','analyze'],['factorialEffectsBtn','effects'],['factorialPredictBtn','predict']])
  $(id).onclick = () => { try { openFactorial(mode); } catch(error) { message(error.message); } };
function runCommand(spec) {
  if (spec.responseIndex >= data.headers.length || spec.predictorIndex >= data.headers.length) throw Error('Command refers to a column outside the active worksheet.');
  $('analysis').value = spec.type;
  $('response').value = String(spec.responseIndex);
  $('predictor').value = String(spec.predictorIndex);
  const defaults = { lsl:'', usl:'', capGroup:'', xbarGroup:'', xbarStage:'', xbarTarget:'', xbarSigma:'', pTarget:'',
    xbarSize:'5', pSize:'10', maSpan:'3', esWeight:'0.2', esInitial:'1', tSource:'column', tN:'', tMean:'', tSd:'',
    tConfidence:'95', tAlternative:'two-sided', tNull:'0' };
  for (const [id,value] of Object.entries(defaults)) $(id).value = value;
  $('tTest').checked = true;
  const fields = { lsl:'lsl',usl:'usl',subgroupSize:spec.type==='p-chart'?'pSize':'xbarSize', subgroupColumn:spec.type==='capability'?'capGroup':'xbarGroup',
    targetProportion:'pTarget',targetMean:'xbarTarget',sigma:'xbarSigma',stageColumn:'xbarStage',
    span:'maSpan',weight:'esWeight',initialPeriods:'esInitial',source:'tSource',n:'tN',mean:'tMean',sd:'tSd',confidence:'tConfidence',
    alternative:'tAlternative',nullMean:'tNull' };
  for (const [key,id] of Object.entries(fields)) if (spec.options[key] !== undefined && id) $(id).value = spec.options[key] ?? '';
  if (spec.type === 'one-sample-t' && spec.options.nullMean === null) $('tTest').checked = false;
  updateSettings();
  if (!run()) throw Error($('error').textContent || 'The analysis could not be repeated.');
}
const openCommands = setupCommandDialog({ getHistory: () => history, onRun: runCommand, download, escape: esc });
$('commandHistoryBtn').onclick = openCommands;
$('repeatAnalysisBtn').onclick = () => {
  try {
    if (!activeResult?.command) throw Error('Select a repeatable statistical analysis in the Navigator.');
    const target = worksheets.findIndex(sheet => sheet.name === activeResult.sheetName);
    if (target < 0) throw Error('The source worksheet is unavailable.');
    if (target !== activeSheetIndex) switchSheet(target);
    runCommand(parseCommands(activeResult.command)[0]);
  } catch(error) { message(error.message); }
};
const openResponseSurface = setupResponseSurfaceDialog({ getData: () => data, onCreate: addGraphResult, escape: esc });
const openGroupAnalysis = setupGroupAnalysisDialog({ getData: () => data, onCreate: addGraphResult, escape: esc });
$('groupSummaryBtn').onclick = () => openGroupAnalysis('summary');
$('anovaBtn').onclick = () => openGroupAnalysis('anova');
$('contourPlotBtn').onclick = () => openResponseSurface('contour');
$('surfacePlotBtn').onclick = () => openResponseSurface('surface');
const openGraphBuilder = setupGraphBuilder({
  getData: () => data,
  drawChart: svgChart,
  escape: esc,
  onCreate: addGraphResult,
  onBoxplot: openBoxplotBuilder
});
$('graphBuilderBtn').onclick = $('graphMenuBtn').onclick = () => openGraphBuilder();
$('histogramMenuBtn').onclick = () => openGraphBuilder('histogram');
$('boxplotMenuBtn').onclick = openBoxplotBuilder;
$('results').addEventListener('click', event => {
  if (event.target.closest('[data-edit-graph]')) {
    if (!activeResult?.graphSvg) return;
    $('graphEditTitle').value = activeResult.graphTitle;
    $('graphEditFootnote').value = activeResult.graphNote;
    const figure = $('results').querySelector('.graph-result-figure');
    $('graphEditWidth').value = activeResult.figureSize?.width || Math.round(figure?.getBoundingClientRect().width || 624);
    $('graphEditHeight').value = activeResult.figureSize?.height || Math.round(figure?.getBoundingClientRect().height || 325);
    $('graphEditDialog').showModal();
    return;
  }
  if (!event.target.closest('[data-export-graph]')) return;
  const charts = [...$('results').querySelectorAll('svg.chart')];
  if (!charts.length) return;
  let exportChart = appendLegendToSvgClone(charts[0], charts[0].cloneNode(true));
  if (charts.length > 1) {
    const namespace = 'http://www.w3.org/2000/svg';
    exportChart = document.createElementNS(namespace, 'svg');
    const panels = charts.map(chart => appendLegendToSvgClone(chart, chart.cloneNode(true)));
    const widths = panels.map(chart => Number(chart.viewBox.baseVal.width));
    const heights = panels.map(chart => Number(chart.viewBox.baseVal.height));
    exportChart.setAttribute('viewBox', `0 0 ${Math.max(...widths)} ${heights.reduce((sum, height) => sum + height, 0)}`);
    let y = 0;
    panels.forEach((panel, index) => {
      panel.setAttribute('x', '0');
      panel.setAttribute('y', String(y));
      panel.setAttribute('width', String(widths[index]));
      panel.setAttribute('height', String(heights[index]));
      exportChart.append(panel);
      y += heights[index];
    });
  }
  const heading = $('results').querySelector('h3').textContent;
  exportChart = appendExportContext(exportChart, { title: heading, sheetName: activeResult?.sheetName || activeSheet().name, observations: activeResult?.observations });
  download('jmptab-graph.svg', new XMLSerializer().serializeToString(exportChart), 'image/svg+xml');
});
$('graphEditCancel').onclick = () => $('graphEditDialog').close();
$('graphEditSave').onclick = () => {
  if (!activeResult?.graphSvg) return;
  const width = Number($('graphEditWidth').value);
  const height = Number($('graphEditHeight').value);
  if (!Number.isInteger(width) || width < 240 || width > 2400 || !Number.isInteger(height) || height < 160 || height > 1600) {
    $('graphEditWidth').reportValidity();
    $('graphEditHeight').reportValidity();
    return;
  }
  activeResult.graphTitle = $('graphEditTitle').value.trim() || activeResult.graphTitle;
  activeResult.graphNote = $('graphEditFootnote').value.trim();
  activeResult.figureSize = { width, height };
  activeResult.html = graphResultHtml(activeResult.graphTitle, activeResult.label, activeResult.sheetName, activeResult.graphSvg, activeResult.graphNote);
  activeResult.report = ['jmptab — ' + activeResult.label, 'Worksheet: ' + activeResult.sheetName, activeResult.graphTitle, activeResult.graphNote, 'Worksheet revision: ' + activeResult.revision].join('\n');
  $('graphEditDialog').close();
  showResult(activeResult);
  renderHistory();
};

async function restoreWorkspace() {
  let saved;
  try {
    saved = await loadSession();
  } catch {
    // A disabled or unavailable database should still allow the legacy session to open.
  }
  if (!saved) {
    try { saved = JSON.parse(localStorage.getItem(storeKey)); } catch { /* Start with sample data. */ }
  }
  const restoredSheets = Array.isArray(saved?.worksheets) ? saved.worksheets :
    saved?.data ? [{ name: 'Worksheet 1', data: saved.data, page: 1 }] : null;
  let restored = false;
  if (restoredSheets?.length && restoredSheets.length <= 100 && restoredSheets.every(validWorksheet)) {
    worksheets = restoredSheets;
    activeSheetIndex = Math.max(0, Math.min(worksheets.length - 1, Number(saved.activeSheetIndex) || 0));
    data = activeSheet().data;
    page = activeSheet().page || 1;
    revision = saved.revision || 0;
    $('projectName').textContent = saved.name || 'Process study';
    $('saveState').textContent = 'Restored from this device';
    if (Array.isArray(saved.history)) history = saved.history.slice(0,20);
    restored = true;
  }
  renderSheet();
  if (restored) {
    for (const id of analysisFields) {
      if (saved.settings?.[id] !== undefined) $(id).value = saved.settings[id];
    }
  }
  if (saved?.settings?.tTest !== undefined) $('tTest').checked = saved.settings.tTest;
  updateSettings();
  renderHistory();
  const priorResult = history.find(result => result.sheetName === activeSheet().name);
  if (priorResult) showResult(priorResult);
  else run();
}

await restoreWorkspace();
