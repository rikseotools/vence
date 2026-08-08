### [T-690] 🟠 [ABIERTO 08/08] Triar los tests de integración que salen rojos ahora que por fin se ejecutan

**Esto NO es una regresión: es lo que estaba tapado.** [T-370] (cerrada el 07/08) arregló que el
gate de integración/perf/seguridad corriera **sin base de datos** — llevaba **492 runs seguidos
desde el 31/07 sin comprobar absolutamente nada**. Desde que apunta al secret correcto, la señal
`ci_integracion_rojo` cambió de causa: ya no dice `sin_base_de_datos`, dice **`tests_en_rojo`**.

**Medido (12 h, tras el arreglo):** 6 runs, **los 6 con `causa=tests_en_rojo`**. Último:
`08-08T00:41`, run `31230533199`. Antes del arreglo, cero runs habían llegado siquiera a ejecutar un
test.

**Por qué hay que ficharlo y no dejarlo correr.** Un rojo permanente en CI se aprende a ignorar en
una semana, y entonces el gate vuelve a no servir para nada — solo que esta vez con la BD conectada,
que es peor porque parece que vigila. Es el mismo final que tuvo estando mudo, por otro camino.

**Lo que se sabe y lo que NO:**
- La ficha del job dice que hay **~10 fallos conocidos** (bugs de datos + flaky) y por eso el job
  lleva `continue-on-error: true` a nivel de JOB. **Ese número viene del comentario del workflow,
  no de una medición reciente** — no lo he verificado: durante 492 runs no se pudo.
- **No sé cuáles son.** Hay que abrir un run, listar las suites rojas y separar tres cosas que no se
  arreglan igual: bug de DATOS (una fila mal en RDS), test FLAKY (depende de orden o de reloj) y
  test que descubre un bug REAL de código.

**Primer paso concreto:** abrir el run más reciente (`31230533199`), sacar la lista de suites en
rojo, y clasificarlas. Solo con eso ya se puede decidir qué se arregla, qué se marca como conocido
con su porqué, y qué se borra por no medir nada.

**Y la meta, que es la que da sentido a la tarea:** cuando la lista llegue a cero, **quitar el
`continue-on-error: true` del job** — ese flag existe precisamente porque hay fallos conocidos, y
mientras esté, el gate no bloquea nada. El propio workflow lo dice: *«No bloquea merges hoy: hay 10
fallos conocidos que se irán arreglando uno a uno. Cuando llegue a 0, quitar este flag.»*

**Relacionadas:** [T-370] (la causa, cerrada), [T-644] (las 9 suites que ESCRIBEN y siguen sin
ejecutarse nunca por `INTEGRATION_DB_WRITABLE`: aunque este triaje quede en verde, esas seguirían
mudas — no confundir un verde con cobertura).
