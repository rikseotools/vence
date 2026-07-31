#!/usr/bin/env bash
# Cierra una sesión creada con crear-worktree.sh: libera sus claims, avisa de commits sin
# llevar a origin/main, quita el worktree + la rama, para el Postgres local si lo había.
#
# Uso: scripts/worktrees/borrar-worktree.sh <slug> [--force]
#   --force  lo quita aunque guarde trabajo que no esté en ningún otro sitio (se PIERDE)
set -euo pipefail

SLUG="${1:-}"
[ -n "$SLUG" ] || { echo "Uso: borrar-worktree.sh <slug> [--force]"; exit 2; }
FORCE=0; [ "${2:-}" = "--force" ] && FORCE=1

GIT_COMMON="$(git rev-parse --git-common-dir 2>/dev/null)" || { echo "❌ no estás en un repo git"; exit 2; }
MAIN_REPO="$(cd "$(dirname "$GIT_COMMON")" && pwd)"
SESSIONS_DIR="${VENCE_SESSIONS_DIR:-$HOME/vence-sessions}"
WT="$SESSIONS_DIR/$SLUG"
BRANCH="sesion/$SLUG"
CONTAINER="vence-sess-$SLUG"
# Repo de ESTE script (ver la nota en listar-worktrees.sh): las herramientas de sesión pueden no
# estar en el árbol principal todavía.
ESTE_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

[ -d "$WT" ] || { echo "❌ no existe la sesión $WT"; exit 2; }

# 0. ¿La está usando alguien AHORA? (T-296) Hasta hoy esta pregunta se contestaba a ojo, mirando la
#    fecha del directorio — que no vale: una sesión viva pasa horas sin tocar su worktree. Ahora hay
#    señal con hora (`worktree_sessions`) y procesos con el cwd dentro. `latidos.cjs --slug` sale con
#    3 si está en uso. Fail-open: si no hay BD o el script no está, se avisa y se sigue (esto no
#    puede impedir cerrar una sesión muerta), pero si CONTESTA que está viva, se para.
if [ -f "$ESTE_REPO/scripts/sessions/latidos.cjs" ]; then
  set +e
  SENAL="$(cd "$ESTE_REPO" && node scripts/sessions/latidos.cjs --slug "$SLUG" 2>/dev/null)"
  EN_USO=$?
  set -e
  [ -n "$SENAL" ] && echo "$SENAL" | sed 's/^/   /'
  if [ "$EN_USO" = 3 ] && [ "$FORCE" != 1 ]; then
    echo ""
    echo "⛔ Esa sesión está EN USO (señal reciente o procesos dentro). Abortado."
    echo "   Si de verdad quieres cerrarla: borrar-worktree.sh $SLUG --force"
    exit 1
  fi
fi

# 1. Liberar claims de esta sesión (si hay cola.cjs y session-id)
if [ -f "$WT/.session-id" ] && [ -f "$WT/scripts/impugnaciones/cola.cjs" ]; then
  SID="$(cat "$WT/.session-id")"
  echo "→ liberando claims del sid $SID…"
  ( cd "$WT" && node scripts/impugnaciones/cola.cjs release-all --sid "$SID" ) 2>/dev/null || echo "  (sin claims o cola.cjs no lo soporta; se ignora)"
fi

# 2+3. ¿Se PERDERÍA algo al borrar esto? (T-431)
#
# Antes eran dos comprobaciones y las dos preguntaban mal: una contaba commits por delante de
# origin/main y la otra miraba si el árbol estaba sucio. Medido el 31/07 sobre los cinco worktrees
# que había: CUATRO habrían bloqueado sin tener nada que perder —47 commits ya presentes en `main`
# por contenido, ficheros idénticos byte a byte, una versión desfasada de algo ya subido— y solo
# uno guardaba trabajo real. Un bloqueo que es ruido 4 de cada 5 veces enseña a teclear `--force`…
# y aquí `--force` descarta TAMBIÉN lo que sí importaba, sin vuelta atrás.
#
# Ahora la pregunta es «¿qué existe aquí y en ningún otro sitio?», con el MISMO criterio que usa
# el barrido (`lib/sessions/trabajoHuerfano.cjs`): dos puertas al mismo recurso con criterios
# distintos no protegen, se contradicen.
if [ -f "$ESTE_REPO/scripts/sessions/huerfanos.cjs" ]; then
  set +e
  UNICO="$(cd "$ESTE_REPO" && node scripts/sessions/huerfanos.cjs --slug "$SLUG" 2>/dev/null)"
  HAY_UNICO=$?
  set -e
  [ -n "$UNICO" ] && echo "$UNICO" | sed 's/^/   /'
  if [ "$HAY_UNICO" = 3 ] && [ "$FORCE" != 1 ]; then
    echo ""
    echo "⛔ Ahí hay trabajo que no está en ningún otro sitio. Abortado para no perderlo."
    echo "   Míralo:   git -C $WT diff origin/main"
    echo "   Llévalo a origin/main (ver runbook de pusheo) y vuelve a cerrar."
    echo "   Si de verdad quieres DESCARTARLO: borrar-worktree.sh $SLUG --force"
    exit 1
  fi
else
  # Sin el detector, se cae al criterio viejo: ruidoso, pero no se borra a ciegas.
  DIRT="$(git -C "$WT" status --porcelain 2>/dev/null | grep -vE '^\?\? \.session-id$' || true)"
  if [ -n "$DIRT" ] && [ "$FORCE" != 1 ]; then
    echo "⚠️  hay cambios sin commitear en $WT (no encuentro huerfanos.cjs para afinar). Usa --force para descartarlos."
    exit 1
  fi
fi

# 4. Quitar worktree + rama
# --force siempre: el guard del paso 2+3 ya protegió el trabajo real; aquí solo quedan
# artefactos ignorados/.session-id que git-worktree-remove bloquearía sin motivo.
echo "→ quitando worktree y rama…"
rm -f "$WT/.session-id"
git -C "$MAIN_REPO" worktree remove --force "$WT"
git -C "$MAIN_REPO" worktree prune
git -C "$MAIN_REPO" branch -D "$BRANCH" 2>/dev/null || true

# 5. Parar Postgres local si lo había
if command -v podman >/dev/null && podman container exists "$CONTAINER" 2>/dev/null; then
  echo "→ parando Postgres local $CONTAINER…"; podman rm -f "$CONTAINER" >/dev/null
fi

# Quitar su señal de vida: si no, el listado acumula sesiones que apuntan a directorios borrados y
# vuelve a ser ruido (T-296). Fail-open, como todo lo de la telemetría.
[ -f "$ESTE_REPO/scripts/sessions/latir.cjs" ] && \
  ( cd "$ESTE_REPO" && node scripts/sessions/latir.cjs --cerrar "$SLUG" >/dev/null 2>&1 ) || true

echo "✅ Sesión '$SLUG' cerrada y limpia."
