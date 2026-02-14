# Plan de Implementacion: TURNO-PVU
## Sistema de Gestion de Turnos para Puestos de Vacunacion Universal
### Basado en la arquitectura de REGISTRO_RAPIDO (Cloudflare Workers + D1 + Pages)

**Fecha:** 14 de febrero de 2026
**Estado:** Listo para implementacion
**Base:** https://github.com/srmz04/registro-rapido

---

## 1. CONTEXTO

TURNO-PVU controla el flujo de vacunacion de sarampion en 15 centros de salud de Durango.
Se reutiliza la arquitectura de REGISTRO_RAPIDO que ya esta probada en campo y corre en el free tier de Cloudflare.

**Que cambia vs REGISTRO_RAPIDO:**
- REGISTRO_RAPIDO registra vacunacion general (cualquier biologico, cualquier edad)
- TURNO-PVU controla turnos con inventario finito (fichas = dosis disponibles)
- TURNO-PVU tiene 4 roles con permisos diferenciados
- TURNO-PVU genera fichas con QR para control de flujo fisico
- TURNO-PVU bloquea emision cuando se agotan dosis
- TURNO-PVU maneja 3 biologicos: SRP (Triple Viral), SR (Doble Viral) y VPH
- TURNO-PVU opera offline con IndexedDB + Background Sync
- TURNO-PVU permite al Coordinador gestionar dispositivos, URLs y bloques de folios

**Que se mantiene igual:**
- Cloudflare Workers + D1 (cero costo)
- HTML/CSS/JS vanilla (sin frameworks, sin build tools)
- PWA con Service Worker (ampliado con IndexedDB para offline)
- Deploy con `npx wrangler deploy`
- Mobile-first, touch-friendly

---

## 2. ESTRUCTURA DEL PROYECTO

```
TURNO-PVU/
├── PRD_TURNO_PVU.md              # Requisitos (existente)
├── PLAN_IMPLEMENTACION.md        # Este documento
├── CONTRAPUESTA_TECNICA.md       # Adendas de robustez offline y gestion
│
├── backend/
│   ├── worker.js                 # API REST (Cloudflare Worker)
│   ├── schema.sql                # Esquema de base de datos D1
│   ├── seed.sql                  # Datos iniciales (centros + admin)
│   ├── wrangler.toml             # Configuracion Cloudflare
│   └── package.json              # Para wrangler CLI
│
├── shared/                       # Codigo compartido entre modulos
│   ├── config.js                 # URLs, constantes, reglas de negocio (SRP/SR/VPH)
│   ├── api.js                    # Clase ApiClient (fetch + JWT auth + offline queue)
│   ├── auth.js                   # AuthManager + UI de login
│   ├── db.js                     # IndexedDB wrapper (Dexie.js) para persistencia offline
│   ├── sync.js                   # SyncManager: cola de salida + background sync
│   ├── styles-base.css           # CSS base (variables, forms, botones, toasts)
│   └── utils.js                  # Helpers: showToast, formatTime, etc.
│
├── registro/                     # MODULO REGISTRADOR (punto de filtro)
│   ├── index.html                # 3 campos: edad + sexo → genera ficha
│   ├── app.js                    # Clase RegistroApp
│   ├── styles.css
│   ├── sw.js                     # Service Worker (con Background Sync)
│   └── manifest.json             # PWA
│
├── aplicar/                      # MODULO APLICADOR (vacunador)
│   ├── index.html                # Flujo secuencial: confirmar folio predicho → marcar
│   ├── app.js                    # Clase AplicadorApp (prediccion FIFO)
│   ├── styles.css
│   └── manifest.json
│
├── coordinador/                  # MODULO COORDINADOR DE CENTRO
│   ├── index.html                # Abrir turno, monitor, gestion dispositivos, cortes, cerrar turno
│   ├── app.js                    # Clase CoordinadorApp
│   ├── styles.css
│   └── manifest.json
│
├── admin/                        # DASHBOARD GENERAL (coordinador jurisdiccion)
│   ├── index.html                # Tabla 15 centros, KPIs, usuarios, reportes
│   ├── app.js                    # Clase AdminApp
│   ├── styles.css
│   └── manifest.json
│
├── publico/                      # PANEL PUBLICO (sin auth)
│   ├── index.html                # Tarjetas de disponibilidad por centro
│   ├── app.js
│   └── styles.css
│
├── .gitignore
└── icon.png
```

---

## 3. MAPEO REGISTRO_RAPIDO → TURNO-PVU

| Componente REGISTRO_RAPIDO | Evolucion en TURNO-PVU |
|---|---|
| `backend/worker.js` (1 Worker, 3 endpoints, Basic Auth) | 1 Worker, 16+ endpoints, JWT auth, 4 roles |
| `backend/schema.sql` (2 tablas: registros + detalles) | 8 tablas: centros, usuarios, turnos, fichas, auditoria, rechazos, cortes_manuales, bloques_folios |
| `index.html + app.js` (formulario de registro general) | `/registro/` formulario simplificado (solo edad+sexo) + QR |
| `dashboard/` (estadisticas generales) | `/admin/` dashboard con semaforo por centro |
| `config.js` (catalogos de vacunas) | `shared/config.js` (reglas de edad SRP/SR/VPH, centros) |
| `uploader.js` (ProxyUploader) | `shared/api.js` (ApiClient con JWT + offline queue) |
| `data/sedes.json` + `registradores.json` | Migrados a tabla `centros` y `usuarios` en D1 |
| **No existe** | `shared/db.js` + `shared/sync.js` (IndexedDB + Background Sync) |
| **No existe** | `/aplicar/` modulo vacunador con flujo secuencial asistido (prediccion FIFO) |
| **No existe** | `/coordinador/` modulo coord. centro con gestion de dispositivos, URLs, bloques y cortes |
| **No existe** | `/publico/` panel publico de disponibilidad |
| **No existe** | Control de inventario (turnos con dosis finitas: SRP, SR, VPH) |
| **No existe** | Generacion de fichas con QR |
| **No existe** | Persistencia offline (IndexedDB + Background Sync) |
| **No existe** | Gestion de bloques de folios para operacion multi-dispositivo offline |

---

## 4. BACKEND: worker.js

### 4.1 Autenticacion JWT

REGISTRO_RAPIDO usa Basic Auth hardcoded para 1 credencial. TURNO-PVU necesita 4 roles y ~90 usuarios.

- **Login:** POST /api/auth/login → valida password con PBKDF2 → retorna JWT
- **JWT payload:** `{ userId, username, rol, centroId, centroCodigo, exp }`
- **Expiracion:** 8 horas (un turno de trabajo)
- **Almacenamiento frontend:** localStorage (como REGISTRO_RAPIDO guarda lastSede)
- **Header:** `Authorization: Bearer <token>` en cada request
- **Crypto:** Web Crypto API nativa de Cloudflare Workers (HMAC-SHA256 para JWT, PBKDF2 para passwords)

### 4.2 Endpoints

```
POST   /api/auth/login              Sin auth     → JWT token
GET    /api/centros                  JWT: *       → Lista centros activos
POST   /api/turnos/abrir            JWT: COORD+  → Abre turno con inventario SRP/SR/VPH
POST   /api/turnos/cerrar           JWT: COORD+  → Cierra turno
GET    /api/turnos/activo/:centroId  JWT: *       → Turno abierto de un centro
POST   /api/fichas                  JWT: REG+    → Emitir ficha (CORAZON del sistema)
GET    /api/fichas/:folio           JWT: APLIC+  → Buscar ficha por folio
GET    /api/fichas/siguiente/:turnoId JWT: APLIC+ → Siguiente folio predicho (FIFO)
PATCH  /api/fichas/:folio/aplicar   JWT: APLIC+  → Marcar vacuna aplicada
GET    /api/fichas/turno/:turnoId   JWT: COORD+  → Listar fichas de un turno
POST   /api/bloques/asignar         JWT: COORD+  → Asignar bloque de folios a dispositivo
GET    /api/bloques/:turnoId        JWT: COORD+  → Listar bloques asignados
POST   /api/dispositivos/crear      JWT: COORD+  → Generar URL persistente para registrador/vacunador
GET    /api/dispositivos/:centroId  JWT: COORD+  → Listar dispositivos activos del centro
DELETE /api/dispositivos/:id        JWT: COORD+  → Revocar acceso de un dispositivo
POST   /api/cortes                  JWT: COORD+  → Enviar corte informativo manual
GET    /api/dashboard               JWT: ADMIN   → Datos consolidados todos centros
GET    /api/dashboard/:centroId     JWT: COORD+  → Datos de un centro
GET    /api/reportes                JWT: COORD+  → Exportar CSV
GET    /api/publico/disponibilidad  Sin auth     → JSON con cache 60s
POST   /api/sync/batch              JWT: *       → Subida masiva de acciones offline (Background Sync)
```

### 4.3 Logica critica: Emision de Ficha (POST /api/fichas)

```
1. Verificar JWT → obtener centroId del usuario
2. Obtener turno abierto del centro
3. Recibir: { edad_anios, edad_meses, sexo, vph_tenia?, idempotency_key }
4. VALIDAR EDAD:
   - edad < 6 meses → RECHAZADO (INSERT en rechazos, retornar error)
   - edad > 12 años → RECHAZADO
   - 6m - 12a → ACEPTADO
5. DETERMINAR BIOLOGICOS:
   - Si edad <= 10a: asigna SRP (si hay inventario SRP)
   - Si edad 11-12a: asigna SR (si hay inventario SR)
   - VPH: solo si (mujer 11-12a OR hombre 11a) AND no tiene VPH AND inventario VPH > 0
6. VERIFICAR INVENTARIO:
   - Si biologico es SRP: srp_disponible = srp_inicial - srp_emitidas; si <= 0 → DOSIS AGOTADAS
   - Si biologico es SR: sr_disponible = sr_inicial - sr_emitidas; si <= 0 → DOSIS AGOTADAS
7. IDEMPOTENCIA:
   - Buscar ficha con mismo idempotency_key en ultimos 60 seg
   - Si existe → retornar ficha existente (sin crear nueva)
8. BATCH ATOMICO (env.DB.batch):
   a) INSERT ficha con folio generado (asigna_srp o asigna_sr segun edad)
   b) UPDATE turnos SET srp_emitidas/sr_emitidas = +1 WHERE id=? AND emitidas < inicial
   c) Si VPH: UPDATE turnos SET vph_emitidas = vph_emitidas + 1 WHERE ...
9. VERIFICAR que UPDATEs afectaron 1 fila (si 0, race condition → rollback)
10. Retornar ficha completa con folio
```

**Folio:** `PVU-{centroCodigo}-{consecutivo.padStart(4,'0')}`
- Consecutivo por turno, autoincremental

---

## 5. ESQUEMA D1 (schema.sql)

```sql
-- 1. CENTROS DE SALUD
CREATE TABLE IF NOT EXISTS centros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,         -- 'CS001'
    nombre TEXT NOT NULL,                -- 'CS Durango Centro'
    municipio TEXT NOT NULL,
    activo INTEGER DEFAULT 1
);

-- 2. USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    centro_id INTEGER,
    rol TEXT NOT NULL CHECK (rol IN ('REGISTRADOR','APLICADOR','COORDINADOR','ADMIN')),
    activo INTEGER DEFAULT 1,
    FOREIGN KEY (centro_id) REFERENCES centros(id)
);

-- 3. TURNOS
CREATE TABLE IF NOT EXISTS turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('MATUTINO','VESPERTINO')),
    srp_inicial INTEGER NOT NULL CHECK (srp_inicial >= 0),
    sr_inicial INTEGER NOT NULL DEFAULT 0,
    vph_inicial INTEGER NOT NULL DEFAULT 0,
    srp_emitidas INTEGER DEFAULT 0,
    sr_emitidas INTEGER DEFAULT 0,
    vph_emitidas INTEGER DEFAULT 0,
    srp_aplicadas INTEGER DEFAULT 0,
    sr_aplicadas INTEGER DEFAULT 0,
    vph_aplicadas INTEGER DEFAULT 0,
    abierto INTEGER DEFAULT 1,
    usuario_apertura INTEGER NOT NULL,
    ts_apertura TEXT DEFAULT (datetime('now')),
    ts_cierre TEXT,
    FOREIGN KEY (centro_id) REFERENCES centros(id),
    FOREIGN KEY (usuario_apertura) REFERENCES usuarios(id)
);

-- 4. FICHAS
CREATE TABLE IF NOT EXISTS fichas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE NOT NULL,
    turno_id INTEGER NOT NULL,
    consecutivo INTEGER NOT NULL,
    edad_anios INTEGER NOT NULL,
    edad_meses INTEGER NOT NULL,
    sexo TEXT NOT NULL CHECK (sexo IN ('M','F')),
    asigna_srp INTEGER DEFAULT 0,
    asigna_sr INTEGER DEFAULT 0,
    asigna_vph INTEGER DEFAULT 0,
    vph_preguntado INTEGER DEFAULT 0,
    vph_tenia INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'EMITIDA' CHECK (estado IN ('EMITIDA','APLICADA','NO_UTILIZADA','CANCELADA','REEMITIDA')),
    motivo_cancelacion TEXT,
    folio_reemplazo TEXT,
    ts_emision TEXT DEFAULT (datetime('now')),
    ts_aplicacion TEXT,
    usuario_registro_id INTEGER NOT NULL,
    usuario_aplicacion_id INTEGER,
    idempotency_key TEXT,
    FOREIGN KEY (turno_id) REFERENCES turnos(id),
    FOREIGN KEY (usuario_registro_id) REFERENCES usuarios(id),
    FOREIGN KEY (usuario_aplicacion_id) REFERENCES usuarios(id)
);

-- 5. AUDITORIA
CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    accion TEXT NOT NULL,
    entidad TEXT,
    entidad_id INTEGER,
    detalle TEXT,
    ip TEXT,
    ts TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- 6. RECHAZOS
CREATE TABLE IF NOT EXISTS rechazos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    edad_anios INTEGER NOT NULL,
    edad_meses INTEGER NOT NULL,
    sexo TEXT,
    motivo TEXT NOT NULL,
    ts TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
);

-- 7. CORTES MANUALES (respaldo cuando falla internet en dispositivos)
CREATE TABLE IF NOT EXISTS cortes_manuales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    srp_restantes INTEGER,
    sr_restantes INTEGER,
    vph_restantes INTEGER,
    notas TEXT,
    ts TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (turno_id) REFERENCES turnos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- 8. BLOQUES DE FOLIOS (asignacion a dispositivos para operacion offline)
CREATE TABLE IF NOT EXISTS bloques_folios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    dispositivo_token TEXT NOT NULL,
    folio_inicio INTEGER NOT NULL,
    folio_fin INTEGER NOT NULL,
    consumidos INTEGER DEFAULT 0,
    ts_asignacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
);

-- 9. DISPOSITIVOS (URLs persistentes generadas por el Coordinador)
CREATE TABLE IF NOT EXISTS dispositivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('REGISTRADOR','APLICADOR')),
    nombre TEXT NOT NULL,                -- 'MeeBox Registro 1'
    url_generada TEXT NOT NULL,
    activo INTEGER DEFAULT 1,
    ts_creacion TEXT DEFAULT (datetime('now')),
    creado_por INTEGER NOT NULL,
    FOREIGN KEY (centro_id) REFERENCES centros(id),
    FOREIGN KEY (creado_por) REFERENCES usuarios(id)
);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_fichas_folio ON fichas(folio);
CREATE INDEX IF NOT EXISTS idx_fichas_turno ON fichas(turno_id);
CREATE INDEX IF NOT EXISTS idx_fichas_estado ON fichas(estado);
CREATE INDEX IF NOT EXISTS idx_fichas_idempotency ON fichas(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_turnos_centro_abierto ON turnos(centro_id, abierto);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_ts ON auditoria(ts);
CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_unico ON turnos(centro_id, fecha, tipo);
CREATE INDEX IF NOT EXISTS idx_dispositivos_centro ON dispositivos(centro_id);
CREATE INDEX IF NOT EXISTS idx_bloques_turno ON bloques_folios(turno_id);
```

---

## 6. MODULOS FRONTEND (DETALLE)

### 6.1 Registro (/registro/) — Registrador

**Pantallas (SPA con estados, patron de REGISTRO_RAPIDO/app.js):**

1. **Login overlay** → usuario + password → JWT en localStorage
2. **Sin turno** → "NO HAY TURNO ABIERTO" + poll cada 30s
3. **Formulario** →
   - Indicadores: "SRP: 73/120 disponibles | SR: 5/10 disponibles | VPH: 10/25 disponibles"
   - Barra de estado: CONECTADO (verde) o MODO CONTINGENCIA (naranja)
   - Campo: Edad años (input numerico)
   - Campo: Edad meses (input numerico)
   - Selector: Sexo (2 botones grandes MASCULINO | FEMENINO)
   - Boton: **GENERAR FICHA** (verde, gigante)
4. **Pregunta VPH** (modal) → "Tiene esquema de VPH?" → SI / NO
5. **Ficha generada** (pantalla completa para foto) →
   - Folio gigante: `PVU-001-0047`
   - QR centrado (qrcode.js, solo contiene el folio)
   - Biologico: "SRP", "SR", "SR + VPH" segun edad
   - Turno #, hora, centro
   - "PRESENTE ESTA PANTALLA AL VACUNADOR"
   - Boton: **SIGUIENTE**
6. **Rechazo** → fondo rojo, "EDAD NO AUTORIZADA", boton SIGUIENTE

**Offline:** Si no hay internet, la ficha se genera localmente usando el bloque de folios pre-asignado y se encola para sync.

**QR:** `<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>`

### 6.2 Aplicar (/aplicar/) — Vacunador (Flujo Secuencial Asistido)

**Concepto: Prediccion FIFO.** El sistema muestra el siguiente folio esperado y el vacunador solo confirma.

**Pantalla principal:**
- Muestra en grande: **"SIGUIENTE: FOLIO 0045"** (basado en consecutivo)
- Datos del paciente: "Nino 7 anios"
- Boton dinamico segun edad del paciente:
  - <10 anios: **[APLICAR SRP]** (naranja)
  - >10 anios: **[APLICAR SR]** (morado)
  - 11 anios mujer: **[SR]** + **[VPH]** (dos botones)
- Boton: **[SALTAR]** (si el folio actual no corresponde)
- Boton pequeno: **[Teclado Manual]** (busqueda por numero, solo en excepciones)
- Lista: ultimas 10 aplicaciones

**Seguridad Anti-Error:**
- Si el folio no ha sido emitido o ya fue aplicado, el sistema vibra y muestra error rojo
- Si es folio de otro centro: warning amarillo + opcion aplicar de todas formas

### 6.3 Coordinador (/coordinador/)

- **Abrir turno:** tipo (MAT/VESP) + dosis SRP + dosis SR + dosis VPH → INICIAR
- **Monitor:** barras de progreso SRP/SR/VPH, semaforo, contadores, lista fichas
- **Gestion de Dispositivos:**
  - Boton **[CREAR REGISTRADOR]** → genera URL persistente
  - Boton **[CREAR VACUNADOR]** → genera URL persistente
  - Tabla de dispositivos activos con opcion de revocar
- **Distribucion de Bloques:** Asignar rangos de folios a cada dispositivo registrador
- **Cortes Manuales (Respaldo):** Formulario para reportar dosis restantes cuando falla internet en los dispositivos
- **Buscar ficha:** para cancelar/reemitir (solo coordinador)
- **Cerrar turno:** resumen + warning fichas pendientes + sobrantes

### 6.4 Admin (/admin/)

**Patron base: REGISTRO_RAPIDO/dashboard/**
- Tabla 15 centros con semaforo (verde >20%, amarillo <=20%, rojo =0)
- KPIs consolidados (SRP, SR, VPH por separado)
- Auto-refresh cada 60s con countdown
- Gestion usuarios y centros
- Exportar CSV

### 6.5 Publico (/publico/)

- Sin auth, sin JS pesado
- Tarjetas por centro: DISPONIBLE (verde) | ULTIMOS TURNOS (amarillo) | AGOTADO (rojo)
- Auto-refresh cada 60s
- Cache-Control: public, max-age=60

### 6.6 Persistencia Offline (shared/db.js + shared/sync.js)

**Tecnologia:** IndexedDB (via Dexie.js) + Service Worker con Background Sync (via Workbox).

**Funcionamiento:**
- Con internet: cada accion (POST /api/fichas, PATCH aplicar) va al servidor y se guarda localmente como respaldo.
- Sin internet: las acciones se guardan en IndexedDB (cola de salida). El registrador/vacunador sigue operando.
- Al recuperar internet: el Service Worker sube automaticamente las acciones pendientes en segundo plano.

**Indicador visual en todas las pantallas:**
- Barra superior verde: "CONECTADO"
- Barra superior naranja: "MODO CONTINGENCIA - Sin conexion"

---

## 7. DEPLOY EN CLOUDFLARE

```bash
# Crear base de datos D1
cd backend
npx wrangler d1 create turno-pvu-db
# → Copiar database_id al wrangler.toml

# Ejecutar esquema
npx wrangler d1 execute turno-pvu-db --file=schema.sql

# Cargar datos iniciales
npx wrangler d1 execute turno-pvu-db --file=seed.sql

# Configurar secreto JWT
npx wrangler secret put JWT_SECRET

# Deploy del Worker (backend)
npx wrangler deploy

# Deploy del Frontend (Cloudflare Pages)
cd ..
npx wrangler pages deploy . --project-name=turno-pvu --branch=main
```

**URLs resultantes:**
- Backend: `https://turno-pvu-backend.{tu-subdomain}.workers.dev`
- Registro: `https://turno-pvu.pages.dev/registro/`
- Aplicar: `https://turno-pvu.pages.dev/aplicar/`
- Coordinador: `https://turno-pvu.pages.dev/coordinador/`
- Admin: `https://turno-pvu.pages.dev/admin/`
- Publico: `https://turno-pvu.pages.dev/publico/`

**Free tier:** Mas que suficiente (~15K requests/dia vs limite 100K).

---

## 8. PASOS DE IMPLEMENTACION — FASE 1 (MVP)

| # | Paso | Archivos | Horas est. |
|---|---|---|---|
| 1 | Backend base (Worker + esquema + seed + 3 biologicos) | `backend/*` | 6-8h |
| 2 | Shared frontend (config, api, auth, css, IndexedDB, sync) | `shared/*` | 3-4h |
| 3 | Modulo registro (formulario + QR + offline queue) | `registro/*` | 4-5h |
| 4 | Modulo aplicar (flujo secuencial FIFO + SR/SRP dinamico) | `aplicar/*` | 4-5h |
| 5 | Modulo coordinador MVP (turno + monitor + gestion dispositivos + bloques + cortes) | `coordinador/*` | 5-6h |
| 6 | Panel publico | `publico/*` | 1h |
| 7 | Deploy + pruebas end-to-end + offline testing | - | 3-4h |
| **Total** | | | **26-33h** |

**Fase 2 (Post-MVP): +10-12h**
- Dashboard admin completo con gestion de usuarios global
- Reportes CSV avanzados
- Alertas visuales/sonoras de desabasto
- Graficas en dashboard

---

## 9. VERIFICACION END-TO-END

- [ ] Login con cada rol accede solo a su modulo
- [ ] Coordinador abre turno con 120 SRP + 30 SR + 25 VPH
- [ ] Coordinador genera URLs persistentes para registradores y vacunadores
- [ ] Coordinador asigna bloques de folios a cada dispositivo registrador
- [ ] Registrador emite ficha para menor de 7 años → SRP, folio + QR
- [ ] Registrador emite ficha para niña de 11 → SR + pregunta VPH → SR + VPH
- [ ] Registrador intenta emitir para adulto de 35 → RECHAZADO
- [ ] Inventario se decrementa con cada ficha emitida (SRP, SR y VPH por separado)
- [ ] Al agotar inventario de un biologico → bloqueo automatico
- [ ] Vacunador ve "SIGUIENTE: FOLIO 0045" → confirma con 1 click → APLICADA
- [ ] Vacunador presiona [SALTAR] cuando el siguiente folio no corresponde
- [ ] Vacunador usa teclado manual en escenario de desorden
- [ ] Boton del vacunador muestra dinamicamente SRP (naranja) o SR (morado)
- [ ] Aplicador intenta re-aplicar → "YA APLICADA" en rojo
- [ ] Panel publico muestra disponibilidad correcta con semaforo
- [ ] Coordinador cierra turno → resumen correcto (SRP, SR, VPH)
- [ ] OFFLINE: Desconectar internet en MeeBox → registrador sigue emitiendo fichas localmente
- [ ] OFFLINE: Reconectar → las fichas se sincronizan automaticamente
- [ ] OFFLINE: Coordinador envia corte manual desde celular → dashboard se actualiza
- [ ] Todo funciona en MeeBox 2018 con navegador web
- [ ] Todo funciona en celular (mobile-first)
