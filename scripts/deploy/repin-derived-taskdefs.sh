#!/usr/bin/env bash
# repin-derived-taskdefs.sh — re-pinea las task definitions DERIVADAS de la imagen
# del frontend al digest que se acaba de desplegar.
#
# ── Por qué existe (incidente 27→29/07/2026) ──────────────────────────────────
# El postmortem #115 (26/05) ya había arreglado esta clase de fallo PARA EL
# SERVICIO: en vez de un tag mutable, cada deploy registra la task def con
# `repo@sha256:<digest>` inmutable. Lo que hace SEGURO ese pineado no es el
# digest — es que el deploy lo REFRESCA cada vez, así que el digest apuntado
# siempre acaba de pushearse y nunca le da tiempo a ser purgado.
#
# Las tareas PROGRAMADAS (worker de PDFs) copiaron el pineado por digest pero NO
# el refresco. Su digest se quedó congelado en el de una imagen vieja, la
# política de retención de ECR ("conservar solo las últimas 10") lo purgó a los
# ~2 días de deploys, y desde entonces cada invocación moría en el pull con
# `CannotPullContainerError` ANTES del entrypoint: sin logs, sin eventos, sin
# alerta. El worker de PDFs estuvo 2 días muerto y el único síntoma fue un canary
# quejándose de una cola que no drenaba.
#
# Además del bug, hay una razón de CORRECCIÓN para que vayan en lockstep: el
# worker ejecuta `scripts/pdf-worker.ts` DEL MISMO BUNDLE y comparte
# `PDF_TEMPLATE_VERSION` con el frontend. Un worker pineado a una imagen vieja
# renderiza PDFs con una plantilla distinta de la que el frontend cree servir.
#
# ── Alcance ───────────────────────────────────────────────────────────────────
# Solo task defs cuya imagen sale del repo del FRONTEND. Las que usan su propio
# repo (radar de contenido, instagram) no las purga la retención del frontend y
# no se tocan aquí.
#
# ── Nota de portabilidad ──────────────────────────────────────────────────────
# Este fichero es, a propósito, la parte ESPECÍFICA DE PROVEEDOR del arreglo: los
# scripts de deploy siempre lo son. La red de seguridad que NO depende del
# proveedor es la liveness de `cron_overdue` sobre
# `backend/src/cron-schedule/external-jobs.registry.ts`: aunque este paso falle o
# desaparezca en una migración, un job que deje de correr sigue avisando.
#
# Uso:
#   IMAGE_PINNED=<repo@sha256:...> AWS_REGION=<region> [AWS_PROFILE=<perfil>] \
#     scripts/deploy/repin-derived-taskdefs.sh
set -uo pipefail

: "${IMAGE_PINNED:?falta IMAGE_PINNED (repo@sha256:...)}"
: "${AWS_REGION:?falta AWS_REGION}"

# ── FUENTE ÚNICA de las task defs derivadas de la imagen del frontend ─────────
# Consumida por LOS DOS caminos de deploy (workflow de GHA y script manual), que
# antes divergían. El guardarraíl `__tests__/guardrails/deploy-scripts.test.ts`
# verifica que ambos siguen invocando este script.
#
# Al añadir una tarea programada nueva que use la imagen del frontend: añadirla
# AQUÍ y, si es un job periódico, declararla también en
# `backend/src/cron-schedule/external-jobs.registry.ts` para que tenga liveness.
DERIVED_TASKDEF_FAMILIES=(
  "vence-temario-pdf-worker"   # drena temario_pdf_jobs → PDFs del temario a S3 (T-086 Fase D)
)

PROFILE_ARG=()
[ -n "${AWS_PROFILE:-}" ] && PROFILE_ARG=(--profile "$AWS_PROFILE")

echo "→ re-pineando task defs derivadas al digest recién desplegado"
echo "   imagen: $IMAGE_PINNED"

FAILED=0
for FAMILY in "${DERIVED_TASKDEF_FAMILIES[@]}"; do
  TD_JSON=$(aws ecs describe-task-definition --task-definition "$FAMILY" \
    "${PROFILE_ARG[@]}" --region "$AWS_REGION" \
    --query 'taskDefinition' --output json 2>/dev/null || true)

  if [ -z "$TD_JSON" ] || [ "$TD_JSON" = "None" ]; then
    echo "   ⚠️ $FAMILY: no existe o no se pudo leer — SALTADA"
    FAILED=1
    continue
  fi

  # Clona la task def VIVA y solo swapea la imagen: así hereda env/secrets/rol/
  # cpu/memoria sin poder olvidarlos (mismo criterio que el deploy del servicio).
  NEW_JSON=$(printf '%s' "$TD_JSON" | TD_IMAGE="$IMAGE_PINNED" node -e '
    let raw = "";
    process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => {
      const td = JSON.parse(raw);
      td.containerDefinitions[0].image = process.env.TD_IMAGE;
      // Campos de solo lectura que register-task-definition rechaza.
      for (const k of ["taskDefinitionArn","revision","status","requiresAttributes",
                       "compatibilities","registeredAt","registeredBy","deregisteredAt"]) {
        delete td[k];
      }
      process.stdout.write(JSON.stringify(td));
    });
  ')

  if [ -z "$NEW_JSON" ]; then
    echo "   ⚠️ $FAMILY: el transform produjo un JSON vacío — SALTADA"
    FAILED=1
    continue
  fi

  TMP=$(mktemp)
  printf '%s' "$NEW_JSON" > "$TMP"
  NEW_ARN=$(aws ecs register-task-definition --cli-input-json "file://${TMP}" \
    "${PROFILE_ARG[@]}" --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' --output text 2>/dev/null || true)
  rm -f "$TMP"

  if [ -z "$NEW_ARN" ] || [ "$NEW_ARN" = "None" ]; then
    echo "   ⚠️ $FAMILY: register-task-definition falló — SALTADA"
    FAILED=1
    continue
  fi
  echo "   ✅ $FAMILY → $NEW_ARN"
done

if [ "$FAILED" != "0" ]; then
  echo ""
  echo "   ⚠️⚠️ alguna task def derivada NO se re-pineó. Seguirá apuntando a una imagen"
  echo "        vieja que la retención de ECR acabará purgando → la tarea morirá en el"
  echo "        pull, sin logs. Arreglar antes de que caduque."
  echo "        (La alerta cron_overdue lo cazará igualmente, pero días después.)"
  exit 1
fi
