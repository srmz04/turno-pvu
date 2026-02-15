#!/bin/bash
# Script para reiniciar la base de datos local (SOLO DESARROLLO)
# TURNO-PVU
# ADVERTENCIA: Este script ELIMINA todos los datos locales

set -e

# Moverse al directorio del backend
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

echo "TURNO-PVU - Reset de Base de Datos Local"
echo "========================================="
echo ""
echo "ADVERTENCIA: Este script eliminara TODOS los datos locales"
echo "    Solo debe usarse en desarrollo/testing"
echo ""
read -p "Esta seguro de continuar? (escriba 'SI' para confirmar): " confirm

if [ "$confirm" != "SI" ]; then
    echo "Operacion cancelada"
    exit 1
fi

echo ""
echo "Eliminando datos locales de wrangler..."
rm -rf .wrangler/state/v3/d1

echo "Aplicando schema.sql..."
npx wrangler d1 execute turno-pvu-db-dev --local --file=schema.sql

echo "Aplicando seed.sql..."
npx wrangler d1 execute turno-pvu-db-dev --local --file=seed.sql

echo "Aplicando update-hashes.sql (passwords reales)..."
npx wrangler d1 execute turno-pvu-db-dev --local --file=update-hashes.sql

echo ""
echo "Base de datos local reiniciada exitosamente"
echo ""
echo "Usuarios de prueba:"
echo "   - admin / Admin123! (ADMIN)"
echo "   - coord.cs001 / Coord123! (COORDINADOR)"
echo "   - reg.cs001.1 / Reg123! (REGISTRADOR)"
echo "   - aplica.cs001.1 / Aplica123! (APLICADOR)"
echo ""
