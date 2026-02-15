# TURNO-PVU

Sistema de Gestión de Turnos para Puestos de Vacunación Universal

**Estado de Emergencia Sanitaria - Campaña de Sarampión 2025-2026**

## 🎯 Descripción

TURNO-PVU es un sistema digital de control de turnos diseñado para gestionar la campaña de vacunación contra sarampión en 15 centros de salud de Durango, México. El sistema garantiza que cada dosis de biológico disponible se asigne a un menor dentro del rango autorizado (6 meses a 12 años), con trazabilidad completa y visibilidad en tiempo real.

## 📋 Características Principales

- ✅ **Control de Inventario en Tiempo Real**: Bloqueo automático cuando se agotan dosis
- ✅ **Validación Automática de Edad**: Rechaza personas fuera del rango 6m-12a
- ✅ **Gestión de 3 Biológicos**: SRP (Triple Viral), SR (Doble Viral), VPH
- ✅ **Operación Offline**: Sincronización automática al recuperar conectividad
- ✅ **Multi-Centro**: 15 centros de salud con dashboard consolidado
- ✅ **Trazabilidad Completa**: Auditoría de cada acción con usuario, hora y dispositivo
- ✅ **Panel Público**: Disponibilidad en tiempo real sin autenticación
- ✅ **4 Roles**: Registrador, Aplicador, Coordinador, Admin

## 🏗️ Arquitectura

```
Frontend (PWA)                Backend (Cloudflare Workers)
├── /registro/                ├── worker.js (API REST)
├── /aplicar/                 ├── schema.sql (D1 Database)
├── /coordinador/             └── KV Store (Cache + Rate Limiting)
├── /admin/
└── /publico/

Shared Components
├── api.js (ApiClient)
├── auth.js (JWT + Login)
├── db.js (IndexedDB offline)
├── sync.js (Background Sync)
└── utils.js
```

## 🚀 Quick Start

### Prerrequisitos

- Node.js 18+
- Cuenta de Cloudflare (free tier suficiente)
- Wrangler CLI: `npm install -g wrangler`
- Git (para control de versiones)

### Instalación Desarrollo Local

```bash
# 1. Clonar repositorio
git clone https://github.com/srmz04/turno-pvu.git
cd turno-pvu

# 2. Instalar dependencias del backend
cd backend
npm install

# 3. Autenticar con Cloudflare
npx wrangler login

# 4. Configurar base de datos local
npm run db:migrate
npm run db:seed

# Actualizar passwords con hashes reales
npx wrangler d1 execute turno-pvu-db-dev --local --file=update-hashes.sql

# 5. Desarrollo local
npm run dev
# Backend estará en http://localhost:8787
```

### Servir Frontend Localmente

```bash
# En la raíz del proyecto
npx http-server -p 8080 -c-1

# Las PWAs estarán disponibles en:
# http://localhost:8080/registro/
# http://localhost:8080/aplicar/
# http://localhost:8080/coordinador/
# http://localhost:8080/admin/
# http://localhost:8080/publico/
```

### Setup de Ambientes Remotos

```bash
cd backend

# Setup completo para desarrollo
./scripts/setup-db.sh dev

# Setup completo para staging
./scripts/setup-db.sh staging

# Setup completo para producción
./scripts/setup-db.sh prod
```

El script `setup-db.sh` realiza:
- Crea la base de datos D1
- Aplica el esquema completo
- Carga datos iniciales (15 centros + usuarios)
- Configura passwords con hashes PBKDF2
- Configura JWT_SECRET

### Deployment

**Opción 1: Script Automatizado (Recomendado)**

```bash
cd backend

# Deploy a desarrollo
./scripts/deploy.sh dev

# Deploy a staging
./scripts/deploy.sh staging

# Deploy a producción
./scripts/deploy.sh prod
```

El script `deploy.sh` realiza:
- Verificaciones pre-deployment (git status, archivos críticos, autenticación)
- Deploy del Worker (backend)
- Deploy de Cloudflare Pages (frontend)
- Muestra URLs y próximos pasos

**Opción 2: Deployment Manual**

```bash
# Backend (Worker)
cd backend
npm run deploy:prod

# Frontend (Cloudflare Pages)
cd ..
npx wrangler pages deploy . --project-name=turno-pvu --branch=main
```

### Reset de Base de Datos (Solo Desarrollo)

```bash
cd backend
npm run db:reset
```

⚠️ **Advertencia**: Esto elimina TODOS los datos locales.

## 📊 Estado del Proyecto

### ✅ FASES COMPLETADAS

- **FASE 0**: Preparación y configuración inicial
- **FASE 1**: Backend - Esquema de base de datos (14 tablas)
- **FASE 2**: Backend - Worker API REST (endpoints core MVP)
- **FASE 3**: Shared - Código compartido (api.js, auth.js, offline.js, utils.js)
- **FASE 4**: Módulo Registro (emisión de fichas con QR + modo offline)
- **FASE 5**: Módulo Aplicar (vacunación FIFO + indicador dinámico SRP/SR)
- **FASE 6**: Módulo Coordinador (gestión de turnos + inventario)
- **FASE 7**: Panel Público (consulta de disponibilidad sin autenticación)
- **FASE 8**: Dashboard Admin (monitoreo global + gestión usuarios + reportes CSV)
- **FASE 9**: Deploy y Configuración Final (scripts automatizados + documentación)
- **FASE 10**: Pruebas End-to-End (23 pruebas automatizadas + guía de pruebas manuales)

### 🚧 EN PROGRESO

- **FASE 11**: Seguridad y Hardening
  - Validación de inputs
  - Security headers
  - Auditoría de seguridad

### 📋 PENDIENTES

- **FASE 12**: Monitoreo y Observabilidad
- **FASE 13**: Optimización Logística y Análisis

Ver [task.md](task.md) para el plan completo de tareas y tracking detallado.

## 📁 Estructura del Proyecto

```
TURNO-PVU/
├── backend/                      # Cloudflare Worker (API)
│   ├── worker.js                 # Worker principal con API REST
│   ├── schema.sql                # Esquema completo (14 tablas)
│   ├── seed.sql                  # Datos iniciales (15 centros + usuarios)
│   ├── update-hashes.sql         # Passwords con hashes PBKDF2
│   ├── package.json              # Dependencias y scripts npm
│   ├── wrangler.toml             # Config base
│   ├── wrangler.dev.toml         # Config desarrollo
│   ├── wrangler.staging.toml     # Config staging
│   ├── wrangler.prod.toml        # Config producción
│   └── scripts/
│       ├── reset-db.sh           # Reset DB local (desarrollo)
│       ├── setup-db.sh           # Setup DB remota (dev/staging/prod)
│       └── deploy.sh             # Deployment automatizado
│
├── shared/                       # Código compartido frontend
│   ├── config.js                 # Configuración de API endpoints
│   ├── api.js                    # Cliente HTTP con retry
│   ├── auth.js                   # Gestión JWT + login
│   ├── utils.js                  # Validación, formato, etc.
│   ├── offline.js                # IndexedDB + sync offline
│   └── styles-base.css           # Estilos base compartidos
│
├── registro/                     # Módulo de emisión de fichas
│   ├── index.html
│   ├── app.js                    # Lógica QR + offline
│   ├── styles.css
│   └── manifest.json
│
├── aplicar/                      # Módulo de aplicación de vacunas
│   ├── index.html
│   ├── app.js                    # Lógica FIFO + indicador dinámico
│   ├── styles.css
│   └── manifest.json
│
├── coordinador/                  # Módulo de coordinación de centro
│   ├── index.html
│   ├── app.js                    # Gestión turnos + inventario
│   ├── styles.css
│   └── manifest.json
│
├── admin/                        # Dashboard administrativo
│   ├── index.html
│   ├── app.js                    # Dashboard global + CRUD
│   ├── styles.css
│   └── manifest.json
│
├── publico/                      # Panel público (sin autenticación)
│   ├── index.html
│   ├── app.js                    # Consulta de disponibilidad
│   ├── styles.css
│   └── manifest.json
│
├── docs/                         # Documentación
│   ├── DEPLOYMENT.md             # Guía detallada de deployment
│   └── AMBIENTES.md              # Configuración de ambientes
│
├── PRD_TURNO_PVU.md             # Product Requirements Document
├── PLAN_IMPLEMENTACION.md        # Plan de implementación técnico
├── task.md                       # Tracking de tareas por fase
└── README.md                     # Este archivo
```

## 🧪 Testing

### Pruebas Automatizadas End-to-End

```bash
cd backend

# Pruebas contra servidor local (requiere: npm run dev en otra terminal)
npm run test:e2e

# Pruebas contra ambiente de desarrollo
npm run test:e2e:dev

# Pruebas contra ambiente de staging
npm run test:e2e:staging
```

El script ejecuta **23 pruebas automatizadas** que cubren:
- ✅ Autenticación con todos los roles (6 tests)
- ✅ Gestión de turnos (3 tests)
- ✅ Emisión de fichas con validación de edad (6 tests)
- ✅ Aplicación de vacunas (3 tests)
- ✅ Cierre de turno (2 tests)
- ✅ Panel público (1 test)
- ✅ Dashboard admin (2 tests)

### Pruebas Manuales

Para pruebas de interfaz, modo offline, y compatibilidad, ver [docs/TESTING.md](docs/TESTING.md).

Pruebas críticas manuales incluyen:
- Modo offline (emisión de fichas sin conexión + sincronización)
- Compatibilidad con MeeBox 2018
- Responsive en móviles y tablets
- Agotamiento de inventario
- Roles y permisos

### Tests Unitarios (Futuro)

```bash
# Tests unitarios con Vitest
npm run test

# Tests con coverage
npm run test:coverage
```

## 📚 Documentación

- [PRD](PRD_TURNO_PVU.md) - Product Requirements Document
- [Plan de Implementación](PLAN_IMPLEMENTACION.md) - Arquitectura técnica
- [Plan de Tareas](task.md) - Tareas detalladas por fase
- [Deployment](docs/DEPLOYMENT.md) - Guía de deployment y ambientes

## 🔒 Seguridad

- Autenticación JWT con HMAC-SHA256
- Passwords hasheados con PBKDF2 (100,000 iterations)
- Rate limiting por IP y usuario
- Content Security Policy (CSP)
- HTTPS obligatorio
- Auditoría completa de acciones

## 📈 Monitoreo

- Health checks: `/api/health`
- Métricas: `/api/metrics` (Prometheus-compatible)
- Dashboards de observabilidad (ver docs/MONITORING.md)
- Alertas automatizadas por severidad

## 🤝 Contribución

Este es un proyecto de emergencia sanitaria. Ver [CONTRIBUTING.md](docs/CONTRIBUTING.md) para guías de contribución.

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE)

## 👥 Equipo

- Arquitectura y Desarrollo: [Equipo TURNO-PVU]
- Coordinación General: Secretaría de Salud de Durango
- Soporte Técnico: [Contacto]

## 🆘 Soporte

- **Técnico**: support@turno-pvu.mx
- **Operativo**: [WhatsApp/Telegram del equipo]
- **Emergencias**: [Teléfono 24/7]

## 🔑 Usuarios de Prueba

Después de ejecutar el seed, están disponibles los siguientes usuarios para testing:

| Usuario | Password | Rol | Centro Asignado | Descripción |
|---------|----------|-----|-----------------|-------------|
| `admin` | `Admin123!` | ADMIN | N/A | Dashboard global, gestión usuarios/centros |
| `coord.cs001` | `Coord123!` | COORDINADOR | CS001 | Apertura/cierre de turnos |
| `reg.cs001.1` | `Reg123!` | REGISTRADOR | CS001 | Emisión de fichas con QR |
| `aplica.cs001.1` | `Aplica123!` | APLICADOR | CS001 | Aplicación de vacunas |

⚠️ **IMPORTANTE**: En producción, cambiar TODAS estas contraseñas inmediatamente.

---

## 🛠️ Comandos Útiles

```bash
# Desarrollo local
npm run dev                    # Iniciar Worker en localhost:8787
npm run db:reset              # Reset DB local (elimina datos)

# Pruebas
npm run test:e2e              # Pruebas E2E contra local
npm run test:e2e:dev          # Pruebas E2E contra dev
npm run test:e2e:staging      # Pruebas E2E contra staging

# Deployment
./scripts/deploy.sh dev       # Deploy completo a desarrollo
./scripts/deploy.sh staging   # Deploy completo a staging
./scripts/deploy.sh prod      # Deploy completo a producción

# Base de datos remota
./scripts/setup-db.sh dev     # Setup inicial DB desarrollo
./scripts/setup-db.sh prod    # Setup inicial DB producción

# Deployment manual
npm run deploy:dev            # Deploy solo Worker a dev
npm run deploy:staging        # Deploy solo Worker a staging
npm run deploy:prod           # Deploy solo Worker a prod

# Monitoreo
npx wrangler tail --config=wrangler.prod.toml    # Ver logs en tiempo real
npx wrangler d1 list                             # Listar bases de datos
```

---

**Estado**: ✅ MVP Completado - 🚧 Finalizando Deploy
**Versión**: 1.0.0
**Última actualización**: 14 febrero 2026

---

*Sistema desarrollado con urgencia para responder a la emergencia sanitaria por brote de sarampión en Durango, México. Gestiona ~50,000 niños/niñas de 6 meses a 12 años en 15 centros de salud.*
