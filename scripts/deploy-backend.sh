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

echo "→ [1/6] build ${IMG} (contexto backend/)"
podman build -t "$IMG" ./backend

echo "→ [2/6] push ECR"
aws ecr get-login-password --profile $P --region $R | podman login --username AWS --password-stdin "${ACC}.dkr.ecr.${R}.amazonaws.com" >/dev/null 2>&1
podman push "$IMG" >/dev/null

echo "→ [3/6] resolver digest (imagen pineada, inmutable)"
DIGEST=$(aws ecr describe-images --repository-name vence-backend --image-ids imageTag="$TAG" --profile $P --region $R --query 'imageDetails[0].imageDigest' --output text)
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
