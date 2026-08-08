#!/usr/bin/env bash
# Trae un commit ya revisado. Resuelve el choque del backlog conservando los dos lados;
# si el choque es de CÓDIGO, para. Si el resultado queda vacío, es que ya estaba en main.
set -u
BACKLOG=docs/roadmap/tareas-pendientes.md
SHA="$1"
ID="$2"

if git cherry-pick -x "$SHA" >/tmp/cp-out.log 2>&1; then
  echo "✅ $ID $SHA traído"
  exit 0
fi

CONF=$(git diff --name-only --diff-filter=U)
if [ -n "$CONF" ] && [ "$CONF" != "$BACKLOG" ]; then
  echo "🛑 $ID $SHA: choque en CÓDIGO -> $CONF"
  exit 2
fi

if [ -n "$CONF" ]; then
  python3 - "$BACKLOG" <<'PY'
import sys
p = sys.argv[1]
ls = open(p).read().split('\n')
fuera = [i for i, l in enumerate(ls) if l.startswith(('<<<<<<<', '=======', '>>>>>>>'))]
open(p, 'w').write('\n'.join(l for i, l in enumerate(ls) if i not in fuera))
PY
  git add "$BACKLOG"
fi

if git -c core.editor=true cherry-pick --continue >/tmp/cp-cont.log 2>&1; then
  echo "✅ $ID $SHA traído (choque de backlog resuelto conservando ambos lados)"
  exit 0
fi

if grep -q "nada agregado al commit\|nothing to commit" /tmp/cp-cont.log; then
  git cherry-pick --skip >/dev/null 2>&1
  echo "⏭️  $ID $SHA: su contenido YA estaba en main (cherry-pick vacío) -> solo falta CERRARLA"
  exit 0
fi

echo "🛑 $ID $SHA: no se pudo continuar"
tail -5 /tmp/cp-cont.log
exit 3
