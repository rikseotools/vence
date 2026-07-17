#!/usr/bin/env bash
# Cierra una sesión creada con new-session.sh: libera sus claims, avisa de commits sin
# llevar a origin/main, quita el worktree + la rama, para el Postgres local si lo había.
#
# Uso: scripts/sessions/end-session.sh <slug> [--force]
#   --force  quita el worktree aunque tenga cambios sin commitear (se PIERDEN)
set -euo pipefail

SLUG="${1:-}"
[ -n "$SLUG" ] || { echo "Uso: end-session.sh <slug> [--force]"; exit 2; }
FORCE=0; [ "${2:-}" = "--force" ] && FORCE=1

GIT_COMMON="$(git rev-parse --git-common-dir 2>/dev/null)" || { echo "❌ no estás en un repo git"; exit 2; }
MAIN_REPO="$(cd "$(dirname "$GIT_COMMON")" && pwd)"
SESSIONS_DIR="${VENCE_SESSIONS_DIR:-$HOME/vence-sessions}"
WT="$SESSIONS_DIR/$SLUG"
BRANCH="sesion/$SLUG"
CONTAINER="vence-sess-$SLUG"

[ -d "$WT" ] || { echo "❌ no existe la sesión $WT"; exit 2; }

# 1. Liberar claims de esta sesión (si hay cola.cjs y session-id)
if [ -f "$WT/.session-id" ] && [ -f "$WT/scripts/impugnaciones/cola.cjs" ]; then
  SID="$(cat "$WT/.session-id")"
  echo "→ liberando claims del sid $SID…"
  ( cd "$WT" && node scripts/impugnaciones/cola.cjs release-all --sid "$SID" ) 2>/dev/null || echo "  (sin claims o cola.cjs no lo soporta; se ignora)"
fi

# 2. Avisar de commits en la rama que NO están en origin/main
AHEAD="$(git -C "$MAIN_REPO" rev-list --count "origin/main..$BRANCH" 2>/dev/null || echo 0)"
if [ "$AHEAD" -gt 0 ]; then
  echo ""
  echo "⚠️  la rama $BRANCH tiene $AHEAD commit(s) que NO están en origin/main:"
  git -C "$MAIN_REPO" log --oneline "origin/main..$BRANCH" | sed 's/^/     /'
  echo "   Llévalos a origin/main ANTES de cerrar (cherry-pick sobre un worktree limpio, ver runbook de pusheo)."
  if [ "$FORCE" != 1 ]; then
    echo "   Aborto para no perderlos. Usa --force si de verdad quieres descartar la rama."
    exit 1
  fi
fi

# 3. Cambios sin commitear (ignorando el artefacto .session-id de la propia sesión)
DIRT="$(git -C "$WT" status --porcelain 2>/dev/null | grep -vE '^\?\? \.session-id$' || true)"
if [ -n "$DIRT" ] && [ "$FORCE" != 1 ]; then
  echo "⚠️  hay cambios sin commitear en $WT. Commitéalos o usa --force para descartarlos."
  echo "$DIRT" | sed 's/^/     /'
  exit 1
fi

# 4. Quitar worktree + rama
# --force siempre: el guard del paso 3 ya protegió el trabajo real; aquí solo quedan
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

echo "✅ Sesión '$SLUG' cerrada y limpia."
