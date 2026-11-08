import { numeric } from './stats.js';
import { fitResponseSurface } from './response-surface.js';
import { drawContourPlot, drawSurfacePlot } from './response-surface-render.js';

export function setupResponseSurfaceDialog({ getData, onCreate, escape }) {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="responseSurfaceDialog" class="response-surface-dialog" aria-labelledby="rsTitle">
    <header class="dialog-heading"><h2 id="rsTitle">Contour Plot</h2><button type="button" id="rsClose" aria-label="Close">×</button></header>
    <div class="rs-content"><section class="rs-source"><h3>Variables</h3><div id="rsVariables" role="listbox" aria-label="Worksheet variables"></div><p>Double-click a variable to fill the focused field.</p></section>
      <section class="rs-targets"><label>Response (Z)<select id="rsResponse" aria-label="Response Z"></select></label><label>X variable<select id="rsX" aria-label="X variable"></select></label><label>Y variable<select id="rsY" aria-label="Y variable"></select></label>
        <button type="button" id="rsSettings">Settings…</button><p id="rsError" role="alert" hidden></p></section></div>
    <footer class="dialog-actions"><button type="button" id="rsCancel">Cancel</button><button type="button" class="primary" id="rsGenerate">OK</button></footer></dialog>
    <dialog id="rsSettingsDialog" class="response-surface-settings" aria-labelledby="rsSettingsTitle"><header class="dialog-heading"><h2 id="rsSettingsTitle">Fixed factors</h2></header><p>Hold additional numeric factors at these values while drawing the X–Y surface.</p><div id="rsFactors"></div><footer class="dialog-actions"><button type="button" id="rsSettingsClose" class="primary">OK</button></footer></dialog>`);
  const $ = id => document.getElementById(id);
  const dialog = $('responseSurfaceDialog'), settings = $('rsSettingsDialog');
  let kind = 'contour', data, focused = $('rsResponse');
  const fields = [$('rsResponse'), $('rsX'), $('rsY')];
  const numericColumns = () => {
    const found = new Set();
    for (const row of data.rows) for (const key of Object.keys(row)) {
      const index = Number(key);
      if (index < data.headers.length && numeric(row[index]) !== null) found.add(index);
    }
    return [...found].sort((a, b) => a - b);
  };
  function updateFactors() {
    const selected = new Set(fields.map(field => field.value));
    $('rsFactors').querySelectorAll('.rs-factor').forEach(item => { item.hidden = selected.has(item.dataset.column); if (item.hidden) item.querySelector('input[type=checkbox]').checked = false; });
  }
  function open(type) {
    kind = type;
    data = getData();
    $('rsTitle').textContent = `${type === 'contour' ? 'Contour' : 'Surface'} Plot`;
    const columns = numericColumns();
    $('rsVariables').innerHTML = columns.map(index => `<button type="button" data-column="${index}">C${index+1}  ${escape(data.headers[index])}</button>`).join('');
    for (const field of fields) field.innerHTML = `<option value="">Select a variable</option>${columns.map(index => `<option value="${index}">C${index+1}  ${escape(data.headers[index])}</option>`).join('')}`;
    $('rsFactors').innerHTML = columns.map(index => {
      let sum = 0, count = 0;
      for (const row of data.rows) { const value = numeric(row[index]); if (value !== null) { sum += value; count++; } }
      return `<label class="rs-factor" data-column="${index}"><input type="checkbox"> C${index+1} ${escape(data.headers[index])}<input type="number" step="any" value="${count ? sum / count : 0}" aria-label="Fixed value for ${escape(data.headers[index])}"></label>`;
    }).join('');
    $('rsError').hidden = true;
    focused = fields[0];
    updateFactors();
    dialog.showModal();
  }
  fields.forEach(field => { field.addEventListener('focus', () => { focused = field; }); field.addEventListener('change', updateFactors); });
  $('rsVariables').addEventListener('dblclick', event => {
    const button = event.target.closest('[data-column]');
    if (!button) return;
    const target = focused.value ? fields.find(field => !field.value) || focused : focused;
    target.value = button.dataset.column;
    focused = fields[(fields.indexOf(target) + 1) % fields.length];
    updateFactors();
  });
  $('rsSettings').onclick = () => { updateFactors(); settings.showModal(); };
  $('rsSettingsClose').onclick = () => settings.close();
  $('rsClose').onclick = $('rsCancel').onclick = () => dialog.close();
  $('rsGenerate').onclick = () => {
    try {
      const [responseColumn, xColumn, yColumn] = fields.map(field => field.value === '' ? null : Number(field.value));
      const fixedFactors = [...$('rsFactors').querySelectorAll('.rs-factor')].filter(item => !item.hidden && item.querySelector('input[type=checkbox]').checked)
        .map(item => ({ column: Number(item.dataset.column), value: item.querySelector('input[type=number]').value }));
      const model = fitResponseSurface(data, { responseColumn, xColumn, yColumn, fixedFactors });
      const isSurface = kind === 'surface';
      const label = isSurface ? 'Surface Plot' : 'Contour Plot';
      const title = `${label} of ${data.headers[responseColumn]}`;
      const note = `Quadratic fit · ${model.observations} complete rows · R² ${model.rSquared.toFixed(3)}${fixedFactors.length ? ' · Fixed: ' + fixedFactors.map(factor => `${data.headers[factor.column]} = ${factor.value}`).join(', ') : ''}`;
      onCreate({ type: kind, label, title, note, column: responseColumn, svg: isSurface ? drawSurfacePlot(model, data) : drawContourPlot(model, data), surface: isSurface ? { model, data } : null });
      dialog.close();
    } catch (error) { $('rsError').textContent = error.message; $('rsError').hidden = false; }
  };
  return open;
}

export function attachSurfaceRotation(container, result) {
  if (!result.surface) return;
  const figure = container.querySelector('.graph-result-figure');
  const toolbar = document.createElement('div');
  toolbar.className = 'rs-rotation-toolbar';
  toolbar.innerHTML = '<strong>Rotate surface</strong><span>Drag the plot to rotate X/Y · Shift+drag for Z</span><button type="button">Reset view</button>';
  figure.prepend(toolbar);
  const rotation = { yaw: -35, pitch: 30, roll: 0 };
  const draw = () => { const svg = figure.querySelector('svg'); svg.outerHTML = drawSurfacePlot(result.surface.model, result.surface.data, rotation); };
  toolbar.querySelector('button').onclick = () => { Object.assign(rotation, { yaw: -35, pitch: 30, roll: 0 }); draw(); };
  let last = null;
  figure.addEventListener('pointerdown', event => { if (!event.target.closest('svg')) return; last = { x: event.clientX, y: event.clientY }; figure.setPointerCapture(event.pointerId); });
  figure.addEventListener('pointermove', event => {
    if (!last) return;
    const dx = event.clientX - last.x, dy = event.clientY - last.y;
    if (event.shiftKey) rotation.roll += dx * .5;
    else { rotation.yaw += dx * .45; rotation.pitch = Math.max(-85, Math.min(85, rotation.pitch + dy * .45)); }
    last = { x: event.clientX, y: event.clientY };
    draw();
  });
  const stop = () => { last = null; };
  figure.addEventListener('pointerup', stop);
  figure.addEventListener('pointercancel', stop);
}
