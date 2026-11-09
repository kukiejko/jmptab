export function axisLabel(data, index) {
  const name = String(data.headers[index] || `Column ${index + 1}`).trim();
  const format = data.formats?.[index];
  const unit = String(data.units?.[index] || '').trim() || (format === 'date' ? 'day' : format === 'timestamp' || format === 'time' ? 'UTC' : '');
  return unit ? `${name} (${unit})` : name;
}
