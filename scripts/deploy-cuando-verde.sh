#!/usr/bin/env bash
# scripts/deploy-cuando-verde.sh
#
# Sigue a `origin/main`, espera a que su CI de CÓDIGO verdee y ENTONCES despliega. Existe porque
# con varias sesiones de Claude pusheando cada pocos minutos, la ventana que exigen los guardarraíles
# —árbol limpio + al día con origin/main + lock de deploy libre + CI VERDE de ese SHA exacto— casi
# nunca coincide, y un deploy "a mano" se estrella una y otra vez.
#
# Caso que lo motiva (28/07/2026): desplegar un fix de UNA línea en el backend necesitó SIETE
# intentos. Solo UNO falló por el código (typecheck roto en main, ajeno). Los otros seis:
#   · CI aún en curso (el gate hace exit 1, no espera)            → aquí se espera
#   · GitHub CANCELÓ el run porque llegó otro push                → aquí se resincroniza
#     (28/07: esto debería ser YA raro — `test.yml` dejó de cancelar en `main`, donde se
#      cancelaba el 57% de los runs. Se mantiene el manejo por si acaso.)
#   · el lock lo tenía un build de frontend de >30 min            → aquí se reintenta
#   · árbol sucio (cambios sin commitear)                         → aquí se PARA y se avisa
#
# El veredicto del CI NO se decide aquí: vive en `lib/deploy/ciGate.js` (11 tests), el mismo criterio
# que aplican los scripts de deploy. La paridad la vigila __tests__/guardrails/ciGateParidad.test.ts.
#
# Uso:  scripts/deploy-cuando-verde.sh backend|frontend [vueltas]
#       scripts/deploy-cuando-verde.sh backend            # 12 vueltas (por defecto)
#
# NO despliega si el CI está en ROJO de verdad: eso se arregla, no se fuerza.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

QUE="${1:-backend}"
VUELTAS="${2:-12}"
# Cuántos commits hacia atrás se buscan en pos del último VERDE ([T-619]).
#
# CALIBRADO CON LA MEDIDA, no a ojo: el 06/08 a las 18:40 el último commit con veredicto estaba a
# **21 de la punta** (una ventana de 15 daba «esperar» teniendo un verde perfectamente desplegable
# detrás). El fenómeno es de RÁFAGA: por la mañana, con huecos de ~10 min entre pushes y runs de
# 3-4 min, cada commit se juzgaba y la punta estaba verde; por la tarde, con varias sesiones
# cerrando a la vez y pushes cada 2 min, 21 commits seguidos se quedaron sin veredicto.
#
# El bucle PARA en el primer verde, así que en un día normal esto es UNA consulta a la API: la
# ventana grande solo se paga cuando hace falta, y encima los veredictos terminales se cachean.
#
# ⚠️ SEGUNDA CALIBRACIÓN EN EL MISMO DÍA, y la lección es que un número fijo aquí no vale: puse 15
# «de sobra», el simulador dio ESPERAR con el verde a 21; lo subí a 40 y una hora después el mismo
# verde estaba a 52 (el lanzador del backend se quedó en «esperar» teniendo commit desplegable).
# El ritmo de push varía por franja horaria, así que la ventana se pone GENEROSA a propósito: lo
# que la acota de verdad es que el bucle para en el primer verde, no el número.
VENTANA_VERDE="${VENTANA_VERDE:-150}"

# ── DÓNDE se lanza esto IMPORTA (T-364, 31/07/2026) ───────────────────────────────────────
# Este script hace `git reset --hard origin/main` en el árbol desde el que se ejecuta, y lo hace
# EN CADA VUELTA (hasta 12), porque despliega exactamente el SHA cuyo CI ha verificado. Eso está
# bien para su trabajo y mal para el tuyo si lo lanzas desde el worktree en el que estás
# programando: **te mueve el HEAD debajo de los pies**, aparecen y desaparecen ficheros según la
# vuelta, y los commits locales que no hayas pusheado se descartan de la rama (quedan en el reflog,
# pero hay que saber ir a buscarlos).
#
# Lo que NO hace, para que nadie lo suponga: no se lleva por delante cambios sin commitear — se
# niega a correr con el árbol sucio, unas líneas más abajo. El daño es el otro.
#
# Y ojo, que PUSHEAR NO TE PROTEGE EL PUNTERO: `fetch` y `reset` son dos pasos, así que un push que
# entre entre medias deja el reset apuntando a la referencia recién traída —un commit anterior— y tu
# rama se queda ahí. El trabajo está a salvo en el remoto; lo que se mueve es tu árbol. Reconstruido
# con el reflog el 31/07: `reset: moving to origin/main` justo detrás del commit ya pusheado.
#
# Caso real: una sesión lanzó el deploy desde su propio worktree, siguió trabajando, y a la vuelta
# 4 se encontró la rama en un commit anterior y un fichero recién creado «desaparecido». No se
# perdió nada porque ya estaba pusheado, pero el susto y el rato de investigación sí.
#
# Por eso: se despliega desde el REPO PRINCIPAL, que no tiene trabajo en curso. El script sigue a
# `origin/main` de todas formas, así que tu rama no pinta nada aquí.
ARGS_ORIGINALES="$*"   # para que el mensaje de la guarda sugiera el comando de verdad
. "$(dirname "$0")/lib/guardia-worktree.sh"
guardia_worktree "hace 'git reset --hard origin/main' en CADA vuelta y dejaría tu rama en el commit que hubiera al hacer el fetch"
case "$QUE" in
  backend|frontend) SCRIPT="scripts/deploy-${QUE}.sh" ;;
  *) echo "uso: $0 backend|frontend [vueltas]"; exit 2 ;;
esac
[ -f "$SCRIPT" ] || { echo "no encuentro $SCRIPT"; exit 2; }

PAT=$(sed -n 's/^GITHUB_PAT=//p' .env.local 2>/dev/null | tr -d "\"'" | head -1)
[ -n "$PAT" ] || { echo "sin GITHUB_PAT en .env.local — no puedo consultar el CI"; exit 2; }
REPO="${DEPLOY_REPO:-rikseotools/vence}"

# Un deploy que NO sale tiene que dejar rastro fuera de esta terminal ([T-619]). Fail-open: el
# aviso nunca cambia el resultado del deploy.
avisar_no_desplegado() {  # $1=motivo corto  $2=detalle
  node scripts/lib/avisar-deploy-no-salido.cjs "$QUE" "${1:-}" "${2:-}" 2>/dev/null || true
}

# CACHÉ de veredictos TERMINALES ([T-619]). Al buscar el último verde se recorren muchos commits, y
# el bucle interno repite el barrido cada 30 s: sin memoria serían cientos de llamadas a la API por
# vuelta, casi todas para volver a preguntar por commits cuyo CI YA terminó.
#
# Solo se cachea lo que no puede cambiar: `verde` y `rojo`. Un `faltan`/`curso`/`cancelado` es
# provisional por definición y se vuelve a preguntar — cachearlo sería congelar el «todavía no» y
# no enterarse nunca de que ya hay veredicto.
CACHE_VER="$(mktemp -t veredictos-XXXXXX)"
trap 'rm -f "$CACHE_VER"' EXIT

veredicto() {  # $1=sha -> imprime "estado|motivo"
  local cacheado
  cacheado=$(grep -m1 "^$1 " "$CACHE_VER" 2>/dev/null | cut -d' ' -f2-)
  if [ -n "$cacheado" ]; then printf '%s\n' "$cacheado"; return 0; fi
  local out
  out=$(curl -sS -H "Authorization: Bearer $PAT" -H "Accept: application/vnd.github+json" \
       "https://api.github.com/repos/$REPO/commits/$1/check-runs?per_page=100" 2>/dev/null \
  | node -e '
const { clasificarCiCodigo } = require("./lib/deploy/ciGate.js");
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  let runs=[]; try{ runs=(JSON.parse(s).check_runs)||[] }catch(e){}
  const r=clasificarCiCodigo(runs);
  console.log(r.estado+"|"+r.motivo);
});')
  case "$out" in
    verde\|*|rojo\|*) printf '%s %s\n' "$1" "$out" >> "$CACHE_VER" ;;
  esac
  printf '%s\n' "$out"
}

# ── ¿YA ESTÁ VIVO LO QUE PERSIGO? (T-386) ───────────────────────────────────────────────────
# El lock SERIALIZA, pero no DEDUPLICA: el deploy es cumulativo, así que un segundo lanzador de la
# misma superficie no adelanta nada — solo gasta vueltas y consultas al CI. El 31/07 dos sesiones
# lanzaron backend a la vez; una murió tras 20 vueltas (por un motivo ajeno) y NO avisó a nadie:
# tres tareas se quedaron dormidas esperando un deploy que otra sesión ya había hecho.
#
# La pregunta que faltaba no es «¿tengo yo el lock?» sino «¿está ya dentro el commit que persigo?».
# Se responde con el MISMO módulo que usan `deploy-pendiente` y `backlog.cjs` (lib/deploy/shaVivo),
# que lee el contrato observable `/health` y es agnóstico del proveedor. Dos implementaciones del
# mismo criterio se separarían y el desacuerdo sería invisible.
#
# Invariante heredado y deliberado: si NO se puede saber el sha vivo, `shaVivo` devuelve null y
# aquí se sigue desplegando. "No lo sé" nunca equivale a "ya está hecho".
ya_esta_vivo() {  # $1=sha objetivo -> 0 si el vivo ya lo contiene
  local objetivo="$1" vivo
  vivo=$(node -e '
    const { shaVivo } = require("./lib/deploy/shaVivo.cjs");
    shaVivo(process.argv[1]).then(s => process.stdout.write(s || ""));
  ' "$QUE" 2>/dev/null) || return 1
  [ -n "$vivo" ] || return 1
  git cat-file -e "${vivo}^{commit}" 2>/dev/null || return 1   # sha desconocido aquí: no opinar
  git merge-base --is-ancestor "$objetivo" "$vivo" 2>/dev/null || return 1
  VIVO_SHA="$vivo"
  return 0
}

for v in $(seq 1 "$VUELTAS"); do
  git fetch origin -q
  # SOLO lo trackeado (T-366). Lo que este bucle puede destruir es trabajo sin commitear de
  # ficheros YA trackeados, porque acto seguido hace `reset --hard`: eso sí hay que proteger.
  # Los ficheros SIN trackear sobreviven intactos a un `reset --hard` —los borraría un `git clean`,
  # que aquí no se usa— y `deploy-{frontend,backend}.sh` ya los tolera con este mismo flag. Con
  # 2-10 sesiones compartiendo checkout, el scratch ajeno (`scratchpad/tNNN/`, ajustes locales)
  # está SIEMPRE ahí, así que contarlo dejaba el lanzador inservible justo cuando más falta hace:
  # cuando hay trabajo de varias sesiones esperando un deploy.
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "❌ árbol SUCIO: el build usa el working tree, así que no toco nada. Commitea o descarta y reintenta."
    git status --short --untracked-files=no | head -5
    exit 1
  fi
  # Y el hermano que faltaba (T-443 punto 6): un árbol LIMPIO puede tener commits que aún no
  # están en origin/main. `git status` sale impecable y el `reset --hard` de abajo se los lleva
  # EN SILENCIO. Pasó dos veces el 05/08/2026 en el checkout compartido —la segunda con el
  # lanzador de otra sesión, arrancado 97 s antes—: basta con commitear mientras alguien
  # despliega. Criterio puro y testeado en lib/deploy/commitsSinEmpujar.cjs.
  POR_DELANTE=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "")
  RESUMEN=$(git log --oneline origin/main..HEAD 2>/dev/null | head -5)
  VEREDICTO=$(POR_DELANTE="$POR_DELANTE" RESUMEN="$RESUMEN" node -e '
    const { puedeResetear } = require("./lib/deploy/commitsSinEmpujar.cjs");
    const n = process.env.POR_DELANTE === "" ? null : Number(process.env.POR_DELANTE);
    const r = puedeResetear({
      commitsPorDelante: n,
      resumenCommits: (process.env.RESUMEN || "").split("\n").filter(Boolean),
      escape: process.env.DEPLOY_RESET_OK || "",
    });
    process.stdout.write((r.permite ? "OK" : "STOP") + "\n" + r.mensaje);
  ' 2>/dev/null) || VEREDICTO="OK"     # fail-open si node no arranca: no es este el guardián del deploy
  [ -n "${VEREDICTO#OK}" ] && printf '%s\n' "${VEREDICTO#OK}" | sed '/^$/d'
  case "$VEREDICTO" in
    STOP*) exit 1 ;;
  esac
  git reset --hard origin/main -q
  SHA=$(git rev-parse HEAD)
  echo "══ vuelta $v/$VUELTAS — siguiendo ${SHA:0:9}"

  # Antes de gastar una vuelta: ¿lo ha desplegado ya otra sesión? (T-386)
  if ya_esta_vivo "$SHA"; then
    echo "✅ ${SHA:0:9} YA ESTÁ VIVO en $QUE (desplegado por otra sesión, vivo=${VIVO_SHA})."
    echo "   El deploy es cumulativo: no hay nada que hacer. Salgo sin competir por el lock."
    exit 0
  fi

  for i in $(seq 1 20); do
    # ── NO se persigue solo la PUNTA ([T-619]) ────────────────────────────────────────────────
    # Con 2-10 sesiones la punta casi nunca tiene veredicto (medido 06/08: 40 commits/día, hueco
    # mediano de 2 min, y GitHub cancelando los runs PENDIENTES). Se miran los últimos
    # $VENTANA_VERDE commits y se despliega el más reciente que esté VERDE: el deploy es
    # cumulativo, así que eso sube igualmente todo lo anterior. La decisión es pura y testeada
    # (lib/deploy/ultimoVerde.js); aquí solo se recogen los veredictos.
    CANDIDATOS=""
    ELEGIDO=""
    for s in $(git rev-list -n "${VENTANA_VERDE}" origin/main); do
      OUT=$(veredicto "$s"); EST="${OUT%%|*}"
      CANDIDATOS="${CANDIDATOS}${s} ${EST}\n"
      [ "$EST" = "verde" ] && { ELEGIDO="$s"; break; }   # no gastamos API mirando más atrás
    done
    DECISION=$(printf "$CANDIDATOS" | node -e '
      const { elegirCommitDesplegable } = require("./lib/deploy/ultimoVerde.js");
      let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
        const candidatos = s.split("\n").filter(Boolean).map((l)=>{ const [sha,estado]=l.split(" "); return {sha,estado} });
        const r = elegirCommitDesplegable({ candidatos });
        console.log([r.accion, r.sha||"", r.dejaFuera.length, r.rotos.length, r.motivo].join("|"));
      });')
    ACC="${DECISION%%|*}"; RESTO="${DECISION#*|}"
    SHA_VERDE="${RESTO%%|*}"; RESTO="${RESTO#*|}"
    FUERA="${RESTO%%|*}"; RESTO="${RESTO#*|}"
    ROTOS="${RESTO%%|*}"; MOT="${RESTO#*|}"
    echo "   [$i] $ACC — $MOT"
    [ "${ROTOS:-0}" != "0" ] && echo "   ⚠️  $ROTOS commit(s) de main con el CI en ROJO por delante del que se despliega — alguien tiene que mirarlo"
    case "$ACC" in
      desplegar)
        echo "→ desplegando $QUE en ${SHA_VERDE:0:9} (deja fuera $FUERA commit(s) más nuevos, irán en el siguiente deploy)"
        if DEPLOY_SHA="$SHA_VERDE" bash "$SCRIPT"; then echo "✅ DEPLOY $QUE OK (vuelta $v)"; exit 0; fi
        echo "   el deploy no completó; reevalúo en la siguiente vuelta"; break ;;
      abortar)
        echo "❌ CI en ROJO en toda la ventana — alguien rompió main y no hay nada verificado que desplegar."
        avisar_no_desplegado "abortar" "$MOT"; exit 1 ;;
      nada)
        echo "✅ nada que hacer: $MOT"; exit 0 ;;
    esac
    EST="$ACC"
    # si origin/main avanzó mientras esperábamos, no tiene sentido seguir mirando este SHA
    git fetch origin -q
    if [ "$(git rev-parse origin/main)" != "$SHA" ]; then echo "   ↻ origin/main avanzó → resincronizo"; break; fi
    sleep 30
  done
done

echo "❌ agotadas las $VUELTAS vueltas sin poder desplegar. Mira si main lleva mucho rato rojo o si hay un deploy largo acaparando el lock."
avisar_no_desplegado "vueltas_agotadas" "agotadas las $VUELTAS vueltas sin desplegar $QUE"
exit 1
