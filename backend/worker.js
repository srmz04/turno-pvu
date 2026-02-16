/**
 * TURNO-PVU Backend Worker
 * Cloudflare Workers - API REST para gestión de turnos de vacunación
 * 
 * Fase 2 - Implementación completa según task.md
 */

// ============================================================================
// 2.1 ESTRUCTURA BASE Y HELPERS
// ============================================================================

/**
 * Helper: Respuesta JSON exitosa
 */
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Helper: Respuesta de error
 */
function errorResponse(message, status = 400, code = 'ERROR') {
  return jsonResponse({
    error: true,
    code,
    message,
    timestamp: new Date().toISOString()
  }, status);
}

/**
 * Helper: Obtener body del request con validación
 */
async function getRequestBody(request) {
  try {
    const text = await request.text();
    if (!text || text.trim() === '') {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

/**
 * Helper: Validar input según schema básico
 */
function validateInput(data, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip validation if field is optional and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Type validation
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`);
    }
    if (rules.type === 'number' && typeof value !== 'number') {
      errors.push(`${field} must be a number`);
    }
    if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    }

    // Min/Max for numbers
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be >= ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be <= ${rules.max}`);
      }
    }

    // MinLength/MaxLength for strings
    if (rules.type === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Helper: Sanitizar input SQL (D1 usa prepared statements, pero defensivo)
 */
function sanitizeSQL(input) {
  if (typeof input !== 'string') return input;
  // D1 usa prepared statements, pero limpiamos caracteres peligrosos
  return input.replace(/['";\\]/g, '');
}

/**
 * Helper: Generar request_id único
 */
function generateRequestId() {
  return crypto.randomUUID();
}

/**
 * Helper: Registrar en auditoría
 */
async function logAudit(env, userId, action, entity, entityId, detail, ip, userAgent) {
  try {
    await env.TURNO_PVU_DB.prepare(
      `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, action, entity, entityId, detail, ip, userAgent).run();
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

// ============================================================================
// 2.2 AUTENTICACIÓN JWT Y SEGURIDAD
// ============================================================================

/**
 * Generar salt aleatorio
 */
function generateSalt() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Hashear password con PBKDF2
 */
async function hashPassword(password, salt) {
  try {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Decodificar salt de base64 a bytes
    // Normalizar el base64 primero (agregar padding si falta)
    let normalizedSalt = salt;
    while (normalizedSalt.length % 4 !== 0) {
      normalizedSalt += '=';
    }

    const saltBytes = Uint8Array.from(atob(normalizedSalt), c => c.charCodeAt(0));

    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  } catch (error) {
    console.error('hashPassword error:', error);
    throw error;
  }
}

/**
 * Crear JWT
 */
async function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + (8 * 60 * 60), // 8 horas
    jti: crypto.randomUUID()
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '');
  const data = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${encodedSignature}`;
}

/**
 * Verificar JWT
 */
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    // Verificar firma
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(
      atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
    if (!valid) return null;

    // Decodificar payload
    const payload = JSON.parse(atob(encodedPayload));

    // Verificar expiración
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Extraer JWT del header Authorization
 */
function extractJWT(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Middleware: Require authentication
 */
async function requireAuth(request, env, roles = []) {
  const token = extractJWT(request);
  if (!token) {
    return errorResponse('Unauthorized - No token provided', 401, 'UNAUTHORIZED');
  }

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return errorResponse('Unauthorized - Invalid or expired token', 401, 'UNAUTHORIZED');
  }

  // Verificar rol si se especificó
  if (roles.length > 0 && !roles.includes(payload.rol)) {
    return errorResponse('Forbidden - Insufficient permissions', 403, 'FORBIDDEN');
  }

  return payload; // Retorna el payload del JWT
}

// ============================================================================
// MIDDLEWARE CORS
// ============================================================================

function corsHeaders(env, requestOrigin) {
  let allowOrigin = 'https://turno-pvu.pages.dev'; // Default seguro

  if (requestOrigin) {
    // Permitir localhost, preview deployments, y dominio principal
    if (requestOrigin.includes('localhost') ||
      requestOrigin.includes('127.0.0.1') ||
      requestOrigin.endsWith('.turno-pvu.pages.dev') ||
      requestOrigin === 'https://turno-pvu.pages.dev') {
      allowOrigin = requestOrigin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, *', // Wildcard para headers extra
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

function handleCORS(request, env) {
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('Origin');
    return new Response(null, { headers: corsHeaders(env, origin) });
  }
  return null;
}

// ============================================================================
// MIDDLEWARE RATE LIMITING
// ============================================================================

async function checkRateLimit(env, ip, userId) {
  // Si KV no está disponible, permitir el request (fail open para desarrollo)
  if (!env.TURNO_PVU_CACHE) {
    return true;
  }

  const key = `ratelimit:${userId || ip}`;
  const limit = 100; // requests per minute
  const window = 60; // seconds

  try {
    const count = await env.TURNO_PVU_CACHE.get(key);
    const current = count ? parseInt(count) : 0;

    if (current >= limit) {
      return false;
    }

    await env.TURNO_PVU_CACHE.put(key, (current + 1).toString(), { expirationTtl: window });
    return true;
  } catch (error) {
    // Si falla KV, permitir el request (fail open)
    console.error('Rate limit check failed:', error);
    return true;
  }
}

// ============================================================================
// MIDDLEWARE LOGGING ESTRUCTURADO
// ============================================================================

function logRequest(requestId, method, url, status, duration) {
  console.log(JSON.stringify({
    request_id: requestId,
    timestamp: new Date().toISOString(),
    method,
    url,
    status,
    duration_ms: duration
  }));
}

// ============================================================================
// 2.2 ENDPOINT: POST /api/auth/login
// ============================================================================

async function handleLogin(request, env) {
  const body = await getRequestBody(request);
  if (!body) {
    return errorResponse('Request body required', 400);
  }

  const errors = validateInput(body, {
    username: { required: true, type: 'string', minLength: 3 },
    password: { required: true, type: 'string', minLength: 6 }
  });

  if (errors) {
    return errorResponse(errors.join(', '), 400, 'VALIDATION_ERROR');
  }

  const username = body.username.trim();
  const password = body.password.trim();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    console.log('[LOGIN] Intentando login para:', username);
    // Buscar usuario
    const user = await env.TURNO_PVU_DB.prepare(
      `SELECT * FROM usuarios WHERE username = ? AND activo = 1`
    ).bind(username).first();
    console.log('[LOGIN] Usuario encontrado:', user ? 'SI' : 'NO');

    if (!user) {
      // await logAudit(env, null, 'LOGIN_FAILED', 'usuario', null,
      //   JSON.stringify({ username, reason: 'user_not_found' }), ip, request.headers.get('User-Agent'));
      return errorResponse('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Verificar intentos fallidos
    if (user.intentos_fallidos >= 5) {
      // await logAudit(env, user.id, 'LOGIN_BLOCKED', 'usuario', user.id,
      //   'Account locked due to too many failed attempts', ip, request.headers.get('User-Agent'));
      return errorResponse('Account locked - Contact administrator', 403, 'ACCOUNT_LOCKED');
    }

    // Verificar password
    console.log('[LOGIN] Verificando password...');
    const passwordHash = await hashPassword(password, user.salt);
    console.log('[LOGIN] Hash calculado');

    if (passwordHash !== user.password_hash) {
      // Incrementar intentos fallidos
      await env.TURNO_PVU_DB.prepare(
        `UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1 WHERE id = ?`
      ).bind(user.id).run();

      // await logAudit(env, user.id, 'LOGIN_FAILED', 'usuario', user.id,
      //   JSON.stringify({ reason: 'invalid_password' }), ip, request.headers.get('User-Agent'));

      return errorResponse('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Login exitoso - resetear intentos fallidos y actualizar ultimo_login
    await env.TURNO_PVU_DB.prepare(
      `UPDATE usuarios SET intentos_fallidos = 0, ultimo_login = datetime('now') WHERE id = ?`
    ).bind(user.id).run();

    // Obtener código del centro
    let centroCodigo = null;
    if (user.centro_id) {
      const centro = await env.TURNO_PVU_DB.prepare(
        `SELECT codigo FROM centros WHERE id = ?`
      ).bind(user.centro_id).first();
      centroCodigo = centro?.codigo;
    }

    // Crear JWT
    const token = await createJWT({
      userId: user.id,
      username: user.username,
      rol: user.rol,
      centroId: user.centro_id,
      centroCodigo
    }, env.JWT_SECRET);

    // await logAudit(env, user.id, 'LOGIN_SUCCESS', 'usuario', user.id, null, ip, request.headers.get('User-Agent'));

    return jsonResponse({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre_completo,
        rol: user.rol,
        centroId: user.centro_id,
        centroCodigo
      }
    });

  } catch (error) {
    console.error('[LOGIN] ERROR:', error.message, error.stack);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}

// ============================================================================
// 2.2 ENDPOINT: POST /api/auth/refresh
// ============================================================================

async function handleRefresh(request, env) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  // Crear nuevo token
  const newToken = await createJWT({
    userId: authResult.userId,
    username: authResult.username,
    rol: authResult.rol,
    centroId: authResult.centroId,
    centroCodigo: authResult.centroCodigo
  }, env.JWT_SECRET);

  return jsonResponse({
    success: true,
    token: newToken
  });
}

// ============================================================================
// 2.2 ENDPOINT: POST /api/auth/logout
// ============================================================================

async function handleLogout(request, env) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const token = extractJWT(request);

  // Blacklist token en KV (opcional, JWT expira en 8h de todas formas)
  try {
    await env.TURNO_PVU_CACHE.put(
      `blacklist:${authResult.jti}`,
      '1',
      { expirationTtl: 8 * 60 * 60 }
    );
  } catch (error) {
    console.error('Failed to blacklist token:', error);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await logAudit(env, authResult.userId, 'LOGOUT', 'usuario', authResult.userId, null, ip, request.headers.get('User-Agent'));

  return jsonResponse({ success: true });
}

// ============================================================================
// 2.3 ENDPOINT: GET /api/centros
// ============================================================================

async function handleGetCentros(request, env) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  try {
    const centros = await env.TURNO_PVU_DB.prepare(`
      SELECT 
        c.id,
        c.codigo,
        c.nombre,
        c.municipio,
        c.latitud,
        c.longitud,
        c.capacidad_max_dia,
        CASE 
          WHEN v.srp_disponible > 0 OR v.sr_disponible > 0 THEN 'DISPONIBLE'
          WHEN v.turno_id IS NULL THEN 'SIN_TURNO'
          ELSE 'AGOTADO'
        END as disponibilidad,
        v.srp_disponible,
        v.sr_disponible,
        v.vph_disponible,
        CASE
          WHEN v.turno_id IS NOT NULL THEN 
            ROUND(((v.srp_emitidas + v.sr_emitidas) * 100.0) / c.capacidad_max_dia, 1)
          ELSE 0
        END as utilizacion_actual_pct
      FROM centros c
      LEFT JOIN v_inventario_actual v ON c.id = v.centro_id
      WHERE c.activo = 1
      ORDER BY c.nombre
    `).all();

    return jsonResponse({
      success: true,
      centros: centros.results
    });

  } catch (error) {
    console.error('Get centros error:', error);
    return errorResponse('Failed to fetch centros', 500);
  }
}

// ============================================================================
// 2.4 ENDPOINTS DE TURNOS
// ============================================================================

async function handleAbrirTurno(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body) return errorResponse('Request body required', 400);

  const errors = validateInput(body, {
    tipo: { required: true, type: 'string', enum: ['MATUTINO', 'VESPERTINO'] },
    srp_inicial: { required: true, type: 'number', min: 0 },
    sr_inicial: { required: false, type: 'number', min: 0 },
    vph_inicial: { required: false, type: 'number', min: 0 }
  });

  if (errors) return errorResponse(errors.join(', '), 400, 'VALIDATION_ERROR');

  const { tipo, srp_inicial, sr_inicial = 0, vph_inicial = 0, lotes_biologicos = [] } = body;

  // Validar que al menos un biológico > 0
  if (srp_inicial === 0 && sr_inicial === 0) {
    return errorResponse('Al menos SRP o SR debe ser mayor a 0', 400, 'VALIDATION_ERROR');
  }

  try {
    const fecha = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Verificar que no existe turno abierto del mismo tipo hoy
    const existente = await env.TURNO_PVU_DB.prepare(`
      SELECT id FROM turnos
      WHERE centro_id = ? AND fecha = ? AND tipo = ?
    `).bind(authResult.centroId, fecha, tipo).first();

    if (existente) {
      return errorResponse('Ya existe un turno ' + tipo + ' abierto hoy', 409, 'TURNO_DUPLICADO');
    }

    // Verificar fechas de caducidad de lotes (si se proporcionaron)
    for (const lote of lotes_biologicos) {
      const loteDB = await env.TURNO_PVU_DB.prepare(`
        SELECT fecha_caducidad FROM lotes_biologicos WHERE numero_lote = ?
      `).bind(lote.numero_lote).first();

      if (loteDB) {
        const diasHastaCaducidad = Math.floor(
          (new Date(loteDB.fecha_caducidad) - new Date()) / (1000 * 60 * 60 * 24)
        );

        // Crear alerta si caduca en menos de 30 días
        if (diasHastaCaducidad < 30) {
          await env.TURNO_PVU_DB.prepare(`
            INSERT INTO alertas (tipo, severidad, centro_id, mensaje, detalle)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            'LOTE_PROXIMO_CADUCAR',
            diasHastaCaducidad < 7 ? 'ALTA' : 'MEDIA',
            authResult.centroId,
            `Lote ${lote.numero_lote} caduca en ${diasHastaCaducidad} días`,
            JSON.stringify({ lote: lote.numero_lote, dias: diasHastaCaducidad })
          ).run();
        }
      }
    }

    // Insertar turno
    const result = await env.TURNO_PVU_DB.prepare(`
      INSERT INTO turnos (centro_id, fecha, tipo, srp_inicial, sr_inicial, vph_inicial, usuario_apertura)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(authResult.centroId, fecha, tipo, srp_inicial, sr_inicial, vph_inicial, authResult.userId).run();

    const turnoId = result.meta.last_row_id;

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await logAudit(env, authResult.userId, 'TURNO_ABIERTO', 'turno', turnoId,
      JSON.stringify({ tipo, srp_inicial, sr_inicial, vph_inicial }), ip, request.headers.get('User-Agent'));

    return jsonResponse({
      success: true,
      turno: {
        id: turnoId,
        centro_id: authResult.centroId,
        fecha,
        tipo,
        srp_inicial,
        sr_inicial,
        vph_inicial
      }
    });

  } catch (error) {
    console.error('Abrir turno error:', error);
    return errorResponse('Failed to open turno', 500);
  }
}

async function handleCerrarTurno(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body) return errorResponse('Request body required', 400);

  const { sobrantes_srp = 0, sobrantes_sr = 0, sobrantes_vph = 0 } = body;

  try {
    // Obtener turno activo del centro del usuario
    const turno = await env.TURNO_PVU_DB.prepare(`
      SELECT * FROM turnos
      WHERE centro_id = ? AND fecha = date('now') AND abierto = 1
      LIMIT 1
    `).bind(authResult.centroId).first();

    if (!turno) {
      return errorResponse('Turno not found or already closed', 404);
    }

    // Actualizar fichas EMITIDAS a NO_UTILIZADA
    await env.TURNO_PVU_DB.prepare(`
      UPDATE fichas SET estado = 'NO_UTILIZADA'
      WHERE turno_id = ? AND estado = 'EMITIDA'
    `).bind(turno.id).run();

    // Contar fichas por estado
    const stats = await env.TURNO_PVU_DB.prepare(`
      SELECT
        estado,
        COUNT(*) as count,
        SUM(asigna_srp) as srp_count,
        SUM(asigna_sr) as sr_count,
        SUM(asigna_vph) as vph_count
      FROM fichas
      WHERE turno_id = ?
      GROUP BY estado
    `).bind(turno.id).all();

    const resumen = {
      emitidas: turno.srp_emitidas + turno.sr_emitidas,
      aplicadas: turno.srp_aplicadas + turno.sr_aplicadas,
      canceladas: 0,
      no_utilizadas: 0,
      sobrantes_srp,
      sobrantes_sr,
      sobrantes_vph
    };

    stats.results.forEach(s => {
      if (s.estado === 'CANCELADA') resumen.canceladas = s.count;
      if (s.estado === 'NO_UTILIZADA') resumen.no_utilizadas = s.count;
    });

    // Verificar integridad de inventario (fórmula PRD 8.13)
    const srp_debe_sobrar = turno.srp_inicial - turno.srp_aplicadas - resumen.canceladas;
    const sr_debe_sobrar = turno.sr_inicial - turno.sr_aplicadas;

    if (Math.abs(srp_debe_sobrar - sobrantes_srp - resumen.no_utilizadas) > 0) {
      await env.TURNO_PVU_DB.prepare(`
        INSERT INTO alertas (tipo, severidad, centro_id, mensaje, detalle)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        'DISCREPANCIA_INVENTARIO',
        'ALTA',
        authResult.centroId,
        'Discrepancia de inventario al cerrar turno',
        JSON.stringify({ turno_id: turno.id, esperado: srp_debe_sobrar, reportado: sobrantes_srp })
      ).run();

      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      await logAudit(env, authResult.userId, 'DISCREPANCIA_INVENTARIO', 'turno', turno.id,
        JSON.stringify({ srp_esperado: srp_debe_sobrar, srp_reportado: sobrantes_srp }), ip, request.headers.get('User-Agent'));
    }

    // Cerrar turno
    await env.TURNO_PVU_DB.prepare(`
      UPDATE turnos SET abierto = 0, ts_cierre = datetime('now')
      WHERE id = ?
    `).bind(turno.id).run();

    // Actualizar métricas operativas
    const duracionTotal = (new Date() - new Date(turno.ts_apertura)) / 1000; // segundos
    const fichaPorHora = resumen.emitidas / (duracionTotal / 3600);
    // Calcular tasa de rechazo real
    const totalRechazos = await env.TURNO_PVU_DB.prepare(`
      SELECT COUNT(*) as count FROM rechazos WHERE turno_id = ?
    `).bind(turno.id).first();
    const rechazosCount = totalRechazos?.count || 0;

    const tasaRechazo = resumen.emitidas > 0
      ? (rechazosCount / (resumen.emitidas + rechazosCount)) * 100
      : 0;
    const tasaNoUtilizadas = (resumen.no_utilizadas / resumen.emitidas) * 100;

    await env.TURNO_PVU_DB.prepare(`
      INSERT INTO metricas_operativas
      (centro_id, fecha, fichas_por_hora, tasa_rechazo_pct, tasa_no_utilizadas_pct)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      authResult.centroId,
      turno.fecha,
      fichaPorHora,
      tasaRechazo,
      tasaNoUtilizadas
    ).run();

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await logAudit(env, authResult.userId, 'TURNO_CERRADO', 'turno', turno.id,
      JSON.stringify(resumen), ip, request.headers.get('User-Agent'));

    return jsonResponse({
      success: true,
      resumen
    });

  } catch (error) {
    console.error('Cerrar turno error:', error);
    return errorResponse('Failed to close turno', 500);
  }
}

async function handleGetTurnoActivo(request, env, centroId) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  try {
    const turno = await env.TURNO_PVU_DB.prepare(`
      SELECT
        t.*,
        (t.srp_inicial - t.srp_emitidas) as srp_disponible,
        (t.sr_inicial - t.sr_emitidas) as sr_disponible,
        (t.vph_inicial - t.vph_emitidas) as vph_disponible,
        ROUND((t.srp_emitidas + t.sr_emitidas) * 100.0 / (t.srp_inicial + t.sr_inicial), 1) as utilizacion_pct
      FROM turnos t
      WHERE t.centro_id = ? AND t.abierto = 1
      LIMIT 1
    `).bind(centroId).first();

    if (!turno) {
      return jsonResponse({ success: true, turno: null });
    }

    // Calcular proyección de agotamiento
    const duracion = (new Date() - new Date(turno.ts_apertura)) / 1000 / 60; // minutos
    const tasaEmision = duracion > 0 ? (turno.srp_emitidas + turno.sr_emitidas) / duracion : 0;
    const minutosRestantes = tasaEmision > 0 ? Math.floor((turno.srp_disponible + turno.sr_disponible) / tasaEmision) : 0;

    return jsonResponse({
      success: true,
      turno: {
        ...turno,
        proyeccion_agotamiento_min: minutosRestantes,
        tasa_emision_por_hora: tasaEmision * 60
      }
    });

  } catch (error) {
    console.error('Get turno activo error:', error);
    return errorResponse('Failed to fetch turno', 500);
  }
}

// ============================================================================
// 2.5 ENDPOINTS DE FICHAS (CORAZÓN DEL SISTEMA)
// ============================================================================

async function handleEmitirFicha(request, env) {
  const authResult = await requireAuth(request, env, ['REGISTRADOR', 'COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body) return errorResponse('Request body required', 400);

  const errors = validateInput(body, {
    edad_anios: { required: true, type: 'number', min: 0, max: 15 },
    edad_meses: { required: true, type: 'number', min: 0, max: 11 },
    sexo: { required: true, type: 'string', enum: ['M', 'F'] },
    vph_tenia: { required: false, type: 'boolean' },
    idempotency_key: { required: true, type: 'string' }
  });

  if (errors) return errorResponse(errors.join(', '), 400, 'VALIDATION_ERROR');

  const { edad_anios, edad_meses, sexo, vph_tenia = false, idempotency_key } = body;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // PASO 1: Verificar JWT -> centroId
    const centroId = authResult.centroId;
    if (!centroId) {
      return errorResponse('Usuario no tiene centro asignado', 400);
    }

    // PASO 2: Obtener turno abierto del centro
    const turno = await env.TURNO_PVU_DB.prepare(`
      SELECT * FROM turnos
      WHERE centro_id = ? AND abierto = 1
      LIMIT 1
    `).bind(centroId).first();

    if (!turno) {
      return errorResponse('No hay turno abierto en este centro', 400, 'NO_TURNO_ABIERTO');
    }

    // PASO 3: Validar edad
    const edad_total_meses = (edad_anios * 12) + edad_meses;

    if (edad_total_meses < 6) {
      // Registrar rechazo
      await env.TURNO_PVU_DB.prepare(`
        INSERT INTO rechazos (turno_id, edad_anios, edad_meses, sexo, motivo)
        VALUES (?, ?, ?, ?, ?)
      `).bind(turno.id, edad_anios, edad_meses, sexo, 'MENOR_6M').run();

      return errorResponse('Edad menor a 6 meses - No autorizado', 400, 'EDAD_NO_AUTORIZADA');
    }

    if (edad_anios > 12 || (edad_anios === 12 && edad_meses > 0)) {
      // Registrar rechazo
      await env.TURNO_PVU_DB.prepare(`
        INSERT INTO rechazos (turno_id, edad_anios, edad_meses, sexo, motivo)
        VALUES (?, ?, ?, ?, ?)
      `).bind(turno.id, edad_anios, edad_meses, sexo, 'MAYOR_12A').run();

      return errorResponse('Edad mayor a 12 años - No autorizado', 400, 'EDAD_NO_AUTORIZADA');
    }

    // PASO 4: Determinar biológicos
    let asigna_srp = 0, asigna_sr = 0, asigna_vph = 0, vph_preguntado = 0;

    if (edad_anios <= 10) {
      asigna_srp = 1;
    } else if (edad_anios >= 11) {
      asigna_sr = 1;
    }

    // Lógica VPH
    const elegibleVPH = (
      (sexo === 'F' && edad_anios >= 11 && edad_anios <= 12) ||
      (sexo === 'M' && edad_anios === 11)
    );

    const vph_disponible = turno.vph_inicial - turno.vph_emitidas;

    if (elegibleVPH && vph_disponible > 0) {
      vph_preguntado = 1;
      if (!vph_tenia) {
        asigna_vph = 1;
      }
    }

    // PASO 5: Verificar inventario
    const srp_disponible = turno.srp_inicial - turno.srp_emitidas;
    const sr_disponible = turno.sr_inicial - turno.sr_emitidas;

    if (asigna_srp && srp_disponible <= 0) {
      return errorResponse('Dosis de SRP agotadas', 409, 'DOSIS_AGOTADAS');
    }

    if (asigna_sr && sr_disponible <= 0) {
      return errorResponse('Dosis de SR agotadas', 409, 'DOSIS_AGOTADAS');
    }

    if (asigna_vph && vph_disponible <= 0) {
      return errorResponse('Dosis de VPH agotadas', 409, 'DOSIS_AGOTADAS');
    }

    // PASO 6: Idempotencia - buscar ficha duplicada en últimos 60 seg
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
    const existing = await env.TURNO_PVU_DB.prepare(`
      SELECT * FROM fichas
      WHERE idempotency_key = ? AND ts_emision > ?
      LIMIT 1
    `).bind(idempotency_key, sixtySecondsAgo).first();

    if (existing) {
      // Retornar ficha existente
      return jsonResponse({
        success: true,
        ficha: existing,
        duplicated: true
      });
    }

    // PASO 7: Calcular consecutivo
    // PASO 7: Calcular consecutivo
    let consecutivo;
    if (body.consecutivo) {
      consecutivo = body.consecutivo;
    } else {
      const maxConsecutivo = await env.TURNO_PVU_DB.prepare(`
        SELECT COALESCE(MAX(consecutivo), 0) as max_consecutivo
        FROM fichas
        WHERE turno_id = ?
      `).bind(turno.id).first();
      consecutivo = (maxConsecutivo?.max_consecutivo || 0) + 1;
    }

    // PASO 8: Generar folio
    const centro = await env.TURNO_PVU_DB.prepare(`
      SELECT codigo FROM centros WHERE id = ?
    `).bind(centroId).first();

    const folio = `PVU-${centro.codigo}-${String(consecutivo).padStart(4, '0')}`;

    // PASO 9: BATCH ATÓMICO
    const batch = [
      // a) INSERT ficha
      env.TURNO_PVU_DB.prepare(`
        INSERT INTO fichas (
          folio, turno_id, consecutivo, edad_anios, edad_meses, sexo,
          asigna_srp, asigna_sr, asigna_vph, vph_preguntado, vph_tenia,
          estado, usuario_registro_id, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        folio, turno.id, consecutivo, edad_anios, edad_meses, sexo,
        asigna_srp, asigna_sr, asigna_vph, vph_preguntado, vph_tenia ? 1 : 0,
        'EMITIDA', authResult.userId, idempotency_key
      )
    ];

    // b) UPDATE turnos - incrementar emitidas
    if (asigna_srp) {
      batch.push(env.TURNO_PVU_DB.prepare(`
        UPDATE turnos SET srp_emitidas = srp_emitidas + 1
        WHERE id = ? AND srp_emitidas < srp_inicial
      `).bind(turno.id));
    }

    if (asigna_sr) {
      batch.push(env.TURNO_PVU_DB.prepare(`
        UPDATE turnos SET sr_emitidas = sr_emitidas + 1
        WHERE id = ? AND sr_emitidas < sr_inicial
      `).bind(turno.id));
    }

    // c) Si VPH, incrementar
    if (asigna_vph) {
      batch.push(env.TURNO_PVU_DB.prepare(`
        UPDATE turnos SET vph_emitidas = vph_emitidas + 1
        WHERE id = ? AND vph_emitidas < vph_inicial
      `).bind(turno.id));
    }

    const results = await env.TURNO_PVU_DB.batch(batch);

    // PASO 10: Verificar que UPDATEs afectaron 1 fila
    // (results[1] y results[2] deben haber affected rows)

    // PASO 11: Registrar en auditoría
    await logAudit(env, authResult.userId, 'FICHA_EMITIDA', 'ficha', folio,
      JSON.stringify({ folio, edad_anios, edad_meses, sexo, biologico: asigna_srp ? 'SRP' : 'SR' }), ip, request.headers.get('User-Agent'));

    // PASO 12 [NUEVO]: Si inventario < 20%, crear alerta MEDIA
    const inventarioActual = asigna_srp ? (srp_disponible - 1) : (sr_disponible - 1);
    const inventarioInicial = asigna_srp ? turno.srp_inicial : turno.sr_inicial;
    const porcentaje = (inventarioActual / inventarioInicial) * 100;

    if (porcentaje < 20 && porcentaje >= 10) {
      await env.TURNO_PVU_DB.prepare(`
        INSERT INTO alertas (tipo, severidad, centro_id, mensaje, detalle)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        'INVENTARIO_BAJO',
        'MEDIA',
        centroId,
        `Inventario de ${asigna_srp ? 'SRP' : 'SR'} por debajo del 20%`,
        JSON.stringify({ porcentaje: porcentaje.toFixed(1), disponible: inventarioActual })
      ).run();
    } else if (porcentaje < 10) {
      await env.TURNO_PVU_DB.prepare(`
        INSERT INTO alertas (tipo, severidad, centro_id, mensaje, detalle)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        'INVENTARIO_CRITICO',
        'ALTA',
        centroId,
        `Inventario de ${asigna_srp ? 'SRP' : 'SR'} por debajo del 10%`,
        JSON.stringify({ porcentaje: porcentaje.toFixed(1), disponible: inventarioActual })
      ).run();
    }

    // PASO 14: Retornar ficha completa
    const fichaCreada = await env.TURNO_PVU_DB.prepare(`
      SELECT * FROM fichas WHERE folio = ?
    `).bind(folio).first();

    return jsonResponse({
      success: true,
      ficha: fichaCreada
    }, 201);

  } catch (error) {
    console.error('Emitir ficha error:', error);
    return errorResponse('Failed to create ficha', 500);
  }
}

async function handleGetFicha(request, env, folio) {
  const authResult = await requireAuth(request, env, ['APLICADOR', 'COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    const ficha = await env.TURNO_PVU_DB.prepare(`
      SELECT
        f.*,
        t.fecha, t.tipo, t.centro_id,
        c.nombre as centro_nombre, c.codigo as centro_codigo,
        CAST((julianday('now') - julianday(f.ts_emision)) * 24 * 60 AS INTEGER) as tiempo_transcurrido_min
      FROM fichas f
      JOIN turnos t ON f.turno_id = t.id
      JOIN centros c ON t.centro_id = c.id
      WHERE f.folio = ?
    `).bind(folio).first();

    if (!ficha) {
      return errorResponse('Ficha not found', 404);
    }

    // Calcular posición en cola (estimación)
    const posicion = await env.TURNO_PVU_DB.prepare(`
      SELECT COUNT(*) as count FROM fichas
      WHERE turno_id = ? AND consecutivo < ? AND estado = 'EMITIDA'
    `).bind(ficha.turno_id, ficha.consecutivo).first();

    return jsonResponse({
      success: true,
      ficha: {
        ...ficha,
        posicion_estimada_cola: posicion?.count || 0
      }
    });

  } catch (error) {
    console.error('Get ficha error:', error);
    return errorResponse('Failed to fetch ficha', 500);
  }
}

async function handleGetSiguienteFicha(request, env, turnoId) {
  const authResult = await requireAuth(request, env, ['APLICADOR', 'COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    // Implementar algoritmo de predicción inteligente FIFO
    const siguiente = await env.TURNO_PVU_DB.prepare(`
      SELECT * FROM fichas
      WHERE turno_id = ? AND estado = 'EMITIDA'
      ORDER BY consecutivo ASC
      LIMIT 1
    `).bind(turnoId).first();

    if (!siguiente) {
      return jsonResponse({
        success: true,
        ficha: null,
        mensaje: 'No hay fichas pendientes'
      });
    }

    return jsonResponse({
      success: true,
      ficha: siguiente
    });

  } catch (error) {
    console.error('Get siguiente ficha error:', error);
    return errorResponse('Failed to fetch next ficha', 500);
  }
}

async function handleAplicarFicha(request, env, folio) {
  const authResult = await requireAuth(request, env, ['APLICADOR', 'COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // Buscar ficha
    const ficha = await env.TURNO_PVU_DB.prepare(`
      SELECT f.*, t.centro_id, t.abierto
      FROM fichas f
      JOIN turnos t ON f.turno_id = t.id
      WHERE f.folio = ?
    `).bind(folio).first();

    if (!ficha) {
      return errorResponse('Ficha not found', 404);
    }

    // Validar estado
    if (ficha.estado === 'APLICADA') {
      return errorResponse(
        `Ficha ya fue aplicada el ${ficha.ts_aplicacion}`,
        409,
        'YA_APLICADA'
      );
    }

    if (ficha.estado !== 'EMITIDA') {
      return errorResponse('Ficha no está en estado EMITIDA', 400, 'ESTADO_INVALIDO');
    }

    // Validar turno abierto
    if (!ficha.abierto) {
      return errorResponse('El turno está cerrado', 400, 'TURNO_CERRADO');
    }

    // Detectar aplicación cruzada
    const aplicacionCruzada = ficha.centro_id !== authResult.centroId;

    // UPDATE ficha - SQLite calcula el tiempo de espera directamente
    await env.TURNO_PVU_DB.prepare(`
      UPDATE fichas
      SET estado = 'APLICADA',
          ts_aplicacion = datetime('now'),
          tiempo_espera_min = CAST((julianday('now') - julianday(ts_emision)) * 24 * 60 AS INTEGER),
          usuario_aplicacion_id = ?
      WHERE folio = ?
    `).bind(authResult.userId, folio).run();

    // Obtener el tiempo calculado para el response
    const fichaUpdated = await env.TURNO_PVU_DB.prepare(`
      SELECT tiempo_espera_min FROM fichas WHERE folio = ?
    `).bind(folio).first();
    const tiempoEsperaMin = fichaUpdated?.tiempo_espera_min || 0;

    // UPDATE turno - incrementar aplicadas
    if (ficha.asigna_srp) {
      await env.TURNO_PVU_DB.prepare(`
        UPDATE turnos SET srp_aplicadas = srp_aplicadas + 1
        WHERE id = ?
      `).bind(ficha.turno_id).run();
    }

    if (ficha.asigna_sr) {
      await env.TURNO_PVU_DB.prepare(`
        UPDATE turnos SET sr_aplicadas = sr_aplicadas + 1
        WHERE id = ?
      `).bind(ficha.turno_id).run();
    }

    if (ficha.asigna_vph) {
      await env.TURNO_PVU_DB.prepare(`
        UPDATE turnos SET vph_aplicadas = vph_aplicadas + 1
        WHERE id = ?
      `).bind(ficha.turno_id).run();
    }

    await logAudit(env, authResult.userId, 'FICHA_APLICADA', 'ficha', folio,
      JSON.stringify({ folio, aplicacion_cruzada: aplicacionCruzada }), ip, request.headers.get('User-Agent'));

    // Obtener ficha actualizada
    const fichaActualizada = await env.TURNO_PVU_DB.prepare(`
      SELECT * FROM fichas WHERE folio = ?
    `).bind(folio).first();

    return jsonResponse({
      success: true,
      ficha: fichaActualizada,
      aplicacion_cruzada: aplicacionCruzada,
      tiempo_espera_min: tiempoEsperaMin
    });

  } catch (error) {
    console.error('Aplicar ficha error:', error);
    return errorResponse('Failed to apply ficha', 500);
  }
}

async function handleGetFichasTurno(request, env, turnoId) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const estado = url.searchParams.get('estado');

  try {
    let query = `
      SELECT * FROM fichas
      WHERE turno_id = ?
    `;
    const params = [turnoId];

    if (estado) {
      query += ` AND estado = ?`;
      params.push(estado);
    }

    query += ` ORDER BY consecutivo DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const fichas = await env.TURNO_PVU_DB.prepare(query).bind(...params).all();

    // Contar por estado
    const stats = await env.TURNO_PVU_DB.prepare(`
      SELECT estado, COUNT(*) as count
      FROM fichas
      WHERE turno_id = ?
      GROUP BY estado
    `).bind(turnoId).all();

    return jsonResponse({
      success: true,
      fichas: fichas.results,
      total: fichas.results.length,
      limit,
      offset,
      stats: stats.results
    });

  } catch (error) {
    console.error('Get fichas turno error:', error);
    return errorResponse('Failed to fetch fichas', 500);
  }
}

// ============================================================================
// 2.15 ENDPOINTS DE HEALTH CHECK Y MÉTRICAS
// ============================================================================

async function handleHealthDeep(request, env) {
  const authResult = await requireAuth(request, env, ['ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    // Test DB connection
    const dbTest = await env.TURNO_PVU_DB.prepare('SELECT 1 as test').first();

    // Test KV
    let kvTest = false;
    try {
      await env.TURNO_PVU_CACHE.put('health_check', Date.now().toString(), { expirationTtl: 60 });
      kvTest = true;
    } catch (e) {
      kvTest = false;
    }

    // Count active turnos
    const turnosActivos = await env.TURNO_PVU_DB.prepare(
      'SELECT COUNT(*) as count FROM turnos WHERE abierto = 1'
    ).first();

    return jsonResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'unknown',
      checks: {
        database: dbTest?.test === 1,
        kv: kvTest,
        turnos_activos: turnosActivos?.count || 0
      }
    });
  } catch (error) {
    return jsonResponse({
      status: 'unhealthy',
      error: error.message
    }, 503);
  }
}

async function handleMetrics(request, env) {
  const authResult = await requireAuth(request, env, ['ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    const stats = await env.TURNO_PVU_DB.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN abierto = 1 THEN id END) as turnos_activos,
        SUM(CASE WHEN abierto = 1 THEN srp_emitidas ELSE 0 END) as srp_emitidas_hoy,
        SUM(CASE WHEN abierto = 1 THEN sr_emitidas ELSE 0 END) as sr_emitidas_hoy,
        SUM(CASE WHEN abierto = 1 THEN vph_emitidas ELSE 0 END) as vph_emitidas_hoy,
        SUM(CASE WHEN abierto = 1 THEN srp_aplicadas ELSE 0 END) as srp_aplicadas_hoy,
        SUM(CASE WHEN abierto = 1 THEN sr_aplicadas ELSE 0 END) as sr_aplicadas_hoy,
        SUM(CASE WHEN abierto = 1 THEN vph_aplicadas ELSE 0 END) as vph_aplicadas_hoy
      FROM turnos
      WHERE fecha = date('now')
    `).first();

    return jsonResponse({
      success: true,
      metrics: stats
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return errorResponse('Failed to fetch metrics', 500);
  }
}

async function handleIngestMetrics(request, env) {
  // Public endpoint for frontend telemetry
  // No auth required, but rate limited by IP
  try {
    const body = await getRequestBody(request);
    if (!body) return errorResponse('Body required', 400);

    // Log logic (console.log structured for Cloudflare logs)
    // We could store in DB but for now logs are enough
    console.log('[TELEMETRY]', JSON.stringify({
      ts: new Date().toISOString(),
      ...body,
      ip: request.headers.get('CF-Connecting-IP')
    }));

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Ingest metrics error:', error);
    return errorResponse('Failed to ingest', 500);
  }
}

// ============================================================================
// 2.9 ENDPOINTS DE DASHBOARD
// ============================================================================

async function handleGetDashboard(request, env) {
  const authResult = await requireAuth(request, env, ['ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    // Dashboard consolidado de todos los centros
    const centrosData = await env.TURNO_PVU_DB.prepare(`
      SELECT
        c.id,
        c.codigo,
        c.nombre,
        c.municipio,
        t.id as turno_id,
        t.tipo,
        t.abierto,
        t.srp_inicial,
        t.sr_inicial,
        t.vph_inicial,
        t.srp_emitidas,
        t.sr_emitidas,
        t.vph_emitidas,
        t.srp_aplicadas,
        t.sr_aplicadas,
        t.vph_aplicadas,
        (t.srp_inicial - t.srp_emitidas) as srp_disponible,
        (t.sr_inicial - t.sr_emitidas) as sr_disponible,
        (t.vph_inicial - t.vph_emitidas) as vph_disponible,
        CASE
          WHEN t.srp_emitidas > 0 THEN CAST((t.srp_inicial - t.srp_emitidas) * 100.0 / t.srp_inicial AS INTEGER)
          ELSE 100
        END as srp_pct_disponible
      FROM centros c
      LEFT JOIN turnos t ON c.id = t.centro_id AND t.fecha = date('now') AND t.abierto = 1
      WHERE c.activo = 1
      ORDER BY c.codigo
    `).all();

    // Estadísticas globales
    const statsGlobales = await env.TURNO_PVU_DB.prepare(`
      SELECT
        COUNT(DISTINCT c.id) as centros_totales,
        COUNT(DISTINCT CASE WHEN t.abierto = 1 THEN t.id END) as centros_activos,
        COALESCE(SUM(CASE WHEN t.abierto = 1 THEN t.srp_emitidas ELSE 0 END), 0) as srp_emitidas_total,
        COALESCE(SUM(CASE WHEN t.abierto = 1 THEN t.sr_emitidas ELSE 0 END), 0) as sr_emitidas_total,
        COALESCE(SUM(CASE WHEN t.abierto = 1 THEN t.vph_emitidas ELSE 0 END), 0) as vph_emitidas_total,
        COALESCE(SUM(CASE WHEN t.abierto = 1 THEN t.srp_aplicadas ELSE 0 END), 0) as srp_aplicadas_total,
        COALESCE(SUM(CASE WHEN t.abierto = 1 THEN t.sr_aplicadas ELSE 0 END), 0) as sr_aplicadas_total,
        COALESCE(SUM(CASE WHEN t.abierto = 1 THEN t.vph_aplicadas ELSE 0 END), 0) as vph_aplicadas_total
      FROM centros c
      LEFT JOIN turnos t ON c.id = t.centro_id AND t.fecha = date('now')
      WHERE c.activo = 1
    `).first();

    return jsonResponse({
      success: true,
      centros: centrosData.results,
      stats_globales: statsGlobales,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return errorResponse('Failed to fetch dashboard', 500);
  }
}

async function handleGetDashboardCentro(request, env, centroId) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  // Validar que coordinador solo vea su centro
  if (authResult.rol === 'COORDINADOR' && authResult.centroId != centroId) {
    return errorResponse('No puedes ver el dashboard de otro centro', 403, 'FORBIDDEN');
  }

  try {
    // Info del centro
    const centro = await env.TURNO_PVU_DB.prepare(`
      SELECT * FROM centros WHERE id = ? AND activo = 1
    `).bind(centroId).first();

    if (!centro) {
      return errorResponse('Centro not found', 404, 'NOT_FOUND');
    }

    // Turno actual
    const turno = await env.TURNO_PVU_DB.prepare(`
      SELECT * FROM turnos
      WHERE centro_id = ? AND fecha = date('now') AND abierto = 1
    `).bind(centroId).first();

    // Fichas del turno (si existe)
    let fichas = [];
    let stats_fichas = {};
    if (turno) {
      const fichasResult = await env.TURNO_PVU_DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN estado = 'EMITIDA' THEN 1 ELSE 0 END) as emitidas,
          SUM(CASE WHEN estado = 'APLICADA' THEN 1 ELSE 0 END) as aplicadas,
          SUM(CASE WHEN estado = 'CANCELADA' THEN 1 ELSE 0 END) as canceladas,
          SUM(CASE WHEN estado = 'NO_UTILIZADA' THEN 1 ELSE 0 END) as no_utilizadas,
          AVG(CASE WHEN estado = 'APLICADA' AND tiempo_espera_min IS NOT NULL THEN tiempo_espera_min END) as tiempo_espera_promedio
        FROM fichas
        WHERE turno_id = ?
      `).bind(turno.id).first();

      stats_fichas = fichasResult;
    }

    return jsonResponse({
      success: true,
      centro,
      turno,
      stats_fichas,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard centro error:', error);
    return errorResponse('Failed to fetch dashboard', 500);
  }
}

// ============================================================================
// 2.8 ENDPOINT DE CORTES MANUALES
// ============================================================================

async function handleCorteManual(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body) return errorResponse('Request body required', 400);

  // turno_id es opcional: se puede hacer corte sin turno activo
  const errors = validateInput(body, {
    turno_id: { required: false, type: 'number' },
    srp_restantes: { required: false, type: 'number', min: 0 },
    sr_restantes: { required: false, type: 'number', min: 0 },
    vph_restantes: { required: false, type: 'number', min: 0 },
    fichas_distribuidas: { required: false, type: 'number', min: 0 },
    fichas_entregadas: { required: false, type: 'number', min: 0 },
    fichas_restantes: { required: false, type: 'number', min: 0 },
    notas: { required: false, type: 'string' }
  });

  if (errors) return errorResponse(errors.join(', '), 400, 'VALIDATION_ERROR');

  try {
    // Si hay turno_id, verificar que existe y pertenece al centro del usuario
    let turnoId = body.turno_id || null;
    if (turnoId) {
      const turno = await env.TURNO_PVU_DB.prepare(`
        SELECT * FROM turnos WHERE id = ?
      `).bind(turnoId).first();

      if (!turno) {
        return errorResponse('Turno not found', 404, 'NOT_FOUND');
      }

      if (authResult.rol === 'COORDINADOR' && turno.centro_id !== authResult.centroId) {
        return errorResponse('No puedes hacer cortes en turnos de otro centro', 403, 'FORBIDDEN');
      }
    }

    // Insertar corte manual con campos de fichas
    await env.TURNO_PVU_DB.prepare(`
      INSERT INTO cortes_manuales (turno_id, usuario_id, srp_restantes, sr_restantes, vph_restantes,
        fichas_distribuidas, fichas_entregadas, fichas_restantes, notas, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      turnoId,
      authResult.userId,
      body.srp_restantes || null,
      body.sr_restantes || null,
      body.vph_restantes || null,
      body.fichas_distribuidas || 0,
      body.fichas_entregadas || 0,
      body.fichas_restantes || 0,
      body.notas || null
    ).run();

    // Registrar en auditoria
    await env.TURNO_PVU_DB.prepare(`
      INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ts)
      VALUES (?, 'CORTE_MANUAL', 'turno', ?, ?, datetime('now'))
    `).bind(
      authResult.userId,
      turnoId || 0,
      JSON.stringify({
        srp_restantes: body.srp_restantes,
        sr_restantes: body.sr_restantes,
        vph_restantes: body.vph_restantes,
        fichas_distribuidas: body.fichas_distribuidas,
        fichas_entregadas: body.fichas_entregadas,
        fichas_restantes: body.fichas_restantes,
        notas: body.notas
      })
    ).run();

    return jsonResponse({
      success: true,
      message: 'Corte manual registrado',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Corte manual error:', error);
    return errorResponse('Failed to register corte manual', 500);
  }
}

// ============================================================================
// 2.11 ENDPOINT DE SINCRONIZACIÓN OFFLINE
// ============================================================================

async function handleSyncOffline(request, env) {
  const authResult = await requireAuth(request, env, ['REGISTRADOR', 'APLICADOR', 'COORDINADOR']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body || !body.fichas || !Array.isArray(body.fichas)) {
    return errorResponse('Body debe contener array de fichas', 400);
  }

  try {
    const resultados = {
      total: body.fichas.length,
      exitosas: 0,
      duplicadas: 0,
      errores: 0,
      detalles: []
    };

    // Procesar cada ficha
    for (const fichaOffline of body.fichas) {
      try {
        // Verificar si ya existe por idempotency_key
        const existente = await env.TURNO_PVU_DB.prepare(`
          SELECT id FROM fichas WHERE idempotency_key = ?
        `).bind(fichaOffline.idempotency_key).first();

        if (existente) {
          resultados.duplicadas++;
          resultados.detalles.push({
            idempotency_key: fichaOffline.idempotency_key,
            status: 'duplicada',
            mensaje: 'Ficha ya existe'
          });
          continue;
        }

        // Validacion basica de integridad
        if (fichaOffline.edad_anios < 0 || fichaOffline.edad_anios > 15 ||
          fichaOffline.edad_meses < 0 || fichaOffline.edad_meses > 11) {
          throw new Error('Datos de edad invalidos');
        }

        // Insertar la ficha
        await env.TURNO_PVU_DB.prepare(`
          INSERT INTO fichas (
            folio, turno_id, consecutivo, edad_anios, edad_meses, sexo,
            asigna_srp, asigna_sr, asigna_vph, estado,
            ts_emision, usuario_registro_id, idempotency_key
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          fichaOffline.folio,
          fichaOffline.turno_id,
          fichaOffline.consecutivo,
          fichaOffline.edad_anios,
          fichaOffline.edad_meses,
          fichaOffline.sexo,
          fichaOffline.asigna_srp || 0,
          fichaOffline.asigna_sr || 0,
          fichaOffline.asigna_vph || 0,
          fichaOffline.estado || 'EMITIDA',
          fichaOffline.ts_emision,
          authResult.userId,
          fichaOffline.idempotency_key
        ).run();

        resultados.exitosas++;
        resultados.detalles.push({
          idempotency_key: fichaOffline.idempotency_key,
          status: 'exitosa',
          folio: fichaOffline.folio
        });

      } catch (error) {
        resultados.errores++;
        resultados.detalles.push({
          idempotency_key: fichaOffline.idempotency_key,
          status: 'error',
          mensaje: error.message
        });
      }
    }

    return jsonResponse({
      success: true,
      resultados,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync offline error:', error);
    return errorResponse('Failed to sync offline data', 500);
  }
}

// ============================================================================
// 2.7 ENDPOINTS DE DISPOSITIVOS Y BLOQUES DE FOLIOS
// ============================================================================

/**
 * Crear un nuevo dispositivo (tablet, celular) para un centro.
 * Genera un token unico que se usa como URL persistente para acceder al sistema.
 * Solo COORDINADOR o ADMIN pueden crear dispositivos.
 */
async function handleCrearDispositivo(request, env) {
  // Solo coordinadores y admin
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body) return errorResponse('Request body required', 400);

  const errors = validateInput(body, {
    nombre: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    rol: { required: true, type: 'string', enum: ['REGISTRADOR', 'APLICADOR'] }
  });
  if (errors) return errorResponse(errors.join(', '), 400, 'VALIDATION_ERROR');

  // El centro se determina por el usuario autenticado, a menos que sea ADMIN
  const centroId = body.centro_id || authResult.centroId;
  if (!centroId) return errorResponse('centro_id requerido', 400);

  try {
    // Generar token unico para el dispositivo
    const token = crypto.randomUUID();
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    await env.TURNO_PVU_DB.prepare(
      `INSERT INTO dispositivos (centro_id, token, rol, nombre, url_generada, activo, creado_por)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    ).bind(
      centroId, token, body.rol, body.nombre,
      `/?deviceToken=${token}`,
      authResult.userId
    ).run();

    const dispositivo = await env.TURNO_PVU_DB.prepare(
      `SELECT * FROM dispositivos WHERE token = ?`
    ).bind(token).first();

    await logAudit(env, authResult.userId, 'DISPOSITIVO_CREADO', 'dispositivo', dispositivo.id,
      JSON.stringify({ nombre: body.nombre, rol: body.rol, centro_id: centroId }), ip, request.headers.get('User-Agent'));

    return jsonResponse({
      success: true,
      dispositivo: {
        id: dispositivo.id,
        token,
        nombre: body.nombre,
        rol: body.rol,
        url_generada: `/?deviceToken=${token}`,
        centro_id: centroId
      }
    }, 201);
  } catch (error) {
    console.error('Create device error:', error);
    return errorResponse('Error al crear dispositivo', 500);
  }
}

/**
 * Listar dispositivos activos de un centro.
 * Coordinador solo ve los de su centro; Admin ve los de cualquier centro.
 */
async function handleGetDispositivos(request, env, centroId) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  // Coordinador solo puede ver dispositivos de su propio centro
  if (authResult.rol === 'COORDINADOR' && String(authResult.centroId) !== String(centroId)) {
    return errorResponse('No autorizado para ver dispositivos de otro centro', 403, 'FORBIDDEN');
  }

  try {
    const { results } = await env.TURNO_PVU_DB.prepare(
      `SELECT d.*, c.codigo as centro_codigo, c.nombre as centro_nombre
       FROM dispositivos d
       JOIN centros c ON d.centro_id = c.id
       WHERE d.centro_id = ? AND d.activo = 1
       ORDER BY d.ts_creacion DESC`
    ).bind(centroId).all();

    return jsonResponse({ success: true, dispositivos: results });
  } catch (error) {
    console.error('Get devices error:', error);
    return errorResponse('Error al obtener dispositivos', 500);
  }
}

/**
 * Revocar (desactivar) un dispositivo.
 * Su token dejara de funcionar para autenticar.
 */
async function handleRevocarDispositivo(request, env, id) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    const dispositivo = await env.TURNO_PVU_DB.prepare(
      `SELECT * FROM dispositivos WHERE id = ? AND activo = 1`
    ).bind(id).first();

    if (!dispositivo) return errorResponse('Dispositivo no encontrado', 404, 'NOT_FOUND');

    // Coordinador solo puede revocar dispositivos de su centro
    if (authResult.rol === 'COORDINADOR' && dispositivo.centro_id !== authResult.centroId) {
      return errorResponse('No autorizado para revocar dispositivos de otro centro', 403, 'FORBIDDEN');
    }

    await env.TURNO_PVU_DB.prepare(
      `UPDATE dispositivos SET activo = 0 WHERE id = ?`
    ).bind(id).run();

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await logAudit(env, authResult.userId, 'DISPOSITIVO_REVOCADO', 'dispositivo', id,
      JSON.stringify({ nombre: dispositivo.nombre }), ip, request.headers.get('User-Agent'));

    return jsonResponse({ success: true, message: 'Dispositivo revocado' });
  } catch (error) {
    console.error('Revoke device error:', error);
    return errorResponse('Error al revocar dispositivo', 500);
  }
}

/**
 * Asignar un bloque de folios offline a un dispositivo.
 * Se valida que el rango no se traslape con bloques ya asignados.
 */
async function handleAsignarBloque(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body) return errorResponse('Request body required', 400);

  const errors = validateInput(body, {
    turno_id: { required: true, type: 'number' },
    dispositivo_token: { required: true, type: 'string' },
    folio_inicio: { required: true, type: 'number', min: 1 },
    folio_fin: { required: true, type: 'number', min: 1 }
  });
  if (errors) return errorResponse(errors.join(', '), 400, 'VALIDATION_ERROR');

  if (body.folio_fin <= body.folio_inicio) {
    return errorResponse('folio_fin debe ser mayor que folio_inicio', 400);
  }

  try {
    // Verificar que el turno existe y esta abierto
    const turno = await env.TURNO_PVU_DB.prepare(
      `SELECT * FROM turnos WHERE id = ? AND abierto = 1`
    ).bind(body.turno_id).first();
    if (!turno) return errorResponse('Turno no encontrado o cerrado', 404);

    // Verificar que el dispositivo existe
    const dispositivo = await env.TURNO_PVU_DB.prepare(
      `SELECT * FROM dispositivos WHERE token = ? AND activo = 1`
    ).bind(body.dispositivo_token).first();
    if (!dispositivo) return errorResponse('Dispositivo no encontrado', 404);

    // Verificar que no hay traslape con bloques existentes del turno
    const traslape = await env.TURNO_PVU_DB.prepare(
      `SELECT id FROM bloques_folios
       WHERE turno_id = ? AND NOT (folio_fin < ? OR folio_inicio > ?)`
    ).bind(body.turno_id, body.folio_inicio, body.folio_fin).first();

    if (traslape) {
      return errorResponse('El rango de folios se traslapa con un bloque existente', 409, 'CONFLICT');
    }

    await env.TURNO_PVU_DB.prepare(
      `INSERT INTO bloques_folios (turno_id, dispositivo_token, folio_inicio, folio_fin, consumidos)
       VALUES (?, ?, ?, ?, 0)`
    ).bind(body.turno_id, body.dispositivo_token, body.folio_inicio, body.folio_fin).run();

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await logAudit(env, authResult.userId, 'BLOQUE_ASIGNADO', 'bloque', null,
      JSON.stringify({ turno_id: body.turno_id, rango: `${body.folio_inicio}-${body.folio_fin}` }),
      ip, request.headers.get('User-Agent'));

    return jsonResponse({
      success: true,
      bloque: { inicio: body.folio_inicio, fin: body.folio_fin, dispositivo: dispositivo.nombre }
    }, 201);
  } catch (error) {
    console.error('Assign block error:', error);
    return errorResponse('Error al asignar bloque', 500);
  }
}

/**
 * Listar todos los bloques de folios asignados a un turno.
 * Incluye informacion de consumo por bloque.
 */
async function handleGetBloques(request, env, turnoId) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    const { results } = await env.TURNO_PVU_DB.prepare(
      `SELECT b.*, d.nombre as dispositivo_nombre, d.rol as dispositivo_rol
       FROM bloques_folios b
       LEFT JOIN dispositivos d ON b.dispositivo_token = d.token
       WHERE b.turno_id = ?
       ORDER BY b.folio_inicio ASC`
    ).bind(turnoId).all();

    return jsonResponse({ success: true, bloques: results });
  } catch (error) {
    console.error('Get blocks error:', error);
    return errorResponse('Error al obtener bloques', 500);
  }
}

// ============================================================================
// 2.10 ENDPOINTS DE REPORTES Y PANEL PUBLICO
// ============================================================================

/**
 * Exportar reporte de fichas en formato CSV.
 * Soporta filtros por fecha y centro.
 * Retorna Content-Type text/csv para descarga directa.
 */
async function handleReporteCSV(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const url = new URL(request.url);
  const fechaInicio = url.searchParams.get('fecha_inicio') || '2026-01-01';
  const fechaFin = url.searchParams.get('fecha_fin') || '2099-12-31';
  const centroId = url.searchParams.get('centro_id');

  try {
    let query = `
      SELECT f.folio, f.consecutivo, f.edad_anios, f.edad_meses, f.sexo,
             f.asigna_srp, f.asigna_sr, f.asigna_vph, f.estado,
             f.ts_emision, f.ts_aplicacion, f.tiempo_espera_min,
             f.motivo_cancelacion, f.lote_biologico,
             t.fecha, t.tipo as turno_tipo,
             c.codigo as centro_codigo, c.nombre as centro_nombre, c.municipio
      FROM fichas f
      JOIN turnos t ON f.turno_id = t.id
      JOIN centros c ON t.centro_id = c.id
      WHERE t.fecha >= ? AND t.fecha <= ?`;
    const params = [fechaInicio, fechaFin];

    // Coordinador solo ve su centro, Admin puede filtrar o ver todos
    if (authResult.rol === 'COORDINADOR') {
      query += ' AND t.centro_id = ?';
      params.push(authResult.centroId);
    } else if (centroId) {
      query += ' AND t.centro_id = ?';
      params.push(centroId);
    }

    query += ' ORDER BY t.fecha DESC, f.consecutivo ASC';

    const stmt = env.TURNO_PVU_DB.prepare(query);
    const { results } = await stmt.bind(...params).all();

    // Generar CSV
    const headers = [
      'folio', 'consecutivo', 'edad_anios', 'edad_meses', 'sexo',
      'srp', 'sr', 'vph', 'estado', 'emision', 'aplicacion',
      'espera_min', 'cancelacion', 'lote', 'fecha', 'turno',
      'centro_codigo', 'centro', 'municipio'
    ];
    let csv = headers.join(',') + '\n';

    for (const row of results) {
      csv += [
        row.folio, row.consecutivo, row.edad_anios, row.edad_meses, row.sexo,
        row.asigna_srp, row.asigna_sr, row.asigna_vph, row.estado,
        row.ts_emision || '', row.ts_aplicacion || '',
        row.tiempo_espera_min || '', row.motivo_cancelacion || '',
        row.lote_biologico || '', row.fecha, row.turno_tipo,
        row.centro_codigo, `"${row.centro_nombre}"`, row.municipio
      ].join(',') + '\n';
    }

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reporte_turno_pvu_${fechaInicio}_${fechaFin}.csv"`
      }
    });
  } catch (error) {
    console.error('Report CSV error:', error);
    return errorResponse('Error al generar reporte', 500);
  }
}

/**
 * Panel publico de disponibilidad - SIN autenticacion.
 * Muestra centros con turno abierto y su disponibilidad de biologicos.
 * Se cachea 60 segundos para reducir carga.
 */
async function handleDisponibilidadPublica(request, env) {
  try {
    // Consultar centros con turnos abiertos y su inventario disponible
    const { results } = await env.TURNO_PVU_DB.prepare(
      `SELECT c.id, c.codigo, c.nombre, c.municipio, c.latitud, c.longitud,
              t.id as turno_id, t.tipo, t.ts_apertura,
              (t.srp_inicial - t.srp_emitidas) as srp_disponible,
              (t.sr_inicial - t.sr_emitidas) as sr_disponible,
              (t.vph_inicial - t.vph_emitidas) as vph_disponible,
              t.srp_inicial, t.sr_inicial, t.vph_inicial
       FROM centros c
       LEFT JOIN turnos t ON c.id = t.centro_id AND t.abierto = 1
       WHERE c.activo = 1
       ORDER BY c.nombre ASC`
    ).all();

    // Calcular estado por centro
    const centros = results.map(r => {
      // Si no hay turno abierto
      if (!r.turno_id) {
        return {
          codigo: r.codigo, nombre: r.nombre, municipio: r.municipio,
          latitud: r.latitud, longitud: r.longitud,
          turno_abierto: false, estado: 'SIN_TURNO'
        };
      }

      const totalDisponible = (r.srp_disponible || 0) + (r.sr_disponible || 0);
      const totalInicial = (r.srp_inicial || 0) + (r.sr_inicial || 0);
      const porcentaje = totalInicial > 0 ? (totalDisponible / totalInicial) * 100 : 0;

      let estado = 'DISPONIBLE';
      if (totalDisponible <= 0) estado = 'AGOTADO';
      else if (porcentaje <= 20) estado = 'ULTIMOS_TURNOS';

      return {
        codigo: r.codigo, nombre: r.nombre, municipio: r.municipio,
        latitud: r.latitud, longitud: r.longitud,
        turno_abierto: true,
        turno_tipo: r.tipo,
        ts_apertura: r.ts_apertura,
        srp_disponible: r.srp_disponible || 0,
        sr_disponible: r.sr_disponible || 0,
        vph_disponible: r.vph_disponible || 0,
        estado
      };
    });

    return jsonResponse({
      success: true,
      centros,
      timestamp: new Date().toISOString()
    }, 200, {
      'Cache-Control': 'public, max-age=60'
    });
  } catch (error) {
    console.error('Public availability error:', error);
    return errorResponse('Error al obtener disponibilidad', 500);
  }
}

// ============================================================================
// 2.12 ENDPOINTS DE GESTION DE LOTES E INVENTARIO
// ============================================================================

/**
 * Listar lotes de biologicos.
 * Coordinador ve lotes generales; Admin ve todos.
 */
async function handleGetLotes(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const biologico = url.searchParams.get('biologico');

    let query = `SELECT * FROM lotes_biologicos WHERE 1=1`;
    const params = [];

    if (biologico) {
      query += ' AND biologico = ?';
      params.push(biologico);
    }
    query += ' ORDER BY fecha_caducidad ASC';

    const stmt = env.TURNO_PVU_DB.prepare(query);
    const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    return jsonResponse({ success: true, lotes: results });
  } catch (error) {
    console.error('Get lotes error:', error);
    return errorResponse('Error al obtener lotes', 500);
  }
}

/**
 * Registrar un nuevo lote de biologico.
 * Solo ADMIN puede crear lotes en el sistema.
 */
async function handleCrearLote(request, env) {
  const authResult = await requireAuth(request, env, ['ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body) return errorResponse('Request body required', 400);

  const errors = validateInput(body, {
    biologico: { required: true, type: 'string', enum: ['SRP', 'SR', 'VPH'] },
    numero_lote: { required: true, type: 'string', minLength: 3 },
    fecha_caducidad: { required: true, type: 'string' },
    cantidad_inicial: { required: true, type: 'number', min: 1 },
    proveedor: { required: true, type: 'string' }
  });
  if (errors) return errorResponse(errors.join(', '), 400, 'VALIDATION_ERROR');

  try {
    await env.TURNO_PVU_DB.prepare(
      `INSERT INTO lotes_biologicos (biologico, numero_lote, fecha_caducidad, cantidad_inicial,
       cantidad_actual, temperatura_min, temperatura_max, proveedor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.biologico, body.numero_lote, body.fecha_caducidad,
      body.cantidad_inicial, body.cantidad_inicial,
      body.temperatura_min || 2.0, body.temperatura_max || 8.0,
      body.proveedor
    ).run();

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await logAudit(env, authResult.userId, 'LOTE_CREADO', 'lote', null,
      JSON.stringify({ biologico: body.biologico, lote: body.numero_lote, cantidad: body.cantidad_inicial }),
      ip, request.headers.get('User-Agent'));

    return jsonResponse({ success: true, message: 'Lote registrado' }, 201);
  } catch (error) {
    console.error('Create lote error:', error);
    if (error.message?.includes('UNIQUE')) {
      return errorResponse('Ya existe un lote con ese numero', 409, 'CONFLICT');
    }
    return errorResponse('Error al crear lote', 500);
  }
}

/**
 * Listar lotes proximos a caducar.
 * Muestra lotes que caducan en los proximos N dias (default 30).
 */
async function handleLotesCaducidad(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const url = new URL(request.url);
  const dias = parseInt(url.searchParams.get('dias') || '30');

  try {
    const { results } = await env.TURNO_PVU_DB.prepare(
      `SELECT *, 
              julianday(fecha_caducidad) - julianday('now') as dias_restantes
       FROM lotes_biologicos
       WHERE fecha_caducidad <= date('now', '+' || ? || ' days')
         AND cantidad_actual > 0
       ORDER BY fecha_caducidad ASC`
    ).bind(dias).all();

    return jsonResponse({
      success: true,
      lotes_proximos_caducar: results,
      filtro_dias: dias,
      total: results.length
    });
  } catch (error) {
    console.error('Lotes caducidad error:', error);
    return errorResponse('Error al consultar caducidad', 500);
  }
}

/**
 * Crear solicitud de transferencia de inventario entre centros.
 * Un coordinador solicita, el admin aprueba/rechaza.
 */
async function handleCrearTransferencia(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body) return errorResponse('Request body required', 400);

  const errors = validateInput(body, {
    centro_destino: { required: true, type: 'number' },
    biologico: { required: true, type: 'string', enum: ['SRP', 'SR', 'VPH'] },
    cantidad: { required: true, type: 'number', min: 1 },
    motivo: { required: true, type: 'string', minLength: 5 }
  });
  if (errors) return errorResponse(errors.join(', '), 400, 'VALIDATION_ERROR');

  // El centro origen es el del usuario autenticado
  const centroOrigen = body.centro_origen || authResult.centroId;
  if (!centroOrigen) return errorResponse('centro_origen requerido', 400);

  if (String(centroOrigen) === String(body.centro_destino)) {
    return errorResponse('Centro origen y destino no pueden ser el mismo', 400);
  }

  try {
    await env.TURNO_PVU_DB.prepare(
      `INSERT INTO transferencias_inventario (centro_origen, centro_destino, biologico, cantidad, motivo, usuario_autoriza, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')`
    ).bind(centroOrigen, body.centro_destino, body.biologico, body.cantidad, body.motivo, authResult.userId).run();

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await logAudit(env, authResult.userId, 'TRANSFERENCIA_SOLICITADA', 'transferencia', null,
      JSON.stringify({ origen: centroOrigen, destino: body.centro_destino, biologico: body.biologico, cantidad: body.cantidad }),
      ip, request.headers.get('User-Agent'));

    return jsonResponse({ success: true, message: 'Transferencia solicitada' }, 201);
  } catch (error) {
    console.error('Create transfer error:', error);
    return errorResponse('Error al crear transferencia', 500);
  }
}

/**
 * Listar transferencias de inventario.
 * Coordinador ve las de su centro; Admin ve todas.
 */
async function handleGetTransferencias(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    let query = `
      SELECT t.*, 
             co.nombre as centro_origen_nombre, co.codigo as centro_origen_codigo,
             cd.nombre as centro_destino_nombre, cd.codigo as centro_destino_codigo,
             u.nombre_completo as autorizado_por
      FROM transferencias_inventario t
      JOIN centros co ON t.centro_origen = co.id
      JOIN centros cd ON t.centro_destino = cd.id
      LEFT JOIN usuarios u ON t.usuario_autoriza = u.id`;

    if (authResult.rol === 'COORDINADOR') {
      query += ` WHERE (t.centro_origen = ? OR t.centro_destino = ?)`;
      const { results } = await env.TURNO_PVU_DB.prepare(query + ' ORDER BY t.ts DESC')
        .bind(authResult.centroId, authResult.centroId).all();
      return jsonResponse({ success: true, transferencias: results });
    }

    const { results } = await env.TURNO_PVU_DB.prepare(query + ' ORDER BY t.ts DESC').all();
    return jsonResponse({ success: true, transferencias: results });
  } catch (error) {
    console.error('Get transfers error:', error);
    return errorResponse('Error al obtener transferencias', 500);
  }
}

/**
 * Aprobar o rechazar una transferencia (solo ADMIN).
 * Cambiar estado de PENDIENTE a COMPLETADA o CANCELADA.
 */
async function handleUpdateTransferencia(request, env, id) {
  const authResult = await requireAuth(request, env, ['ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body) return errorResponse('Request body required', 400);

  const errors = validateInput(body, {
    estado: { required: true, type: 'string', enum: ['COMPLETADA', 'CANCELADA'] }
  });
  if (errors) return errorResponse(errors.join(', '), 400, 'VALIDATION_ERROR');

  try {
    const transferencia = await env.TURNO_PVU_DB.prepare(
      `SELECT * FROM transferencias_inventario WHERE id = ?`
    ).bind(id).first();

    if (!transferencia) return errorResponse('Transferencia no encontrada', 404);
    if (transferencia.estado !== 'PENDIENTE') {
      return errorResponse('Solo se pueden actualizar transferencias pendientes', 400);
    }

    await env.TURNO_PVU_DB.prepare(
      `UPDATE transferencias_inventario SET estado = ?, usuario_autoriza = ? WHERE id = ?`
    ).bind(body.estado, authResult.userId, id).run();

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await logAudit(env, authResult.userId, `TRANSFERENCIA_${body.estado}`, 'transferencia', id,
      JSON.stringify({ estado_anterior: 'PENDIENTE', estado_nuevo: body.estado }),
      ip, request.headers.get('User-Agent'));

    return jsonResponse({ success: true, message: `Transferencia ${body.estado.toLowerCase()}` });
  } catch (error) {
    console.error('Update transfer error:', error);
    return errorResponse('Error al actualizar transferencia', 500);
  }
}

// ============================================================================
// 2.13 ENDPOINTS DE ALERTAS
// ============================================================================

/**
 * Listar alertas activas.
 * Coordinador ve las de su centro; Admin ve todas.
 */
async function handleGetAlertas(request, env) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const soloActivas = url.searchParams.get('activas') !== 'false';

    let query = `
      SELECT a.*, c.nombre as centro_nombre, c.codigo as centro_codigo
      FROM alertas a
      LEFT JOIN centros c ON a.centro_id = c.id
      WHERE 1=1`;
    const params = [];

    if (soloActivas) {
      query += ' AND a.resuelta = 0';
    }

    if (authResult.rol === 'COORDINADOR') {
      query += ' AND a.centro_id = ?';
      params.push(authResult.centroId);
    }

    query += ' ORDER BY a.severidad DESC, a.ts_creacion DESC';

    const stmt = env.TURNO_PVU_DB.prepare(query);
    const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    return jsonResponse({ success: true, alertas: results });
  } catch (error) {
    console.error('Get alertas error:', error);
    return errorResponse('Error al obtener alertas', 500);
  }
}

/**
 * Marcar una alerta como resuelta.
 * Registra quien la resolvio y cuando.
 */
async function handleResolverAlerta(request, env, id) {
  const authResult = await requireAuth(request, env, ['COORDINADOR', 'ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    const alerta = await env.TURNO_PVU_DB.prepare(
      `SELECT * FROM alertas WHERE id = ?`
    ).bind(id).first();

    if (!alerta) return errorResponse('Alerta no encontrada', 404);
    if (alerta.resuelta) return errorResponse('La alerta ya fue resuelta', 400);

    // Coordinador solo puede resolver alertas de su centro
    if (authResult.rol === 'COORDINADOR' && alerta.centro_id !== authResult.centroId) {
      return errorResponse('No autorizado para resolver alertas de otro centro', 403);
    }

    await env.TURNO_PVU_DB.prepare(
      `UPDATE alertas SET resuelta = 1, ts_resolucion = datetime('now'), usuario_resolucion = ? WHERE id = ?`
    ).bind(authResult.userId, id).run();

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await logAudit(env, authResult.userId, 'ALERTA_RESUELTA', 'alerta', id,
      JSON.stringify({ tipo: alerta.tipo, severidad: alerta.severidad }),
      ip, request.headers.get('User-Agent'));

    return jsonResponse({ success: true, message: 'Alerta resuelta' });
  } catch (error) {
    console.error('Resolve alert error:', error);
    return errorResponse('Error al resolver alerta', 500);
  }
}

/**
 * Estadisticas de alertas: conteo por tipo y severidad.
 * Solo para ADMIN (vista panoramica del sistema).
 */
async function handleAlertasEstadisticas(request, env) {
  const authResult = await requireAuth(request, env, ['ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    const porSeveridad = await env.TURNO_PVU_DB.prepare(
      `SELECT severidad, resuelta, COUNT(*) as total
       FROM alertas GROUP BY severidad, resuelta`
    ).all();

    const porTipo = await env.TURNO_PVU_DB.prepare(
      `SELECT tipo, COUNT(*) as total, SUM(CASE WHEN resuelta = 0 THEN 1 ELSE 0 END) as activas
       FROM alertas GROUP BY tipo`
    ).all();

    const tiempoResolucion = await env.TURNO_PVU_DB.prepare(
      `SELECT severidad, AVG(julianday(ts_resolucion) - julianday(ts_creacion)) * 24 * 60 as promedio_min
       FROM alertas WHERE resuelta = 1 AND ts_resolucion IS NOT NULL
       GROUP BY severidad`
    ).all();

    return jsonResponse({
      success: true,
      por_severidad: porSeveridad.results,
      por_tipo: porTipo.results,
      tiempo_resolucion_promedio: tiempoResolucion.results
    });
  } catch (error) {
    console.error('Alert stats error:', error);
    return errorResponse('Error al obtener estadisticas', 500);
  }
}

// ============================================================================
// 2.14 ENDPOINTS DE CONFIGURACION DEL SISTEMA
// ============================================================================

/**
 * Obtener toda la configuracion del sistema.
 * Solo ADMIN puede ver la configuracion.
 */
async function handleGetConfig(request, env) {
  const authResult = await requireAuth(request, env, ['ADMIN']);
  if (authResult instanceof Response) return authResult;

  try {
    const { results } = await env.TURNO_PVU_DB.prepare(
      `SELECT clave, valor, descripcion, tipo, ts_actualizacion FROM configuracion ORDER BY clave`
    ).all();

    // Convertir a objeto para acceso facil
    const config = {};
    for (const row of results) {
      config[row.clave] = {
        valor: row.tipo === 'NUMBER' ? Number(row.valor) : row.valor,
        descripcion: row.descripcion,
        tipo: row.tipo,
        actualizado: row.ts_actualizacion
      };
    }

    return jsonResponse({ success: true, configuracion: config, items: results });
  } catch (error) {
    console.error('Get config error:', error);
    return errorResponse('Error al obtener configuracion', 500);
  }
}

/**
 * Actualizar un parametro de configuracion.
 * Solo ADMIN, registra el cambio en auditoria.
 */
async function handleUpdateConfig(request, env, clave) {
  const authResult = await requireAuth(request, env, ['ADMIN']);
  if (authResult instanceof Response) return authResult;

  const body = await getRequestBody(request);
  if (!body || body.valor === undefined) {
    return errorResponse('valor es requerido', 400);
  }

  try {
    // Verificar que la clave existe
    const existing = await env.TURNO_PVU_DB.prepare(
      `SELECT * FROM configuracion WHERE clave = ?`
    ).bind(clave).first();

    if (!existing) return errorResponse('Clave de configuracion no encontrada', 404);

    const valorAnterior = existing.valor;

    await env.TURNO_PVU_DB.prepare(
      `UPDATE configuracion SET valor = ?, actualizado_por = ?, ts_actualizacion = datetime('now') WHERE clave = ?`
    ).bind(String(body.valor), authResult.userId, clave).run();

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await logAudit(env, authResult.userId, 'CONFIG_ACTUALIZADA', 'configuracion', null,
      JSON.stringify({ clave, valor_anterior: valorAnterior, valor_nuevo: String(body.valor) }),
      ip, request.headers.get('User-Agent'));

    return jsonResponse({ success: true, message: `Configuracion '${clave}' actualizada` });
  } catch (error) {
    console.error('Update config error:', error);
    return errorResponse('Error al actualizar configuracion', 500);
  }
}

// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS preflight
    const corsResponse = handleCORS(request, env);
    if (corsResponse) return corsResponse;

    // Rate limiting
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitOk = await checkRateLimit(env, ip, null);
    if (!rateLimitOk) {
      return errorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
    }

    let response;

    try {
      // Router
      // Auth
      if (path === '/api/auth/login' && method === 'POST') {
        response = await handleLogin(request, env);
      }
      else if (path === '/api/auth/refresh' && method === 'POST') {
        response = await handleRefresh(request, env);
      }
      else if (path === '/api/auth/logout' && method === 'POST') {
        response = await handleLogout(request, env);
      }
      // Centros
      else if (path === '/api/centros' && method === 'GET') {
        response = await handleGetCentros(request, env);
      }
      // Turnos
      else if (path === '/api/turnos/abrir' && method === 'POST') {
        response = await handleAbrirTurno(request, env);
      }
      else if (path === '/api/turnos/cerrar' && method === 'POST') {
        response = await handleCerrarTurno(request, env);
      }
      else if (path.match(/^\/api\/turnos\/activo\/(\d+)$/) && method === 'GET') {
        const centroId = path.match(/^\/api\/turnos\/activo\/(\d+)$/)[1];
        response = await handleGetTurnoActivo(request, env, centroId);
      }
      // Fichas
      else if (path === '/api/fichas' && method === 'POST') {
        response = await handleEmitirFicha(request, env);
      }
      else if (path.match(/^\/api\/fichas\/([A-Z0-9-]+)$/) && method === 'GET') {
        const folio = path.match(/^\/api\/fichas\/([A-Z0-9-]+)$/)[1];
        response = await handleGetFicha(request, env, folio);
      }
      else if (path.match(/^\/api\/fichas\/siguiente\/(\d+)$/) && method === 'GET') {
        const turnoId = path.match(/^\/api\/fichas\/siguiente\/(\d+)$/)[1];
        response = await handleGetSiguienteFicha(request, env, turnoId);
      }
      else if (path.match(/^\/api\/fichas\/([A-Z0-9-]+)\/aplicar$/) && method === 'PATCH') {
        const folio = path.match(/^\/api\/fichas\/([A-Z0-9-]+)\/aplicar$/)[1];
        response = await handleAplicarFicha(request, env, folio);
      }
      else if (path.match(/^\/api\/fichas\/turno\/(\d+)$/) && method === 'GET') {
        const turnoId = path.match(/^\/api\/fichas\/turno\/(\d+)$/)[1];
        response = await handleGetFichasTurno(request, env, turnoId);
      }
      // Dashboard
      else if (path === '/api/dashboard' && method === 'GET') {
        response = await handleGetDashboard(request, env);
      }
      else if (path.match(/^\/api\/dashboard\/(\d+)$/) && method === 'GET') {
        const centroId = path.match(/^\/api\/dashboard\/(\d+)$/)[1];
        response = await handleGetDashboardCentro(request, env, centroId);
      }
      // Cortes Manuales
      else if (path === '/api/cortes-manuales' && method === 'POST') {
        response = await handleCorteManual(request, env);
      }
      // Sincronización Offline
      else if (path === '/api/sync/offline' && method === 'POST') {
        response = await handleSyncOffline(request, env);
      }
      // Dispositivos
      else if (path === '/api/dispositivos/crear' && method === 'POST') {
        response = await handleCrearDispositivo(request, env);
      }
      else if (path.match(/^\/api\/dispositivos\/(\d+)$/) && method === 'GET') {
        const centroId = path.match(/^\/api\/dispositivos\/(\d+)$/)[1];
        response = await handleGetDispositivos(request, env, centroId);
      }
      else if (path.match(/^\/api\/dispositivos\/(\d+)$/) && method === 'DELETE') {
        const id = path.match(/^\/api\/dispositivos\/(\d+)$/)[1];
        response = await handleRevocarDispositivo(request, env, id);
      }
      // Bloques de Folios
      else if (path === '/api/bloques/asignar' && method === 'POST') {
        response = await handleAsignarBloque(request, env);
      }
      else if (path.match(/^\/api\/bloques\/(\d+)$/) && method === 'GET') {
        const turnoId = path.match(/^\/api\/bloques\/(\d+)$/)[1];
        response = await handleGetBloques(request, env, turnoId);
      }
      // Reportes CSV
      else if (path === '/api/reportes' && method === 'GET') {
        response = await handleReporteCSV(request, env);
      }
      // Panel Publico (sin autenticacion)
      else if (path === '/api/publico/disponibilidad' && method === 'GET') {
        response = await handleDisponibilidadPublica(request, env);
      }
      // Lotes de Biologicos
      else if (path === '/api/lotes' && method === 'GET') {
        response = await handleGetLotes(request, env);
      }
      else if (path === '/api/lotes' && method === 'POST') {
        response = await handleCrearLote(request, env);
      }
      else if (path === '/api/lotes/caducidad' && method === 'GET') {
        response = await handleLotesCaducidad(request, env);
      }
      // Transferencias de Inventario
      else if (path === '/api/transferencias' && method === 'POST') {
        response = await handleCrearTransferencia(request, env);
      }
      else if (path === '/api/transferencias' && method === 'GET') {
        response = await handleGetTransferencias(request, env);
      }
      else if (path.match(/^\/api\/transferencias\/(\d+)$/) && method === 'PATCH') {
        const id = path.match(/^\/api\/transferencias\/(\d+)$/)[1];
        response = await handleUpdateTransferencia(request, env, id);
      }
      // Alertas
      else if (path === '/api/alertas' && method === 'GET') {
        response = await handleGetAlertas(request, env);
      }
      else if (path.match(/^\/api\/alertas\/(\d+)\/resolver$/) && method === 'PATCH') {
        const id = path.match(/^\/api\/alertas\/(\d+)\/resolver$/)[1];
        response = await handleResolverAlerta(request, env, id);
      }
      else if (path === '/api/alertas/estadisticas' && method === 'GET') {
        response = await handleAlertasEstadisticas(request, env);
      }
      // Configuracion del Sistema
      else if (path === '/api/config' && method === 'GET') {
        response = await handleGetConfig(request, env);
      }
      else if (path.match(/^\/api\/config\/(.+)$/) && method === 'PATCH') {
        const clave = path.match(/^\/api\/config\/(.+)$/)[1];
        response = await handleUpdateConfig(request, env, clave);
      }
      // Health & Metrics
      else if (path === '/api/health' && method === 'GET') {
        response = jsonResponse({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'unknown'
        });
      }
      else if (path === '/api/health/deep' && method === 'GET') {
        response = await handleHealthDeep(request, env);
      }
      else if (path === '/api/metrics' && method === 'GET') {
        response = await handleMetrics(request, env);
      }
      else if (path === '/api/metrics/ingest' && method === 'POST') {
        response = await handleIngestMetrics(request, env);
      }
      // TEMPORAL: Endpoint de prueba para debugging
      else if (path === '/api/test-echo' && method === 'POST') {
        const body = await getRequestBody(request);
        response = jsonResponse({ received: body, message: "Echo test OK" });
      }
      else if (path === '/api/test-hash' && method === 'POST') {
        const body = await getRequestBody(request);
        const { password, salt } = body;
        const hash = await hashPassword(password, salt);
        response = jsonResponse({ hash, salt });
      }
      else {
        response = errorResponse('Endpoint not found', 404, 'NOT_FOUND');
      }

    } catch (error) {
      console.error('Unhandled error:', error);
      response = errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
    }

    // Agregar CORS headers a la respuesta
    const headers = new Headers(response.headers);
    const origin = request.headers.get('Origin');
    Object.entries(corsHeaders(env, origin)).forEach(([key, value]) => {
      headers.set(key, value);
    });

    const finalResponse = new Response(response.body, {
      status: response.status,
      headers
    });

    // Logging
    const duration = Date.now() - startTime;
    logRequest(requestId, method, path, response.status, duration);

    return finalResponse;
  }
};
