import { setupGraphBuilder } from './graph-builder.js';
import { executeAnalysis } from './analysis-execution.js';
import { esc, fmt, svgChart, renderAnalysisResult } from './analysis-rendering.js';
import { saveSession, loadSession } from './session.js';
import {summary,parseCSV,csvChunks,numeric,MAX_ROWS,MAX_COLUMNS} from './stats.js';
const $ = id => document.getElementById(id);
const names={summary:'Descriptive statistics',histogram:'Histogram',regression:'Linear regression',control:'Individuals control chart','p-chart':'P chart','moving-average':'Moving average','exponential-smoothing':'Single exponential smoothing',capability:'Process capability','one-sample-t':'1-Sample t',correlation:'Correlation','xbar-chart':'Xbar chart'};
function sample(){return{headers:['Diameter (mm)','Temperature (°C)','Line'],rows:Array.from({length:48},(_,i)=>{const t=20+Math.sin(i*1.7)*2.4+(i%5)*.6;return[(10+.045*(t-21)+Math.sin(i*2.1)*.082+Math.cos(i*.7)*.052).toFixed(3),t.toFixed(2),i%2?'B':'A'];})};}
let data=sample(),history=[],lastReport='',revision=0,unsaved=false,activeResult=null;const storeKey='statlab-session-v1';
function invalidateReport(){lastReport='';$('results').innerHTML='<div class="empty">No result for this worksheet. Choose numeric columns and run an analysis.</div>';$('resultSubtitle').textContent='No analysis yet';}
function message(text) {
  const outputError = $('error');
  const dialogError = $('analysisError');
  const target = $('analysisDialog').open ? dialogError : outputError;
  outputError.hidden = true;
  dialogError.hidden = true;
  target.textContent = text;
  target.hidden = !text;
}
function dirty(){unsaved=true;revision++;$('saveState').textContent='Unsaved changes';$('resultSubtitle').textContent='Worksheet changed · run analysis to refresh';}
const PAGE_SIZE = 200;
let page = 1;

function renderSheet() {
  const pageCount = Math.max(1, Math.ceil(data.rows.length / PAGE_SIZE));
  page = Math.min(page, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const headers = data.headers.map((_, index) => '<th scope="col">C' + (index + 1) + '</th>').join('');
  const names = data.headers.map((name, column) =>
    `<th><input aria-label="Column ${column + 1} name" data-col="${column}" value="${esc(name)}"></th>`
  ).join('');
  const rows = data.rows.slice(start, start + PAGE_SIZE).map((row, offset) => {
    const index = start + offset;
    const cells = row.map((value, column) =>
      `<td><input aria-label="Row ${index + 1}, ${esc(data.headers[column])}" data-row="${index}" data-col="${column}" value="${esc(value)}"></td>`
    ).join('');
    return `<tr><td>${(index + 1).toLocaleString('en-US')}</td>${cells}</tr>`;
  }).join('');
  $('worksheet').innerHTML = `<thead><tr><th scope="col">#</th>${headers}</tr><tr><th></th>${names}</tr></thead><tbody>${rows}</tbody>`;
  $('sheetCount').textContent = `${data.rows.length.toLocaleString('en-US')} rows · ${data.headers.length} columns`;
  $('sheetPage').value = page;
  $('sheetPage').max = pageCount;
  $('pageCount').textContent = 'of ' + pageCount.toLocaleString('en-US');
  $('previousPage').disabled = page <= 1;
  $('nextPage').disabled = page >= pageCount;
  renderColumns();
}

function showPage(number) {
  page = Math.max(1, Math.trunc(number) || page);
  renderSheet();
  document.querySelector('.table-scroll').scrollTop = 0;
}

$('previousPage').onclick = () => showPage(page - 1);
$('nextPage').onclick = () => showPage(page + 1);
$('goToPage').onclick = () => showPage(Number($('sheetPage').value));
$('sheetPage').onkeydown = event => {
  if (event.key === 'Enter') $('goToPage').click();
};
function renderColumns(){for(const id of ['response','predictor']){const prev=$(id).value;$(id).innerHTML=data.headers.map((h,i)=>`<option value="${i}">${esc(h)}</option>`).join('');if(prev!==''&&Number(prev)<data.headers.length)$(id).value=prev;}if($('predictor').value===$('response').value&&data.headers.length>1)$('predictor').value=String((+$('response').value+1)%data.headers.length);}
$('worksheet').addEventListener('input',e=>{const el=e.target;if(!el.matches('input'))return;const c=+el.dataset.col;if(el.dataset.row!==undefined)data.rows[+el.dataset.row][c]=el.value;else{data.headers[c]=el.value;renderColumns();}dirty();});
$('worksheet').addEventListener('paste',e=>{const el=e.target;if(!el.matches('td input'))return;const text=e.clipboardData.getData('text');if(!/[\t\n]/.test(text))return;e.preventDefault();const incoming=text.replace(/\r/g,'').trimEnd().split('\n').map(r=>r.split('\t')),r=+el.dataset.row,c=+el.dataset.col;if(r+incoming.length>MAX_ROWS||c+incoming.reduce((width, row) => Math.max(width, row.length), 0)>30){message('Paste up to 1,000,000 rows and 30 columns.');return;}while(data.headers.length<c+incoming.reduce((width, row) => Math.max(width, row.length), 0))data.headers.push(`Column ${data.headers.length+1}`);data.rows.forEach(row=>{while(row.length<data.headers.length)row.push('');});while(data.rows.length<r+incoming.length)data.rows.push(Array(data.headers.length).fill(''));incoming.forEach((row,i)=>row.forEach((v,j)=>data.rows[r+i][c+j]=v));dirty();renderSheet();});
function updateSettings(){const type=$('analysis').value;$('predictorField').hidden=type!=='regression'&&type!=='correlation';document.querySelectorAll('.spec').forEach(el=>el.hidden=type!=='capability');$('pFields').hidden=type!=='p-chart';$('xbarFields').hidden=type!=='xbar-chart';$('maFields').hidden=type!=='moving-average';$('esFields').hidden=type!=='exponential-smoothing';$('tFields').hidden=type!=='one-sample-t';$('responseField').hidden=type==='one-sample-t'&&$('tSource').value==='summary';$('tSummaryFields').hidden=$('tSource').value!=='summary';$('tNullField').hidden=!$('tTest').checked;}
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
    case 'p-chart':
      return {
        subgroupSize: requiredNumber('pSize', 'subgroup size'),
        targetProportion: $('pTarget').value.trim() === '' ? null : requiredNumber('pTarget', 'target proportion')
      };
    case 'capability':
      return { lsl: numeric($('lsl').value), usl: numeric($('usl').value) };
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
    const badge = ['control', 'capability', 'p-chart', 'xbar-chart'].includes(type)
      ? 'Quality analysis' : 'Statistical analysis';
    const title = `<div class="result-title"><div><h3>${esc(resultColumn)}</h3><p>${esc(names[type])} · Worksheet 1</p></div><span class="badge">${badge}</span></div>`;
    const { html, report } = renderAnalysisResult({
      type, s: result, column, predictorColumn: data.headers[predictorIndex], rowCount: data.rows.length
    });
    const now = new Date();
    lastReport = `jmptab — ${names[type]}\nColumn: ${resultColumn}\nGenerated: ${now.toISOString()}\nWorksheet revision: ${revision}\n\n${report}`;
    $('results').innerHTML = title + html;
    $('resultSubtitle').textContent = `${names[type]} · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (record) {
      history.unshift({
        type, column: resultColumn, time: now.toISOString(), html: title + html, report: lastReport, revision
      });
      history = history.slice(0, 20);
      activeResult = history[0];
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
          <small>${esc(result.column)}</small>
        </button>`).join('')
    : '<p class="empty">Run an analysis to add a result.</p>';
}

$('addRow').onclick=()=>{if(data.rows.length>=MAX_ROWS)return message('Maximum 1,000,000 rows.');data.rows.push(Array(data.headers.length).fill(''));dirty();showPage(Math.ceil(data.rows.length / PAGE_SIZE));const scroll=document.querySelector('.table-scroll');scroll.scrollTop=scroll.scrollHeight;};$('addCol').onclick=()=>{if(data.headers.length>=30)return message('Maximum 30 columns.');data.headers.push(`Column ${data.headers.length+1}`);data.rows.forEach(r=>r.push(''));dirty();renderSheet();};
function download(name,content,type){const url=URL.createObjectURL(new Blob(typeof content === "string" ? [content] : content,{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('exportBtn').onclick=()=>download('worksheet.csv',csvChunks(data),'text/csv;charset=utf-8');$('reportBtn').onclick=()=>lastReport?download('jmptab-report.txt',lastReport,'text/plain;charset=utf-8'):message('Run an analysis before exporting a report.');$('importBtn').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const next=parseCSV(await file.text());if(unsaved&&!confirm('Replace your unsaved worksheet with this CSV? Export or save first to keep your work.'))return;data=next;page=1;history=[];revision=0;unsaved=true;invalidateReport();renderSheet();renderHistory();$('projectName').textContent=file.name.replace(/\.csv$/i,'');$('saveState').textContent='Unsaved changes';run();}catch(e){message(e.message);}finally{$('file').value='';}};
$('sampleBtn').onclick=()=>{if(unsaved&&!confirm('Replace your worksheet with sample data? Export or save first to keep your work.'))return;data=sample();page=1;history=[];revision=0;unsaved=true;invalidateReport();renderSheet();renderHistory();$('analysis').value='summary';$('response').value='0';$('predictor').value='1';updateSettings();$('projectName').textContent='Sample process study';$('saveState').textContent='Unsaved changes';run();};
$('saveBtn').onclick = async () => {
  const button = $('saveBtn');
  if (button.disabled) return;
  button.disabled = true;
  const savedData = data;
  const savedRevision = revision;
  try {
    await saveSession({
      data,
      revision,
      name: $('projectName').textContent,
      settings: { ...Object.fromEntries(analysisFields.map(id => [id, $(id).value])), tTest: $('tTest').checked }
    });
    if (data === savedData && revision === savedRevision) {
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
const menus = [...document.querySelectorAll('.menubar details')];
const analysisFields = ['analysis', 'response', 'predictor', 'lsl', 'usl', 'pSize', 'pTarget', 'xbarSize', 'xbarTarget', 'xbarSigma', 'maSpan', 'esWeight', 'esInitial', 'tSource', 'tN', 'tMean', 'tSd', 'tConfidence', 'tAlternative', 'tNull'];
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
    closeMenus(summary.parentElement);
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

$('helpBtn').onclick = async () => {
  $('help').showModal();
  try {
    const response = await fetch('/app-info.json', { cache: 'no-store' });
    if (!response.ok) throw Error('App information is unavailable.');
    const { version, deployedAt } = await response.json();
    const date = new Date(deployedAt);
    if (!version || !Number.isFinite(date.getTime())) throw Error('App information is invalid.');
    $('appVersion').textContent = version;
    $('deploymentTime').textContent = date.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    });
  } catch {
    $('appVersion').textContent = 'Unavailable';
    $('deploymentTime').textContent = 'Unavailable';
  }
};
$('closeHelp').onclick = () => $('help').close();
function addGraphResult(graph) {
  const html = `<div class="result-title"><div><h3>${esc(graph.title)}</h3><p>${esc(graph.label)} · Worksheet 1</p></div>
    <button data-export-graph>Export SVG</button></div>
    <div class="graph-result-figure">${graph.svg}<p class="muted">${esc(graph.note)}</p></div>`;
  const report = ['jmptab — ' + graph.label, graph.title, graph.note, 'Worksheet revision: ' + revision].join('\n');
  history.unshift({ type: graph.type, label: graph.label, column: graph.column, html, report, revision });
  history = history.slice(0, 20);
  showResult(history[0]);
  renderHistory();
}

function showResult(result) {
  activeResult = result;
  $('results').innerHTML = result.html;
  lastReport = result.report;
  $('resultSubtitle').textContent = (result.label || names[result.type]) + ' · worksheet revision ' + result.revision;
  $('outputScroll').scrollTop = 0;
}

const openGraphBuilder = setupGraphBuilder({
  getData: () => data,
  drawChart: svgChart,
  escape: esc,
  onCreate: addGraphResult
});
$('graphBuilderBtn').onclick = $('graphMenuBtn').onclick = () => openGraphBuilder();
$('histogramMenuBtn').onclick = () => openGraphBuilder('histogram');
$('results').addEventListener('click', event => {
  if (!event.target.closest('[data-export-graph]')) return;
  const chart = $('results').querySelector('svg.chart');
  if (!chart) return;
  const exportChart = chart.cloneNode(true);
  exportChart.setAttribute('font-family', 'Segoe UI, sans-serif');
  exportChart.setAttribute('font-size', '10');
  const heading = $('results').querySelector('h3').textContent;
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = heading;
  exportChart.querySelector('title')?.remove();
  exportChart.prepend(title);
  download('jmptab-graph.svg', new XMLSerializer().serializeToString(exportChart), 'image/svg+xml');
});

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
  if (saved?.data?.headers?.length && saved.data.headers.length <= MAX_COLUMNS &&
      Array.isArray(saved.data.rows) && saved.data.rows.length <= MAX_ROWS &&
      saved.data.rows.every(row => Array.isArray(row) && row.length === saved.data.headers.length)) {
    data = saved.data;
    revision = saved.revision || 0;
    $('projectName').textContent = saved.name || 'Process study';
    $('saveState').textContent = 'Restored from this device';
  }
  renderSheet();
  if (data === saved?.data) {
    for (const id of analysisFields) {
      if (saved.settings?.[id] !== undefined) $(id).value = saved.settings[id];
    }
  }
  if (saved?.settings?.tTest !== undefined) $('tTest').checked = saved.settings.tTest;
  updateSettings();
  renderHistory();
  run();
}

await restoreWorkspace();
