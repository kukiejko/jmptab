import { generateSampleData, SAMPLE_DEFAULTS } from './sample-data.js';

export function setupSampleDataDialog({ onGenerate }) {
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="sampleDataDialog" class="sample-data-dialog" aria-labelledby="sampleDataTitle">
      <div class="dialog-heading"><h2 id="sampleDataTitle">Generate sample data</h2><button type="button" id="sampleDataClose" aria-label="Close">×</button></div>
      <form id="sampleDataForm" novalidate>
        <div class="sample-data-fields">
          <label for="sampleType">Data for</label><select id="sampleType" name="type"><option value="boxplot">Boxplot</option><option value="scatterplot">Scatterplot</option><option value="histogram">Histogram</option></select>
          <label for="sampleCount">Number of points</label><input id="sampleCount" name="count" type="number" min="2" max="100000" step="1" required>
          <label for="sampleMin" id="sampleMinLabel">Value minimum</label><input id="sampleMin" name="min" type="number" step="any" required>
          <label for="sampleMax" id="sampleMaxLabel">Value maximum</label><input id="sampleMax" name="max" type="number" step="any" required>
          <label for="sampleYMin" class="scatter-only">Y minimum</label><input id="sampleYMin" class="scatter-only" name="yMin" type="number" step="any">
          <label for="sampleYMax" class="scatter-only">Y maximum</label><input id="sampleYMax" class="scatter-only" name="yMax" type="number" step="any">
          <label for="sampleGroups" class="box-only">Number of groups</label><input id="sampleGroups" class="box-only" name="groups" type="number" min="2" max="8" step="1">
        </div>
        <p id="sampleDescription" class="sample-data-description"></p>
        <p id="sampleDataError" class="sample-data-error" role="alert" hidden></p>
        <div class="dialog-actions"><button type="button" id="sampleDataCancel">Cancel</button><button type="submit" class="primary">Generate</button></div>
      </form>
    </dialog>`);

  const dialog = document.getElementById('sampleDataDialog');
  const form = document.getElementById('sampleDataForm');
  const field = name => form.elements.namedItem(name);
  const descriptions = {
    boxplot: 'Creates numeric values and category groups, including occasional outliers.',
    scatterplot: 'Creates paired X and Y values with a visible relationship.',
    histogram: 'Creates one numeric column with a distribution concentrated near the middle.'
  };
  function updateType() {
    const type = field('type').value;
    const defaults = SAMPLE_DEFAULTS[type];
    for (const [name, value] of Object.entries(defaults)) field(name).value = value;
    dialog.classList.toggle('sample-scatter', type === 'scatterplot');
    dialog.classList.toggle('sample-box', type === 'boxplot');
    document.getElementById('sampleMinLabel').textContent = type === 'scatterplot' ? 'X minimum' : 'Value minimum';
    document.getElementById('sampleMaxLabel').textContent = type === 'scatterplot' ? 'X maximum' : 'Value maximum';
    document.getElementById('sampleDescription').textContent = descriptions[type];
    document.getElementById('sampleDataError').hidden = true;
  }
  field('type').addEventListener('change', updateType);
  document.getElementById('sampleDataClose').onclick = () => dialog.close();
  document.getElementById('sampleDataCancel').onclick = () => dialog.close();
  form.addEventListener('submit', event => {
    event.preventDefault();
    const type = field('type').value;
    const settings = Object.fromEntries(['count', 'min', 'max', ...(type === 'scatterplot' ? ['yMin', 'yMax'] : []), ...(type === 'boxplot' ? ['groups'] : [])].map(name => [name, field(name).value]));
    try {
      if (Object.values(settings).some(value => value === '')) throw new Error('Complete all visible fields.');
      const data = generateSampleData({ type, ...settings });
      if (onGenerate(data, type) !== false) dialog.close();
    } catch (error) {
      const message = document.getElementById('sampleDataError');
      message.textContent = error.message;
      message.hidden = false;
    }
  });
  updateType();
  return () => { dialog.showModal(); field('type').focus(); };
}
