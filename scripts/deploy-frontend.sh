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

# No despliegues desde donde trabajas (T-365). Va AQUÍ, lo primero y fuera de cualquier
# condicional: el primer intento se coló dentro de un `[ -f ./.env.local ] && { … }`, así que la
# guarda dependía de que existiera ese fichero y corría después de cargar el entorno. Una guarda
# que se ejecuta a veces no es una guarda.
. "$(dirname "$0")/lib/guardia-worktree.sh"
guardia_worktree "resincroniza tu árbol con origin/main cuando va por detrás"
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
# Precios Stripe: fuente de verdad COMMITEADA, sourceada DESPUÉS de .env.local
# para SOBREESCRIBIR cualquier price ID viejo que traiga el .env.local per-worktree
# (incidente 09/07 task def :386: un .env.local stale tumbó create-checkout en 3
# de 4 planes). Así todos los worktrees despliegan los mismos precios.
set -a; . ./scripts/stripe-prices.sh; set +a
# Guardrail: los 8 price IDs deben estar presentes tras sourcear (si el fichero
# faltara o se vaciara, abortar antes de construir un bundle sin precios).
for _v in NEXT_PUBLIC_STRIPE_PRICE_MONTHLY NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY NEXT_PUBLIC_STRIPE_PRICE_SEMESTER NEXT_PUBLIC_STRIPE_PRICE_ANNUAL \
          NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_NILA; do
  if [ -z "${!_v:-}" ]; then echo "❌ abort: $_v vacío tras sourcear scripts/stripe-prices.sh"; exit 1; fi
done

P=vence; R=eu-west-2; ACC=349744179687
REG="${ACC}.dkr.ecr.${R}.amazonaws.com/vence-frontend"
SHA=$(git rev-parse HEAD | cut -c1-8)      # 8 chars EXACTOS: debe casar con /health.deploy = GIT_COMMIT_SHA.slice(0,8). `--short` daba longitud AUTO (7-9+) → falso "clobber" cuando ≠ 8 (visto 22/07)
TAG="deploy-${SHA}"
IMG="${REG}:${TAG}"

# ── CERROJO DE CONCURRENCIA (flock) ──────────────────────────────────────────
# Varias sesiones de Claude en el MISMO repo pueden lanzar deploys a la vez → dos
# update-service sobre el MISMO servicio ECS se pisan (carrera real 11/07: la sesión
# referral-hold desplegaba a la vez que ésta). flock SERIALIZA: la 2ª ESPERA a que la
# 1ª termine. Se libera SOLO al morir el proceso (fd 9) → sin locks zombi aunque una
# sesión se caiga. Lock ÚNICO front+back (comparten ECR / cluster / infra de task def).
LOCK=/tmp/vence-deploy.lock
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then
    echo "⏳ Otra sesión está desplegando (lock $LOCK). Esperando a que termine…"
    H=$(cat "$LOCK" 2>/dev/null || true); [ -n "$H" ] && echo "   en curso: $H"
    # 45 min, no 30: el 28/07 un build de FRONTEND tardó >30 min y un deploy de backend en cola
    # detrás moría por timeout ANTES de que el otro terminara — o sea, condenado por construcción.
    # Ajustable con DEPLOY_LOCK_WAIT si algún día el build crece más.
    flock -w "${DEPLOY_LOCK_WAIT:-2700}" 9 || { echo "❌ el lock sigue tomado tras $(( ${DEPLOY_LOCK_WAIT:-2700} / 60 )) min — abortado. ¿Un build largo delante? Usa scripts/deploy-cuando-verde.sh, que reintenta."; exit 1; }
  fi
  : >&9; echo "frontend $SHA pid=$$ $(date -u +%FT%TZ)" >&9   # quién tiene el lock (informativo)
  echo "🔒 lock de deploy adquirido ($LOCK)."
else
  echo "⚠️  flock no disponible — sin serialización de deploy; coordina a mano con otras sesiones."
fi

# GUARDARRAÍL árbol sucio (incidente 07/07/2026): el build usa el WORKING TREE
# (podman COPY . .), NO el commit. Si hay ficheros TRACKED modificados, la imagen
# deploy-${SHA} NO se corresponde con el commit ${SHA} → se puede desplegar código
# stale/WIP sin que el SHA lo delate. Justo así se colaron rutas de respuesta que
# bloqueaban a premium y tardamos horas en verlo. Untracked (scripts sueltos) = OK.
DIRTY=$(git status --porcelain --untracked-files=no)
if [ -n "$DIRTY" ]; then
  echo "⚠️  ÁRBOL SUCIO — ficheros TRACKED modificados; la imagen NO será igual al commit ${SHA}:"
  echo "$DIRTY" | sed 's/^/     /'
  if [ "${ALLOW_DIRTY:-0}" != "1" ]; then
    echo "   ABORTADO. Commitea/descarta esos cambios, o repite con ALLOW_DIRTY=1 si es intencional."
    exit 1
  fi
  echo "   ALLOW_DIRTY=1 → continúo pese al árbol sucio."
fi

# ── AUTO-SINCRONIZACIÓN CON origin/main (antes del gate de CI) ───────────────
# El build sale del WORKING TREE, así que el guardarraíl anti-stale de más abajo aborta si
# tu árbol no contiene todo origin/main. Correcto — pero con varias sesiones pusheando,
# CUALQUIER push ajeno durante la ventana «verificar CI → construir» tumbaba el deploy y el
# operador acababa haciendo a mano `fetch` + `reset --hard` + reintentar. Medido el 27/07:
# tres abortos seguidos por esto (más otros tres por tratar `cancelled` como fallo).
#
# Cuando NO hay nada propio que perder —árbol limpio y HEAD ya contenido en origin/main—
# resincronizar es seguro POR CONSTRUCCIÓN y no cambia la semántica: el deploy ya es
# cumulativo, así que subir «el origin/main de este instante» es justo lo que se esperaba.
# Va ANTES del gate de CI a propósito, para que los checks se verifiquen sobre el SHA que
# de verdad se construye; y recalcula SHA/FULL_SHA, que si no el build se pinearía al viejo
# y el anti-clobber del final daría un falso positivo.
#
# NO auto-sincroniza (y aborta como siempre) si el árbol está sucio o si HEAD tiene commits
# propios sin pushear: ahí perder trabajo sí es posible y la decisión es del operador.
# Desactivar: NO_AUTO_SYNC=1.
git fetch origin main --quiet 2>/dev/null || true
if [ "${NO_AUTO_SYNC:-0}" != "1" ] && [ "${SKIP_MAIN_SYNC:-0}" != "1" ] \
   && ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "↻ [auto-sync] árbol SUCIO y detrás de origin/main → no toco nada; resuélvelo tú."
  elif git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then
    echo "↻ [auto-sync] árbol limpio y detrás de origin/main (otra sesión pusheó) → resincronizo."
    if git reset --hard origin/main --quiet; then
      SHA=$(git rev-parse HEAD | cut -c1-8)
      FULL_SHA=$(git rev-parse HEAD)
      echo "   → ahora en ${SHA}; el gate de CI verificará ESTE SHA."
    else
      echo "   ⚠️  no pude resincronizar; sigo y que decida el guardarraíl anti-stale."
    fi
  else
    echo "↻ [auto-sync] HEAD tiene commits propios que NO están en origin/main → no auto-sincronizo (los perdería)."
    echo "   Pushea tu rama o rebasa a mano; el guardarraíl anti-stale abortará si no."
  fi
fi

# GATE CI (Fase 2, 08/07/2026): NO desplegar código que no pasó CI. Consulta los
# check-runs de GHA para el SHA (via GITHUB_PAT de .env.local). Override: SKIP_CI_GATE=1.
# SOLO gatean los checks de CÓDIGO (unit+typecheck+lint). `integration` pega a la BD
# real y puede estar en rojo por dato en construcción / otra sesión paralela → es
# señal aparte (como salud/canary), NO bloquea el deploy de código. Ver docs/runbooks/pusheo-revision-despliegue.md.
FULL_SHA=$(git rev-parse HEAD)
if [ "${SKIP_CI_GATE:-0}" = "1" ]; then
  echo "→ [gate CI] OMITIDO (SKIP_CI_GATE=1)."
elif [ -z "${GITHUB_PAT:-}" ] || ! command -v jq >/dev/null 2>&1; then
  echo "⚠️  [gate CI] sin GITHUB_PAT o sin jq → no puedo verificar CI. Abortado (SKIP_CI_GATE=1 para forzar)."
  exit 1
else
  echo "→ [gate CI] verificando checks de CÓDIGO (unit+typecheck+lint) de GHA para ${SHA}…"
  CR=$(curl -s -H "Authorization: Bearer $GITHUB_PAT" -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/rikseotools/vence/commits/${FULL_SHA}/check-runs?per_page=100")
  TOTAL=$(echo "$CR" | jq -r '.total_count // 0')
  # Ejecución más reciente de cada check requerido (match por nombre, case-insensitive).
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
  if [ "$TOTAL" = "0" ] || [ "${MISSING:-0}" -gt 0 ]; then
    echo "   ❌ faltan checks de código para ${SHA}. ¿Has hecho 'git push'? El CI corre en push a main. (SKIP_CI_GATE=1 para forzar)."; exit 1
  elif [ "${FAILED:-0}" -gt 0 ]; then
    echo "   ❌ CI de CÓDIGO en ROJO: ${FAILED} check(s) (unit/typecheck/lint) fallando en ${SHA}. Arréglalo (o SKIP_CI_GATE=1)."; exit 1
  elif [ "${CANCELLED:-0}" -gt 0 ]; then
    echo "   ↻ CI CANCELADO para ${SHA}: ${CANCELLED} check(s) (otro push llegó después; NO es un fallo de tu código). Resincroniza y reintenta:  git fetch origin && git reset --hard origin/main"; exit 1
  elif [ "${PENDING:-0}" -gt 0 ]; then
    echo "   ⏳ CI de CÓDIGO aún EN CURSO: ${PENDING} check(s) en ${SHA}. Espera y reintenta (o SKIP_CI_GATE=1)."; exit 1
  fi
  echo "   ✅ CI de código verde (unit+typecheck+lint) para ${SHA}. [integration=${INTEG} — informativo, no gatea]"
fi

# ── GUARDA ANTI-STALE (reconciliar sobre origin/main) ────────────────────────
# El build sale del WORKING TREE de ESTA rama/worktree. Si tu rama NO contiene los
# últimos commits de origin/main (otra sesión avanzó main), desplegar DEJARÍA CAER
# ese trabajo — clobber stale. Casi pasó 11/07: feat/uc3m-golive no contenía el
# dashboard cache que ya estaba en main → desde ahí se habría revertido. Exigimos que
# HEAD contenga TODO origin/main. main = única verdad. Override: SKIP_MAIN_SYNC=1.
git fetch origin main --quiet 2>/dev/null || true
if [ "${SKIP_MAIN_SYNC:-0}" != "1" ] && ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
  echo "❌ origin/main tiene commits que tu rama NO incluye → desplegar los perdería (clobber stale)."
  echo "   Reconcilia primero:  git fetch origin && git rebase origin/main"
  echo "   (o cherry-pickea tu trabajo sobre un worktree nuevo desde origin/main y pushea a main)."
  echo "   Override consciente: SKIP_MAIN_SYNC=1"
  exit 1
fi

echo "→ [1/6] build ${IMG} (flip: NEXT_PUBLIC_AUTH_PROVIDER=authjs)${NO_CACHE:+ [--no-cache]}"
# NO_CACHE=1 → build desde cero (bustea capas cacheadas de podman). Incidente
# 07/07/2026: la capa `RUN npm run build` quedó envenenada (compilación stale de
# una ruta) y se reusaba en cada deploy → ni el commit correcto lo arreglaba.
# El canary del smoke lo detecta; NO_CACHE=1 es el martillo para recompilar limpio.
podman build ${NO_CACHE:+--no-cache} \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID="$NEXT_PUBLIC_GOOGLE_CLIENT_ID" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_MONTHLY="$NEXT_PUBLIC_STRIPE_PRICE_MONTHLY" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY="$NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_SEMESTER="$NEXT_PUBLIC_STRIPE_PRICE_SEMESTER" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_ANNUAL="${NEXT_PUBLIC_STRIPE_PRICE_ANNUAL:-}" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA="${NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA:-}" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA="${NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA:-}" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA="${NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA:-}" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_NILA="${NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_NILA:-}" \
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
  --target runner \
  -t "$IMG" .
# --target runner OBLIGATORIO: el Dockerfile tiene un stage `worker` (PDF, FROM deps) DESPUÉS
# de `runner`. Sin --target, podman construye el ÚLTIMO stage (worker) → imagen sin .next/static
# y [2b] falla ("/app/.next/static no existe"). El frontend es el stage `runner`; el worker se
# despliega por su propio camino. (Regresión al añadir el stage worker: aa6f0e815/b5117c557.)

echo "→ [2/6] push ECR"
aws ecr get-login-password --profile $P --region $R | podman login --username AWS --password-stdin "${ACC}.dkr.ecr.${R}.amazonaws.com" >/dev/null 2>&1
# Digest capturado DIRECTO del push (--digestfile), NO re-resuelto por tag después.
# Re-resolver con `describe-images imageTag=$TAG` devolvía el digest EQUIVOCADO de
# forma intermitente (consistencia eventual de ECR / carrera con deploys concurrentes)
# → la task def se pineaba a una imagen VIEJA y el fix no llegaba a prod aunque el
# deploy dijera OK (incidente 11/07). mktemp = seguro ante deploys concurrentes.
DIGESTFILE=$(mktemp)
podman push "$IMG" --digestfile "$DIGESTFILE" >/dev/null

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
# mktemp (NO paths fijos): dos deploys concurrentes con /tmp/vence-*.json FIJOS se
# pisaban el fichero entre write y register-task-definition → uno registraba la
# imagen del OTRO (task def con SHA equivocado → prod con código viejo, incidente 11/07).
S3LOG=$(mktemp)
aws s3 sync "${_staticdir}/static" "s3://${S3_STATIC_BUCKET}/_next/static" \
  --profile $P --region $R \
  --cache-control "public,max-age=31536000,immutable" \
  --no-progress > "$S3LOG" 2>&1
tail -2 "$S3LOG" || true; rm -f "$S3LOG"
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
# Digest del push (paso 2), determinista. NO re-resolver por tag (ver comentario allí).
DIGEST=$(cat "$DIGESTFILE"); rm -f "$DIGESTFILE"
if [ -z "$DIGEST" ]; then echo "   ❌ push no devolvió digest — ABORTO (no pinear a ciegas)"; exit 1; fi
IMG_DIGEST="${REG}@${DIGEST}"
echo "   $IMG_DIGEST"

echo "→ [4/6] clonar la task def VIVA (hereda secretos/config) + swap imagen"
# Base = la task def que el service USA AHORA (no una hardcodeada) → hereda AUTH_JWT_*,
# JWT_LOCAL_VERIFY_MODE=on, pooler, etc. sin poder olvidarlos.
LIVE_TD=$(aws ecs describe-services --cluster vence-backend --services vence-frontend --profile $P --region $R --query 'services[0].taskDefinition' --output text)
echo "   base viva: $LIVE_TD"
# mktemp por-deploy → seguro ante deploys concurrentes (ver comentario en [2b]).
TDLIVE=$(mktemp); TDNEW=$(mktemp)
aws ecs describe-task-definition --task-definition "$LIVE_TD" --profile $P --region $R --query 'taskDefinition' --output json > "$TDLIVE"
TDLIVE="$TDLIVE" TDNEW="$TDNEW" IMG_DIGEST="$IMG_DIGEST" node -e "
const fs=require('fs');
const td=JSON.parse(fs.readFileSync(process.env.TDLIVE,'utf8'));
td.containerDefinitions[0].image=process.env.IMG_DIGEST;
// Multi-cuenta Stripe (Nila): la task def viva no los tiene y aquí solo se
// swapea imagen, así que los añadimos idempotentemente (secretos runtime en
// SSM /vence-frontend/*). Sin esto newSignupAccount()→'manuel' (flip no ocurre)
// y getStripeFor('nila')/webhook Nila no tendrían credenciales.
const REGION='eu-west-2', ACC='349744179687';
const secrets=(td.containerDefinitions[0].secrets ||= []);
// KOIGRID_VIDEO_*: vídeos de curso servidos desde koigrid (S3/MinIO Hetzner, egress
// gratis, faststart → reproducibles en móvil). Params SSM /vence-frontend/* (creados
// 2026-07-19). Presentes → resolveVideoSignedUrl firma contra koigrid; ausentes →
// Supabase (reversible: quitar de aquí + redeploy). Mismo patrón que STRIPE_*_NILA:
// el deploy manual clona la task def viva y solo swapea imagen, así que los secretos
// runtime nuevos hay que añadirlos idempotentemente aquí (el ensure_secret del
// workflow YAML solo aplica al path GHA workflow_dispatch, que está en desuso).
// FEATURE_SHUFFLE_OPTIONS(_SCOPE): barajado de opciones (T-080 Fase 1). No son secretos, pero van
// por SSM y no por environment A PROPOSITO: un valor en environment esta HORNEADO en la task def,
// asi que cambiarlo obliga a registrar una nueva; por SSM se resuelve al arrancar la tarea, de modo
// que encender o apagar es cambiar el parametro y forzar un new deployment (~5 min, sin build ni
// task def nueva). Con FEATURE_SHUFFLE_OPTIONS=false el comportamiento es el historico.
// FEATURE_TEMARIO_PDF_PARTES(_SCOPE): troceado de los PDFs de temas enormes (T-273). Mismo motivo
// que el de barajado para ir por SSM: encender o apagar es cambiar el parametro y forzar un new
// deployment, sin build ni task def nueva. _SCOPE='all' = todas las oposiciones (decision de Manuel
// 30/07: ningun opositor debe quedarse sin su tema por la que estudie); una lista separada por comas
// lo acota, y 'false' en el primero devuelve el comportamiento historico (413 tema_demasiado_grande).
for (const name of ['STRIPE_SECRET_KEY_NILA','STRIPE_WEBHOOK_SECRET_NILA','STRIPE_NEW_SIGNUPS_ACCOUNT','KOIGRID_VIDEO_BUCKET','KOIGRID_VIDEO_ACCESS_KEY','KOIGRID_VIDEO_SECRET_KEY','FEATURE_SHUFFLE_OPTIONS','FEATURE_SHUFFLE_OPTIONS_SCOPE','FEATURE_TEMARIO_PDF_PARTES','FEATURE_TEMARIO_PDF_PARTES_SCOPE']) {
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
for (const name of ['NEXT_PUBLIC_STRIPE_PRICE_MONTHLY','NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY','NEXT_PUBLIC_STRIPE_PRICE_SEMESTER','NEXT_PUBLIC_STRIPE_PRICE_ANNUAL','NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA','NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA','NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA','NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_NILA']) {
  const val=process.env[name];
  if (!val) { console.error('❌ falta '+name+' en el entorno del deploy (¿.env.local?)'); process.exit(1); }
  const ex=env.find(e=>e.name===name);
  if (ex) ex.value=val; else env.push({name, value:val});
}
// Flag 'registro activo' (dinero real) — persistente mientras la campaña esté activa (Manuel 11/07).
// OJO: PROHIBIDAS las comillas dobles en este bloque (va dentro de node -e con comillas dobles) —
// cierran la cadena antes de tiempo y truncan el JS en silencio (incidente 11/07: un comentario con
// comillas dobles cortó el transform antes del writeFileSync). Usar SIEMPRE comillas simples aquí.
// El bonus (2€ por referido con >=5 tests) solo se concede con este flag en '1'. Para SUNSETEAR la
// campaña: cambiar a '0' aquí (o quitar la línea) y redeploy. Ver docs/runbooks/embajadores-recompensas.md.
{ const e=env.find(x=>x.name==='ACTIVE_SIGNUP_REWARD'); if (e) e.value='1'; else env.push({name:'ACTIVE_SIGNUP_REWARD', value:'1'}); }
// HLS_ENABLED (fase 2): activa el streaming HLS/ABR de los video-cursos (desde koigrid).
// Off/ausente = solo MP4 progresivo (fase 1). El player cae a MP4 ante cualquier error.
// Rollback: cambiar a 'false' aqui (o quitar la linea) + redeploy. Solo comillas simples.
{ const e=env.find(x=>x.name==='HLS_ENABLED'); if (e) e.value='true'; else env.push({name:'HLS_ENABLED', value:'true'}); }
// TRUSTED_EDGE (T-357, 31/07/2026): dice ante QUE borde estamos, y con ello resolveClientIp
// solo acepta como de CONFIANZA la cabecera de ESE proveedor. Sin esta variable el modulo
// corre en modo laxo (historico): aceptaria una cf-connecting-ip INYECTADA por el cliente
// como si fuera buena, y encima de esa IP corre el antifraude (multi_account_reg_ip, IP de
// captacion). Va aqui y no en SSM porque no es secreto y porque el dia que cambiemos de CDN
// esto es la UNICA linea que hay que tocar en el codigo — ese es el punto del modulo agnostico.
// El cierre del origen (secreto X-Origin-Verify en la regla 110 del ALB) es lo que hace que
// 'trusted' sea verdad; esta variable es lo que hace que se exija el borde correcto.
{ const e=env.find(x=>x.name==='TRUSTED_EDGE'); if (e) e.value='cloudfront'; else env.push({name:'TRUSTED_EDGE', value:'cloudfront'}); }
// Guardarrail anti-colision env/secret (incidente 11/07 referral-hold): ECS RECHAZA
// registrar un task def donde un mismo name este a la vez en environment y en secrets
// (error criptico 'The secret name must be unique and not shared...'). Lo detectamos
// AQUI con mensaje claro y accionable, antes de register-task-definition.
{ const en=new Set((td.containerDefinitions[0].environment||[]).map(e=>e.name));
  const clash=(td.containerDefinitions[0].secrets||[]).map(s=>s.name).filter(n=>en.has(n));
  if (clash.length) { console.error('COLISION env<->secret en el task def: '+clash.join(', ')+' — un name no puede estar en environment Y en secrets. Arregla el origen (deja el nombre en uno solo).'); process.exit(1); } }
for (const k of ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']) delete td[k];
fs.writeFileSync(process.env.TDNEW, JSON.stringify(td));
"
# Guard: el transform DEBE producir un JSON no vacío. Sin esto, un TDNEW vacío llegaba
# a register-task-definition como "Invalid JSON received" (críptico). Vars por ENTORNO
# (no ${} en el node -e) → a prueba de expansión shell.
[ -s "$TDNEW" ] || { echo "   ❌ el transform del task def produjo un fichero vacío — ABORTO"; rm -f "$TDLIVE" "$TDNEW"; exit 1; }
NEWTD=$(aws ecs register-task-definition --cli-input-json "file://${TDNEW}" --profile $P --region $R --query 'taskDefinition.taskDefinitionArn' --output text)
rm -f "$TDLIVE" "$TDNEW"
echo "   registrada: $NEWTD"

echo "→ [5/6] update-service (rolling) + esperar CONVERGENCIA REAL (mantiene el lock → deploys de uno en uno)"
aws ecs update-service --cluster vence-backend --service vence-frontend --task-definition "$NEWTD" --profile $P --region $R --query 'service.deployments[].{s:status,r:rolloutState}' --output json
# Esperar a la convergencia REAL: 1 SOLO deployment (los viejos DRENADOS) + PRIMARY
# COMPLETED + running==desired. Por qué NO el `aws ecs wait services-stable` nativo:
# hace timeout ~10min y, bajo drenado lento (deregistration delay) o varios deploys,
# el script salía por `set -e` y SOLTABA el flock ANTES de que el rollout convergiera
# → el siguiente deploy (que ESPERA en el flock) arrancaba ENCIMA → 2+ rollouts ECS
# solapados → se pasa la cuota Fargate vCPU (30) y la web oscila entre versiones
# (incidente 24/07, T-075). Manteniendo el lock hasta la convergencia real, los deploys
# van DE UNO EN UNO. Hasta 30min (igual que el `flock -w 1800`); si no converge, avisa y
# sigue (el smoke + la verificación de SHA vivo de [6/6] deciden, no se cuelga).
CONVERGED=0; NDEP=; RS=; RUN=; DES=
for _i in $(seq 1 90); do   # 90 × 20s = 30 min
  read -r NDEP RS RUN DES < <(aws ecs describe-services --cluster vence-backend --services vence-frontend --profile $P --region $R \
    --query 'services[0].[length(deployments), deployments[?status==`PRIMARY`]|[0].rolloutState, deployments[?status==`PRIMARY`]|[0].runningCount, deployments[?status==`PRIMARY`]|[0].desiredCount]' \
    --output text 2>/dev/null || echo "err err err err")
  if [ "$NDEP" = "1" ] && [ "$RS" = "COMPLETED" ] && [ "$RUN" = "$DES" ]; then CONVERGED=1; break; fi
  sleep 20
done
if [ "$CONVERGED" = "1" ]; then
  echo "   ✅ convergido: 1 deployment PRIMARY COMPLETED ($RUN/$DES tasks) — lock retenido hasta aquí"
else
  echo "   ⚠️ no convergió del todo en 30min (deployments=$NDEP rollout=$RS run=$RUN/$DES) — continúo; la verificación de SHA vivo de abajo decide"
fi

# Las tareas PROGRAMADAS que salen de este mismo árbol pero de OTRO stage del
# Dockerfile (worker de PDFs = stage `worker`) necesitan su propia imagen, en su
# propio repo, reconstruida en CADA deploy. Sin esto pasa lo del 27→29/07: su
# imagen vivía de prestado en el repo del frontend, la retención de 10 imágenes
# la purgó y el worker murió 2 días en silencio. OJO: no vale apuntarlas a la
# imagen del frontend (stage `runner`, sin devDeps → sin tsx).
# No aborta el deploy: el frontend ya está sano y convergido; se marca en rojo al final.
REPIN_OK=1
AWS_PROFILE="$P" AWS_REGION="$R" SHA="$SHA" \
  bash "$(dirname "$0")/deploy/repin-derived-taskdefs.sh" || REPIN_OK=0

echo "→ [6/6] smoke post-deploy"
HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.vence.es/)
TOKEN_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.vence.es/api/auth/token)
echo "   home=$HOME_CODE  /api/auth/token(sin sesión)=$TOKEN_CODE"
[ "$HOME_CODE" = "200" ] && [ "$TOKEN_CODE" = "401" ] || { echo "   ⚠️ smoke inesperado — revisar"; exit 1; }

# VERIFICAR QUE LO DESPLEGADO ES LO QUE CONSTRUIMOS (anti-clobber, incidente 11/07).
# /api/health.deploy = el SHA horneado en la imagen (build-arg GIT_COMMIT_SHA). Si NO
# coincide con $SHA tras reintentos (deja drenar el rollout), otro deploy concurrente
# pisó éste o no propagó → prod corre código EQUIVOCADO aunque el deploy diga "OK".
# Ésta es la comprobación que faltaba: el deploy podía "triunfar" sirviendo la imagen
# de otra sesión (paths /tmp compartidos, ya arreglados) o quedar clobbereado.
echo "→ verificando que el SHA vivo == $SHA (anti-clobber)"
DEPLOYED_SHA=""
for _i in 1 2 3 4 5 6; do
  DEPLOYED_SHA=$(curl -s --max-time 8 https://www.vence.es/api/health | python3 -c "import sys,json;print(json.load(sys.stdin).get('deploy',''))" 2>/dev/null || true)
  [ "$DEPLOYED_SHA" = "$SHA" ] && break
  sleep 5
done
if [ "$DEPLOYED_SHA" = "$SHA" ]; then
  echo "   ✅ SHA vivo = $SHA"
else
  echo "   ❌ SHA vivo = '$DEPLOYED_SHA' ≠ '$SHA' — el deploy fue CLOBBEREADO por otra sesión o no propagó."
  echo "      Prod NO está sirviendo tu código. Coordina el deploy (que nadie más despliegue) y reintenta."
  exit 1
fi
# CloudFront: invalidar SIEMPRE tras un deploy.
#
# POR QUÉ (29/07/2026): el manual de caché daba por hecho que esto lo hacía el workflow
# `frontend-deploy.yml`… pero el auto-deploy por GitHub Actions está DESACTIVADO y los
# deploys reales salen de este script, que no invalidaba. Resultado: el contenedor nuevo
# servía el HTML correcto y `www.vence.es` seguía enseñando el viejo hasta 24 h (el TTL
# máximo de la cache policy). Se vio con el arreglo de las plazas: el origen ya decía 46
# y el catálogo público seguía diciendo 51 a todo el mundo, con el deploy "OK" y los tags
# de Next revalidados — son capas independientes.
#
# `/*` cuenta como UN path del free tier (1000/mes) y tarda 1-2 min. Best-effort: un fallo
# aquí no invalida el deploy, que ya está vivo.
echo "→ invalidando CloudFront (si no, la página cacheada tarda hasta 24 h en cambiar)"
aws --profile "$P" --region "$R" cloudfront create-invalidation \
  --distribution-id E1EH4WF1H7ZGLA --paths "/*" \
  --query 'Invalidation.[Id,Status]' --output text 2>/dev/null \
  || echo "   ⚠️ no se pudo invalidar CloudFront — hazlo a mano (ver docs/maintenance/cache-revalidation.md)"

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
# Canaries del BACKEND que vigilan el comportamiento del frontend recién publicado.
#
# ⚠️ POR QUÉ ESTÁN AQUÍ Y NO SOLO EN GITHUB ACTIONS (31/07/2026): estaban disparados
# ÚNICAMENTE desde `.github/workflows/frontend-deploy.yml`, y el equipo despliega con ESTE
# script (el runbook lo dice: «desplegar SIEMPRE con el script»). Resultado medido:
# `canary-questions-gate` había corrido **3 veces desde el 3 de julio** — un canary
# post-deploy que casi nunca ve un deploy no vigila nada. El disparo va donde ocurre el
# despliegue de verdad.
#
# NO bloquean el deploy: ya está hecho, y un rojo emite su alerta [Vence CRITICAL] con el
# detalle. Bloquear aquí solo añadiría un rollback por algo que la alerta ya cuenta mejor.
echo "→ canaries post-deploy del backend (gate anti-scraping · identidad en pagos)"
CRON_SECRET_VAL=$(aws --profile "$P" --region "$R" ssm get-parameter --name "/vence-frontend/CRON_SECRET" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || true)
if [ -n "$CRON_SECRET_VAL" ]; then
  for CANARY in run-questions-gate run-identidad-pago; do
    CODE=$(curl -s -o /tmp/canary-$CANARY.json -w '%{http_code}' --max-time 40 \
      -X POST "https://api.vence.es/api/v2/canary/$CANARY" \
      -H "Authorization: Bearer ${CRON_SECRET_VAL}" || echo 000)
    case "$CODE" in
      200) echo "   ✅ $CANARY OK";;
      503) echo "   ⚠️⚠️ $CANARY ROJO — el backend ya emitió [Vence CRITICAL]. Revisar: $(cat /tmp/canary-$CANARY.json 2>/dev/null | head -c 300)";;
      *)   echo "   ⚠️ $CANARY no respondió (HTTP $CODE) — el disparo no llegó, NO es un verde";;
    esac
  done
else
  echo "   (canaries omitidos: CRON_SECRET no accesible en SSM)"
fi

# Verificación en NAVEGADOR de lo recién publicado: los journeys de Vence Sim marcados
# `postDeploy` (hoy, los controles flotantes del examen — el fallo de Manolo era de PINTADO y
# ningún smoke de HTTP lo ve). Aquí SOLO se resuelven los secretos de ESTA nube; el verificador
# (scripts/verify-release.sh) es agnóstico y es lo que llamará también koigrid.
# No bloquea el despliegue: un rojo puede ser del entorno (contenedor frío, límite de
# peticiones) y un guardarraíl que tumba deploys por causas ajenas se acaba desactivando.
VERIFY_SECRET=$(aws --profile "$P" --region "$R" ssm get-parameter --name "/vence-frontend/AUTH_SECRET" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || true)
VERIFY_ID=$(aws --profile "$P" --region "$R" ssm get-parameter --name "/vence-backend/SMOKE_USER_ID" --query 'Parameter.Value' --output text 2>/dev/null || true)
VERIFY_CANARY=$(aws --profile "$P" --region "$R" ssm get-parameter --name "/vence-frontend/CRON_SECRET" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || true)
VERIFY_BASE_URL=https://www.vence.es \
SIM_AUTH_SECRET="$VERIFY_SECRET" \
SMOKE_USER_ID="$VERIFY_ID" \
CANARY_SECRET="$VERIFY_CANARY" \
SIM_EMIT=1 \
  bash "$(dirname "$0")/verify-release.sh" || true

echo ""
if [ "$REPIN_OK" != "1" ]; then
  echo "⚠️⚠️ FRONTEND DESPLEGADO OK, pero alguna task def derivada NO se re-pineó (ver arriba)."
  echo "     El frontend está sano; lo que queda en riesgo son las tareas programadas."
  exit 1
fi
echo "✅ DEPLOY OK — $NEWTD"
# ── Despertar las tareas del backlog que esperaban ESTE deploy ───────────────
# Una sesión que deja trabajo "hecho pero sin verificar hasta que se despliegue" lo marca con
# `backlog.cjs pause <id> --tras-deploy`. Aquí se cierra el bucle: el deploy avisa, en vez de
# que alguien tenga que acordarse. Best-effort — nunca puede tumbar un deploy que ya salió bien.
node "$(dirname "$0")/backlog.cjs" deployed "$FULL_SHA" --superficie frontend 2>/dev/null || true

echo "   Gate de auth (recomendado): node scripts/fase-b-auth-surfaces-check.cjs"
echo "   Rollback: aws ecs update-service --cluster vence-backend --service vence-frontend --task-definition $LIVE_TD --profile vence --region eu-west-2"
