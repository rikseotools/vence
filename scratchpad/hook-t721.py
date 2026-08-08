import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/.husky/pre-commit')
s = p.read_text()

ANCLA = """node scripts/check-sintaxis-staged.cjs
if [ $? -ne 0 ]; then
  echo "❌ Commit cancelado por error de sintaxis (ver arriba)."
  exit 1
fi
"""

NUEVO = ANCLA + """
# 1a-bis. El índice del backlog no puede llevar texto que ninguna ficha produce (T-721). Va aquí,
#     junto a lo barato, porque lo que evita también se pierde EN SILENCIO: desde T-532 la fuente
#     son los ficheros de docs/roadmap/tareas/ y el índice se GENERA, pero 100 de las 129 ramas
#     vivas son anteriores a ese cambio y editan el índice. Al mergearlas —a veces SIN conflicto,
#     que es el caso traicionero— su texto entra en un fichero generado y la siguiente
#     regeneración lo borra. `indiceEstaAlDia()` ya lo cazaba, pero solo en CI: tarde, y sin decir
#     qué hacer. Esto lo adelanta al momento en que aún se puede rescatar, y lo explica.
node scripts/backlog/indice-huerfano-guard.cjs
if [ $? -ne 0 ]; then
  echo "❌ Commit cancelado: se perdería texto del backlog (ver arriba)."
  exit 1
fi
"""

assert ANCLA in s, 'ancla no encontrada en el hook'
p.write_text(s.replace(ANCLA, NUEVO, 1))
print('hook ampliado')
