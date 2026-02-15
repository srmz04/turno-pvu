/**
 * TURNO-PVU - Panel Público
 * FASE 7: JavaScript vanilla sin frameworks
 */

import { CONFIG } from '../shared/config.js';

class PanelPublico {
    constructor() {
        // Usar configuracion centralizada para la URL de la API
        this.apiUrl = CONFIG.API_BASE_URL;

        this.state = {
            centros: [],
            centrosFiltrados: [],
            filtros: {
                municipio: '',
                estado: ''
            },
            ultimaActualizacion: null,
            autoRefreshInterval: null
        };

        this.init();
    }

    init() {
        // Cargar tema guardado o detectar preferencia del sistema
        this.initTema();

        // Cargar datos iniciales
        this.cargarDatos();

        // Configurar event listeners
        this.setupEventListeners();

        // Auto-refresh cada 60 segundos
        this.iniciarAutoRefresh();
    }

    initTema() {
        const temaGuardado = localStorage.getItem('theme');
        const preferenciaSistema = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const tema = temaGuardado || preferenciaSistema;

        document.documentElement.setAttribute('data-theme', tema);
        this.actualizarIconoTema(tema);

        // Escuchar cambios en preferencia del sistema
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                const nuevoTema = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', nuevoTema);
                this.actualizarIconoTema(nuevoTema);
            }
        });
    }

    actualizarIconoTema(tema) {
        const btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.textContent = tema === 'dark' ? '☀️' : '🌙';
            btn.title = tema === 'dark' ? 'Modo claro' : 'Modo oscuro';
        }
    }

    toggleTema() {
        const temaActual = document.documentElement.getAttribute('data-theme');
        const nuevoTema = temaActual === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nuevoTema);
        localStorage.setItem('theme', nuevoTema);
        this.actualizarIconoTema(nuevoTema);
    }

    setupEventListeners() {
        // Botón actualizar
        const btnRefresh = document.getElementById('refresh-btn');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => this.cargarDatos());
        }

        // Botón tema
        const btnTheme = document.getElementById('theme-toggle');
        if (btnTheme) {
            btnTheme.addEventListener('click', () => this.toggleTema());
        }

        // Filtro municipio
        const filtroMunicipio = document.getElementById('municipio-filter');
        if (filtroMunicipio) {
            filtroMunicipio.addEventListener('change', (e) => {
                this.state.filtros.municipio = e.target.value;
                this.aplicarFiltros();
            });
        }

        // Filtro estado
        const filtroEstado = document.getElementById('estado-filter');
        if (filtroEstado) {
            filtroEstado.addEventListener('change', (e) => {
                this.state.filtros.estado = e.target.value;
                this.aplicarFiltros();
            });
        }
    }

    async cargarDatos() {
        try {
            this.mostrarEstado('loading');

            const response = await fetch(`${this.apiUrl}/publico/disponibilidad`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success || !data.centros) {
                throw new Error('Formato de respuesta inválido');
            }

            this.state.centros = data.centros;
            this.state.ultimaActualizacion = new Date(data.timestamp);

            // Poblar filtro de municipios
            this.poblarFiltroMunicipios();

            // Aplicar filtros y renderizar
            this.aplicarFiltros();

            // Actualizar timestamp
            this.actualizarTimestamp();

            this.mostrarEstado('success');

        } catch (error) {
            console.error('Error cargando datos:', error);
            this.mostrarError(error.message);
        }
    }

    poblarFiltroMunicipios() {
        const municipios = [...new Set(this.state.centros.map(c => c.municipio))].sort();
        const select = document.getElementById('municipio-filter');

        if (select) {
            // Mantener opción "Todos"
            select.innerHTML = '<option value="">Todos</option>';

            municipios.forEach(municipio => {
                const option = document.createElement('option');
                option.value = municipio;
                option.textContent = municipio;
                select.appendChild(option);
            });
        }
    }

    aplicarFiltros() {
        let filtrados = [...this.state.centros];

        // Filtro por municipio
        if (this.state.filtros.municipio) {
            filtrados = filtrados.filter(c => c.municipio === this.state.filtros.municipio);
        }

        // Filtro por estado
        if (this.state.filtros.estado) {
            filtrados = filtrados.filter(c => c.estado === this.state.filtros.estado);
        }

        this.state.centrosFiltrados = filtrados;
        this.render();
    }

    render() {
        this.renderResumen();
        this.renderCentros();
    }

    renderResumen() {
        const disponibles = this.state.centros.filter(c => c.estado === 'DISPONIBLE').length;
        const ultimos = this.state.centros.filter(c => c.estado === 'ULTIMOS_TURNOS').length;
        const agotados = this.state.centros.filter(c => c.estado === 'AGOTADO').length;

        const elemDisponibles = document.getElementById('total-disponibles');
        const elemUltimos = document.getElementById('total-ultimos');
        const elemAgotados = document.getElementById('total-agotados');

        if (elemDisponibles) elemDisponibles.textContent = disponibles;
        if (elemUltimos) elemUltimos.textContent = ultimos;
        if (elemAgotados) elemAgotados.textContent = agotados;
    }

    renderCentros() {
        const container = document.getElementById('centros-grid');
        const emptyState = document.getElementById('empty-state');

        if (!container) return;

        if (this.state.centrosFiltrados.length === 0) {
            container.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';

        container.innerHTML = this.state.centrosFiltrados.map(centro =>
            this.renderCentroCard(centro)
        ).join('');
    }

    renderCentroCard(centro) {
        const estadoTexto = {
            'DISPONIBLE': '✅ Disponible',
            'ULTIMOS_TURNOS': '⚠️ Últimos turnos',
            'AGOTADO': '❌ Agotado',
            'SIN_TURNO': '⏸ Sin turno'
        };

        let inventarioHTML = '';
        if (centro.turno_abierto) {
            inventarioHTML = `
                <div class="centro-inventario">
                    <div class="inventario-item">
                        <span class="inventario-label badge-srp">SRP Triple Viral</span>
                        <span class="inventario-valor">${centro.srp_disponible || 0}</span>
                    </div>
                    <div class="inventario-item">
                        <span class="inventario-label badge-sr">SR Doble Viral</span>
                        <span class="inventario-valor">${centro.sr_disponible || 0}</span>
                    </div>
                    <div class="inventario-item">
                        <span class="inventario-label badge-vph">VPH</span>
                        <span class="inventario-valor">${centro.vph_disponible || 0}</span>
                    </div>
                </div>
            `;
        } else {
            inventarioHTML = `
                <div class="centro-info">
                    ℹ️ Este centro no tiene turno abierto en este momento.
                </div>
            `;
        }

        let infoAdicional = '';
        if (centro.turno_abierto) {
            const tipoTurno = centro.turno_tipo === 'MATUTINO' ? '☀️ Matutino' : '🌙 Vespertino';
            const horaApertura = new Date(centro.ts_apertura).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit'
            });
            infoAdicional = `
                <div class="centro-info">
                    ${tipoTurno} • Abierto desde ${horaApertura}
                </div>
            `;
        }

        return `
            <div class="centro-card estado-${centro.estado} fade-in">
                <div class="centro-header">
                    <div class="centro-nombre">${centro.nombre}</div>
                    <div class="centro-municipio">
                        📍 ${centro.municipio}
                    </div>
                </div>

                <div class="centro-estado estado-${centro.estado}">
                    ${estadoTexto[centro.estado] || centro.estado}
                </div>

                ${inventarioHTML}
                ${infoAdicional}
            </div>
        `;
    }

    actualizarTimestamp() {
        const elem = document.getElementById('last-update');
        if (!elem || !this.state.ultimaActualizacion) return;

        const ahora = new Date();
        const diff = Math.floor((ahora - this.state.ultimaActualizacion) / 1000);

        let texto;
        if (diff < 60) {
            texto = `Actualizado hace ${diff} segundo${diff !== 1 ? 's' : ''}`;
        } else {
            const minutos = Math.floor(diff / 60);
            texto = `Actualizado hace ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
        }

        elem.textContent = `📡 ${texto} • ${this.state.ultimaActualizacion.toLocaleTimeString('es-MX')}`;
    }

    iniciarAutoRefresh() {
        // Limpiar intervalo anterior si existe
        if (this.state.autoRefreshInterval) {
            clearInterval(this.state.autoRefreshInterval);
        }

        // Auto-refresh cada 60 segundos
        this.state.autoRefreshInterval = setInterval(() => {
            this.cargarDatos();
        }, 60000);

        // Actualizar timestamp cada 10 segundos
        setInterval(() => {
            this.actualizarTimestamp();
        }, 10000);
    }

    mostrarEstado(tipo) {
        const loading = document.getElementById('loading-state');
        const error = document.getElementById('error-state');
        const centros = document.getElementById('centros-grid');
        const summary = document.getElementById('summary');

        if (loading) loading.style.display = tipo === 'loading' ? 'block' : 'none';
        if (error) error.style.display = tipo === 'error' ? 'block' : 'none';
        if (centros) centros.style.display = tipo === 'success' ? 'grid' : 'none';
        if (summary) summary.style.display = tipo === 'success' ? 'block' : 'none';
    }

    mostrarError(mensaje) {
        this.mostrarEstado('error');
        const errorMsg = document.getElementById('error-message');
        if (errorMsg) {
            errorMsg.textContent = mensaje || 'Error desconocido al cargar datos';
        }
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PanelPublico());
} else {
    new PanelPublico();
}
