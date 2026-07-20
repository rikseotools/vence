#!/usr/bin/env bash
# Arranca una sesión de trabajo aislada y BIEN montada, para trabajar en paralelo con
# otras sesiones sin pisarse. Impone el buen setup (evita los fallos reales del 17/07):
#   · worktree SIEMPRE desde origin/main recién fetcheado (nunca el main local divergente)
#   · directorio propio fuera del repo (ninguna sesión toca ficheros de otra)
#   · copia .env.local (gitignored, no viaja al worktree)
#   · genera un session-id y lo escribe en .session-id → cola.cjs lo lee solo (claim sin pisarse)
#   · deps por symlink (rápido) o propias con --own-deps
#   · DB compartida (prod RDS) por defecto, o Postgres podman propio con --db local
#
# Uso:  scripts/sessions/new-session.sh <slug> [--db shared|local] [--own-deps]
# Cierre: scripts/sessions/end-session.sh <slug>   ·   Ver: scripts/sessions/list-sessions.sh
set -euo pipefail

SLUG="${1:-}"
[ -n "$SLUG" ] || { echo "Uso: new-session.sh <slug> [--db shared|local] [--own-deps]"; exit 2; }
shift
DB=shared; OWN_DEPS=0
while [ $# -gt 0 ]; do
  case "$1" in
    --db)        DB="${2:-}"; shift 2 ;;
    --own-deps)  OWN_DEPS=1; shift ;;
    *) echo "❌ flag desconocido: $1"; exit 2 ;;
  esac
done
[[ "$DB" == shared || "$DB" == local ]] || { echo "❌ --db debe ser 'shared' o 'local'"; exit 2; }
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "❌ slug inválido: usa kebab-case (a-z 0-9 -)"; exit 2; }

# Repo principal = padre del git-common-dir (funciona desde cualquier worktree)
GIT_COMMON="$(git rev-parse --git-common-dir 2>/dev/null)" || { echo "❌ no estás dentro de un repo git"; exit 2; }
MAIN_REPO="$(cd "$(dirname "$GIT_COMMON")" && pwd)"
SESSIONS_DIR="${VENCE_SESSIONS_DIR:-$HOME/vence-sessions}"
WT="$SESSIONS_DIR/$SLUG"
BRANCH="sesion/$SLUG"

# Guardarraíles
[ -e "$WT" ] && { echo "❌ ya existe $WT — usa otro slug o cierra con end-session.sh $SLUG"; exit 2; }
git -C "$MAIN_REPO" show-ref --verify --quiet "refs/heads/$BRANCH" && { echo "❌ la rama $BRANCH ya existe"; exit 2; }

echo "→ git fetch origin (base fresca)…"
git -C "$MAIN_REPO" fetch origin --quiet

echo "→ creando worktree desde origin/main…"
mkdir -p "$SESSIONS_DIR"
git -C "$MAIN_REPO" worktree add "$WT" -b "$BRANCH" origin/main >/dev/null

# .env.local (config gitignored que no viaja)
if [ -f "$MAIN_REPO/.env.local" ]; then
  cp "$MAIN_REPO/.env.local" "$WT/.env.local"
  echo "→ .env.local copiado"
else
  echo "⚠️  no hay .env.local en el repo principal — cópialo a mano si hace falta"
fi

# node_modules
if [ "$OWN_DEPS" = 1 ]; then
  echo "→ npm ci propio (aislado)…"; ( cd "$WT" && npm ci --silent )
else
  ln -s "$MAIN_REPO/node_modules" "$WT/node_modules"
  echo "→ node_modules por symlink (⚠️ quítalo antes de 'podman build')"
fi

# husky: sin el dir generado `.husky/_` (gitignored) git NO corre NINGÚN hook en el worktree
# — ni pre-commit ni el pre-push que hace ENFORCEMENT del claim del backlog (T-051). El wrapper
# `.husky/_/<hook>` despacha al hook COMMITEADO del propio worktree (`.husky/<hook>`), así que un
# symlink al `_` del repo principal basta y es correcto. Sin esto, una sesión en worktree podría
# pushear trabajo sobre una tarea que no reclamó (justo lo que el guard evita).
if [ -d "$MAIN_REPO/.husky/_" ] && [ ! -e "$WT/.husky/_" ]; then
  ln -s "$MAIN_REPO/.husky/_" "$WT/.husky/_"
  echo "→ .husky/_ por symlink (hooks activos: pre-commit + pre-push claim-guard)"
fi

# session-id (lo lee cola.cjs solo)
SID="$SLUG-$(openssl rand -hex 3 2>/dev/null || printf '%04x%04x' $RANDOM $RANDOM)"
printf '%s\n' "$SID" > "$WT/.session-id"

# DB
DB_DESC="prod RDS (compartida)"
if [ "$DB" = local ]; then
  CONTAINER="vence-sess-$SLUG"
  if ! command -v podman >/dev/null; then echo "❌ --db local requiere podman"; exit 2; fi
  echo "→ levantando Postgres podman propio ($CONTAINER)…"
  podman run -d --name "$CONTAINER" -p 0:5432 \
    -e POSTGRES_PASSWORD=dev -e POSTGRES_USER=postgres -e POSTGRES_DB=vence postgres:17 >/dev/null
  # esperar y leer el puerto mapeado
  for _ in $(seq 1 20); do PGPORT="$(podman port "$CONTAINER" 5432/tcp 2>/dev/null | head -1 | cut -d: -f2)"; [ -n "${PGPORT:-}" ] && break; sleep 0.3; done
  [ -n "${PGPORT:-}" ] || { echo "❌ no se pudo leer el puerto del contenedor"; exit 2; }
  NEWURL="postgres://postgres:dev@localhost:$PGPORT/vence?sslmode=disable"
  if grep -q '^DATABASE_URL=' "$WT/.env.local" 2>/dev/null; then
    # reescribe DATABASE_URL en el .env.local del worktree (sólo esta sesión)
    node -e 'const fs=require("fs"),f=process.argv[1],u=process.argv[2];let s=fs.readFileSync(f,"utf8").replace(/^DATABASE_URL=.*$/m,"DATABASE_URL="+u);fs.writeFileSync(f,s)' "$WT/.env.local" "$NEWURL"
  else
    printf 'DATABASE_URL=%s\n' "$NEWURL" >> "$WT/.env.local"
  fi
  DB_DESC="Postgres podman propio (:$PGPORT) — VACÍO, siémbralo (dump saneado) antes de usar"
fi

BASE_SHA="$(git -C "$MAIN_REPO" rev-parse --short origin/main)"
cat <<EOF

✅ Sesión '$SLUG' lista
   dir:    $WT
   rama:   $BRANCH  (desde origin/main @$BASE_SHA)
   sid:    $SID   (cola.cjs lo coge solo desde .session-id)
   deps:   $([ "$OWN_DEPS" = 1 ] && echo "propias (npm ci)" || echo "symlink al repo")
   db:     $DB_DESC

   → cd $WT
   Al cerrar:  scripts/sessions/end-session.sh $SLUG   (cherry-pick a origin/main + limpia)
EOF
