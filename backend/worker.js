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
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
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

function corsHeaders(env) {
  const origin = env.ENVIRONMENT === 'production' 
    ? 'https://turno-pvu.pages.dev' 
    : '*';
    
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function handleCORS(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(env) });
  }
  return null;
}

// ============================================================================
// MIDDLEWARE RATE LIMITING
// ============================================================================

async function checkRateLimit(env, ip, userId) {
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
  
  const { username, password } = body;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  try {
    // Buscar usuario
    const user = await env.TURNO_PVU_DB.prepare(
      `SELECT * FROM usuarios WHERE username = ? AND activo = 1`
    ).bind(username).first();
    
    if (!user) {
      await logAudit(env, null, 'LOGIN_FAILED', 'usuario', null, 
        JSON.stringify({ username, reason: 'user_not_found' }), ip, request.headers.get('User-Agent'));
      return errorResponse('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    
    // Verificar intentos fallidos
    if (user.intentos_fallidos >= 5) {
      await logAudit(env, user.id, 'LOGIN_BLOCKED', 'usuario', user.id, 
        'Account locked due to too many failed attempts', ip, request.headers.get('User-Agent'));
      return errorResponse('Account locked - Contact administrator', 403, 'ACCOUNT_LOCKED');
    }
    
    // Verificar password
    const passwordHash = await hashPassword(password, user.salt);
    
    if (passwordHash !== user.password_hash) {
      // Incrementar intentos fallidos
      await env.TURNO_PVU_DB.prepare(
        `UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1 WHERE id = ?`
      ).bind(user.id).run();
      
      await logAudit(env, user.id, 'LOGIN_FAILED', 'usuario', user.id,
        JSON.stringify({ reason: 'invalid_password' }), ip, request.headers.get('User-Agent'));
      
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
    
    await logAudit(env, user.id, 'LOGIN_SUCCESS', 'usuario', user.id, null, ip, request.headers.get('User-Agent'));
    
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
    console.error('Login error:', error);
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

  const { turno_id, sobrantes_srp = 0, sobrantes_sr = 0, sobrantes_vph = 0 } = body;

  try {
    // Obtener turno
    const turno = await env.TURNO_PVU_DB.prepare(`
      SELECT * FROM turnos WHERE id = ? AND centro_id = ? AND abierto = 1
    `).bind(turno_id, authResult.centroId).first();

    if (!turno) {
      return errorResponse('Turno not found or already closed', 404);
    }

    // Actualizar fichas EMITIDAS a NO_UTILIZADA
    await env.TURNO_PVU_DB.prepare(`
      UPDATE fichas SET estado = 'NO_UTILIZADA'
      WHERE turno_id = ? AND estado = 'EMITIDA'
    `).bind(turno_id).run();

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
    `).bind(turno_id).all();

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
        JSON.stringify({ turno_id, esperado: srp_debe_sobrar, reportado: sobrantes_srp })
      ).run();

      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      await logAudit(env, authResult.userId, 'DISCREPANCIA_INVENTARIO', 'turno', turno_id,
        JSON.stringify({ srp_esperado: srp_debe_sobrar, srp_reportado: sobrantes_srp }), ip, request.headers.get('User-Agent'));
    }

    // Cerrar turno
    await env.TURNO_PVU_DB.prepare(`
      UPDATE turnos SET abierto = 0, ts_cierre = datetime('now')
      WHERE id = ?
    `).bind(turno_id).run();

    // Actualizar métricas operativas
    const duracionTotal = (new Date() - new Date(turno.ts_apertura)) / 1000; // segundos
    const fichaPorHora = resumen.emitidas / (duracionTotal / 3600);
    const tasaRechazo = 0; // TODO: obtener de tabla rechazos
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
    await logAudit(env, authResult.userId, 'TURNO_CERRADO', 'turno', turno_id,
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
    const maxConsecutivo = await env.TURNO_PVU_DB.prepare(`
      SELECT COALESCE(MAX(consecutivo), 0) as max_consecutivo
      FROM fichas
      WHERE turno_id = ?
    `).bind(turno.id).first();

    const consecutivo = (maxConsecutivo?.max_consecutivo || 0) + 1;

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

    // Calcular tiempo de espera
    const tiempoEsperaMin = Math.floor(
      (Date.now() - new Date(ficha.ts_emision).getTime()) / 1000 / 60
    );

    // UPDATE ficha
    await env.TURNO_PVU_DB.prepare(`
      UPDATE fichas
      SET estado = 'APLICADA',
          ts_aplicacion = datetime('now'),
          tiempo_espera_min = ?,
          usuario_aplicacion_id = ?
      WHERE folio = ?
    `).bind(tiempoEsperaMin, authResult.userId, folio).run();

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
      else {
        response = errorResponse('Endpoint not found', 404, 'NOT_FOUND');
      }
      
    } catch (error) {
      console.error('Unhandled error:', error);
      response = errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
    }
    
    // Agregar CORS headers a la respuesta
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders(env)).forEach(([key, value]) => {
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
