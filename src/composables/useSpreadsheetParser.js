/**
 * Parse a CSV or XLSX file into an array of row objects + column headers.
 * Uses SheetJS (xlsx) which handles both formats.
 *
 * @param {File} file - the uploaded File object
 * @returns {Promise<{ rows: Object[], columns: string[] }>}
 */
export async function parseSpreadsheet(file) {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('No sheets found in the file.');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) throw new Error('The spreadsheet is empty.');

  const columns = Object.keys(rows[0]);
  return { rows, columns };
}
