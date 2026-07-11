#!/usr/bin/env bash
# scripts/session-start.sh — Bootstrap de una sesión de Claude Code AISLADA.
#
# POR QUÉ: varias sesiones de Claude en el MISMO repo se pisan si comparten el
# checkout (editan los mismos ficheros, un `git add -A` barre lo de otra, un deploy
# desde una rama stale revierte main). La coordinación NO debe recaer en el humano.
# Este script deja a cada sesión en su PROPIO worktree desde origin/main, con los
# recursos no versionados enlazados, y registra quién trabaja en qué.
#
# Uso:   scripts/session-start.sh [nombre-corto-feature]
# Luego: cd al worktree que imprime y trabaja SOLO ahí.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-sesion-$(date +%m%d-%H%M%S)}"
SLUG=$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-' | cut -c1-40)
WT=".claude/worktrees/$SLUG"
BRANCH="work/$SLUG"
REG=/tmp/vence-sessions.tsv           # registro LOCAL por-máquina (ephemeral, no versionado)
LOCK=/tmp/vence-deploy.lock

echo "→ fetch origin/main"
git fetch origin main --quiet

if [ -d "$WT" ]; then
  echo "⚠️  worktree $WT ya existe — lo reutilizo."
else
  # Rama nueva desde origin/main = SIEMPRE parte de la última verdad (no de una rama stale).
  git worktree add -b "$BRANCH" "$WT" origin/main
fi

# Symlinks a recursos NO versionados (el build/tests los necesitan; `worktree add` no los copia).
for link in node_modules .env.local backend/node_modules; do
  tgt="$(pwd)/$link"
  if [ -e "$tgt" ] && [ ! -e "$WT/$link" ]; then ln -s "$tgt" "$WT/$link" && echo "  symlink: $link"; fi
done

# Registro de sesiones (append; informativo — para ver quién trabaja en qué y evitar choques).
printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$SLUG" "$BRANCH" "$WT" >> "$REG"

echo
echo "✅ Sesión aislada lista."
echo "   worktree: $WT   (rama $BRANCH desde origin/main)"
echo "   👉 cd $WT   y trabaja SOLO ahí. NUNCA edites el checkout compartido."
echo
echo "── Sesiones registradas recientemente (posibles sesiones activas) ──"
tail -6 "$REG" 2>/dev/null | sed 's/^/   /' || echo "   (ninguna)"
echo "── Lock de deploy ──"
if command -v flock >/dev/null 2>&1 && flock -n 8 8>"$LOCK" 2>/dev/null; then
  echo "   libre"
else
  echo "   TOMADO por: $(cat "$LOCK" 2>/dev/null || echo '¿?')  (otra sesión está desplegando)"
fi
echo
echo "Para enviar a prod cuando termines:"
echo "   git fetch origin && git rebase origin/main   # reconciliar sobre lo último"
echo "   git push origin HEAD:main                    # main = única verdad"
echo "   scripts/deploy-frontend.sh  /  deploy-backend.sh   # flock serializa solo"
