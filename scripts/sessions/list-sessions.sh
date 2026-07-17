#!/usr/bin/env bash
# Lista las sesiones de trabajo vivas (worktrees bajo VENCE_SESSIONS_DIR), con su rama,
# session-id, commits pendientes de llevar a origin/main y si tienen Postgres local.
# Fuente de verdad: `git worktree list` (no hay registry aparte que driftee).
#
# Uso: scripts/sessions/list-sessions.sh
set -euo pipefail

GIT_COMMON="$(git rev-parse --git-common-dir 2>/dev/null)" || { echo "❌ no estás en un repo git"; exit 2; }
MAIN_REPO="$(cd "$(dirname "$GIT_COMMON")" && pwd)"
SESSIONS_DIR="${VENCE_SESSIONS_DIR:-$HOME/vence-sessions}"

git -C "$MAIN_REPO" fetch origin --quiet 2>/dev/null || true

found=0
while IFS= read -r line; do
  case "$line" in worktree\ *) WT="${line#worktree }" ;; branch\ *) BR="${line#branch refs/heads/}" ;; "")
    # fin de un bloque
    case "${WT:-}" in
      "$SESSIONS_DIR"/*)
        found=1
        SLUG="$(basename "$WT")"
        SID="$( [ -f "$WT/.session-id" ] && cat "$WT/.session-id" || echo '—')"
        AHEAD="$(git -C "$MAIN_REPO" rev-list --count "origin/main..${BR:-HEAD}" 2>/dev/null || echo '?')"
        DIRTY="$( [ -n "$(git -C "$WT" status --porcelain 2>/dev/null)" ] && echo 'sucio' || echo 'limpio')"
        DB="prod"
        command -v podman >/dev/null && podman container exists "vence-sess-$SLUG" 2>/dev/null && DB="local(podman)"
        printf '  %-22s rama:%-26s sid:%-18s ahead:%-3s %s  db:%s\n' "$SLUG" "${BR:-?}" "$SID" "$AHEAD" "$DIRTY" "$DB"
        ;;
    esac
    WT=""; BR=""
    ;;
  esac
done < <(git -C "$MAIN_REPO" worktree list --porcelain; echo "")

[ "$found" = 1 ] || echo "  (no hay sesiones activas bajo $SESSIONS_DIR)"
