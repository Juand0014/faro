import { normalizeOutfit, type Outfit } from './fashion';

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DB_NAME = 'faro-local';
const STORE = 'atelier-drafts';
const DB_VERSION = 1;

export type FashionDraft = {
  id: string;
  coupleId: string;
  designerId: string;
  title: string;
  outfit: Outfit;
  mode: 'free' | 'challenge';
  updatedAt: number;
  expiresAt: number;
};

export const draftKey = (coupleId: string, designerId: string) => `${coupleId}:${designerId}`;

export function isDraftExpired(draft: Pick<FashionDraft, 'expiresAt'>, now = Date.now()) {
  return draft.expiresAt <= now;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryDrafts = new Map<string, FashionDraft>();

function openDb(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('indexeddb_unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('expiresAt', 'expiresAt');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('indexeddb_open_failed'));
    };
  });
  return dbPromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb_request_failed'));
  });
}

export async function saveFashionDraft(
  draft: Omit<FashionDraft, 'id' | 'updatedAt' | 'expiresAt'>,
): Promise<void> {
  const now = Date.now();
  const record: FashionDraft = {
    ...draft,
    id: draftKey(draft.coupleId, draft.designerId),
    updatedAt: now,
    expiresAt: now + DRAFT_TTL_MS,
  };
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.quota && estimate.usage !== undefined && estimate.quota - estimate.usage < 128 * 1024) {
      memoryDrafts.set(record.id, record);
      return;
    }
    const db = await openDb();
    await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record));
  } catch {
    memoryDrafts.set(record.id, record);
  }
}

export async function loadFashionDraft(coupleId: string, designerId: string): Promise<FashionDraft | null> {
  try {
    const db = await openDb();
    const raw = await requestResult(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(draftKey(coupleId, designerId)),
    ) as Partial<FashionDraft> | undefined;
    if (!raw || typeof raw.id !== 'string' || typeof raw.updatedAt !== 'number'
      || typeof raw.expiresAt !== 'number' || typeof raw.coupleId !== 'string'
      || typeof raw.designerId !== 'string' || typeof raw.title !== 'string'
      || (raw.mode !== 'free' && raw.mode !== 'challenge')) return null;
    const draft: FashionDraft = {
      ...raw,
      outfit: normalizeOutfit(raw.outfit),
    } as FashionDraft;
    if (isDraftExpired(draft)) {
      await deleteFashionDraft(coupleId, designerId);
      return null;
    }
    return draft;
  } catch {
    const draft = memoryDrafts.get(draftKey(coupleId, designerId));
    return draft && !isDraftExpired(draft) ? draft : null;
  }
}

export async function deleteFashionDraft(coupleId: string, designerId: string): Promise<void> {
  try {
    const db = await openDb();
    await requestResult(
      db.transaction(STORE, 'readwrite').objectStore(STORE).delete(draftKey(coupleId, designerId)),
    );
  } catch { /* best-effort cache cleanup */ }
  memoryDrafts.delete(draftKey(coupleId, designerId));
}

export async function purgeExpiredFashionDrafts(now = Date.now()): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const index = tx.objectStore(STORE).index('expiresAt');
    const request = index.openKeyCursor(IDBKeyRange.upperBound(now));
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(); return; }
        tx.objectStore(STORE).delete(cursor.primaryKey);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error ?? new Error('indexeddb_transaction_aborted'));
    });
  } catch { /* best-effort cache cleanup */ }
  for (const [key, draft] of memoryDrafts) {
    if (draft.expiresAt <= now) memoryDrafts.delete(key);
  }
}

export async function wipeFashionDrafts(): Promise<void> {
  try {
    const db = await openDb();
    await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).clear());
  } catch { /* best-effort cache cleanup */ }
  memoryDrafts.clear();
}
