import { numeric } from './stats.js';
import { groupedSummary, oneWayAnova } from './group-analysis.js';

const fmt = value => Number.isFinite(value) ? Number(value.toPrecision(5)).toString() : '—';

function renderGroups(result, response, groupName, escape) {
  const rows = result.groups.map(group => `<tr><th>${escape(group.name)}</th><td>${group.n}</td><td>${fmt(group.mean)}</td><td>${fmt(group.sd)}</td><td>${fmt(group.median)}</td><td>${fmt(group.min)}</td><td>${fmt(group.max)}</td></tr>`).join('');
  return `<h4>${escape(response)} by ${escape(groupName)}</h4><div class="rs-table-wrap"><table class="rs-results-table"><thead><tr><th>Group</th><th>N</th><th>Mean</th><th>StDev</th><th>Median</th><th>Min</th><th>Max</th></tr></thead><tbody>${rows}</tbody></table></div><p>${result.excluded} incomplete rows excluded.</p>`;
}

function renderIntervals(result, response, escape) {
  const values = result.groups.flatMap(group => [group.mean - 2*group.sd/Math.sqrt(group.n), group.mean + 2*group.sd/Math.sqrt(group.n)]);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const x = value => 125 + (value-min)/(max-min)*480;
  const lines = result.groups.map((group, index) => {
    const y = 55 + index*36, half = 1.96*group.sd/Math.sqrt(group.n);
    return `<text x="112" y="${y+4}" text-anchor="end">${escape(group.name)}</text><line x1="${x(group.mean-half)}" x2="${x(group.mean+half)}" y1="${y}" y2="${y}" stroke="#285b9c" stroke-width="3"/><circle cx="${x(group.mean)}" cy="${y}" r="5" fill="#285b9c"/>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 700 ${90 + result.groups.length*36}" role="img" aria-label="Mean intervals for ${escape(response)}"><text x="350" y="22" text-anchor="middle">Mean and approximate 95% intervals</text>${lines}<line x1="125" x2="605" y1="${65 + result.groups.length*36}" y2="${65 + result.groups.length*36}" stroke="#445b78"/><text x="125" y="${82 + result.groups.length*36}">${fmt(min)}</text><text x="605" y="${82 + result.groups.length*36}" text-anchor="end">${fmt(max)}</text></svg>`;
}

function renderAnova(result, response, groupName, escape) {
  const comparisonRows = result.comparisons.map(item => `<tr><th>${escape(item.first)} − ${escape(item.second)}</th><td>${fmt(item.difference)}</td><td>${fmt(item.q)}</td><td>${fmt(item.pValue)}</td></tr>`).join('');
  return renderGroups(result, response, groupName, escape) +
    `<h4>One-way ANOVA</h4><div class="rs-table-wrap"><table class="rs-results-table"><thead><tr><th>Source</th><th>DF</th><th>SS</th><th>MS</th><th>F</th><th>P</th></tr></thead><tbody>
    <tr><th>${escape(groupName)}</th><td>${result.dfBetween}</td><td>${fmt(result.betweenSS)}</td><td>${fmt(result.msBetween)}</td><td>${fmt(result.f)}</td><td>${fmt(result.pValue)}</td></tr>
    <tr><th>Error</th><td>${result.dfWithin}</td><td>${fmt(result.withinSS)}</td><td>${fmt(result.msWithin)}</td><td></td><td></td></tr></tbody></table></div>
    <h4>Tukey pairwise comparisons</h4><div class="rs-table-wrap"><table class="rs-results-table"><thead><tr><th>Groups</th><th>Difference</th><th>Q</th><th>Adjusted P</th></tr></thead><tbody>${comparisonRows}</tbody></table></div>
    <p>ANOVA assumes independent observations, approximately normal residuals, and similar group variances.</p>${renderIntervals(result, response, escape)}`;
}

export function setupGroupAnalysisDialog({ getData, onCreate, escape }) {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="groupAnalysisDialog" class="response-surface-dialog" aria-labelledby="gaTitle"><header class="dialog-heading"><h2 id="gaTitle">One-Way ANOVA</h2><button type="button" id="gaClose">×</button></header><div class="rs-content"><section class="rs-source"><h3>Columns</h3><div id="gaVariables"></div></section><section class="rs-targets"><label>Response<select id="gaResponse"></select></label><label>Factor / By variable<select id="gaGroup"></select></label><p id="gaError" role="alert" hidden></p></section></div><footer class="dialog-actions"><button type="button" id="gaCancel">Cancel</button><button type="button" id="gaGenerate" class="primary">OK</button></footer></dialog>`);
  const $ = id => document.getElementById(id);
  const dialog = $('groupAnalysisDialog');
  let mode, data, focused = $('gaResponse');
  const fields = [$('gaResponse'), $('gaGroup')];
  function open(nextMode) {
    mode = nextMode;
    data = getData();
    $('gaTitle').textContent = mode === 'anova' ? 'One-Way ANOVA' : 'Descriptive Statistics by Group';
    const columns = data.headers.map((name, index) => `<option value="${index}">C${index+1} ${escape(name)}</option>`).join('');
    fields.forEach(field => { field.innerHTML = `<option value="">Select a column</option>${columns}`; });
    $('gaVariables').innerHTML = data.headers.map((name, index) => `<button type="button" data-column="${index}">C${index+1} ${escape(name)}</button>`).join('');
    $('gaError').hidden = true;
    focused = fields[0];
    dialog.showModal();
  }
  fields.forEach(field => field.addEventListener('focus', () => { focused = field; }));
  $('gaVariables').addEventListener('dblclick', event => {
    const button = event.target.closest('[data-column]');
    if (!button) return;
    focused.value = button.dataset.column;
    focused = focused === fields[0] ? fields[1] : fields[0];
  });
  $('gaClose').onclick = $('gaCancel').onclick = () => dialog.close();
  $('gaGenerate').onclick = () => {
    try {
      const responseIndex = Number($('gaResponse').value), groupIndex = Number($('gaGroup').value);
      if (!$('gaResponse').value || !$('gaGroup').value) throw Error('Select response and factor columns.');
      const result = mode === 'anova' ? oneWayAnova(data.rows, responseIndex, groupIndex) : groupedSummary(data.rows, responseIndex, groupIndex);
      const response = data.headers[responseIndex], group = data.headers[groupIndex];
      const label = mode === 'anova' ? 'One-Way ANOVA' : 'Descriptive statistics by group';
      const svg = mode === 'anova' ? renderAnova(result, response, group, escape) : renderGroups(result, response, group, escape);
      onCreate({ title: `${label}: ${response} by ${group}`, label, type: mode, column: responseIndex, svg,
        note: `${result.groups.length} groups · ${result.excluded} incomplete rows excluded${mode === 'anova' ? ' · ANOVA p = ' + fmt(result.pValue) : ''}` });
      dialog.close();
    } catch (error) { $('gaError').textContent = error.message; $('gaError').hidden = false; }
  };
  return open;
}
