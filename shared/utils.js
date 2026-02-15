/**
 * srmz04/turno-pvu
 * Utilidades compartidas para frontend
 */

/**
 * Muestra un toast de notificacion (requiere estilos en styles-base.css)
 * @param {string} message 
 * @param {'success'|'error'|'info'|'warning'} type 
 * @param {number} duration 
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;

    toastContainer.appendChild(toast);

    // Animation entrante
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
}

/**
 * Formato de fecha para mostrar al usuario
 * @param {string|Date} dateStr 
 */
export function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/**
 * Formato de hora corto
 * @param {string|Date} dateStr 
 */
export function formatTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Genera un ID aleatorio corto para UX (no criptografico)
 */
export function generateShortId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Valida si un string es un JSON valido
 */
export function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Obtiene el estado de la red estimado
 * Returns: '4g', '3g', '2g', 'slow-2g', or 'unknown'
 */
export function getNetworkQuality() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return conn ? conn.effectiveType : 'unknown';
}

/**
 * Intenta obtener el nivel de bateria
 * Returns promise resolving to level (0-1) or null
 */
export async function getBatteryLevel() {
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            return battery.level;
        } catch (e) {
            console.warn('Battery API error', e);
            return null;
        }
    }
    return null;
}

/**
 * Debounce simple
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
