-- Migración: Agregar columnas faltantes a cortes_manuales
-- Fecha: 2026-02-17
-- Descripción: La tabla original solo tenía (turno_id, usuario_id, srp/sr/vph_restantes, notas, ts).
--              El código ya enviaba campos adicionales que no existían en la BD,
--              causando que los INSERT fallaran silenciosamente.
--
-- Ejecutar con:
--   npx wrangler d1 execute turno-pvu-db-prod --config=wrangler.prod.toml --file=migrations/001-cortes-manuales-columns.sql

-- Campos de dosis aplicadas
ALTER TABLE cortes_manuales ADD COLUMN srp_aplicadas INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN sr_aplicadas INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN vph_aplicadas INTEGER DEFAULT 0;

-- Campos de inventario inicial
ALTER TABLE cortes_manuales ADD COLUMN srp_inicial INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN sr_inicial INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN vph_inicial INTEGER DEFAULT 0;

-- Campos de entradas adicionales durante turno
ALTER TABLE cortes_manuales ADD COLUMN srp_entradas INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN sr_entradas INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN vph_entradas INTEGER DEFAULT 0;

-- Snapshot de emitidas al momento del corte (para calcular delta en dashboard)
ALTER TABLE cortes_manuales ADD COLUMN srp_emitidas_al_corte INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN sr_emitidas_al_corte INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN vph_emitidas_al_corte INTEGER DEFAULT 0;

-- Campos de fichas
ALTER TABLE cortes_manuales ADD COLUMN fichas_distribuidas INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN fichas_entregadas INTEGER DEFAULT 0;
ALTER TABLE cortes_manuales ADD COLUMN fichas_restantes INTEGER DEFAULT 0;
