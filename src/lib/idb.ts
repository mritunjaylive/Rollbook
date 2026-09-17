export const DB_NAME = "rollbook-offline-sync";
export const DB_VERSION = 1;
export const STORE_NAME = "sync-queue";

export interface SyncRequest {
  id?: number;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToOfflineQueue(req: Omit<SyncRequest, "id" | "timestamp">): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const item: SyncRequest = { ...req, timestamp: Date.now() };
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineQueue(): Promise<SyncRequest[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFromOfflineQueue(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function processOfflineQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const queue = await getOfflineQueue();
  for (const item of queue) {
    if (!item.id) continue;
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
        credentials: "same-origin",
      });
      // Delete if successful or if it's a client error (e.g. 400) which won't succeed on retry
      if (res.ok || (res.status >= 400 && res.status < 500)) { 
        await deleteFromOfflineQueue(item.id);
      }
    } catch (err) {
      console.error("Failed to sync offline item", item, err);
      // Stop processing the queue to maintain chronological order and prevent hammering
      break; 
    }
  }
}
