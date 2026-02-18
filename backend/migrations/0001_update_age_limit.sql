-- Migration: Update Age Limit to 19 Years
-- Date: 2026-02-17
-- Description: Re-creates 'fichas' table to update CHECK constraint from 15 to 19 years.

-- 1. Rename existing table
ALTER TABLE fichas RENAME TO fichas_old;

-- 2. Create new table with updated constraint
CREATE TABLE fichas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE NOT NULL,
    turno_id INTEGER NOT NULL,
    consecutivo INTEGER NOT NULL,
    
    -- Datos del paciente (UPDATED CHECK)
    edad_anios INTEGER NOT NULL CHECK (edad_anios >= 0 AND edad_anios <= 19),
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
    tiempo_espera_min INTEGER,
    
    -- Usuarios responsables
    usuario_registro_id INTEGER NOT NULL,
    usuario_aplicacion_id INTEGER,
    
    -- Idempotencia y trazabilidad
    idempotency_key TEXT,
    lote_biologico TEXT,
    
    FOREIGN KEY (turno_id) REFERENCES turnos(id),
    FOREIGN KEY (usuario_registro_id) REFERENCES usuarios(id),
    FOREIGN KEY (usuario_aplicacion_id) REFERENCES usuarios(id),
    
    CHECK (asigna_srp = 1 OR asigna_sr = 1),
    CHECK (NOT (asigna_srp = 1 AND asigna_sr = 1))
);

-- 3. Copy data
INSERT INTO fichas SELECT * FROM fichas_old;

-- 4. Re-create indexes
CREATE INDEX idx_fichas_folio ON fichas(folio);
CREATE INDEX idx_fichas_turno_estado ON fichas(turno_id, estado);
CREATE INDEX idx_fichas_idempotency ON fichas(idempotency_key);
CREATE INDEX idx_fichas_usuario_registro ON fichas(usuario_registro_id);

-- 5. Drop old table
DROP TABLE fichas_old;
