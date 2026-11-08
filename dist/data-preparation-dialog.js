import { stackWorksheets, recodeColumn, assignFormula } from './data-preparation.js';

export function setupDataPreparationDialog({ getWorksheets, getActiveIndex, onStack, onChange, escape }) {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="dataPrepDialog" class="response-surface-dialog" aria-labelledby="dpTitle"><header class="dialog-heading"><h2 id="dpTitle">Prepare Data</h2><button type="button" id="dpClose">×</button></header>
    <div class="analysis-bar"><div id="dpStack" hidden><p>Select worksheets to stack by matching column names. The result opens in a new worksheet.</p><div id="dpSheets" class="gl-graph-list"></div><label class="field">New worksheet name<input id="dpStackName" maxlength="50" value="Combined data"></label><label><input id="dpSource" type="checkbox" checked> Include source worksheet column</label></div>
      <div id="dpRecode" hidden><label class="field">Column<select id="dpRecodeColumn"></select></label><label class="field">Replacements, one per line: old =&gt; new<textarea id="dpMappings" rows="6" placeholder="Eastern.MTW => Eastern"></textarea></label><label class="field">New column name (leave blank to replace original)<input id="dpRecodeName"></label></div>
      <div id="dpFormula" hidden><label class="field">Store result in column<select id="dpFormulaTarget"></select></label><label class="field">Expression<input id="dpExpression" placeholder="Arrival - Order"></label><p>Use column names and +, −, ×, or ÷. Put spaces around the operator. Subtracting dates returns days.</p></div><p id="dpError" role="alert" hidden></p></div>
    <footer class="dialog-actions"><button type="button" id="dpCancel">Cancel</button><button type="button" id="dpApply" class="primary">OK</button></footer></dialog>`);
  const $ = id => document.getElementById(id);
  const dialog = $('dataPrepDialog');
  let mode;
  function open(next) {
    mode = next;
    const sheets = getWorksheets(), active = sheets[getActiveIndex()];
    $('dpTitle').textContent = ({ stack: 'Stack Worksheets', recode: 'Recode to Text', formula: 'Assign Column Formula' })[mode];
    for (const name of ['Stack','Recode','Formula']) $('dp'+name).hidden = name.toLowerCase() !== mode;
    $('dpError').hidden = true;
    if (mode === 'stack') {
      $('dpSheets').innerHTML = sheets.map((sheet, index) => `<label><input type="checkbox" value="${index}"> ${escape(sheet.name)} · ${sheet.data.rows.length} rows</label>`).join('');
    } else {
      const columns = active.data.headers.map((name, index) => `<option value="${index}">C${index+1} ${escape(name)}</option>`).join('');
      $('dpRecodeColumn').innerHTML = columns;
      $('dpFormulaTarget').innerHTML = columns;
    }
    dialog.showModal();
  }
  $('dpClose').onclick = $('dpCancel').onclick = () => dialog.close();
  $('dpApply').onclick = () => {
    try {
      const sheets = getWorksheets(), active = sheets[getActiveIndex()];
      if (mode === 'stack') {
        const indices = [...$('dpSheets').querySelectorAll('input:checked')].map(input => Number(input.value));
        onStack(stackWorksheets(sheets, indices, $('dpStackName').value, $('dpSource').checked));
      } else if (mode === 'recode') {
        const mappings = $('dpMappings').value.split(/\r?\n/).filter(line => line.trim()).map(line => {
          const separator = line.indexOf('=>');
          if (separator < 0) throw Error('Each replacement must use old => new.');
          return { from: line.slice(0,separator).trim(), to: line.slice(separator+2).trim() };
        });
        onChange(recodeColumn(active.data, Number($('dpRecodeColumn').value), mappings, $('dpRecodeName').value.trim() || null));
      } else {
        assignFormula(active, active.data.headers[Number($('dpFormulaTarget').value)], $('dpExpression').value);
        onChange(active.data);
      }
      dialog.close();
    } catch (error) { $('dpError').textContent = error.message; $('dpError').hidden = false; }
  };
  return open;
}
