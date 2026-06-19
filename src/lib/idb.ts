/**
 * IndexedDB 기반 오디오 파일 저장소
 * localStorage의 5MB 용량 제한을 우회하기 위해 사용합니다.
 */
const DB_NAME = 'music-diary-idb';
const STORE = 'audio-files';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 오디오 파일을 IndexedDB에 저장하고 `idb://key` 형식의 URL을 반환합니다. */
export async function saveAudioToIdb(key: string, file: File): Promise<string> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return `idb://${key}`;
}

/** `idb://key` URL을 Blob Object URL로 변환합니다. 일반 URL은 그대로 반환합니다. */
export async function resolveAudioUrl(url: string): Promise<string> {
  const file = await getAudioFileFromIdb(url);
  if (!file) return url.startsWith('idb://') ? '' : url;
  return URL.createObjectURL(file);
}

export async function getAudioFileFromIdb(url: string): Promise<File | undefined> {
  if (!url || !url.startsWith('idb://')) return undefined;
  const key = url.slice(6);
  const db = await openDB();
  return new Promise<File | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as File | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB에서 오디오 파일을 삭제합니다. */
export async function deleteAudioFromIdb(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
