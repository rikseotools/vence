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
SHA=$(git rev-parse HEAD | cut -c1-8)      # 8 chars EXACTOS: debe casar con /health.deploy = GIT_COMMIT_SHA.slice(0,8). `--short` daba longitud AUTO (7-9+) → falso "clobber" cuando ≠ 8 (visto 22/07: 'b201d798a' 9c vs 'b201d798' 8c)
TAG="deploy-${SHA}"
IMG="${REG}:${TAG}"

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
  : >&9; echo "backend $SHA pid=$$ $(date -u +%FT%TZ)" >&9
  echo "🔒 lock de deploy adquirido ($LOCK)."
else
  echo "⚠️  flock no disponible — sin serialización de deploy; coordina a mano."
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
  elif [ "${CANCELLED:-0}" -gt 0 ]; then echo "   ↻ CI CANCELADO para ${SHA}: ${CANCELLED} check(s) (otro push llegó después; NO es un fallo de tu código). Resincroniza y reintenta:  git fetch origin && git reset --hard origin/main"; exit 1
  elif [ "${PENDING:-0}" -gt 0 ]; then echo "   ⏳ CI de CÓDIGO EN CURSO: ${PENDING} check(s). Espera y reintenta (o SKIP_CI_GATE=1)."; exit 1
  fi
  echo "   ✅ CI de código verde (unit+typecheck+lint) para ${SHA}. [integration=${INTEG} — informativo]"
fi

# ── GUARDA ANTI-STALE (reconciliar sobre origin/main) — mismo criterio que front ──
# HEAD debe contener TODO origin/main, o desplegar dejaría caer trabajo de otra sesión.
git fetch origin main --quiet 2>/dev/null || true
if [ "${SKIP_MAIN_SYNC:-0}" != "1" ] && ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
  echo "❌ origin/main tiene commits que tu rama NO incluye → desplegar los perdería (clobber stale)."
  echo "   Reconcilia:  git fetch origin && git rebase origin/main   (override: SKIP_MAIN_SYNC=1)"
  exit 1
fi

echo "→ [1/6] build ${IMG} (contexto backend/)"
podman build --build-arg GIT_COMMIT_SHA="$SHA" -t "$IMG" ./backend

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
echo "   Rollback: aws ecs update-service --cluster vence-backend --service vence-backend --task-definition $LIVE_TD --profile vence --region eu-west-2"
