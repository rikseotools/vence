#!/usr/bin/env bash
# Nombre ANTIGUO de `borrar-worktree.sh`. Se conserva porque estaba en manuales y en la
# memoria de varias sesiones, y teclearlo de memoria no debe fallar.
#
# Se renombró el 29/07/2026: «end-session» suena a «he terminado de trabajar» —lo que uno
# dice al acabar el día— cuando en realidad BORRA la copia de trabajo, y con --force
# también los cambios sin commitear. Un script destructivo no puede llamarse como algo
# inofensivo.
echo "⚠️  'end-session.sh' se llama ahora 'borrar-worktree.sh' (BORRA el worktree, no solo cierra la sesión)."
echo "    Ejecutando: scripts/sessions/borrar-worktree.sh $*"
echo
exec "$(dirname "$0")/borrar-worktree.sh" "$@"
