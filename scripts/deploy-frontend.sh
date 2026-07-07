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
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID="$NEXT_PUBLIC_GOOGLE_CLIENT_ID" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_MONTHLY="$NEXT_PUBLIC_STRIPE_PRICE_MONTHLY" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY="$NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_SEMESTER="$NEXT_PUBLIC_STRIPE_PRICE_SEMESTER" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA="${NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA:-}" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA="${NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA:-}" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA="${NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA:-}" \
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

echo "→ [2b] sync _next/static → S3 (assets inmutables, RETENCIÓN: sin --delete)"
# POR QUÉ: los chunks se sirven vía CloudFront desde S3 (behavior /_next/static/*
# = origin group S3-primario + ALB-fallback). Al NO borrar los viejos, un usuario
# en un bundle anterior sigue encontrando sus chunks tras un deploy → no más
# ChunkLoadError / app congelada (caso Nila). Extraemos .next/static de la imagen
# recién construida (el build vive dentro de podman).
S3_STATIC_BUCKET="vence-frontend-static"
_tmpc=$(podman create "$IMG")
_staticdir=$(mktemp -d)
podman cp "${_tmpc}:/app/.next/static" "${_staticdir}/static"
podman rm "$_tmpc" >/dev/null
# A fichero (no pipe a tail: con pipefail, tail cerrando el pipe da SIGPIPE/141).
aws s3 sync "${_staticdir}/static" "s3://${S3_STATIC_BUCKET}/_next/static" \
  --profile $P --region $R \
  --cache-control "public,max-age=31536000,immutable" \
  --no-progress > /tmp/vence-s3sync.log 2>&1
tail -2 /tmp/vence-s3sync.log || true
# GUARDRAIL: un chunk de ESTE build DEBE estar en S3. Si el sync falló, ABORTAR
# el deploy (mejor no desplegar que congelar usuarios con chunks 404 después).
# find -print -quit (no pipe a head → sin SIGPIPE bajo pipefail).
_probe=$(find "${_staticdir}/static/chunks" -name '*.js' -print -quit 2>/dev/null)
_probekey="_next/static/${_probe#${_staticdir}/static/}"
if ! aws s3api head-object --bucket "$S3_STATIC_BUCKET" --key "$_probekey" --profile $P --region $R >/dev/null 2>&1; then
  echo "   ❌ chunk NO llegó a S3 (sync roto) — ABORTO el deploy"; rm -rf "$_staticdir"; exit 1
fi
rm -rf "$_staticdir"
echo "   ✅ assets en S3 (retención) + verificado"

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
// Multi-cuenta Stripe (Nila): la task def viva no los tiene y aquí solo se
// swapea imagen, así que los añadimos idempotentemente (secretos runtime en
// SSM /vence-frontend/*). Sin esto newSignupAccount()→'manuel' (flip no ocurre)
// y getStripeFor('nila')/webhook Nila no tendrían credenciales.
const REGION='eu-west-2', ACC='349744179687';
const secrets=(td.containerDefinitions[0].secrets ||= []);
for (const name of ['STRIPE_SECRET_KEY_NILA','STRIPE_WEBHOOK_SECRET_NILA','STRIPE_NEW_SIGNUPS_ACCOUNT']) {
  if (!secrets.some(s=>s.name===name)) secrets.push({name, valueFrom:'arn:aws:ssm:'+REGION+':'+ACC+':parameter/vence-frontend/'+name});
}
// Precios Stripe en RUNTIME (server-side). getPricesFor()/priceBelongsToAccount()
// en lib/stripe.ts los leen con acceso DINÁMICO process.env[nombre], que Next NO
// inlinea → deben estar en el entorno de EJECUCIÓN, no solo en build (donde el
// Dockerfile los pone en el stage builder para hornear el bundle CLIENTE, sin
// propagarlos al runner). Sin esto, el server ve undefined y create-checkout
// rechaza toda alta (incidente half-flip Nila 07/07). Son IDs públicos (van en el
// bundle cliente) → environment plano, no secreto. Guarda anti-vacío.
const env=(td.containerDefinitions[0].environment ||= []);
for (const name of ['NEXT_PUBLIC_STRIPE_PRICE_MONTHLY','NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY','NEXT_PUBLIC_STRIPE_PRICE_SEMESTER','NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA','NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA','NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA']) {
  const val=process.env[name];
  if (!val) { console.error('❌ falta '+name+' en el entorno del deploy (¿.env.local?)'); process.exit(1); }
  const ex=env.find(e=>e.name===name);
  if (ex) ex.value=val; else env.push({name, value:val});
}
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
# Assets: un chunk referenciado por la home viva debe cargar 200 vía CloudFront
# (detecta rotura del origin group S3/ALB o del pipeline de assets).
CHUNK=$(curl -s https://www.vence.es/ | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1 || true)
if [ -n "$CHUNK" ]; then
  CHUNK_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://www.vence.es${CHUNK}")
  echo "   asset ${CHUNK}=$CHUNK_CODE"
  [ "$CHUNK_CODE" = "200" ] || { echo "   ⚠️ chunk no carga vía CloudFront — revisar origin group / assets"; exit 1; }
fi
# Canary premium: NINGÚN endpoint de respuesta debe bloquear a un premium por el
# límite diario. Nació del incidente 07/07/2026 — /api/answer/psychometric y
# /api/exam/answer quedaron stale devolviendo 403 a premium, y el smoke
# home/asset/auth no lo cazó porque no ejercía los endpoints con identidad premium.
# Firma un token premium real y hace POST a cada endpoint aseverando NO-403-límite.
echo "→ canary premium (403 de límite a un premium = regresión)"
CANARY_SECRET=$(aws --profile "$P" --region "$R" ssm get-parameter --name "/vence-frontend/SUPABASE_JWT_SECRET" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || true)
if [ -n "$CANARY_SECRET" ]; then
  SUPABASE_JWT_SECRET="$CANARY_SECRET" \
  SMOKE_PREMIUM_USER_ID="${SMOKE_PREMIUM_USER_ID:-127063e1-1137-40ff-804d-d974818f338f}" \
  BASE_URL=https://www.vence.es node scripts/canary-answer-premium.cjs \
    || { echo "   ⚠️⚠️ CANARY PREMIUM ROJO — un premium está bloqueado por el límite diario. Revisar/rollback YA."; exit 1; }
else
  echo "   (canary premium omitido: SUPABASE_JWT_SECRET no accesible en SSM)"
fi
echo ""
echo "✅ DEPLOY OK — $NEWTD"
echo "   Gate de auth (recomendado): node scripts/fase-b-auth-surfaces-check.cjs"
echo "   Rollback: aws ecs update-service --cluster vence-backend --service vence-frontend --task-definition $LIVE_TD --profile vence --region eu-west-2"
