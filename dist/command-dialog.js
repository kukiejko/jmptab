import { parseCommands } from './command-script.js';

export function setupCommandDialog({ getHistory, onRun, download, escape }) {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="commandDialog" class="response-surface-dialog" aria-labelledby="cdTitle"><header class="dialog-heading"><h2 id="cdTitle">Command Line / History</h2><button type="button" id="cdClose">×</button></header><div class="analysis-bar"><p>Recorded analysis commands. Select one to copy it to the editor, or run several lines in order.</p><div id="cdHistory" class="cd-history"></div><label class="field">Command line<textarea id="cdText" rows="6" spellcheck="false" placeholder="RUN summary RESPONSE C1 PREDICTOR C2 OPTIONS {}"></textarea></label><p id="cdError" role="alert" hidden></p></div><footer class="dialog-actions"><button type="button" id="cdImport">Open .jmt…</button><button type="button" id="cdExport">Save .jmt</button><button type="button" id="cdRun" class="primary">Run</button></footer><input id="cdFile" type="file" accept=".jmt,text/plain" hidden></dialog>`);
  const $ = id => document.getElementById(id), dialog = $('commandDialog');
  function open() {
    $('cdHistory').innerHTML = getHistory().filter(item => item.command).map(item => `<button type="button" data-command="${escape(item.command)}">${escape(item.sheetName)} · ${escape(item.command)}</button>`).join('') || '<p>No analysis commands yet.</p>';
    $('cdError').hidden = true;
    dialog.showModal();
  }
  $('cdHistory').onclick = event => {
    const button = event.target.closest('[data-command]');
    if (button) $('cdText').value = button.dataset.command;
  };
  $('cdClose').onclick = () => dialog.close();
  $('cdRun').onclick = () => {
    try { for (const command of parseCommands($('cdText').value)) onRun(command); $('cdError').hidden = true; dialog.close(); }
    catch (error) { $('cdError').textContent = error.message; $('cdError').hidden = false; }
  };
  $('cdExport').onclick = () => download('jmptab-analyses.jmt', $('cdText').value || getHistory().filter(item => item.command).reverse().map(item => item.command).join('\n'), 'text/plain;charset=utf-8');
  $('cdImport').onclick = () => $('cdFile').click();
  $('cdFile').onchange = async event => { const file = event.target.files[0]; if (!file) return; try { const text = await file.text(); parseCommands(text); $('cdText').value = text; } catch(error) { $('cdError').textContent = error.message; $('cdError').hidden = false; } finally { $('cdFile').value = ''; } };
  return open;
}
