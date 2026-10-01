const DB_NAME = 'ppfg-wms-offline';
const DB_VERSION = 1;
const CACHE_STORE = 'cache';
const QUEUE_STORE = 'queue';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported by this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open offline database.'));
  });
}

async function transaction(storeName, mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try { result = action(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Offline database transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Offline database transaction aborted.'));
  });
}

export async function getCache(key) {
  return transaction(CACHE_STORE, 'readonly', store => new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  }));
}

export async function setCache(key, value) {
  return transaction(CACHE_STORE, 'readwrite', store => {
    store.put({ key, value, updatedAt: Date.now() });
    return value;
  });
}

export async function removeCache(key) {
  return transaction(CACHE_STORE, 'readwrite', store => store.delete(key));
}

export async function enqueueMutation(mutation) {
  const item = {
    ...mutation,
    id: mutation.id || crypto.randomUUID(),
    createdAt: mutation.createdAt || Date.now(),
    attempts: Number(mutation.attempts || 0),
    status: 'PENDING'
  };
  await transaction(QUEUE_STORE, 'readwrite', store => store.put(item));
  return item;
}

export async function listQueue() {
  return transaction(QUEUE_STORE, 'readonly', store => new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => a.createdAt - b.createdAt));
    request.onerror = () => reject(request.error);
  }));
}

export async function updateQueue(id, patch) {
  return transaction(QUEUE_STORE, 'readwrite', store => new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const current = request.result;
      if (!current) return resolve(null);
      const next = { ...current, ...patch };
      const put = store.put(next);
      put.onsuccess = () => resolve(next);
      put.onerror = () => reject(put.error);
    };
    request.onerror = () => reject(request.error);
  }));
}

export async function removeQueue(id) {
  return transaction(QUEUE_STORE, 'readwrite', store => store.delete(id));
}

export async function clearOfflineData() {
  const db = await openDB();
  await Promise.all([CACHE_STORE, QUEUE_STORE].map(storeName => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  })));
}

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
