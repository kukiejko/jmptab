import { generateSampleData, SAMPLE_DEFAULTS, DISTRIBUTION_DEFAULTS } from './sample-data.js';

export function setupSampleDataDialog({ onGenerate }) {
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="sampleDataDialog" class="sample-data-dialog" aria-labelledby="sampleDataTitle">
      <div class="dialog-heading"><h2 id="sampleDataTitle">Generate sample data</h2><button type="button" id="sampleDataClose" aria-label="Close">×</button></div>
      <form id="sampleDataForm" novalidate>
        <div class="sample-data-fields">
          <label for="sampleType">Data for</label><select id="sampleType" name="type"><option value="boxplot">Boxplot</option><option value="scatterplot">Scatterplot</option><option value="histogram">Histogram</option></select>
          <label for="sampleDistribution">Distribution</label><select id="sampleDistribution" name="distribution"><option value="normal">Normal</option><option value="uniform">Uniform</option><option value="exponential">Exponential</option><option value="bimodal">Bimodal</option></select>
          <label for="sampleCount">Number of points</label><input id="sampleCount" name="count" type="number" min="2" max="1048576" step="1" required>
          <label for="sampleValueUnit" class="sample-value-only">Value unit (optional)</label><input id="sampleValueUnit" class="sample-value-only" name="valueUnit" maxlength="100" placeholder="e.g. mm">
          <label for="sampleXUnit" class="sample-scatter-only">X unit (optional)</label><input id="sampleXUnit" class="sample-scatter-only" name="xUnit" maxlength="100" placeholder="e.g. °C">
          <label for="sampleYUnit" class="sample-scatter-only">Y unit (optional)</label><input id="sampleYUnit" class="sample-scatter-only" name="yUnit" maxlength="100" placeholder="e.g. mm">
          <label for="sampleMin" id="sampleMinLabel" class="range-only">Value minimum</label><input id="sampleMin" class="range-only" name="min" type="number" step="any">
          <label for="sampleMax" id="sampleMaxLabel" class="range-only">Value maximum</label><input id="sampleMax" class="range-only" name="max" type="number" step="any">
          <label for="sampleYMin" class="range-scatter-only">Y minimum</label><input id="sampleYMin" class="range-scatter-only" name="yMin" type="number" step="any">
          <label for="sampleYMax" class="range-scatter-only">Y maximum</label><input id="sampleYMax" class="range-scatter-only" name="yMax" type="number" step="any">
          <label for="sampleGroups" class="box-only">Number of groups</label><input id="sampleGroups" class="box-only" name="groups" type="number" min="2" max="8" step="1">
          <label for="sampleMean" class="normal-only">Mean (μ)</label><input id="sampleMean" class="normal-only" name="mean" type="number" step="any">
          <label for="sampleSigma" class="normal-only">Sigma (σ)</label><input id="sampleSigma" class="normal-only" name="sigma" type="number" step="any" min="0">
          <label for="sampleOutliers" class="normal-only">Add outliers</label><input id="sampleOutliers" class="normal-only" name="outliers" type="checkbox">
          <label for="sampleOutlierPercent" class="outlier-only">Outliers (%)</label><input id="sampleOutlierPercent" class="outlier-only" name="outlierPercent" type="number" min="0" max="25" step="any">
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
    boxplot: 'Creates numeric values and category groups. Outliers are optional for the normal distribution.',
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
  function updateDistribution() {
    const isNormal = field('distribution').value === 'normal';
    dialog.classList.toggle('sample-normal', isNormal);
    dialog.classList.toggle('sample-outliers', isNormal && field('outliers').checked);
    document.getElementById('sampleDataError').hidden = true;
  }
  field('type').addEventListener('change', updateType);
  field('distribution').addEventListener('change', updateDistribution);
  field('outliers').addEventListener('change', updateDistribution);
  document.getElementById('sampleDataClose').onclick = () => dialog.close();
  document.getElementById('sampleDataCancel').onclick = () => dialog.close();
  form.addEventListener('submit', event => {
    event.preventDefault();
    const type = field('type').value;
    const distribution = field('distribution').value;
    const fields = ['count', ...(distribution === 'normal' ? [] : ['min', 'max', ...(type === 'scatterplot' ? ['yMin', 'yMax'] : [])]), ...(type === 'boxplot' ? ['groups'] : []), ...(distribution === 'normal' ? ['mean', 'sigma', ...(field('outliers').checked ? ['outlierPercent'] : [])] : [])];
    const settings = Object.fromEntries(fields.map(name => [name, field(name).value]));
    try {
      if (Object.values(settings).some(value => value === '')) throw new Error('Complete all visible fields.');
      const units = type === 'scatterplot' ? { xUnit: field('xUnit').value, yUnit: field('yUnit').value } : { valueUnit: field('valueUnit').value };
      const data = generateSampleData({ type, distribution, ...settings, ...units, outliers: distribution === 'normal' && field('outliers').checked });
      if (onGenerate(data, type) !== false) dialog.close();
    } catch (error) {
      const message = document.getElementById('sampleDataError');
      message.textContent = error.message;
      message.hidden = false;
    }
  });
  updateType();
  for (const [name, value] of Object.entries(DISTRIBUTION_DEFAULTS)) {
    if (name === 'outliers') field(name).checked = value;
    else field(name).value = value;
  }
  updateDistribution();
  return () => { dialog.showModal(); field('type').focus(); };
}
