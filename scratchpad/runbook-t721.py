import pathlib

ANCLA = """2. **Git NO da conflicto** y auto-fusiona. Parece lo bueno y es lo malo: el texto entra en un
   fichero **generado**, así que la siguiente regeneración lo borra. **Pasó en 2 de las 3 ramas
   que se mergearon el 08/08** (T-679 y T-465) — ninguna dio conflicto."""

NUEVO = ANCLA + """

**Desde [T-721] ese caso 2 ya no depende de que alguien se acuerde:** el `pre-commit` lleva
`scripts/backlog/indice-huerfano-guard.cjs`, que compara el índice que vas a commitear contra el
que producen las fichas y **para el commit si trae líneas que ninguna ficha genera** — o sea, justo
lo que se perdería. No dice «esto es sospechoso»: dice cuántas líneas, **de qué ficha son** y a qué
fichero llevarlas.

⚠️ **Y por qué NO avisa de «esta rama es vieja», que es lo primero que uno piensa:** está medido y
sería ruido. «La rama no contiene `main`» salta en el **99%** de las 129 ramas vivas; «`main` tocó
sus ficheros después del veredicto», en el **86%** — y ahí los 6 casos eran **el mismo fichero**, el
índice. Un aviso que salta casi siempre no se lee. Por eso el guard no juzga la situación: detecta
la **pérdida concreta**, que casi nunca existe, y cuando existe hay algo que rescatar de verdad.

**El escape pide motivo** (`INDICE_GUARD_SKIP="por qué"`), como los demás, para que quede escrito
por qué se rehízo el índice a mano."""

p = pathlib.Path('/home/manuel/vence-sessions/movil3/docs/runbooks/tareas-pendientes.md')
s = p.read_text()
assert ANCLA in s, 'ancla no encontrada'
p.write_text(s.replace(ANCLA, NUEVO, 1))
print('runbook actualizado')
