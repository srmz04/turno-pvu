# TURNO-PVU - Guía de Deployment

## Estrategia de Ambientes

### Ambientes Disponibles

1. **Development** (`dev`)
   - Base de datos: `turno-pvu-db-dev`
   - Worker: `turno-pvu-backend-dev`
   - Uso: Desarrollo local y pruebas de desarrolladores
   - Deploy: Manual cuando sea necesario

2. **Staging** (`staging`)
   - Base de datos: `turno-pvu-db-staging`
   - Worker: `turno-pvu-backend-staging`
   - Uso: Pruebas de QA, validación pre-producción
   - Deploy: Automático desde rama `staging` (futuro CI/CD)

3. **Production** (`prod`)
   - Base de datos: `turno-pvu-db`
   - Worker: `turno-pvu-backend`
   - Uso: Operación real con usuarios finales
   - Deploy: Manual con aprobación, solo desde `main`

---

## Proceso de Promoción entre Ambientes

### 1. Development → Staging

**Cuándo:** Después de completar una feature y pasar pruebas locales

```bash
# 1. Asegurar que los cambios están commiteados
git status

# 2. Hacer merge a rama staging
git checkout staging
git merge develop

# 3. Deploy a staging
npm run deploy:staging

# 4. Ejecutar migraciones de DB si es necesario
npx wrangler d1 execute turno-pvu-db-staging --file=backend/schema.sql --config=backend/wrangler.staging.toml

# 5. Ejecutar pruebas de humo en staging
npm run test:staging
```

**Validaciones:**
- [ ] Health check responde: `https://turno-pvu-backend-staging.{account}.workers.dev/api/health`
- [ ] Login funcional
- [ ] Pruebas de humo pasan

---

### 2. Staging → Production

**Cuándo:** Después de validación exitosa en staging

**Requisitos:**
- [ ] Todas las pruebas en staging pasaron
- [ ] Aprobación del coordinador del proyecto
- [ ] Backup de producción tomado
- [ ] Ventana de mantenimiento comunicada (si aplica)

```bash
# 1. Verificar que staging está estable
curl https://turno-pvu-backend-staging.{account}.workers.dev/api/health

# 2. Hacer merge a main
git checkout main
git merge staging

# 3. Tag de versión
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# 4. Backup de producción
./scripts/backup-prod.sh

# 5. Deploy a producción
npm run deploy:prod

# 6. Ejecutar migraciones de DB (con precaución)
# Revisar schema.sql antes de ejecutar
npx wrangler d1 execute turno-pvu-db --file=backend/schema.sql --config=backend/wrangler.prod.toml

# 7. Smoke tests en producción
npm run test:prod:smoke

# 8. Monitorear logs y métricas
./scripts/monitor-deploy.sh
```

**Post-Deploy:**
- [ ] Verificar health check
- [ ] Verificar métricas en dashboard
- [ ] Verificar logs sin errores críticos
- [ ] Comunicar deployment exitoso al equipo

---

## Rollback

### Proceso de Rollback Rápido

Si se detecta un problema crítico en producción:

```bash
# 1. Rollback del Worker a versión anterior
npx wrangler rollback --config=backend/wrangler.prod.toml

# 2. Si es necesario, restaurar DB desde backup
./scripts/restore-db.sh <backup_timestamp>

# 3. Verificar que el sistema funciona
curl https://turno-pvu-backend.{account}.workers.dev/api/health

# 4. Investigar causa raíz
# 5. Fix en develop → staging → prod (proceso normal)
```

---

## Migraciones de Base de Datos

### Estrategia

- **Nunca** eliminar columnas directamente en producción
- Usar patrón de 3 pasos para cambios destructivos:
  1. Deploy: Agregar nueva columna, migrar datos
  2. Deploy: Actualizar código para usar nueva columna
  3. Deploy: Eliminar columna vieja (después de validación)

### Ejemplo de Migración Segura

```sql
-- Paso 1: Agregar nueva columna
ALTER TABLE fichas ADD COLUMN nuevo_campo TEXT;

-- Paso 2: Migrar datos (script separado)
UPDATE fichas SET nuevo_campo = viejo_campo WHERE nuevo_campo IS NULL;

-- Paso 3 (siguiente deploy): Eliminar viejo_campo
-- ALTER TABLE fichas DROP COLUMN viejo_campo;  -- Solo después de validar
```

---

## Variables de Entorno y Secretos

### Secrets por Ambiente

```bash
# Development
npx wrangler secret put JWT_SECRET --env dev

# Staging
npx wrangler secret put JWT_SECRET --env staging

# Production
npx wrangler secret put JWT_SECRET --env production
```

**IMPORTANTE:** 
- Nunca committear secrets al repositorio
- Usar valores diferentes por ambiente
- Rotar secrets cada 90 días

---

## Checklist de Deploy a Producción

- [ ] Código revisado (code review)
- [ ] Pruebas automatizadas pasando
- [ ] Validado en staging por al menos 24 horas
- [ ] Backup de producción tomado
- [ ] Plan de rollback documentado
- [ ] Migraciones de DB revisadas
- [ ] Secrets configurados
- [ ] Monitoreo activo
- [ ] Equipo de soporte notificado
- [ ] Ventana de mantenimiento comunicada (si aplica)
- [ ] Post-deploy smoke tests preparados

---

## Contactos de Emergencia

En caso de incidente crítico en producción:

1. **Arquitecto**: [Contacto]
2. **DevOps**: [Contacto]
3. **Coordinador General**: [Contacto]
4. **Soporte Cloudflare**: support.cloudflare.com

---

*Última actualización: 14 febrero 2026*
