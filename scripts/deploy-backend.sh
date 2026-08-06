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

# No despliegues desde donde trabajas (T-365). Va AQUÍ, lo primero y fuera de cualquier
# condicional: el primer intento se coló dentro de un `[ -f ./.env.local ] && { … }`, así que la
# guarda dependía de que existiera ese fichero y corría después de cargar el entorno. Una guarda
# que se ejecuta a veces no es una guarda.
ARGS_ORIGINALES="$*"   # para que el mensaje de la guarda sugiera el comando de verdad
. "$(dirname "$0")/lib/guardia-worktree.sh"
. "$(dirname "$0")/lib/comprobar-secretos-permitidos.sh"
guardia_worktree "resincroniza tu árbol con origin/main cuando va por detrás"
# Construir en un árbol PROPIO y efímero, sin tocar el de nadie (T-385).
. "$(dirname "$0")/lib/deploy-worktree.sh"
cd "$(dirname "$0")/.."

P=vence; R=eu-west-2; ACC=349744179687
REG="${ACC}.dkr.ecr.${R}.amazonaws.com/vence-backend"
# ── CERROJO DE CONCURRENCIA (flock) — mismo lock que frontend ────────────────
# Serializa deploys entre sesiones paralelas. Lock ÚNICO front+back (comparten ECR /
# cluster / infra de task def). Se libera solo al morir el proceso → sin locks zombi.
LOCK=/tmp/vence-deploy.lock
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then
    echo "⏳ Otra sesión está desplegando (lock $LOCK). Esperando…"
    H=$(cat "$LOCK" 2>/dev/null || true); [ -n "$H" ] && echo "   en curso: $H"
    # 45 min, no 30: el 28/07 un build de FRONTEND tardó >30 min y un deploy de backend en cola
    # detrás moría por timeout ANTES de que el otro terminara — o sea, condenado por construcción.
    # Ajustable con DEPLOY_LOCK_WAIT si algún día el build crece más.
    flock -w "${DEPLOY_LOCK_WAIT:-2700}" 9 || { echo "❌ el lock sigue tomado tras $(( ${DEPLOY_LOCK_WAIT:-2700} / 60 )) min — abortado. ¿Un build largo delante? Usa scripts/deploy-cuando-verde.sh, que reintenta."; exit 1; }
  fi
  echo "🔒 lock de deploy adquirido ($LOCK)."
else
  echo "⚠️  flock no disponible — sin serialización de deploy; coordina a mano."
fi

# ── QUÉ COMMIT SE DESPLIEGA: origin/main, SIEMPRE (T-385) ────────────────────
# Se resuelve DESPUÉS de tener el lock, y eso importa: esperar el cerrojo puede costar hasta 45
# minutos, y en ese rato origin/main se mueve. Resolverlo antes dejaría desplegando un commit ya
# viejo — justo el «clobber stale» que el guardarraíl anti-stale existía para impedir. El modelo
# anterior lo conseguía re-sincronizando el árbol tras el lock; aquí basta con leerlo ahora.
#
# Y va antes de escribir el contenido del lock y la fila de `deploy_runs`, para que ambos anoten
# EL COMMIT QUE SE DESPLIEGA y no el HEAD de quien lanza: un registro que nombra otra cosa es
# peor que no tener registro.
git fetch origin main --quiet 2>/dev/null || true
FULL_SHA=$(git rev-parse origin/main 2>/dev/null || git rev-parse HEAD)
# ── DEPLOY_SHA: desplegar un ANCESTRO de origin/main, no la punta ([T-619]) ───
# Mismo criterio y mismas guardas que el frontend (ver el comentario largo allí): la punta casi
# nunca tiene el CI terminado, el deploy es cumulativo, y el sha que llegue tiene que ser ancestro
# de origin/main. El gate de CI de ESE sha se sigue comprobando igual.
if [ -n "${DEPLOY_SHA:-}" ]; then
  CANDIDATO=$(git rev-parse "${DEPLOY_SHA}^{commit}" 2>/dev/null) || {
    echo "❌ DEPLOY_SHA=${DEPLOY_SHA} no es un commit de este repo"; exit 1; }
  git merge-base --is-ancestor "$CANDIDATO" "$(git rev-parse origin/main)" 2>/dev/null || {
    echo "❌ DEPLOY_SHA=${DEPLOY_SHA:0:9} NO es ancestro de origin/main — no se despliega"; exit 1; }
  DETRAS=$(git rev-list --count "${CANDIDATO}..origin/main" 2>/dev/null || echo 0)
  FULL_SHA="$CANDIDATO"
  echo "→ DEPLOY_SHA: se despliega ${FULL_SHA:0:9} (último verde), ${DETRAS} commit(s) de main se quedan para el siguiente deploy"
fi
SHA=$(printf '%s' "$FULL_SHA" | cut -c1-8)   # 8 chars EXACTOS: debe casar con /health.deploy = GIT_COMMIT_SHA.slice(0,8). `--short` daba longitud AUTO (7-9+) → falso "clobber" cuando ≠ 8 (visto 22/07: 'b201d798a' 9c vs 'b201d798' 8c)
TAG="deploy-${SHA}"
IMG="${REG}:${TAG}"
[ -e /proc/self/fd/9 ] && { : >&9; echo "backend $SHA pid=$$ $(date -u +%FT%TZ)" >&9; } || true

# ── DEJAR CONSTANCIA PARA LAS DEMÁS SESIONES (T-404) ─────────────────────────
# Ver el comentario gemelo en deploy-frontend.sh: el lock serializa pero no se puede consultar
# sin bloquearse. Esto lo publica donde el resto de sesiones ya mira (scripts/deploy-estado.cjs).
# Best-effort, y el `trap` cierra la fila aunque el build aborte.
# ── CANDADO ENTRE MÁQUINAS (T-485) ───────────────────────────────────────────
# El `flock` de arriba serializa DENTRO de esta máquina; un fichero en /tmp no cruza a otra. Este
# candado sí: el arriendo vive en `deploy_runs`, que ven todas. Y a diferencia de `deploy-marcar`
# —telemetría, fail-open— esto es una PUERTA: si no puede comprobarlo, NO deja pasar (salida 4).
# Dos `update-service` solapados sobre el mismo servicio es el incidente del 24/07 ([T-075]).
DEPLOY_RUN_ID="$(node "$(dirname "$0")/deploy/candado.cjs" adquirir --superficie backend --sha "$SHA" --pid $$)" || exit $?
echo "🔒 candado de deploy adquirido (run $DEPLOY_RUN_ID) — visible desde cualquier máquina."

# El arriendo dura 10 min y se renueva mientras el deploy viva: así un build de 40 min no lo
# pierde a mitad, y un `kill -9` lo suelta solo en 10 en vez de bloquear para siempre. El
# renovador es HIJO de este shell, así que muere con él — no puede quedarse renovando un deploy
# que ya no existe.
( while sleep 120; do node "$(dirname "$0")/deploy/candado.cjs" renovar "$DEPLOY_RUN_ID" >/dev/null 2>&1 || exit 0; done ) &
DEPLOY_RENOVADOR=$!

# ── UNA SOLA SALIDA (ojo: en bash un segundo `trap … EXIT` REEMPLAZA al primero) ──
# Hay DOS cosas que cerrar al terminar —la fila de `deploy_runs` (T-404) y el árbol de build
# efímero (T-385)— y registrarlas por separado habría hecho que la segunda silenciara a la
# primera SIN avisar. Van juntas en una función.
_al_salir() {
  local code=$?
  [ -n "${DEPLOY_RENOVADOR:-}" ] && kill "$DEPLOY_RENOVADOR" 2>/dev/null || true
  [ -n "${DEPLOY_RUN_ID:-}" ] && node "$(dirname "$0")/deploy/candado.cjs" soltar "$DEPLOY_RUN_ID" \
    --outcome "$([ "$code" = 0 ] && echo ok || echo fail)" >/dev/null 2>&1 || true
  # La ruta va POR ARGUMENTO: `crear_arbol_de_build` corre en un subshell (sustitución de
  # comandos), así que su variable global no llega hasta aquí. Ver el comentario del helper.
  borrar_arbol_de_build "${BUILD_DIR:-}"
  return $code
}
trap _al_salir EXIT

# ── POR QUÉ AQUÍ YA NO HAY AUTO-SYNC NI ANTI-STALE (T-385) ───────────────────
# Antes esto era un baile: se auto-sincronizaba el árbol con `git reset --hard origin/main`, se
# comprobaba después que HEAD contuviera origin/main, y se construía el WORKING TREE esperando
# que coincidiera. Tres mecanismos para aproximar una cosa que ahora se dice directamente arriba:
# **el deploy sube origin/main**. Es cumulativo por definición, así que nunca fue otra cosa.
#
# El cambio ES MÁS FUERTE, no más laxo: antes se construía «el árbol, que esperamos que sea
# origin/main»; ahora se construye EXACTAMENTE el commit cuyo CI se verifica aquí debajo, en un
# árbol recién creado que nadie puede ensuciar mientras dura el build.
#
# Y desaparecen de golpe los fallos que no eran de código: el `reset --hard` destructivo sobre un
# árbol compartido, el aborto por «otra sesión pusheó mientras verificaba el CI» y el aborto por
# árbol sucio de otro. Medido el 27-31/07: seis abortos de deploy y un push a siete intentos.
echo "→ se desplegará origin/main = ${SHA} (el árbol de trabajo no se toca)"

# GATE CI (Fase 2, 08/07/2026): no desplegar código que no pasó CI. Mismo gate que
# deploy-frontend.sh — check-runs de GHA para el SHA. Override: SKIP_CI_GATE=1.
# El `.env.local` se carga AQUÍ, desde el checkout original, porque de él sale el GITHUB_PAT y
# está gitignorado: al árbol de build no llega (comprobado, y es lo único que hay que sacar).
[ -f ./.env.local ] && { set -a; . ./.env.local; set +a; }
if [ "${SKIP_CI_GATE:-0}" = "1" ]; then
  echo "→ [gate CI] OMITIDO (SKIP_CI_GATE=1)."
elif [ -z "${GITHUB_PAT:-}" ] || ! command -v jq >/dev/null 2>&1; then
  echo "⚠️  [gate CI] sin GITHUB_PAT o sin jq → no puedo verificar CI. Abortado (SKIP_CI_GATE=1 para forzar)."; exit 1
else
  echo "→ [gate CI] verificando checks de CÓDIGO (unit+typecheck+lint) de GHA para ${SHA}…"
  CR=$(curl -s -H "Authorization: Bearer $GITHUB_PAT" -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/rikseotools/vence/commits/${FULL_SHA}/check-runs?per_page=100")
  TOTAL=$(echo "$CR" | jq -r '.total_count // 0')
  # SOLO gatean unit+typecheck+lint. `integration` (BD real) = señal aparte, no bloquea. Ver docs/runbooks/pusheo-revision-despliegue.md.
  CODE=$(echo "$CR" | jq -c '["unit","typecheck","lint"] as $req
    | [ $req[] as $k | ([ .check_runs[]? | select(.name|ascii_downcase|contains($k)) ]|last)
        | { k:$k, status:(.status // "missing"), conclusion:(.conclusion // "missing") } ]')
  MISSING=$(echo "$CODE" | jq -r '[.[]|select(.status=="missing")]|length')
  # `cancelled` NO es un fallo del código: GitHub cancela el run en curso cuando llega un push
  # más nuevo (concurrency cancel-in-progress), cosa que pasa constantemente con varias sesiones
  # trabajando. Contarlo como ROJO abortaba el deploy por un motivo inexistente — bloqueó tres
  # deploys el 27/07 y el runbook ya lo documentaba como aprendizaje sin que el script lo aplicara.
  # Lo correcto ante `cancelled` es RESINCRONIZAR y esperar el CI del HEAD nuevo.
  FAILED=$(echo "$CODE" | jq -r '[.[]|select(.conclusion=="failure" or .conclusion=="timed_out")]|length')
  CANCELLED=$(echo "$CODE" | jq -r '[.[]|select(.conclusion=="cancelled")]|length')
  PENDING=$(echo "$CODE" | jq -r '[.[]|select(.status!="completed" and .status!="missing")]|length')
  INTEG=$(echo "$CR" | jq -r '[.check_runs[]?|select(.name|ascii_downcase|contains("integration"))]|last|.conclusion // "n/a"')
  if [ "$TOTAL" = "0" ] || [ "${MISSING:-0}" -gt 0 ]; then echo "   ❌ faltan checks de código para ${SHA} (¿git push?). SKIP_CI_GATE=1 para forzar."; exit 1
  elif [ "${FAILED:-0}" -gt 0 ]; then echo "   ❌ CI de CÓDIGO en ROJO: ${FAILED} check(s) fallando. SKIP_CI_GATE=1 para forzar."; exit 1
  # Desde T-385 este script construye origin/main SIEMPRE, así que ante un `cancelled` no hay
  # nada que resincronizar: basta con volver a lanzarlo cuando el CI del origin/main nuevo esté
  # verde. Que no se pida un `reset --hard` es la mitad del sentido de este cambio.
  elif [ "${CANCELLED:-0}" -gt 0 ]; then echo "   ↻ CI CANCELADO para ${SHA}: ${CANCELLED} check(s) (otro push llegó después; NO es un fallo de tu código). Espera al CI del nuevo origin/main y RELANZA este script — no hay que tocar tu árbol."; exit 1
  elif [ "${PENDING:-0}" -gt 0 ]; then echo "   ⏳ CI de CÓDIGO EN CURSO: ${PENDING} check(s). Espera y reintenta (o SKIP_CI_GATE=1)."; exit 1
  fi
  echo "   ✅ CI de código verde (unit+typecheck+lint) para ${SHA}. [integration=${INTEG} — informativo]"
fi

# ── ÁRBOL DE BUILD PROPIO Y EFÍMERO (T-385) ──────────────────────────────────
# Aquí estaba la «guarda anti-stale» que exigía que HEAD contuviera origin/main. Ya no hace
# falta: no se construye HEAD, se construye origin/main. El guardarraíl no se relaja — se
# vuelve innecesario porque su invariante pasa a cumplirse POR CONSTRUCCIÓN.
BUILD_DIR="$(crear_arbol_de_build "$FULL_SHA")" || { echo "❌ no pude preparar el árbol de build"; exit 1; }
echo "→ árbol de build efímero: $BUILD_DIR (se borra al salir, pase lo que pase)"

echo "→ [1/6] build ${IMG} (contexto backend/ del árbol efímero)"
podman build --build-arg GIT_COMMIT_SHA="$SHA" -t "$IMG" "$BUILD_DIR/backend"

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
# mktemp por-deploy (NO paths fijos): dos deploys concurrentes con /tmp/*.json FIJOS se
# pisaban el fichero entre write y register → uno registraba la imagen del OTRO (SHA
# equivocado en prod, incidente 11/07). mktemp = cada deploy con su fichero único.
TDLIVE=$(mktemp); TDNEW=$(mktemp)
aws ecs describe-task-definition --task-definition "$LIVE_TD" --profile $P --region $R --query 'taskDefinition' --output json > "$TDLIVE"
TDLIVE="$TDLIVE" TDNEW="$TDNEW" IMG_DIGEST="$IMG_DIGEST" node -e "
const fs=require('fs');
const td=JSON.parse(fs.readFileSync(process.env.TDLIVE,'utf8'));
td.containerDefinitions[0].image=process.env.IMG_DIGEST;
// Read replica (Capa 3 contención RDS, 15/07): asegurar (idempotente) el secret de la
// réplica + el flag. Los crons ANALÍTICOS del backend usan DRIZZLE_READ → réplica.
{ const c=td.containerDefinitions[0];
  c.secrets = c.secrets || [];
  if (!c.secrets.some(s=>s.name==='DATABASE_URL_REPLICA'))
    c.secrets.push({name:'DATABASE_URL_REPLICA', valueFrom:'arn:aws:ssm:eu-west-2:349744179687:parameter/vence-backend/DATABASE_URL_REPLICA'});
  c.environment = c.environment || [];
  const e=c.environment.find(x=>x.name==='USE_READ_REPLICA');
  if (e) e.value='true'; else c.environment.push({name:'USE_READ_REPLICA', value:'true'});
  // DEVICE_LIMIT_MODE (T-304): el tope diario COMPARTIDO por dispositivo. Va por SSM y no por
  // environment A PROPOSITO — un valor horneado en la task def obliga a registrar otra para
  // cambiarlo; por SSM se resuelve al arrancar, asi que encender o apagar es cambiar el parametro
  // y forzar un new deployment (~5 min, sin build). Mismo patron que FEATURE_SHUFFLE_OPTIONS.
  // Se asegura AQUI porque el deploy clona la task def VIVA y solo swapea imagen: sin esta linea
  // el flag desapareceria en el siguiente deploy y el limite volveria a su defecto (shadow) EN
  // SILENCIO, que es justo el modo de fallo que este flag existe para vigilar.
  // ⚠️ Las DOS superficies: answer-and-save proxya al backend cuando el canary esta activo, asi
  // que con una sola el agujero sigue abierto por la otra.
  if (!c.secrets.some(s=>s.name==='DEVICE_LIMIT_MODE'))
    c.secrets.push({name:'DEVICE_LIMIT_MODE', valueFrom:'arn:aws:ssm:eu-west-2:349744179687:parameter/vence-backend/DEVICE_LIMIT_MODE'});
}
// check-seguimiento REACTIVADO como TELEMETRIA (T-135, 26/07/2026). Se retiro el 20/07 por el
// sensor 'hash_change' (4% de acierto) — pero esa señal YA no se emite desde el 26/06: hoy el cron
// solo refresca 'http_status' / 'content_preview' / 'checked_url' de las ~490 fuentes, que es
// justo la evidencia de la que vive el detector 'seguimiento_fuente_ciega'. Sin esto, ese detector
// juzga con una foto congelada del 20/07 y no se entera de una fuente que se quede ciega mañana.
// Va aqui y no a mano en la task def: si se parchea la task viva sin dejarlo en codigo, nadie sabe
// por que esta encendido ni sobrevive a una recreacion del servicio.
{ const c=td.containerDefinitions[0];
  c.environment = c.environment || [];
  const f=c.environment.find(x=>x.name==='CHECK_SEGUIMIENTO_ENABLED');
  if (f) f.value='true'; else c.environment.push({name:'CHECK_SEGUIMIENTO_ENABLED', value:'true'});
}
// detect-oep-llm EN PAUSA POR COSTE (27/07/2026). Manda a Haiku el HTML de las 2.213
// oposiciones con seguimiento_url, una llamada por oposicion: ~1.700 llamadas y ~8 USD por dia
// laborable (~170 USD/mes), 169 min por pasada, y la ultima completa dio 2.206 escaneadas ->
// OJO al editar este bloque: va dentro de un node -e entre comillas dobles, asi que bash expande
// el simbolo dolar y los acentos graves. Un dolar seguido de digito aborta el deploy con set -u
// (pasado el 27/07/2026). Escribir los importes en la forma 8 USD, nunca con el simbolo. Y sin
// comillas dobles de ningun tipo: truncan el JS en silencio (guardarrail deploy-scripts.test.ts).
// 424 extracciones -> 10 senales. El desperdicio NO son las inactivas (a 60 dias generan 98
// senales aplicadas frente a 43 de las activas: descubrir convocatorias nuevas ES el trabajo
// del radar), sino re-extraer paginas que no han cambiado — el servicio ya tiene
// computeContentHash() y el sensor no lo llama.
// PONER A 'true' EN CUANTO ESTE LA PUERTA DE HASH: esto es una pausa, no una retirada.
{ const c=td.containerDefinitions[0];
  c.environment = c.environment || [];
  const g=c.environment.find(x=>x.name==='DETECT_OEP_LLM_ENABLED');
  if (g) g.value='false'; else c.environment.push({name:'DETECT_OEP_LLM_ENABLED', value:'false'});
}
// Guardarrail anti-colision env/secret (incidente 11/07): ECS rechaza un name que
// este a la vez en environment y secrets. Detectarlo aqui con mensaje claro.
{ const en=new Set((td.containerDefinitions[0].environment||[]).map(e=>e.name));
  const clash=(td.containerDefinitions[0].secrets||[]).map(s=>s.name).filter(n=>en.has(n));
  if (clash.length) { console.error('COLISION env<->secret en el task def: '+clash.join(', ')+' — un name no puede estar en ambos.'); process.exit(1); } }
for (const k of ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']) delete td[k];
fs.writeFileSync(process.env.TDNEW, JSON.stringify(td));
"
# Guard: transform DEBE producir JSON no vacío (vars por ENTORNO, a prueba de shell).
[ -s "$TDNEW" ] || { echo "   ❌ el transform del task def produjo un fichero vacío — ABORTO"; rm -f "$TDLIVE" "$TDNEW"; exit 1; }
# ¿Puede el rol leer los secretos que este mismo transform acaba de cablear (arriba se añaden
# DATABASE_URL_REPLICA, DEVICE_LIMIT_MODE…)? El permiso vive en una política que enumera ARNs uno
# a uno y NADIE la toca al añadir el secreto: sin esto, ECS arranca una tarea cada 5 min que muere
# antes del contenedor y el deployment se queda en IN_PROGRESS con 0 running (T-399). Fail-open.
comprobar_secretos_permitidos "$TDNEW" "$P" "$R" || { rm -f "$TDLIVE" "$TDNEW"; exit 1; }
NEWTD=$(aws ecs register-task-definition --cli-input-json "file://${TDNEW}" --profile $P --region $R --query 'taskDefinition.taskDefinitionArn' --output text)
rm -f "$TDLIVE" "$TDNEW"
echo "   registrada: $NEWTD"

echo "→ [5/6] update-service (rolling) + esperar CONVERGENCIA REAL (mantiene el lock → deploys de uno en uno)"
aws ecs update-service --cluster vence-backend --service vence-backend --task-definition "$NEWTD" --profile $P --region $R --query 'service.deployments[].{s:status,r:rolloutState}' --output json
# Convergencia REAL (mismo motivo que deploy-frontend.sh, incidente 24/07 / T-075): el
# `aws ecs wait services-stable` nativo hace timeout ~10min y soltaría el lock ANTES de
# que drenen los viejos → el siguiente deploy se apila y solapa rollouts. Esperamos a 1
# SOLO deployment + PRIMARY COMPLETED + running==desired, hasta 30min, sin colgarnos.
CONVERGED=0; NDEP=; RS=; RUN=; DES=
for _i in $(seq 1 90); do   # 90 × 20s = 30 min
  read -r NDEP RS RUN DES < <(aws ecs describe-services --cluster vence-backend --services vence-backend --profile $P --region $R \
    --query 'services[0].[length(deployments), deployments[?status==`PRIMARY`]|[0].rolloutState, deployments[?status==`PRIMARY`]|[0].runningCount, deployments[?status==`PRIMARY`]|[0].desiredCount]' \
    --output text 2>/dev/null || echo "err err err err")
  if [ "$NDEP" = "1" ] && [ "$RS" = "COMPLETED" ] && [ "$RUN" = "$DES" ]; then CONVERGED=1; break; fi
  sleep 20
done
if [ "$CONVERGED" = "1" ]; then
  echo "   ✅ convergido: 1 deployment PRIMARY COMPLETED ($RUN/$DES tasks) — lock retenido hasta aquí"
else
  echo "   ⚠️ no convergió del todo en 30min (deployments=$NDEP rollout=$RS run=$RUN/$DES) — continúo; el smoke de abajo decide"
fi

echo "→ [6/6] smoke post-deploy"
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://api.vence.es/health)
echo "   /health=$HEALTH_CODE"
[ "$HEALTH_CODE" = "200" ] || { echo "   ⚠️ smoke inesperado (/health != 200) — revisar"; exit 1; }

# VERIFICAR QUE LO DESPLEGADO ES LO QUE CONSTRUIMOS (anti-clobber, incidente 11/07).
# /health.deploy = SHA horneado en la imagen. Si no coincide con $SHA tras reintentos,
# otro deploy pisó éste o no propagó → prod corre código EQUIVOCADO aunque diga "OK".
echo "→ verificando que el SHA vivo == $SHA (anti-clobber)"
DEPLOYED_SHA=""
for _i in 1 2 3 4 5 6; do
  DEPLOYED_SHA=$(curl -s --max-time 8 https://api.vence.es/health | python3 -c "import sys,json;print(json.load(sys.stdin).get('deploy',''))" 2>/dev/null || true)
  [ "$DEPLOYED_SHA" = "$SHA" ] && break
  sleep 5
done
if [ "$DEPLOYED_SHA" = "$SHA" ]; then
  echo "   ✅ SHA vivo = $SHA"
else
  echo "   ❌ SHA vivo = '$DEPLOYED_SHA' ≠ '$SHA' — deploy CLOBBEREADO o no propagó. Coordina y reintenta."
  exit 1
fi
echo ""
echo "✅ DEPLOY BACKEND OK — $NEWTD"
# ── Despertar las tareas del backlog que esperaban ESTE deploy ───────────────
# Una sesión que deja trabajo "hecho pero sin verificar hasta que se despliegue" lo marca con
# `backlog.cjs pause <id> --tras-deploy`. Aquí se cierra el bucle: el deploy avisa, en vez de
# que alguien tenga que acordarse. Best-effort — nunca puede tumbar un deploy que ya salió bien.
node "$(dirname "$0")/backlog.cjs" deployed "$FULL_SHA" --superficie backend 2>/dev/null || true

echo "   Rollback: aws ecs update-service --cluster vence-backend --service vence-backend --task-definition $LIVE_TD --profile vence --region eu-west-2"
