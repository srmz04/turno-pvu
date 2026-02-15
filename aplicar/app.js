/**
 * TURNO-PVU - Módulo Aplicar (Vacunador)
 * FASE 5: Flujo FIFO con predicción inteligente
 */

import { CONFIG } from '../shared/config.js';
import { api } from '../shared/api.js';
import { auth } from '../shared/auth.js';
import { db } from '../shared/db.js';
import { syncManager } from '../shared/sync.js';
import { showToast, formatTime } from '../shared/utils.js';
import { monitor } from '../shared/monitoring.js';

class AplicadorApp {
    constructor() {

        this.state = {
            user: null,
            turnoActivo: null,
            siguienteFolio: null, // Predicción FIFO
            fichaActual: null, // Ficha predicha cargada
            historial: [], // Últimas 10 fichas aplicadas
            modoManual: false,
            inputManual: ''
        };

        this.init();
    }

    async init() {
        try {
            // Verificar autenticación
            if (!auth.isAuthenticated()) {
                window.location.href = '../registro/index.html';
                return;
            }

            this.state.user = auth.getUser();

            // Verificar rol APLICADOR o superior
            const allowedRoles = [CONFIG.ROLES.APLICADOR, CONFIG.ROLES.COORDINADOR, CONFIG.ROLES.ADMIN];
            if (!allowedRoles.includes(this.state.user.rol)) {
                showToast('Acceso denegado. Solo para APLICADOR o superior.', 'error');
                setTimeout(() => window.location.href = '../registro/index.html', 2000);
                return;
            }

            // DB local ya inicializada al importar
            await db.ensureReady();

            // Cargar turno activo
            await this.cargarTurnoActivo();

            // Cargar historial local
            await this.cargarHistorial();

            // Renderizar vista inicial
            this.render();

            syncManager.startAutoSync();

            // Monitorear conectividad
            this.setupConnectionMonitor();

            // Tracking
            monitor.trackPageView('/aplicar');

        } catch (error) {
            console.error('Error en init:', error);
            showToast('Error al inicializar aplicación', 'error');
        }
    }

    async cargarTurnoActivo() {
        try {
            const centroId = this.state.user.centroId;
            const turno = await api.get(`/turnos/activo/${centroId}`);

            if (!turno || !turno.abierto) {
                this.state.turnoActivo = null;
                this.state.siguienteFolio = null;
                return;
            }

            this.state.turnoActivo = turno;

            // Calcular siguiente folio predicho (FIFO)
            await this.predecirSiguienteFolio();

        } catch (error) {
            console.error('Error cargando turno activo:', error);
            this.state.turnoActivo = null;
        }
    }

    async predecirSiguienteFolio() {
        try {
            if (!this.state.turnoActivo) return;

            // Obtener fichas del turno
            const fichas = await api.get(`/fichas/turno/${this.state.turnoActivo.id}`);

            if (!fichas || fichas.length === 0) {
                // No hay fichas aún, el primer folio será el 1
                this.state.siguienteFolio = 1;
                this.state.fichaActual = null;
                return;
            }

            // Encontrar la última ficha APLICADA
            const fichasAplicadas = fichas
                .filter(f => f.estado === 'APLICADA')
                .sort((a, b) => b.consecutivo - a.consecutivo);

            if (fichasAplicadas.length === 0) {
                // Hay fichas emitidas pero ninguna aplicada aún
                // El siguiente es el primer folio emitido
                const primeraEmitida = fichas
                    .filter(f => f.estado === 'EMITIDA')
                    .sort((a, b) => a.consecutivo - b.consecutivo)[0];

                if (primeraEmitida) {
                    this.state.siguienteFolio = primeraEmitida.consecutivo;
                    // Intentar cargar datos de esa ficha
                    await this.cargarFichaPredecida(primeraEmitida.folio);
                } else {
                    this.state.siguienteFolio = 1;
                }
                return;
            }

            // Siguiente folio = último aplicado + 1
            const ultimoConsecutivo = fichasAplicadas[0].consecutivo;
            this.state.siguienteFolio = ultimoConsecutivo + 1;

            // Intentar cargar la ficha predicha si ya fue emitida
            const folioPredicho = this.construirFolio(this.state.siguienteFolio);
            await this.cargarFichaPredecida(folioPredicho);

        } catch (error) {
            console.error('Error prediciendo siguiente folio:', error);
            this.state.siguienteFolio = null;
        }
    }

    construirFolio(consecutivo) {
        if (!this.state.turnoActivo) return null;
        const codigo = this.state.user.centroCodigo || 'CS001';
        const consStr = String(consecutivo).padStart(4, '0');
        return `PVU-${codigo}-${consStr}`;
    }

    async cargarFichaPredecida(folio) {
        try {
            const ficha = await api.get(`/fichas/${folio}`);
            if (ficha && ficha.estado === 'EMITIDA') {
                this.state.fichaActual = ficha;
            } else {
                this.state.fichaActual = null;
            }
        } catch (error) {
            // Ficha no existe o no está emitida aún
            this.state.fichaActual = null;
        }
    }

    async cargarHistorial() {
        try {
            const record = await db.get('catalogos', 'historial_aplicaciones');
            const historialLocal = (record && record.value) || [];
            this.state.historial = historialLocal.slice(-10); // Últimas 10
        } catch (error) {
            console.error('Error cargando historial:', error);
            this.state.historial = [];
        }
    }

    async confirmarYAplicar() {
        if (!this.state.siguienteFolio) {
            showToast('No hay siguiente folio predicho', 'error');
            return;
        }

        const folio = this.construirFolio(this.state.siguienteFolio);
        await this.aplicarFicha(folio);
    }

    async aplicarFicha(folio) {
        try {
            const startTime = performance.now();

            // Llamada al backend
            const result = await api.patch(`/fichas/${folio}/aplicar`, {});

            const duration = performance.now() - startTime;

            // Guardar en historial local
            const historialItem = {
                folio: result.folio,
                biologico: this.getBiologicoLabel(result),
                timestamp: new Date().toISOString(),
                edad: `${result.edad_anios}a`,
                sexo: result.sexo
            };

            this.state.historial.unshift(historialItem);
            this.state.historial = this.state.historial.slice(0, 10); // Máximo 10

            await db.put('catalogos', { key: 'historial_aplicaciones', value: this.state.historial });

            // Tracking
            monitor.trackEvent('Ficha', 'Aplicada', folio);
            monitor.trackPerformance('aplicar_ficha', duration);

            // Mostrar confirmación
            this.mostrarConfirmacion(result);

            // Actualizar predicción
            setTimeout(async () => {
                await this.predecirSiguienteFolio();
                this.render();
            }, 1500);

        } catch (error) {
            console.error('Error aplicando ficha:', error);
            showToast(error.message || 'Error al aplicar ficha', 'error');
            monitor.trackError(error, { folio, action: 'aplicar' });
        }
    }

    getBiologicoLabel(ficha) {
        const biologicos = [];
        if (ficha.asigna_srp) biologicos.push('SRP');
        if (ficha.asigna_sr) biologicos.push('SR');
        if (ficha.asigna_vph) biologicos.push('VPH');
        return biologicos.join(' + ');
    }

    mostrarConfirmacion(ficha) {
        const overlay = document.createElement('div');
        overlay.className = 'overlay';

        const modal = document.createElement('div');
        modal.className = 'confirmacion-aplicacion';
        modal.innerHTML = `
            <div class="check-icon">✓</div>
            <h3>Vacuna Aplicada</h3>
            <p><strong>${ficha.folio}</strong></p>
            <p>${this.getBiologicoLabel(ficha)}</p>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        setTimeout(() => {
            overlay.remove();
            modal.remove();
        }, 1500);
    }

    async saltarSiguiente() {
        // Incrementar predicción y cargar siguiente
        if (!this.state.siguienteFolio) return;

        this.state.siguienteFolio++;
        const nuevoFolio = this.construirFolio(this.state.siguienteFolio);
        await this.cargarFichaPredecida(nuevoFolio);
        this.render();

        showToast(`Saltado. Siguiente: ${nuevoFolio}`, 'info');
    }

    toggleModoManual() {
        this.state.modoManual = !this.state.modoManual;
        this.state.inputManual = '';
        this.render();
    }

    handleNumpadClick(value) {
        if (value === 'back') {
            this.state.inputManual = this.state.inputManual.slice(0, -1);
        } else {
            if (this.state.inputManual.length < 4) {
                this.state.inputManual += value;
            }
        }
        this.render();
    }

    async buscarYAplicarManual() {
        if (this.state.inputManual.length !== 4) {
            showToast('Ingrese 4 dígitos', 'error');
            return;
        }

        const consecutivo = parseInt(this.state.inputManual, 10);
        const folio = this.construirFolio(consecutivo);

        await this.aplicarFicha(folio);

        // Resetear modo manual
        this.state.modoManual = false;
        this.state.inputManual = '';
    }

    setupConnectionMonitor() {
        const statusBar = document.getElementById('connection-status');

        const updateStatus = () => {
            if (navigator.onLine) {
                statusBar.className = 'status-bar status-online';
                statusBar.textContent = 'CONECTADO';
            } else {
                statusBar.className = 'status-bar status-offline';
                statusBar.textContent = 'MODO CONTINGENCIA - Sin conexión';
            }
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus();
    }

    render() {
        const container = document.getElementById('main-container');

        // Si no hay turno activo
        if (!this.state.turnoActivo) {
            container.innerHTML = this.renderSinTurno();
            return;
        }

        container.innerHTML = `
            <div class="aplicador-main">
                ${this.renderHeader()}
                ${this.renderPrediccionFIFO()}
                ${this.renderBotonesAccion()}
                ${this.state.modoManual ? this.renderTecladoManual() : ''}
                ${this.renderHistorial()}
            </div>
        `;

        this.attachEventListeners();
    }

    renderHeader() {
        return `
            <div class="aplicador-header">
                <h1>Aplicación de Vacunas</h1>
                <div class="user-info">
                    ${this.state.user.nombreCompleto || this.state.user.username} •
                    ${this.state.user.centroCodigo || 'Centro'}
                </div>
            </div>
        `;
    }

    renderPrediccionFIFO() {
        if (!this.state.siguienteFolio) {
            return `
                <div class="next-prediction">
                    <div class="label">Esperando fichas</div>
                    <p>No hay fichas emitidas en este turno aún</p>
                </div>
            `;
        }

        const folio = this.construirFolio(this.state.siguienteFolio);
        const consStr = String(this.state.siguienteFolio).padStart(4, '0');

        if (this.state.fichaActual) {
            const biologico = this.getBiologicoLabel(this.state.fichaActual);

            return `
                <div class="next-prediction">
                    <div class="label">Siguiente Folio</div>
                    <div class="folio-display">${consStr}</div>
                    <div class="patient-info">
                        ${this.state.fichaActual.sexo === 'M' ? 'Niño' : 'Niña'} •
                        ${this.state.fichaActual.edad_anios} años
                    </div>
                    <div class="biologico-badge">${biologico}</div>
                </div>
            `;
        } else {
            return `
                <div class="next-prediction">
                    <div class="label">Siguiente Folio Predicho</div>
                    <div class="folio-display">${consStr}</div>
                    <div class="patient-info">Ficha aún no emitida</div>
                </div>
            `;
        }
    }

    renderBotonesAccion() {
        const ficha = this.state.fichaActual;

        let botonPrincipal = '';

        if (ficha) {
            // Determinar botón según biológico
            if (ficha.asigna_srp) {
                botonPrincipal = `
                    <button class="btn-aplicar btn-aplicar-srp" data-action="confirmar">
                        ✓ APLICAR SRP
                    </button>
                `;
            } else if (ficha.asigna_sr && ficha.asigna_vph) {
                botonPrincipal = `
                    <button class="btn-aplicar btn-aplicar-sr" data-action="confirmar">
                        ✓ APLICAR SR + VPH
                    </button>
                `;
            } else if (ficha.asigna_sr) {
                botonPrincipal = `
                    <button class="btn-aplicar btn-aplicar-sr" data-action="confirmar">
                        ✓ APLICAR SR
                    </button>
                `;
            } else if (ficha.asigna_vph) {
                botonPrincipal = `
                    <button class="btn-aplicar btn-aplicar-vph" data-action="confirmar">
                        ✓ APLICAR VPH
                    </button>
                `;
            }
        } else {
            botonPrincipal = `
                <button class="btn-aplicar btn-secondary" disabled>
                    Esperando Ficha...
                </button>
            `;
        }

        return `
            <div class="action-buttons">
                ${botonPrincipal}
                <button class="btn btn-saltar" data-action="saltar">
                    ⏭ Saltar (no es el siguiente)
                </button>
                <button class="btn btn-manual" data-action="toggle-manual">
                    ⌨ Buscar Manualmente
                </button>
            </div>
        `;
    }

    renderTecladoManual() {
        return `
            <div class="teclado-manual">
                <h3>Ingresar Folio Manualmente</h3>
                <input
                    type="text"
                    class="input-folio"
                    value="${this.state.inputManual}"
                    placeholder="0000"
                    readonly
                />
                <div class="numpad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `
                        <button class="numpad-btn" data-num="${n}">${n}</button>
                    `).join('')}
                    <button class="numpad-btn zero" data-num="0">0</button>
                    <button class="numpad-btn backspace" data-num="back">⌫</button>
                </div>
                <button class="btn btn-primary" data-action="aplicar-manual"
                    ${this.state.inputManual.length !== 4 ? 'disabled' : ''}>
                    Buscar y Aplicar
                </button>
            </div>
        `;
    }

    renderHistorial() {
        if (this.state.historial.length === 0) {
            return `
                <div class="historial">
                    <h3>Últimas Aplicaciones</h3>
                    <p style="text-align: center; color: #95a5a6; padding: 1rem;">
                        No hay aplicaciones registradas aún
                    </p>
                </div>
            `;
        }

        return `
            <div class="historial">
                <h3>Últimas Aplicaciones</h3>
                <ul class="historial-list">
                    ${this.state.historial.map(item => `
                        <li class="historial-item">
                            <span class="folio">${item.folio}</span>
                            <span class="biologico">${item.biologico}</span>
                            <span class="time">${formatTime(item.timestamp)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    renderSinTurno() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">⏸</div>
                <h2>No hay turno activo</h2>
                <p>El coordinador debe abrir un turno para comenzar a aplicar vacunas</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    Recargar
                </button>
            </div>
        `;
    }

    attachEventListeners() {
        // Botón confirmar
        const btnConfirmar = document.querySelector('[data-action="confirmar"]');
        if (btnConfirmar) {
            btnConfirmar.addEventListener('click', () => this.confirmarYAplicar());
        }

        // Botón saltar
        const btnSaltar = document.querySelector('[data-action="saltar"]');
        if (btnSaltar) {
            btnSaltar.addEventListener('click', () => this.saltarSiguiente());
        }

        // Botón modo manual
        const btnManual = document.querySelector('[data-action="toggle-manual"]');
        if (btnManual) {
            btnManual.addEventListener('click', () => this.toggleModoManual());
        }

        // Numpad
        const numpadBtns = document.querySelectorAll('.numpad-btn');
        numpadBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.num;
                this.handleNumpadClick(value);
            });
        });

        // Aplicar manual
        const btnAplicarManual = document.querySelector('[data-action="aplicar-manual"]');
        if (btnAplicarManual) {
            btnAplicarManual.addEventListener('click', () => this.buscarYAplicarManual());
        }
    }
}

// Inicializar aplicación
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AplicadorApp());
} else {
    new AplicadorApp();
}

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
        console.error('Service Worker registration failed:', err);
    });
}
