export const MAX_ROWS = 1_048_576;
export const MAX_COLUMNS = 16_384;

export function numeric(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
export function summary(values){const a=values.map(numeric).filter(v=>v!==null);if(a.length<2)throw Error('Select a column with at least two numeric observations.');const sorted=[...a].sort((a,b)=>a-b),n=a.length,mean=a.reduce((s,x)=>s+x,0)/n;const variance=a.reduce((s,x)=>s+(x-mean)**2,0)/(n-1);const q=p=>{const k=(n-1)*p,i=Math.floor(k);return sorted[i]+(sorted[Math.ceil(k)]-sorted[i])*(k-i);};return {n,missing:values.length-n,mean,sd:Math.sqrt(variance),variance,min:sorted[0],q1:q(.25),median:q(.5),q3:q(.75),max:sorted[n-1],se:Math.sqrt(variance/n),values:a};}
export function regression(xs, ys, pointLimit = Infinity) {
  let n = 0;
  let xTotal = 0;
  let yTotal = 0;
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    const x = numeric(xs[i]);
    const y = numeric(ys[i]);
    if (x === null || y === null) continue;
    n++;
    xTotal += x;
    yTotal += y;
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  if (n < 3) throw Error('Regression needs at least three complete numeric pairs.');
  if (xmin === xmax) throw Error('The predictor must contain different values.');

  const xMean = xTotal / n;
  const yMean = yTotal / n;
  let sxx = 0;
  let sxy = 0;
  let sst = 0;
  const pairs = [];
  let index = 0;
  let nextPoint = 0;
  const plotCount = Math.min(n, pointLimit);
  for (let i = 0; i < xs.length; i++) {
    const x = numeric(xs[i]);
    const y = numeric(ys[i]);
    if (x === null || y === null) continue;
    const dx = x - xMean;
    const dy = y - yMean;
    sxx += dx * dx;
    sxy += dx * dy;
    sst += dy * dy;
    if (index === nextPoint) {
      pairs.push([x, y]);
      nextPoint = Math.round(pairs.length * (n - 1) / Math.max(1, plotCount - 1));
    }
    index++;
  }
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  let sse = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = numeric(xs[i]);
    const y = numeric(ys[i]);
    if (x === null || y === null) continue;
    sse += ((y - yMean) - slope * (x - xMean)) ** 2;
  }
  return { pairs, n, slope, intercept, r2: ymin !== ymax ? Math.max(0, 1 - sse / sst) : null, residualSD: Math.sqrt(sse / (n - 2)), xmin, xmax, ymin, ymax };
}

export function control(values) {
  const parsed = values.map(numeric);
  if (parsed.some(value => value === null)) {
    throw Error('Control charts need numeric values in every row to preserve observation order.');
  }
  const result = summary(parsed);
  let totalRange = 0;
  for (let i = 1; i < parsed.length; i++) totalRange += Math.abs(parsed[i] - parsed[i - 1]);
  const mrbar = totalRange / (parsed.length - 1);
  const sigma = mrbar / 1.128;
  if (!sigma) throw Error('Control limits require variation between observations.');
  const ucl = result.mean + 3 * sigma;
  const lcl = result.mean - 3 * sigma;
  const signals = [];
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i] > ucl || parsed[i] < lcl) signals.push(i);
  }
  return { ...result, sigma, mrbar, ucl, lcl, signals };
}

export function chartObservations(values, lower, upper, pointLimit = 800) {
  const points = [];
  const append = index => {
    const value = values[index];
    points.push([index + 1, value, value < lower || value > upper]);
  };
  if (values.length <= pointLimit) {
    for (let i = 0; i < values.length; i++) append(i);
    return points;
  }
  // Keep the first and last observations and both extremes of each interval.
  const step = Math.ceil((values.length - 2) / Math.floor((pointLimit - 2) / 2));
  append(0);
  for (let start = 1; start < values.length - 1; start += step) {
    let min = start;
    let max = start;
    const end = Math.min(start + step, values.length - 1);
    for (let i = start + 1; i < end; i++) {
      if (values[i] < values[min]) min = i;
      if (values[i] > values[max]) max = i;
    }
    append(Math.min(min, max));
    if (min !== max) append(Math.max(min, max));
  }
  append(values.length - 1);
  return points;
}

export function capability(values, lsl, usl) {
  if (!Number.isFinite(lsl) || !Number.isFinite(usl) || lsl >= usl) throw Error('Enter numeric specification limits with lower < upper.');
  return capabilityWithOptionalLimits(values, lsl, usl);
}

export function capabilityWithOptionalLimits(values, lsl, usl) {
  if ((lsl !== null && !Number.isFinite(lsl)) || (usl !== null && !Number.isFinite(usl)) ||
      (lsl === null && usl === null) || (lsl !== null && usl !== null && lsl >= usl))
    throw Error('Enter at least one numeric specification limit, with lower < upper when both are given.');
  const s = control(values);
  const lowerWithin = lsl === null ? Infinity : (s.mean - lsl)/(3*s.sigma);
  const upperWithin = usl === null ? Infinity : (usl - s.mean)/(3*s.sigma);
  const lowerOverall = lsl === null ? Infinity : (s.mean - lsl)/(3*s.sd);
  const upperOverall = usl === null ? Infinity : (usl - s.mean)/(3*s.sd);
  return { ...s, lsl, usl, cp: lsl === null || usl === null ? null : (usl-lsl)/(6*s.sigma),
    cpk: Math.min(lowerWithin, upperWithin), pp: lsl === null || usl === null ? null : (usl-lsl)/(6*s.sd),
    ppk: Math.min(lowerOverall, upperOverall),
    outside: s.values.filter(value => (lsl !== null && value < lsl) || (usl !== null && value > usl)).length };
}
export function pChart(counts, subgroupSize, target = null) {
  if (!Number.isSafeInteger(subgroupSize) || subgroupSize < 1) throw Error('Enter a whole-number subgroup size of at least 1.');
  if (target !== null && (!Number.isFinite(target) || target < 0 || target > 1)) throw Error('Target proportion must be between 0 and 1.');
  const parsed = counts.map(numeric);
  if (parsed.length < 2 || parsed.some(value => !Number.isSafeInteger(value) || value < 0 || value > subgroupSize)) {
    throw Error('Enter at least two rows of whole-number defective counts between 0 and the subgroup size.');
  }
  const proportions = parsed.map(value => value / subgroupSize);
  const center = target ?? parsed.reduce((total, value) => total + value, 0) / (parsed.length * subgroupSize);
  const spread = 3 * Math.sqrt(center * (1 - center) / subgroupSize);
  const lcl = Math.max(0, center - spread);
  const ucl = Math.min(1, center + spread);
  const signals = proportions.flatMap((value, index) => value < lcl || value > ucl ? [index] : []);
  return { n: parsed.length, subgroupSize, target, center, lcl, ucl, signals, proportions };
}
export function histogram(values){const s=summary(values),k=Math.min(20,Math.ceil(Math.sqrt(s.n))),width=(s.max-s.min||1)/k,bins=Array(k).fill(0);s.values.forEach(v=>bins[Math.min(k-1,Math.floor((v-s.min)/width))]++);return{...s,bins,width};}
export function parseDelimited(text, delimiter = ','){text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!quoted&&field!=='')throw Error('Unexpected quote in delimited text.');else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if (row.length > 1 || row[0] !== '') rows.push(row);row=[];field='';}else field+=c;}if(quoted)throw Error('Delimited text has an unclosed quoted field.');row.push(field);if (row.length > 1 || row[0] !== '') rows.push(row);if(rows.length<2)throw Error('Delimited text must include a header and at least one data row.');const headers=rows.shift().map((v,i)=>v.trim()||`Column ${i+1}`);if(headers.length>MAX_COLUMNS||rows.length>MAX_ROWS)throw Error('Import up to 16,384 columns and 1,048,576 rows.');if(rows.some(r=>r.length!==headers.length))throw Error('Each row must have the same number of fields as the header.');return{headers,rows};}
export const parseCSV = text => parseDelimited(text, ',');
export function parseTextFile(text){const first = text.split(/\r?\n/,1)[0];return parseDelimited(text,first.includes('\t')?'\t':',');}
export function* csvChunks(data, rowsPerChunk = 5_000) {
  const encodeRow = row => Array.from({ length: data.headers.length }, (_, index) => '"' + String(row[index] ?? '').replaceAll('"', '""') + '"').join(',');
  yield encodeRow(data.headers);
  const chunkRows = Math.max(1, Math.min(rowsPerChunk, Math.floor(100_000 / data.headers.length)));
  for (let start = 0; start < data.rows.length; start += chunkRows) {
    yield '\r\n' + data.rows.slice(start, start + chunkRows).map(encodeRow).join('\r\n');
  }
}

export function csv(data) {
  return [...csvChunks(data)].join('');
}
