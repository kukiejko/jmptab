import { setupGraphBuilder } from './graph-builder.js';
import { saveSession, loadSession } from './session.js';
import {summary,regression,control,capability,histogram,parseCSV,csvChunks,numeric,chartObservations,MAX_ROWS,MAX_COLUMNS} from './stats.js';
const PLOT_LIMIT = 800;
const $=id=>document.getElementById(id),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=(v,d=3)=>v===null||!Number.isFinite(v)?'—':v.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:Math.abs(v)<100?d:0});
const names={summary:'Descriptive statistics',histogram:'Histogram',regression:'Linear regression',control:'Individuals control chart',capability:'Process capability'};
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
function updateSettings(){const type=$('analysis').value;$('predictorField').hidden=type!=='regression';document.querySelectorAll('.spec').forEach(el=>el.hidden=type!=='capability');}
$('analysis').onchange=updateSettings;
function metrics(items){return'<div class="metrics">'+items.map(([k,v])=>`<div class="metric"><label>${esc(k)}</label><strong>${esc(v)}</strong></div>`).join('')+'</div>';}
function statRows(items){return'<div class="stats-table">'+items.map(([k,v])=>`<div class="stat-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')+'</div>';}
function note(title,text){return`<div class="result-notes"><strong>${esc(title)}</strong>${esc(text)}</div>`;}
function svgChart({points=[],bars=null,lines=[],xLabel='',yLabel='',connect=false,fit=null,bounds=null}){const w=600,h=255,p={l:48,r:66,t:20,b:41};const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);if(bars){xs.push(bars.min,bars.max);ys.push(0,...bars.bins);}lines.forEach(l=>ys.push(l.y));if(bounds){xs.push(bounds.xmin,bounds.xmax);ys.push(bounds.ymin,bounds.ymax);}if(fit){xs.push(fit.xmin,fit.xmax);ys.push(fit.ymin,fit.ymax,fit.intercept+fit.slope*fit.xmin,fit.intercept+fit.slope*fit.xmax);}let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);if(xmin===xmax){xmin-=.5;xmax+=.5;}if(ymin===ymax){ymin-=.5;ymax+=.5;}if(!bars){const d=(ymax-ymin)*.12;ymin-=d;ymax+=d;}else ymax=Math.ceil(ymax/4)*4;const X=x=>p.l+(x-xmin)/(xmax-xmin)*(w-p.l-p.r),Y=y=>h-p.b-(y-ymin)/(ymax-ymin)*(h-p.t-p.b);let body='';for(let i=0;i<=4;i++){const y=ymin+(ymax-ymin)*i/4;body+=`<line x1="${p.l}" y1="${Y(y)}" x2="${w-p.r}" y2="${Y(y)}" stroke="#e7ecf3"/><text x="${p.l-10}" y="${Y(y)+3}" text-anchor="end">${fmt(y,bars?0:2)}</text>`;const x=xmin+(xmax-xmin)*i/4;body+=`<text x="${X(x)}" y="${h-p.b+18}" text-anchor="middle">${fmt(x,1)}</text>`;}if(bars){const bw=(w-p.l-p.r)/bars.bins.length;body+=bars.bins.map((v,i)=>`<rect x="${p.l+i*bw+2}" y="${Y(v)}" width="${Math.max(1,bw-4)}" height="${Y(0)-Y(v)}" fill="#5c89e4" rx="2"><title>${fmt(bars.min+i*bars.width)} – ${fmt(bars.min+(i+1)*bars.width)}: ${v} observations</title></rect>`).join('');}lines.forEach(l=>{body+=`<line x1="${p.l}" x2="${w-p.r}" y1="${Y(l.y)}" y2="${Y(l.y)}" stroke="${l.color||'#9baabd'}" stroke-dasharray="5 4"/><text x="${w-p.r+7}" y="${Y(l.y)+3}">${esc(l.label)}</text>`;});if(connect)body+=`<polyline points="${points.map(p=>`${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="#386ed5" stroke-width="1.5"/>`;if(fit)body+=`<line x1="${X(xmin)}" y1="${Y(fit.intercept+fit.slope*xmin)}" x2="${X(xmax)}" y2="${Y(fit.intercept+fit.slope*xmax)}" stroke="#203f76" stroke-width="2"/>`;body+=points.map(p=>`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.5" fill="${p[2]?'#bf4848':'#3975dc'}" fill-opacity=".8"><title>${fmt(p[0])}, ${fmt(p[1])}${p[2]?' · outside limits':''}</title></circle>`).join('');return`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(yLabel)} by ${esc(xLabel)}"><title>${esc(yLabel)} by ${esc(xLabel)}</title>${body}<text x="${w/2}" y="${h-3}" text-anchor="middle">${esc(xLabel)}</text></svg>`;}
function run(record=true){message('');const type=$('analysis').value,c=+$('response').value,x=+$('predictor').value,values=data.rows.map(r=>r[c]),column=data.headers[c];try{let html='',s,report='';const title=`<div class="result-title"><div><h3>${esc(column)}</h3><p>${esc(names[type])} · Worksheet 1</p></div><span class="badge">${type==='control'||type==='capability'?'Quality analysis':'Statistical analysis'}</span></div>`;if(type==='regression'){if(c===x)throw Error('Choose different response and predictor columns.');s=regression(data.rows.map(r=>r[x]),values,PLOT_LIMIT);html=metrics([['R-squared',s.r2===null?'Undefined':fmt(s.r2*100,2)+'%'],['Slope',fmt(s.slope)],['Observations',s.n]])+`<p class="chart-title">${esc(column)} vs ${esc(data.headers[x])}</p>`+svgChart({points:s.pairs,fit:s,xLabel:data.headers[x],yLabel:column})+note('Fitted equation',`${column} = ${fmt(s.intercept,5)} ${s.slope<0?'−':'+'} ${fmt(Math.abs(s.slope),5)} × ${data.headers[x]}`)+statRows([['Residual standard deviation',fmt(s.residualSD)],['Excluded pairs',data.rows.length-s.n]])+note('Interpretation','Least-squares fit with an intercept. A relationship does not establish causation. Examine residuals and model assumptions before drawing conclusions.');report=JSON.stringify(s,(key,value)=>s.n>PLOT_LIMIT&&(key==='pairs'||key==='values')?undefined:value,2);}else if(type==='control'||type==='capability'){s=type==='control'?control(values):capability(values,numeric($('lsl').value),numeric($('usl').value));html=type==='control'?metrics([['Process mean',fmt(s.mean)],['Within σ',fmt(s.sigma)],['Outside limits',s.signals.length]]):metrics([['Cp',fmt(s.cp)],['Cpk',fmt(s.cpk)],['Outside specs',s.outside]]);html+=`<p class="chart-title">${type==='control'?'Individuals chart':'Observed process and specification limits'}</p>`+svgChart({points:chartObservations(s.values, type==='control'?s.lcl:s.lsl, type==='control'?s.ucl:s.usl, PLOT_LIMIT),connect:true,lines:type==='control'?[{y:s.ucl,label:'UCL',color:'#c67979'},{y:s.mean,label:'Mean',color:'#3d71ce'},{y:s.lcl,label:'LCL',color:'#c67979'}]:[{y:s.usl,label:'USL',color:'#c67979'},{y:s.mean,label:'Mean',color:'#3d71ce'},{y:s.lsl,label:'LSL',color:'#c67979'}],xLabel:'Observation',yLabel:column});html+=type==='control'?note(s.signals.length?'Points outside control limits':'No points outside control limits',s.signals.length?`Review observations ${s.signals.slice(0, 15).map(i=>i+1).join(', ')}${s.signals.length>15?' and '+(s.signals.length-15).toLocaleString('en-US')+' more':''}. Limits are estimated from all observations.`:'This check flags points beyond 3σ only. Other patterns and stability rules have not been tested.')+statRows([['Upper control limit',fmt(s.ucl)],['Lower control limit',fmt(s.lcl)],['Average moving range',fmt(s.mrbar)],['Observations',s.n]]):statRows([['Pp (overall)',fmt(s.pp)],['Ppk (overall)',fmt(s.ppk)],['Within σ (MR̄ / 1.128)',fmt(s.sigma)],['Sample standard deviation',fmt(s.sd)],['Lower specification',fmt(s.lsl)],['Upper specification',fmt(s.usl)]])+note('Capability assumptions','Use capability indices only for a stable, representative process with an appropriate distribution. Cp/Cpk use moving-range σ; Pp/Ppk use overall sample standard deviation.');report=JSON.stringify(s,(key,value)=>s.n>PLOT_LIMIT&&(key==='pairs'||key==='values')?undefined:value,2);}else{s=histogram(values);html=metrics([['Mean',fmt(s.mean)],['Standard deviation',fmt(s.sd)],['Observations',s.n]])+`<p class="chart-title">Distribution of ${esc(column)}</p>`+svgChart({bars:s,xLabel:column,yLabel:'Frequency'})+statRows([['Minimum',fmt(s.min)],['Maximum',fmt(s.max)],['First quartile',fmt(s.q1)],['Third quartile',fmt(s.q3)],['Median',fmt(s.median)],['Standard error',fmt(s.se)],['Variance',fmt(s.variance)],['Missing / nonnumeric',s.missing]])+note('About this analysis',`Sample standard deviation uses n − 1. ${s.missing?'Blank and nonnumeric values are excluded.':'All observations in this column are numeric.'} Histogram bins use the square-root rule.`);report=JSON.stringify(s,(key,value)=>s.n>PLOT_LIMIT&&(key==='pairs'||key==='values')?undefined:value,2);}if(s.n>PLOT_LIMIT&&['regression','control','capability'].includes(type))html+=note('Large dataset','The chart shows a subset of observations. The calculations use all eligible rows. Raw data is available via Export CSV.');lastReport=`mtab — ${names[type]}\nColumn: ${column}\nGenerated: ${new Date().toISOString()}\nWorksheet revision: ${revision}\n\n${report}`;$('results').innerHTML=title+html;$('resultSubtitle').textContent=`${names[type]} · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;if(record){history.unshift({type,column,time:new Date().toISOString(),html:title+html,report:lastReport,revision});history=history.slice(0,20);activeResult=history[0];renderHistory();}$('outputScroll').scrollTop=0;return true;}catch(e){message(e.message);return false;}}
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
$('exportBtn').onclick=()=>download('worksheet.csv',csvChunks(data),'text/csv;charset=utf-8');$('reportBtn').onclick=()=>lastReport?download('mtab-report.txt',lastReport,'text/plain;charset=utf-8'):message('Run an analysis before exporting a report.');$('importBtn').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const next=parseCSV(await file.text());if(unsaved&&!confirm('Replace your unsaved worksheet with this CSV? Export or save first to keep your work.'))return;data=next;page=1;history=[];revision=0;unsaved=true;invalidateReport();renderSheet();renderHistory();$('projectName').textContent=file.name.replace(/\.csv$/i,'');$('saveState').textContent='Unsaved changes';run();}catch(e){message(e.message);}finally{$('file').value='';}};
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
      settings: Object.fromEntries(analysisFields.map(id => [id, $(id).value]))
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
const analysisFields = ['analysis', 'response', 'predictor', 'lsl', 'usl'];
let analysisDraft;

function openAnalysis(type) {
  analysisDraft = analysisFields.map(id => $(id).value);
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
    $('analysisError').hidden = true;
  }
});

$('configureBtn').onclick = () => openAnalysis();
$('closeAnalysis').onclick = $('cancelAnalysis').onclick = () => analysisDialog.close();
analysisDialog.addEventListener('close', () => {
  if (!analysisDraft) return;
  analysisFields.forEach((id, index) => { $(id).value = analysisDraft[index]; });
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

$('helpBtn').onclick = () => $('help').showModal();
$('closeHelp').onclick = () => $('help').close();
function addGraphResult(graph) {
  const html = `<div class="result-title"><div><h3>${esc(graph.title)}</h3><p>${esc(graph.label)} · Worksheet 1</p></div>
    <button data-export-graph>Export SVG</button></div>
    <div class="graph-result-figure">${graph.svg}<p class="muted">${esc(graph.note)}</p></div>`;
  const report = ['mtab — ' + graph.label, graph.title, graph.note, 'Worksheet revision: ' + revision].join('\n');
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
  download('mtab-graph.svg', new XMLSerializer().serializeToString(exportChart), 'image/svg+xml');
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
  updateSettings();
  renderHistory();
  run();
}

await restoreWorkspace();
