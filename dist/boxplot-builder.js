import { numeric } from './stats.js';
import { buildBoxplot, drawBoxplot } from './builder-boxplot.js';

const layouts = [
  ['one-simple', 'One Y · Simple', 'One numeric column', '<rect x="30" y="25" width="24" height="40"/><line x1="42" y1="15" x2="42" y2="25"/><line x1="42" y1="65" x2="42" y2="76"/>'],
  ['one-groups', 'One Y · With Groups', 'One Y, categorical groups', '<rect x="16" y="32" width="18" height="32"/><rect x="56" y="22" width="18" height="42"/><line x1="25" y1="17" x2="25" y2="32"/><line x1="65" y1="12" x2="65" y2="22"/>'],
  ['multiple-simple', 'Multiple Ys · Simple', 'Compare numeric columns', '<rect x="12" y="33" width="16" height="29"/><rect x="39" y="23" width="16" height="39"/><rect x="66" y="29" width="16" height="33"/>'],
  ['multiple-groups', 'Multiple Ys · With Groups', 'Several Ys in groups', '<rect x="8" y="33" width="13" height="26"/><rect x="25" y="24" width="13" height="35"/><rect x="51" y="28" width="13" height="31"/><rect x="68" y="18" width="13" height="41"/>']
];
const viewFields = [
  ['box', 'Interquartile range box (IQR)', true], ['outliers', 'Outlier symbols', true],
  ['whiskers', 'Whiskers', true], ['mean', 'Mean symbol', false],
  ['median', 'Median symbol', true], ['medianLine', 'Median connect line', false],
  ['meanLine', 'Mean connect line', false], ['points', 'Individual data symbols (jitter)', false],
  ['confidence', '95% confidence interval box for median', false]
];
const $ = id => document.getElementById(id);

export function setupBoxplotBuilder({ getData, onCreate, escape }) {
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="boxplotBuilder" class="boxplot-builder" aria-labelledby="bpTitle">
      <header class="bp-heading"><h2 id="bpTitle">Boxplot</h2><button type="button" id="bpClose" aria-label="Close boxplot">×</button></header>
      <section id="bpLayouts" class="bp-layout-screen" aria-label="Choose data structure">
        <h3>Choose data structure</h3><div class="bp-layout-grid">${layouts.map(([id, title, detail, shape]) =>
          `<button type="button" data-bp-layout="${id}"><svg viewBox="0 0 90 90" aria-hidden="true">${shape}</svg><strong>${title}</strong><span>${detail}</span></button>`).join('')}</div>
      </section>
      <section id="bpConfig" class="bp-config" hidden>
        <div class="bp-config-main"><aside class="bp-variables"><h3>Variables</h3><div id="bpColumnList" class="bp-column-list"></div><p>Drag columns to a field or select them from the lists.</p></aside>
          <div class="bp-fields"><button type="button" id="bpBack">← Change graph type</button><strong id="bpLayoutName"></strong>
            <label for="bpY">Graph variables (Y)</label><select id="bpY" multiple size="6" aria-label="Graph variables Y"></select>
            <label for="bpGroups" id="bpGroupsLabel">Categorical variables for grouping (X), 1–4</label><select id="bpGroups" multiple size="5" aria-label="Categorical variables for grouping"></select>
            <small class="bp-selection-hint">Use Ctrl or Command to select multiple columns.</small>
            <p id="bpValidation" role="status"></p>
            <div class="bp-settings-buttons"><button type="button" data-bp-settings="Scale">Scale...</button><button type="button" data-bp-settings="Labels">Labels...</button><button type="button" data-bp-settings="Data View">Data View...</button><button type="button" data-bp-settings="Multiple Graphs">Multiple Graphs...</button><button type="button" data-bp-settings="Data Options">Data Options...</button></div>
          </div>
        </div><div id="bpPreview" class="bp-preview" aria-live="polite"></div>
      </section>
      <footer class="bp-footer"><button type="button" id="bpHelp" title="Help for selected layout">? Help</button><span id="bpStatus" role="status">Choose a graph type.</span><button type="button" id="bpCancel">Cancel</button><button type="button" id="bpGenerate" disabled>Generate</button></footer>
    </dialog>
    <dialog id="bpScaleDialog" class="bp-setting-dialog" aria-label="Scale settings"><h3>Scale</h3>
      <label><input id="bpAxes" type="checkbox" checked> Show axes</label><label><input id="bpTicks" type="checkbox" checked> Show ticks and labels</label><label><input id="bpTranspose" type="checkbox"> Transpose value and category scales</label>
      <label for="bpScaleType">Value scale</label><select id="bpScaleType"><option value="linear">Linear</option><option value="log10">Log 10</option><option value="ln">Ln</option></select>
      <label for="bpReference">Reference lines (comma-separated values)</label><input id="bpReference" placeholder="e.g. 9.5, 10.5"><footer><button type="button" data-bp-close>OK</button></footer></dialog>
    <dialog id="bpLabelsDialog" class="bp-setting-dialog" aria-label="Labels settings"><h3>Labels</h3>
      <label for="bpLabelTitle">Title</label><input id="bpLabelTitle" maxlength="120"><label for="bpSubtitle">Subtitle</label><input id="bpSubtitle" maxlength="160"><label for="bpFootnote">Footnote</label><input id="bpFootnote" maxlength="240"><label><input id="bpValueLabels" type="checkbox"> Show median values on graph</label><footer><button type="button" data-bp-close>OK</button></footer></dialog>
    <dialog id="bpViewDialog" class="bp-setting-dialog" aria-label="Data View settings"><h3>Data View</h3><div class="bp-view-fields">${viewFields.map(([id, title, checked]) => `<label><input type="checkbox" data-bp-view="${id}"${checked ? ' checked' : ''}> ${title}</label>`).join('')}</div><footer><button type="button" data-bp-close>OK</button></footer></dialog>
    <dialog id="bpMultipleDialog" class="bp-setting-dialog" aria-label="Multiple Graphs settings"><h3>Multiple Graphs</h3><p>Split the graph into a panel for each category.</p><label for="bpPanel">Panel variable</label><select id="bpPanel"></select><footer><button type="button" data-bp-close>OK</button></footer></dialog>
    <dialog id="bpOptionsDialog" class="bp-setting-dialog" aria-label="Data Options settings"><h3>Data Options</h3><p>Filter rows for this graph without changing the worksheet.</p><label for="bpFilterColumn">Numeric column</label><select id="bpFilterColumn"></select><label for="bpFilterOperator">Rule</label><select id="bpFilterOperator"><option value=">">&gt;</option><option value=">=">≥</option><option value="<">&lt;</option><option value="<=">≤</option><option value="=">=</option></select><label for="bpFilterValue">Value</label><input id="bpFilterValue" type="number" step="any" value="0"><footer><button type="button" data-bp-close>OK</button></footer></dialog>
    <dialog id="bpHelpDialog" class="bp-setting-dialog" aria-label="Boxplot help"><h3>Boxplot help</h3><p id="bpHelpText"></p><p>Whiskers stop at the most extreme values within Q1 − 1.5 × IQR and Q3 + 1.5 × IQR. Points beyond are outliers. The confidence box uses median ± 1.57 × IQR / √N, clipped to the IQR box.</p><footer><button type="button" data-bp-close>Close</button></footer></dialog>
    <div id="bpTooltip" class="bp-tooltip" role="tooltip" hidden></div>`);

  const dialog = $('boxplotBuilder');
  const subdialogs = {
    'Scale': $('bpScaleDialog'), 'Labels': $('bpLabelsDialog'), 'Data View': $('bpViewDialog'),
    'Multiple Graphs': $('bpMultipleDialog'), 'Data Options': $('bpOptionsDialog')
  };
  let data;
  let layout;
  let preview;
  let lastError = '';
  const selected = field => [...field.selectedOptions].map(option => Number(option.value));
  const numericColumns = () => data.headers.map((_, index) => index).filter(index => data.rows.some(row => numeric(row[index]) !== null));
  const options = () => ({
    layout, yColumns: selected($('bpY')), groupColumns: layout.endsWith('groups') ? selected($('bpGroups')) : [],
    panelColumn: $('bpPanel').value === '' ? null : Number($('bpPanel').value),
    filter: $('bpFilterColumn').value === '' ? null : { column: Number($('bpFilterColumn').value), operator: $('bpFilterOperator').value, value: $('bpFilterValue').value },
    scaleType: $('bpScaleType').value,
    scale: { showAxes: $('bpAxes').checked, showTicks: $('bpTicks').checked, transpose: $('bpTranspose').checked,
      type: $('bpScaleType').value, referenceLines: $('bpReference').value.split(',').map(value => value.trim()).filter(Boolean).map(Number) },
    labels: { title: $('bpLabelTitle').value.trim(), subtitle: $('bpSubtitle').value.trim(), footnote: $('bpFootnote').value.trim(), showValues: $('bpValueLabels').checked },
    view: Object.fromEntries([...dialog.ownerDocument.querySelectorAll('[data-bp-view]')].map(input => [input.dataset.bpView, input.checked]))
  });

  function validate() {
    if (!layout) return 'Choose a graph type.';
    const ys = selected($('bpY'));
    const groups = layout.endsWith('groups') ? selected($('bpGroups')) : [];
    if (!ys.length || (layout.startsWith('one') && ys.length !== 1)) return layout.startsWith('one') ? 'Choose exactly one numeric Y column.' : 'Choose one or more numeric Y columns.';
    if (layout.endsWith('groups') && (groups.length < 1 || groups.length > 4)) return 'Choose 1 to 4 categorical grouping columns.';
    if (groups.some(index => ys.includes(index))) return 'Y and grouping columns must be different.';
    const panel = $('bpPanel').value;
    if (panel !== '' && [...ys, ...groups].includes(Number(panel))) return 'Choose a separate panel column.';
    if ($('bpFilterColumn').value !== '' && $('bpFilterValue').value === '') return 'Enter a numeric filter value.';
    if ($('bpReference').value.split(',').map(value => value.trim()).filter(Boolean).some(value => !Number.isFinite(Number(value)))) return 'Reference lines must be numeric.';
    return '';
  }

  function render() {
    $('bpLayouts').hidden = Boolean(layout);
    $('bpConfig').hidden = !layout;
    if (!layout) { $('bpGenerate').disabled = true; $('bpStatus').textContent = 'Choose a graph type.'; return; }
    $('bpLayoutName').textContent = layouts.find(item => item[0] === layout)[1];
    $('bpGroups').disabled = !layout.endsWith('groups');
    $('bpGroupsLabel').classList.toggle('bp-disabled', !layout.endsWith('groups'));
    const error = validate();
    $('bpValidation').textContent = error;
    $('bpGenerate').disabled = Boolean(error);
    $('bpStatus').textContent = error || 'Ready to generate.';
    $('bpColumnList').querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(selected($('bpY')).includes(Number(button.dataset.bpColumn))));
    });
    preview = null;
    if (error) { $('bpPreview').innerHTML = '<p>Select variables to preview the boxplot.</p>'; return; }
    try {
      const settings = options();
      const result = buildBoxplot(data, settings);
      const svg = drawBoxplot(result, settings, escape);
      const title = settings.labels.title || 'Boxplot';
      preview = { title, svg, note: `${result.boxCount} boxes · ${result.observations.toLocaleString('en-US')} observations`,
        type: 'box', label: 'Boxplot', column: settings.yColumns.map(index => data.headers[index]).join(', ') };
      $('bpPreview').innerHTML = `<h3>${escape(title)}</h3>${settings.labels.subtitle ? `<p>${escape(settings.labels.subtitle)}</p>` : ''}${svg}${settings.labels.footnote ? `<p>${escape(settings.labels.footnote)}</p>` : ''}`;
      preview.svg = `${settings.labels.subtitle ? `<p>${escape(settings.labels.subtitle)}</p>` : ''}${svg}${settings.labels.footnote ? `<p>${escape(settings.labels.footnote)}</p>` : ''}`;
      $('bpValidation').textContent = '';
      $('bpStatus').textContent = preview.note;
      $('bpGenerate').disabled = false;
      lastError = '';
    } catch (failure) {
      lastError = failure.message;
      $('bpPreview').innerHTML = `<p>${escape(lastError)}</p>`;
      $('bpStatus').textContent = lastError;
      $('bpGenerate').disabled = true;
    }
  }

  function open() {
    data = getData();
    layout = null;
    preview = null;
    const numericIndices = new Set(numericColumns());
    const optionsHtml = indices => indices.map(index => `<option value="${index}">C${index + 1} · ${escape(data.headers[index])}</option>`).join('');
    $('bpY').innerHTML = optionsHtml([...numericIndices]);
    $('bpGroups').innerHTML = optionsHtml(data.headers.map((_, index) => index));
    $('bpPanel').innerHTML = '<option value="">No panels</option>' + optionsHtml(data.headers.map((_, index) => index));
    $('bpFilterColumn').innerHTML = '<option value="">No filter</option>' + optionsHtml([...numericIndices]);
    $('bpColumnList').innerHTML = data.headers.map((name, index) => `<button type="button" draggable="true" data-bp-column="${index}"><span aria-hidden="true">${numericIndices.has(index) ? '∑' : 'Aa'}</span><span>C${index + 1} · ${escape(name)}</span></button>`).join('');
    $('bpY').selectedIndex = -1;
    $('bpGroups').selectedIndex = -1;
    $('bpPanel').value = '';
    $('bpFilterColumn').value = '';
    for (const id of ['bpLabelTitle', 'bpSubtitle', 'bpFootnote', 'bpReference']) $(id).value = '';
    $('bpScaleType').value = 'linear';
    $('bpFilterValue').value = '0';
    for (const [id, , checked] of viewFields) dialog.ownerDocument.querySelector(`[data-bp-view="${id}"]`).checked = checked;
    for (const id of ['bpAxes', 'bpTicks']) $(id).checked = true;
    for (const id of ['bpTranspose', 'bpValueLabels']) $(id).checked = false;
    render();
    dialog.showModal();
  }

  dialog.addEventListener('click', event => {
    const tile = event.target.closest('[data-bp-layout]');
    if (tile) { layout = tile.dataset.bpLayout; $('bpY').selectedIndex = -1; $('bpGroups').selectedIndex = -1; render(); return; }
    const column = event.target.closest('[data-bp-column]');
    if (column) {
      const target = $('bpY').querySelector(`option[value="${column.dataset.bpColumn}"]`);
      if (target) {
        if (layout?.startsWith('one')) $('bpY').value = target.value;
        else target.selected = !target.selected;
        render();
      }
    }
    const settings = event.target.closest('[data-bp-settings]');
    if (settings) subdialogs[settings.dataset.bpSettings].showModal();
  });
  $('bpBack').onclick = () => { layout = null; render(); };
  $('bpClose').onclick = $('bpCancel').onclick = () => dialog.close();
  $('bpGenerate').onclick = () => { if (preview && !validate()) { onCreate(preview); dialog.close(); } };
  $('bpHelp').onclick = () => {
    $('bpHelpText').textContent = layout ? layouts.find(item => item[0] === layout)[1] + ': ' + layouts.find(item => item[0] === layout)[2] + '.' : 'Choose one of four boxplot layouts.';
    $('bpHelpDialog').showModal();
  };
  for (const subdialog of [...Object.values(subdialogs), $('bpHelpDialog')]) {
    subdialog.querySelector('[data-bp-close]').onclick = () => subdialog.close();
    subdialog.addEventListener('close', render);
    subdialog.addEventListener('change', render);
    subdialog.addEventListener('input', render);
  }
  for (const field of [$('bpY'), $('bpGroups')]) {
    field.addEventListener('change', render);
    field.addEventListener('dragover', event => event.preventDefault());
    field.addEventListener('drop', event => {
      event.preventDefault();
      const index = Number(event.dataTransfer.getData('text/plain'));
      if (!Number.isInteger(index) || index < 0 || index >= data.headers.length) return;
      const option = field.querySelector(`option[value="${index}"]`);
      if (!option) return;
      if (field === $('bpY') && layout.startsWith('one')) field.value = String(index);
      else option.selected = true;
      render();
    });
  }
  $('bpColumnList').addEventListener('dragstart', event => {
    const button = event.target.closest('[data-bp-column]');
    if (button) event.dataTransfer.setData('text/plain', button.dataset.bpColumn);
  });
  const tooltip = $('bpTooltip');
  const showTooltip = (target, x, y) => {
    if (!target) { tooltip.hidden = true; return; }
    tooltip.textContent = target.dataset.boxTooltip;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(8, Math.min(x + 12, innerWidth - tooltip.offsetWidth - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(y + 12, innerHeight - tooltip.offsetHeight - 8))}px`;
  };
  document.addEventListener('pointermove', event => showTooltip(event.target.closest('[data-box-tooltip]'), event.clientX, event.clientY));
  document.addEventListener('focusin', event => {
    const target = event.target.closest('[data-box-tooltip]');
    if (target) { const rect = target.getBoundingClientRect(); showTooltip(target, rect.left, rect.top); }
  });
  document.addEventListener('focusout', event => { if (event.target.closest('[data-box-tooltip]')) tooltip.hidden = true; });
  dialog.addEventListener('close', () => { tooltip.hidden = true; preview = null; data = undefined; });
  return open;
}
