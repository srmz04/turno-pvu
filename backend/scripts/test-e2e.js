#!/usr/bin/env node
/**
 * TURNO-PVU - Pruebas End-to-End Automatizadas
 *
 * Este script ejecuta pruebas completas del flujo del sistema:
 * 1. Login con cada rol
 * 2. Apertura de turno
 * 3. Emisión de fichas (con validación de edad)
 * 4. Aplicación de vacunas
 * 5. Cierre de turno
 * 6. Verificación de inventario
 *
 * Uso: node test-e2e.js [API_URL]
 * Ejemplo: node test-e2e.js http://localhost:8787
 */

const API_URL = process.argv[2] || 'http://localhost:8787';

// Colores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function section(message) {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(`  ${message}`, colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);
}

// Estado global de las pruebas
const testState = {
  tokens: {},
  centroId: null,
  turnoId: null,
  fichas: [],
  passed: 0,
  failed: 0,
  skipped: 0,
};

// Helper para hacer requests HTTP
async function request(method, endpoint, body = null, token = null) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err.message,
    };
  }
}

// Función para ejecutar una prueba
async function test(name, testFn) {
  try {
    info(`Ejecutando: ${name}`);
    await testFn();
    success(`PASÓ: ${name}`);
    testState.passed++;
    return true;
  } catch (err) {
    error(`FALLÓ: ${name}`);
    error(`  Razón: ${err.message}`);
    testState.failed++;
    return false;
  }
}

// Assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Esperado: ${expected}\n  Obtenido: ${actual}`);
  }
}

// ==========================================
// PRUEBAS DE AUTENTICACIÓN
// ==========================================

async function testLogin() {
  section('PRUEBAS DE AUTENTICACIÓN');

  // Test 10.1: Login con cada rol
  await test('Login como ADMIN', async () => {
    const res = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'Admin123!',
    });

    assert(res.ok, `Login falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.token, 'No se recibió token JWT');
    assert(res.data.user.rol === 'ADMIN', 'Rol incorrecto');

    testState.tokens.admin = res.data.token;
    info(`  Token admin obtenido: ${res.data.token.substring(0, 20)}...`);
  });

  await test('Login como COORDINADOR', async () => {
    const res = await request('POST', '/api/auth/login', {
      username: 'coord.cs001',
      password: 'Coord123!',
    });

    assert(res.ok, `Login falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.token, 'No se recibió token JWT');
    assert(res.data.user.rol === 'COORDINADOR', 'Rol incorrecto');
    assert(res.data.user.centroCodigo === 'CS001', 'Centro incorrecto');

    testState.tokens.coordinador = res.data.token;
    testState.centroId = res.data.user.centroId;
    info(`  Token coordinador obtenido`);
    info(`  Centro asignado: ${res.data.user.centroCodigo} (ID: ${testState.centroId})`);
  });

  await test('Login como REGISTRADOR', async () => {
    const res = await request('POST', '/api/auth/login', {
      username: 'reg.cs001.1',
      password: 'Reg123!',
    });

    assert(res.ok, `Login falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.token, 'No se recibió token JWT');
    assert(res.data.user.rol === 'REGISTRADOR', 'Rol incorrecto');

    testState.tokens.registrador = res.data.token;
    info(`  Token registrador obtenido`);
  });

  await test('Login como APLICADOR', async () => {
    const res = await request('POST', '/api/auth/login', {
      username: 'aplica.cs001.1',
      password: 'Aplica123!',
    });

    assert(res.ok, `Login falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.token, 'No se recibió token JWT');
    assert(res.data.user.rol === 'APLICADOR', 'Rol incorrecto');

    testState.tokens.aplicador = res.data.token;
    info(`  Token aplicador obtenido`);
  });

  await test('Login con contraseña incorrecta debe fallar', async () => {
    const res = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'WrongPassword123!',
    });

    assert(!res.ok, 'Login debería haber fallado');
    assert(res.status === 401, `Status esperado 401, obtenido ${res.status}`);
  });

  await test('Acceso sin autenticación debe fallar', async () => {
    const res = await request('GET', '/api/centros');

    assert(!res.ok, 'Acceso sin token debería haber fallado');
    assert(res.status === 401, `Status esperado 401, obtenido ${res.status}`);
  });
}

// ==========================================
// PRUEBAS DE GESTIÓN DE TURNOS
// ==========================================

async function testTurnos() {
  section('PRUEBAS DE GESTIÓN DE TURNOS');

  // Test 10.2: Coordinador abre turno
  await test('Coordinador abre turno MATUTINO con inventario inicial', async () => {
    const res = await request('POST', '/api/turnos/abrir', {
      centro_id: testState.centroId,
      tipo: 'MATUTINO',
      srp_inicial: 120,
      sr_inicial: 30,
      vph_inicial: 25,
      lotes_biologicos: [
        { biologico: 'SRP', lote: 'SRP-2026-001', fecha_caducidad: '2027-12-31' },
        { biologico: 'SR', lote: 'SR-2026-001', fecha_caducidad: '2027-12-31' },
        { biologico: 'VPH', lote: 'VPH-2026-001', fecha_caducidad: '2027-06-30' },
      ],
    }, testState.tokens.coordinador);

    assert(res.ok, `Apertura de turno falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.turno, 'No se recibió objeto turno');
    assert(res.data.turno.srp_inicial === 120, 'SRP inicial incorrecto');
    assert(res.data.turno.sr_inicial === 30, 'SR inicial incorrecto');
    assert(res.data.turno.vph_inicial === 25, 'VPH inicial incorrecto');

    testState.turnoId = res.data.turno.id;
    info(`  Turno abierto: ID ${testState.turnoId}`);
    info(`  Inventario: SRP=120, SR=30, VPH=25`);
  });

  await test('No se puede abrir otro turno del mismo tipo', async () => {
    const res = await request('POST', '/api/turnos/abrir', {
      centro_id: testState.centroId,
      tipo: 'MATUTINO',
      srp_inicial: 50,
      sr_inicial: 10,
      vph_inicial: 10,
    }, testState.tokens.coordinador);

    assert(!res.ok, 'Debería fallar al abrir turno duplicado');
    info(`  Correctamente rechazado: ${res.data.error}`);
  });

  await test('Obtener turno activo del centro', async () => {
    const res = await request('GET', `/api/turnos/activo/${testState.centroId}`, null, testState.tokens.registrador);

    assert(res.ok, `Obtener turno activo falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.turno, 'No se recibió objeto turno');
    assert(res.data.turno.id === testState.turnoId, 'ID de turno no coincide');
    assert(res.data.turno.abierto === 1, 'Turno debería estar abierto');

    info(`  Turno activo confirmado: ${res.data.turno.tipo}`);
  });
}

// ==========================================
// PRUEBAS DE EMISIÓN DE FICHAS
// ==========================================

async function testFichas() {
  section('PRUEBAS DE EMISIÓN DE FICHAS');

  // Test 10.3: Emisión de fichas con validación de edad
  await test('Registrador emite ficha para menor de 7 años (SRP)', async () => {
    const res = await request('POST', '/api/fichas', {
      turno_id: testState.turnoId,
      edad_anios: 5,
      edad_meses: 6,
      sexo: 'M',
      idempotency_key: `test-${Date.now()}-1`,
    }, testState.tokens.registrador);

    assert(res.ok, `Emisión de ficha falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.ficha, 'No se recibió objeto ficha');
    assert(res.data.ficha.asigna_srp === 1, 'Debería asignar SRP');
    assert(res.data.ficha.asigna_sr === 0, 'No debería asignar SR');
    assert(res.data.ficha.folio, 'Falta folio');
    assert(res.data.ficha.folio.startsWith('PVU-CS001-'), 'Formato de folio incorrecto');

    testState.fichas.push(res.data.ficha);
    info(`  Ficha emitida: ${res.data.ficha.folio}`);
    info(`  Biológicos: SRP=${res.data.ficha.asigna_srp}, SR=${res.data.ficha.asigna_sr}, VPH=${res.data.ficha.asigna_vph}`);
  });

  await test('Registrador emite ficha para niña de 11 años (SR + VPH elegible)', async () => {
    const res = await request('POST', '/api/fichas', {
      turno_id: testState.turnoId,
      edad_anios: 11,
      edad_meses: 0,
      sexo: 'F',
      vph_acepta: true,
      idempotency_key: `test-${Date.now()}-2`,
    }, testState.tokens.registrador);

    assert(res.ok, `Emisión de ficha falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.ficha.asigna_srp === 0, 'No debería asignar SRP');
    assert(res.data.ficha.asigna_sr === 1, 'Debería asignar SR');
    assert(res.data.ficha.asigna_vph === 1, 'Debería asignar VPH (aceptado)');

    testState.fichas.push(res.data.ficha);
    info(`  Ficha emitida: ${res.data.ficha.folio}`);
    info(`  Biológicos: SR + VPH`);
  });

  await test('Registrador emite ficha para niña de 11 años (SR, VPH rechazado)', async () => {
    const res = await request('POST', '/api/fichas', {
      turno_id: testState.turnoId,
      edad_anios: 11,
      edad_meses: 0,
      sexo: 'F',
      vph_acepta: false,
      vph_motivo_rechazo: 'Padres declinan',
      idempotency_key: `test-${Date.now()}-3`,
    }, testState.tokens.registrador);

    assert(res.ok, `Emisión de ficha falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.ficha.asigna_sr === 1, 'Debería asignar SR');
    assert(res.data.ficha.asigna_vph === 0, 'No debería asignar VPH (rechazado)');
    assert(res.data.ficha.vph_motivo_rechazo === 'Padres declinan', 'Motivo incorrecto');

    testState.fichas.push(res.data.ficha);
    info(`  Ficha emitida: ${res.data.ficha.folio}`);
    info(`  VPH rechazado: ${res.data.ficha.vph_motivo_rechazo}`);
  });

  await test('Registrador intenta emitir ficha para adulto de 35 años (RECHAZADO)', async () => {
    const res = await request('POST', '/api/fichas', {
      turno_id: testState.turnoId,
      edad_anios: 35,
      edad_meses: 0,
      sexo: 'M',
      idempotency_key: `test-${Date.now()}-4`,
    }, testState.tokens.registrador);

    assert(!res.ok, 'Debería rechazar edad fuera de rango');
    assert(res.status === 400, `Status esperado 400, obtenido ${res.status}`);
    info(`  Correctamente rechazado: ${res.data.error}`);
  });

  await test('Registrador intenta emitir ficha para menor de 6 meses (RECHAZADO)', async () => {
    const res = await request('POST', '/api/fichas', {
      turno_id: testState.turnoId,
      edad_anios: 0,
      edad_meses: 5,
      sexo: 'F',
      idempotency_key: `test-${Date.now()}-5`,
    }, testState.tokens.registrador);

    assert(!res.ok, 'Debería rechazar edad fuera de rango');
    assert(res.status === 400, `Status esperado 400, obtenido ${res.status}`);
    info(`  Correctamente rechazado: ${res.data.error}`);
  });

  await test('Verificar que inventario se decrementó', async () => {
    const res = await request('GET', `/api/turnos/activo/${testState.centroId}`, null, testState.tokens.coordinador);

    assert(res.ok, 'Fallo al obtener turno');

    // 1 SRP, 2 SR, 1 VPH emitidos
    const expectedSRP = 120 - 1;
    const expectedSR = 30 - 2;
    const expectedVPH = 25 - 1;

    assert(res.data.turno.srp_emitidas === 1, 'SRP emitidas incorrecto');
    assert(res.data.turno.sr_emitidas === 2, 'SR emitidas incorrecto');
    assert(res.data.turno.vph_emitidas === 1, 'VPH emitidas incorrecto');

    info(`  Inventario actualizado:`);
    info(`    SRP: ${expectedSRP} disponibles (emitidas: ${res.data.turno.srp_emitidas})`);
    info(`    SR: ${expectedSR} disponibles (emitidas: ${res.data.turno.sr_emitidas})`);
    info(`    VPH: ${expectedVPH} disponibles (emitidas: ${res.data.turno.vph_emitidas})`);
  });
}

// ==========================================
// PRUEBAS DE APLICACIÓN DE VACUNAS
// ==========================================

async function testAplicacion() {
  section('PRUEBAS DE APLICACIÓN DE VACUNAS');

  if (testState.fichas.length === 0) {
    warning('No hay fichas para probar aplicación. Saltando tests.');
    testState.skipped += 3;
    return;
  }

  const primerFicha = testState.fichas[0];

  await test('Aplicador busca ficha por folio', async () => {
    const res = await request('GET', `/api/fichas/${primerFicha.folio}`, null, testState.tokens.aplicador);

    assert(res.ok, `Búsqueda de ficha falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.ficha, 'No se recibió objeto ficha');
    assert(res.data.ficha.folio === primerFicha.folio, 'Folio no coincide');
    assert(res.data.ficha.estado === 'EMITIDA', 'Estado incorrecto');

    info(`  Ficha encontrada: ${res.data.ficha.folio}`);
    info(`  Estado: ${res.data.ficha.estado}`);
  });

  await test('Aplicador marca ficha como APLICADA', async () => {
    const res = await request('PATCH', `/api/fichas/${primerFicha.folio}/aplicar`, {}, testState.tokens.aplicador);

    assert(res.ok, `Aplicar ficha falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.ficha.estado === 'APLICADA', 'Estado debería ser APLICADA');
    assert(res.data.ficha.ts_aplicacion, 'Falta timestamp de aplicación');
    assert(res.data.ficha.tiempo_espera_min !== null, 'Falta tiempo de espera');

    info(`  Ficha aplicada: ${res.data.ficha.folio}`);
    info(`  Tiempo de espera: ${res.data.ficha.tiempo_espera_min} minutos`);
  });

  await test('Aplicador intenta re-aplicar ficha (YA APLICADA)', async () => {
    const res = await request('PATCH', `/api/fichas/${primerFicha.folio}/aplicar`, {}, testState.tokens.aplicador);

    assert(!res.ok, 'Debería rechazar re-aplicación');
    assert(res.status === 400, `Status esperado 400, obtenido ${res.status}`);
    info(`  Correctamente rechazado: ${res.data.error}`);
  });
}

// ==========================================
// PRUEBAS DE CIERRE DE TURNO
// ==========================================

async function testCierreTurno() {
  section('PRUEBAS DE CIERRE DE TURNO');

  await test('Coordinador cierra turno con sobrantes', async () => {
    const res = await request('POST', '/api/turnos/cerrar', {
      turno_id: testState.turnoId,
      sobrantes_srp: 119,  // 120 - 1
      sobrantes_sr: 28,    // 30 - 2
      sobrantes_vph: 24,   // 25 - 1
    }, testState.tokens.coordinador);

    assert(res.ok, `Cierre de turno falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.resumen, 'No se recibió resumen');

    const resumen = res.data.resumen;
    assert(resumen.emitidas >= 3, `Emitidas incorrecto: ${resumen.emitidas}`);
    assert(resumen.aplicadas >= 1, `Aplicadas incorrecto: ${resumen.aplicadas}`);

    info(`  Turno cerrado exitosamente`);
    info(`  Resumen:`);
    info(`    Fichas emitidas: ${resumen.emitidas}`);
    info(`    Fichas aplicadas: ${resumen.aplicadas}`);
    info(`    Fichas no utilizadas: ${resumen.no_utilizadas}`);
    info(`    Sobrantes SRP: ${resumen.sobrantes_srp}`);
    info(`    Sobrantes SR: ${resumen.sobrantes_sr}`);
    info(`    Sobrantes VPH: ${resumen.sobrantes_vph}`);
  });

  await test('Verificar que turno está cerrado', async () => {
    const res = await request('GET', `/api/turnos/activo/${testState.centroId}`, null, testState.tokens.coordinador);

    assert(!res.ok || !res.data.turno, 'No debería haber turno activo');
    info(`  Confirmado: No hay turno activo`);
  });
}

// ==========================================
// PRUEBAS DE PANEL PÚBLICO
// ==========================================

async function testPanelPublico() {
  section('PRUEBAS DE PANEL PÚBLICO');

  await test('Acceso público a lista de centros (sin autenticación)', async () => {
    const res = await request('GET', '/api/centros/publico');

    assert(res.ok, `Acceso público falló: ${res.data.error || 'Unknown error'}`);
    assert(Array.isArray(res.data.centros), 'Debería retornar array de centros');
    assert(res.data.centros.length > 0, 'Debería haber al menos un centro');

    info(`  ${res.data.centros.length} centros disponibles públicamente`);
  });
}

// ==========================================
// PRUEBAS DE DASHBOARD ADMIN
// ==========================================

async function testDashboardAdmin() {
  section('PRUEBAS DE DASHBOARD ADMIN');

  await test('Admin accede a dashboard consolidado', async () => {
    const res = await request('GET', '/api/dashboard', null, testState.tokens.admin);

    assert(res.ok, `Dashboard falló: ${res.data.error || 'Unknown error'}`);
    assert(res.data.kpis, 'Faltan KPIs');
    assert(Array.isArray(res.data.centros), 'Faltan centros');

    info(`  KPIs obtenidos:`);
    info(`    Total SRP: ${res.data.kpis.total_srp || 0}`);
    info(`    Total SR: ${res.data.kpis.total_sr || 0}`);
    info(`    Total VPH: ${res.data.kpis.total_vph || 0}`);
    info(`    Centros activos: ${res.data.centros.length}`);
  });

  await test('Admin lista todos los usuarios', async () => {
    const res = await request('GET', '/api/usuarios', null, testState.tokens.admin);

    assert(res.ok, `Listar usuarios falló: ${res.data.error || 'Unknown error'}`);
    assert(Array.isArray(res.data.usuarios), 'Debería retornar array de usuarios');
    assert(res.data.usuarios.length >= 4, 'Deberían existir al menos 4 usuarios de prueba');

    info(`  ${res.data.usuarios.length} usuarios en el sistema`);
  });
}

// ==========================================
// MAIN: Ejecutar todas las pruebas
// ==========================================

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', colors.bright + colors.cyan);
  log('║   TURNO-PVU - Pruebas End-to-End Automatizadas            ║', colors.bright + colors.cyan);
  log('╚════════════════════════════════════════════════════════════╝', colors.bright + colors.cyan);

  info(`\n🌐 API URL: ${API_URL}`);
  info(`⏰ Inicio: ${new Date().toLocaleString()}\n`);

  // Verificar que el API está disponible
  try {
    const healthCheck = await request('GET', '/api/health');
    if (!healthCheck.ok) {
      error('❌ El API no está disponible. Verifica que el Worker esté corriendo.');
      process.exit(1);
    }
    success('API está disponible\n');
  } catch (err) {
    error(`❌ No se pudo conectar al API: ${err.message}`);
    process.exit(1);
  }

  // Ejecutar suites de pruebas
  await testLogin();
  await testTurnos();
  await testFichas();
  await testAplicacion();
  await testCierreTurno();
  await testPanelPublico();
  await testDashboardAdmin();

  // Reporte final
  section('REPORTE FINAL');

  const total = testState.passed + testState.failed + testState.skipped;
  const passPct = total > 0 ? ((testState.passed / total) * 100).toFixed(1) : 0;

  log(`\n📊 Resultados:`);
  success(`  ✅ Pasaron: ${testState.passed}`);
  if (testState.failed > 0) {
    error(`  ❌ Fallaron: ${testState.failed}`);
  } else {
    log(`  ❌ Fallaron: ${testState.failed}`, colors.green);
  }
  if (testState.skipped > 0) {
    warning(`  ⏭️  Saltadas: ${testState.skipped}`);
  }
  log(`  📈 Tasa de éxito: ${passPct}%`);

  info(`\n⏰ Fin: ${new Date().toLocaleString()}`);

  if (testState.failed === 0) {
    log('\n🎉 ¡Todas las pruebas pasaron exitosamente!\n', colors.bright + colors.green);
    process.exit(0);
  } else {
    log('\n💥 Algunas pruebas fallaron. Revisa los detalles arriba.\n', colors.bright + colors.red);
    process.exit(1);
  }
}

// Ejecutar
runAllTests().catch(err => {
  error(`\n💥 Error fatal: ${err.message}`);
  console.error(err);
  process.exit(1);
});
