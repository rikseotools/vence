#!/usr/bin/env bash
# repin-derived-taskdefs.sh — construye, sube y re-pinea las imágenes de las TAREAS
# PROGRAMADAS que salen de este mismo árbol de código pero de OTRO stage del Dockerfile.
#
# ── Por qué existe (incidente 27→29/07/2026) ──────────────────────────────────
# El worker de PDFs del temario estuvo 2 días muerto sin una sola alerta, por DOS
# fallos encadenados:
#
#   1. **No tenía camino de despliegue.** El Dockerfile ya traía su stage `worker`
#      y `deploy-frontend.sh` documentaba que "el worker se despliega por su propio
#      camino"… pero ese camino no existía. Su imagen se construyó A MANO una vez
#      (23-24/07) y se subió al repo `vence-frontend`, cuya política de retención
#      conserva **solo las últimas 10 imágenes** mientras el frontend empuja ~6 al
#      día. Estaba condenada a desaparecer en ~2 días. El 27/07 desapareció y desde
#      entonces cada tick moría con `CannotPullContainerError`, **antes del
#      entrypoint**: sin logs, sin eventos, sin alerta.
#   2. **No vale re-pinearlo a la imagen del frontend.** El frontend es el stage
#      `runner` (Next standalone, sin devDependencies); el worker arranca con
#      `node_modules/.bin/tsx`, que es devDependency. Apuntarlo ahí lo hace fallar
#      igual, solo que más tarde: `Cannot find module '/app/node_modules/.bin/tsx'`.
#      Es exactamente el error del PRIMER intento del 23/07, repetido.
#
# La lección de las dos: una tarea programada necesita **su propia imagen, en su
# propio repo, reconstruida en cada deploy**. Es lo que ya hacían bien
# `vence-content-radar` y `vence-instagram-daily` —repo propio, sin retención
# agresiva— y por eso son las únicas que siguen vivas.
#
# Además del bug hay razón de CORRECCIÓN para reconstruirla en cada deploy: el
# worker ejecuta `scripts/pdf-worker.ts` DEL MISMO ÁRBOL y comparte
# `PDF_TEMPLATE_VERSION` con el frontend. Una imagen vieja renderiza PDFs con una
# plantilla distinta de la que el frontend cree estar sirviendo.
#
# ── Nota de portabilidad ──────────────────────────────────────────────────────
# Este fichero es, a propósito, la parte ESPECÍFICA DE PROVEEDOR del arreglo: los
# scripts de deploy siempre lo son. La red que NO depende del proveedor es la
# liveness de `cron_overdue` sobre
# `backend/src/cron-schedule/external-jobs.registry.ts`: aunque este paso falle o
# desaparezca en una migración, un job que deje de correr sigue avisando.
#
# Uso:
#   AWS_REGION=<region> [AWS_PROFILE=<perfil>] [BUILDER=podman|docker] \
#     scripts/deploy/repin-derived-taskdefs.sh
set -uo pipefail

: "${AWS_REGION:?falta AWS_REGION}"
ACCOUNT_ID="${ACCOUNT_ID:-349744179687}"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
BUILDER="${BUILDER:-podman}"
command -v "$BUILDER" >/dev/null || BUILDER=docker

# ── FUENTE ÚNICA de las tareas programadas derivadas de este árbol ────────────
# Consumida por LOS DOS caminos de deploy (workflow de GHA y script manual), que
# antes divergían. El guardarraíl `__tests__/guardrails/deploy-scripts.test.ts`
# verifica que ambos siguen invocando este script.
#
# Formato: <familia de task def>|<stage del Dockerfile>|<repo ECR>
#
# Al añadir una tarea programada nueva: añadirla AQUÍ y, si es periódica,
# declararla también en `backend/src/cron-schedule/external-jobs.registry.ts`
# para que tenga liveness. Su repo ECR debe ser PROPIO (nunca el del frontend,
# cuya retención de 10 imágenes la purgaría).
DERIVED_WORKERS=(
  "vence-temario-pdf-worker|worker|vence-temario-pdf-worker"   # drena temario_pdf_jobs → PDFs a S3 (T-086 Fase D)
)

echo "→ construyendo y re-pineando las tareas programadas derivadas (builder: $BUILDER)"

aws ecr get-login-password ${AWS_PROFILE:+--profile "$AWS_PROFILE"} --region "$AWS_REGION" \
  | "$BUILDER" login --username AWS --password-stdin "$REGISTRY" >/dev/null 2>&1 \
  || { echo "   ⚠️ login en ECR falló"; exit 1; }

FAILED=0
for ENTRY in "${DERIVED_WORKERS[@]}"; do
  IFS='|' read -r FAMILY TARGET REPO <<< "$ENTRY"
  echo "   ── $FAMILY (stage '$TARGET' → $REPO)"

  # 1. Construir SOLO su stage. Es barato: el stage `worker` es `FROM deps` + el
  #    código, así que no dispara el build de Next ni necesita sus build-args.
  IMG_TAG="${REGISTRY}/${REPO}:${SHA:-latest}"
  if ! "$BUILDER" build --target "$TARGET" -t "$IMG_TAG" . >/dev/null 2>&1; then
    echo "      ⚠️ build del stage '$TARGET' falló"
    FAILED=1
    continue
  fi

  # 2. Subir capturando el digest DIRECTO del push. No re-resolver por tag: ECR
  #    tiene consistencia eventual y con deploys concurrentes devuelve el digest
  #    EQUIVOCADO (mismo motivo documentado en deploy-frontend.sh).
  #
  #    ⚠️ Los dos builders capturan el digest de forma DISTINTA y `--digestfile` es
  #    EXCLUSIVO de podman. Usarlo con docker (que es el builder en CI) hace fallar
  #    el push → como el step va con continue-on-error, el deploy saldría VERDE sin
  #    re-pinear nada. Ambas ramas leen el digest del PROPIO push, nunca de un
  #    re-lookup por tag.
  DIGEST=""
  case "$BUILDER" in
    podman)
      DIGESTFILE=$(mktemp)
      if "$BUILDER" push "$IMG_TAG" --digestfile "$DIGESTFILE" >/dev/null 2>&1; then
        DIGEST=$(cat "$DIGESTFILE")
      fi
      rm -f "$DIGESTFILE"
      ;;
    *)
      # `docker push` imprime "<tag>: digest: sha256:… size: N" — sale del push mismo.
      PUSH_OUT=$("$BUILDER" push "$IMG_TAG" 2>&1) || PUSH_OUT=""
      DIGEST=$(printf '%s' "$PUSH_OUT" | grep -oE 'sha256:[0-9a-f]{64}' | tail -1)
      ;;
  esac
  if [ -z "$DIGEST" ]; then
    echo "      ⚠️ el push no devolvió digest ($BUILDER) — NO se pinea a ciegas"
    FAILED=1; continue
  fi

  # 2b. POST-CONDICIÓN: el digest tiene que EXISTIR en el registry antes de pinearlo.
  #
  # Es la red que hace irrelevante CÓMO se obtuvo el digest, y por tanto protege
  # también a la rama de builder que no se ha podido ejecutar en local. Nació de
  # una comprobación real (29/07): `inspect .RepoDigests` —que parecía la forma
  # elegante de unificar las dos ramas— devuelve el digest del manifiesto LOCAL,
  # que NO es el que el registry almacena (medido: local 424002ff… vs registry
  # 035e596c…, y el primero da ImageNotFoundException). Pinear eso habría
  # reproducido el incidente original: la tarea muriendo en el pull.
  #
  # Esto NO es el anti-patrón del postmortem #115: aquello era re-resolver un TAG
  # para AVERIGUAR el digest (consistencia eventual → digest de otro deploy). Aquí
  # el digest ya lo sabemos y solo confirmamos su presencia. Con reintentos por la
  # ventana de propagación justo después del push.
  EXISTS=0
  for _try in 1 2 3; do
    if aws ecr describe-images --repository-name "$REPO" --image-ids imageDigest="$DIGEST" \
         ${AWS_PROFILE:+--profile "$AWS_PROFILE"} --region "$AWS_REGION" >/dev/null 2>&1; then
      EXISTS=1; break
    fi
    sleep 3
  done
  if [ "$EXISTS" != "1" ]; then
    echo "      ⚠️ el digest $DIGEST NO existe en $REPO — NO se pinea (moriría en el pull)"
    FAILED=1; continue
  fi

  IMAGE_PINNED="${REGISTRY}/${REPO}@${DIGEST}"

  # 3. Clonar la task def VIVA y solo swapear la imagen: hereda env/secrets/rol/
  #    cpu/memoria sin poder olvidarlos (mismo criterio que el deploy del servicio).
  TD_JSON=$(aws ecs describe-task-definition --task-definition "$FAMILY" \
    ${AWS_PROFILE:+--profile "$AWS_PROFILE"} --region "$AWS_REGION" \
    --query 'taskDefinition' --output json 2>/dev/null || true)
  if [ -z "$TD_JSON" ] || [ "$TD_JSON" = "None" ]; then
    echo "      ⚠️ no se pudo leer la task def $FAMILY"
    FAILED=1; continue
  fi

  NEW_JSON=$(printf '%s' "$TD_JSON" | TD_IMAGE="$IMAGE_PINNED" node -e '
    let raw = "";
    process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => {
      const td = JSON.parse(raw);
      td.containerDefinitions[0].image = process.env.TD_IMAGE;
      for (const k of ["taskDefinitionArn","revision","status","requiresAttributes",
                       "compatibilities","registeredAt","registeredBy","deregisteredAt"]) {
        delete td[k];
      }
      process.stdout.write(JSON.stringify(td));
    });
  ')
  if [ -z "$NEW_JSON" ]; then
    echo "      ⚠️ el transform produjo un JSON vacío"
    FAILED=1; continue
  fi

  TMP=$(mktemp); printf '%s' "$NEW_JSON" > "$TMP"
  NEW_ARN=$(aws ecs register-task-definition --cli-input-json "file://${TMP}" \
    ${AWS_PROFILE:+--profile "$AWS_PROFILE"} --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' --output text 2>/dev/null || true)
  rm -f "$TMP"
  if [ -z "$NEW_ARN" ] || [ "$NEW_ARN" = "None" ]; then
    echo "      ⚠️ register-task-definition falló"
    FAILED=1; continue
  fi
  echo "      ✅ $NEW_ARN"
done

if [ "$FAILED" != "0" ]; then
  echo ""
  echo "   ⚠️⚠️ alguna tarea programada derivada NO se actualizó. Seguirá corriendo una"
  echo "        imagen vieja —o ninguna— y su trabajo deja de hacerse EN SILENCIO."
  echo "        (La alerta cron_overdue lo cazará igualmente, pero un ciclo después.)"
  exit 1
fi
