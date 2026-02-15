#!/bin/bash
API_URL="https://turno-pvu-backend.xtrctr.workers.dev/api/test-hash"

# Funcion para obtener hash
get_hash() {
    PASS=$1
    SALT=$2
    # JSON payload
    JSON="{\"password\": \"$PASS\", \"salt\": \"$SALT\"}"
    
    # Curl
    RESPONSE=$(curl -s -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -d "$JSON")
      
    echo "$RESPONSE"
}

echo "Generating hashes from worker..."

# 1. Admin
SALT_ADMIN="udk4wSTmYnq+Z5KiqKPDdQ=="
echo "Admin..."
get_hash "Admin123!" "$SALT_ADMIN"

# 2. Coordinador
SALT_COORD="tdknBKtiquaK+TKYRFj1zg=="
echo "Coord..."
get_hash "Coord123!" "$SALT_COORD"

# 3. Registrador
SALT_REG="CKrCNdr2BcKS7WVVfYATYQ=="
echo "Registrador..."
get_hash "Reg123!" "$SALT_REG"

# 4. Aplicador
SALT_APLICA="3OkvcBhR9vtK912zV2rwIQ=="
echo "Aplicador..."
get_hash "Aplica123!" "$SALT_APLICA"
