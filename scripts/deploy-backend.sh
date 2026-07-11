#!/usr/bin/env bash
# scripts/deploy-backend.sh — Deploy MANUAL del backend NestJS a ECS Fargate.
#
# POR QUÉ EXISTE: antes el backend se desplegaba a MANO (podman build + ECR +
# force-new-deployment sueltos) — sin smoke, sin espera de estabilidad, sin
# rollback documentado. Este script lo hace repetible y verificado, espejo de
# scripts/deploy-frontend.sh.
#
# Qué hace: captura SHA → build imagen (contexto backend/) → push ECR → resuelve
# DIGEST (imagen pineada, inmutable) → clona la task def VIVA y solo cambia la
# imagen → update-service → espera estable → smoke (GET /health = 200).
#
# Uso:   scripts/deploy-backend.sh
# Rollback: aws ecs update-service --cluster vence-backend --service vence-backend \
#             --task-definition vence-backend:<N> --profile vence --region eu-west-2
set -euo pipefail
cd "$(dirname "$0")/.."

P=vence; R=eu-west-2; ACC=349744179687
REG="${ACC}.dkr.ecr.${R}.amazonaws.com/vence-backend"
SHA=$(git rev-parse --short HEAD)          # capturado UNA vez → sin ventana de mismatch
TAG="deploy-${SHA}"
IMG="${REG}:${TAG}"

# GATE CI (Fase 2, 08/07/2026): no desplegar código que no pasó CI. Mismo gate que
# deploy-frontend.sh — check-runs de GHA para el SHA. Override: SKIP_CI_GATE=1.
[ -f ./.env.local ] && { set -a; . ./.env.local; set +a; }
FULL_SHA=$(git rev-parse HEAD)
if [ "${SKIP_CI_GATE:-0}" = "1" ]; then
  echo "→ [gate CI] OMITIDO (SKIP_CI_GATE=1)."
elif [ -z "${GITHUB_PAT:-}" ] || ! command -v jq >/dev/null 2>&1; then
  echo "⚠️  [gate CI] sin GITHUB_PAT o sin jq → no puedo verificar CI. Abortado (SKIP_CI_GATE=1 para forzar)."; exit 1
else
  echo "→ [gate CI] verificando checks de CÓDIGO (unit+typecheck+lint) de GHA para ${SHA}…"
  CR=$(curl -s -H "Authorization: Bearer $GITHUB_PAT" -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/rikseotools/vence/commits/${FULL_SHA}/check-runs?per_page=100")
  TOTAL=$(echo "$CR" | jq -r '.total_count // 0')
  # SOLO gatean unit+typecheck+lint. `integration` (BD real) = señal aparte, no bloquea. Ver docs/runbooks/deploy.md.
  CODE=$(echo "$CR" | jq -c '["unit","typecheck","lint"] as $req
    | [ $req[] as $k | ([ .check_runs[]? | select(.name|ascii_downcase|contains($k)) ]|last)
        | { k:$k, status:(.status // "missing"), conclusion:(.conclusion // "missing") } ]')
  MISSING=$(echo "$CODE" | jq -r '[.[]|select(.status=="missing")]|length')
  FAILED=$(echo "$CODE" | jq -r '[.[]|select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out")]|length')
  PENDING=$(echo "$CODE" | jq -r '[.[]|select(.status!="completed" and .status!="missing")]|length')
  INTEG=$(echo "$CR" | jq -r '[.check_runs[]?|select(.name|ascii_downcase|contains("integration"))]|last|.conclusion // "n/a"')
  if [ "$TOTAL" = "0" ] || [ "${MISSING:-0}" -gt 0 ]; then echo "   ❌ faltan checks de código para ${SHA} (¿git push?). SKIP_CI_GATE=1 para forzar."; exit 1
  elif [ "${FAILED:-0}" -gt 0 ]; then echo "   ❌ CI de CÓDIGO en ROJO: ${FAILED} check(s) fallando. SKIP_CI_GATE=1 para forzar."; exit 1
  elif [ "${PENDING:-0}" -gt 0 ]; then echo "   ⏳ CI de CÓDIGO EN CURSO: ${PENDING} check(s). Espera y reintenta (o SKIP_CI_GATE=1)."; exit 1
  fi
  echo "   ✅ CI de código verde (unit+typecheck+lint) para ${SHA}. [integration=${INTEG} — informativo]"
fi

echo "→ [1/6] build ${IMG} (contexto backend/)"
podman build -t "$IMG" ./backend

echo "→ [2/6] push ECR"
aws ecr get-login-password --profile $P --region $R | podman login --username AWS --password-stdin "${ACC}.dkr.ecr.${R}.amazonaws.com" >/dev/null 2>&1
# Digest capturado DIRECTO del push (--digestfile), NO re-resuelto por tag después.
# Re-resolver con `describe-images imageTag=$TAG` devolvía el digest EQUIVOCADO de
# forma intermitente (consistencia eventual de ECR / carrera con deploys concurrentes)
# → la task def se pineaba a una imagen VIEJA y el fix no llegaba a prod aunque el
# deploy dijera OK (incidente 11/07). mktemp = seguro ante deploys concurrentes.
DIGESTFILE=$(mktemp)
podman push "$IMG" --digestfile "$DIGESTFILE" >/dev/null

echo "→ [3/6] resolver digest (imagen pineada, inmutable)"
# Digest del push (paso 2), determinista. NO re-resolver por tag (ver comentario allí).
DIGEST=$(cat "$DIGESTFILE"); rm -f "$DIGESTFILE"
if [ -z "$DIGEST" ]; then echo "   ❌ push no devolvió digest — ABORTO (no pinear a ciegas)"; exit 1; fi
IMG_DIGEST="${REG}@${DIGEST}"
echo "   $IMG_DIGEST"

echo "→ [4/6] clonar la task def VIVA (hereda secretos/config) + swap imagen"
LIVE_TD=$(aws ecs describe-services --cluster vence-backend --services vence-backend --profile $P --region $R --query 'services[0].taskDefinition' --output text)
echo "   base viva: $LIVE_TD"
aws ecs describe-task-definition --task-definition "$LIVE_TD" --profile $P --region $R --query 'taskDefinition' --output json > /tmp/vence-be-td-live.json
node -e "
const fs=require('fs');
const td=JSON.parse(fs.readFileSync('/tmp/vence-be-td-live.json','utf8'));
td.containerDefinitions[0].image='${IMG_DIGEST}';
for (const k of ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']) delete td[k];
fs.writeFileSync('/tmp/vence-be-td-new.json', JSON.stringify(td));
"
NEWTD=$(aws ecs register-task-definition --cli-input-json file:///tmp/vence-be-td-new.json --profile $P --region $R --query 'taskDefinition.taskDefinitionArn' --output text)
echo "   registrada: $NEWTD"

echo "→ [5/6] update-service (rolling) + esperar estable"
aws ecs update-service --cluster vence-backend --service vence-backend --task-definition "$NEWTD" --profile $P --region $R --query 'service.deployments[].{s:status,r:rolloutState}' --output json
aws ecs wait services-stable --cluster vence-backend --services vence-backend --profile $P --region $R
echo "   ✅ rollout estable"

echo "→ [6/6] smoke post-deploy"
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://api.vence.es/health)
echo "   /health=$HEALTH_CODE"
[ "$HEALTH_CODE" = "200" ] || { echo "   ⚠️ smoke inesperado (/health != 200) — revisar"; exit 1; }
echo ""
echo "✅ DEPLOY BACKEND OK — $NEWTD"
echo "   Rollback: aws ecs update-service --cluster vence-backend --service vence-backend --task-definition $LIVE_TD --profile vence --region eu-west-2"
