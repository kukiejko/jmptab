const allowed = new Set(['summary','histogram','one-sample-t','correlation','regression','control','p-chart','xbar-chart','xbar-s-chart','moving-average','exponential-smoothing','capability']);

export function formatCommand({ type, responseIndex, predictorIndex, options = {} }) {
  if (!allowed.has(type)) throw Error('This analysis cannot be expressed as a command.');
  return `RUN ${type} RESPONSE C${responseIndex+1} PREDICTOR C${predictorIndex+1} OPTIONS ${JSON.stringify(options)}`;
}

export function parseCommands(text) {
  const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  if (!lines.length || lines.length > 100) throw Error('Enter 1 to 100 analysis commands.');
  return lines.map((line,index) => {
    const match = line.match(/^RUN ([a-z-]+) RESPONSE C([1-9]\d*) PREDICTOR C([1-9]\d*) OPTIONS (\{.*\})$/);
    if (!match || !allowed.has(match[1])) throw Error(`Invalid command on line ${index+1}.`);
    let options;
    try { options = JSON.parse(match[4]); } catch { throw Error(`Invalid options on line ${index+1}.`); }
    if (!options || Array.isArray(options) || typeof options !== 'object') throw Error(`Invalid options on line ${index+1}.`);
    return { type: match[1], responseIndex: Number(match[2])-1, predictorIndex: Number(match[3])-1, options };
  });
}
