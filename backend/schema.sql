-- TURNO-PVU Database Schema
-- Sistema de Gestión de Turnos para Puestos de Vacunación Universal
-- Versión: 2.0 con mejoras logísticas y de observabilidad
-- Fecha: 14 febrero 2026

-- ============================================================================
-- 1. CENTROS DE SALUD
-- ============================================================================
CREATE TABLE IF NOT EXISTS centros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,            -- 'CS001'
    nombre TEXT NOT NULL,                   -- 'CS Durango Centro'
    municipio TEXT NOT NULL,                -- 'Durango'
    latitud REAL,                           -- Coordenadas GPS para rutas
    longitud REAL,
    capacidad_max_dia INTEGER DEFAULT 200, -- Capacidad estimada fichas/día
    activo INTEGER DEFAULT 1,
    CHECK (latitud IS NULL OR (latitud >= -90 AND latitud <= 90)),
    CHECK (longitud IS NULL OR (longitud >= -180 AND longitud <= 180)),
    CHECK (capacidad_max_dia > 0)
);

-- ============================================================================
-- 2. USUARIOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    centro_id INTEGER,
    rol TEXT NOT NULL CHECK (rol IN ('REGISTRADOR','APLICADOR','COORDINADOR','ADMIN')),
    activo INTEGER DEFAULT 1,
    ultimo_login TEXT,                      -- Timestamp último acceso
    intentos_fallidos INTEGER DEFAULT 0,    -- Para bloqueo de cuenta
    FOREIGN KEY (centro_id) REFERENCES centros(id)
);

-- ============================================================================
-- 3. TURNOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,                    -- DATE 'YYYY-MM-DD'
    tipo TEXT NOT NULL CHECK (tipo IN ('MATUTINO','VESPERTINO')),
    
    -- Inventario inicial por biológico
    srp_inicial INTEGER NOT NULL CHECK (srp_inicial >= 0),
    sr_inicial INTEGER NOT NULL DEFAULT 0 CHECK (sr_inicial >= 0),
    vph_inicial INTEGER NOT NULL DEFAULT 0 CHECK (vph_inicial >= 0),
    
    -- Contadores de fichas emitidas
    srp_emitidas INTEGER DEFAULT 0,
    sr_emitidas INTEGER DEFAULT 0,
    vph_emitidas INTEGER DEFAULT 0,
    
    -- Contadores de fichas aplicadas
    srp_aplicadas INTEGER DEFAULT 0,
    sr_aplicadas INTEGER DEFAULT 0,
    vph_aplicadas INTEGER DEFAULT 0,
    
    -- Control del turno
    abierto INTEGER DEFAULT 1,
    usuario_apertura INTEGER NOT NULL,
    ts_apertura TEXT DEFAULT (datetime('now')),
    ts_cierre TEXT,
    
    -- Métricas operativas
    duracion_promedio_ficha REAL,          -- Segundos promedio por ficha
    
    FOREIGN KEY (centro_id) REFERENCES centros(id),
    FOREIGN KEY (usuario_apertura) REFERENCES usuarios(id),
    
    -- Validaciones
    CHECK (srp_emitidas <= srp_inicial),
    CHECK (sr_emitidas <= sr_inicial),
    CHECK (vph_emitidas <= vph_inicial),
    CHECK (srp_aplicadas <= srp_emitidas),
    CHECK (sr_aplicadas <= sr_emitidas),
    CHECK (vph_aplicadas <= vph_emitidas)
);

-- ============================================================================
-- 4. FICHAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS fichas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE NOT NULL,             -- 'PVU-CS001-0047'
    turno_id INTEGER NOT NULL,
    consecutivo INTEGER NOT NULL,
    
    -- Datos del paciente
    edad_anios INTEGER NOT NULL CHECK (edad_anios >= 0 AND edad_anios <= 15),
    edad_meses INTEGER NOT NULL CHECK (edad_meses >= 0 AND edad_meses <= 11),
    sexo TEXT NOT NULL CHECK (sexo IN ('M','F')),
    
    -- Asignación de biológicos
    asigna_srp INTEGER DEFAULT 0,
    asigna_sr INTEGER DEFAULT 0,
    asigna_vph INTEGER DEFAULT 0,
    vph_preguntado INTEGER DEFAULT 0,
    vph_tenia INTEGER DEFAULT 0,
    
    -- Estado y trazabilidad
    estado TEXT DEFAULT 'EMITIDA' CHECK (estado IN ('EMITIDA','APLICADA','NO_UTILIZADA','CANCELADA','REEMITIDA')),
    motivo_cancelacion TEXT,
    folio_reemplazo TEXT,
    
    -- Timestamps
    ts_emision TEXT DEFAULT (datetime('now')),
    ts_aplicacion TEXT,
    
    -- Métricas
    tiempo_espera_min INTEGER,              -- Tiempo de emisión a aplicación
    
    -- Usuarios responsables
    usuario_registro_id INTEGER NOT NULL,
    usuario_aplicacion_id INTEGER,
    
    -- Idempotencia y trazabilidad
    idempotency_key TEXT,
    lote_biologico TEXT,                    -- Número de lote del biológico aplicado
    
    FOREIGN KEY (turno_id) REFERENCES turnos(id),
    FOREIGN KEY (usuario_registro_id) REFERENCES usuarios(id),
    FOREIGN KEY (usuario_aplicacion_id) REFERENCES usuarios(id),
    
    -- Validaciones lógicas
    CHECK (asigna_srp = 1 OR asigna_sr = 1),  -- Debe tener al menos SRP o SR
    CHECK (NOT (asigna_srp = 1 AND asigna_sr = 1)) -- No puede tener ambos
);

-- ============================================================================
-- 5. AUDITORIA
-- ============================================================================
CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    accion TEXT NOT NULL,                   -- 'FICHA_EMITIDA', 'TURNO_ABIERTO', etc.
    entidad TEXT,                           -- 'ficha', 'turno', 'usuario'
    entidad_id INTEGER,
    detalle TEXT,                           -- JSON con detalles adicionales
    ip TEXT,
    user_agent TEXT,                        -- Para detección de dispositivos
    ts TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ============================================================================
-- 6. RECHAZOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS rechazos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    edad_anios INTEGER NOT NULL,
    edad_meses INTEGER NOT NULL,
    sexo TEXT,
    motivo TEXT NOT NULL,                   -- 'MENOR_6M', 'MAYOR_12A'
    ts TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
);

-- ============================================================================
-- 7. CORTES MANUALES (Respaldo cuando falla internet en dispositivos)
-- ============================================================================
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

-- ============================================================================
-- 8. BLOQUES DE FOLIOS (Asignación a dispositivos para operación offline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bloques_folios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turno_id INTEGER NOT NULL,
    dispositivo_token TEXT NOT NULL,
    folio_inicio INTEGER NOT NULL,
    folio_fin INTEGER NOT NULL,
    consumidos INTEGER DEFAULT 0,
    ts_asignacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (turno_id) REFERENCES turnos(id),
    CHECK (folio_fin >= folio_inicio),
    CHECK (consumidos >= 0 AND consumidos <= (folio_fin - folio_inicio + 1))
);

-- ============================================================================
-- 9. DISPOSITIVOS (URLs persistentes generadas por el Coordinador)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dispositivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('REGISTRADOR','APLICADOR')),
    nombre TEXT NOT NULL,                   -- 'MeeBox Registro 1'
    url_generada TEXT NOT NULL,
    activo INTEGER DEFAULT 1,
    ts_creacion TEXT DEFAULT (datetime('now')),
    creado_por INTEGER NOT NULL,
    ultimo_acceso TEXT,                     -- Para health check
    FOREIGN KEY (centro_id) REFERENCES centros(id),
    FOREIGN KEY (creado_por) REFERENCES usuarios(id)
);

-- ============================================================================
-- 10. LOTES BIOLOGICOS (Trazabilidad y cadena de frío) [NUEVO]
-- ============================================================================
CREATE TABLE IF NOT EXISTS lotes_biologicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biologico TEXT NOT NULL CHECK (biologico IN ('SRP','SR','VPH')),
    numero_lote TEXT NOT NULL,
    fecha_caducidad TEXT NOT NULL,         -- 'YYYY-MM-DD'
    cantidad_inicial INTEGER NOT NULL CHECK (cantidad_inicial > 0),
    cantidad_actual INTEGER NOT NULL CHECK (cantidad_actual >= 0),
    temperatura_min REAL,                   -- Temperatura mínima de almacenamiento
    temperatura_max REAL,                   -- Temperatura máxima de almacenamiento
    proveedor TEXT,
    fecha_recepcion TEXT DEFAULT (date('now')),
    CHECK (cantidad_actual <= cantidad_inicial),
    UNIQUE(biologico, numero_lote)
);

-- ============================================================================
-- 11. TRANSFERENCIAS DE INVENTARIO (Redistribución entre centros) [NUEVO]
-- ============================================================================
CREATE TABLE IF NOT EXISTS transferencias_inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro_origen INTEGER NOT NULL,
    centro_destino INTEGER NOT NULL,
    biologico TEXT NOT NULL CHECK (biologico IN ('SRP','SR','VPH')),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    motivo TEXT,
    usuario_autoriza INTEGER NOT NULL,
    ts TEXT DEFAULT (datetime('now')),
    estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','COMPLETADA','CANCELADA')),
    FOREIGN KEY (centro_origen) REFERENCES centros(id),
    FOREIGN KEY (centro_destino) REFERENCES centros(id),
    FOREIGN KEY (usuario_autoriza) REFERENCES usuarios(id),
    CHECK (centro_origen != centro_destino)
);

-- ============================================================================
-- 12. METRICAS OPERATIVAS (KPIs por centro) [NUEVO]
-- ============================================================================
CREATE TABLE IF NOT EXISTS metricas_operativas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,                    -- 'YYYY-MM-DD'
    tiempo_promedio_registro_seg REAL,
    tiempo_promedio_aplicacion_seg REAL,
    fichas_por_hora REAL,
    tasa_rechazo_pct REAL,
    tasa_no_utilizadas_pct REAL,
    FOREIGN KEY (centro_id) REFERENCES centros(id),
    UNIQUE(centro_id, fecha)
);

-- ============================================================================
-- 13. ALERTAS (Sistema de alertas centralizado) [NUEVO]
-- ============================================================================
CREATE TABLE IF NOT EXISTS alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,                     -- 'INVENTARIO_BAJO', 'CUELLO_BOTELLA', etc.
    severidad TEXT NOT NULL CHECK (severidad IN ('BAJA','MEDIA','ALTA','CRITICA')),
    centro_id INTEGER,
    mensaje TEXT NOT NULL,
    detalle TEXT,                           -- JSON con detalles
    resuelta INTEGER DEFAULT 0,
    ts_creacion TEXT DEFAULT (datetime('now')),
    ts_resolucion TEXT,
    usuario_resolucion INTEGER,
    FOREIGN KEY (centro_id) REFERENCES centros(id),
    FOREIGN KEY (usuario_resolucion) REFERENCES usuarios(id)
);

-- ============================================================================
-- 14. CONFIGURACION (Parámetros del sistema) [NUEVO]
-- ============================================================================
CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT CHECK (tipo IN ('STRING','NUMBER','JSON','BOOLEAN')),
    actualizado_por INTEGER,
    ts_actualizacion TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (actualizado_por) REFERENCES usuarios(id)
);

-- ============================================================================
-- INDICES PARA PERFORMANCE
-- ============================================================================

-- Fichas
CREATE INDEX IF NOT EXISTS idx_fichas_folio ON fichas(folio);
CREATE INDEX IF NOT EXISTS idx_fichas_turno_estado ON fichas(turno_id, estado);
CREATE INDEX IF NOT EXISTS idx_fichas_idempotency ON fichas(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_fichas_usuario_registro ON fichas(usuario_registro_id);

-- Turnos
CREATE INDEX IF NOT EXISTS idx_turnos_centro_abierto ON turnos(centro_id, abierto);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_unico ON turnos(centro_id, fecha, tipo);

-- Auditoria
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_ts ON auditoria(usuario_id, ts);
CREATE INDEX IF NOT EXISTS idx_auditoria_ts_desc ON auditoria(ts DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id);

-- Alertas
CREATE INDEX IF NOT EXISTS idx_alertas_resuelta_severidad ON alertas(resuelta, severidad, ts_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_centro ON alertas(centro_id, resuelta);

-- Dispositivos
CREATE INDEX IF NOT EXISTS idx_dispositivos_centro_activo ON dispositivos(centro_id, activo);

-- Bloques de folios
CREATE INDEX IF NOT EXISTS idx_bloques_turno ON bloques_folios(turno_id);

-- Lotes biologicos
CREATE INDEX IF NOT EXISTS idx_lotes_biologico_caducidad ON lotes_biologicos(biologico, fecha_caducidad);

-- Transferencias
CREATE INDEX IF NOT EXISTS idx_transferencias_estado ON transferencias_inventario(estado, ts DESC);

-- Metricas
CREATE INDEX IF NOT EXISTS idx_metricas_centro_fecha ON metricas_operativas(centro_id, fecha DESC);

-- ============================================================================
-- VIEWS PARA CONSULTAS COMUNES
-- ============================================================================

-- Vista de inventario actual por centro
CREATE VIEW IF NOT EXISTS v_inventario_actual AS
SELECT 
    c.id as centro_id,
    c.codigo,
    c.nombre,
    t.id as turno_id,
    t.fecha,
    t.tipo,
    (t.srp_inicial - t.srp_emitidas) as srp_disponible,
    (t.sr_inicial - t.sr_emitidas) as sr_disponible,
    (t.vph_inicial - t.vph_emitidas) as vph_disponible,
    t.srp_emitidas,
    t.sr_emitidas,
    t.vph_emitidas,
    t.srp_aplicadas,
    t.sr_aplicadas,
    t.vph_aplicadas
FROM centros c
LEFT JOIN turnos t ON c.id = t.centro_id AND t.abierto = 1
WHERE c.activo = 1;

-- Vista de alertas activas
CREATE VIEW IF NOT EXISTS v_alertas_activas AS
SELECT 
    a.id,
    a.tipo,
    a.severidad,
    c.nombre as centro,
    a.mensaje,
    a.ts_creacion,
    CAST((julianday('now') - julianday(a.ts_creacion)) * 24 AS INTEGER) as horas_sin_resolver
FROM alertas a
LEFT JOIN centros c ON a.centro_id = c.id
WHERE a.resuelta = 0
ORDER BY 
    CASE a.severidad 
        WHEN 'CRITICA' THEN 1 
        WHEN 'ALTA' THEN 2 
        WHEN 'MEDIA' THEN 3 
        ELSE 4 
    END,
    a.ts_creacion DESC;

