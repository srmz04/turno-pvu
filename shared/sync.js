/**
 * srmz04/turno-pvu
 * SyncManager: Procesa cola offline y sincroniza datos en background
 */

import { api } from './api.js';
import { db } from './db.js';
import { showToast } from './utils.js';

class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.intervalId = null;
    }

    startAutoSync(intervalMs = 30000) { // Default 30s
        if (this.intervalId) return;
        this.intervalId = setInterval(() => this.sync(), intervalMs);
        window.addEventListener('online', () => this.sync());
    }

    stopAutoSync() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async sync() {
        if (this.isSyncing || !navigator.onLine) return;

        this.isSyncing = true;
        console.log('Starting sync...');

        try {
            const pendingItems = await db.getPendingSyncItems();

            if (pendingItems.length === 0) {
                this.isSyncing = false;
                return;
            }

            showToast(`Sincronizando ${pendingItems.length} elementos...`, 'info');

            for (const item of pendingItems) {
                try {
                    // Reintentar peticion usando api.request pero forzando que no vuelva a encolar
                    // (api.request maneja cola si falla, aqui queremos saber si fallo real)
                    // Actually api.request queues on TypeError. 
                    // We should use a lower level call or handle it.
                    // For simplicity, we assume if we are online (checked above), api.request will try.
                    // If it fails with TypeError again, it might re-queue? 
                    // Wait, api.request queues if error.name === TypeError.
                    // If we call api.post() here, and network flickers, it queues A NEW ITEM.
                    // We need to avoid loops.

                    await this.processItem(item);

                    // Si exito, borrar de cola
                    await db.delete('syncQueue', item.id);

                } catch (error) {
                    console.error(`Failed to sync item ${item.id}`, error);
                    // Si es error de logica (400/500), marcar como failed para no reintentar infinito
                    if (error.message && !error.message.includes('Network')) {
                        item.status = 'failed';
                        item.error = error.message;
                        await db.put('syncQueue', item); // Actualizar estado
                    }
                    // Si es red, se queda en pending/retry para siguiente ciclo
                }
            }

            showToast('Sincronizacion completada', 'success');

        } catch (error) {
            console.error('Sync error global', error);
        } finally {
            this.isSyncing = false;
        }
    }

    async processItem(item) {
        const { endpoint, method, body } = item;

        // Usamos fetch directo para evitar logica de encolado de api.request
        const token = localStorage.getItem('turno_pvu_token'); // Direct access or via auth.getToken()

        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${api.baseUrl}${endpoint}`, {
            method,
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Error ${response.status}`);
        }

        return await response.json();
    }
}

export const syncManager = new SyncManager();
