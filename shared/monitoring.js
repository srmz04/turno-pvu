/**
 * srmz04/turno-pvu
 * MonitoringClient: Telemetria basica y trazas de error
 */

import { CONFIG } from './config.js';

class MonitoringClient {
    constructor() {
        this.eventsQueue = [];
        this.errorsQueue = [];
        this.perfQueue = [];
        this.flushInterval = 10000; // 10s
        this.maxQueueSize = 50;

        // Auto start
        if (typeof window !== 'undefined') {
            setInterval(() => this.flush(), this.flushInterval);

            // Global error handlers
            window.addEventListener('error', (event) => {
                this.trackError(event.error || event.message, { source: 'window.onerror' });
            });

            window.addEventListener('unhandledrejection', (event) => {
                this.trackError(event.reason, { source: 'unhandledrejection' });
            });
        }
    }

    trackPageView(route) {
        this.eventsQueue.push({
            type: 'pageview',
            route,
            timestamp: Date.now()
        });
    }

    trackEvent(category, action, label = null, value = null) {
        this.eventsQueue.push({
            type: 'event',
            category,
            action,
            label,
            value,
            timestamp: Date.now()
        });
    }

    trackError(error, context = {}) {
        console.error('Tracked Error:', error);
        this.errorsQueue.push({
            message: error && error.message ? error.message : String(error),
            stack: error && error.stack ? error.stack : null,
            context,
            timestamp: Date.now()
        });
    }

    trackPerformance(metric, value) {
        this.perfQueue.push({
            metric,
            value,
            timestamp: Date.now()
        });
    }

    async flush() {
        if (!this.eventsQueue.length && !this.errorsQueue.length && !this.perfQueue.length) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return; // Wait for online

        const payload = {
            events: [...this.eventsQueue],
            errors: [...this.errorsQueue],
            perf: [...this.perfQueue],
            env: CONFIG.ENV,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        };

        // Clear queues immediately (or partially)
        this.eventsQueue = [];
        this.errorsQueue = [];
        this.perfQueue = [];

        try {
            // Fire and forget - use beacon if available
            const url = `${CONFIG.API_BASE_URL}/metrics/ingest`;
            if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                navigator.sendBeacon(url, blob);
            } else {
                // Fallback fetch
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: true
                }).catch(() => { });
            }
        } catch (e) {
            // Ignore monitoring errors
            // console.debug('Monitoring flush error', e);
        }
    }
}

export const monitor = new MonitoringClient();
