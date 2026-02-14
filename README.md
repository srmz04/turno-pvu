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
- Wrangler CLI instalado globalmente: `npm install -g wrangler`

### Instalación

```bash
# 1. Clonar repositorio
git clone https://github.com/srmz04/turno-pvu.git
cd turno-pvu

# 2. Instalar dependencias del backend
cd backend
npm install

# 3. Autenticar con Cloudflare
npx wrangler login

# 4. Crear base de datos D1
npx wrangler d1 create turno-pvu-db
# Copiar el database_id al wrangler.toml

# 5. Ejecutar migraciones
npm run db:migrate
npm run db:seed

# 6. Configurar JWT secret
npx wrangler secret put JWT_SECRET
# Generar con: openssl rand -base64 32

# 7. Crear KV namespace para caché
npx wrangler kv:namespace create TURNO_PVU_CACHE
# Copiar el id al wrangler.toml

# 8. Desarrollo local
npm run dev
# El backend estará en http://localhost:8787
```

### Deploy

```bash
# Backend
cd backend
npm run deploy

# Frontend (Cloudflare Pages)
cd ..
npx wrangler pages deploy . --project-name=turno-pvu
```

## 📊 Estado del Proyecto

### FASE 0: Preparación ✅ COMPLETADA
- [x] Estructura de directorios
- [x] .gitignore y .env.example
- [x] Configuración de Cloudflare (wrangler.toml)
- [x] Configuración de ambientes (dev/staging/prod)
- [x] Documentación de deployment

### FASE 1: Backend - Esquema de Base de Datos ✅ COMPLETADA
- [x] schema.sql completo (14 tablas + vistas)
- [x] seed.sql con datos iniciales
- [x] Script de reset de DB
- [x] Índices optimizados

### FASE 2: Backend - Worker API REST (EN PROGRESO)
- [ ] Estructura base del worker
- [ ] Autenticación JWT
- [ ] Endpoints de centros, turnos, fichas
- [ ] ...

Ver [task.md](task.md) para el plan completo de tareas.

## 📁 Estructura del Proyecto

```
TURNO-PVU/
├── backend/              # Cloudflare Worker (API)
│   ├── worker.js
│   ├── schema.sql
│   ├── seed.sql
│   ├── package.json
│   └── wrangler*.toml
├── shared/               # Código compartido frontend
│   ├── api.js
│   ├── auth.js
│   ├── db.js
│   ├── sync.js
│   └── utils.js
├── registro/             # Módulo Registrador
├── aplicar/              # Módulo Vacunador
├── coordinador/          # Módulo Coordinador
├── admin/                # Dashboard Admin
├── publico/              # Panel Público
├── docs/                 # Documentación
├── tests/                # Tests automatizados
├── scripts/              # Scripts de utilidad
└── monitoring/           # Configuración de monitoreo
```

## 🧪 Testing

```bash
# Tests unitarios
npm run test

# Tests con coverage
npm run test:coverage

# Tests E2E (requiere Playwright)
npm run test:e2e
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

---

**Estado**: 🚧 En Desarrollo Activo
**Versión**: 1.0.0-alpha
**Última actualización**: 14 febrero 2026

---

*Sistema desarrollado con urgencia para responder a la emergencia sanitaria por brote de sarampión en Durango, México.*
