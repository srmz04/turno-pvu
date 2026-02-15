#!/bin/bash
# Script de deployment para TURNO-PVU
# Uso: ./deploy.sh [dev|staging|prod] [--skip-checks]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Moverse al directorio del backend
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"
cd "$BACKEND_DIR"

# Validar argumentos
AMBIENTE="${1:-dev}"
SKIP_CHECKS="${2}"

if [[ ! "$AMBIENTE" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}❌ Error: Ambiente debe ser 'dev', 'staging' o 'prod'${NC}"
    echo "Uso: $0 [dev|staging|prod] [--skip-checks]"
    exit 1
fi

# Configurar según ambiente
case $AMBIENTE in
    dev)
        CONFIG_FILE="wrangler.dev.toml"
        WORKER_NAME="turno-pvu-backend-dev"
        PAGES_PROJECT="turno-pvu-dev"
        BRANCH="develop"
        ;;
    staging)
        CONFIG_FILE="wrangler.staging.toml"
        WORKER_NAME="turno-pvu-backend-staging"
        PAGES_PROJECT="turno-pvu-staging"
        BRANCH="staging"
        ;;
    prod)
        CONFIG_FILE="wrangler.prod.toml"
        WORKER_NAME="turno-pvu-backend"
        PAGES_PROJECT="turno-pvu"
        BRANCH="main"
        ;;
esac

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║   🚀 TURNO-PVU - Deployment Script            ║"
echo "║   Ambiente: ${AMBIENTE^^}                              ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"

# Función para realizar checks pre-deployment
pre_deployment_checks() {
    echo -e "${YELLOW}📋 Ejecutando verificaciones pre-deployment...${NC}"
    echo ""

    # 1. Verificar que estamos en el directorio correcto
    if [ ! -f "worker.js" ]; then
        echo -e "${RED}❌ Error: worker.js no encontrado${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Directorio correcto"

    # 2. Verificar que existe el config file
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${RED}❌ Error: $CONFIG_FILE no encontrado${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Archivo de configuración: $CONFIG_FILE"

    # 3. Verificar archivos críticos de base de datos
    if [ ! -f "schema.sql" ]; then
        echo -e "${RED}❌ Error: schema.sql no encontrado${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} schema.sql presente"

    if [ ! -f "seed.sql" ]; then
        echo -e "${RED}❌ Error: seed.sql no encontrado${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} seed.sql presente"

    # 4. Verificar que wrangler está instalado
    if ! command -v wrangler &> /dev/null; then
        echo -e "${RED}❌ Error: wrangler no está instalado${NC}"
        echo "   Instalar con: npm install -g wrangler"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} wrangler instalado: $(wrangler --version)"

    # 5. Verificar autenticación de Cloudflare
    if ! wrangler whoami &> /dev/null; then
        echo -e "${RED}❌ Error: No autenticado en Cloudflare${NC}"
        echo "   Ejecutar: wrangler login"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Autenticado en Cloudflare"

    # 6. Para staging/prod, verificar rama de git
    if [ "$AMBIENTE" != "dev" ]; then
        CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
        if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
            echo -e "${YELLOW}⚠️  Advertencia: Estás en la rama '$CURRENT_BRANCH' pero deploying a '$AMBIENTE' (rama esperada: '$BRANCH')${NC}"
            read -p "   ¿Continuar de todas formas? (s/N): " confirm
            if [[ ! "$confirm" =~ ^[sS]$ ]]; then
                echo -e "${RED}Deployment cancelado${NC}"
                exit 1
            fi
        else
            echo -e "${GREEN}✓${NC} Rama correcta: $CURRENT_BRANCH"
        fi

        # Verificar que no hay cambios sin commitear
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Advertencia: Hay cambios sin commitear${NC}"
            read -p "   ¿Continuar de todas formas? (s/N): " confirm
            if [[ ! "$confirm" =~ ^[sS]$ ]]; then
                echo -e "${RED}Deployment cancelado${NC}"
                exit 1
            fi
        else
            echo -e "${GREEN}✓${NC} No hay cambios sin commitear"
        fi
    fi

    echo ""
}

# Función para hacer deployment del Worker (backend)
deploy_worker() {
    echo -e "${BLUE}📦 Paso 1/2: Deploying Worker (backend)...${NC}"
    echo ""

    if [ "$AMBIENTE" == "dev" ]; then
        # Para dev, usar --local no tiene sentido en deploy, solo en wrangler dev
        echo "   Ejecutando: wrangler deploy --config=$CONFIG_FILE"
        npx wrangler deploy --config="$CONFIG_FILE"
    else
        echo "   Ejecutando: wrangler deploy --config=$CONFIG_FILE"
        npx wrangler deploy --config="$CONFIG_FILE"
    fi

    echo ""
    echo -e "${GREEN}✅ Worker deployed exitosamente${NC}"
    echo ""
}

# Función para hacer deployment de Pages (frontend)
deploy_pages() {
    echo -e "${BLUE}📱 Paso 2/2: Deploying Pages (frontend)...${NC}"
    echo ""

    cd "$PROJECT_ROOT"

    # Verificar que existen los módulos frontend
    if [ ! -d "registro" ] || [ ! -d "aplicar" ] || [ ! -d "coordinador" ] || [ ! -d "admin" ] || [ ! -d "publico" ]; then
        echo -e "${YELLOW}⚠️  Advertencia: No todos los módulos frontend están presentes${NC}"
        ls -d */ 2>/dev/null | grep -E "(registro|aplicar|coordinador|admin|publico|shared)" || true
        echo ""
        read -p "   ¿Continuar con el deployment de Pages? (s/N): " confirm
        if [[ ! "$confirm" =~ ^[sS]$ ]]; then
            echo -e "${YELLOW}Deployment de Pages omitido${NC}"
            return
        fi
    fi

    echo "   Ejecutando: wrangler pages deploy . --project-name=$PAGES_PROJECT --branch=$BRANCH"
    npx wrangler pages deploy . --project-name="$PAGES_PROJECT" --branch="$BRANCH"

    echo ""
    echo -e "${GREEN}✅ Pages deployed exitosamente${NC}"
    echo ""

    cd "$BACKEND_DIR"
}

# Función para mostrar resumen final
show_summary() {
    echo ""
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════╗"
    echo "║   ✅ Deployment completado exitosamente        ║"
    echo "╚════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "📊 Resumen del deployment:"
    echo "   - Ambiente: $AMBIENTE"
    echo "   - Worker: $WORKER_NAME"
    echo "   - Pages Project: $PAGES_PROJECT"
    echo "   - Branch: $BRANCH"
    echo ""
    echo "🌐 URLs esperadas:"

    if [ "$AMBIENTE" == "prod" ]; then
        echo "   - Backend: https://turno-pvu-backend.{tu-subdomain}.workers.dev"
        echo "   - Frontend: https://turno-pvu.pages.dev"
        echo "     • Registro: https://turno-pvu.pages.dev/registro/"
        echo "     • Aplicar: https://turno-pvu.pages.dev/aplicar/"
        echo "     • Coordinador: https://turno-pvu.pages.dev/coordinador/"
        echo "     • Admin: https://turno-pvu.pages.dev/admin/"
        echo "     • Público: https://turno-pvu.pages.dev/publico/"
    else
        echo "   - Backend: https://turno-pvu-backend-${AMBIENTE}.{tu-subdomain}.workers.dev"
        echo "   - Frontend: https://${BRANCH}.turno-pvu-${AMBIENTE}.pages.dev"
        echo "     • Registro: https://${BRANCH}.turno-pvu-${AMBIENTE}.pages.dev/registro/"
        echo "     • Aplicar: https://${BRANCH}.turno-pvu-${AMBIENTE}.pages.dev/aplicar/"
        echo "     • Coordinador: https://${BRANCH}.turno-pvu-${AMBIENTE}.pages.dev/coordinador/"
        echo "     • Admin: https://${BRANCH}.turno-pvu-${AMBIENTE}.pages.dev/admin/"
        echo "     • Público: https://${BRANCH}.turno-pvu-${AMBIENTE}.pages.dev/publico/"
    fi

    echo ""
    echo "📝 Próximos pasos:"
    echo "   1. Verificar que el Worker responde: curl {worker-url}/api/health"
    echo "   2. Probar login con usuario de prueba"
    echo "   3. Verificar que las PWAs se instalan correctamente"
    echo "   4. Monitorear logs: wrangler tail --config=$CONFIG_FILE"
    echo ""

    if [ "$AMBIENTE" == "prod" ]; then
        echo -e "${YELLOW}⚠️  RECORDATORIO PARA PRODUCCIÓN:${NC}"
        echo "   - Cambiar contraseñas de usuarios de prueba"
        echo "   - Configurar monitoreo y alertas"
        echo "   - Realizar smoke tests completos"
        echo "   - Verificar logs de auditoria"
        echo ""
    fi
}

# Confirmación para producción
if [ "$AMBIENTE" == "prod" ]; then
    echo -e "${RED}"
    echo "⚠️  ⚠️  ⚠️  ADVERTENCIA: DEPLOYMENT A PRODUCCIÓN  ⚠️  ⚠️  ⚠️"
    echo -e "${NC}"
    echo "Estás a punto de hacer deployment al ambiente de PRODUCCIÓN"
    echo "Esto afectará a los usuarios reales del sistema"
    echo ""
    read -p "¿Estás seguro de continuar? (escriba 'PRODUCCION' para confirmar): " confirm

    if [ "$confirm" != "PRODUCCION" ]; then
        echo -e "${RED}❌ Deployment cancelado${NC}"
        exit 1
    fi
    echo ""
fi

# Ejecutar verificaciones (si no se omiten)
if [ "$SKIP_CHECKS" != "--skip-checks" ]; then
    pre_deployment_checks
else
    echo -e "${YELLOW}⚠️  Verificaciones pre-deployment omitidas (--skip-checks)${NC}"
    echo ""
fi

# Ejecutar deployments
deploy_worker
deploy_pages

# Mostrar resumen
show_summary

echo -e "${GREEN}🎉 Deployment finalizado con éxito!${NC}"
echo ""
