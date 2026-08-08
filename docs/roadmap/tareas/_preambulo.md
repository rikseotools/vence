# 📋 Tareas pendientes (backlog general, sin fecha)

> ### 🧩 Este fichero es UNA PIEZA de un sistema, no un documento suelto
>
> El reparto entre 2-10 sesiones (claim con lease, latido, huella de ficheros, índice no
> compartido, árbol de deploy propio, rescate de sesiones muertas) está **diseñado como un**
> **conjunto**, y su manual completo —principios, componentes, modos de fallo y cómo portarlo—
> es **[`docs/runbooks/sistema-sesiones-paralelas.md`](../runbooks/sistema-sesiones-paralelas.md)**.
>
> - **Cómo se OPERA el backlog** (coger, pausar, cerrar) → [`docs/runbooks/tareas-pendientes.md`](../runbooks/tareas-pendientes.md)
> - **POR QUÉ es así**, y qué pasa si tocas una pieza → el manual del sistema
>
> Si vas a cambiar cómo funciona el reparto, **lee el manual antes**: cada guardarraíl que hay
> aquí nació de un fallo medido, y varios se sostienen entre sí.

> **Fuente única de las tareas que Manuel aparca para "luego".** Es el sitio canónico del backlog
> **sin fecha** (para tareas **con fecha** → memoria `agenda_tareas_programadas`).
>
> ## 🔒 ANTES de trabajar una tarea: CÓGELA
>
> Con varias sesiones a la vez **este fichero NO reparte**: el reparto lo lleva la tabla
> `backlog_tasks` (RDS), unida a estas fichas por el **id `T-xxx`** de cada cabecera. Un markdown
> no admite claim atómico — dos sesiones leen "libre", ambas escriben, gana la última.
>
> ```bash
> node scripts/backlog.cjs list           # qué hay y quién tiene qué
> node scripts/backlog.cjs next           # sugiere la siguiente por prioridad
> node scripts/backlog.cjs claim T-042    # CÓGELA antes de tocar nada
> node scripts/backlog.cjs done T-042 --outcome "…"   # + mueve la ficha a "## Hechas

