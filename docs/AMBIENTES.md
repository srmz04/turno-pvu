# Estrategia de Ambientes - TURNO-PVU

## Ambientes Disponibles

| Ambiente | Config | Worker Name | DB | Uso |
|----------|--------|-------------|-----|-----|
| Development | `wrangler.dev.toml` | turno-pvu-backend-dev | turno-pvu-db-dev (local) | Desarrollo diario, pruebas locales |
| Staging | `wrangler.staging.toml` | turno-pvu-backend-staging | turno-pvu-db (remota) | Pre-produccion, validacion |
| Production | `wrangler.prod.toml` | turno-pvu-backend | turno-pvu-db (remota) | Operacion real, centros de salud |

## Bases de Datos D1

- **turno-pvu-db-dev** (`e52e89a3-1730-4eeb-b097-ce80890b1c12`): desarrollo local
- **turno-pvu-db** (`9299c5ac-6f7a-4cee-964c-078ee4270425`): staging y produccion

## Comandos por Ambiente

```bash
# Desarrollo local (datos efimeros, se pierden al reiniciar)
cd backend
npx wrangler dev --config wrangler.dev.toml

# Deploy a staging
npm run deploy:staging

# Deploy a produccion
npm run deploy:prod
```

## Promocion de Cambios

```
dev (local) --> staging (remoto, pruebas) --> prod (remoto, operacion)
```

1. **Desarrollar** en local con `wrangler dev`
2. **Probar** en staging con `npm run deploy:staging`
3. **Validar** que endpoints responden correctamente en staging
4. **Promover** a produccion con `npm run deploy:prod`

## Secretos

El `JWT_SECRET` se debe configurar por separado para staging y produccion:

```bash
# Staging
npx wrangler secret put JWT_SECRET --name turno-pvu-backend-staging

# Produccion
npx wrangler secret put JWT_SECRET --name turno-pvu-backend
```

En desarrollo local, el JWT_SECRET esta definido como variable en `wrangler.dev.toml` (aceptable para dev, nunca en prod).

## Migraciones de DB

Para aplicar schema y datos a la DB remota:

```bash
# Schema
npx wrangler d1 execute turno-pvu-db --remote --file=backend/schema.sql

# Seed (solo la primera vez)
npx wrangler d1 execute turno-pvu-db --remote --file=backend/seed.sql
npx wrangler d1 execute turno-pvu-db --remote --file=backend/update-hashes.sql
```
