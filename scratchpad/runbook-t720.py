import pathlib

ANCLA = "## Mergear una rama CORTADA ANTES de [T-532] (una ficha = un fichero)"

NUEVO = """### ⚖️ Y las YA REVISADAS se reparten en dos, porque no piden lo mismo (T-720, 08/08)

`reviewed_at` se pone y **no se quita nunca**, así que una tarea mergeada al minuto siguiente
seguía saliendo como «falta que decidas» para siempre. Medido el 08/08 al vaciar la cola: **de 36
con veredicto, 29 ya estaban en `main`**. Una lista en la que 4 de cada 5 son fantasmas se deja de
mirar — y con ella se pierden las que sí piden un merge.

Ahora `list` separa:

- **📦 ya SIN RAMA PENDIENTE** — ninguna rama sin fusionar declara esa tarea, así que su trabajo
  parece estar dentro. Se cierran con `done` (o `pause` si falta verificarlas en producción).
- **⬇️ las que de verdad piden mirar el merge** — hay rama con contenido que `main` no tiene.

**No se estrenó columna ni comando: el dato es COMPROBABLE, así que se observa.** Se apoya en
`indiceDeRamas()` ([T-629]), que pregunta *«¿qué ramas traen contenido que `main` no tiene?»* **por
ÁRBOL, no por sha ni por nombre de rama** — lo único que sobrevive a un cherry-pick o a un rebase.
El reparto es puro (`repartirRevisadas` en `lib/backlog/revision.cjs`, 7 tests) y delega el
criterio en `claseDeEspera`, que ya existía: no hay una segunda regla que pueda divergir.

⚠️ **La asimetría es deliberada y no se toca:** si no se puede leer git, la tarea **NO** se da por
integrada. Un falso «pendiente» cuesta una mirada; un falso «ya está en main» cierra algo cuyo
código no está vivo. Igual que una devuelta con `problemas`, que nunca cae en el montón de
integradas por muchas ramas que le falten: lo que pide no es un merge, es que alguien lea el
veredicto.

Cuesta ~3 s y **solo se paga si hay revisadas**.

"""

p = pathlib.Path('/home/manuel/vence-sessions/movil3/docs/runbooks/tareas-pendientes.md')
s = p.read_text()
assert ANCLA in s, 'ancla no encontrada'
p.write_text(s.replace(ANCLA, NUEVO + ANCLA, 1))
print('runbook actualizado')
