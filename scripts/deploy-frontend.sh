#!/usr/bin/env bash
# scripts/deploy-frontend.sh — Deploy MANUAL del frontend a ECS, robusto y atómico.
#
# POR QUÉ EXISTE: el auto-deploy de GHA está desactivado (metía builds supabase por
# sorpresa, 03/07). Mientras no se re-active (requiere poner los GH secrets
# NEXT_PUBLIC_AUTH_PROVIDER=authjs + _LIFECYCLE_VIA_API=true — ver
# docs/roadmap/fase-b-ejecucion-authjs-rs256.md §"Siguiente paso" punto 4), el deploy
# es manual. Los scripts ad-hoc de scratchpad fallaban con TAG MISMATCH: build y deploy
# tomaban el SHA de HEAD por separado, y si HEAD se movía entre medias (un commit del
# test) los tags no casaban. Este script captura el SHA UNA vez y hace todo atómico.
#
# Qué hace: captura SHA → build (flip build-args) → push ECR → registra task def
# clonando la que está VIVA (hereda TODOS los secretos: AUTH_JWT_*, mode=on, pooler…)
# y solo cambia la imagen → update-service → espera estable → smoke (home + gate auth).
#
# Uso:   scripts/deploy-frontend.sh
# Rollback: aws ecs update-service --cluster vence-backend --service vence-frontend \
#             --task-definition vence-frontend:<N> --profile vence --region eu-west-2
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a

P=vence; R=eu-west-2; ACC=349744179687
REG="${ACC}.dkr.ecr.${R}.amazonaws.com/vence-frontend"
SHA=$(git rev-parse --short HEAD)          # capturado UNA vez → sin ventana de mismatch
TAG="deploy-${SHA}"
IMG="${REG}:${TAG}"

echo "→ [1/6] build ${IMG} (flip: NEXT_PUBLIC_AUTH_PROVIDER=authjs)"
podman build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg NEXT_PUBLIC_SENTRY_DSN="${NEXT_PUBLIC_SENTRY_DSN:-}" \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID="$NEXT_PUBLIC_GOOGLE_CLIENT_ID" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_MONTHLY="$NEXT_PUBLIC_STRIPE_PRICE_MONTHLY" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY="$NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_SEMESTER="$NEXT_PUBLIC_STRIPE_PRICE_SEMESTER" \
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY="$NEXT_PUBLIC_VAPID_PUBLIC_KEY" \
  --build-arg NEXT_PUBLIC_SITE_URL="https://www.vence.es" \
  --build-arg NEXT_PUBLIC_APP_NAME="Vence" \
  --build-arg NEXT_PUBLIC_SUPPORT_EMAIL="info@vence.es" \
  --build-arg NEXT_PUBLIC_USE_CHAT_V2="true" \
  --build-arg NEXT_PUBLIC_AUTH_PROVIDER="authjs" \
  --build-arg NEXT_PUBLIC_AUTH_LIFECYCLE_VIA_API="true" \
  --build-arg NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY="0x4AAAAAADd5nFRd3Kqg6rn7" \
  --build-arg DATABASE_URL="$DATABASE_URL" \
  --build-arg DATABASE_URL_REPLICA="${DATABASE_URL_REPLICA:-$DATABASE_URL}" \
  --build-arg SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  --build-arg GIT_COMMIT_SHA="$SHA" \
  --build-arg NEXT_PUBLIC_GIT_COMMIT_SHA="$SHA" \
  -t "$IMG" .

echo "→ [2/6] push ECR"
aws ecr get-login-password --profile $P --region $R | podman login --username AWS --password-stdin "${ACC}.dkr.ecr.${R}.amazonaws.com" >/dev/null 2>&1
podman push "$IMG" >/dev/null

echo "→ [3/6] resolver digest (imagen pineada, inmutable)"
DIGEST=$(aws ecr describe-images --repository-name vence-frontend --image-ids imageTag="$TAG" --profile $P --region $R --query 'imageDetails[0].imageDigest' --output text)
IMG_DIGEST="${REG}@${DIGEST}"
echo "   $IMG_DIGEST"

echo "→ [4/6] clonar la task def VIVA (hereda secretos/config) + swap imagen"
# Base = la task def que el service USA AHORA (no una hardcodeada) → hereda AUTH_JWT_*,
# JWT_LOCAL_VERIFY_MODE=on, pooler, etc. sin poder olvidarlos.
LIVE_TD=$(aws ecs describe-services --cluster vence-backend --services vence-frontend --profile $P --region $R --query 'services[0].taskDefinition' --output text)
echo "   base viva: $LIVE_TD"
aws ecs describe-task-definition --task-definition "$LIVE_TD" --profile $P --region $R --query 'taskDefinition' --output json > /tmp/vence-td-live.json
node -e "
const fs=require('fs');
const td=JSON.parse(fs.readFileSync('/tmp/vence-td-live.json','utf8'));
td.containerDefinitions[0].image='${IMG_DIGEST}';
for (const k of ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']) delete td[k];
fs.writeFileSync('/tmp/vence-td-new.json', JSON.stringify(td));
"
NEWTD=$(aws ecs register-task-definition --cli-input-json file:///tmp/vence-td-new.json --profile $P --region $R --query 'taskDefinition.taskDefinitionArn' --output text)
echo "   registrada: $NEWTD"

echo "→ [5/6] update-service (rolling) + esperar estable"
aws ecs update-service --cluster vence-backend --service vence-frontend --task-definition "$NEWTD" --profile $P --region $R --query 'service.deployments[].{s:status,r:rolloutState}' --output json
aws ecs wait services-stable --cluster vence-backend --services vence-frontend --profile $P --region $R
echo "   ✅ rollout estable"

echo "→ [6/6] smoke post-deploy"
HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.vence.es/)
TOKEN_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.vence.es/api/auth/token)
echo "   home=$HOME_CODE  /api/auth/token(sin sesión)=$TOKEN_CODE"
[ "$HOME_CODE" = "200" ] && [ "$TOKEN_CODE" = "401" ] || { echo "   ⚠️ smoke inesperado — revisar"; exit 1; }
echo ""
echo "✅ DEPLOY OK — $NEWTD"
echo "   Gate de auth (recomendado): node scripts/fase-b-auth-surfaces-check.cjs"
echo "   Rollback: aws ecs update-service --cluster vence-backend --service vence-frontend --task-definition $LIVE_TD --profile vence --region eu-west-2"
