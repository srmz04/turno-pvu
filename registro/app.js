import { auth } from '../shared/auth.js';
import { api } from '../shared/api.js';
import { db } from '../shared/db.js';
import { syncManager } from '../shared/sync.js';
import { CONFIG, determineEligibility } from '../shared/config.js';
import { showToast, getNetworkQuality } from '../shared/utils.js';
import { monitor } from '../shared/monitoring.js';

class RegistroApp {
  constructor() {
    this.appEl = document.getElementById('app');
    this.offlineBanner = document.getElementById('offline-banner');
    this.state = {
      view: 'LOADING', // LOGIN, CHECK_TURNO, NO_TURNO, FORM, CONFIRM, SUCCESS, REJECT
      turno: null,
      formData: {},
      lastFicha: null,
      isOffline: !navigator.onLine
    };

    this.init();
  }

  async init() {
    monitor.trackPageView('/registro');

    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
    this.updateOnlineStatus(navigator.onLine);

    // Auto-sync start
    syncManager.startAutoSync();

    // Check Auth
    if (!auth.isAuthenticated()) {
      this.renderLogin();
      return;
    }

    // Check Turno
    await this.checkTurno();

    // Initial blocks sync
    this.syncBlocks();
  }

  updateOnlineStatus(isOnline) {
    this.state.isOffline = !isOnline;
    if (this.state.isOffline) {
      this.offlineBanner.classList.remove('hidden');
    } else {
      this.offlineBanner.classList.add('hidden');
    }
  }

  async checkTurno() {
    try {
      const user = auth.getUser();
      // Compatibilidad con backend (camelCase)
      const centroId = user.centroId || user.centro_id;

      if (!centroId) {
        showToast('Usuario sin centro asignado', 'error');
        auth.logout();
        this.renderLogin();
        return;
      }

      // Try API first
      try {
        const response = await api.get(`/turnos/activo/${centroId}`);

        if (response && response.turno) {
          this.state.turno = response.turno;
          // Cache turno locally
          await db.put('catalogos', { key: 'turno_activo', value: this.state.turno });
        } else {
          this.state.turno = null;
          // Clear cached turno if online says no turno? 
          // Careful with offline sync. If offline, use cache.
        }
      } catch (e) {
        // If offline/error, try cache
        if (this.state.isOffline) {
          const cached = await db.get('catalogos', 'turno_activo');
          if (cached) {
            this.state.turno = cached.value;
            showToast('Usando turno en caché (Offline)', 'warning');
          }
        } else {
          throw e;
        }
      }

      if (this.state.turno) {
        this.renderForm();
      } else {
        this.renderNoTurno();
      }

    } catch (error) {
      console.error('Error checking turno', error);
      this.renderNoTurno(); // Or error view
    }
  }

  renderLogin() {
    this.state.view = 'LOGIN';
    this.appEl.innerHTML = `
      <div class="login-container">
        <div class="card text-center">
          <h2 class="mb-4">PVU Registro</h2>
          <form id="login-form">
            <div class="form-group">
              <input type="text" id="username" placeholder="Usuario" class="giant-input" required>
            </div>
            <div class="form-group">
              <input type="password" id="password" placeholder="Contraseña" class="giant-input" required>
            </div>
            <button type="submit" class="btn btn-primary btn-large w-full">Entrar</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('login-form').onsubmit = async (e) => {
      e.preventDefault();
      const user = document.getElementById('username').value;
      const pass = document.getElementById('password').value;
      try {
        await auth.login(user, pass);
        // Verificar rol
        if (!auth.checkRole(['REGISTRADOR', 'COORDINADOR', 'ADMIN'])) {
          showToast('Rol no autorizado', 'error');
          auth.logout();
          this.renderLogin();
          return;
        }
        this.checkTurno();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  renderNoTurno() {
    this.state.view = 'NO_TURNO';
    this.appEl.innerHTML = `
      <div class="container p-20 text-center">
        <h2>Sin Turno Activo</h2>
        <p>No hay vacunación activa en este momento.</p>
        <button id="retry-btn" class="btn btn-secondary btn-large">
          <i class="fas fa-sync"></i> Reintentar
        </button>
      </div>
    `;
    document.getElementById('retry-btn').onclick = () => this.checkTurno();
  }

  renderForm() {
    this.state.view = 'FORM';
    const user = auth.getUser();

    this.appEl.innerHTML = `
      <div class="status-bar">
        <span><i class="fas fa-user"></i> ${user.nombre}</span>
        <span><i class="fas fa-clinic-medical"></i> ${this.state.turno?.centro_codigo || ''}</span>
      </div>
      
      <div class="form-container">
        <div class="card">
          <h2 class="text-center mb-4">Nueva Ficha</h2>
          
          <form id="registro-form">
            <!-- Edad -->
            <div class="form-group">
              <label>Edad (Años)</label>
              <input type="number" id="edad_anios" class="giant-input" min="0" max="15" required placeholder="0">
            </div>
            
            <div class="form-group">
              <label>Edad (Meses)</label>
              <input type="number" id="edad_meses" class="giant-input" min="0" max="11" required placeholder="0">
            </div>

            <!-- Sexo -->
            <label>Sexo</label>
            <div class="sex-selection">
              <div class="sex-btn" data-value="M" onclick="app.selectSex('M')">
                <i class="fas fa-male fa-2x"></i>
                Hombre
              </div>
              <div class="sex-btn" data-value="F" onclick="app.selectSex('F')">
                <i class="fas fa-female fa-2x"></i>
                Mujer
              </div>
            </div>
            <input type="hidden" id="sexo" required>

            <button type="submit" class="btn btn-primary btn-large w-full">
              Siguiente <i class="fas fa-arrow-right"></i>
            </button>
          </form>
        </div>
      </div>
    `;

    // Expose selectSex globally for onclick
    window.app = this;

    document.getElementById('registro-form').onsubmit = (e) => this.handleFormSubmit(e);
  }

  selectSex(val) {
    document.getElementById('sexo').value = val;
    document.querySelectorAll('.sex-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`.sex-btn[data-value="${val}"]`).classList.add('selected');
  }

  async handleFormSubmit(e) {
    e.preventDefault();

    const anios = parseInt(document.getElementById('edad_anios').value);
    const meses = parseInt(document.getElementById('edad_meses').value);
    const sexo = document.getElementById('sexo').value;

    if (!sexo) {
      showToast('Seleccione el sexo', 'warning');
      return;
    }

    // 1. Validar Elegibilidad
    const eligibility = determineEligibility(anios, meses, sexo);

    if (!eligibility.eligible) {
      this.renderRejection(eligibility.reason);
      return;
    }

    // 2. Check for VPH override
    this.state.formData = {
      edad_anios: anios,
      edad_meses: meses,
      sexo: sexo,
      biologics: eligibility.biologics,
      idempotency_key: crypto.randomUUID()
    };

    if (eligibility.biologics.includes('VPH')) {
      this.renderVPHModal();
    } else {
      this.submitFicha();
    }
  }

  renderVPHModal() {
    // Simple overlay modal
    const modalHtml = `
      <div id="vph-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:1000;display:flex;justify-content:center;align-items:center;">
        <div class="card" style="width:90%;max-width:400px;">
          <h3>Candidato a VPH</h3>
          <p>El paciente es elegible para vacuna VPH.</p>
          <div class="form-group">
            <label>¿Ya ha recibido VPH anteriormente?</label>
            <div style="display:flex;gap:10px;margin-top:10px;">
               <button type="button" class="btn btn-secondary flex-1" onclick="app.resolveVPH(true)">SÍ (Ya tiene)</button>
               <button type="button" class="btn btn-primary flex-1" onclick="app.resolveVPH(false)">NO (Primera vez)</button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.appEl.insertAdjacentHTML('beforeend', modalHtml);
  }

  resolveVPH(tenia) {
    document.getElementById('vph-modal').remove();
    this.state.formData.vph_tenia = tenia;
    this.submitFicha();
  }

  async submitFicha() {
    showToast('Procesando...', 'info', 1000);

    try {
      // Offline Logic Check
      let offlineData = null;
      if (this.state.isOffline) {
        // Generar folio offline
        offlineData = await this.generateOfflineFolio();
        if (!offlineData) {
          showToast('Error: Sin folios offline disponibles. Contacte al coordinador.', 'error');
          return;
        }

        this.state.formData.folio = offlineData.folio;
        this.state.formData.consecutivo = offlineData.consecutivo;
      }

      // API Call
      // api.post queues internally if offline-capable error occurs
      // But we handled offline explicitly above to get the folio.
      // So we call api.post regardless.
      // If offline, api.post will queue the body (which now includes `folio` and `consecutivo`).
      // And return { offline: true, success: true }

      const response = await api.post('/fichas', this.state.formData);

      if (response.success || response.offline) {
        // If online response has `ficha`, use it.
        // If offline response, use our local data.
        const fichaFinal = response.ficha || {
          ...this.state.formData,
          // Add visuals if missing from response
          biologico: this.state.formData.biologics.join('+'), // Simplified
          ts_emision: new Date().toISOString()
        };

        this.renderSuccess(fichaFinal);
      } else {
        showToast(response.message || 'Error al crear ficha', 'error');
      }

    } catch (error) {
      console.error('Submit error', error);
      showToast('Error al enviar ficha: ' + error.message, 'error');
    }
  }

  async generateOfflineFolio() {
    // Get assigned block
    // We need a store 'bloques' in db.js or query generic 'catalogos'
    // For MVP, assuming user downloaded blocks when online or has hardcoded logic?
    // Actually, Phase 2 created endpoints for blocks. SyncManager/App should fetch blocks when online.
    // Let's check if we have blocks in DB.

    // Quick Fix: Retrieve blocks from `catalogos` (assuming we synced them)
    // We need logic to fetch blocks on init.
    // For now, if no block logic implemented, we can't do TRUE offline generation.
    // But the requirements say "Generar localmente usando bloque".
    // I need to fetch blocks when online.

    // I will add `syncBlocks` to init.

    // For this implementation, I will simulate getting the next one from a stored block.
    // We need a `blocks` store in DB really.
    // I'll use `localStorage` for simple block tracking or `db.put('catalogos', {key:'bloque_activo', ...})`.

    const bloque = await db.get('catalogos', 'bloque_activo');
    if (!bloque || !bloque.value) return null; // No block assigned

    const b = bloque.value;
    if (b.consumidos >= (b.folio_fin - b.folio_inicio + 1)) return null; // Block full

    const consecutivo = b.folio_inicio + b.consumidos;
    const centroCodigo = this.state.turno.centro_codigo || 'OFF';
    const folio = `PVU-${centroCodigo}-${String(consecutivo).padStart(4, '0')}`;

    // Verify locally not used (double check)
    // Update local block usage immediately to prevent reuse
    b.consumidos++;
    await db.put('catalogos', { key: 'bloque_activo', value: b });

    return { folio, consecutivo };
  }

  async syncBlocks() {
    if (this.state.isOffline || !this.state.turno) return;

    try {
      const deviceToken = localStorage.getItem('turno_pvu_device_token');
      // Si no tenemos token de dispositivo, no podemos tener bloques asignados en este modelo
      // salvo que el backend soporte asignacion por usuario (que no soporta actualmente).
      if (!deviceToken) return;

      // Fetch blocks for current turno
      const res = await api.get(`/bloques/${this.state.turno.id}`);

      if (res.success && res.bloques) {
        // Filter blocks assigned to THIS device
        const myBlocks = res.bloques.filter(b => b.dispositivo_token === deviceToken);

        if (myBlocks.length > 0) {
          // Store the first active one with available folios
          const activeBlock = myBlocks.find(b => b.consumidos < (b.folio_fin - b.folio_inicio + 1));
          if (activeBlock) {
            await db.put('catalogos', { key: 'bloque_activo', value: activeBlock });
            console.log('Bloque offline sincronizado:', activeBlock);
          }
        }
      }
    } catch (e) {
      console.warn('Sync blocks failed', e);
      monitor.trackError(e, { context: 'syncBlocks' });
    }
  }

  renderSuccess(ficha) {
    this.state.view = 'SUCCESS';
    const uniqueId = `qr-${Date.now()}`;

    this.appEl.innerHTML = `
      <div class="success-view" onclick="app.resetForm()">
        <h1><i class="fas fa-check-circle"></i> Ficha Emitida</h1>
        <div class="folio-display">${ficha.folio}</div>
        
        <div class="qr-placeholder" id="${uniqueId}"></div>
        
        <p class="text-large">
          ${ficha.biologics ? ficha.biologics.join(' + ') : (ficha.asigna_srp ? 'SRP' : 'SR')} 
          ${ficha.asigna_vph || ficha.vph_tenia ? '+ VPH' : ''}
        </p>
        
        <p class="mt-4 text-small opacity-75">Toque cualquier parte para continuar</p>
      </div>
    `;

    // Generate QR
    new QRCode(document.getElementById(uniqueId), {
      text: ficha.folio,
      width: 180,
      height: 180
    });

    // Auto reset after 5s
    setTimeout(() => {
      if (this.state.view === 'SUCCESS') this.resetForm();
    }, 5000);
  }

  renderRejection(reason) {
    this.state.view = 'REJECT';
    this.appEl.innerHTML = `
       <div class="container p-20 text-center" style="background:var(--error-color); color:white; min-height:100vh; display:flex; flex-direction:column; justify-content:center;">
         <i class="fas fa-times-circle fa-4x mb-4"></i>
         <h2>No Candidato</h2>
         <p class="text-xl">${reason}</p>
         <button class="btn btn-outline" style="border-color:white; color:white; margin-top:20px;" onclick="app.resetForm()">Regresar</button>
       </div>
     `;
  }

  resetForm() {
    this.state.formData = {};
    this.renderForm();
    // Background sync blocks check
    this.syncBlocks();
  }
}

new RegistroApp();
