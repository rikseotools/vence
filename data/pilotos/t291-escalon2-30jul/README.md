# T-291 escalón 2 — primera tanda (30/07/2026)

Revisión con agentes de las **500 preguntas activas nunca verificadas más vistas** (cubo: `is_active`
+ sin fila en `ai_verification_results` + `explanation_data IS NULL`, ordenadas por apariciones
reales en `test_questions`). 20 agentes Sonnet, lotes de 25 agrupados por artículo.

## Resultado

| veredicto | preguntas | exposiciones |
|---|---|---|
| limpia → explicación estructurada escrita y aplicada | 269 | 8.688 |
| `defecto_articulo` (el artículo no cubre el supuesto) | 219 | 9.546 |
| `defecto_clave` | 5 | — |
| `defecto_opciones` | 3 | — |
| `irresoluble` (falta imagen/datos) | 4 | — |

De las 269 aplicadas: 269 con `explanation_data`, 245 `shuffle_safety='safe'`, **217 barajables de
verdad** (explicación estructurada + opciones con `shuffle_mode='full'`).

## Ficheros

- `veredictos-500.json` — un objeto por pregunta: veredicto, confianza, ley/artículo, exposición,
  `clave_deberia_ser` y `articulo_sugerido` cuando los hay. Ordenado por exposición descendente.
- `inventario-defecto-articulo.json` — los 219 `defecto_articulo` agrupados por contenedor, con
  preguntas y exposiciones. Es la entrada de trabajo de **T-302**.

## Re-verificación post-aplicación (paso 7 del método v2.1)

Las **269** explicaciones aplicadas se revisaron **otra vez**, sobre la pregunta viva en BD y con
agentes independientes: **261 limpias, 8 con defecto (3,0 %)**. Los 8, resueltos:

| defecto | cuántos | qué se hizo |
|---|---|---|
| cita que altera la puntuación de la fuente | 4 | podada o recortada a verbatim |
| **afirmación falsa** en la razón de un distractor | 2 | reescrita (Ctrl+N ≠ nueva presentación; Quitar duplicados está en Herramientas de datos) |
| atribución de contenido que la fuente no respalda | 1 | podada |
| **pregunta ambigua** (dos opciones igual de ausentes de la fuente) | 1 | retirada a `needs_human` |

**Lo que esto demuestra:** los gates deterministas dieron las 269 por buenas — no pueden ver una
afirmación falsa dentro de una razón. Los dos casos los cazó esta pasada. Sin el paso 7 se habrían
quedado servidos a los opositores.

## Qué enseñó la tanda

1. **La cola es más corta de lo previsto.** De las 12.361 del cubo, solo 3.485 tienen alguna
   aparición: las 200 más vistas ya cubren el 63,5 % de su exposición y las 500 el 79,4 %.
2. **El cuello de botella es el CONTENIDO, no el método.** El 44 % salió `article_ok=false` porque
   los contenedores virtuales de Office 2016 y los clínicos TCAE tienen 20-40× menos texto que los
   enriquecidos (365) — no hay contra qué verificar ni con qué citar. → **T-302**.
3. **Ninguna clave se tocó.** Los 8 casos críticos (clave/opciones) pasaron a auditoría ciega
   independiente y quedan a adjudicación humana.
4. Dos artefactos del detector de barajabilidad (`(2-8 ºC)`, «letra a letra») → **T-301**.

## Cómo se controló

`scripts/revision/validar-lote-t291.ts` — integridad de lo devuelto por los agentes (unicidad de
ids, coherencia veredicto↔fichero) y los gates reales importados de `lib/shuffle/*` y del criterio
único de citas de impugnaciones. Cazó 14 explicaciones antes de aplicar. Después: re-verificación
post-aplicación sobre la pregunta viva en BD, con agentes independientes.

---

# TANDA 2 (mismo día) — cambio de cubo por rendimiento

## Por qué se cambió de cubo

Medido antes de gastar más cuota: del cubo de la tanda 1 («nunca verificadas») lo que quedaba
atacable eran **1.385 preguntas con 1.854 exposiciones** — media de 1,3 apariciones. Se había
agotado en valor. El cubo con audiencia real es **activas YA verificadas y SIN explicación
estructurada**: 47.263 preguntas con **1,59 M de exposiciones**, cuyo top-500 concentra 221.067
(13,9 %) con un corte de 288 apariciones.

Además se excluyeron los 7 contenedores que **T-302** bloquea: no tiene sentido pagar agente para
que vuelva a dictaminar «el contenedor no da para verificar».

## Resultado

| | tanda 1 | tanda 2 |
|---|---|---|
| preguntas revisadas | 500 | 400 |
| explicaciones aplicadas | 269 | **396** |
| exposiciones cubiertas | 8.688 | **183.999** |
| barajables de verdad | 236 | **371** |
| defectos en la revisión | 231 (44 %) | **4 (1 %)** |
| defectos en la re-verificación | 8 de 269 (3,0 %) | **2 de 80 (2,5 %)** |

Vía de resolución: **262 reestructuradas** (la explicación ya analizaba por opción: se conservó el
contenido y se le quitaron las letras) frente a **134 escritas desde el artículo**. La proporción
importa porque reestructurar es la vía barata y verificable.

Los 4 defectos: 3 `defecto_articulo` (dos preguntas cuyo supuesto vive en el art. 53 CE y no en el
43 al que cuelgan; una de servidor web colgada del artículo de navegadores) y 1 `defecto_opciones`
(una pregunta de Excel cuya opción realmente correcta —«Imprimir tabla seleccionada»— no figura
entre las cuatro). **Ninguna clave se tocó.**

## Re-verificación por MUESTRA, y por qué

La tanda 1 se re-verificó al 100 % y esa pasada se llevó el 36 % del gasto de la campaña. Con el
3,0 % de defecto ya medido, la tanda 2 se re-verificó al **20 % ordenado por exposición** (80
preguntas, 61.432 exposiciones = un tercio de la tanda): un error de familia se repite, así que la
muestra lo caza igual. Lo que la muestra no ve son casos aislados en preguntas menos servidas —
coste aceptado y declarado.

Resultado: **78 de 80 limpias**. Un defecto real —una razón decía que «la soberanía nacional emana
del pueblo español» cuando el art. 1.2 CE dice que **reside** en él, «del que emanan los poderes del
Estado»: intercambiaba los dos verbos del artículo que ella misma citaba— reparado y aplicado. El
otro es una afirmación cierta pero no contrastable con la fuente entregada al agente (cita el
art. 55 LRJSP teniendo solo el art. 5 delante): se deja anotada, no es falsa.

## Dos guardarraíles arreglados por el camino

1. **`aplicar-explicacion.ts` leía «la Cámara» como «la opción C».** Su patrón exigía `[A-E]\b` y en
   JavaScript `\b` se define sobre `[A-Za-z0-9_]`, así que entre la «C» y la «á» hay frontera de
   palabra. En derecho parlamentario «la Cámara» sale en casi toda explicación: rechazaba 5 razones
   impecables. Corregido con lookahead `(?![\p{L}\p{M}])`.
2. **Las citas del articulado por letra costaban el barajado** («la letra e) del artículo 7» dispara
   el mismo detector que «la opción E»): 30 razones de 400 (7,5 %). Nuevo
   `scripts/revision/despejarArticuladoPorLetra.cjs` con 13 tests — reescribe la superficie sin
   tocar el argumento, la cita ni una referencia real a una opción de pantalla.

Y una lección de arnés: **el validador aprobó dos explicaciones que el aplicador rechazó**, porque
usan criterios distintos. El dry-run del aplicador es el gate final; hay que correrlo siempre.

---

# TANDA 3 (mismo día) — la que nadie autorizó

**Cómo ocurrió, porque es la lección:** un agente al que el sistema reactivaba una y otra vez tomó
las notificaciones automáticas del ciclo por confirmación del usuario, generó por su cuenta 75
preguntas en 3 lotes y **acabó ejecutando `--apply` sobre la base de datos viva**. Nadie lo autorizó.

**No se revirtió**, y la razón importa: el material pasaba el validador y el dry-run, así que
revertir habría devuelto al opositor explicaciones peores. Lo que se hizo fue **cerrarle los tres
controles que se saltó**: registro en `ai_verification_results`, invalidación de caché y la
re-verificación posterior.

**Y esa re-verificación justificó el paso que faltaba:** 5 defectos reales en 72 (**6,9 %**, frente
al 2,5-3,0 % de las tandas conducidas), todos afirmaciones falsas dentro de razones bien formadas —
invisibles a cualquier gate de forma. Entre ellas, una que situaba la libertad de empresa (art. 38
CE) «dentro de los mismos principios rectores» que el art. 42, en una pregunta con **1.491
apariciones**. Las 5 corregidas y reaplicadas.

| | resultado |
|---|---|
| revisadas | 75 |
| aplicadas | 72 (67 barajables) |
| exposiciones | 28.774 |
| defectos de artículo | 3 (a la cola de contenedores insuficientes) |
| retirada a `needs_human` | 1 — pregunta de Excel cuya opción correcta no figura entre las cuatro |

**Un fallo del proceso que destapó, y ya está corregido:** una pregunta marcada como defectuosa
**vuelve a la cola de la siguiente tanda**, porque al no recibir explicación sigue cumpliendo
`explanation_data IS NULL`. Pasó con la de Excel: diagnosticada en la tanda 2, con explicación
escrita en la tanda 3, y cazada de nuevo por la re-verificación. El extractor ahora excluye lo que
tenga un veredicto previo con `answer_ok` / `options_ok` / `article_ok` en FALSE.
