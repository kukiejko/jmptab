const CHUNK_SIZE = 5_000;

function openSessionDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mtab-workbench', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other jmptab tabs and retry.'));
  });
}

export function* sessionEntries({ data, worksheets, activeSheetIndex = 0, ...metadata }) {
  const sheets = worksheets || [{ name: 'Worksheet 1', data, page: 1 }];
  yield [-1, {
    ...metadata,
    activeSheetIndex,
    sheets: sheets.map(sheet => ({
      name: sheet.name, headers: sheet.data.headers, roles: sheet.data.roles,
      rowCount: sheet.data.rows.length, page: sheet.page || 1
    }))
  }];
  let key = 0;
  for (const sheet of sheets) {
    for (let start = 0; start < sheet.data.rows.length; start += CHUNK_SIZE) {
      yield [key++, sheet.data.rows.slice(start, start + CHUNK_SIZE)];
    }
  }
}

export function decodeSessionRecords(records) {
  if (!records.length) return null;
  const { sheets, activeSheetIndex = 0, headers, ...metadata } = records[0];
  if (Array.isArray(sheets)) {
    let cursor = 1;
    const worksheets = sheets.map(sheet => {
      const rows = [];
      while (rows.length < sheet.rowCount && cursor < records.length) {
        rows.push(...records[cursor++]);
      }
      if (rows.length !== sheet.rowCount) throw Error('Saved worksheet data is incomplete.');
      return { name: sheet.name, data: { headers: sheet.headers, ...(sheet.roles ? { roles: sheet.roles } : {}), rows }, page: sheet.page || 1 };
    });
    if (cursor !== records.length) throw Error('Saved worksheet data has extra rows.');
    return { ...metadata, worksheets, activeSheetIndex };
  }
  // Sessions saved before workbook support contain one header record and its row chunks.
  const rows = [];
  for (let index = 1; index < records.length; index++) rows.push(...records[index]);
  return { ...metadata, data: { headers, rows } };
}

export async function saveSession(session) {
  const database = await openSessionDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('session', 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      const store = transaction.objectStore('session');
      try {
        store.clear();
        for (const [key, value] of sessionEntries(session)) store.put(value, key);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

export async function loadSession() {
  const database = await openSessionDatabase();
  try {
    const records = await new Promise((resolve, reject) => {
      const request = database.transaction('session').objectStore('session').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return decodeSessionRecords(records);
  } finally {
    database.close();
  }
}
