# Paso 6 — auto-audit, batch `gen_lcsp_t115_2026-07-31`

16 preguntas releídas desde BD contra el `content` literal de los arts. 137, 138, 140, 142, 146 y
148 de la Ley 9/2017, y contra los artículos que citan las explicaciones. Contenedor verificado
con `batch:boe`: **6/6 idénticos al BOE vigente**.

## Las remisiones, comprobadas una a una contra el título real del artículo

| Cita en mis explicaciones | Artículo real | ¿Casa? |
|---|---|---|
| art. 119 (tramitación urgente) | «Tramitación urgente del expediente» | ✅ |
| art. 133 (confidencialidad) | «Confidencialidad» | ✅ |
| art. 71.3 (prohibiciones por extensión) | «Prohibiciones de contratar» | ✅ |
| art. 75.2 (compromiso al recurrir a solvencia ajena) | «Integración de la solvencia con medios externos» | ✅ |
| art. 145 (criterios de adjudicación) | «Requisitos y clases de criterios de adjudicación del contrato» | ✅ |

## Los plazos y cifras, uno a uno

- art. 138.2 → prórroga de **cinco días** ✅ · excepción: tramitación urgente del art. 119 ✅
- art. 138.3 → entrega **6 días** antes / solicitud **12 días** antes ✅ (la condición de los 12 días
  va en el ENUNCIADO, no en la opción, para no truncar la clave)
- art. 146.2.a) → comité con mínimo de **tres** miembros ✅ · nunca adscritos al órgano proponente ✅
- art. 146.3 → umbral mínimo del **50 por ciento** sobre los criterios **cualitativos** ✅

## Adjudicaciones que hice a mano

- **Q4 reescrita antes de insertar.** La primera versión resumía las tres letras del art. 138.2 en
  una sola opción y el simulador la paró: en un borrador nuevo la clave se ancla al literal, no se
  adjudica como condensación (§2.2, lección de la campaña). Se reformuló para que la clave sea la
  letra b) verbatim, y las otras dos causas viven en la viñeta.
- **Q13: el detector de overclaim marcó «nunca».** No era falso del todo —el artículo dice «en
  ningún caso»— pero se reescribió con la fórmula literal del precepto, que además enseña mejor.
- **Q15 (art. 148.1), avisada como ENUMERACIÓN por el gate.** La clave recoge la definición general
  («todas las fases consecutivas o interrelacionadas que se sucedan durante su existencia») y el
  límite final («hasta que se produzca la eliminación, el desmantelamiento o el final de la
  utilización»), omitiendo la lista del «y, en todo caso:». **Lo adjudico como NO defecto**: esa
  lista es de inclusión ilustrativa —lo que en todo caso queda dentro—, no una consecuencia
  jurídica distinta, y los cuatro distractores atacan justamente la definición y el límite. Queda
  a confirmación de las auditorías.
- **Se evitaron a propósito los arts. 134, 143, 147 y 151**, que tienen scrapeadas en `draft` con
  la explicación corrupta: generar encima habría creado duplicados semánticos el día que alguien
  las repare (el dedup del Paso 3 compara enunciados y no lo caza).

## Los 7 checks

`article_ok` ✅ 16/16 · `answer_ok` ✅ 16/16 · `options_ok` ✅ 16/16 · `explanation_ok` ✅ 16/16 ·
`question_text_ok` ✅ 16/16 · `distractors_balance_ok` ✅ 16/16 (dos reparados en el borrador: una
clave demasiado corta y otra demasiado larga) · `answer_position_uniform_ok` ✅ **4/4/4/4 exacto**,
secuencia `ACBDADCBABCDACDB`.
