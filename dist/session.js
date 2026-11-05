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

export async function saveSession({ data, ...metadata }) {
  const database = await openSessionDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('session', 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      const store = transaction.objectStore('session');
      try {
        store.clear();
        store.put({ ...metadata, headers: data.headers }, -1);
        for (let start = 0; start < data.rows.length; start += CHUNK_SIZE) {
          store.put(data.rows.slice(start, start + CHUNK_SIZE), start);
        }
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
    if (!records.length) return null;
    const { headers, ...metadata } = records[0];
    const rows = [];
    for (let index = 1; index < records.length; index++) {
      for (const row of records[index]) rows.push(row);
    }
    return { ...metadata, data: { headers, rows } };
  } finally {
    database.close();
  }
}
