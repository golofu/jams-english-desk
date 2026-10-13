// Tiny IndexedDB blob store for Voice Snapshot recordings.
const DB = 'jed-audio';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('clips');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function putClip(id: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('clips', 'readwrite');
    tx.objectStore('clips').put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getClip(id: string): Promise<Blob | undefined> {
  const db = await open().catch(() => null); // no IndexedDB → let callers try the cloud copy
  if (!db) return undefined;
  return new Promise((resolve) => {
    const r = db.transaction('clips').objectStore('clips').get(id);
    r.onsuccess = () => resolve(r.result as Blob | undefined);
    r.onerror = () => resolve(undefined);
  });
}
