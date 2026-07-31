#!/usr/bin/env bash
# guardia-worktree.sh — «no despliegues desde donde trabajas». (T-365, 31/07/2026)
#
# Todos los caminos de despliegue MUEVEN el árbol desde el que se ejecutan: el lanzador hace
# `git reset --hard origin/main` en cada vuelta, y los scripts directos auto-resincronizan cuando
# van por detrás. Está bien para su trabajo —despliegan el SHA que verifican— y es un problema si
# ese árbol es donde estás programando: te cambia los ficheros debajo, y en el caso del lanzador te
# deja la rama en el commit que hubiera al hacer el `fetch`.
#
# Caso real (31/07): una sesión lanzó el deploy desde su worktree, siguió trabajando, y a la vuelta
# 4 se encontró la rama atrás y un fichero recién escrito «desaparecido». No se perdió nada porque
# estaba pusheado, pero costó el susto y un rato de investigación.
#
# ## Por qué la comprobación es de GIT y no de rutas
#
# La primera versión miraba `~/vence-sessions/*`… y se le escapaba entero `session-start.sh`, que
# crea los worktrees en `.claude/worktrees/`. Un guardarraíl que depende de dónde puso alguien el
# directorio protege solo la mitad de los casos. En un worktree ENLAZADO, `--git-dir` apunta a
# `…/.git/worktrees/<slug>` y `--git-common-dir` a `…/.git`: son distintos. En el árbol principal
# son el mismo. Eso no se puede esquivar moviendo carpetas.
#
# Uso:  . "$(dirname "$0")/lib/guardia-worktree.sh"; guardia_worktree "lo que este script le hace a tu árbol"
# Escape consciente:  DEPLOY_DESDE_WORKTREE=1

guardia_worktree() {
  local que_hace="${1:-mueve tu árbol de trabajo}"
  local gd gc
  gd="$(git rev-parse --git-dir 2>/dev/null || echo '')"
  gc="$(git rev-parse --git-common-dir 2>/dev/null || echo '')"
  [ -n "$gd" ] || return 0                 # sin git no hay nada que proteger
  [ "$gd" != "$gc" ] || return 0           # árbol principal: adelante

  local principal
  principal="$(cd "$(dirname "$gc")" 2>/dev/null && pwd)"
  echo "⚠️  Estás desplegando DESDE UN WORKTREE, no desde el árbol principal:"
  echo "      $PWD"
  echo "   Este script $que_hace, así que si sigues programando aquí se te moverá el suelo."
  echo "   Despliega desde el repo principal, que no tiene trabajo en curso:"
  echo "      cd ${principal:-<repo-principal>} && $0 $*"
  if [ "${DEPLOY_DESDE_WORKTREE:-}" != "1" ]; then
    echo "   Si de verdad quieres hacerlo aquí:  DEPLOY_DESDE_WORKTREE=1 $0 $*"
    exit 2
  fi
  echo "   (DEPLOY_DESDE_WORKTREE=1 — sigo, pero no edites nada aquí hasta que acabe)"
}
