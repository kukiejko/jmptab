import { numeric } from './stats.js';
import { tCdf, tQuantile } from './inference.js';

export function createFactorialDesign({ name = 'Factorial Design', factors, replicates = 3, seed = 9 }) {
  if (!Array.isArray(factors) || factors.length !== 2 || factors.some(factor => !factor.name?.trim() || !factor.low?.trim() || !factor.high?.trim() || factor.low.trim() === factor.high.trim()) || factors[0].name.trim() === factors[1].name.trim())
    throw Error('Enter two different factor names, each with different low and high levels.');
  if (!Number.isSafeInteger(replicates) || replicates < 2 || replicates > 1000) throw Error('Replicates must be between 2 and 1000.');
  if (!Number.isSafeInteger(seed) || seed < 0) throw Error('Enter a nonnegative whole-number random seed.');
  let state = seed || 1;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const rows = [];
  for (let replicate = 0; replicate < replicates; replicate++) for (let combination = 0; combination < 4; combination++) {
    rows.push([replicate*4 + combination + 1, 0, 1, 1,
      combination & 1 ? factors[0].high.trim() : factors[0].low.trim(),
      combination & 2 ? factors[1].high.trim() : factors[1].low.trim(), '']);
  }
  for (let index = rows.length - 1; index > 0; index--) { const other = Math.floor(random()*(index+1)); [rows[index], rows[other]] = [rows[other], rows[index]]; }
  rows.forEach((row, index) => { row[1] = index+1; });
  const headers = ['StdOrder','RunOrder','CenterPt','Blocks',factors[0].name.trim(),factors[1].name.trim(),'Response'];
  return { name: name.trim() || 'Factorial Design', data: { headers, rows }, page: 1,
    doe: { factors: factors.map(factor => ({ name: factor.name.trim(), low: factor.low.trim(), high: factor.high.trim() })), replicates, seed } };
}

export function fitFactorialDesign(sheet, responseColumn) {
  if (!sheet.doe?.factors || sheet.doe.factors.length !== 2) throw Error('Create a two-factor design first.');
  const data = sheet.data;
  if (!Number.isInteger(responseColumn) || responseColumn < 0 || responseColumn >= data.headers.length) throw Error('Choose a response column.');
  const factors = sheet.doe.factors;
  const indices = factors.map(factor => data.headers.indexOf(factor.name));
  if (indices.some(index => index < 0) || indices.includes(responseColumn)) throw Error('Design factor columns must be present and separate from the response.');
  const observations = data.rows.map(row => {
    const y = numeric(row[responseColumn]);
    if (y === null) throw Error('Enter a numeric response in every design run.');
    const a = row[indices[0]] === factors[0].low ? -1 : row[indices[0]] === factors[0].high ? 1 : null;
    const b = row[indices[1]] === factors[1].low ? -1 : row[indices[1]] === factors[1].high ? 1 : null;
    if (a === null || b === null) throw Error('A design factor contains a level other than its low or high setting.');
    return { y, features: [1,a,b,a*b] };
  });
  const n = observations.length;
  if (n < 8) throw Error('At least two replicates of each design combination are needed.');
  const counts = [0,0,0,0];
  for (const item of observations) counts[(item.features[1]+1)/2 + (item.features[2]+1)]++;
  if (counts.some(count => count !== n/4)) throw Error('The four factor combinations must have equal replicate counts.');
  const coefficients = Array.from({length:4}, (_, index) => observations.reduce((sum, item) => sum + item.y*item.features[index],0)/n);
  const fitted = observations.map(item => item.features.reduce((sum, value, index) => sum + value*coefficients[index],0));
  const residuals = observations.map((item,index) => item.y - fitted[index]);
  const sse = residuals.reduce((sum,value) => sum + value*value,0);
  const mean = coefficients[0];
  const sst = observations.reduce((sum,item) => sum + (item.y-mean)**2,0);
  const mse = sse/(n-4);
  const standardError = Math.sqrt(mse/n);
  const terms = ['Constant', factors[0].name, factors[1].name, factors[0].name+' × '+factors[1].name].map((name,index) => {
    const t = standardError ? coefficients[index]/standardError : coefficients[index] ? Infinity : 0;
    return { name, coefficient: coefficients[index], effect: index ? 2*coefficients[index] : null, t,
      pValue: Number.isFinite(t) ? Math.min(1,2*(1-tCdf(Math.abs(t),n-4))) : 0 };
  });
  const model = { response: data.headers[responseColumn], factors, n, coefficients, sse, mse, rSquared: sst ? 1-sse/sst : 1,
    degreesOfFreedom: n-4, terms, fitted, residuals };
  sheet.doe.model = model;
  return model;
}

export function predictFactorial(model, levels) {
  if (!model?.coefficients || !Array.isArray(levels) || levels.length !== 2) throw Error('Fit a factorial model and choose two factor levels.');
  const codes = levels.map((level,index) => level === model.factors[index].low ? -1 : level === model.factors[index].high ? 1 : null);
  if (codes.includes(null)) throw Error('Choose known low or high factor levels.');
  const fitted = model.coefficients[0] + model.coefficients[1]*codes[0] + model.coefficients[2]*codes[1] + model.coefficients[3]*codes[0]*codes[1];
  const seFit = Math.sqrt(4*model.mse/model.n);
  const critical = tQuantile(.975, model.degreesOfFreedom);
  const ci = [fitted-critical*seFit, fitted+critical*seFit];
  const piHalf = critical*Math.sqrt(model.mse + seFit*seFit);
  return { levels, fitted, seFit, ci, pi: [fitted-piHalf,fitted+piHalf] };
}
