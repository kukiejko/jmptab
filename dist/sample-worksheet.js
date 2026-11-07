import { nextWorksheetName, validWorksheet } from './workbook.js';

export function appendSampleWorksheet(worksheets, data) {
  if (worksheets.length >= 100) throw new Error('Maximum 100 worksheets per project.');
  const sheet = { name: nextWorksheetName(worksheets), data, page: 1, scrollLeft: 0 };
  if (!validWorksheet(sheet)) throw new Error('Generated data cannot be added to a worksheet.');
  return { worksheets: [...worksheets, sheet], activeSheetIndex: worksheets.length };
}
