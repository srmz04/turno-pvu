-- Seed updated automatically based on Excel
PRAGMA foreign_keys = OFF;

DELETE FROM alertas;
DELETE FROM rechazos;
DELETE FROM fichas;
DELETE FROM transferencias_inventario;
DELETE FROM bloques_folios;
DELETE FROM cortes_manuales;
DELETE FROM turnos;
DELETE FROM dispositivos;
DELETE FROM lotes_biologicos;
DELETE FROM metricas_operativas;
DELETE FROM usuarios WHERE rol IN ('COORDINADOR', 'REGISTRADOR', 'APLICADOR');
DELETE FROM centros;

DELETE FROM sqlite_sequence WHERE name IN ('centros', 'usuarios');

-- Centro: CESSA 450
INSERT INTO centros (id, nombre, codigo, municipio, activo) VALUES (1, 'CESSA 450', 'CESSA450', 'DURANGO', 1);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (100, 'cessa450', '3FaGx2G/bYYvz5Zq7llPM6Ya+7U1CWGHS29Yy1iply0=', 'Om+4VAVrxz4RuZlp+o92gQ==', 'COORDINADOR', 'Coord CESSA 450', 1);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (101, 'reg.cessa450', 'aU2+ytDAOnz7PZg91xrzqCFwUiafuKXTu2igQyG6aPw=', '2r7pFzko7pS4fK5vsdMBJQ==', 'REGISTRADOR', 'Reg CESSA 450', 1);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (102, 'app.cessa450', 'P/bqw/e9BaF4XUjX0JbPDQps7sj1pCJt+2fD5gTTk3s=', 'X0qCgbyzDnk8VvcWCdJWLA==', 'APLICADOR', 'App CESSA 450', 1);

-- Centro: CESSA DR. CARLOS STA. MARÍA
INSERT INTO centros (id, nombre, codigo, municipio, activo) VALUES (2, 'CESSA DR. CARLOS STA. MARÍA', 'CENTRO2', 'DURANGO', 1);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (103, 'centro2', '9hfen8gEe1UIHaMj3I+ogDoCGbZD4J/W/2ckt83gmE0=', 'YbUvg2hpx1dMBsskEX6YqQ==', 'COORDINADOR', 'Coord CESSA DR. CARLOS STA. MARÍA', 2);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (104, 'reg.centro2', 'Or8yJZycQ7aEKSJKpcsldsXxao8GT3+ebL0WVdHb32Q=', 'KRrZIEopdMmcFieZHKVYbw==', 'REGISTRADOR', 'Reg CESSA DR. CARLOS STA. MARÍA', 2);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (105, 'app.centro2', 'lFrzs0gFL2LDjfSwdjkCnbvf3z5Hxn0vAbsDt+xbgjA=', 'fYXN/oHPS1hGcYR/2wDW4w==', 'APLICADOR', 'App CESSA DR. CARLOS STA. MARÍA', 2);

-- Centro: CESSA DR. CARLOS LEÓN DE LA PEÑA
INSERT INTO centros (id, nombre, codigo, municipio, activo) VALUES (3, 'CESSA DR. CARLOS LEÓN DE LA PEÑA', 'CESSA1', 'DURANGO', 1);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (106, 'cessa1', 'o3xJz58PDNceid4xtAG6Fnv7TAwdy7UKcc+RnaEZG04=', 'Et2MsNnQYYqYDRN0Xhbekw==', 'COORDINADOR', 'Coord CESSA DR. CARLOS LEÓN DE LA PEÑA', 3);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (107, 'reg.cessa1', 'F6CfBg1HdSZvWe+i2UcHBOT/jhRJcTTzU3yBVXKOlS4=', 'Ljn8+/Q7kCPcJfjs5PQCgA==', 'REGISTRADOR', 'Reg CESSA DR. CARLOS LEÓN DE LA PEÑA', 3);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (108, 'app.cessa1', 'QzBrkkfQm9hj0gFiEtoeIcwSwolW4CS2USO6coRYAIM=', 'fDq7duDnM49eVLHL/cBs6Q==', 'APLICADOR', 'App CESSA DR. CARLOS LEÓN DE LA PEÑA', 3);

-- Centro: HOSPITAL GENERAL DE DURANGO
INSERT INTO centros (id, nombre, codigo, municipio, activo) VALUES (4, 'HOSPITAL GENERAL DE DURANGO', 'MATERNO', 'DURANGO', 1);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (109, 'materno', 'YkpL7J+/am7Rp8teyed2MtpLglJri3lyyikD+0Jmwzk=', 'iD9RHFTzgA0X/39BRk6SkQ==', 'COORDINADOR', 'Coord HOSPITAL GENERAL DE DURANGO', 4);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (110, 'reg.materno', 'mk6qtImze4C9sBzwwSzmDcxuQtUWslgC/6fFhxHp9yM=', 'JvVfUb4Jm8kpX6mPydVr6w==', 'REGISTRADOR', 'Reg HOSPITAL GENERAL DE DURANGO', 4);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (111, 'app.materno', 'gplQMTkbbNPeO02jpP+Ehg0LvUrPREUv0Sjj9YMEGyE=', 'ywSEpNWre3NeL77qLOd8OA==', 'APLICADOR', 'App HOSPITAL GENERAL DE DURANGO', 4);

-- Centro: C.S.U. DR. ISAURO VENZOR
INSERT INTO centros (id, nombre, codigo, municipio, activo) VALUES (5, 'C.S.U. DR. ISAURO VENZOR', 'ISAURO', 'GÓMEZ PALACIO', 1);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (112, 'isauro', 'YAKfWP52Q0jj0OsrST/XxY9bMWw8PnBFKnX9XaiECVc=', '6YfY83+1AdM1VNRbmykafw==', 'COORDINADOR', 'Coord C.S.U. DR. ISAURO VENZOR', 5);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (113, 'reg.isauro', '/ddOkwKhfkOs/F2oYF18WAmXBtDtAOS8v1bI4WQJ+mw=', 'AFXBKwsU9ZK9srJLpI8sAQ==', 'REGISTRADOR', 'Reg C.S.U. DR. ISAURO VENZOR', 5);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (114, 'app.isauro', 'PUO97mXZ2JMqU/Fk26owsswHJlyYYxlQSWOJMS6D6ug=', 'UMJ5N26WTCMT8iurj3fIEg==', 'APLICADOR', 'App C.S.U. DR. ISAURO VENZOR', 5);

-- Centro: C.S.U. DR. ROBERTO GARCIA SOSA
INSERT INTO centros (id, nombre, codigo, municipio, activo) VALUES (6, 'C.S.U. DR. ROBERTO GARCIA SOSA', 'ROBERTO', 'LERDO', 1);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (115, 'roberto', 'fnI/GtPmePneG4+SD+CLJHMJXb/V/O3jH3fBu0du0gg=', '1ZlczG+97sqnlDFZXWdI7w==', 'COORDINADOR', 'Coord C.S.U. DR. ROBERTO GARCIA SOSA', 6);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (116, 'reg.roberto', 'wNnLVV7jJuk7N7IHqiPlmScuiALshbKh2qpY9lAhX68=', 'jT5VZ1I6US/090AtvYSAsw==', 'REGISTRADOR', 'Reg C.S.U. DR. ROBERTO GARCIA SOSA', 6);
INSERT INTO usuarios (id, username, password_hash, salt, rol, nombre_completo, centro_id) VALUES (117, 'app.roberto', '1zN4wk+ApmwkQ0O4M6txOVaz2u0XpPrpNpBPOU4t0Vw=', 'E60sqsTfyMsxzlDgde54sA==', 'APLICADOR', 'App C.S.U. DR. ROBERTO GARCIA SOSA', 6);

