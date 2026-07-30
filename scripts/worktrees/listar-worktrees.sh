#!/usr/bin/env bash
# Lista las sesiones de trabajo vivas (worktrees bajo VENCE_SESSIONS_DIR), con su rama,
# session-id, commits pendientes de llevar a origin/main y si tienen Postgres local.
# Fuente de verdad: `git worktree list` (no hay registry aparte que driftee).
#
# Uso: scripts/worktrees/listar-worktrees.sh
set -euo pipefail

GIT_COMMON="$(git rev-parse --git-common-dir 2>/dev/null)" || { echo "❌ no estás en un repo git"; exit 2; }
MAIN_REPO="$(cd "$(dirname "$GIT_COMMON")" && pwd)"
SESSIONS_DIR="${VENCE_SESSIONS_DIR:-$HOME/vence-sessions}"
# Repo de ESTE script, que NO es necesariamente el principal: las herramientas de sesión pueden
# existir solo en el worktree desde el que se invoca (el árbol principal suele ir por detrás). Usar
# MAIN_REPO aquí daba "sin señal" en una sesión que estaba latiendo.
ESTE_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

git -C "$MAIN_REPO" fetch origin --quiet 2>/dev/null || true

# Señal de vida por slug (T-296): `slug<TAB>estado<TAB>antigüedad<TAB>borrable|en-uso<TAB>procesos`.
# Sin esto el listado enseñaba rama, sid y si está sucio — nada que dijera si alguien la usa AHORA,
# y la limpieza acababa en conjeturas. Fail-open: sin BD, la columna sale vacía y lo demás funciona.
SENALES="$(node "$ESTE_REPO/scripts/sessions/latidos.cjs" --tsv 2>/dev/null || true)"
senal_de() { printf '%s\n' "$SENALES" | awk -F'\t' -v s="$1" '$1==s {print $2" ("$3")"; found=1} END{if(!found) print "sin señal"}' | head -1; }

found=0
SLUGS=""
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
        printf '  %-22s rama:%-26s ahead:%-3s %-6s db:%-14s %s\n' "$SLUG" "${BR:-?}" "$AHEAD" "$DIRTY" "$DB" "$(senal_de "$SLUG")"
        SLUGS="$SLUGS $SLUG"
        ;;
    esac
    WT=""; BR=""
    ;;
  esac
done < <(git -C "$MAIN_REPO" worktree list --porcelain; echo "")

[ "$found" = 1 ] || echo "  (no hay sesiones activas bajo $SESSIONS_DIR)"

# Nombres casi idénticos: `sesion-0729-b` (viva) y `sesion-0729b` (muerta) convivieron el 30/07, y
# equivocarse al cerrar borra el trabajo de la otra. El listado es el sitio donde se ve.
if [ -n "$SLUGS" ]; then
  node -e '
    const { nombresCasiIdenticos } = require(process.argv[1] + "/lib/sessions/latido.js");
    const pares = nombresCasiIdenticos(process.argv[2].trim().split(/\s+/).filter(Boolean));
    if (pares.length) {
      console.log("\n  ⚠️  nombres casi idénticos — cuidado al cerrar:");
      for (const [a, b] of pares) console.log("      " + a + "  ↔  " + b);
    }
  ' "$ESTE_REPO" "$SLUGS" 2>/dev/null || true
fi

echo ""
echo "  Señal: 🟢 viva (<15 min) · 🟡 reciente (<2 h) · 🟠 dormida (<24 h) · ⚪ sin señales (24 h+)"
echo "  Detalle y candidatas a cerrar:  node scripts/sessions/latidos.cjs"
