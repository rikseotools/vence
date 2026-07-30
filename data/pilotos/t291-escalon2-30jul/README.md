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
