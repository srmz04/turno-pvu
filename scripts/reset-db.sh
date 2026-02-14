#!/bin/bash
# Script para reiniciar la base de datos (SOLO DESARROLLO)
# TURNO-PVU
# ADVERTENCIA: Este script ELIMINA todos los datos

set -e

echo "🗑️  TURNO-PVU - Reset de Base de Datos"
echo "======================================="
echo ""
echo "⚠️  ADVERTENCIA: Este script eliminará TODOS los datos"
echo "    Solo debe usarse en desarrollo/testing"
echo ""
read -p "¿Está seguro de continuar? (escriba 'SI' para confirmar): " confirm

if [ "$confirm" != "SI" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "📊 Eliminando base de datos existente..."
# Nota: D1 no permite DROP DATABASE, así que eliminamos recreando

echo "📊 Aplicando schema.sql..."
npx wrangler d1 execute turno-pvu-db --file=backend/schema.sql

echo "🌱 Aplicando seed.sql..."
npx wrangler d1 execute turno-pvu-db --file=backend/seed.sql

echo ""
echo "✅ Base de datos reiniciada exitosamente"
echo ""
echo "📋 Usuarios de prueba creados:"
echo "   - admin / Admin123! (ADMIN)"
echo "   - coord.cs001 / Coord123! (COORDINADOR)"
echo "   - reg.cs001.1 / Reg123! (REGISTRADOR)"
echo "   - aplica.cs001.1 / Aplica123! (APLICADOR)"
echo ""
echo "⚠️  Recuerde: Los passwords en seed.sql son PLACEHOLDERS"
echo "    Debe implementar el hashing real en worker.js"
echo ""
