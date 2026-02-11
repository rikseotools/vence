#!/bin/bash
# scripts/warm-temario-cache.sh
# Script para calentar el cache de páginas de temario después de un deploy
#
# Uso: ./scripts/warm-temario-cache.sh [base_url]
# Ejemplo: ./scripts/warm-temario-cache.sh https://www.vence.es

BASE_URL="${1:-https://www.vence.es}"
CONCURRENT=5  # Peticiones concurrentes
DELAY=0.2     # Delay entre batches (segundos)

echo "🔥 Calentando cache de temario en: $BASE_URL"
echo "================================================"

# Función para hacer request y mostrar resultado
warm_url() {
    local url="$1"
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$url")
    if [ "$status" = "200" ]; then
        echo "✅ $url"
    else
        echo "❌ $url (HTTP $status)"
    fi
}

export -f warm_url
export BASE_URL

# Auxiliar Administrativo Estado (28 temas)
echo ""
echo "📚 Auxiliar Administrativo Estado (28 temas)..."
for i in $(seq 1 28); do
    echo "$BASE_URL/auxiliar-administrativo-estado/temario/tema-$i"
done | xargs -P $CONCURRENT -I {} bash -c 'warm_url "$@"' _ {}

sleep $DELAY

# Tramitación Procesal (37 temas)
echo ""
echo "📚 Tramitación Procesal (37 temas)..."
for i in $(seq 1 37); do
    echo "$BASE_URL/tramitacion-procesal/temario/tema-$i"
done | xargs -P $CONCURRENT -I {} bash -c 'warm_url "$@"' _ {}

sleep $DELAY

# Administrativo Estado (45 temas)
echo ""
echo "📚 Administrativo Estado (45 temas)..."
for i in $(seq 1 45); do
    echo "$BASE_URL/administrativo-estado/temario/tema-$i"
done | xargs -P $CONCURRENT -I {} bash -c 'warm_url "$@"' _ {}

echo ""
echo "================================================"
echo "✅ Cache warming completado!"
echo "   Total: 110 páginas de temario"
