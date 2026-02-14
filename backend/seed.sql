-- TURNO-PVU Seed Data
-- Datos iniciales para desarrollo y pruebas
-- Fecha: 14 febrero 2026

-- ============================================================================
-- 1. CENTROS DE SALUD REALES DE DURANGO
-- ============================================================================

INSERT INTO centros (codigo, nombre, municipio, latitud, longitud, capacidad_max_dia) VALUES
('CS001', 'Centro de Salud Durango Centro', 'Durango', 24.0277, -104.6532, 250),
('CS002', 'Centro de Salud Mezquital', 'Mezquital', 23.5197, -104.3778, 150),
('CS003', 'Centro de Salud Gómez Palacio', 'Gómez Palacio', 25.5697, -103.5000, 300),
('CS004', 'Centro de Salud Vicente Guerrero', 'Vicente Guerrero', 23.7333, -103.9833, 120),
('CS005', 'Centro de Salud Santiago Papasquiaro', 'Santiago Papasquiaro', 25.0453, -105.4197, 180),
('CS006', 'Centro de Salud El Salto', 'Pueblo Nuevo', 23.7833, -105.3667, 140),
('CS007', 'Centro de Salud Nombre de Dios', 'Nombre de Dios', 23.8433, -104.2164, 110),
('CS008', 'Centro de Salud Guadalupe Victoria', 'Guadalupe Victoria', 24.4667, -104.1167, 130),
('CS009', 'Centro de Salud Lerdo', 'Lerdo', 25.5333, -103.5333, 200),
('CS010', 'Centro de Salud Canatlán', 'Canatlán', 24.5217, -104.7789, 100),
('CS011', 'Centro de Salud Súchil', 'Súchil', 25.2000, -105.8667, 90),
('CS012', 'Centro de Salud Tepehuanes', 'Tepehuanes', 25.8667, -105.7333, 110),
('CS013', 'Centro de Salud Cuencamé', 'Cuencamé', 24.8667, -103.7000, 95),
('CS014', 'Centro de Salud Mapimí', 'Mapimí', 25.8333, -103.8500, 85),
('CS015', 'Centro de Salud Peñón Blanco', 'Peñón Blanco', 24.7833, -104.4333, 80);

-- ============================================================================
-- 2. CONFIGURACIÓN DEL SISTEMA
-- ============================================================================

INSERT INTO configuracion (clave, valor, descripcion, tipo) VALUES
('rate_limit_requests_per_min', '100', 'Límite de requests por minuto por IP/usuario', 'NUMBER'),
('alerta_inventario_bajo_pct', '20', 'Porcentaje de inventario para alerta MEDIA', 'NUMBER'),
('alerta_inventario_critico_pct', '10', 'Porcentaje de inventario para alerta ALTA', 'NUMBER'),
('backup_interval_hours', '6', 'Intervalo de backup automático en horas', 'NUMBER'),
('jwt_expiration_hours', '8', 'Duración del JWT en horas', 'NUMBER'),
('max_login_attempts', '5', 'Intentos fallidos antes de bloquear cuenta', 'NUMBER'),
('edad_min_meses', '6', 'Edad mínima en meses para vacunación', 'NUMBER'),
('edad_max_anios', '12', 'Edad máxima en años para vacunación', 'NUMBER'),
('edad_sr_desde_anios', '11', 'Edad desde la cual se usa SR en lugar de SRP', 'NUMBER'),
('vph_mujeres_edad_min', '11', 'Edad mínima mujeres para VPH', 'NUMBER'),
('vph_mujeres_edad_max', '12', 'Edad máxima mujeres para VPH', 'NUMBER'),
('vph_hombres_edad_min', '11', 'Edad mínima hombres para VPH', 'NUMBER'),
('vph_hombres_edad_max', '11', 'Edad máxima hombres para VPH', 'NUMBER');

-- ============================================================================
-- 3. USUARIO ADMINISTRADOR
-- ============================================================================

-- Password: Admin123!
-- Salt: generado con crypto.getRandomValues (ejemplo)
-- Hash: PBKDF2 con 100000 iterations (este es un ejemplo, en producción se genera con Web Crypto API)

INSERT INTO usuarios (username, password_hash, salt, nombre_completo, centro_id, rol, activo) VALUES
('admin', 
 'PBKDF2_HASH_PLACEHOLDER_ADMIN',  -- Reemplazar con hash real al implementar
 'SALT_PLACEHOLDER_ADMIN',          -- Reemplazar con salt real
 'Administrador General del Sistema',
 NULL,
 'ADMIN',
 1);

-- ============================================================================
-- 4. COORDINADORES (uno por centro)
-- ============================================================================

INSERT INTO usuarios (username, password_hash, salt, nombre_completo, centro_id, rol, activo) VALUES
('coord.cs001', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Durango Centro', 1, 'COORDINADOR', 1),
('coord.cs002', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Mezquital', 2, 'COORDINADOR', 1),
('coord.cs003', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Gómez Palacio', 3, 'COORDINADOR', 1),
('coord.cs004', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Vicente Guerrero', 4, 'COORDINADOR', 1),
('coord.cs005', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Santiago Papasquiaro', 5, 'COORDINADOR', 1),
('coord.cs006', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS El Salto', 6, 'COORDINADOR', 1),
('coord.cs007', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Nombre de Dios', 7, 'COORDINADOR', 1),
('coord.cs008', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Guadalupe Victoria', 8, 'COORDINADOR', 1),
('coord.cs009', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Lerdo', 9, 'COORDINADOR', 1),
('coord.cs010', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Canatlán', 10, 'COORDINADOR', 1),
('coord.cs011', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Súchil', 11, 'COORDINADOR', 1),
('coord.cs012', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Tepehuanes', 12, 'COORDINADOR', 1),
('coord.cs013', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Cuencamé', 13, 'COORDINADOR', 1),
('coord.cs014', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Mapimí', 14, 'COORDINADOR', 1),
('coord.cs015', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Coordinador CS Peñón Blanco', 15, 'COORDINADOR', 1);

-- ============================================================================
-- 5. REGISTRADORES Y APLICADORES DE PRUEBA
-- ============================================================================

INSERT INTO usuarios (username, password_hash, salt, nombre_completo, centro_id, rol, activo) VALUES
-- Registradores
('reg.cs001.1', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'María García - Registradora CS001', 1, 'REGISTRADOR', 1),
('reg.cs001.2', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Juan Pérez - Registrador CS001', 1, 'REGISTRADOR', 1),
('reg.cs002.1', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Ana López - Registradora CS002', 2, 'REGISTRADOR', 1),

-- Aplicadores
('aplica.cs001.1', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Dr. Carlos Hernández - Aplicador CS001', 1, 'APLICADOR', 1),
('aplica.cs001.2', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Enf. Laura Martínez - Aplicadora CS001', 1, 'APLICADOR', 1),
('aplica.cs002.1', 'PBKDF2_HASH_PLACEHOLDER', 'SALT_PLACEHOLDER', 'Enf. Roberto Sánchez - Aplicador CS002', 2, 'APLICADOR', 1);

-- ============================================================================
-- 6. LOTES DE BIOLOGICOS DE PRUEBA
-- ============================================================================

INSERT INTO lotes_biologicos (biologico, numero_lote, fecha_caducidad, cantidad_inicial, cantidad_actual, temperatura_min, temperatura_max, proveedor) VALUES
-- SRP (Triple Viral)
('SRP', 'SRP-2026-001', '2026-12-31', 5000, 4850, 2.0, 8.0, 'Laboratorio Nacional'),
('SRP', 'SRP-2026-002', '2026-11-30', 3000, 3000, 2.0, 8.0, 'Laboratorio Nacional'),
('SRP', 'SRP-2026-003', '2026-10-15', 2000, 1950, 2.0, 8.0, 'Laboratorio Nacional'),

-- SR (Doble Viral)
('SR', 'SR-2026-001', '2026-12-31', 1500, 1450, 2.0, 8.0, 'Laboratorio Nacional'),
('SR', 'SR-2026-002', '2026-11-15', 1000, 1000, 2.0, 8.0, 'Laboratorio Nacional'),

-- VPH (Papiloma Humano)
('VPH', 'VPH-2026-001', '2026-12-31', 2000, 1900, 2.0, 8.0, 'MSD México'),
('VPH', 'VPH-2026-002', '2026-09-30', 500, 480, 2.0, 8.0, 'MSD México'), -- Próximo a caducar
('VPH', 'VPH-2026-003', '2027-01-31', 1500, 1500, 2.0, 8.0, 'MSD México');

-- ============================================================================
-- 7. NOTAS DE IMPLEMENTACIÓN
-- ============================================================================

-- IMPORTANTE: Los password_hash y salt son PLACEHOLDERS.
-- Al implementar el worker.js, estos deben ser generados con:
--   1. generateSalt() usando crypto.getRandomValues
--   2. hashPassword(password, salt) usando PBKDF2 con 100000 iterations
--
-- Password por defecto para pruebas (CAMBIAR EN PRODUCCIÓN):
--   - admin: Admin123!
--   - coord.*: Coord123!
--   - reg.*: Reg123!
--   - aplica.*: Aplica123!
--
-- Para producción, cada usuario debe tener su propia contraseña segura.

