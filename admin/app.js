/**
 * TURNO-PVU - Dashboard Administrativo
 * FASE 8: Dashboard para Coordinador General
 */

import { CONFIG } from '../shared/config.js';
import { api } from '../shared/api.js';
import { auth } from '../shared/auth.js';
import { showToast, formatTime, formatDate } from '../shared/utils.js';

class AdminApp {
    constructor() {

        this.state = {
            centros: [],
            centrosFiltrados: [],
            usuarios: [],
            centrosAdmin: [],
            currentView: 'dashboard',
            autoRefreshInterval: null,
            countdown: 60,
            filtros: {
                municipio: '',
                estado: ''
            }
        };

        this.init();
    }

    async init() {
        // Verificar autenticación
        if (!auth.isAuthenticated()) {
            window.location.href = '../registro/index.html';
            return;
        }

        // Verificar que sea ADMIN
        const user = auth.getUser();
        if (user.rol !== 'ADMIN') {
            showToast('Acceso denegado. Solo administradores.', 'error');
            setTimeout(() => {
                auth.logout();
                window.location.href = '../registro/index.html';
            }, 2000);
            return;
        }

        // Mostrar info del usuario
        document.getElementById('user-info').textContent = `👤 ${user.username} (${user.rol})`;

        // Configurar event listeners
        this.setupEventListeners();

        // Cargar datos iniciales
        await this.cargarDashboard();

        // Iniciar auto-refresh
        this.iniciarAutoRefresh();
    }

    setupEventListeners() {
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            auth.logout();
            window.location.href = '../registro/index.html';
        });

        // Navegación por pestañas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.cambiarVista(view);
            });
        });

        // Botón refresh dashboard
        document.getElementById('refresh-dashboard').addEventListener('click', () => {
            this.cargarDashboard();
        });

        // Filtros
        document.getElementById('filtro-municipio').addEventListener('change', (e) => {
            this.state.filtros.municipio = e.target.value;
            this.aplicarFiltros();
        });

        document.getElementById('filtro-estado').addEventListener('change', (e) => {
            this.state.filtros.estado = e.target.value;
            this.aplicarFiltros();
        });

        // Exportar reportes
        document.getElementById('exportar-vacunacion').addEventListener('click', () => {
            this.exportarReporteVacunacion();
        });

        document.getElementById('exportar-rechazos').addEventListener('click', () => {
            this.exportarReporteRechazos();
        });

        document.getElementById('exportar-vph').addEventListener('click', () => {
            this.exportarReporteVPH();
        });

        // Gestión de usuarios
        document.getElementById('crear-usuario-btn').addEventListener('click', () => {
            this.mostrarModalUsuario();
        });

        document.getElementById('form-usuario').addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarUsuario();
        });

        // Gestión de centros
        document.getElementById('crear-centro-btn').addEventListener('click', () => {
            this.mostrarModalCentro();
        });

        document.getElementById('form-centro').addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarCentro();
        });

        // Cerrar modales
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.cerrarModales();
            });
        });

        // Cerrar modal al hacer click fuera
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.cerrarModales();
                }
            });
        });

        // Fechas por defecto en reportes
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('fecha-inicio').value = hoy;
        document.getElementById('fecha-fin').value = hoy;
    }

    cambiarVista(view) {
        // Actualizar estado
        this.state.currentView = view;

        // Actualizar tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });

        // Actualizar vistas
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        document.getElementById(`view-${view}`).classList.add('active');

        // Cargar datos según vista
        if (view === 'dashboard') {
            this.cargarDashboard();
        } else if (view === 'usuarios') {
            this.cargarUsuarios();
        } else if (view === 'centros') {
            this.cargarCentrosAdmin();
        }
    }

    async cargarDashboard() {
        try {
            this.mostrarLoading(true);

            const data = await api.get('/dashboard');

            if (data.success) {
                this.state.centros = data.centros || [];
                this.actualizarKPIs(data);
                this.poblarFiltroMunicipios();
                this.aplicarFiltros();
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error cargando dashboard:', error);
            showToast('Error al cargar dashboard', 'error');
            this.mostrarLoading(false);
        }
    }

    actualizarKPIs(data) {
        // Totales consolidados
        const totalSRP = data.centros.reduce((sum, c) => sum + (c.srp_aplicadas || 0), 0);
        const totalSR = data.centros.reduce((sum, c) => sum + (c.sr_aplicadas || 0), 0);
        const totalVPH = data.centros.reduce((sum, c) => sum + (c.vph_aplicadas || 0), 0);
        const centrosActivos = data.centros.filter(c => c.turno_abierto).length;

        document.getElementById('total-srp').textContent = totalSRP;
        document.getElementById('total-sr').textContent = totalSR;
        document.getElementById('total-vph').textContent = totalVPH;
        document.getElementById('centros-activos').textContent = centrosActivos;
    }

    poblarFiltroMunicipios() {
        const municipios = [...new Set(this.state.centros.map(c => c.municipio))].sort();
        const select = document.getElementById('filtro-municipio');

        // Mantener opción "Todos"
        select.innerHTML = '<option value="">Todos</option>';

        municipios.forEach(municipio => {
            const option = document.createElement('option');
            option.value = municipio;
            option.textContent = municipio;
            select.appendChild(option);
        });
    }

    aplicarFiltros() {
        let filtrados = [...this.state.centros];

        // Filtro por municipio
        if (this.state.filtros.municipio) {
            filtrados = filtrados.filter(c => c.municipio === this.state.filtros.municipio);
        }

        // Filtro por estado (semáforo)
        if (this.state.filtros.estado) {
            filtrados = filtrados.filter(c => {
                const estado = this.calcularEstadoCentro(c);
                return estado === this.state.filtros.estado;
            });
        }

        this.state.centrosFiltrados = filtrados;
        this.renderTablaCentros();
    }

    calcularEstadoCentro(centro) {
        if (!centro.turno_abierto) return 'gris';

        // Calcular % disponible de cada biológico
        const porcentajes = [];

        if (centro.srp_inicial > 0) {
            const disponible = centro.srp_inicial - centro.srp_emitidas;
            const porcentaje = (disponible / centro.srp_inicial) * 100;
            porcentajes.push(porcentaje);
        }

        if (centro.sr_inicial > 0) {
            const disponible = centro.sr_inicial - centro.sr_emitidas;
            const porcentaje = (disponible / centro.sr_inicial) * 100;
            porcentajes.push(porcentaje);
        }

        if (centro.vph_inicial > 0) {
            const disponible = centro.vph_inicial - centro.vph_emitidas;
            const porcentaje = (disponible / centro.vph_inicial) * 100;
            porcentajes.push(porcentaje);
        }

        if (porcentajes.length === 0) return 'gris';

        // El estado es el peor de todos los biológicos
        const minPorcentaje = Math.min(...porcentajes);

        if (minPorcentaje === 0) return 'rojo';
        if (minPorcentaje <= 20) return 'amarillo';
        return 'verde';
    }

    renderTablaCentros() {
        const tbody = document.getElementById('centros-tbody');
        tbody.innerHTML = '';

        if (this.state.centrosFiltrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No hay centros que mostrar con los filtros seleccionados
                    </td>
                </tr>
            `;
            return;
        }

        this.state.centrosFiltrados.forEach(centro => {
            const tr = document.createElement('tr');

            // Semáforo
            const estado = this.calcularEstadoCentro(centro);
            const iconoEstado = {
                'verde': '🟢',
                'amarillo': '🟡',
                'rojo': '🔴',
                'gris': '⚫'
            }[estado];

            // SRP
            const srpDisponible = centro.srp_inicial - centro.srp_emitidas;
            const srpPorcentaje = centro.srp_inicial > 0
                ? Math.round((srpDisponible / centro.srp_inicial) * 100)
                : 0;
            const srpClase = srpPorcentaje === 0 ? 'rojo' : srpPorcentaje <= 20 ? 'amarillo' : 'verde';

            // SR
            const srDisponible = centro.sr_inicial - centro.sr_emitidas;
            const srPorcentaje = centro.sr_inicial > 0
                ? Math.round((srDisponible / centro.sr_inicial) * 100)
                : 0;
            const srClase = srPorcentaje === 0 ? 'rojo' : srPorcentaje <= 20 ? 'amarillo' : 'verde';

            // VPH
            const vphDisponible = centro.vph_inicial - centro.vph_emitidas;
            const vphPorcentaje = centro.vph_inicial > 0
                ? Math.round((vphDisponible / centro.vph_inicial) * 100)
                : 0;
            const vphClase = vphPorcentaje === 0 ? 'rojo' : vphPorcentaje <= 20 ? 'amarillo' : 'verde';

            // Total aplicadas
            const totalAplicadas = (centro.srp_aplicadas || 0) +
                (centro.sr_aplicadas || 0) +
                (centro.vph_aplicadas || 0);

            tr.innerHTML = `
                <td class="estado-semaforo estado-${estado}">${iconoEstado}</td>
                <td><strong>${centro.nombre}</strong></td>
                <td>${centro.municipio}</td>
                <td class="progreso ${srpClase}">
                    ${srpDisponible}/${centro.srp_inicial} (${srpPorcentaje}%)
                </td>
                <td class="progreso ${srClase}">
                    ${srDisponible}/${centro.sr_inicial} (${srPorcentaje}%)
                </td>
                <td class="progreso ${vphClase}">
                    ${vphDisponible}/${centro.vph_inicial} (${vphPorcentaje}%)
                </td>
                <td><strong>${totalAplicadas}</strong></td>
                <td>${centro.turno_abierto ? `${centro.turno_tipo}` : 'Cerrado'}</td>
            `;

            tbody.appendChild(tr);
        });
    }

    iniciarAutoRefresh() {
        // Limpiar intervalo anterior si existe
        if (this.state.autoRefreshInterval) {
            clearInterval(this.state.autoRefreshInterval);
        }

        // Countdown cada segundo
        setInterval(() => {
            this.state.countdown--;
            document.getElementById('countdown').textContent = this.state.countdown;

            if (this.state.countdown <= 0) {
                this.state.countdown = 60;
            }
        }, 1000);

        // Auto-refresh cada 60 segundos
        this.state.autoRefreshInterval = setInterval(() => {
            if (this.state.currentView === 'dashboard') {
                this.cargarDashboard();
            }
            this.state.countdown = 60;
        }, 60000);
    }

    // ========== REPORTES ==========

    async exportarReporteVacunacion() {
        try {
            const fechaInicio = document.getElementById('fecha-inicio').value;
            const fechaFin = document.getElementById('fecha-fin').value;

            if (!fechaInicio || !fechaFin) {
                showToast('Seleccione rango de fechas', 'warning');
                return;
            }

            this.mostrarLoading(true);

            const data = await api.get(`/reportes?tipo=vacunacion&desde=${fechaInicio}&hasta=${fechaFin}`);

            if (data.success && data.reporte) {
                this.descargarCSV(data.reporte, `reporte_vacunacion_${fechaInicio}_${fechaFin}.csv`);
                showToast('Reporte descargado', 'success');
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error exportando reporte:', error);
            showToast('Error al exportar reporte', 'error');
            this.mostrarLoading(false);
        }
    }

    async exportarReporteRechazos() {
        try {
            this.mostrarLoading(true);

            const data = await api.get('/reportes?tipo=rechazos');

            if (data.success && data.reporte) {
                this.descargarCSV(data.reporte, `reporte_rechazos_${formatDate(new Date())}.csv`);
                showToast('Reporte descargado', 'success');
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error exportando reporte:', error);
            showToast('Error al exportar reporte', 'error');
            this.mostrarLoading(false);
        }
    }

    async exportarReporteVPH() {
        try {
            this.mostrarLoading(true);

            const data = await api.get('/reportes?tipo=vph');

            if (data.success && data.reporte) {
                this.descargarCSV(data.reporte, `reporte_vph_${formatDate(new Date())}.csv`);
                showToast('Reporte descargado', 'success');
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error exportando reporte:', error);
            showToast('Error al exportar reporte', 'error');
            this.mostrarLoading(false);
        }
    }

    descargarCSV(contenido, nombreArchivo) {
        const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', nombreArchivo);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ========== GESTIÓN DE USUARIOS ==========

    async cargarUsuarios() {
        try {
            this.mostrarLoading(true);

            const data = await api.get('/usuarios');

            if (data.success) {
                this.state.usuarios = data.usuarios || [];
                this.renderTablaUsuarios();

                // Poblar select de centros en modal
                this.poblarSelectCentros();
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error cargando usuarios:', error);
            showToast('Error al cargar usuarios', 'error');
            this.mostrarLoading(false);
        }
    }

    async poblarSelectCentros() {
        try {
            const data = await api.get('/centros');

            if (data.success && data.centros) {
                const select = document.getElementById('usuario-centro');
                select.innerHTML = '<option value="">Sin asignar</option>';

                data.centros.forEach(centro => {
                    const option = document.createElement('option');
                    option.value = centro.id;
                    option.textContent = `${centro.codigo} - ${centro.nombre}`;
                    select.appendChild(option);
                });
            }

        } catch (error) {
            console.error('Error cargando centros:', error);
        }
    }

    renderTablaUsuarios() {
        const tbody = document.getElementById('usuarios-tbody');
        tbody.innerHTML = '';

        if (this.state.usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No hay usuarios registrados
                    </td>
                </tr>
            `;
            return;
        }

        this.state.usuarios.forEach(usuario => {
            const tr = document.createElement('tr');

            const badgeRol = `badge-${usuario.rol.toLowerCase()}`;
            const badgeEstado = usuario.activo ? 'badge-activo' : 'badge-inactivo';

            tr.innerHTML = `
                <td><strong>${usuario.username}</strong></td>
                <td>${usuario.nombre_completo}</td>
                <td><span class="badge ${badgeRol}">${usuario.rol}</span></td>
                <td>${usuario.centro_nombre || 'N/A'}</td>
                <td><span class="badge ${badgeEstado}">${usuario.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <button class="btn-action btn-edit" data-id="${usuario.id}">✏️ Editar</button>
                    <button class="btn-action btn-toggle" data-id="${usuario.id}">
                        ${usuario.activo ? '🔒 Desactivar' : '🔓 Activar'}
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Event listeners para acciones
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.editarUsuario(id);
            });
        });

        tbody.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.toggleUsuario(id);
            });
        });
    }

    mostrarModalUsuario(usuario = null) {
        const modal = document.getElementById('modal-usuario');
        const title = document.getElementById('modal-usuario-title');
        const form = document.getElementById('form-usuario');

        if (usuario) {
            title.textContent = 'Editar Usuario';
            form.dataset.id = usuario.id;
            document.getElementById('usuario-username').value = usuario.username;
            document.getElementById('usuario-nombre').value = usuario.nombre_completo;
            document.getElementById('usuario-password').required = false;
            document.getElementById('usuario-password').placeholder = 'Dejar en blanco para no cambiar';
            document.getElementById('usuario-rol').value = usuario.rol;
            document.getElementById('usuario-centro').value = usuario.centro_id || '';
        } else {
            title.textContent = 'Crear Usuario';
            form.dataset.id = '';
            form.reset();
            document.getElementById('usuario-password').required = true;
            document.getElementById('usuario-password').placeholder = '';
        }

        modal.classList.add('active');
    }

    async guardarUsuario() {
        try {
            const form = document.getElementById('form-usuario');
            const id = form.dataset.id;

            const datos = {
                username: document.getElementById('usuario-username').value,
                nombre_completo: document.getElementById('usuario-nombre').value,
                password: document.getElementById('usuario-password').value,
                rol: document.getElementById('usuario-rol').value,
                centro_id: document.getElementById('usuario-centro').value || null
            };

            this.mostrarLoading(true);

            let response;
            if (id) {
                // Editar
                response = await api.put(`/usuarios/${id}`, datos);
            } else {
                // Crear
                response = await api.post('/usuarios', datos);
            }

            if (response.success) {
                showToast(id ? 'Usuario actualizado' : 'Usuario creado', 'success');
                this.cerrarModales();
                this.cargarUsuarios();
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error guardando usuario:', error);
            showToast('Error al guardar usuario', 'error');
            this.mostrarLoading(false);
        }
    }

    async editarUsuario(id) {
        const usuario = this.state.usuarios.find(u => u.id === id);
        if (usuario) {
            await this.poblarSelectCentros();
            this.mostrarModalUsuario(usuario);
        }
    }

    async toggleUsuario(id) {
        try {
            const usuario = this.state.usuarios.find(u => u.id === id);
            if (!usuario) return;

            const confirmar = confirm(
                `¿Está seguro de ${usuario.activo ? 'desactivar' : 'activar'} al usuario ${usuario.username}?`
            );

            if (!confirmar) return;

            this.mostrarLoading(true);

            const response = await api.patch(`/usuarios/${id}/toggle`, {
                activo: !usuario.activo
            });

            if (response.success) {
                showToast(`Usuario ${usuario.activo ? 'desactivado' : 'activado'}`, 'success');
                this.cargarUsuarios();
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error toggle usuario:', error);
            showToast('Error al cambiar estado de usuario', 'error');
            this.mostrarLoading(false);
        }
    }

    // ========== GESTIÓN DE CENTROS ==========

    async cargarCentrosAdmin() {
        try {
            this.mostrarLoading(true);

            const data = await api.get('/centros');

            if (data.success) {
                this.state.centrosAdmin = data.centros || [];
                this.renderTablaCentrosAdmin();
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error cargando centros:', error);
            showToast('Error al cargar centros', 'error');
            this.mostrarLoading(false);
        }
    }

    renderTablaCentrosAdmin() {
        const tbody = document.getElementById('admin-centros-tbody');
        tbody.innerHTML = '';

        if (this.state.centrosAdmin.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No hay centros registrados
                    </td>
                </tr>
            `;
            return;
        }

        this.state.centrosAdmin.forEach(centro => {
            const tr = document.createElement('tr');

            const badgeEstado = centro.activo ? 'badge-activo' : 'badge-inactivo';

            tr.innerHTML = `
                <td><strong>${centro.codigo}</strong></td>
                <td>${centro.nombre}</td>
                <td>${centro.municipio}</td>
                <td><span class="badge ${badgeEstado}">${centro.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <button class="btn-action btn-edit" data-id="${centro.id}">✏️ Editar</button>
                    <button class="btn-action btn-toggle" data-id="${centro.id}">
                        ${centro.activo ? '🔒 Desactivar' : '🔓 Activar'}
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Event listeners
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.editarCentro(id);
            });
        });

        tbody.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.toggleCentro(id);
            });
        });
    }

    mostrarModalCentro(centro = null) {
        const modal = document.getElementById('modal-centro');
        const title = document.getElementById('modal-centro-title');
        const form = document.getElementById('form-centro');

        if (centro) {
            title.textContent = 'Editar Centro';
            form.dataset.id = centro.id;
            document.getElementById('centro-codigo').value = centro.codigo;
            document.getElementById('centro-nombre').value = centro.nombre;
            document.getElementById('centro-municipio').value = centro.municipio;
        } else {
            title.textContent = 'Crear Centro';
            form.dataset.id = '';
            form.reset();
        }

        modal.classList.add('active');
    }

    async guardarCentro() {
        try {
            const form = document.getElementById('form-centro');
            const id = form.dataset.id;

            const datos = {
                codigo: document.getElementById('centro-codigo').value,
                nombre: document.getElementById('centro-nombre').value,
                municipio: document.getElementById('centro-municipio').value
            };

            this.mostrarLoading(true);

            let response;
            if (id) {
                // Editar
                response = await api.put(`/centros/${id}`, datos);
            } else {
                // Crear
                response = await api.post('/centros', datos);
            }

            if (response.success) {
                showToast(id ? 'Centro actualizado' : 'Centro creado', 'success');
                this.cerrarModales();
                this.cargarCentrosAdmin();
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error guardando centro:', error);
            showToast('Error al guardar centro', 'error');
            this.mostrarLoading(false);
        }
    }

    editarCentro(id) {
        const centro = this.state.centrosAdmin.find(c => c.id === id);
        if (centro) {
            this.mostrarModalCentro(centro);
        }
    }

    async toggleCentro(id) {
        try {
            const centro = this.state.centrosAdmin.find(c => c.id === id);
            if (!centro) return;

            const confirmar = confirm(
                `¿Está seguro de ${centro.activo ? 'desactivar' : 'activar'} el centro ${centro.nombre}?`
            );

            if (!confirmar) return;

            this.mostrarLoading(true);

            const response = await api.patch(`/centros/${id}/toggle`, {
                activo: !centro.activo
            });

            if (response.success) {
                showToast(`Centro ${centro.activo ? 'desactivado' : 'activado'}`, 'success');
                this.cargarCentrosAdmin();
            }

            this.mostrarLoading(false);

        } catch (error) {
            console.error('Error toggle centro:', error);
            showToast('Error al cambiar estado de centro', 'error');
            this.mostrarLoading(false);
        }
    }

    // ========== UTILIDADES ==========

    cerrarModales() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    mostrarLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AdminApp());
} else {
    new AdminApp();
}
