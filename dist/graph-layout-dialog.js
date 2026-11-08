export function setupGraphLayoutDialog({ getResults, onCreate, escape }) {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="graphLayoutDialog" class="response-surface-dialog" aria-labelledby="glTitle"><header class="dialog-heading"><h2 id="glTitle">Graph Layout</h2><button type="button" id="glClose">×</button></header><div class="analysis-bar"><label class="field">Layout title<input id="glName" maxlength="120" value="Graphical analysis"></label><label class="field">Columns<select id="glColumns"><option value="1">1 column</option><option value="2" selected>2 columns</option><option value="3">3 columns</option></select></label><p>Select two or more graphs from the current session:</p><div id="glGraphList" class="gl-graph-list"></div><p id="glError" role="alert" hidden></p></div><footer class="dialog-actions"><button type="button" id="glCancel">Cancel</button><button type="button" id="glCreate" class="primary">Create layout</button></footer></dialog>`);
  const $ = id => document.getElementById(id);
  const dialog = $('graphLayoutDialog');
  let candidates = [];
  function open() {
    candidates = getResults().filter(result => result.html.includes('<svg'));
    $('glGraphList').innerHTML = candidates.map((result, index) => `<label><input type="checkbox" value="${index}"> ${escape(result.label || result.type)} · ${escape(result.column || '')} · ${escape(result.sheetName || '')}</label>`).join('') || '<p>Run a graph first.</p>';
    $('glError').hidden = true;
    dialog.showModal();
  }
  $('glClose').onclick = $('glCancel').onclick = () => dialog.close();
  $('glCreate').onclick = () => {
    const selected = [...$('glGraphList').querySelectorAll('input:checked')].map(input => candidates[Number(input.value)]);
    if (selected.length < 2) { $('glError').textContent = 'Select at least two graphs.'; $('glError').hidden = false; return; }
    const columns = Number($('glColumns').value);
    const charts = selected.flatMap(result => {
      const holder = document.createElement('div');
      holder.innerHTML = result.html;
      return [...holder.querySelectorAll('svg.chart')].map(svg => ({ svg: svg.outerHTML, label: result.label || 'Graph' }));
    });
    const title = $('glName').value.trim() || 'Graphical analysis';
    onCreate({ title, label: 'Graph Layout', type: 'graph-layout', column: `${selected.length} graphs`, note: `${selected.length} session results arranged in ${columns} columns`,
      svg: `<div class="graph-layout-grid" style="--graph-layout-columns:${columns}">${charts.map(chart => `<section><strong>${escape(chart.label)}</strong>${chart.svg}</section>`).join('')}</div>` });
    dialog.close();
  };
  return open;
}
