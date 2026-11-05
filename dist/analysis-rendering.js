import { chartObservations } from './stats.js';
import { PLOT_LIMIT } from './analysis-execution.js';
import { esc, fmt } from './result-format.js';
import { svgChart } from './chart.js';
export { esc, fmt, svgChart };

function metrics(items){return'<div class="metrics">'+items.map(([k,v])=>`<div class="metric"><label>${esc(k)}</label><strong>${esc(v)}</strong></div>`).join('')+'</div>';}
function statRows(items){return'<div class="stats-table">'+items.map(([k,v])=>`<div class="stat-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')+'</div>';}
function note(title,text){return`<div class="result-notes"><strong>${esc(title)}</strong>${esc(text)}</div>`;}
function tResult(result) {
  const bound = value => Number.isFinite(value) ? fmt(value, 5) : value < 0 ? '−∞' : '+∞';
  const interval = bound(result.lower) + ' to ' + bound(result.upper);
  const hypothesis = result.nullMean === null ? [] : [
    ['Hypothesized mean', fmt(result.nullMean, 5)],
    ['t statistic', fmt(result.statistic, 5)],
    ['p-value', fmt(result.pValue, 6)]
  ];
  const exclusion = result.excluded === undefined ? [] : [['Missing / nonnumeric', result.excluded]];
  return metrics([['Mean', fmt(result.mean, 5)], [result.confidence + '% confidence interval', interval], ['Observations', result.n]])
    + statRows([['Sample standard deviation', fmt(result.sd, 5)], ['Standard error', fmt(result.se, 5)], ['Degrees of freedom', result.df], ...hypothesis, ...exclusion])
    + note('Interpretation', result.nullMean === null
      ? 'The confidence interval estimates the population mean. Independent, representative observations are assumed.'
      : 'The p-value describes results this extreme under the hypothesized mean. Check independence and the sample distribution before drawing a conclusion.');
}
function timeSeriesResult(result, column) {
  const fittedPoints = chartObservations(result.fitted.map(point => point[1]), -Infinity, Infinity, PLOT_LIMIT)
    .map(([period, value]) => [period + (result.span ?? result.initialPeriods), value]);
  const method = result.span === undefined
    ? ['Smoothing weight', result.weight, 'Initial periods', result.initialPeriods]
    : ['Span', result.span];
  return metrics([['Next-period forecast', fmt(result.forecast, 5)], ['Mean absolute error', fmt(result.mae, 5)], ['Observations', result.n]])
    + `<p class="chart-title">Observed series</p>`
    + svgChart({ points: chartObservations(result.observations, -Infinity, Infinity, PLOT_LIMIT), connect: true, xLabel: 'Period', yLabel: column })
    + `<p class="chart-title">One-step-ahead fitted values</p>`
    + svgChart({ points: fittedPoints, connect: true, xLabel: 'Period', yLabel: 'Fitted value' })
    + statRows([[method[0], method[1]], ...(method.length > 2 ? [[method[2], method[3]]] : []), ['Fitted periods', result.fitted.length]])
    + note('Forecast method', 'Each fitted value uses prior observations. The final estimate forecasts the next period.');
}
export function renderAnalysisResult({ type, s, column, predictorColumn, rowCount }) {
  let html = '', report = '';
    if(type==='one-sample-t'){
      html=tResult(s);
      report=JSON.stringify(s,(key,value)=>value===Infinity?'+Infinity':value===-Infinity?'-Infinity':value,2);
    }else if(type==='correlation'){
      html=metrics([['Pearson r',fmt(s.r,5)],['p-value',fmt(s.pValue,6)],['Complete pairs',s.n]])+`<p class="chart-title">${esc(column)} vs ${esc(predictorColumn)}</p>`+svgChart({
        points:s.pairs,xLabel:predictorColumn,yLabel:column
      })+statRows([['Degrees of freedom',s.df],['Excluded pairs',s.excluded]])+note('Interpretation','Pearson correlation describes a linear association. Check the scatterplot for unusual observations and nonlinear patterns.');
      report=JSON.stringify({
        ...s,pairs:s.n>PLOT_LIMIT?undefined:s.pairs
      },null,2);
    }else if(type==='regression'){
      html=metrics([['R-squared',s.r2===null?'Undefined':fmt(s.r2*100,2)+'%'],['Slope',fmt(s.slope)],['Observations',s.n]])+`<p class="chart-title">${esc(column)} vs ${esc(predictorColumn)}</p>`+svgChart({
        points:s.pairs,fit:s,xLabel:predictorColumn,yLabel:column
      })+note('Fitted equation',`${column} = ${fmt(s.intercept,5)} ${s.slope<0?'−':'+'} ${fmt(Math.abs(s.slope),5)} × ${predictorColumn}`)+statRows([['Residual standard deviation',fmt(s.residualSD)],['Excluded pairs',rowCount-s.n]])+note('Interpretation','Least-squares fit with an intercept. A relationship does not establish causation. Examine residuals and model assumptions before drawing conclusions.');
      report=JSON.stringify(s,(key,value)=>s.n>PLOT_LIMIT&&(key==='pairs'||key==='values')?undefined:value,2);
    }else if(type==='moving-average'||type==='exponential-smoothing'){
      html=timeSeriesResult(s,column);
      report=JSON.stringify({
        ...s,observations:s.n>PLOT_LIMIT?undefined:s.observations,fitted:s.n>PLOT_LIMIT?undefined:s.fitted
      },null,2);
    }else if(type==='xbar-chart'){
      html=metrics([['Center mean',fmt(s.center,5)],['Subgroups',s.groups],['Outside limits',s.signals.length]])+`<p class="chart-title">Mean by consecutive subgroup</p>`+svgChart({
        points:chartObservations(s.means,s.lcl,s.ucl,PLOT_LIMIT),connect:true,lines:[{
          y:s.ucl,label:'UCL',color:'#c67979'
        },{
          y:s.center,label:'Center',color:'#3d71ce'
        },{
          y:s.lcl,label:'LCL',color:'#c67979'
        }],xLabel:'Subgroup',yLabel:'Subgroup mean'
      })+statRows([['Observations per subgroup',s.subgroupSize],['Estimated or known σ',fmt(s.sigma,5)],['Upper control limit',fmt(s.ucl,5)],['Lower control limit',fmt(s.lcl,5)]])+note('Interpretation','Only subgroup means beyond the 3σ limits are flagged. Use the original collection order.');
      report=JSON.stringify({
        ...s,means:s.groups>PLOT_LIMIT?undefined:s.means
      },null,2);
    }else if(type==='p-chart'){
      html=metrics([['Center proportion',fmt(s.center,5)],['Subgroups',s.n],['Outside limits',s.signals.length]])+`<p class="chart-title">Proportion defective by subgroup</p>`+svgChart({
        points:chartObservations(s.proportions,s.lcl,s.ucl,PLOT_LIMIT),connect:true,lines:[{
          y:s.ucl,label:'UCL',color:'#c67979'
        },{
          y:s.center,label:'Center',color:'#3d71ce'
        },{
          y:s.lcl,label:'LCL',color:'#c67979'
        }],xLabel:'Subgroup',yLabel:'Proportion defective'
      })+statRows([['Items per subgroup',s.subgroupSize],['Upper control limit',fmt(s.ucl,5)],['Lower control limit',fmt(s.lcl,5)],['Center source',s.target===null?'Estimated from data':'Specified target']])+note('Interpretation','Counts are converted to proportions. Only points beyond the 3σ limits are flagged.');
      report=JSON.stringify({
        ...s,proportions:s.n>PLOT_LIMIT?undefined:s.proportions
      },null,2);
    }else if(type==='control'||type==='capability'){
      html=type==='control'?metrics([['Process mean',fmt(s.mean)],['Within σ',fmt(s.sigma)],['Outside limits',s.signals.length]]):metrics([['Cp',fmt(s.cp)],['Cpk',fmt(s.cpk)],['Outside specs',s.outside]]);
      html+=`<p class="chart-title">${type==='control'?'Individuals chart':'Observed process and specification limits'}</p>`+svgChart({
        points:chartObservations(s.values, type==='control'?s.lcl:s.lsl, type==='control'?s.ucl:s.usl, PLOT_LIMIT),connect:true,lines:type==='control'?[{
          y:s.ucl,label:'UCL',color:'#c67979'
        },{
          y:s.mean,label:'Mean',color:'#3d71ce'
        },{
          y:s.lcl,label:'LCL',color:'#c67979'
        }]:[{
          y:s.usl,label:'USL',color:'#c67979'
        },{
          y:s.mean,label:'Mean',color:'#3d71ce'
        },{
          y:s.lsl,label:'LSL',color:'#c67979'
        }],xLabel:'Observation',yLabel:column
      });
      html+=type==='control'?note(s.signals.length?'Points outside control limits':'No points outside control limits',s.signals.length?`Review observations ${s.signals.slice(0, 15).map(i=>i+1).join(', ')}${s.signals.length>15?' and '+(s.signals.length-15).toLocaleString('en-US')+' more':''}. Limits are estimated from all observations.`:'This check flags points beyond 3σ only. Other patterns and stability rules have not been tested.')+statRows([['Upper control limit',fmt(s.ucl)],['Lower control limit',fmt(s.lcl)],['Average moving range',fmt(s.mrbar)],['Observations',s.n]]):statRows([['Pp (overall)',fmt(s.pp)],['Ppk (overall)',fmt(s.ppk)],['Within σ (MR̄ / 1.128)',fmt(s.sigma)],['Sample standard deviation',fmt(s.sd)],['Lower specification',fmt(s.lsl)],['Upper specification',fmt(s.usl)]])+note('Capability assumptions','Use capability indices only for a stable, representative process with an appropriate distribution. Cp/Cpk use moving-range σ; Pp/Ppk use overall sample standard deviation.');
      report=JSON.stringify(s,(key,value)=>s.n>PLOT_LIMIT&&(key==='pairs'||key==='values')?undefined:value,2);
    }else{
      html=metrics([['Mean',fmt(s.mean)],['Standard deviation',fmt(s.sd)],['Observations',s.n]])+`<p class="chart-title">Distribution of ${esc(column)}</p>`+svgChart({
        bars:s,xLabel:column,yLabel:'Frequency'
      })+statRows([['Minimum',fmt(s.min)],['Maximum',fmt(s.max)],['First quartile',fmt(s.q1)],['Third quartile',fmt(s.q3)],['Median',fmt(s.median)],['Standard error',fmt(s.se)],['Variance',fmt(s.variance)],['Missing / nonnumeric',s.missing]])+note('About this analysis',`Sample standard deviation uses n − 1. ${s.missing?'Blank and nonnumeric values are excluded.':'All observations in this column are numeric.'} Histogram bins use the square-root rule.`);
      report=JSON.stringify(s,(key,value)=>s.n>PLOT_LIMIT&&(key==='pairs'||key==='values')?undefined:value,2);
    }
    if (s.n > PLOT_LIMIT && ['regression', 'control', 'capability', 'p-chart', 'xbar-chart', 'correlation', 'moving-average', 'exponential-smoothing'].includes(type)) {
      html += note('Large dataset', 'The chart shows a subset of observations. The calculations use all eligible rows. Raw data is available via Export CSV.');
    }
  return { html, report };
}
