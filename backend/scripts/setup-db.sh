#!/bin/bash
# Script para configuración inicial de base de datos remota (D1)
# TURNO-PVU
# Uso: ./setup-db.sh [dev|staging|prod]

set -e

# Moverse al directorio del backend
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Validar argumento
AMBIENTE="${1:-dev}"

if [[ ! "$AMBIENTE" =~ ^(dev|staging|prod)$ ]]; then
    echo "Error: Ambiente debe ser 'dev', 'staging' o 'prod'"
    echo "Uso: $0 [dev|staging|prod]"
    exit 1
fi

# Configurar nombres según ambiente
case $AMBIENTE in
    dev)
        DB_NAME="turno-pvu-db-dev"
        CONFIG_FILE="wrangler.dev.toml"
        ;;
    staging)
        DB_NAME="turno-pvu-db-staging"
        CONFIG_FILE="wrangler.staging.toml"
        ;;
    prod)
        DB_NAME="turno-pvu-db-prod"
        CONFIG_FILE="wrangler.prod.toml"
        ;;
esac

echo "╔════════════════════════════════════════════════╗"
echo "║   TURNO-PVU - Setup de Base de Datos          ║"
echo "║   Ambiente: ${AMBIENTE^^}                              ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Verificar que el config file existe
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: No se encuentra $CONFIG_FILE"
    exit 1
fi

# Advertencia para producción
if [ "$AMBIENTE" == "prod" ]; then
    echo "⚠️  ADVERTENCIA: Estás a punto de configurar la base de datos de PRODUCCIÓN"
    echo "    Esta operación debe ejecutarse solo UNA VEZ durante el setup inicial"
    echo ""
    read -p "¿Estás seguro de continuar? (escriba 'PRODUCCION' para confirmar): " confirm

    if [ "$confirm" != "PRODUCCION" ]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
fi

echo ""
echo "📋 Paso 1/5: Verificando base de datos..."

# Verificar si la DB ya existe
DB_EXISTS=$(npx wrangler d1 list | grep -c "$DB_NAME" || true)

if [ "$DB_EXISTS" -eq "0" ]; then
    echo "   ⏳ Creando base de datos $DB_NAME..."
    npx wrangler d1 create "$DB_NAME"
    echo ""
    echo "⚠️  IMPORTANTE: Copia el 'database_id' generado y actualízalo en $CONFIG_FILE"
    echo "   Sección: [[d1_databases]]"
    echo "   Variable: database_id"
    echo ""
    read -p "Presiona ENTER cuando hayas actualizado el database_id en $CONFIG_FILE..."
else
    echo "   ✅ Base de datos $DB_NAME ya existe"
fi

echo ""
echo "📋 Paso 2/5: Aplicando esquema (schema.sql)..."
npx wrangler d1 execute "$DB_NAME" --config="$CONFIG_FILE" --file=schema.sql
echo "   ✅ Esquema aplicado"

echo ""
echo "📋 Paso 3/5: Cargando datos iniciales (seed.sql)..."
npx wrangler d1 execute "$DB_NAME" --config="$CONFIG_FILE" --file=seed.sql
echo "   ✅ Datos iniciales cargados"

echo ""
echo "📋 Paso 4/5: Aplicando hashes de contraseñas (update-hashes.sql)..."
npx wrangler d1 execute "$DB_NAME" --config="$CONFIG_FILE" --file=update-hashes.sql
echo "   ✅ Contraseñas configuradas"

echo ""
echo "📋 Paso 5/5: Configurando secretos..."

# Configurar JWT_SECRET solo si no existe
echo "   🔑 Configurando JWT_SECRET para ambiente $AMBIENTE..."

if [ "$AMBIENTE" == "prod" ]; then
    echo "   ⚠️  Para PRODUCCIÓN, genera un secreto fuerte:"
    echo "      Ejemplo: $(openssl rand -base64 32)"
    echo ""
    npx wrangler secret put JWT_SECRET --config="$CONFIG_FILE"
else
    # Para dev/staging, usar valor por defecto (no seguro para producción)
    echo "   ℹ️  Usando JWT_SECRET de desarrollo (NO USAR EN PRODUCCIÓN)"
    echo "dev-secret-$(date +%s)" | npx wrangler secret put JWT_SECRET --config="$CONFIG_FILE"
fi

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║   ✅ Setup completado exitosamente             ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "📊 Resumen:"
echo "   - Base de datos: $DB_NAME"
echo "   - Ambiente: $AMBIENTE"
echo "   - Config: $CONFIG_FILE"
echo ""
echo "🔐 Usuarios de prueba creados:"
echo "   - admin / Admin123! (ADMIN)"
echo "   - coord.cs001 / Coord123! (COORDINADOR - CS001)"
echo "   - reg.cs001.1 / Reg123! (REGISTRADOR - CS001)"
echo "   - aplica.cs001.1 / Aplica123! (APLICADOR - CS001)"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Verificar que $CONFIG_FILE tenga el database_id correcto"
echo "   2. Ejecutar: npm run deploy:${AMBIENTE}"
echo "   3. Probar el acceso a las URLs generadas"
echo ""

if [ "$AMBIENTE" == "prod" ]; then
    echo "⚠️  IMPORTANTE PARA PRODUCCIÓN:"
    echo "   - Cambia TODAS las contraseñas de usuarios de prueba"
    echo "   - Configura usuarios reales con contraseñas seguras"
    echo "   - Habilita auditoría y monitoreo"
    echo "   - Configura alertas de seguridad"
    echo ""
fi
