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
# Formato: <familia de task def>|<stage>|<repo ECR>|<contexto>|<Dockerfile>
#
#   · <stage>      vacío si la imagen NO sale de un multi-stage (Dockerfile propio).
#   · <contexto>   directorio de build. `.` = raíz del repo.
#   · <Dockerfile> ruta al Dockerfile. Vacío = el `Dockerfile` del contexto.
#
# Al añadir una tarea programada nueva: añadirla AQUÍ y, si es periódica,
# declararla también en `backend/src/cron-schedule/external-jobs.registry.ts`
# para que tenga liveness. Su repo ECR debe ser PROPIO (nunca el del frontend,
# cuya retención de 10 imágenes la purgaría).
#
# ⚠️ LAS DOS LISTAS SE VIGILAN JUNTAS ([T-698], 08/08/2026), y hace falta: los dos
# jobs sociales estaban declarados en el catálogo de liveness desde el 06/08 y
# **su imagen era del 07/07**, un mes anterior al código que emite la señal. O
# sea: se desplegó el vigilante y nunca el vigilado. Resultado, `cron_overdue`
# gritando 20 críticos al día sobre dos jobs que funcionaban perfectamente — y,
# lo caro, la alerta que avisaría de una muerte REAL (el incidente del worker de
# PDFs) llevaba dos días sin poder distinguir una cosa de la otra. El guardarraíl
# `__tests__/guardrails/jobsProgramadosConstruibles.test.ts` exige que todo job
# externo periódico tenga aquí su forma de construirse.
DERIVED_WORKERS=(
  "vence-temario-pdf-worker|worker|vence-temario-pdf-worker|.|"                                                    # drena temario_pdf_jobs → PDFs a S3 (T-086 Fase D)
  "vence-content-radar||vence-content-radar|marketing/social-content/content-radar|"                               # radar de contenido de competidores (L/X/V)
  "vence-instagram-daily||vence-instagram-daily|marketing/social-content|marketing/social-content/Dockerfile.fargate" # pregunta del día en @vence.es (diario)
)

echo "→ construyendo y re-pineando las tareas programadas derivadas (builder: $BUILDER)"

aws ecr get-login-password ${AWS_PROFILE:+--profile "$AWS_PROFILE"} --region "$AWS_REGION" \
  | "$BUILDER" login --username AWS --password-stdin "$REGISTRY" >/dev/null 2>&1 \
  || { echo "   ⚠️ login en ECR falló"; exit 1; }

FAILED=0
for ENTRY in "${DERIVED_WORKERS[@]}"; do
  IFS='|' read -r FAMILY TARGET REPO CONTEXT DOCKERFILE <<< "$ENTRY"
  CONTEXT="${CONTEXT:-.}"
  echo "   ── $FAMILY (${TARGET:+stage $TARGET, }contexto $CONTEXT → $REPO)"

  # 1. Construir SOLO su stage. Es barato: el stage `worker` es `FROM deps` + el
  #    código, así que no dispara el build de Next ni necesita sus build-args.
  IMG_TAG="${REGISTRY}/${REPO}:${SHA:-latest}"
  BUILD_ARGS=()
  [ -n "$TARGET" ] && BUILD_ARGS+=(--target "$TARGET")
  [ -n "$DOCKERFILE" ] && BUILD_ARGS+=(-f "$DOCKERFILE")
  if ! "$BUILDER" build "${BUILD_ARGS[@]}" -t "$IMG_TAG" "$CONTEXT" >/dev/null 2>&1; then
    echo "      ⚠️ build falló (${TARGET:+stage $TARGET, }contexto $CONTEXT)"
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

  # 4. Que el PLANIFICADOR use la revisión nueva. No es un paso opcional: los dos
  #    jobs sociales tenían su schedule clavado a una revisión CONCRETA
  #    (`…/vence-instagram-daily:2`), así que registrar una revisión nueva no
  #    cambiaba nada — se habría desplegado en el vacío, que es el mismo modo de
  #    fallo silencioso que este script existe para cerrar. Se apunta a la FAMILIA
  #    (sin `:revisión`), que es como ya estaba el worker de PDFs, el único de los
  #    tres que nunca tuvo este problema: así el planificador coge siempre la
  #    última y no hay un segundo sitio que actualizar.
  SCHED_ARN=$(aws scheduler get-schedule --name "$FAMILY" \
    ${AWS_PROFILE:+--profile "$AWS_PROFILE"} --region "$AWS_REGION" \
    --query 'Target.EcsParameters.TaskDefinitionArn' --output text 2>/dev/null || true)
  if [ -z "$SCHED_ARN" ] || [ "$SCHED_ARN" = "None" ]; then
    echo "      ℹ️ sin schedule propio en EventBridge Scheduler (no aplica)"
  elif [[ "$SCHED_ARN" == *:task-definition/*:* ]]; then
    FAMILY_ARN="${SCHED_ARN%:*}"
    SCHED_JSON=$(aws scheduler get-schedule --name "$FAMILY" \
      ${AWS_PROFILE:+--profile "$AWS_PROFILE"} --region "$AWS_REGION" --output json 2>/dev/null || true)
    NEW_SCHED=$(printf '%s' "$SCHED_JSON" | SCHED_TD="$FAMILY_ARN" node -e '
      let raw = "";
      process.stdin.on("data", (d) => (raw += d));
      process.stdin.on("end", () => {
        const s = JSON.parse(raw);
        s.Target.EcsParameters.TaskDefinitionArn = process.env.SCHED_TD;
        for (const k of ["Arn","CreationDate","LastModificationDate","ResponseMetadata"]) delete s[k];
        process.stdout.write(JSON.stringify(s));
      });
    ')
    TMPS=$(mktemp); printf '%s' "$NEW_SCHED" > "$TMPS"
    if aws scheduler update-schedule --cli-input-json "file://${TMPS}" \
         ${AWS_PROFILE:+--profile "$AWS_PROFILE"} --region "$AWS_REGION" >/dev/null 2>&1; then
      echo "      ✅ schedule despineado → $FAMILY_ARN (coge siempre la última)"
    else
      echo "      ⚠️ el schedule sigue clavado a $SCHED_ARN — la imagen nueva NO se usará"
      FAILED=1
    fi
    rm -f "$TMPS"
  fi
done

if [ "$FAILED" != "0" ]; then
  echo ""
  echo "   ⚠️⚠️ alguna tarea programada derivada NO se actualizó. Seguirá corriendo una"
  echo "        imagen vieja —o ninguna— y su trabajo deja de hacerse EN SILENCIO."
  echo "        (La alerta cron_overdue lo cazará igualmente, pero un ciclo después.)"
  exit 1
fi
