import pathlib

NOTAS = {
    'T-679': """
**🟢 INSERTADO Y VIVO (08/08).** Batch `gen_gcivil_t17_rd1125_2026-08-08`. Guardia Civil T17 sirve
**370 preguntas** (comprobado contra www.vence.es). Pipeline completo y `batch:servido` en verde.

**El Paso 9 encontró un defecto y por eso hubo dos pasadas.** La primera (agente ciego nuevo):
contenido 10/10 correcto, pero **5 de las 10 citaban «RD 1125/2024» sin escribir «Real Decreto» en
ningún punto de esa pregunta**. Reparados los 6 enunciados afectados (solo `question_text`).
Segunda pasada con un agente aún más nuevo, sobre la versión reparada: **10/10 limpio**, registrado
como `paso9v2`. La primera NO se registra a propósito: acreditar una auditoría con hallazgos sin
reparar deja una traza diciendo que todo estaba bien.

**Comprobado el aviso de [T-683]**, que ya se podía comprobar porque sus 12 re-ancladas están vivas
en esta misma norma: el único solape es el TÍTULO de la norma que las vivas llevan de preámbulo.
No hay duplicación (`scratchpad/solape-t679-t683.cjs`).

**Quedan 3 de los 5 artículos** del scope por cubrir con más batches.
""",
    'T-681': """
**🟢 INSERTADO Y VIVO (08/08).** Batch `gen_pn_t11_rex2024_2026-08-08`. Policía Nacional T11 sirve
**262 preguntas** (comprobado contra www.vence.es). `batch:servido` en verde.

**El Paso 9 destapó algo más gordo que un defecto de pregunta.** La primera pasada marcó que la
opción citaba *«Ley 33/2003, de 4 de noviembre»* cuando la fecha real es **de 3 de noviembre** (el 4
es la de PUBLICACIÓN en el BOE, que es de donde viene la confusión). Al rastrearlo: **el error no
era de la pregunta ni del legislador, era de NUESTRO import** — `articles.content` de los arts. 220
y 221 del REx lo tenían mal, y la pregunta copió el dato fielmente, que es justo lo que la regla de
literalidad le manda hacer. El consolidado del BOE (`BOE-A-2024-24099`) lo cita DOS veces como «de
3 de noviembre». Corregidos **los dos artículos y la pregunta, en ese orden**: sin arreglar el
artículo, la siguiente pregunta que se generase sobre ese texto repetiría el error.

Segundo hallazgo: **16 de 17 decían «del REx 2024» sin desarrollarlo**. Desarrollado en los
enunciados y **catalogado en el diccionario de siglas**, para que el gate lo cace solo.

Segunda pasada sobre la versión reparada: **17/17 limpio**, con las fechas de cada norma externa
verificadas una a una. Registrado como `paso9v2`.

**Quedan 33 de los 43 artículos** del scope (procedimiento ordinario/preferente/simplificado,
expulsión y multas, arts. 225-257).
""",
    'T-278': """
**🟢 INSERTADO Y VERIFICADO (08/08), pero el tema SIGUE OCULTO — y está bien así.** Batch
`gen_mecanico_conductor_estado_t10_2026-08-08`: las 22 preguntas están `approved` y activas, con el
Paso 9 limpio. Lo que NO se ha tocado es `topics.disponible` de T10, que sigue en `false`:
**la publicación depende de T9 y T10, y T9 sigue a cero** (punto 3 de esta misma ficha). Encender
T10 solo no desbloquea nada y expondría media oposición. Por eso `batch:servido` dice «no es
visible en ningún tema activo» — es la verdad, no un fallo.

**Hicieron falta TRES pasadas del Paso 9, y las dos primeras encontraron cosas ciertas:**
- *Pasada 1:* la sigla **RGC se desarrollaba solo en la cabecera de la explicación**, que el
  opositor ve DESPUÉS de responder (21 preguntas); y la cita del art. 48.1.e) cortaba antes del
  *«No obstante, los conductores de bicicletas podrán superar dicha velocidad máxima…»*,
  presentando como absoluto un límite que la ley matiza.
- *Pasada 2:* el MISMO patrón de cita truncada en el art. 54.1 (la salvedad de los ciclistas en
  grupo), y **una razón de distractor con un dato falso** — decía que 100 km/h es «el máximo fuera
  de poblado» cuando el art. 48 fija **120** para turismos.
- *Pasada 3:* **22/22 limpio**, registrada como `paso9v3`.

Reparado completando las citas, añadiendo la salvedad como nota (que además es materia útil),
acotando los dos enunciados afectados y corrigiendo la cifra.

**Y un arreglo de gate que sale de aquí:** `citaBlockquote` no entendía la elipsis entre paréntesis
`(...)` que el propio manual sanciona, y daba **3 de 22 en rojo estando las 3 bien** — una de ellas,
la que se había reparado días antes para cumplir esa misma convención.

**Lo que queda para publicar:** T9 «La vía» sigue a 0 preguntas (14 artículos de scope, el bloque
más grande que el de T10).
""",
}

p = pathlib.Path('/home/manuel/vence-sessions/movil3/docs/roadmap/tareas-pendientes.md')
lineas = p.read_text().split('\n')
for tid, nota in NOTAS.items():
    idx = next((i for i, l in enumerate(lineas) if l.startswith(f'### [{tid}]')), None)
    if idx is None:
        print(f'  ! {tid} sin ficha')
        continue
    fin = next((i for i in range(idx + 1, len(lineas)) if lineas[i].startswith('### [')), len(lineas))
    ins = fin
    while ins > idx and not lineas[ins - 1].strip():
        ins -= 1
    lineas[ins:ins] = nota.rstrip('\n').split('\n')
    print(f'  · nota añadida a {tid}')
p.write_text('\n'.join(lineas))
