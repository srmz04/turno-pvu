# TURNO-PVU — Plan de Tareas Replanteado (Arquitectura + Logística)

> **Versión 2.0** — Replanteamiento desde arquitectura de software senior y logística avanzada
>
> Derivado de `PRD_TURNO_PVU.md` y `PLAN_IMPLEMENTACION.md` con enfoque en producción real, observabilidad, seguridad, optimización logística y resiliencia operativa.
>
> **Principios rectores:**
> - Sistema crítico de salud pública → Disponibilidad 99.9%
> - Datos sensibles → Seguridad por capas
> - Operación distribuida → Monitoreo centralizado
> - Recursos limitados → Optimización logística
> - Emergencia sanitaria → Capacidad de escalar rápidamente

---

## ARQUITECTURA DE FASES

```
FASE 0: Preparación y Fundamentos
FASE 1: Backend Core y Base de Datos
FASE 2: Backend API REST Completa
FASE 3: Shared Frontend — Librerías Compartidas
FASE 4: Módulo Registro — Registrador
FASE 5: Módulo Aplicar — Vacunador
FASE 6: Módulo Coordinador
FASE 7: Panel Público
FASE 8: Dashboard Admin
FASE 9: Deploy y Configuración Final
FASE 10: Pruebas End-to-End
────────────────────────────────────────────────────
FASE 11: Seguridad y Hardening [NUEVO]
FASE 12: Monitoreo, Observabilidad y Alertas [NUEVO]
FASE 13: Optimización Logística y Análisis [NUEVO]
FASE 14: Testing Automatizado [NUEVO]
FASE 15: Backup, DR y Continuidad Operativa [NUEVO]
FASE 16: Documentación y Capacitación [NUEVO]
FASE 17: Fase 2+ Post-MVP Mejorado
```

---

## FASE 0: Preparación del Proyecto [~1.5h]

- [ ] **0.1 Repositorio y estructura de directorios**
  - [ ] Crear repo Git o usar el existente (`srmz04/turno-pvu`)
  - [ ] Crear estructura de carpetas según PLAN_IMPLEMENTACION sección 2:
    ```
    backend/  shared/  registro/  aplicar/  coordinador/  admin/  publico/
    docs/  tests/  scripts/  monitoring/
    ```
  - [ ] Crear `.gitignore` completo (node_modules, .wrangler, .env, *.log, .DS_Store, dist/, coverage/)
  - [ ] Crear `.env.example` con todas las variables de entorno necesarias
  - [ ] Commit inicial: "estructura base del proyecto"

- [ ] **0.2 Configuración Cloudflare**
  - [ ] Crear `backend/package.json` con dependencias: `wrangler`, testing, linting
  - [ ] Crear `backend/wrangler.toml` base con:
    - name: `turno-pvu-backend`
    - compatibility_date actual
    - binding D1: `TURNO_PVU_DB`
    - binding KV: `TURNO_PVU_CACHE` (para caché)
    - binding secret: `JWT_SECRET`
    - vars: environment (dev/staging/prod)
  - [ ] Ejecutar `npx wrangler d1 create turno-pvu-db` (Simulado/Pendiente de login)
  - [ ] Copiar `database_id` al `wrangler.toml`
  - [ ] Configurar secreto JWT: `npx wrangler secret put JWT_SECRET`

- [ ] **0.3 Configuración de Ambientes**
  - [ ] Crear `wrangler.dev.toml` para desarrollo local
  - [ ] Crear `wrangler.staging.toml` para staging
  - [ ] Crear `wrangler.prod.toml` para producción
  - [ ] Configurar variables de entorno por ambiente
  - [ ] Documentar estrategia de promoción entre ambientes

---

## FASE 1: Backend — Esquema de Base de Datos [~3h]

Dependencia: FASE 0 completada.

- [ ] **1.1 Crear `backend/schema.sql`**
  - [ ] Tabla `centros` (id, codigo UNIQUE, nombre, municipio, latitud, longitud, capacidad_max_dia, activo)
  - [ ] Tabla `usuarios` (id, username UNIQUE, password_hash, salt, nombre_completo, centro_id FK, rol CHECK IN, activo, ultimo_login, intentos_fallidos)
  - [ ] Tabla `turnos` (id, centro_id FK, fecha, tipo CHECK MAT/VESP, srp_inicial, sr_inicial, vph_inicial, srp_emitidas, sr_emitidas, vph_emitidas, srp_aplicadas, sr_aplicadas, vph_aplicadas, abierto, usuario_apertura FK, ts_apertura, ts_cierre, duracion_promedio_ficha)
  - [ ] Tabla `fichas` (id, folio UNIQUE, turno_id FK, consecutivo, edad_anios, edad_meses, sexo CHECK M/F, asigna_srp, asigna_sr, asigna_vph, vph_preguntado, vph_tenia, estado CHECK 5 valores, motivo_cancelacion, folio_reemplazo, ts_emision, ts_aplicacion, tiempo_espera_min, usuario_registro_id FK, usuario_aplicacion_id FK, idempotency_key, lote_biologico)
  - [ ] Tabla `auditoria` (id, usuario_id FK, accion, entidad, entidad_id, detalle, ip, user_agent, ts)
  - [ ] Tabla `rechazos` (id, turno_id FK, edad_anios, edad_meses, sexo, motivo, ts)
  - [ ] Tabla `cortes_manuales` (id, turno_id FK, usuario_id FK, srp_restantes, sr_restantes, vph_restantes, notas, ts)
  - [ ] Tabla `bloques_folios` (id, turno_id FK, dispositivo_token, folio_inicio, folio_fin, consumidos, ts_asignacion)
  - [ ] Tabla `dispositivos` (id, centro_id FK, token UNIQUE, rol CHECK REG/APLIC, nombre, url_generada, activo, ts_creacion, creado_por FK, ultimo_acceso)
  - [ ] **[NUEVO]** Tabla `lotes_biologicos` (id, biologico SRPP/SR/VPH, numero_lote, fecha_caducidad, cantidad_inicial, cantidad_actual, temperatura_min, temperatura_max, proveedor, fecha_recepcion)
  - [ ] **[NUEVO]** Tabla `transferencias_inventario` (id, centro_origen FK, centro_destino FK, biologico, cantidad, motivo, usuario_autoriza FK, ts, estado PENDIENTE/COMPLETADA/CANCELADA)
  - [ ] **[NUEVO]** Tabla `metricas_operativas` (id, centro_id FK, fecha, tiempo_promedio_registro_seg, tiempo_promedio_aplicacion_seg, fichas_por_hora, tasa_rechazo_pct, tasa_no_utilizadas_pct)
  - [ ] **[NUEVO]** Tabla `alertas` (id, tipo, severidad BAJA/MEDIA/ALTA/CRITICA, centro_id FK, mensaje, detalle JSON, resuelta BOOLEAN, ts_creacion, ts_resolucion, usuario_resolucion FK)
  - [ ] **[NUEVO]** Tabla `configuracion` (clave VARCHAR PRIMARY KEY, valor TEXT, descripcion TEXT, tipo STRING/NUMBER/JSON, actualizado_por FK, ts_actualizacion)
  - [ ] Indices optimizados: fichas(folio), fichas(turno_id, estado), fichas(idempotency_key), turnos(centro_id, abierto, fecha), auditoria(usuario_id, ts), auditoria(ts DESC), alertas(resuelta, severidad, ts_creacion), UNIQUE turnos(centro_id, fecha, tipo), dispositivos(centro_id, activo), bloques_folios(turno_id), lotes_biologicos(biologico, fecha_caducidad)

- [ ] **1.2 Crear `backend/seed.sql`**
  - [ ] INSERT 15 centros de salud reales de Durango con codigo, municipio, coordenadas GPS y capacidad estimada
  - [ ] INSERT usuario admin (username: `admin`, rol: `ADMIN`, password hasheada con PBKDF2)
  - [ ] INSERT 15 coordinadores (uno por centro, rol: `COORDINADOR`)
  - [ ] INSERT 2-3 registradores de prueba (rol: `REGISTRADOR`)
  - [ ] INSERT 2-3 aplicadores de prueba (rol: `APLICADOR`)
  - [ ] **[NUEVO]** INSERT configuración inicial (rate_limit_requests_per_min: 100, alerta_inventario_bajo_pct: 20, backup_interval_hours: 6)
  - [ ] **[NUEVO]** INSERT lotes de biologicos de prueba con fechas de caducidad

- [ ] **1.3 Ejecutar esquema y seed en D1**
  - [ ] `npx wrangler d1 execute turno-pvu-db --file=schema.sql`
  - [ ] `npx wrangler d1 execute turno-pvu-db --file=seed.sql`
  - [ ] Verificar con queries de prueba que las tablas existen y el seed cargó
  - [ ] Crear script `backend/scripts/reset-db.sh` para reiniciar DB en dev

---

## FASE 2: Backend — Worker API REST [~8h]

Dependencia: FASE 1 completada (esquema ejecutado).

- [ ] **2.1 Scaffold `backend/worker.js` — estructura base**
  - [ ] Router basico: exportar `fetch(request, env, ctx)` con switch/if por ruta
  - [ ] Middleware CORS configurable por ambiente (Access-Control-Allow-Origin, Methods, Headers)
  - [ ] **[NUEVO]** Middleware de rate limiting (usando KV store, límite por IP y por usuario)
  - [ ] **[NUEVO]** Middleware de logging estructurado (request_id, timestamp, método, ruta, status, duración)
  - [ ] Helper `jsonResponse(data, status, headers)` y `errorResponse(message, status, code)`
  - [ ] Helper `getRequestBody(request)` con validación y sanitización
  - [ ] **[NUEVO]** Helper `validateInput(data, schema)` para validación de inputs
  - [ ] **[NUEVO]** Helper `sanitizeSQL(input)` para prevenir SQL injection
  - [ ] Helper de logging que escribe a auditoria DB

- [ ] **2.2 Autenticación JWT y Seguridad**
  - [ ] Función `hashPassword(password, salt)` usando Web Crypto API PBKDF2 (iterations: 100000)
  - [ ] Función `generateSalt()` con crypto.getRandomValues
  - [ ] Función `createJWT(payload, secret)` usando HMAC-SHA256
  - [ ] Función `verifyJWT(token, secret)` con validación de expiración y firma
  - [ ] Función `extractJWT(request)` que lee header Authorization: Bearer
  - [ ] Middleware `requireAuth(request, env, roles[])` que verifica JWT y rol
  - [ ] **[NUEVO]** Implementar rotación de tokens (refresh token)
  - [ ] **[NUEVO]** Bloqueo de cuenta tras 5 intentos fallidos
  - [ ] **[NUEVO]** Registro de IPs sospechosas en auditoria
  - [ ] **Endpoint `POST /api/auth/login`:**
    - Recibir username + password
    - Validar contra intentos_fallidos
    - Buscar usuario activo en DB
    - Validar password con PBKDF2
    - Actualizar ultimo_login, resetear intentos_fallidos
    - Retornar JWT con payload: `{ userId, username, rol, centroId, centroCodigo, exp, iat, jti }`
    - Expiración: 8 horas
    - Registrar en auditoria: login exitoso o fallido con IP
  - [ ] **[NUEVO] Endpoint `POST /api/auth/refresh`:** Renovar token antes de expiración
  - [ ] **[NUEVO] Endpoint `POST /api/auth/logout`:** Invalidar token (blacklist en KV)

- [ ] **2.3 Endpoints de Centros**
  - [ ] `GET /api/centros` — Listar centros activos (JWT: cualquier rol)
    - Retorna: id, codigo, nombre, municipio, latitud, longitud
    - **[NUEVO]** Incluir indicador de disponibilidad actual (DISPONIBLE/BAJO/AGOTADO)
    - **[NUEVO]** Incluir capacidad_max_dia y utilización actual

- [ ] **2.4 Endpoints de Turnos**
  - [ ] `POST /api/turnos/abrir` — Abrir turno (JWT: COORDINADOR+)
    - Recibir: tipo (MAT/VESP), srp_inicial, sr_inicial, vph_inicial, lotes_biologicos[]
    - Validar: no existe turno abierto del mismo tipo hoy en ese centro (UNIQUE idx)
    - Validar: al menos 1 biológico debe ser > 0
    - **[NUEVO]** Verificar fechas de caducidad de lotes
    - **[NUEVO]** Crear alerta si algún lote caduca en <30 días
    - INSERT en turnos
    - Registrar en auditoria
    - **[NUEVO]** Calcular estimación de demanda basada en históricos
  - [ ] `POST /api/turnos/cerrar` — Cerrar turno (JWT: COORDINADOR+)
    - Recibir: turno_id, sobrantes_srp, sobrantes_sr, sobrantes_vph
    - Validar: turno pertenece al centro del usuario
    - Validar: turno está abierto
    - UPDATE fichas EMITIDAS del turno → NO_UTILIZADA
    - UPDATE turno: abierto=0, ts_cierre=now, duracion_promedio_ficha
    - Calcular y retornar resumen: emitidas, aplicadas, canceladas, no_utilizadas, sobrantes
    - Verificar integridad inventario (fórmula del PRD 8.13)
    - Si discrepancia: registrar DISCREPANCIA en auditoria + crear alerta ALTA
    - **[NUEVO]** Actualizar tabla metricas_operativas con KPIs del turno
    - **[NUEVO]** Calcular tiempos promedio (registro, espera, aplicación)
    - Registrar en auditoria: cierre de turno + resumen
  - [ ] `GET /api/turnos/activo/:centroId` — Turno abierto (JWT: cualquier rol)
    - Buscar turno con abierto=1 para el centro
    - Retornar turno completo con contadores de inventario
    - **[NUEVO]** Incluir proyección de agotamiento (minutos restantes estimados)
    - **[NUEVO]** Incluir tasa de utilización actual

- [ ] **2.5 Endpoints de Fichas (CORAZÓN del sistema)**
  - [ ] `POST /api/fichas` — Emitir ficha nueva (JWT: REGISTRADOR+)
    - [Todos los pasos del task.md original]
    - **[NUEVO] Paso 0:** Verificar rate limit del usuario/IP
    - **[NUEVO] Paso 11:** Validar y registrar lote_biologico asociado
    - **[NUEVO] Paso 12:** Si inventario < 20%, crear alerta MEDIA
    - **[NUEVO] Paso 13:** Si inventario < 10%, crear alerta ALTA
    - **[NUEVO] Paso 14:** Actualizar estimación tiempo de espera en tiempo real
  - [ ] `GET /api/fichas/:folio` — Buscar ficha (JWT: APLICADOR+)
    - **[NUEVO]** Incluir tiempo transcurrido desde emisión
    - **[NUEVO]** Incluir posición estimada en cola
  - [ ] `GET /api/fichas/siguiente/:turnoId` — Siguiente folio predicho FIFO (JWT: APLICADOR+)
    - **[NUEVO]** Implementar algoritmo de predicción inteligente basado en patrones históricos
  - [ ] `PATCH /api/fichas/:folio/aplicar` — Marcar aplicada (JWT: APLICADOR+)
    - [Todos los pasos del task.md original]
    - **[NUEVO]** Calcular y registrar tiempo_espera_min
    - **[NUEVO]** Actualizar métricas en tiempo real
  - [ ] `GET /api/fichas/turno/:turnoId` — Listar fichas de turno (JWT: COORDINADOR+)
    - **[NUEVO]** Implementar paginación (limit, offset)
    - **[NUEVO]** Implementar filtros (estado, biologico, rango de tiempo)

- [ ] **2.6 Endpoints de Consumo/Aplicación**
  - [Mantener endpoints del task.md original]

- [ ] **2.7 Endpoints Coordinador (Dispositivos y Bloques)**
  - [Mantener endpoints del task.md original]
  - [ ] **[NUEVO]** `GET /api/dispositivos/:id/health` — Health check de dispositivo (última actividad, estado batería si disponible)

- [ ] **2.8 Endpoint de Cortes Manuales**
  - [Mantener endpoint del task.md original]

- [ ] **2.9 Endpoints de Dashboard**
  - [ ] `GET /api/dashboard` — Consolidado todos centros (JWT: ADMIN)
    - **[NUEVO]** Incluir mapa de calor de utilización
    - **[NUEVO]** Incluir predicción de agotamiento por centro
    - **[NUEVO]** Incluir alertas activas ordenadas por severidad
  - [ ] `GET /api/dashboard/:centroId` — Dashboard de un centro (JWT: COORDINADOR+)
    - **[NUEVO]** Incluir gráfica de tendencia de emisión (fichas/hora)
    - **[NUEVO]** Incluir análisis de cuellos de botella

- [ ] **2.10 Endpoints de Reportes y Panel Público**
  - [Mantener endpoints del task.md original]
  - [ ] **[NUEVO]** `GET /api/reportes/logistica` — Reporte de KPIs logísticos
  - [ ] **[NUEVO]** `GET /api/reportes/performance` — Análisis de performance operativa

- [ ] **2.11 Endpoint de Sincronización Offline**
  - [Mantener endpoint del task.md original]
  - [ ] **[NUEVO]** Implementar detección de conflictos y resolución

- [ ] **2.12 [NUEVO] Endpoints de Gestión de Inventario Logístico**
  - [ ] `GET /api/lotes` — Listar lotes de biologicos (JWT: COORDINADOR+)
  - [ ] `POST /api/lotes` — Registrar nuevo lote (JWT: ADMIN)
  - [ ] `GET /api/lotes/caducidad` — Lotes próximos a caducar (JWT: ADMIN)
  - [ ] `POST /api/transferencias` — Solicitar transferencia entre centros (JWT: COORDINADOR+)
  - [ ] `GET /api/transferencias` — Listar transferencias (JWT: COORDINADOR+)
  - [ ] `PATCH /api/transferencias/:id` — Aprobar/rechazar transferencia (JWT: ADMIN)

- [ ] **2.13 [NUEVO] Endpoints de Alertas y Notificaciones**
  - [ ] `GET /api/alertas` — Listar alertas activas (JWT: según rol)
  - [ ] `PATCH /api/alertas/:id/resolver` — Marcar alerta como resuelta (JWT: COORDINADOR+)
  - [ ] `GET /api/alertas/estadisticas` — Resumen de alertas por tipo y severidad (JWT: ADMIN)

- [ ] **2.14 [NUEVO] Endpoints de Configuración**
  - [ ] `GET /api/config` — Obtener configuración del sistema (JWT: ADMIN)
  - [ ] `PATCH /api/config/:clave` — Actualizar parámetro de configuración (JWT: ADMIN)

- [ ] **2.15 [NUEVO] Endpoints de Health Check y Métricas**
  - [ ] `GET /api/health` — Health check básico (sin auth, para monitoring)
  - [ ] `GET /api/health/deep` — Health check profundo (JWT: ADMIN)
  - [ ] `GET /api/metrics` — Métricas Prometheus-compatible (JWT: ADMIN)

- [ ] **2.16 Deploy inicial del Worker**
  - [ ] `npx wrangler deploy` desde `backend/`
  - [ ] Verificar con curl: POST /api/auth/login con usuario admin
  - [ ] Verificar respuesta JWT válida
  - [ ] **[NUEVO]** Verificar rate limiting funciona
  - [ ] **[NUEVO]** Verificar CORS configurado correctamente
  - [ ] **[NUEVO]** Verificar health check responde

---

## FASE 3: Shared Frontend — Librerías Compartidas [~4h]

Dependencia: FASE 2 completada (API funcional para login como mínimo).

- [ ] **3.1 Crear `shared/config.js`**
  - [Mantener configuración del task.md original]
  - [ ] **[NUEVO]** Constantes de timeout y retry para requests
  - [ ] **[NUEVO]** Configuración de caché (TTL por tipo de dato)
  - [ ] **[NUEVO]** Umbral de alertas (batería, conectividad, etc.)

- [ ] **3.2 Crear `shared/api.js`** — Clase `ApiClient`
  - [Mantener funcionalidad del task.md original]
  - [ ] **[NUEVO]** Implementar retry exponencial con backoff
  - [ ] **[NUEVO]** Implementar circuit breaker para protección de backend
  - [ ] **[NUEVO]** Implementar caché inteligente (cache-first para datos estáticos)
  - [ ] **[NUEVO]** Incluir request_id en headers para trazabilidad
  - [ ] **[NUEVO]** Implementar timeout configurable por endpoint

- [ ] **3.3 Crear `shared/auth.js`** — Clase `AuthManager`
  - [Mantener funcionalidad del task.md original]
  - [ ] **[NUEVO]** Implementar refresh automático de tokens
  - [ ] **[NUEVO]** Detectar y alertar sobre sesiones concurrentes sospechosas

- [ ] **3.4 Crear `shared/db.js`** — IndexedDB wrapper
  - [Mantener stores del task.md original]
  - [ ] **[NUEVO]** Store `metricas_locales` — métricas de performance del dispositivo
  - [ ] **[NUEVO]** Implementar limpieza automática de datos antiguos (>30 días)
  - [ ] **[NUEVO]** Implementar compactación de DB periódica

- [ ] **3.5 Crear `shared/sync.js`** — Clase `SyncManager`
  - [Mantener funcionalidad del task.md original]
  - [ ] **[NUEVO]** Implementar priorización de sincronización (fichas críticas primero)
  - [ ] **[NUEVO]** Implementar detección de conflictos y resolución automática
  - [ ] **[NUEVO]** Implementar métricas de sincronización (latencia, tasa de éxito)

- [ ] **3.6 Crear `shared/styles-base.css`**
  - [Mantener estilos del task.md original]
  - [ ] **[NUEVO]** Estilos para indicadores de performance (latencia, conectividad)
  - [ ] **[NUEVO]** Estilos para alertas por severidad (BAJA/MEDIA/ALTA/CRÍTICA)

- [ ] **3.7 Crear `shared/utils.js`**
  - [Mantener helpers del task.md original]
  - [ ] **[NUEVO]** `getNetworkQuality()` — analizar calidad de red (latencia, velocidad)
  - [ ] **[NUEVO]** `getBatteryStatus()` — obtener nivel de batería del dispositivo
  - [ ] **[NUEVO]** `reportPerformanceMetric(metric, value)` — enviar métricas al backend
  - [ ] **[NUEVO]** `estimarTiempoEspera(turnoId, posicionEnCola)` — calcular tiempo estimado

- [ ] **3.8 [NUEVO] Crear `shared/monitoring.js`** — Clase `MonitoringClient`
  - [ ] Método `trackPageView(route)` — seguimiento de navegación
  - [ ] Método `trackEvent(category, action, label, value)` — eventos de usuario
  - [ ] Método `trackError(error, context)` — errores del frontend
  - [ ] Método `trackPerformance(metric, duration)` — métricas de performance
  - [ ] Método `sendBatch()` — envío por lotes al backend

---

## FASE 4: Módulo Registro — Registrador [~5h]

Dependencia: FASE 3 completada (shared libs).

[Mantener toda la funcionalidad del task.md original]

- [ ] **4.4 Crear `registro/app.js`** — Clase `RegistroApp`
  - [Mantener todos los estados del task.md original]
  - [ ] **[NUEVO] Estado 7: Métricas y Performance**
    - Mostrar contador de fichas procesadas en la sesión
    - Mostrar promedio de tiempo por ficha
    - Mostrar alerta si tiempo promedio > umbral
  - [ ] **[NUEVO]** Implementar detección automática de inactividad (>10 min sin fichas)
  - [ ] **[NUEVO]** Implementar alertas visuales de batería baja (<20%)
  - [ ] **[NUEVO]** Implementar alertas de conectividad degradada
  - [ ] **[NUEVO]** Enviar métricas de performance cada 5 minutos

- [ ] **4.5 Crear `registro/sw.js`** — Service Worker
  - [Mantener funcionalidad del task.md original]
  - [ ] **[NUEVO]** Implementar caché estratégico por tipo de recurso
  - [ ] **[NUEVO]** Implementar limpieza de caché antigua

---

## FASE 5: Módulo Aplicar — Vacunador [~5h]

Dependencia: FASE 3 completada y FASE 4 funcional.

[Mantener toda la funcionalidad del task.md original]

- [ ] **5.4 Crear `aplicar/app.js`** — Clase `AplicadorApp`
  - [Mantener flujo del task.md original]
  - [ ] **[NUEVO]** Mostrar tiempo promedio de aplicación
  - [ ] **[NUEVO]** Mostrar fichas aplicadas por hora
  - [ ] **[NUEVO]** Alertar si tasa de aplicación < objetivo
  - [ ] **[NUEVO]** Implementar "modo rápido" con confirmación por doble-tap

---

## FASE 6: Módulo Coordinador [~6h]

Dependencia: FASE 4 y FASE 5 completadas.

[Mantener toda la funcionalidad del task.md original]

- [ ] **6.4 Crear `coordinador/app.js`** — Clase `CoordinadorApp`
  - [Mantener todas las vistas del task.md original]
  - [ ] **[NUEVO] Vista: Análisis Logístico**
    - Gráfica de tendencia de emisión vs aplicación
    - Identificación de cuellos de botella
    - Proyección de agotamiento de inventario
    - Recomendaciones automáticas (ej. "agregar un registrador")
  - [ ] **[NUEVO] Vista: Gestión de Lotes**
    - Listar lotes asignados al centro
    - Alertas de caducidad próxima
    - Trazabilidad de uso por lote
  - [ ] **[NUEVO] Vista: Transferencias de Inventario**
    - Solicitar transferencia a otro centro
    - Ver transferencias pendientes
    - Confirmar recepción de transferencia
  - [ ] **[NUEVO] Vista: Performance del Personal**
    - Fichas procesadas por registrador
    - Vacunas aplicadas por aplicador
    - Tiempos promedio por persona

---

## FASE 7: Panel Público [~1.5h]

[Mantener funcionalidad del task.md original]

- [ ] **7.3 Crear `publico/app.js`**
  - [Mantener funcionalidad del task.md original]
  - [ ] **[NUEVO]** Mostrar mapa con centros y disponibilidad
  - [ ] **[NUEVO]** Filtrar por municipio
  - [ ] **[NUEVO]** Mostrar tiempo de espera estimado
  - [ ] **[NUEVO]** Implementar modo oscuro automático

---

## FASE 8: Dashboard Admin [~4h]

[Mantener funcionalidad del task.md original]

- [ ] **8.4 Crear `admin/app.js`** — Clase `AdminApp`
  - [Mantener todas las vistas del task.md original]
  - [ ] **[NUEVO] Vista: Mapa de Calor Operativo**
    - Visualización geográfica de todos los centros
    - Código de colores por utilización
    - Rutas optimizadas para redistribución
  - [ ] **[NUEVO] Vista: Predicción de Demanda**
    - Análisis histórico de demanda
    - Predicción de picos de demanda
    - Recomendaciones de inventario por centro
  - [ ] **[NUEVO] Vista: KPIs Logísticos**
    - Tasa de rotación de inventario
    - Tiempo promedio en cola
    - Tasa de utilización de capacidad
    - Eficiencia operativa por centro
  - [ ] **[NUEVO] Vista: Alertas Centralizadas**
    - Tablero de alertas activas
    - Priorización por severidad
    - Tiempos de respuesta y resolución
  - [ ] **[NUEVO] Vista: Análisis de Desperdicios**
    - Dosis no utilizadas por causa
    - Fichas canceladas por motivo
    - Oportunidades de mejora

---

## FASE 9: Deploy y Configuración Final [~2.5h]

[Mantener funcionalidad del task.md original]

- [ ] **9.4 Seed de datos de producción**
  - [Mantener del task.md original]
  - [ ] **[NUEVO]** Cargar datos históricos de demanda (si disponibles)
  - [ ] **[NUEVO]** Configurar alertas específicas por centro
  - [ ] **[NUEVO]** Configurar lotes de biologicos reales con fechas de caducidad

- [ ] **9.5 [NUEVO] Configuración de Monitoreo**
  - [ ] Configurar health checks externos (UptimeRobot o similar)
  - [ ] Configurar dashboards de métricas (Grafana Cloud free tier o similar)
  - [ ] Configurar alertas de disponibilidad
  - [ ] Configurar webhooks para alertas críticas

---

## FASE 10: Pruebas End-to-End [~4h]

[Mantener todas las pruebas del task.md original]

- [ ] **10.10 [NUEVO] Pruebas de Carga**
  - [ ] Simular 50 registradores concurrentes
  - [ ] Simular 100 fichas emitidas en 1 minuto
  - [ ] Verificar tiempos de respuesta < 500ms p95
  - [ ] Verificar que rate limiting funciona
  - [ ] Verificar que caché mejora performance

- [ ] **10.11 [NUEVO] Pruebas de Resiliencia**
  - [ ] Caída del backend durante emisión de ficha
  - [ ] Reconexión después de 1 hora offline
  - [ ] Sincronización de 1000 fichas pendientes
  - [ ] Conflictos de sincronización (mismo folio generado offline en 2 dispositivos)

- [ ] **10.12 [NUEVO] Pruebas de Seguridad Básicas**
  - [ ] Intentos de SQL injection en campos de entrada
  - [ ] Intentos de XSS en campos de texto
  - [ ] Intentos de acceso sin autenticación
  - [ ] Intentos de escalamiento de privilegios
  - [ ] Validar rate limiting efectivo

---

## FASE 11: Seguridad y Hardening [~4h] [NUEVA FASE]

Dependencia: FASE 10 completada.

- [ ] **11.1 Hardening del Backend**
  - [ ] Implementar Content Security Policy (CSP)
  - [ ] Configurar Security Headers (HSTS, X-Frame-Options, X-Content-Type-Options)
  - [ ] Validar todos los inputs con schemas estrictos
  - [ ] Sanitizar todas las salidas para prevenir XSS
  - [ ] Implementar prepared statements para todas las queries SQL
  - [ ] Configurar rate limiting por endpoint (agresivo en /api/auth/login)
  - [ ] Implementar IP blacklisting automático tras 10 intentos fallidos

- [ ] **11.2 Gestión de Secretos**
  - [ ] Rotar JWT_SECRET y documentar procedimiento
  - [ ] Implementar rotación automática de secretos cada 90 días
  - [ ] Verificar que .env nunca se suba al repo
  - [ ] Documentar proceso de generación de secretos seguros
  - [ ] Configurar alertas de exposición de secretos (git-secrets o similar)

- [ ] **11.3 Auditoría de Seguridad**
  - [ ] Ejecutar escaneo de vulnerabilidades (npm audit)
  - [ ] Revisar logs de auditoria en busca de patrones sospechosos
  - [ ] Verificar que contraseñas cumplen política mínima (8 caracteres, complejidad)
  - [ ] Revisar permisos de roles (principio de menor privilegio)
  - [ ] Documentar superficie de ataque y mitigaciones

- [ ] **11.4 HTTPS y Certificados**
  - [ ] Verificar que Cloudflare Pages sirve todo con HTTPS
  - [ ] Configurar redirección HTTP → HTTPS
  - [ ] Configurar HSTS con preload
  - [ ] Verificar certificados válidos en todos los ambientes

- [ ] **11.5 Privacidad de Datos**
  - [ ] Verificar que NO se almacenan datos personales (CURP, nombres)
  - [ ] Configurar retention de logs (auditoria: 180 días, después anonimizar o eliminar)
  - [ ] Documentar política de privacidad mínima
  - [ ] Implementar opción de exportar datos de auditoria de un usuario

---

## FASE 12: Monitoreo, Observabilidad y Alertas [~5h] [NUEVA FASE]

Dependencia: FASE 9 completada.

- [ ] **12.1 Configuración de Logging**
  - [ ] Implementar logging estructurado (JSON) en backend
  - [ ] Configurar niveles de log (DEBUG, INFO, WARN, ERROR, FATAL)
  - [ ] Agregar contexto rico a logs (request_id, user_id, centro_id, timestamp)
  - [ ] Implementar agregación de logs (Cloudflare Logs o Logflare free tier)
  - [ ] Crear dashboards de logs por severidad

- [ ] **12.2 Métricas de Performance**
  - [ ] Implementar instrumentación de endpoints (latencia p50/p95/p99)
  - [ ] Configurar métricas de base de datos (query duration, connection pool)
  - [ ] Implementar métricas de frontend (page load time, time to interactive)
  - [ ] Configurar métricas de sincronización offline (queue size, sync latency)
  - [ ] Crear dashboard de métricas operativas

- [ ] **12.3 Alertas Automatizadas**
  - [ ] Alerta: API con error rate > 5% por 5 minutos
  - [ ] Alerta: Latencia p95 > 2 segundos por 5 minutos
  - [ ] Alerta: Centro sin actividad > 30 minutos durante turno abierto
  - [ ] Alerta: Inventario < 10% en cualquier centro
  - [ ] Alerta: Más de 3 fichas con discrepancia de inventario en un turno
  - [ ] Alerta: Health check fallando
  - [ ] Alerta: Intentos de login fallidos > 20 en 5 minutos (posible ataque)
  - [ ] Configurar canales de notificación (email, webhook a Slack/Telegram)

- [ ] **12.4 Dashboards de Observabilidad**
  - [ ] Dashboard: Estado general del sistema (health, uptime, error rate)
  - [ ] Dashboard: Performance por endpoint (latencia, throughput, errores)
  - [ ] Dashboard: Actividad por centro (fichas emitidas, aplicadas, rechazadas)
  - [ ] Dashboard: Inventario en tiempo real (disponible, emitido, aplicado)
  - [ ] Dashboard: Alertas activas y historial de resolución
  - [ ] Dashboard: Métricas de sincronización offline

- [ ] **12.5 Trazabilidad de Requests**
  - [ ] Implementar request_id único por request
  - [ ] Propagar request_id a través de logs y auditoria
  - [ ] Implementar herramienta de búsqueda de traces por request_id
  - [ ] Documentar cómo investigar un incidente usando traces

- [ ] **12.6 SLOs y SLIs**
  - [ ] Definir SLO: Disponibilidad 99.9% (máximo 43 minutos de downtime/mes)
  - [ ] Definir SLO: Latencia p95 < 1 segundo para emisión de ficha
  - [ ] Definir SLO: Tasa de error < 1% para todos los endpoints
  - [ ] Implementar medición automática de SLIs
  - [ ] Crear reporte semanal de cumplimiento de SLOs

---

## FASE 13: Optimización Logística y Análisis [~6h] [NUEVA FASE]

Dependencia: FASE 8 completada (Dashboard Admin funcional).

- [ ] **13.1 Análisis de Demanda y Predicción**
  - [ ] Implementar algoritmo de predicción de demanda por centro
    - Basado en históricos de fichas emitidas por día/hora
    - Factores: día de semana, mes, eventos especiales
    - Output: demanda esperada ± margen de error
  - [ ] Crear visualización de predicciones vs realidad
  - [ ] Implementar alertas cuando demanda real supera predicción >20%
  - [ ] Generar recomendaciones de inventario inicial por turno

- [ ] **13.2 Optimización de Inventario**
  - [ ] Implementar algoritmo de punto de reorden
    - Alerta cuando inventario < demanda promedio * 2 horas
  - [ ] Implementar cálculo de inventario óptimo por centro
    - Basado en demanda histórica + variabilidad + tiempo de reabastecimiento
  - [ ] Crear reporte de rotación de inventario (días de cobertura)
  - [ ] Identificar centros con sobre-stock o desabasto crónico

- [ ] **13.3 Redistribución Inteligente de Inventario**
  - [ ] Implementar algoritmo de redistribución óptima
    - Input: inventario actual por centro, demanda esperada
    - Output: transferencias sugeridas para balancear
    - Considerar: distancia entre centros, costo logístico, urgencia
  - [ ] Crear vista de "Oportunidades de Redistribución"
  - [ ] Implementar flujo de aprobación y ejecución de transferencias
  - [ ] Generar reporte de transferencias realizadas y su impacto

- [ ] **13.4 Análisis de Cuellos de Botella**
  - [ ] Implementar detección automática de cuellos de botella
    - Comparar tiempo promedio de registro vs aplicación
    - Identificar si el cuello está en registro o aplicación
    - Calcular capacidad teórica vs utilizada
  - [ ] Crear alertas cuando cuello de botella reduce throughput >30%
  - [ ] Generar recomendaciones:
    - "Agregar 1 registrador" si tiempo de registro > 2x aplicación
    - "Agregar 1 aplicador" si tiempo de aplicación > 2x registro

- [ ] **13.5 KPIs Logísticos Avanzados**
  - [ ] Implementar cálculo de KPIs:
    - Tasa de rotación de inventario (turnover rate)
    - Tasa de utilización de capacidad (fichas procesadas / capacidad_max_dia)
    - Tiempo de ciclo promedio (emisión → aplicación)
    - Tasa de fichas no utilizadas (desperdicio)
    - Eficiencia de personal (fichas por operador por hora)
    - Fill rate (demanda satisfecha / demanda total)
  - [ ] Crear dashboard de KPIs logísticos
  - [ ] Implementar benchmarking entre centros
  - [ ] Generar reporte mensual con insights y recomendaciones

- [ ] **13.6 Análisis de Costos Operativos**
  - [ ] Calcular costo por ficha procesada
    - Considerar: personal, biologico, infraestructura
  - [ ] Identificar centros con costo unitario alto
  - [ ] Generar reporte de eficiencia costo-beneficio
  - [ ] Proyectar costos de escalar operación

- [ ] **13.7 Optimización de Rutas de Distribución**
  - [ ] Implementar algoritmo de optimización de rutas para transferencias
    - Usar coordenadas GPS de centros
    - Calcular ruta óptima para múltiples entregas
    - Considerar restricciones de cadena de frío
  - [ ] Crear visualización de rutas optimizadas en mapa
  - [ ] Generar lista de paradas con tiempos estimados

- [ ] **13.8 Gestión de Caducidad y FEFO (First Expired, First Out)**
  - [ ] Implementar alertas de lotes próximos a caducar (30, 15, 7 días)
  - [ ] Generar recomendaciones de uso prioritario de lotes
  - [ ] Identificar riesgo de desperdicio por caducidad
  - [ ] Crear vista de "Lotes en Riesgo" con acciones sugeridas

---

## FASE 14: Testing Automatizado [~6h] [NUEVA FASE]

Dependencia: FASE 2 completada (Backend funcional).

- [ ] **14.1 Configuración de Framework de Testing**
  - [ ] Instalar y configurar Vitest para backend
  - [ ] Instalar y configurar Playwright para E2E
  - [ ] Configurar coverage reporting (istanbul)
  - [ ] Configurar CI para ejecutar tests automáticamente
  - [ ] Establecer umbral mínimo de coverage: 80%

- [ ] **14.2 Tests Unitarios de Backend**
  - [ ] Test: hashPassword y generateSalt
  - [ ] Test: createJWT y verifyJWT
  - [ ] Test: validación de edad (todos los casos borde)
  - [ ] Test: determinación de biologico (SRP vs SR vs VPH)
  - [ ] Test: cálculo de inventario disponible
  - [ ] Test: idempotencia de emisión de fichas
  - [ ] Test: integridad de inventario al cierre de turno
  - [ ] Test: rate limiting
  - [ ] Test: sanitización de inputs
  - [ ] Objetivo: >90% coverage en lógica de negocio

- [ ] **14.3 Tests de Integración de API**
  - [ ] Test: flujo completo de login
  - [ ] Test: abrir turno → emitir ficha → aplicar ficha → cerrar turno
  - [ ] Test: rechazo por edad inválida
  - [ ] Test: bloqueo por inventario agotado
  - [ ] Test: aplicación de ficha de otro centro
  - [ ] Test: cancelación de ficha y devolución de inventario
  - [ ] Test: reemisión de ficha
  - [ ] Test: sincronización de fichas offline
  - [ ] Test: creación de dispositivos y asignación de bloques
  - [ ] Test: cortes manuales y actualización de dashboard

- [ ] **14.4 Tests End-to-End con Playwright**
  - [ ] Test: Registrador completa flujo de emisión de ficha
  - [ ] Test: Aplicador completa flujo de aplicación secuencial
  - [ ] Test: Coordinador abre y cierra turno
  - [ ] Test: Admin ve dashboard consolidado
  - [ ] Test: Panel público muestra disponibilidad
  - [ ] Test: Offline → emisión local → reconexión → sincronización
  - [ ] Test: Flujo multi-usuario concurrente (2 registradores, 2 aplicadores)

- [ ] **14.5 Tests de Performance**
  - [ ] Benchmark: emisión de 100 fichas consecutivas
  - [ ] Benchmark: búsqueda de ficha por folio (con DB de 10K fichas)
  - [ ] Benchmark: carga de dashboard con 15 centros y 5K fichas
  - [ ] Benchmark: sincronización de 1000 fichas offline
  - [ ] Load test: 50 requests concurrentes a /api/fichas
  - [ ] Establecer baseline de performance y alertar si regresión >20%

- [ ] **14.6 Tests de Seguridad Automatizados**
  - [ ] Test: SQL injection en todos los endpoints
  - [ ] Test: XSS en campos de texto
  - [ ] Test: CSRF en endpoints de mutación
  - [ ] Test: escalamiento de privilegios (REGISTRADOR intentando cerrar turno)
  - [ ] Test: rate limiting (100 requests en 10 segundos)
  - [ ] Test: tokens JWT expirados o inválidos

- [ ] **14.7 Tests de Regresión**
  - [ ] Crear suite de tests de regresión críticos
  - [ ] Ejecutar suite en cada deploy
  - [ ] Configurar alertas si tests fallan en producción

- [ ] **14.8 Documentación de Testing**
  - [ ] Documentar estrategia de testing (qué, cómo, cuándo)
  - [ ] Documentar cómo ejecutar tests localmente
  - [ ] Documentar cómo agregar nuevos tests
  - [ ] Crear guía de troubleshooting de tests fallidos

---

## FASE 15: Backup, DR y Continuidad Operativa [~4h] [NUEVA FASE]

Dependencia: FASE 9 completada.

- [ ] **15.1 Estrategia de Backup**
  - [ ] Implementar backup automático de D1 cada 6 horas
  - [ ] Configurar retención de backups: 7 días diarios, 4 semanales, 3 mensuales
  - [ ] Implementar backup de configuración (wrangler.toml, secrets)
  - [ ] Documentar ubicación y acceso a backups
  - [ ] Crear script de restauración de backup

- [ ] **15.2 Disaster Recovery (DR)**
  - [ ] Documentar procedimiento de recuperación ante desastre
  - [ ] Crear playbook: "Qué hacer si el backend cae"
  - [ ] Crear playbook: "Qué hacer si D1 se corrompe"
  - [ ] Crear playbook: "Qué hacer si Cloudflare tiene outage"
  - [ ] Definir RTO (Recovery Time Objective): 30 minutos
  - [ ] Definir RPO (Recovery Point Objective): 6 horas (último backup)
  - [ ] Practicar procedimiento de DR (drill) 1 vez antes del piloto

- [ ] **15.3 Plan de Continuidad Operativa**
  - [ ] Documentar procedimiento de operación totalmente offline
    - Registradores usan bloques de folios preasignados
    - Coordinador lleva registro en papel como respaldo
    - Al restaurar conectividad, captura retroactiva
  - [ ] Crear formato de papel de emergencia para fichas
  - [ ] Documentar cómo hacer captura retroactiva de fichas en papel
  - [ ] Establecer protocolo de comunicación sin sistema (radio, teléfono)

- [ ] **15.4 Monitoreo de Backups**
  - [ ] Implementar verificación automática de backups (backup existe y es válido)
  - [ ] Configurar alertas si backup falla
  - [ ] Crear dashboard de estado de backups
  - [ ] Documentar proceso de validación manual de backup

- [ ] **15.5 Exportación de Datos Críticos**
  - [ ] Implementar exportación diaria de datos críticos a CSV
    - Todos los turnos del día
    - Todas las fichas del día
    - Inventario actual de todos los centros
  - [ ] Almacenar exportaciones en ubicación redundante (Google Drive, Dropbox)
  - [ ] Configurar alertas si exportación falla

- [ ] **15.6 Plan de Rollback**
  - [ ] Documentar procedimiento de rollback a versión anterior
    - Frontend: revertir deploy en Cloudflare Pages
    - Backend: revertir deploy de Worker
    - DB: restaurar desde backup si es necesario
  - [ ] Definir criterios para decidir hacer rollback
  - [ ] Practicar rollback en staging

---

## FASE 16: Documentación y Capacitación [~5h] [NUEVA FASE]

Dependencia: FASE 10 completada.

- [ ] **16.1 Documentación Técnica**
  - [ ] Crear `docs/ARCHITECTURE.md`: arquitectura del sistema, componentes, flujos
  - [ ] Crear `docs/API.md`: documentación de todos los endpoints (OpenAPI/Swagger)
  - [ ] Crear `docs/DATABASE.md`: esquema de base de datos, relaciones, índices
  - [ ] Crear `docs/DEPLOYMENT.md`: proceso de deploy, ambientes, configuración
  - [ ] Crear `docs/MONITORING.md`: dashboards, alertas, cómo investigar incidentes
  - [ ] Crear `docs/SECURITY.md`: políticas de seguridad, gestión de secretos
  - [ ] Crear `docs/TESTING.md`: estrategia de testing, cómo ejecutar tests
  - [ ] Crear `docs/TROUBLESHOOTING.md`: problemas comunes y soluciones

- [ ] **16.2 Documentación Operativa**
  - [ ] Crear `docs/MANUAL_COORDINADOR.md`: guía completa para coordinadores de centro
  - [ ] Crear `docs/MANUAL_REGISTRADOR.md`: guía paso a paso para registradores
  - [ ] Crear `docs/MANUAL_APLICADOR.md`: guía paso a paso para aplicadores
  - [ ] Crear `docs/MANUAL_ADMIN.md`: guía para coordinador general
  - [ ] Crear `docs/FAQ.md`: preguntas frecuentes y respuestas
  - [ ] Crear `docs/PLAYBOOKS.md`: procedimientos de emergencia y contingencia

- [ ] **16.3 Material de Capacitación**
  - [ ] Crear video tutorial para Registradores (max 3 minutos)
  - [ ] Crear video tutorial para Aplicadores (max 3 minutos)
  - [ ] Crear video tutorial para Coordinadores (max 5 minutos)
  - [ ] Crear presentación de onboarding para todo el personal (max 15 slides)
  - [ ] Crear checklist de verificación pre-turno para Coordinadores
  - [ ] Crear tarjeta de referencia rápida imprimible para Registradores
  - [ ] Crear tarjeta de referencia rápida imprimible para Aplicadores

- [ ] **16.4 Documentación de Procesos**
  - [ ] Documentar proceso: Abrir turno matutino
  - [ ] Documentar proceso: Cerrar turno
  - [ ] Documentar proceso: Cancelar ficha
  - [ ] Documentar proceso: Reemitir ficha
  - [ ] Documentar proceso: Crear dispositivo nuevo
  - [ ] Documentar proceso: Asignar bloque de folios
  - [ ] Documentar proceso: Enviar corte manual
  - [ ] Documentar proceso: Solicitar transferencia de inventario
  - [ ] Documentar proceso: Resolver discrepancia de inventario
  - [ ] Documentar proceso: Dar de alta nuevo usuario
  - [ ] Documentar proceso: Revocar acceso de usuario

- [ ] **16.5 Documentación de Soporte**
  - [ ] Crear canal de soporte (WhatsApp, Telegram, o email)
  - [ ] Crear plantillas de respuesta para problemas comunes
  - [ ] Documentar proceso de escalamiento de incidentes
  - [ ] Crear SLA de soporte (tiempo de respuesta por severidad)
  - [ ] Documentar horarios de soporte

- [ ] **16.6 Capacitación Práctica**
  - [ ] Organizar sesión de capacitación para coordinadores (2 horas)
  - [ ] Organizar sesión de capacitación para registradores (1 hora)
  - [ ] Organizar sesión de capacitación para aplicadores (1 hora)
  - [ ] Crear ambiente de sandbox para práctica
  - [ ] Realizar simulacro de operación completa
  - [ ] Recopilar feedback de capacitación y ajustar

- [ ] **16.7 Documentación de Gobernanza**
  - [ ] Crear política de gestión de usuarios
  - [ ] Crear política de gestión de datos
  - [ ] Crear política de cambios en producción
  - [ ] Crear procedimiento de auditoría de accesos
  - [ ] Documentar responsabilidades por rol

---

## FASE 17: Fase 2+ Post-MVP Mejorado [~15h]

Dependencia: Piloto exitoso en 1-2 centros + Validación de métricas.

- [ ] **17.1 Dashboard Admin Completo (del task.md original)**
  - [ ] Gráficas de barras: fichas por centro por día
  - [ ] Gráficas de línea: tendencia de emisión/aplicación por semana
  - [ ] Mapa de calor: actividad por hora del día
  - [ ] **[NUEVO]** Mapa geográfico interactivo con todos los centros
  - [ ] **[NUEVO]** Gráficas de KPIs logísticos (rotación, utilización, eficiencia)

- [ ] **17.2 Reportes CSV Avanzados (del task.md original)**
  - [ ] Reporte de captación VPH: elegibles vs captados vs perdidos por desabasto
  - [ ] Reporte de rechazos por edad: histograma de edades rechazadas
  - [ ] Reporte de discrepancias de inventario
  - [ ] **[NUEVO]** Reporte de performance operativa por centro
  - [ ] **[NUEVO]** Reporte de análisis de costos
  - [ ] **[NUEVO]** Reporte de transferencias de inventario
  - [ ] **[NUEVO]** Reporte de trazabilidad de lotes

- [ ] **17.3 Alertas Visuales/Sonoras (del task.md original)**
  - [ ] Alerta sonora cuando inventario < 10% en cualquier centro
  - [ ] Notificación push (si el navegador lo soporta) al coordinador general
  - [ ] **[NUEVO]** Alerta predictiva de agotamiento (2 horas antes de agotar)
  - [ ] **[NUEVO]** Alerta de cuello de botella detectado
  - [ ] **[NUEVO]** Alerta de dispositivo inactivo durante turno

- [ ] **17.4 Mejoras UX Basadas en Feedback del Piloto (del task.md original)**
  - [ ] Ajustes de tamaño de botones
  - [ ] Ajustes de colores/contraste
  - [ ] Simplificar flujos que causaron confusión
  - [ ] Agregar ayuda contextual donde sea necesario
  - [ ] **[NUEVO]** Implementar modo de accesibilidad (alto contraste, texto grande)
  - [ ] **[NUEVO]** Implementar atajos de teclado para operaciones comunes

- [ ] **17.5 [NUEVO] Integraciones Externas**
  - [ ] Integración con SISMOS/SINBA (si disponible API)
  - [ ] Integración con sistema de gestión de cadena de frío
  - [ ] Integración con sistema de RH para turnos de personal
  - [ ] Webhooks para notificaciones externas (Slack, Telegram)

- [ ] **17.6 [NUEVO] Funcionalidades Avanzadas de IA/ML**
  - [ ] Modelo de predicción de demanda con ML
  - [ ] Detección de anomalías en patrones de uso
  - [ ] Recomendaciones automáticas de optimización
  - [ ] Chatbot de soporte básico para preguntas frecuentes

- [ ] **17.7 [NUEVO] App Móvil Nativa (Opcional)**
  - [ ] Evaluar necesidad basada en feedback del piloto
  - [ ] Si se justifica: PWA a App nativa (React Native o similar)
  - [ ] Funcionalidades offline mejoradas
  - [ ] Notificaciones push nativas

---

## ESTIMACIONES TOTALES

### MVP (Fases 0-10 + 11-15)
- **Desarrollo Core (Fases 0-10):** 26-33h (original)
- **Seguridad (Fase 11):** 4h
- **Monitoreo (Fase 12):** 5h
- **Optimización Logística (Fase 13):** 6h
- **Testing (Fase 14):** 6h
- **Backup & DR (Fase 15):** 4h
- **Documentación (Fase 16):** 5h
- **TOTAL MVP ROBUSTO:** **56-63 horas**

### Post-MVP (Fase 17)
- **Fase 2+ Mejorada:** 15h adicionales
- **TOTAL CON POST-MVP:** **71-78 horas**

---

## CRITERIOS DE ÉXITO MEJORADOS

### Técnicos
- [ ] Disponibilidad: 99.9% uptime (máx 43 min downtime/mes)
- [ ] Performance: p95 latencia < 1 segundo en emisión de ficha
- [ ] Error rate: < 1% en todos los endpoints
- [ ] Coverage de tests: > 80% en backend
- [ ] Seguridad: 0 vulnerabilidades críticas en auditoría
- [ ] Tiempo de recuperación ante desastre: < 30 minutos

### Operativos
- [ ] Fichas emitidas sin exceder inventario: 100%
- [ ] Fichas fuera de rango de edad: 0
- [ ] Centros usando el sistema: 15/15
- [ ] Tiempo de registro por paciente: < 20 segundos
- [ ] Captación VPH en elegibles: > 80%
- [ ] Tasa de fichas no utilizadas: < 5%

### Logísticos
- [ ] Tasa de rotación de inventario: > 90% (< 10% desperdicio)
- [ ] Tasa de utilización de capacidad: > 70%
- [ ] Tiempo promedio en cola: < 30 minutos
- [ ] Tasa de transferencias exitosas: > 95%
- [ ] Precisión de predicción de demanda: ± 20%
- [ ] Alertas de desabasto resueltas en: < 2 horas

### Adopción y Satisfacción
- [ ] Adopción del personal: > 90% en semana 1
- [ ] Satisfacción del personal: > 7/10 (encuesta post-piloto)
- [ ] Incidentes de soporte: < 10 por día tras semana 1
- [ ] Tiempo de capacitación efectivo: < 30 minutos por rol

---

## MÉTRICAS CLAVE A MONITOREAR

### Performance
- Latencia p50/p95/p99 por endpoint
- Throughput (requests/segundo)
- Error rate por endpoint y total
- DB query duration

### Operativas
- Fichas emitidas por centro por hora
- Fichas aplicadas por centro por hora
- Tasa de rechazos
- Tasa de fichas no utilizadas
- Tasa de cancelaciones

### Logísticas
- Inventario disponible en tiempo real por centro y biologico
- Tasa de rotación de inventario
- Tasa de utilización de capacidad
- Tiempo promedio de ciclo (emisión → aplicación)
- Tiempo promedio en cola
- Eficiencia de personal (fichas/operador/hora)

### Disponibilidad
- Uptime del backend
- Uptime del frontend
- Disponibilidad de DB
- Tasa de éxito de sincronización offline

### Seguridad
- Intentos de login fallidos
- Requests bloqueados por rate limiting
- Alertas de seguridad activas

---

*Documento generado con enfoque en arquitectura de software nivel producción y optimización logística avanzada. Versión 2.0 - 14 febrero 2026.*

*Este plan incorpora las mejores prácticas de DevOps, SRE, seguridad, y gestión de operaciones logísticas para garantizar un sistema robusto, observable, seguro y eficiente para una emergencia sanitaria real.*
