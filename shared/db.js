/**
 * srmz04/turno-pvu
 * Wrapper de IndexedDB para persistencia offline
 * Sin dependencias externas.
 */

const DB_NAME = 'TURNO_PVU_DB';
const DB_VERSION = 1;

export class LocalDB {
    constructor() {
        this.db = null;
        this.readyPromise = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB ready');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store para cola de sincronizacion (offline mutations)
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('status', 'status', { unique: false }); // 'pending', 'retry', 'failed'
                }

                // Store para fichas (cache local para lectura offline)
                if (!db.objectStoreNames.contains('fichas')) {
                    const store = db.createObjectStore('fichas', { keyPath: 'folio' });
                    store.createIndex('turno_id', 'turno_id', { unique: false });
                    store.createIndex('estado', 'estado', { unique: false });
                    store.createIndex('synced', 'synced', { unique: false }); // booleano
                }

                // Store para catalogos (centros, config)
                if (!db.objectStoreNames.contains('catalogos')) {
                    db.createObjectStore('catalogos', { keyPath: 'key' });
                }

                // Store para metricas
                if (!db.objectStoreNames.contains('metricas_locales')) {
                    db.createObjectStore('metricas_locales', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async ensureReady() {
        if (!this.db) await this.readyPromise;
        return this.db;
    }

    // Generic Operations
    async getAll(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, value) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Metodos especificos para Sync Queue
    async addToSyncQueue(mutation) {
        // mutation: { endpoint, method, body, timestamp, retries: 0 }
        return this.put('syncQueue', {
            ...mutation,
            status: 'pending',
            timestamp: Date.now()
        });
    }

    async getPendingSyncItems() {
        const all = await this.getAll('syncQueue');
        return all.filter(item => item.status === 'pending' || item.status === 'retry').sort((a, b) => a.timestamp - b.timestamp);
    }
}

export const db = new LocalDB();
