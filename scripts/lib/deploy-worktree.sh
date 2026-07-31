#!/usr/bin/env bash
# scripts/lib/deploy-worktree.sh — construir desde un árbol PROPIO, no del de nadie. (T-385)
#
# ── EL PROBLEMA QUE RESUELVE ─────────────────────────────────────────────────────────────────
# Hasta el 31/07 los scripts de deploy hacían `git reset --hard origin/main` **en el árbol desde
# el que se ejecutaban** y construían con `podman build … ./backend` desde ese mismo árbol. O sea:
# el deploy necesitaba que un recurso COMPARTIDO estuviera quieto y limpio. Con 2-10 sesiones eso
# no se puede garantizar, y se pagó caro — todo el mismo día:
#
#   · un guard nuevo (T-364) para prohibir desplegar desde un worktree de sesión, porque el
#     `reset --hard` le movía el HEAD a quien lo lanzaba;
#   · el lanzador bloqueado por el scratch SIN TRACKEAR de otras sesiones (T-366);
#   · un lanzador de backend muerto tras 20 vueltas sin llegar a desplegar;
#   · y un push que necesitó SIETE intentos esperando a que soltaran el árbol.
#
# Ninguno de esos es un fallo de código: son el precio de construir sobre un directorio ajeno.
#
# ── LO QUE HACE ──────────────────────────────────────────────────────────────────────────────
# Crea un worktree EFÍMERO y DETACHED en el commit exacto que se va a desplegar, fuera de todo
# árbol de trabajo. El build sale de ahí. Nadie puede ensuciarlo mientras se construye, y el
# deploy deja de tocar el HEAD, el índice o los ficheros de ninguna sesión.
#
# Es además un invariante MÁS FUERTE, no más laxo: antes se construía «el working tree, que
# esperamos que coincida con origin/main»; ahora se construye **exactamente el commit cuyo CI se
# verificó**. Eso es lo que todo el mundo creía que pasaba ya.
#
# ── POR QUÉ FUNCIONA SIN `node_modules` NI `.env.local` (probado, no razonado) ────────────────
# Un worktree nuevo NO trae ficheros gitignorados. Se comprobó de verdad el 31/07 creando uno
# pelado y construyendo la imagen del backend desde él: `podman build` termina con éxito, porque
# el Dockerfile solo copia ficheros TRACKEADOS y resuelve las dependencias DENTRO de la imagen.
# Lo único que hay que sacar del checkout original es el `GITHUB_PAT` del gate de CI — y por eso
# el `.env.local` se carga ANTES de cambiar de árbol.
#
# Uso:
#   . "$(dirname "$0")/lib/deploy-worktree.sh"
#   BUILD_DIR="$(crear_arbol_de_build "$FULL_SHA")"   # imprime la ruta
#   podman build … "$BUILD_DIR/backend"
#   borrar_arbol_de_build                             # o desde tu trap de salida

# Ruta del árbol efímero en curso (vacía si no hay). La usa `borrar_arbol_de_build`.
VENCE_BUILD_WT=""

# Crea el worktree efímero en <sha> y escribe su ruta por stdout.
# No registra ningún `trap`: quien llama puede tener el suyo, y en bash un segundo `trap … EXIT`
# REEMPLAZA al primero en silencio. Que la limpieza la componga el script, que es quien sabe qué
# más tiene que cerrar.
crear_arbol_de_build() {
  local sha="$1"
  [ -n "$sha" ] || { echo "crear_arbol_de_build: falta el sha" >&2; return 2; }
  local dir
  dir="$(mktemp -d "${TMPDIR:-/tmp}/vence-build-XXXXXX")"
  # --detach: sin rama, así que no compite por ningún nombre con las ramas de sesión.
  # --force: el mismo commit puede estar ya checkouteado en otro worktree (lo normal: origin/main
  #          suele coincidir con el HEAD de alguien) y sin esto git se niega.
  if ! git worktree add --detach --force "$dir" "$sha" >/dev/null 2>&1; then
    echo "❌ no pude crear el árbol de build en $dir para $sha" >&2
    rmdir "$dir" 2>/dev/null || true
    return 1
  fi
  VENCE_BUILD_WT="$dir"
  echo "$dir"
}

# Borra el árbol efímero. Idempotente y silenciosa: la llama un `trap`, así que no puede fallar
# ni ensuciar la salida de un deploy que ya terminó bien.
#
# ⚠️ RECIBE LA RUTA POR ARGUMENTO, y esto NO es opcional. `crear_arbol_de_build` se invoca por
# SUSTITUCIÓN DE COMANDOS —`BUILD_DIR="$(crear_arbol_de_build "$SHA")"`— que corre en un
# **subshell**: el `VENCE_BUILD_WT` que asigna ahí muere con él y el padre nunca lo ve. La primera
# versión confiaba solo en esa global, así que la limpieza encontraba la variable vacía, salía
# con 0 sin borrar nada y el `|| true` se tragaba el silencio. Detectado probándolo de verdad:
# dos árboles de build quedaron registrados en `git worktree list` y en /tmp después de haber
# «limpiado». En un deploy real habría dejado un worktree y un directorio colgados CADA VEZ.
# La global se conserva solo como respaldo para quien la llame dentro del mismo shell.
borrar_arbol_de_build() {
  local dir="${1:-$VENCE_BUILD_WT}"
  [ -n "$dir" ] || return 0
  git worktree remove --force "$dir" >/dev/null 2>&1 || rm -rf "$dir" 2>/dev/null || true
  # `prune` limpia el registro si el directorio se fue por otro camino: sin esto, un build
  # interrumpido dejaría entradas fantasma en `git worktree list` acumulándose para siempre.
  git worktree prune >/dev/null 2>&1 || true
  [ "$dir" = "$VENCE_BUILD_WT" ] && VENCE_BUILD_WT=""
  return 0
}
