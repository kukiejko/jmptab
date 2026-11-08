import { createFactorialDesign, fitFactorialDesign, predictFactorial } from './factorial-design.js';

const fmt = value => Number.isFinite(value) ? Number(value.toPrecision(6)).toString() : '—';

function effectsSvg(model, escape) {
  const [a,b] = model.factors;
  const at = (x,y) => model.coefficients[0] + model.coefficients[1]*x + model.coefficients[2]*y + model.coefficients[3]*x*y;
  const combinations = [[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y]) => at(x,y));
  let min = Math.min(...combinations), max = Math.max(...combinations);
  if (min === max) { min--; max++; }
  const y = value => 185 - (value-min)/(max-min)*130;
  const line = (x1,v1,x2,v2,color) => `<line x1="${x1}" y1="${y(v1)}" x2="${x2}" y2="${y(v2)}" stroke="${color}" stroke-width="2.5"/><circle cx="${x1}" cy="${y(v1)}" r="4" fill="${color}"/><circle cx="${x2}" cy="${y(v2)}" r="4" fill="${color}"/>`;
  return `<svg class="chart" viewBox="0 0 650 265" role="img" aria-label="Factorial main effects and interaction plot"><text x="160" y="24" text-anchor="middle">Main effects</text><text x="480" y="24" text-anchor="middle">Interaction</text>
    <path d="M40 190H280M360 190H600" stroke="#445b78"/>${line(85,(at(-1,-1)+at(-1,1))/2,235,(at(1,-1)+at(1,1))/2,'#285b9c')}
    ${line(400,at(-1,-1),550,at(1,-1),'#285b9c')}${line(400,at(-1,1),550,at(1,1),'#bf5942')}
    <text x="85" y="212" text-anchor="middle">${escape(a.low)}</text><text x="235" y="212" text-anchor="middle">${escape(a.high)}</text><text x="160" y="244" text-anchor="middle">${escape(a.name)}</text>
    <text x="400" y="212" text-anchor="middle">${escape(a.low)}</text><text x="550" y="212" text-anchor="middle">${escape(a.high)}</text><text x="480" y="244" text-anchor="middle">${escape(a.name)} · ${escape(b.name)} low/high</text></svg>`;
}

function modelResult(model, escape) {
  const rows = model.terms.map(term => `<tr><th>${escape(term.name)}</th><td>${fmt(term.effect)}</td><td>${fmt(term.coefficient)}</td><td>${fmt(term.t)}</td><td>${fmt(term.pValue)}</td></tr>`).join('');
  return `<h4>Coded coefficients</h4><div class="rs-table-wrap"><table class="rs-results-table"><thead><tr><th>Term</th><th>Effect</th><th>Coef</th><th>T</th><th>P</th></tr></thead><tbody>${rows}</tbody></table></div><p>R² ${fmt(model.rSquared*100)}% · S ${fmt(Math.sqrt(model.mse))} · ${model.n} runs</p>`;
}

export function setupFactorialDialog({ getWorksheets, getActiveIndex, onSheet, onFit, onCreate, escape }) {
  document.body.insertAdjacentHTML('beforeend', `<dialog id="factorialDialog" class="response-surface-dialog" aria-labelledby="fdTitle"><header class="dialog-heading"><h2 id="fdTitle">Factorial Design</h2><button type="button" id="fdClose">×</button></header><div class="analysis-bar">
    <div id="fdCreate" hidden><label class="field">New worksheet name<input id="fdName" value="Factorial Design"></label><div class="fd-factor-grid"><label class="field">Factor A name<input id="fdAName" value="Factor A"></label><label class="field">Low<input id="fdALow" value="Low"></label><label class="field">High<input id="fdAHigh" value="High"></label><label class="field">Factor B name<input id="fdBName" value="Factor B"></label><label class="field">Low<input id="fdBLow" value="Low"></label><label class="field">High<input id="fdBHigh" value="High"></label></div><label class="field">Replicates<input id="fdReplicates" type="number" min="2" max="1000" value="3"></label><label class="field">Random seed<input id="fdSeed" type="number" min="0" value="9"></label></div>
    <div id="fdAnalyze" hidden><p>Enter a numeric response for every run before fitting the factorial model.</p><label class="field">Response column<select id="fdResponse"></select></label></div>
    <div id="fdPredict" hidden><div id="fdLevels" class="fd-factor-grid"></div></div><p id="fdError" role="alert" hidden></p></div><footer class="dialog-actions"><button type="button" id="fdCancel">Cancel</button><button type="button" id="fdApply" class="primary">OK</button></footer></dialog>`);
  const $ = id => document.getElementById(id);
  const dialog = $('factorialDialog');
  let mode;
  const active = () => getWorksheets()[getActiveIndex()];
  function open(nextMode) {
    mode = nextMode;
    if (mode !== 'create' && !active().doe) throw Error('Select a worksheet created from a two-factor factorial design.');
    if (['effects','predict'].includes(mode) && !active().doe.model) throw Error('Analyze this factorial design first.');
    if (mode === 'effects') {
      const model = active().doe.model;
      onCreate({ type:'factorial-effects', label:'Factorial Plots', title:`Factorial plots of ${model.response}`,
        column:model.response, svg:effectsSvg(model,escape), note:'Main effects and interaction from the stored factorial model.' });
      return;
    }
    $('fdTitle').textContent = ({create:'Create Factorial Design',analyze:'Analyze Factorial Design',predict:'Predict Response'})[mode];
    for (const name of ['Create','Analyze','Predict']) $('fd'+name).hidden = name.toLowerCase() !== mode;
    $('fdError').hidden = true;
    if (mode === 'analyze') $('fdResponse').innerHTML = active().data.headers.map((name,index) => `<option value="${index}"${name === 'Response' ? ' selected' : ''}>C${index+1} ${escape(name)}</option>`).join('');
    if (mode === 'predict') $('fdLevels').innerHTML = active().doe.factors.map((factor,index) => `<label class="field">${escape(factor.name)}<select id="fdLevel${index}"><option value="${escape(factor.low)}">${escape(factor.low)}</option><option value="${escape(factor.high)}">${escape(factor.high)}</option></select></label>`).join('');
    dialog.showModal();
  }
  $('fdClose').onclick = $('fdCancel').onclick = () => dialog.close();
  $('fdApply').onclick = () => {
    try {
      if (mode === 'create') {
        const factors = [{name:$('fdAName').value,low:$('fdALow').value,high:$('fdAHigh').value},{name:$('fdBName').value,low:$('fdBLow').value,high:$('fdBHigh').value}];
        onSheet(createFactorialDesign({ name:$('fdName').value, factors, replicates:Number($('fdReplicates').value), seed:Number($('fdSeed').value) }));
      } else if (mode === 'analyze') {
        const model = fitFactorialDesign(active(),Number($('fdResponse').value));
        onFit();
        onCreate({type:'factorial',label:'Factorial Regression',title:`Factorial regression of ${model.response}`,
          column:model.response, svg:modelResult(model,escape) + effectsSvg(model,escape),
          note:`${model.n} runs · R² ${fmt(model.rSquared*100)}% · model stored with worksheet`});
      } else {
        const model = active().doe.model;
        const prediction = predictFactorial(model,[$('fdLevel0').value,$('fdLevel1').value]);
        const svg = `<h4>Prediction for ${escape(model.response)}</h4><div class="rs-table-wrap"><table class="rs-results-table"><thead><tr><th>Fit</th><th>SE Fit</th><th>95% CI</th><th>95% PI</th></tr></thead><tbody><tr><td>${fmt(prediction.fitted)}</td><td>${fmt(prediction.seFit)}</td><td>${fmt(prediction.ci[0])} to ${fmt(prediction.ci[1])}</td><td>${fmt(prediction.pi[0])} to ${fmt(prediction.pi[1])}</td></tr></tbody></table></div>`;
        onCreate({type:'factorial-prediction',label:'Factorial Prediction',title:`Prediction for ${model.response}`,
          column:model.response, svg, note:prediction.levels.map((level,index) => `${model.factors[index].name} = ${level}`).join(' · ')});
      }
      dialog.close();
    } catch (error) { $('fdError').textContent = error.message; $('fdError').hidden = false; }
  };
  return open;
}
