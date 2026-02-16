/**
 * TURNO-PVU - Módulo Coordinador
 * FASE 6: Gestión de Centro, Dispositivos, Bloques y Cortes
 */

import { CONFIG } from '../shared/config.js';
import { api } from '../shared/api.js';
import { auth } from '../shared/auth.js';
import { db } from '../shared/db.js';
import { syncManager } from '../shared/sync.js';
import { showToast, formatTime, copyToClipboard } from '../shared/utils.js';
import { monitor } from '../shared/monitoring.js';

class CoordinadorApp {
    constructor() {

        this.state = {
            user: null,
            vistaActual: auth.isAuthenticated() ? 'monitor' : 'login', // Inicializar según auth
            turnoActivo: null,
            fichas: [],
            dispositivos: [],
            bloques: [],
            refreshInterval: null,

            // Form state
            formAbrirTurno: {
                tipo: 'MATUTINO',
                srp_inicial: 0,
                sr_inicial: 0,
                vph_inicial: 0
            },
            formCorteManual: {
                srp_restantes: 0,
                sr_restantes: 0,
                vph_restantes: 0,
                srp_aplicadas: 0,
                sr_aplicadas: 0,
                vph_aplicadas: 0,
                fichas_distribuidas: 0,
                fichas_entregadas: 0,
                notas: ''
            }
        };

        this.init();
    }

    async init() {
        try {
            // Verificar autenticación
            if (!auth.isAuthenticated()) {
                // Ya no redirigir
                this.render();
                return;
            }

            this.state.user = auth.getUser();

            // Verificar rol COORDINADOR o ADMIN
            const allowedRoles = [CONFIG.ROLES.COORDINADOR, CONFIG.ROLES.ADMIN];
            if (!allowedRoles.includes(this.state.user.rol)) {
                showToast('Acceso denegado. Solo para COORDINADOR o ADMIN.', 'error');
                auth.logout();
                this.state.vistaActual = 'login';
                this.render();
                return;
            }

            // DB local ya se inicializa automaticamente al importar
            await db.ensureReady();

            // Cargar datos iniciales
            await this.cargarDatos();

            // Renderizar
            this.render();

            // Auto-refresh cada 30 segundos si hay turno activo
            this.iniciarAutoRefresh();

            syncManager.startAutoSync();

            // Monitoreo de conectividad
            this.setupConnectionMonitor();

            // Tracking
            monitor.trackPageView('/coordinador');

        } catch (error) {
            console.error('Error en init:', error);
            showToast('Error al inicializar aplicación', 'error');
        }
    }

    async cargarDatos() {
        try {
            // Cargar turno activo
            await this.cargarTurnoActivo();

            // Si hay turno, cargar fichas
            if (this.state.turnoActivo) {
                await this.cargarFichas();
                await this.cargarDispositivos();
                await this.cargarBloques();
            }

        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    }

    async cargarTurnoActivo() {
        try {
            const centroId = this.state.user.centroId;
            const response = await api.get(`/turnos/activo/${centroId}`);
            const turno = response.turno;

            if (turno && turno.abierto) {
                this.state.turnoActivo = turno;
            } else {
                this.state.turnoActivo = null;
            }

        } catch (error) {
            console.error('Error cargando turno:', error);
            this.state.turnoActivo = null;
        }
    }

    async cargarFichas() {
        try {
            if (!this.state.turnoActivo) return;

            // Backend retorna { success, fichas: [...], total, stats }
            const response = await api.get(`/fichas/turno/${this.state.turnoActivo.id}`);
            this.state.fichas = Array.isArray(response?.fichas) ? response.fichas : [];

        } catch (error) {
            console.error('Error cargando fichas:', error);
            this.state.fichas = [];
        }
    }

    async cargarDispositivos() {
        try {
            const centroId = this.state.user.centroId;
            // Backend retorna { success, dispositivos: [...] }
            const response = await api.get(`/dispositivos/${centroId}`);
            this.state.dispositivos = Array.isArray(response?.dispositivos) ? response.dispositivos : [];

        } catch (error) {
            console.error('Error cargando dispositivos:', error);
            this.state.dispositivos = [];
        }
    }

    async cargarBloques() {
        try {
            if (!this.state.turnoActivo) return;

            // Backend retorna { success, bloques: [...] }
            const response = await api.get(`/bloques/${this.state.turnoActivo.id}`);
            this.state.bloques = Array.isArray(response?.bloques) ? response.bloques : [];

        } catch (error) {
            console.error('Error cargando bloques:', error);
            this.state.bloques = [];
        }
    }

    // ===== ACCIONES =====

    async abrirTurno() {
        try {
            const form = this.state.formAbrirTurno;

            // Validaciones
            if (form.srp_inicial < 0 || form.sr_inicial < 0 || form.vph_inicial < 0) {
                showToast('Las cantidades no pueden ser negativas', 'error');
                return;
            }

            if (form.srp_inicial === 0 && form.sr_inicial === 0) {
                showToast('Debe ingresar al menos 1 dosis de SRP o SR', 'error');
                return;
            }

            const data = {
                tipo: form.tipo,
                srp_inicial: parseInt(form.srp_inicial, 10),
                sr_inicial: parseInt(form.sr_inicial, 10),
                vph_inicial: parseInt(form.vph_inicial, 10)
            };

            // Backend retorna { success, turno: { id, centro_id, ... } }
            const response = await api.post('/turnos/abrir', data);

            showToast('Turno abierto exitosamente', 'success');
            monitor.trackEvent('Turno', 'Abierto', form.tipo);

            // Asignar turno de la respuesta y recargar datos completos del turno
            this.state.turnoActivo = response?.turno || response;
            this.cambiarVista('monitor');
            await this.cargarDatos();
            this.render();

        } catch (error) {
            console.error('Error abriendo turno:', error);

            // Manejo especifico para turno ya abierto (409)
            if (error.message && (error.message.includes('abierto') || error.message.includes('Conflict'))) {
                showToast('El turno ya se encuentra abierto. Actualizando...', 'info');
                await this.cargarDatos();
                if (this.state.turnoActivo) {
                    this.cambiarVista('monitor');
                    this.render();
                }
                return;
            }

            showToast(error.message || 'Error al abrir turno', 'error');
        }
    }

    async cerrarTurno() {
        try {
            // Confirmar
            if (!confirm('Confirme que desea cerrar el turno. Las fichas EMITIDAS pasaran a NO_UTILIZADA.')) {
                return;
            }

            // Leer sobrantes del formulario
            const sobrantes_srp = parseInt(document.getElementById('sobrantes-srp')?.value || '0', 10);
            const sobrantes_sr = parseInt(document.getElementById('sobrantes-sr')?.value || '0', 10);
            const sobrantes_vph = parseInt(document.getElementById('sobrantes-vph')?.value || '0', 10);

            const resultado = await api.post('/turnos/cerrar', {
                sobrantes_srp,
                sobrantes_sr,
                sobrantes_vph
            });

            // Mostrar resumen con los datos que devuelve el backend
            this.mostrarResumenCierre(resultado?.resumen || resultado);

            showToast('Turno cerrado exitosamente', 'success');
            monitor.trackEvent('Turno', 'Cerrado', '');

            // Limpiar estado
            this.state.turnoActivo = null;
            this.state.fichas = [];
            this.state.dispositivos = [];
            this.state.bloques = [];
            this.cambiarVista('abrir');
            this.render();

        } catch (error) {
            console.error('Error cerrando turno:', error);
            showToast(error.message || 'Error al cerrar turno', 'error');
        }
    }

    mostrarResumenCierre(resultado) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Turno Cerrado</h3>
                <div class="resumen-cierre">
                    <p><strong>Centro:</strong> ${resultado.centro || 'N/A'}</p>
                    <p><strong>Tipo:</strong> ${resultado.tipo || 'N/A'}</p>
                    <hr>
                    <h4>SRP (Triple Viral)</h4>
                    <p>Emitidas: ${resultado.srp_emitidas || 0}</p>
                    <p>Aplicadas: ${resultado.srp_aplicadas || 0}</p>
                    <p>Sobrantes: ${resultado.srp_sobrantes || 0}</p>
                    <hr>
                    <h4>SR (Doble Viral)</h4>
                    <p>Emitidas: ${resultado.sr_emitidas || 0}</p>
                    <p>Aplicadas: ${resultado.sr_aplicadas || 0}</p>
                    <p>Sobrantes: ${resultado.sr_sobrantes || 0}</p>
                    <hr>
                    <h4>VPH</h4>
                    <p>Emitidas: ${resultado.vph_emitidas || 0}</p>
                    <p>Aplicadas: ${resultado.vph_aplicadas || 0}</p>
                    <p>Sobrantes: ${resultado.vph_sobrantes || 0}</p>
                    <hr>
                    <p><strong>Fichas no utilizadas:</strong> ${resultado.no_utilizadas || 0}</p>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-primary" data-modal-action="close-summary">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        // Event listener para cerrar el modal
        const btnClose = modal.querySelector('[data-modal-action="close-summary"]');
        btnClose.addEventListener('click', () => {
            modal.remove();
        });

        document.body.appendChild(modal);
    }

    async crearDispositivo(rol) {
        try {
            const nombre = prompt(`Nombre del dispositivo ${rol.toLowerCase()}:`);
            if (!nombre) return;

            const data = {
                rol: rol,
                nombre: nombre
            };

            // Backend retorna { success, dispositivo: { ... } }
            const response = await api.post('/dispositivos/crear', data);
            const dispositivo = response?.dispositivo || response;

            showToast(`Usuario ${rol} creado`, 'success');
            monitor.trackEvent('Usuario', 'Creado', rol);

            await this.cargarDispositivos();
            this.render();

            // Mostrar URL del nuevo dispositivo
            this.mostrarURLDispositivo(dispositivo);

        } catch (error) {
            console.error('Error creando dispositivo:', error);
            showToast(error.message || 'Error al crear dispositivo', 'error');
        }
    }

    mostrarURLDispositivo(dispositivo) {
        const fullUrl = new URL(dispositivo.url_generada, window.location.origin).href;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Usuario Creado</h3>
                <p><strong>Nombre:</strong> ${dispositivo.nombre}</p>
                <p><strong>Rol:</strong> ${dispositivo.rol}</p>
                <p><strong>Enlace de Acceso:</strong></p>
                <div class="url-display">
                    ${fullUrl}
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${fullUrl}'); alert('Enlace copiado al portapapeles')">
                        Copiar Enlace
                    </button>
                    <button class="btn btn-secondary" data-modal-action="close">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        // Event listeners para los botones del modal
        const btnClose = modal.querySelector('[data-modal-action="close"]');

        btnClose.addEventListener('click', () => {
            modal.remove();
        });

        document.body.appendChild(modal);
    }

    async revocarDispositivo(id) {
        try {
            if (!confirm('¿Está seguro que desea revocar este dispositivo?')) {
                return;
            }

            await api.delete(`/dispositivos/${id}`);

            showToast('Dispositivo revocado', 'success');
            await this.cargarDispositivos();
            this.render();

        } catch (error) {
            console.error('Error revocando dispositivo:', error);
            showToast(error.message || 'Error al revocar dispositivo', 'error');
        }
    }

    async asignarBloque() {
        try {
            if (!this.state.turnoActivo) {
                showToast('Debe haber un turno activo', 'error');
                return;
            }

            const dispositivo_token = prompt('Token del dispositivo:');
            if (!dispositivo_token) return;

            const folio_inicio = parseInt(prompt('Folio inicio:'), 10);
            const folio_fin = parseInt(prompt('Folio fin:'), 10);

            if (isNaN(folio_inicio) || isNaN(folio_fin) || folio_inicio >= folio_fin) {
                showToast('Rango de folios inválido', 'error');
                return;
            }

            // turno_id es requerido por el backend para validar pertenencia
            const data = {
                turno_id: this.state.turnoActivo.id,
                dispositivo_token,
                folio_inicio,
                folio_fin
            };

            await api.post('/bloques/asignar', data);

            showToast('Bloque asignado', 'success');
            await this.cargarBloques();
            this.render();

        } catch (error) {
            console.error('Error asignando bloque:', error);
            showToast(error.message || 'Error al asignar bloque', 'error');
        }
    }

    async enviarCorteManual() {
        try {
            const form = this.state.formCorteManual;

            // Calcular fichas restantes
            const fichasDistribuidas = parseInt(form.fichas_distribuidas, 10) || 0;
            const fichasEntregadas = parseInt(form.fichas_entregadas, 10) || 0;
            const fichasRestantes = fichasDistribuidas - fichasEntregadas;

            const data = {
                srp_restantes: parseInt(form.srp_restantes, 10) || 0,
                sr_restantes: parseInt(form.sr_restantes, 10) || 0,
                vph_restantes: parseInt(form.vph_restantes, 10) || 0,
                fichas_distribuidas: fichasDistribuidas,
                fichas_entregadas: fichasEntregadas,
                fichas_restantes: fichasRestantes,
                srp_aplicadas: parseInt(form.srp_aplicadas, 10) || 0,
                sr_aplicadas: parseInt(form.sr_aplicadas, 10) || 0,
                vph_aplicadas: parseInt(form.vph_aplicadas, 10) || 0,
                notas: form.notas
            };

            // Si hay turno activo, asociar el corte al turno
            if (this.state.turnoActivo) {
                data.turno_id = this.state.turnoActivo.id;
            }

            await api.post('/cortes-manuales', data);

            showToast('Corte manual enviado', 'success');
            monitor.trackEvent('Corte', 'Manual', 'Enviado');

            // Limpiar form
            this.state.formCorteManual = {
                srp_restantes: 0,
                sr_restantes: 0,
                vph_restantes: 0,
                srp_aplicadas: 0,
                sr_aplicadas: 0,
                vph_aplicadas: 0,
                fichas_distribuidas: 0,
                fichas_entregadas: 0,
                notas: ''
            };

            if (this.state.turnoActivo) {
                await this.cargarTurnoActivo();
            }
            this.render();

        } catch (error) {
            console.error('Error enviando corte:', error);
            showToast(error.message || 'Error al enviar corte', 'error');
        }
    }

    // ===== HELPERS =====

    iniciarAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
        }

        this.state.refreshInterval = setInterval(async () => {
            if (this.state.turnoActivo && this.state.vistaActual === 'monitor') {
                await this.cargarDatos();
                this.render();
            }
        }, 30000); // 30 segundos
    }

    cambiarVista(vista) {
        this.state.vistaActual = vista;
        this.render();
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

    getSemaforo(biologico) {
        if (!this.state.turnoActivo) return 'verde';

        const inicial = this.state.turnoActivo[`${biologico}_inicial`];
        const emitidas = this.state.turnoActivo[`${biologico}_emitidas`];

        if (inicial === 0) return 'verde'; // No aplica

        const disponible = inicial - emitidas;
        const porcentaje = (disponible / inicial) * 100;

        if (porcentaje > 20) return 'verde';
        if (porcentaje > 0) return 'amarillo';
        return 'rojo';
    }

    // ===== RENDER =====

    render() {
        const container = document.getElementById('main-container');

        // Si es vista LOGIN, renderizar solo el login sin header/nav
        if (this.state.vistaActual === 'login') {
            container.innerHTML = this.renderLogin();

            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => this.handleLogin(e));
            }
            return;
        }

        // Vista normal con header y navegación
        container.innerHTML = `
            <div class="coordinador-main">
                ${this.renderHeader()}
                ${this.renderNavTabs()}
                ${this.renderVistaActual()}
            </div>
        `;

        this.attachEventListeners();
    }

    renderHeader() {
        return `
            <div class="coordinador-header">
                <h1>Coordinador de Centro</h1>
                <div class="centro-info">
                    ${this.state.user.nombreCompleto || this.state.user.username} •
                    ${this.state.user.centroCodigo || 'Centro'}
                </div>
            </div>
        `;
    }

    renderNavTabs() {
        const tabs = [];

        // Determinar qué tabs mostrar
        if (this.state.turnoActivo) {
            tabs.push(
                { id: 'monitor', label: 'Monitor' },
                { id: 'fichas', label: 'Fichas' },
                { id: 'dispositivos', label: 'Dispositivos' },
                { id: 'bloques', label: 'Bloques' },
                { id: 'cortes', label: 'Cortes' },
                { id: 'cerrar', label: 'Cerrar Turno' }
            );
        } else {
            tabs.push(
                { id: 'abrir', label: 'Abrir Turno' },
                { id: 'dispositivos', label: 'Dispositivos' },
                { id: 'cortes', label: 'Cortes' }
            );
        }

        return `
            <div class="nav-tabs">
                ${tabs.map(tab => `
                    <button
                        class="nav-tab ${this.state.vistaActual === tab.id ? 'active' : ''}"
                        data-vista="${tab.id}"
                    >
                        ${tab.label}
                    </button>
                `).join('')}
            </div>
        `;
    }

    renderVistaActual() {
        switch (this.state.vistaActual) {
            case 'login':
                return this.renderLogin();
            case 'abrir':
                return this.renderVistaAbrirTurno();
            case 'monitor':
                return this.renderVistaMonitor();
            case 'fichas':
                return this.renderVistaFichas();
            case 'dispositivos':
                return this.renderVistaDispositivos();
            case 'bloques':
                return this.renderVistaBloques();
            case 'cortes':
                return this.renderVistaCortes();
            case 'cerrar':
                return this.renderVistaCerrarTurno();
            default:
                return '<p>Vista no encontrada</p>';
        }
    }

    renderLogin() {
        return `
            <div class="login-container" style="max-width: 400px; margin: 50px auto; padding: 20px;">
                <div class="card">
                    <h2 style="text-align: center; margin-bottom: 2rem; color: var(--primary);">Coordinación PVU</h2>
                    <form id="login-form">
                        <div class="form-group">
                            <label>Usuario</label>
                            <input type="text" id="login-username" class="giant-input" required>
                        </div>
                        <div class="form-group">
                            <label>Contraseña</label>
                            <input type="password" id="login-password" class="giant-input" required>
                        </div>
                        <button type="submit" class="btn btn-primary btn-large" style="width: 100%;">Ingresar</button>
                    </form>
                </div>
            </div>
        `;
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const result = await auth.login(username, password);
            if (result.success) {
                const user = result.user;
                const allowedRoles = ['COORDINADOR', 'ADMIN'];

                if (allowedRoles.includes(user.rol)) {
                    this.state.user = user;
                    this.state.vistaActual = 'monitor';
                    // Recargar datos y renderizar interfaz completa
                    await this.init(); // Re-ejecutar init completo
                } else {
                    showToast('Rol no autorizado para este módulo', 'error');
                    auth.logout();
                }
            } else {
                showToast(result.error || 'Credenciales inválidas', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('Error de conexión', 'error');
        }
    }

    renderVistaAbrirTurno() {
        return `
            <div class="abrir-turno-form">
                <h2>Abrir Nuevo Turno</h2>

                <div class="form-section">
                    <h3>Tipo de Turno</h3>
                    <div class="tipo-turno-selector">
                        <button
                            class="tipo-turno-btn ${this.state.formAbrirTurno.tipo === 'MATUTINO' ? 'selected' : ''}"
                            data-tipo="MATUTINO"
                        >
                            Matutino
                        </button>
                        <button
                            class="tipo-turno-btn ${this.state.formAbrirTurno.tipo === 'VESPERTINO' ? 'selected' : ''}"
                            data-tipo="VESPERTINO"
                        >
                            Vespertino
                        </button>
                    </div>
                </div>

                <div class="form-section">
                    <h3>Inventario Inicial</h3>
                    <div class="inventario-inputs">
                        <div class="inventario-input-group">
                            <span class="badge badge-srp">SRP</span>
                            <label>Dosis SRP:</label>
                            <input
                                type="number"
                                min="0"
                                value="${this.state.formAbrirTurno.srp_inicial}"
                                data-field="srp_inicial"
                            />
                        </div>
                        <div class="inventario-input-group">
                            <span class="badge badge-sr">SR</span>
                            <label>Dosis SR:</label>
                            <input
                                type="number"
                                min="0"
                                value="${this.state.formAbrirTurno.sr_inicial}"
                                data-field="sr_inicial"
                            />
                        </div>
                        <div class="inventario-input-group">
                            <span class="badge badge-vph">VPH</span>
                            <label>Dosis VPH:</label>
                            <input
                                type="number"
                                min="0"
                                value="${this.state.formAbrirTurno.vph_inicial}"
                                data-field="vph_inicial"
                            />
                        </div>
                    </div>
                </div>

                <button class="btn btn-primary btn-large" data-action="abrir-turno">
                    Abrir Turno
                </button>
            </div>
        `;
    }

    renderVistaMonitor() {
        if (!this.state.turnoActivo) {
            return '<div class="empty-state"><p>No hay turno activo</p></div>';
        }

        const turno = this.state.turnoActivo;

        return `
            <div class="monitor-panel">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="label">Fichas Emitidas</div>
                        <div class="value">${turno.srp_emitidas + turno.sr_emitidas}</div>
                        <div class="subtext">Total del turno</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">Vacunas Aplicadas</div>
                        <div class="value">${turno.srp_aplicadas + turno.sr_aplicadas}</div>
                        <div class="subtext">Total del turno</div>
                    </div>
                    <div class="stat-card">
                        <div class="label">VPH Aplicadas</div>
                        <div class="value">${turno.vph_aplicadas}</div>
                        <div class="subtext">De ${turno.vph_inicial} dosis</div>
                    </div>
                </div>

                <div class="progress-section">
                    <h3>Inventario de Biológicos</h3>

                    ${this.renderBarraProgreso('SRP', 'srp')}
                    ${this.renderBarraProgreso('SR', 'sr')}
                    ${this.renderBarraProgreso('VPH', 'vph')}
                </div>
            </div>
        `;
    }

    renderBarraProgreso(label, biologico) {
        const turno = this.state.turnoActivo;
        const inicial = turno[`${biologico}_inicial`];
        const emitidas = turno[`${biologico}_emitidas`];
        const disponible = inicial - emitidas;
        const porcentaje = inicial > 0 ? ((inicial - emitidas) / inicial) * 100 : 0;

        const semaforo = this.getSemaforo(biologico);

        // Etiqueta correcta segun el tipo de biologico
        const etiquetas = { srp: 'Triple Viral', sr: 'Doble Viral', vph: 'VPH' };
        const etiqueta = etiquetas[biologico] || biologico.toUpperCase();

        return `
            <div class="progress-item">
                <div class="progress-header">
                    <div class="label">
                        <span class="semaforo ${semaforo}"></span>
                        ${label} (${etiqueta})
                    </div>
                    <div class="value">${disponible} / ${inicial}</div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill ${biologico}" style="width: ${porcentaje}%">
                        ${Math.round(porcentaje)}%
                    </div>
                </div>
            </div>
        `;
    }

    renderVistaFichas() {
        // Validación defensiva: asegurar que fichas es un array
        if (!Array.isArray(this.state.fichas)) {
            this.state.fichas = [];
        }

        if (this.state.fichas.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h2>Sin fichas</h2>
                    <p>No hay fichas emitidas en este turno aún</p>
                </div>
            `;
        }

        return `
            <div class="fichas-list">
                <h3>Fichas del Turno (${this.state.fichas.length})</h3>
                ${this.state.fichas.slice(0, 50).map(ficha => `
                    <div class="ficha-item">
                        <div class="ficha-folio">${ficha.folio}</div>
                        <div>
                            ${ficha.sexo === 'M' ? 'Niño' : 'Niña'} ${ficha.edad_anios}a
                            ${ficha.edad_meses > 0 ? ficha.edad_meses + 'm' : ''}
                        </div>
                        <span class="ficha-estado ${ficha.estado.toLowerCase()}">${ficha.estado}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderVistaDispositivos() {
        // Validación defensiva: asegurar que dispositivos es un array
        if (!Array.isArray(this.state.dispositivos)) {
            this.state.dispositivos = [];
        }

        return `
            <div class="dispositivos-panel">
                <div class="dispositivos-header">
                    <h2>Alta/Baja de Usuarios</h2>
                    <div class="btn-crear-dispositivo">
                        <button class="btn btn-primary" data-action="crear-registrador">
                            + Registrador
                        </button>
                        <button class="btn btn-primary" data-action="crear-aplicador">
                            + Aplicador
                        </button>
                    </div>
                </div>

                ${this.state.dispositivos.length === 0 ? `
                    <div class="empty-state">
                        <p>No hay dispositivos registrados</p>
                    </div>
                ` : `
                    <table class="dispositivos-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Rol</th>
                                <th>URL</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.state.dispositivos.map(d => {
            const fullUrl = new URL(d.url_generada, window.location.origin).href;
            return `
                                <tr>
                                    <td>${d.nombre}</td>
                                    <td>${d.rol}</td>
                                    <td>
                                        <div class="url-display" title="${fullUrl}">${fullUrl}</div>
                                    </td>
                                    <td>
                                        <button class="btn-copiar" onclick="navigator.clipboard.writeText('${fullUrl}'); alert('Enlace copiado')">
                                            Copiar
                                        </button>
                                        <button class="btn-revocar" data-dispositivo-id="${d.id}">
                                            Revocar
                                        </button>
                                    </td>
                                </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        `;
    }

    renderVistaBloques() {
        // Validación defensiva: asegurar que bloques es un array
        if (!Array.isArray(this.state.bloques)) {
            this.state.bloques = [];
        }

        return `
            <div class="bloques-panel">
                <h2>Distribución de Bloques de Folios</h2>

                <button class="btn btn-primary" data-action="asignar-bloque">
                    + Asignar Bloque
                </button>

                ${this.state.bloques.length === 0 ? `
                    <div class="empty-state">
                        <p>No hay bloques asignados</p>
                    </div>
                ` : `
                    ${this.state.bloques.map(bloque => `
                        <div class="bloque-card">
                            <div class="bloque-header">
                                <strong>Dispositivo: ${bloque.dispositivo_token}</strong>
                                <span>Folios: ${bloque.folio_inicio} - ${bloque.folio_fin}</span>
                            </div>
                            <div class="bloque-info">
                                Consumidos: ${bloque.consumidos} / ${bloque.folio_fin - bloque.folio_inicio + 1}
                            </div>
                        </div>
                    `).join('')}
                `}
            </div>
        `;
    }

    renderVistaCortes() {
        // Calculo automatico de fichas restantes
        const fichasDist = parseInt(this.state.formCorteManual.fichas_distribuidas, 10) || 0;
        const fichasEntr = parseInt(this.state.formCorteManual.fichas_entregadas, 10) || 0;
        const fichasRest = fichasDist - fichasEntr;

        return `
            <div class="corte-manual-form">
                <h2>Corte Informativo Manual</h2>

                <div class="alert-info">
                    <p>
                        <strong>Uso:</strong> Reportar existencias de biologico y fichas.
                        ${this.state.turnoActivo ? '' : '<br><em>Sin turno activo: el corte se registra sin asociar a un turno.</em>'}
                    </p>
                </div>

                <!-- Seccion: Existencias y Aplicación -->
                <div class="form-section">
                    <h3>Reporte de Biológico</h3>
                    <div style="display: grid; grid-template-columns: min-content 1fr 1fr; gap: 10px; align-items: center; min-width: 0;">
                        <!-- Headers -->
                        <div></div>
                        <div style="text-align: center; font-weight: bold; font-size: 0.9em;">Restantes</div>
                        <div style="text-align: center; font-weight: bold; font-size: 0.9em;">Aplicadas</div>

                        <!-- SRP -->
                        <span class="badge badge-srp">SRP</span>
                        <input type="number" min="0" value="${this.state.formCorteManual.srp_restantes}" data-corte-field="srp_restantes" placeholder="0" style="width: 100%">
                        <input type="number" min="0" value="${this.state.formCorteManual.srp_aplicadas}" data-corte-field="srp_aplicadas" placeholder="0" style="width: 100%">

                        <!-- SR -->
                        <span class="badge badge-sr">SR</span>
                        <input type="number" min="0" value="${this.state.formCorteManual.sr_restantes}" data-corte-field="sr_restantes" placeholder="0" style="width: 100%">
                        <input type="number" min="0" value="${this.state.formCorteManual.sr_aplicadas}" data-corte-field="sr_aplicadas" placeholder="0" style="width: 100%">

                        <!-- VPH -->
                        <span class="badge badge-vph">VPH</span>
                        <input type="number" min="0" value="${this.state.formCorteManual.vph_restantes}" data-corte-field="vph_restantes" placeholder="0" style="width: 100%">
                        <input type="number" min="0" value="${this.state.formCorteManual.vph_aplicadas}" data-corte-field="vph_aplicadas" placeholder="0" style="width: 100%">
                    </div>
                </div>

                <!-- Seccion: Control de fichas -->
                <div class="form-section">
                    <h3>Control de Fichas</h3>
                    <div class="inventario-inputs">
                        <div class="inventario-input-group">
                            <label>Fichas Distribuidas:</label>
                            <input
                                type="number"
                                min="0"
                                value="${this.state.formCorteManual.fichas_distribuidas}"
                                data-corte-field="fichas_distribuidas"
                                id="fichas-distribuidas"
                            />
                        </div>
                        <div class="inventario-input-group">
                            <label>Fichas Entregadas:</label>
                            <input
                                type="number"
                                min="0"
                                value="${this.state.formCorteManual.fichas_entregadas}"
                                data-corte-field="fichas_entregadas"
                                id="fichas-entregadas"
                            />
                        </div>
                        <div class="inventario-input-group fichas-restantes">
                            <label>Fichas Restantes:</label>
                            <span class="fichas-restantes-value" id="fichas-restantes-display">
                                ${fichasRest >= 0 ? fichasRest : 0}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Notas (opcional):</label>
                    <textarea
                        rows="3"
                        placeholder="Observaciones adicionales..."
                        data-corte-field="notas"
                    >${this.state.formCorteManual.notas}</textarea>
                </div>

                <button class="btn btn-primary" data-action="enviar-corte">
                    Enviar Corte Manual
                </button>
            </div>
        `;
    }

    renderVistaCerrarTurno() {
        if (!this.state.turnoActivo) {
            return '<div class="empty-state"><p>No hay turno activo</p></div>';
        }

        // Validación defensiva: asegurar que fichas es un array
        if (!Array.isArray(this.state.fichas)) {
            this.state.fichas = [];
        }

        const turno = this.state.turnoActivo;
        // Contar fichas emitidas pendientes de aplicar
        const fichasEmitidas = this.state.fichas.filter(f => f.estado === 'EMITIDA').length;

        return `
            <div class="abrir-turno-form">
                <h2>Cerrar Turno</h2>

                <div class="alert-info">
                    ${fichasEmitidas > 0 ? `
                        <p><strong>Atencion:</strong> Hay ${fichasEmitidas} fichas EMITIDAS pendientes de aplicar.</p>
                        <p>Si cierra el turno, estas fichas pasaran a estado NO_UTILIZADA.</p>
                    ` : `
                        <p>Todas las fichas emitidas han sido procesadas.</p>
                    `}
                </div>

                <div class="form-section">
                    <h3>Resumen del Turno</h3>
                    <p><strong>Tipo:</strong> ${turno.tipo}</p>
                    <p><strong>SRP Emitidas:</strong> ${turno.srp_emitidas} / ${turno.srp_inicial}</p>
                    <p><strong>SR Emitidas:</strong> ${turno.sr_emitidas} / ${turno.sr_inicial}</p>
                    <p><strong>VPH Emitidas:</strong> ${turno.vph_emitidas} / ${turno.vph_inicial}</p>
                    <hr>
                    <p><strong>SRP Aplicadas:</strong> ${turno.srp_aplicadas}</p>
                    <p><strong>SR Aplicadas:</strong> ${turno.sr_aplicadas}</p>
                    <p><strong>VPH Aplicadas:</strong> ${turno.vph_aplicadas}</p>
                </div>

                <div class="form-section">
                    <h3>Reporte de Sobrantes</h3>
                    <p class="subtext">Ingrese las dosis fisicas sobrantes para verificacion de inventario.</p>
                    <div class="inventario-inputs">
                        <div class="inventario-input-group">
                            <span class="badge badge-srp">SRP</span>
                            <label>Sobrantes:</label>
                            <input type="number" min="0" value="0" id="sobrantes-srp" />
                        </div>
                        <div class="inventario-input-group">
                            <span class="badge badge-sr">SR</span>
                            <label>Sobrantes:</label>
                            <input type="number" min="0" value="0" id="sobrantes-sr" />
                        </div>
                        <div class="inventario-input-group">
                            <span class="badge badge-vph">VPH</span>
                            <label>Sobrantes:</label>
                            <input type="number" min="0" value="0" id="sobrantes-vph" />
                        </div>
                    </div>
                </div>

                <button class="btn btn-danger btn-large" data-action="cerrar-turno">
                    Cerrar Turno
                </button>
            </div>
        `;
    }

    attachEventListeners() {
        // Navegación tabs
        const tabs = document.querySelectorAll('[data-vista]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.cambiarVista(tab.dataset.vista);
            });
        });

        // Tipo de turno
        const tipoTurnoBtns = document.querySelectorAll('[data-tipo]');
        tipoTurnoBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.state.formAbrirTurno.tipo = btn.dataset.tipo;
                this.render();
            });
        });

        // Inputs inventario (abrir turno)
        const inventarioInputs = document.querySelectorAll('[data-field]');
        inventarioInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.state.formAbrirTurno[input.dataset.field] = parseInt(input.value, 10) || 0;
            });
        });

        // Inputs corte manual con calculo automatico de fichas
        const corteInputs = document.querySelectorAll('[data-corte-field]');
        corteInputs.forEach(input => {
            input.addEventListener('input', () => {
                this.state.formCorteManual[input.dataset.corteField] = input.value;

                // Recalcular fichas restantes en tiempo real
                if (input.dataset.corteField === 'fichas_distribuidas' || input.dataset.corteField === 'fichas_entregadas') {
                    const dist = parseInt(this.state.formCorteManual.fichas_distribuidas, 10) || 0;
                    const entr = parseInt(this.state.formCorteManual.fichas_entregadas, 10) || 0;
                    const rest = dist - entr;
                    const display = document.getElementById('fichas-restantes-display');
                    if (display) {
                        display.textContent = rest >= 0 ? rest : 0;
                        display.style.color = rest < 0 ? '#e74c3c' : '#27ae60';
                    }
                }
            });
        });

        // Botón abrir turno
        const btnAbrirTurno = document.querySelector('[data-action="abrir-turno"]');
        if (btnAbrirTurno) {
            btnAbrirTurno.addEventListener('click', () => this.abrirTurno());
        }

        // Botón cerrar turno
        const btnCerrarTurno = document.querySelector('[data-action="cerrar-turno"]');
        if (btnCerrarTurno) {
            btnCerrarTurno.addEventListener('click', () => this.cerrarTurno());
        }

        // Botones crear dispositivo
        const btnCrearReg = document.querySelector('[data-action="crear-registrador"]');
        if (btnCrearReg) {
            btnCrearReg.addEventListener('click', () => this.crearDispositivo('REGISTRADOR'));
        }

        const btnCrearAplic = document.querySelector('[data-action="crear-aplicador"]');
        if (btnCrearAplic) {
            btnCrearAplic.addEventListener('click', () => this.crearDispositivo('APLICADOR'));
        }

        // Botones copiar URL
        const btnCopiar = document.querySelectorAll('.btn-copiar[data-url]');
        btnCopiar.forEach(btn => {
            btn.addEventListener('click', async () => {
                const url = btn.dataset.url;
                const success = await copyToClipboard(url);
                if (success) {
                    showToast('URL copiada al portapapeles', 'success');
                } else {
                    showToast('No se pudo copiar. Copia manualmente la URL', 'error');
                }
            });
        });

        // Botones revocar dispositivo
        const btnRevocar = document.querySelectorAll('[data-dispositivo-id]');
        btnRevocar.forEach(btn => {
            btn.addEventListener('click', () => {
                this.revocarDispositivo(btn.dataset.dispositivoId);
            });
        });

        // Botón asignar bloque
        const btnAsignarBloque = document.querySelector('[data-action="asignar-bloque"]');
        if (btnAsignarBloque) {
            btnAsignarBloque.addEventListener('click', () => this.asignarBloque());
        }

        // Botón enviar corte
        const btnEnviarCorte = document.querySelector('[data-action="enviar-corte"]');
        if (btnEnviarCorte) {
            btnEnviarCorte.addEventListener('click', () => this.enviarCorteManual());
        }
    }
}

// Inicializar aplicación
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CoordinadorApp());
} else {
    new CoordinadorApp();
}

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
        console.error('Service Worker registration failed:', err);
    });
}
