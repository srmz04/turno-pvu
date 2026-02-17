/**
 * srmz04/turno-pvu
 * ApiClient: Wrapper para fetch con autenticacion y soporte offline
 */

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { db } from './db.js';
import { showToast } from './utils.js';

class ApiClient {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        // Headers por defecto
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Agregar token si existe
        const token = auth.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            // 1. Intentar Online
            const response = await fetch(url, config);

            // 1.1 Manejar 401 (Token vencido)
            if (response.status === 401) {
                auth.logout();
                throw new Error('Sesion expirada, por favor inicie sesion nuevamente.');
            }

            // 1.2 Manejar Errores API
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.code || `Error ${response.status}`);
            }

            // 1.3 Exito Online
            return await response.json();

        } catch (error) {
            // 2. Manejo de Error / Offline

            // Si es error de red (fetch tira TypeError) y es una mutacion (POST/PATCH/DELETE)
            if (error.name === 'TypeError' && ['POST', 'PATCH', 'DELETE'].includes(config.method)) {
                console.warn('Network error, queuing offline mutation...', error);

                // Guardar en cola
                await db.addToSyncQueue({
                    endpoint,
                    method: config.method,
                    body: config.body ? JSON.parse(config.body) : {},
                    headers: {} // No guardamos auth headers, se regeneran al sincronizar
                });

                showToast('Sin conexion. Guardado localmente.', 'warning');

                // Retornar objeto "fake" para que UI no rompa
                return { offline: true, success: true };
            }

            // Si es otro error, propagar
            throw error;
        }
    }

    // Helpers
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    }

    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
    }

    patch(endpoint, body) {
        return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

export const api = new ApiClient();
