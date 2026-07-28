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
case "$QUE" in
  backend|frontend) SCRIPT="scripts/deploy-${QUE}.sh" ;;
  *) echo "uso: $0 backend|frontend [vueltas]"; exit 2 ;;
esac
[ -f "$SCRIPT" ] || { echo "no encuentro $SCRIPT"; exit 2; }

PAT=$(sed -n 's/^GITHUB_PAT=//p' .env.local 2>/dev/null | tr -d "\"'" | head -1)
[ -n "$PAT" ] || { echo "sin GITHUB_PAT en .env.local — no puedo consultar el CI"; exit 2; }
REPO="${DEPLOY_REPO:-rikseotools/vence}"

veredicto() {  # $1=sha -> imprime "estado|motivo"
  curl -sS -H "Authorization: Bearer $PAT" -H "Accept: application/vnd.github+json" \
       "https://api.github.com/repos/$REPO/commits/$1/check-runs?per_page=100" 2>/dev/null \
  | node -e '
const { clasificarCiCodigo } = require("./lib/deploy/ciGate.js");
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  let runs=[]; try{ runs=(JSON.parse(s).check_runs)||[] }catch(e){}
  const r=clasificarCiCodigo(runs);
  console.log(r.estado+"|"+r.motivo);
});'
}

for v in $(seq 1 "$VUELTAS"); do
  git fetch origin -q
  if [ -n "$(git status --porcelain)" ]; then
    echo "❌ árbol SUCIO: el build usa el working tree, así que no toco nada. Commitea o descarta y reintenta."
    git status --short | head -5
    exit 1
  fi
  git reset --hard origin/main -q
  SHA=$(git rev-parse HEAD)
  echo "══ vuelta $v/$VUELTAS — siguiendo ${SHA:0:9}"

  for i in $(seq 1 20); do
    OUT=$(veredicto "$SHA"); EST="${OUT%%|*}"; MOT="${OUT#*|}"
    echo "   [$i] $EST — $MOT"
    case "$EST" in
      verde)
        echo "→ desplegando $QUE"
        if bash "$SCRIPT"; then echo "✅ DEPLOY $QUE OK (vuelta $v)"; exit 0; fi
        echo "   el deploy no completó; reevalúo en la siguiente vuelta"; break ;;
      rojo)
        echo "❌ CI en ROJO para ${SHA:0:9} — alguien rompió main. NO se despliega: arréglalo."; exit 1 ;;
      cancelado)
        echo "   ↻ resincronizo al HEAD nuevo"; break ;;
    esac
    # si origin/main avanzó mientras esperábamos, no tiene sentido seguir mirando este SHA
    git fetch origin -q
    if [ "$(git rev-parse origin/main)" != "$SHA" ]; then echo "   ↻ origin/main avanzó → resincronizo"; break; fi
    sleep 30
  done
done

echo "❌ agotadas las $VUELTAS vueltas sin poder desplegar. Mira si main lleva mucho rato rojo o si hay un deploy largo acaparando el lock."
exit 1
