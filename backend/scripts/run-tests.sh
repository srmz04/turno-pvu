#!/bin/bash
# Script para ejecutar pruebas end-to-end de TURNO-PVU
# Uso: ./run-tests.sh [local|dev|staging|prod]

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Moverse al directorio del backend
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Determinar ambiente
AMBIENTE="${1:-local}"

case $AMBIENTE in
    local)
        API_URL="http://localhost:8787"
        echo -e "${BLUE}🧪 Ejecutando pruebas contra ambiente LOCAL${NC}"
        echo -e "${YELLOW}⚠️  Asegúrate de que el Worker esté corriendo: npm run dev${NC}"
        echo ""
        ;;
    dev)
        API_URL="https://turno-pvu-backend-dev.{tu-subdomain}.workers.dev"
        echo -e "${BLUE}🧪 Ejecutando pruebas contra ambiente DEV${NC}"
        ;;
    staging)
        API_URL="https://turno-pvu-backend-staging.{tu-subdomain}.workers.dev"
        echo -e "${BLUE}🧪 Ejecutando pruebas contra ambiente STAGING${NC}"
        ;;
    prod)
        echo -e "${RED}❌ ERROR: No ejecutar pruebas destructivas contra PRODUCCIÓN${NC}"
        echo "   Estas pruebas crean/modifican/eliminan datos"
        echo "   Usa un ambiente de prueba (local, dev, staging)"
        exit 1
        ;;
    *)
        echo -e "${RED}❌ Ambiente inválido: $AMBIENTE${NC}"
        echo "Uso: $0 [local|dev|staging|prod]"
        exit 1
        ;;
esac

# Verificar que Node.js está disponible
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}▶️  Ejecutando pruebas end-to-end...${NC}"
echo ""

# Ejecutar el script de pruebas
node ./scripts/test-e2e.js "$API_URL"

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ Todas las pruebas pasaron${NC}"
else
    echo -e "${RED}❌ Algunas pruebas fallaron${NC}"
fi

exit $exit_code
