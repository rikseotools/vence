import pathlib

ANCLA = "  contexto_push_guard: {"

NUEVO = """  indice_huerfano_guard: {
    titulo: 'Impedir que el índice del backlog se lleve texto que ninguna ficha produce',
    ruta: 'scripts/backlog/indice-huerfano-guard.cjs',
    estado: 'vivo',
    notas:
      'Hook `.husky/pre-commit`, junto al guard de sintaxis. Hermano de `contexto_push_guard` con ' +
      'una diferencia que importa: aquel caza que se BORRE una ficha viva; éste caza que entre ' +
      'texto que la regeneración va a borrar. Desde [T-532] la fuente son los ficheros de ' +
      '`docs/roadmap/tareas/` y `tareas-pendientes.md` es un ÍNDICE GENERADO, pero **100 de las 129 ' +
      'ramas vivas con contenido propio son anteriores a ese cambio** (medido 08/08) y editan el ' +
      'índice. Al mergearlas —a veces SIN conflicto, que es el caso traicionero: pasó en 2 de las 3 ' +
      'del 08/08— su texto entra en un fichero generado y ahí muere. `indiceEstaAlDia()` ya lo ' +
      'cazaba pero solo en CI: tarde y sin decir qué hacer; esto lo adelanta y nombra LA FICHA a la ' +
      'que hay que llevar el texto. **El criterio salió de descartar dos**: «la rama no contiene ' +
      'main» salta en el 99% de las ramas vivas y «main tocó sus ficheros tras el veredicto» en el ' +
      '86% —y ahí los 6 casos eran el MISMO fichero, el índice—; por eso no se avisa de una ' +
      'situación sospechosa sino que se detecta la PÉRDIDA concreta, que casi nunca existe. Núcleo ' +
      'puro `lib/backlog/indiceHuerfano.cjs` (11 tests, comprobado por mutación). Fail-open sin el ' +
      'directorio de fichas; escape `INDICE_GUARD_SKIP="por qué"`, que pide MOTIVO como los demás.',
  },
""" + ANCLA

p = pathlib.Path('/home/manuel/vence-sessions/movil3/lib/admin/toolRegistry.ts')
s = p.read_text()
assert ANCLA in s, 'ancla no encontrada'
p.write_text(s.replace(ANCLA, NUEVO, 1))
print('guard registrado')
