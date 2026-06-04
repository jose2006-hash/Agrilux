// Almacenamiento offline de imágenes usando IndexedDB
// Permite guardar fotos cuando no hay conexión y sincronizar cuando se recupere

const DB_NAME = 'agrilux_offline';
const STORE_NAME = 'pending_images';
const DB_VERSION = 1;

let db = null;

const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
};

export const saveOfflineImage = async (imageData) => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      ...imageData,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(record);
    });
  } catch (error) {
    console.error('Error saving offline image:', error);
    throw error;
  }
};

export const getPendingImages = async (userId) => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('synced');

    return new Promise((resolve, reject) => {
      const request = index.getAll(false);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const allPending = request.result;
        const filtered = userId ? allPending.filter(img => img.userId === userId) : allPending;
        resolve(filtered);
      };
    });
  } catch (error) {
    console.error('Error getting pending images:', error);
    return [];
  }
};

export const markImageAsSynced = async (id) => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          record.synced = true;
          record.syncedAt = new Date().toISOString();
          const updateRequest = store.put(record);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve(record);
        } else {
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('Error marking image as synced:', error);
    throw error;
  }
};

export const deleteOfflineImage = async (id) => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  } catch (error) {
    console.error('Error deleting offline image:', error);
    throw error;
  }
};

export const clearAllOfflineImages = async () => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  } catch (error) {
    console.error('Error clearing offline images:', error);
    throw error;
  }
};

export const getOfflineImageStats = async () => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const all = request.result;
        const pending = all.filter(img => !img.synced);
        const synced = all.filter(img => img.synced);

        resolve({
          total: all.length,
          pending: pending.length,
          synced: synced.length,
          pendingImages: pending,
          syncedImages: synced,
        });
      };
    });
  } catch (error) {
    console.error('Error getting offline image stats:', error);
    return { total: 0, pending: 0, synced: 0, pendingImages: [], syncedImages: [] };
  }
};
