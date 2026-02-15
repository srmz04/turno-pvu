# TURNO-PVU - Guía de Pruebas

Esta guía documenta tanto las pruebas automatizadas como las pruebas manuales necesarias para validar el sistema completo.

---

## 🤖 Pruebas Automatizadas (E2E)

### Ejecutar Pruebas Automatizadas

```bash
cd backend

# Pruebas contra servidor local (requiere: npm run dev en otra terminal)
./scripts/run-tests.sh local

# Pruebas contra ambiente de desarrollo
./scripts/run-tests.sh dev

# Pruebas contra ambiente de staging
./scripts/run-tests.sh staging
```

### Pruebas Cubiertas Automáticamente

El script `test-e2e.js` ejecuta las siguientes pruebas:

#### ✅ Autenticación (6 pruebas)
- [x] Login como ADMIN
- [x] Login como COORDINADOR
- [x] Login como REGISTRADOR
- [x] Login como APLICADOR
- [x] Login con contraseña incorrecta (debe fallar)
- [x] Acceso sin autenticación (debe fallar)

#### ✅ Gestión de Turnos (3 pruebas)
- [x] Coordinador abre turno MATUTINO con inventario inicial (120 SRP, 30 SR, 25 VPH)
- [x] No se puede abrir otro turno del mismo tipo (debe fallar)
- [x] Obtener turno activo del centro

#### ✅ Emisión de Fichas (6 pruebas)
- [x] Registrador emite ficha para menor de 7 años → SRP
- [x] Registrador emite ficha para niña de 11 años → SR + VPH (aceptado)
- [x] Registrador emite ficha para niña de 11 años → SR, VPH rechazado
- [x] Registrador intenta emitir para adulto de 35 años → RECHAZADO
- [x] Registrador intenta emitir para menor de 6 meses → RECHAZADO
- [x] Verificar que inventario se decrementó correctamente

#### ✅ Aplicación de Vacunas (3 pruebas)
- [x] Aplicador busca ficha por folio
- [x] Aplicador marca ficha como APLICADA
- [x] Aplicador intenta re-aplicar → "YA APLICADA" (debe fallar)

#### ✅ Cierre de Turno (2 pruebas)
- [x] Coordinador cierra turno con sobrantes → resumen correcto
- [x] Verificar que turno está cerrado

#### ✅ Panel Público (1 prueba)
- [x] Acceso público a lista de centros (sin autenticación)

#### ✅ Dashboard Admin (2 pruebas)
- [x] Admin accede a dashboard consolidado con KPIs
- [x] Admin lista todos los usuarios

**Total: 23 pruebas automatizadas**

---

## 👤 Pruebas Manuales

Las siguientes pruebas requieren interacción manual con la interfaz web:

### 1. Pruebas de Interfaz (UI/UX)

#### Módulo Registro
- [ ] Formulario de emisión de ficha es claro y fácil de usar
- [ ] QR code se genera y es escaneable
- [ ] Botón de imprimir funciona correctamente
- [ ] Feedback visual al emitir ficha (loading, éxito, error)
- [ ] Validación de campos en tiempo real
- [ ] Responsive en tablet (MeeBox)
- [ ] Responsive en móvil

#### Módulo Aplicar
- [ ] Interfaz FIFO muestra "SIGUIENTE FOLIO" correctamente
- [ ] Botón dinámico cambia color según biológico (SRP naranja, SR morado)
- [ ] Botón [SALTAR] funciona correctamente
- [ ] Búsqueda manual de folio funciona
- [ ] Feedback visual al aplicar (loading, éxito, error)
- [ ] Mensaje "YA APLICADA" en rojo cuando corresponde

#### Módulo Coordinador
- [ ] Formulario de apertura de turno es claro
- [ ] Monitor de inventario actualiza en tiempo real
- [ ] Semáforo de estado funciona (verde/amarillo/rojo)
- [ ] Tabla de fichas muestra datos correctos
- [ ] Resumen de cierre muestra todos los datos

#### Dashboard Admin
- [ ] Tabla de 15 centros se renderiza correctamente
- [ ] Filtros por municipio y estado funcionan
- [ ] Auto-refresh cada 60s con countdown visible
- [ ] Botón de actualización manual funciona
- [ ] Modales de crear/editar abren correctamente
- [ ] Exportación CSV descarga archivo válido
- [ ] Navegación por tabs funciona sin problemas

#### Panel Público
- [ ] Tabla de disponibilidad se muestra sin autenticación
- [ ] Semáforo de colores es claro
- [ ] Actualización automática funciona

### 2. Pruebas de Modo Offline

⚠️ **CRÍTICO**: Estas pruebas validan la funcionalidad offline del sistema.

#### Setup
1. Abrir módulo de registro en navegador
2. Login exitoso como registrador
3. Abrir DevTools → Application → Service Workers (verificar registrado)
4. Abrir DevTools → Application → IndexedDB → `turno-pvu-db`

#### Pruebas

- [ ] **Test Offline 2.1**: Desconectar internet (modo avión o desconectar WiFi)
  - [ ] Registrador puede seguir emitiendo fichas localmente
  - [ ] Fichas se almacenan en IndexedDB → `pending_operations`
  - [ ] Interfaz muestra indicador "Sin conexión"
  - [ ] Folio se genera correctamente offline

- [ ] **Test Offline 2.2**: Emitir 5 fichas offline
  - [ ] Todas se almacenan en `pending_operations`
  - [ ] No se envían al servidor (verificar en Network tab)
  - [ ] Folios son consecutivos y únicos

- [ ] **Test Offline 2.3**: Reconectar internet
  - [ ] Sincronización automática se dispara
  - [ ] Todas las fichas pendientes se envían al servidor
  - [ ] `pending_operations` se vacía después de sync exitoso
  - [ ] Interfaz muestra "Sincronizado"

- [ ] **Test Offline 2.4**: Reconexión después de 1 hora offline
  - [ ] Fichas antiguas (>1h) se sincronizan correctamente
  - [ ] No hay pérdida de datos
  - [ ] Orden de fichas se mantiene (FIFO)

- [ ] **Test Offline 2.5**: Sincronización de 50+ fichas pendientes
  - [ ] Batch processing funciona (no timeout)
  - [ ] Progress indicator se muestra
  - [ ] Todas las fichas se sincronizan

#### Escenarios de Error Offline

- [ ] **Test Error 2.6**: Conflicto de folios
  - [ ] Si mismo folio se genera en 2 dispositivos offline → error controlado
  - [ ] Sistema muestra mensaje claro de conflicto
  - [ ] Se puede resolver manualmente (re-intentar con nuevo folio)

- [ ] **Test Error 2.7**: Turno cerrado durante offline
  - [ ] Si coordinador cierra turno mientras registrador está offline → rechazo al sync
  - [ ] Fichas offline no se pierden (quedan en cola con error)
  - [ ] Se puede mover a nuevo turno manualmente

### 3. Pruebas de Compatibilidad

#### MeeBox 2018 (Hardware antiguo)
- [ ] Sistema carga en <5 segundos
- [ ] Todas las funciones principales funcionan
- [ ] No hay crashes o freezes
- [ ] Modo offline funciona correctamente
- [ ] Impresión de QR funciona (si tiene impresora USB)

#### Navegadores
- [ ] Chrome/Edge (Windows/Linux)
- [ ] Firefox (Windows/Linux)
- [ ] Safari (iOS/macOS)
- [ ] Chrome Mobile (Android)

#### Dispositivos
- [ ] Tablet 7" (resolución mínima: 800x600)
- [ ] Smartphone (resolución mínima: 360x640)
- [ ] Desktop (1920x1080)

### 4. Pruebas de Agotamiento de Inventario

- [ ] **Test Inventario 4.1**: Agotar SRP
  - [ ] Emitir fichas hasta SRP_disponibles = 0
  - [ ] Sistema bloquea emisión de fichas que requieren SRP
  - [ ] Sistema muestra semáforo ROJO
  - [ ] Fichas que solo requieren SR/VPH siguen funcionando

- [ ] **Test Inventario 4.2**: Semáforo amarillo (≤20%)
  - [ ] Al llegar a ≤20% de cualquier biológico → semáforo amarillo
  - [ ] Alerta visual en dashboard coordinador
  - [ ] Dashboard admin muestra estado amarillo

- [ ] **Test Inventario 4.3**: Proyección de agotamiento
  - [ ] Dashboard muestra "minutos restantes estimados"
  - [ ] Cálculo es razonable basado en tasa actual

### 5. Pruebas de Roles y Permisos

- [ ] **Test Roles 5.1**: REGISTRADOR
  - [ ] Solo puede emitir fichas
  - [ ] No puede acceder a módulo coordinador
  - [ ] No puede acceder a módulo aplicar
  - [ ] No puede acceder a dashboard admin

- [ ] **Test Roles 5.2**: APLICADOR
  - [ ] Solo puede aplicar fichas
  - [ ] No puede emitir fichas
  - [ ] No puede abrir/cerrar turnos
  - [ ] No puede acceder a dashboard admin

- [ ] **Test Roles 5.3**: COORDINADOR
  - [ ] Puede abrir/cerrar turnos de su centro
  - [ ] No puede abrir/cerrar turnos de otros centros
  - [ ] No puede acceder a dashboard admin (gestión de usuarios)
  - [ ] Puede ver estado de su centro

- [ ] **Test Roles 5.4**: ADMIN
  - [ ] Puede acceder a todos los módulos
  - [ ] Puede gestionar usuarios (CRUD)
  - [ ] Puede gestionar centros (CRUD)
  - [ ] Puede ver dashboard consolidado de todos los centros

### 6. Pruebas de Performance

- [ ] **Test Perf 6.1**: Carga de página inicial
  - [ ] Login screen carga en <2 segundos
  - [ ] Assets críticos se cargan primero (CSS, JS mínimo)

- [ ] **Test Perf 6.2**: Emisión rápida de fichas
  - [ ] Emitir 10 fichas consecutivas
  - [ ] Cada emisión toma <1 segundo
  - [ ] No hay lag visible en la interfaz

- [ ] **Test Perf 6.3**: Dashboard con 15 centros
  - [ ] Carga completa en <3 segundos
  - [ ] Filtros responden instantáneamente (<100ms)
  - [ ] Auto-refresh no causa parpadeo

- [ ] **Test Perf 6.4**: Búsqueda de fichas
  - [ ] Búsqueda por folio responde en <500ms
  - [ ] Búsqueda funciona con folios recientes y antiguos

### 7. Pruebas de Seguridad Básicas

- [ ] **Test Sec 7.1**: Intentos de SQL Injection
  - [ ] Campos de texto con `'; DROP TABLE usuarios; --`
  - [ ] Sistema rechaza o escapa correctamente

- [ ] **Test Sec 7.2**: Intentos de XSS
  - [ ] Campos de texto con `<script>alert('XSS')</script>`
  - [ ] Sistema escapa o sanitiza correctamente

- [ ] **Test Sec 7.3**: Acceso directo a URLs protegidas
  - [ ] Acceder a `/coordinador/` sin login → redirección a login
  - [ ] Acceder a `/admin/` sin rol ADMIN → error 403

- [ ] **Test Sec 7.4**: Manipulación de JWT
  - [ ] Modificar payload de JWT → rechazo del servidor
  - [ ] Token expirado → logout automático
  - [ ] Token de otro usuario → rechazo

### 8. Pruebas de Usabilidad

- [ ] **Test UX 8.1**: Flujo completo sin documentación
  - [ ] Usuario nuevo puede completar flujo básico sin ayuda
  - [ ] Mensajes de error son claros y accionables
  - [ ] Navegación es intuitiva

- [ ] **Test UX 8.2**: Mensajes de error
  - [ ] Errores de validación son claros
  - [ ] Errores de red son informativos ("Sin conexión", "Error del servidor")
  - [ ] No hay errores técnicos crudos (stack traces)

- [ ] **Test UX 8.3**: Feedback visual
  - [ ] Loading spinners en operaciones asíncronas
  - [ ] Confirmaciones visuales de acciones exitosas (checkmark, toast)
  - [ ] Estados disabled de botones cuando no aplican

---

## 📊 Checklist de Verificación Completa

Antes de considerar el sistema listo para producción:

### Core Funcional
- [ ] Todas las pruebas automatizadas (23) pasan
- [ ] Todas las pruebas manuales de interfaz pasan
- [ ] Todas las pruebas offline pasan
- [ ] Todas las pruebas de roles y permisos pasan

### Performance y Compatibilidad
- [ ] Sistema funciona en MeeBox 2018
- [ ] Sistema funciona en todos los navegadores soportados
- [ ] Tiempos de respuesta <500ms p95
- [ ] Modo offline es robusto (probado con 100+ fichas)

### Seguridad
- [ ] Autenticación funciona correctamente
- [ ] Permisos por rol se respetan
- [ ] No hay vulnerabilidades SQL Injection
- [ ] No hay vulnerabilidades XSS
- [ ] JWT expira correctamente

### UX
- [ ] Interfaz es clara e intuitiva
- [ ] Mensajes de error son útiles
- [ ] Feedback visual es apropiado
- [ ] Sistema es responsive en todos los tamaños de pantalla

### Operacional
- [ ] Backup de datos funciona
- [ ] Logs de auditoría son completos
- [ ] Documentación está actualizada
- [ ] Usuarios de prueba están documentados

---

## 🚨 Errores Conocidos y Limitaciones

(Documentar aquí cualquier limitación conocida o comportamiento edge case)

### Limitaciones Actuales
- El modo offline no detecta conflictos de folios hasta la sincronización
- Dashboard admin solo auto-refresh si está en la vista Dashboard (no en otras tabs)
- Exportación CSV tiene límite de 10,000 registros por archivo

### Pendientes Post-MVP
- Pruebas de carga con 50+ registradores concurrentes
- Pruebas de resiliencia con caídas del backend
- Implementación de refresh tokens
- Implementación de backup automático
- Configuración de monitoreo externo

---

**Última actualización**: 14 febrero 2026
