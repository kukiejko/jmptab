export function groupedNumber(value, options) {
  return Number(value).toLocaleString('en-US', options).replaceAll(',', ' ');
}
