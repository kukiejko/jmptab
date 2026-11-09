import { decodeCsvBuffer, parseCsvImport } from './csv-import.js';

const $ = id => document.getElementById(id);

export function setupCsvImportDialog({ onImport }) {
  const dialog = $('csvImportDialog');
  let source = null;
  let buffer = null;
  const optionIds = ['csvEncoding', 'csvDelimiter', 'csvHeaders', 'csvCollapse', 'csvFormat'];
  const options = () => ({
    delimiter: $('csvDelimiter').value, firstRowHeaders: $('csvHeaders').checked,
    collapseDelimiters: $('csvCollapse').checked, dataFormat: $('csvFormat').value
  });
  const error = text => { $('csvImportError').textContent = text; $('csvImportError').hidden = !text; };
  const clear = () => { source = null; buffer = null; $('csvPreviewTable').replaceChildren(); error(''); };
  const close = () => dialog.close();
  dialog.addEventListener('close', clear);
  $('csvImportCancel').onclick = $('csvImportClose').onclick = close;

  function preview() {
    if (!buffer) return;
    try {
      const text = decodeCsvBuffer(buffer, $('csvEncoding').value);
      const result = parseCsvImport(text, { ...options(), preview: true });
      const table = $('csvPreviewTable');
      const heading = document.createElement('thead');
      const headerRow = document.createElement('tr');
      for (const name of result.data.headers) { const cell = document.createElement('th'); cell.textContent = name; headerRow.append(cell); }
      heading.append(headerRow);
      const body = document.createElement('tbody');
      for (const row of result.data.rows.slice(0, 10)) {
        const tr = document.createElement('tr');
        for (const value of row) { const cell = document.createElement('td'); cell.textContent = value; tr.append(cell); }
        body.append(tr);
      }
      table.replaceChildren(heading, body);
      $('csvPreviewStatus').textContent = `First ${body.children.length} rows · ${result.data.headers.length} columns · ${result.delimiter} delimiter`;
      error('');
    } catch (cause) {
      $('csvPreviewTable').replaceChildren();
      $('csvPreviewStatus').textContent = 'Preview unavailable';
      error(cause.message);
    }
  }
  for (const id of optionIds) $(id).addEventListener('change', preview);
  $('csvImportForm').onsubmit = event => {
    event.preventDefault();
    try {
      const text = decodeCsvBuffer(buffer, $('csvEncoding').value);
      const { data } = parseCsvImport(text, options());
      const imported = onImport(data, source.name, $('csvDestination').value);
      if (imported !== false) close();
    } catch (cause) { error(cause.message); }
  };
  return async file => {
    source = file;
    buffer = await file.arrayBuffer();
    $('csvImportFile').textContent = file.name;
    $('csvEncoding').value = 'auto'; $('csvDelimiter').value = 'auto';
    $('csvHeaders').checked = true; $('csvCollapse').checked = false;
    $('csvFormat').value = 'auto'; $('csvDestination').value = 'new';
    dialog.showModal();
    preview();
  };
}
