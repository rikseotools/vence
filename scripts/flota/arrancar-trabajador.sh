#!/usr/bin/env bash
# Convierte una máquina Linux pelada en un TRABAJADOR de la flota, sincronizado con las sesiones
# del portátil, y lo deja arrancando SOLO tras un reinicio. (T-486 / T-539)
#
# ── QUÉ RESUELVE ─────────────────────────────────────────────────────────────────────────────
# Las sesiones de este repo se reparten el trabajo por BASE DE DATOS, no por estar en la misma
# máquina: el claim con lease, el latido, el embudo de preguntas y las entregas viven en RDS. Una
# sesión en un servidor participa del MISMO reparto sin sincronizar nada — pero solo si arranca
# bien puesta, y "bien puesta" son cosas que a mano se olvidan.
#
# Idempotente: se puede volver a correr sin romper nada ni pisar trabajo en curso.
#
# ── LAS DOS CREDENCIALES, Y POR QUÉ SON ESAS ────────────────────────────────────────────────
#  1. **El token de Claude Code.** Se acuña con `claude setup-token` (dura UN AÑO) en una máquina
#     CON navegador y viaja en la variable de su cuenta. NO se copia `~/.claude/.credentials.json`:
#     ese camino no está soportado y se rompe en silencio al caducar.
#     ⚠️ La documentación avisa de que **`--bare` NO lee `CLAUDE_CODE_OAUTH_TOKEN`**. Por eso aquí
#     se arranca `claude` normal y no en modo bare, aunque bare sea lo que recomiendan para CI.
#  2. **La credencial de la BD de coordinación.** Un trabajador NO recibe el `.env.local` del
#     portátil: esa es la credencial de la APLICACIÓN y abre `user_profiles`, `questions` y los
#     pagos — en una máquina expuesta a internet. Recibe `vence_coordinacion`, que solo alcanza las
#     4 tablas del reparto.
#
# ── VARIAS CUENTAS DE CLAUDE CODE ───────────────────────────────────────────────────────────
# El registro vive en `lib/flota/cuentas.cjs`, con la misma forma que el multi-cuenta de Stripe:
# **añadir una cuenta = una fila + su variable**. El reparto es DETERMINISTA por nombre, así que
# `w1` cae siempre en la misma cuenta reinicie las veces que reinicie — si fuese rotatorio, el
# consumo por cuenta dejaría de ser comparable consigo mismo y no se podría saber quién saturó cuál.
# Se puede forzar con `--cuenta <nombre>`.
#
# ── POR QUÉ SYSTEMD Y ADEMÁS TMUX ───────────────────────────────────────────────────────────
# tmux solo no sobrevive a un reinicio de la máquina, y una flota que hay que rearrancar a mano
# cada vez que el proveedor reinicia un host no es una flota. systemd la levanta al arrancar; tmux
# la mantiene ATACHABLE, que es lo que permite hablar con ella. Los dos, no uno.
#
# ── USO ──────────────────────────────────────────────────────────────────────────────────────
#   # en el portátil, una vez por CUENTA (necesita navegador):
#   claude setup-token
#
#   # en el VPS:
#   export CLAUDE_CODE_OAUTH_TOKEN='…'                    # cuenta principal
#   export CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA='…'         # (opcional) segunda cuenta
#   export VENCE_COORDINACION_URL='postgres://vence_coordinacion:…@<host-rds>:5432/<base>'
#   ./arrancar-trabajador.sh w1 [--cuenta secundaria]
set -euo pipefail

SLUG="${1:-}"; shift || true
CUENTA_PEDIDA=""
while [ $# -gt 0 ]; do
  case "$1" in
    --cuenta) CUENTA_PEDIDA="${2:-}"; shift 2 ;;
    *) echo "❌ flag desconocido: $1"; exit 2 ;;
  esac
done
[ -n "$SLUG" ] || { echo "Uso: arrancar-trabajador.sh <nombre> [--cuenta <cuenta>]"; exit 2; }
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "❌ nombre inválido: usa kebab-case"; exit 2; }

# ── EL TRABAJADOR NO ES ROOT, Y NO ES UN DETALLE (T-486, 05/08) ─────────────────────────────
# Claude Code se NIEGA a saltarse el diálogo de permisos con privilegios de root, y hace bien: un
# agente autónomo con todo el sistema en la mano es otra cosa. Pero un trabajador autónomo tampoco
# puede quedarse preguntando «¿puedo ejecutar claim?» a una terminal que nadie mira — que es lo
# que pasó en la primera vuelta.
#
# La salida no es forzar el modo, es que el trabajador tenga el privilegio que le corresponde:
# usuario propio, sin sudo, y ahí sí puede trabajar solo. Es la misma idea que el rol de BD de
# cuatro tablas, una capa más abajo.
USUARIO="${VENCE_FLOTA_USER:-flota}"
REPO_URL="${VENCE_REPO_URL:-https://github.com/rikseotools/vence.git}"
CASA="/home/$USUARIO"
BASE="${VENCE_BASE_DIR:-$CASA/vence}"
SESSIONS_DIR="${VENCE_SESSIONS_DIR:-$CASA/vence-sessions}"
WT="$SESSIONS_DIR/$SLUG"
ENV_DIR="/etc/vence-flota"
ENV_FILE="$ENV_DIR/$SLUG.env"
UNIT="/etc/systemd/system/vence-flota@.service"

fallo() { echo ""; echo "❌ $1"; echo ""; exit 1; }

echo "══ TRABAJADOR '$SLUG' ══"

# El usuario del trabajador: sin sudo, con su propia casa. Idempotente.
[ "$(id -u)" -eq 0 ] || fallo "este script se ejecuta como root (crea el usuario y la unidad de systemd)"
if ! id "$USUARIO" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$USUARIO"
  echo "→ usuario '$USUARIO' creado (sin sudo)"
fi

# ── 1. LO QUE TIENE QUE ESTAR ANTES ─────────────────────────────────────────────────────────
for cmd in git node npm tmux systemctl; do
  command -v "$cmd" >/dev/null || fallo "falta '$cmd'. En Debian/Ubuntu: sudo apt install -y $cmd"
done
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || fallo "node $NODE_MAJOR es demasiado viejo: hace falta 22+ (el repo usa --env-file)"

[ -n "${VENCE_COORDINACION_URL:-}" ] || fallo \
  "falta VENCE_COORDINACION_URL (rol vence_coordinacion, NO el .env.local del portátil).
   Procedimiento: docs/runbooks/sistema-sesiones-paralelas.md §6.quater"

# ── 2. CLAUDE CODE ──────────────────────────────────────────────────────────────────────────
command -v claude >/dev/null || { echo "→ instalando Claude Code…"; npm install -g @anthropic-ai/claude-code; }
echo "→ claude $(claude --version 2>/dev/null || echo '?')"

# ── 3. EL REPO ──────────────────────────────────────────────────────────────────────────────
if [ -d "$BASE/.git" ]; then
  echo "→ repo ya está, actualizando origin…"; sudo -u "$USUARIO" git -C "$BASE" fetch origin --quiet
else
  echo "→ clonando el repo en $BASE…"; sudo -u "$USUARIO" git clone --quiet "$REPO_URL" "$BASE"
fi
# Idempotencia real: una pasada anterior pudo dejar ficheros de root en la casa del trabajador.
chown -R "$USUARIO:$USUARIO" "$CASA"
sudo -u "$USUARIO" git -C "$BASE" config user.name  "flota-$SLUG"
sudo -u "$USUARIO" git -C "$BASE" config user.email "flota@vence.es"

echo "→ dependencias…"
sudo -u "$USUARIO" bash -c "cd '$BASE' && npm ci --silent"
[ -d "$BASE/backend" ] && sudo -u "$USUARIO" bash -c "cd '$BASE/backend' && npm ci --silent" || true

# ── 4. QUÉ CUENTA DE CLAUDE CODE LE TOCA ────────────────────────────────────────────────────
# La decisión vive en el núcleo puro (testeado); aquí solo se consulta y se obedece.
RES="$(cd "$BASE" && node -e "
  const C = require('./lib/flota/cuentas.cjs')
  const r = C.resolver(process.argv[1], process.argv[2] || null)
  process.stdout.write(JSON.stringify(r))
" "$SLUG" "$CUENTA_PEDIDA")"
CUENTA="$(printf '%s' "$RES" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).cuenta || ""')"
TOKEN="$(printf '%s' "$RES" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).token || ""')"
PROBLEMA="$(printf '%s' "$RES" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).problema || ""')"
[ -n "$TOKEN" ] || fallo "$PROBLEMA"
echo "→ cuenta de Claude Code: $CUENTA"

# ── 5. SU PROPIO ÁRBOL ──────────────────────────────────────────────────────────────────────
# Con el tooling de siempre: acuña el .session-id estampando la MÁQUINA, así que dos trabajadores
# de servidores distintos no pueden colisionar de identidad ni por casualidad (T-484).
if [ -d "$WT" ]; then
  echo "→ el árbol $WT ya existe, se reutiliza"
else
  sudo -u "$USUARIO" bash -c "cd '$BASE' && VENCE_SESSIONS_DIR='$SESSIONS_DIR' scripts/worktrees/crear-worktree.sh '$SLUG'" >/dev/null
  echo "→ árbol propio en $WT"
fi
# La coordinación va donde el andamiaje la busca, y SOLO ella: ni pagos ni AUTH_SECRET.
umask 077
printf 'DATABASE_URL=%s\n' "$VENCE_COORDINACION_URL" > "$WT/.env.local"
chown "$USUARIO:$USUARIO" "$WT/.env.local"

# ── 6. LA CREDENCIAL, PERSISTIDA UNA SOLA VEZ ───────────────────────────────────────────────
# Fichero de entorno con permisos 0600 que lee systemd. Es lo que hace que el token se pida UNA
# vez: sobrevive a reinicios, a que se caiga el SSH y a que se cierre la terminal.
mkdir -p "$ENV_DIR"; chmod 700 "$ENV_DIR"
umask 077
cat > "$ENV_FILE" <<ENVF
# Trabajador '$SLUG' de la flota de Vence. Generado por arrancar-trabajador.sh — NO editar a mano.
# El token dura un año (claude setup-token). Cuenta: $CUENTA
CLAUDE_CODE_OAUTH_TOKEN=$TOKEN
VENCE_FLOTA_CUENTA=$CUENTA
VENCE_SESSION_ROLE=trabajador
VENCE_SESSION_HOME=$WT
VENCE_SESSION_HOST=${VENCE_SESSION_HOST:-$(hostname -s)}
DATABASE_URL=$VENCE_COORDINACION_URL
ENVF
chown "$USUARIO:$USUARIO" "$ENV_FILE"
chmod 600 "$ENV_FILE"
chown -R "$USUARIO:$USUARIO" "$CASA" 2>/dev/null || true
echo "→ credencial persistida en $ENV_FILE (0600): no se vuelve a pedir"

# ── 7. LA UNIDAD DE SYSTEMD (una plantilla para todos los trabajadores) ─────────────────────
cat > "$UNIT" <<'UNITF'
[Unit]
Description=Trabajador %i de la flota de Vence (Claude Code en tmux)
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
# Sin privilegios: Claude Code se niega a trabajar solo si es root, y con razón.
User=flota
Group=flota
# El token y el resto del entorno viven aquí, con permisos 0600. Nunca en la línea de órdenes:
# lo que va en ExecStart es visible en `ps` para cualquier usuario de la máquina.
EnvironmentFile=/etc/vence-flota/%i.env
# La sesión tmux queda con una SHELL, no con el TUI de Claude Code (T-486, 05/08).
#
# Medido: `CLAUDE_CODE_OAUTH_TOKEN` autentica `claude -p` pero **el TUI interactivo lo ignora** y
# se queda en «Select login method» — coherente con la documentación, que lo presenta para CI y
# scripts. Con el TUI, el trabajador latía y parecía vivo sin poder hacer nada.
#
# Así que el trabajo se lanza como `claude -p` desde `flota.cjs encargar`, dentro de esta shell:
# el token sirve, la salida queda visible al atachar, y tmux la mantiene viva aunque se caiga el
# SSH. systemd levanta la shell tras un reinicio.
ExecStart=/usr/bin/tmux new-session -d -s %i -c ${VENCE_SESSION_HOME} /bin/bash
ExecStop=/usr/bin/tmux kill-session -t %i
RemainAfterExit=yes
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
UNITF
systemctl daemon-reload
echo "→ unidad systemd instalada (vence-flota@$SLUG)"

# ── 8. EL GATE: si no puede participar del reparto, NO arranca ──────────────────────────────
echo ""
echo "→ comprobando que puede participar del reparto…"
if ! sudo -u "$USUARIO" bash -c "cd '$WT' && set -a && . '$ENV_FILE' && set +a && npm run --silent sesion:preflight"; then
  fallo "el preflight dice que este trabajador no está listo (ver arriba).
   No se arranca: un trabajador invisible reclamaría tareas que nadie puede ver ni recuperar."
fi

# ── 8.bis. ¿PUEDE DE VERDAD TRABAJAR? ───────────────────────────────────────────────────────
# El preflight de arriba comprueba el REPARTO (identidad, BD, latido). No comprueba Claude Code:
# es node hablando con Postgres, y eso funciona igual con la sesión atascada en la pantalla de
# login. Medido el 05/08 en el primer arranque real: dos trabajadores 🟢 en el panel, latiendo,
# con preflight verde y NINGUNO autenticado. Veinte minutos sin poder hacer nada y el sistema
# entero diciendo que todo iba bien.
echo "→ comprobando que Claude Code puede responder…"
SONDA_SALIDA="$(sudo -u "$USUARIO" bash -c "set -a; . '$ENV_FILE'; set +a; timeout 90 claude -p 'responde solo: ok' 2>&1" || true)"
SONDA_ESTADO="$(cd "$BASE" && node -e "
  const A = require('./lib/flota/autenticacion.cjs')
  const v = A.clasificar(process.argv[1], /\bok\b/i.test(process.argv[1]) ? 0 : 1)
  process.stdout.write(v.estado + '\t' + (A.diagnostico('$SLUG', v) || ''))
" "$SONDA_SALIDA")"
ESTADO="${SONDA_ESTADO%%$'\t'*}"; DIAG="${SONDA_ESTADO#*$'\t'}"
if [ "$ESTADO" != "autenticado" ]; then
  fallo "este trabajador NO puede trabajar:
   $DIAG

   Está instalado y latiría, pero ocuparía sitio en el reparto sin poder hacer nada.
   Arréglalo y vuelve a correr este script — es idempotente."
fi
echo "   ✅ autenticado y respondiendo"

# ── 9. ARRANQUE ─────────────────────────────────────────────────────────────────────────────
if sudo -u "$USUARIO" tmux has-session -t "$SLUG" 2>/dev/null; then
  echo "→ ya había una sesión tmux '$SLUG': se conserva (no se pisa el trabajo en curso)"
  systemctl enable "vence-flota@$SLUG" >/dev/null 2>&1 || true
else
  systemctl enable --now "vence-flota@$SLUG"
  echo "→ arrancado y habilitado para el próximo reinicio"
fi

cat <<FIN

✅ trabajador '$SLUG' en marcha
   árbol:   $WT
   cuenta:  $CUENTA
   máquina: $(hostname -s)
   rol:     trabajador (sus guardarraíles fallan CERRADOS)

   hablar con él:            tmux attach -t $SLUG      (soltar sin matarlo: Ctrl-b d)
   pararlo / arrancarlo:     systemctl stop|start vence-flota@$SLUG
   verlo desde el portátil:  npm run parte
   lo que te pregunte:       node scripts/backlog.cjs preguntas
   lo que te entregue:       sale bajo 🙋 en 'backlog list'
FIN
