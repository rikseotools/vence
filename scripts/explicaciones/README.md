# Herramientas para reescribir explicaciones de preguntas

Salieron de reparar 256 preguntas del cubo de transcripción (T-409, 02-03/08/2026), pero **no son
de esa tarea**: sirven para cualquier reescritura de explicaciones a escala — T-249 (`nota-auditoria`),
T-197, T-424 (apelotonadas), T-207 (citas no literales).

Vivían en `scratchpad/`, que es local y desechable. Se subieron aquí al comprobar que la promesa de
la ficha —«se reescriben en cinco minutos»— había dejado de ser cierta: el gate de citas acumula
tres modos de fallo que costaron encontrar uno a uno.

## El bucle, en orden

El manual canónico es `docs/maintenance/revisar-preguntas-con-agente.md`. Estas herramientas cubren
los pasos que no tenían tooling:

1. **Verificar la clave** contra el artículo (viene en el propio lote; al BOE solo si hay duda).
2. **Escribir** el JSON de la explicación estructurada.
3. **`gate-citas.cjs --pre <lote.json> <dirExp>`** ← paso 5 del manual.
4. **Aplicar** con `scripts/aplicar-explicacion.ts --lote <dir> --apply`.
5. **Purgar caché** (`POST /api/admin/revalidate` con `{"tag":"questions"}`, 4 pasadas: es per-instancia).
6. **`dump-preguntas-vivas.cjs <lote.json> <salida.md>`** y pasárselo a un agente INDEPENDIENTE
   que intente REFUTAR ← paso 7 del manual, **y el lote no se cierra sin él**.

### Por qué el paso 6 no es un trámite

Sobre 16 lotes, la re-verificación independiente encontró defectos en **8**, y ninguno lo veía
ningún gate determinista: todos eran afirmaciones de derecho FALSAS con la forma impecable. Un plazo
de «resolver» confundido con uno de «interponer»; quince días donde eran diez; unos baremos de
indemnización atribuidos a la legislación de tráfico cuando la norma remite a Seguros obligatorios;
un refrendo atribuido al Presidente del Senado que la Constitución reserva al del Congreso.

**Dónde mirar:** las frases que afirman qué hace OTRO órgano, qué dice OTRO apartado, o a qué
corresponde un plazo que no está en el artículo vinculado.

## `gate-citas.cjs` — tres modos de cita cortada, no uno

Una cita puede pasar el criterio de literalidad (`citaNoLiteral`, el de la casa) y aun así estar mal:

| modo | ejemplo | cómo se detecta |
|---|---|---|
| **por el final** | «…en el plazo de diez días» donde la norma dice «diez días **naturales**» | no cierra la frase |
| **por el principio** | «propuestas al empresario…» por «Los trabajadores tendrán derecho a efectuar propuestas al empresario…» | arranca en minúscula |
| **por quedarse en la puerta** | «…adoptará las medidas necesarias con el fin de que:» y la enumeración que prueba la clave queda fuera | acaba en dos puntos con `a)` detrás |

Y un cuarto que no es de recorte sino de honestidad: la cita **cerrada con un punto que no existe en
el artículo**, donde la norma tenía una coma y seguía con una salvedad. Formalmente cerrada,
materialmente cortada.

> **La lección general, que vale para cualquier gate:** comprobar la FORMA del recorte no dice nada
> si esa forma la produce el propio recortador. Hay que comprobarla contra la FUENTE.

## `corregir-enunciado.cjs` y `corregir-opcion.cjs`

Aparecen defectos de ENUNCIADO y de OPCIONES mientras se reescriben explicaciones (20 y 9 en aquella
sesión). Estos scripts hacen el `UPDATE` **y el evento de observabilidad en una transacción**, para
que quede el texto anterior y el nuevo: sin eso, un `UPDATE` a pelo no deja constancia de que
alguien lo miró ni de por qué.

`corregir-opcion.cjs` **aborta si el cambio supera 3 caracteres**. No es un umbral caprichoso:
cambiar el CONTENIDO de una opción toca a la clave y a la resolubilidad de la pregunta, y eso no se
hace de pasada. Para la errata legítima que excede el margen —una palabra descolocada que deja la
frase agramatical— existe `--forzar`, que **deja constancia del forzado en el evento** en vez de
relajar la guarda.

## Reglas duras que no están en el código

- **NUNCA tocar el enunciado de una pregunta de examen oficial** (`is_official_exam`), aunque tenga
  un defecto real. En aquella sesión eso dejó 4 sin corregir, a propósito.
- **NUNCA auto-corregir la clave.** Si no se sostiene, `needs_human` vía
  `transition_question_state` con el porqué escrito. ⚠️ `p_changed_by` es `uuid`: la atribución va
  en `p_notes`.
- **Dos respuestas defendibles = defecto de OPCIONES, no de explicación.** No se reescribe: se
  retira. Patrón para encontrarlas: enunciado que NO acota apartado + artículo con varios apartados
  que dicen cosas parecidas.
- **`unsafe` al aplicar no es un fallo tuyo**: son las de «Todas las anteriores» / «A y B son
  correctas», que no se barajan por construcción.
