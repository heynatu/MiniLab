// Tiny IndexedDB wrapper. Everything stays on this device.
const DB_NAME = 'minilab';
const DB_VERSION = 1;
let dbPromise;

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) { reject(new Error('NO_IDB')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('gallery')) db.createObjectStore('gallery', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function run(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    const r = fn(s);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const kvGet = (k) => run('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => run('kv', 'readwrite', (s) => s.put(v, k));
export const kvDel = (k) => run('kv', 'readwrite', (s) => s.delete(k));
export const galleryAll = () => run('gallery', 'readonly', (s) => s.getAll());
export const galleryGet = (id) => run('gallery', 'readonly', (s) => s.get(id));
export const galleryPut = (item) => run('gallery', 'readwrite', (s) => s.put(item));
export const galleryDel = (id) => run('gallery', 'readwrite', (s) => s.delete(id));
export const galleryClear = () => run('gallery', 'readwrite', (s) => s.clear());
