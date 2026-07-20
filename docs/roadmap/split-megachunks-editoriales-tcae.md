# Split de los mega-chunks editoriales de TCAE

**Problema.** Los contenedores editoriales sanitarios tenían "artículos" que en realidad eran temas
enteros: 7 artículos para 1.460 preguntas activas en "Movilización y posiciones" (~208 preguntas por
artículo, ~10.000 caracteres cada uno). Con esa granularidad ni la pregunta queda bien colocada ni el
opositor puede estudiar el punto concreto: pinchar "ver artículo" abría un volcado de 18.000 caracteres.

Se detectó porque **los flags de mislink del barrido de explicaciones (20/07) se concentraban ahí**:
un solo contenedor produjo 20 de 69 (29%).

| Contenedor | «Artículos» | Preguntas activas | Chars/artículo |
|---|---|---|---|
| Movilización y posiciones | 7 | 1.460 | 10.285 |
| Eliminación y sondajes | 6 | 1.310 | 10.409 |
| Oxigenoterapia | 4 | 789 | 13.659 |

**Diferencia con el split de Instituciones Internacionales GC:** allí un contenedor mezclaba
organizaciones **ajenas entre sí** y se partió en 13 **leyes**. Aquí el contenedor es un tema
coherente y lo que sobra es **grosor**: se parte en **artículos** dentro de la misma ley.

## ✅ Piloto HECHO (20/07): "Movilización y posiciones" art.1

### Fase 1 — partir el texto
El art.1 (18.023 chars, 507 preguntas) mezclaba 5 materias. Se cortó por **las costuras del propio
material** (encabezados `##`), **verbatim, sin reescribir una palabra**. Integridad: 18.023 → 18.024
(el único carácter extra es el salto que une la chuleta).

| Art. | Contenido | Chars |
|---|---|---|
| `1` | Posición anatómica, planos y ejes | 4.188 |
| `1.2` | Alineación corporal, mecánica corporal y ergonomía | 2.949 |
| `1.3` | Posiciones del paciente (+ chuleta, que resume posiciones) | 9.609 |
| `1.4` | Decúbitos, puntos de presión y UPP | 1.278 |

**Numeración `1.2/1.3/1.4` y no `8/9/10`:** el orden de los artículos es por texto, así que 8/9/10
daría `1, 10, 2, 3…`. Con decimales sale `1, 1.2, 1.3, 1.4, 2, …`.

**⚠️ topic_scope:** 26 de las 28 filas escopan la ley entera (`article_numbers` NULL) y recogen los
artículos nuevos solas. Pero **2 filas de `tcae_sas` (T19 y T22) listaban `["1".."7"]` explícitamente**
→ hubo que ampliarlas con `1.2/1.3/1.4`. **Sin ese paso, las 369 preguntas movidas habrían
DESAPARECIDO de esos dos temas.** Comprobar siempre las filas con lista explícita antes de añadir artículos.

### Fase 2 — repartir las preguntas
507 clasificadas por 10 agentes. **Integridad verificada: 507/507, 0 duplicadas, 0 sin clasificar,
0 sobrantes.** Reparto: `1.3`=290 · `1.2`=74 · `1`=60 · `1.4`=5 · `OTRO`=78.

**Guardarraíl anti-regresión:** se cuenta por tema cuántas preguntas de la ley sirve cada uno ANTES y
DESPUÉS; si alguno pierde una sola, el script **revierte solo**. Resultado: **40.880 servidas antes y
después en los 28 temas — cero regresión.** Backup en `backup-split-fase2.json`.

### Residuo
- **78 `OTRO`** (15%) se quedan en el art.1: no encajan en ninguno de los 4 bloques. Probablemente
  pertenecen a otros artículos de la ley (2-7) o a otro contenedor → cabo suelto a mirar.
- **`1.4` solo recibió 5 preguntas**: las de UPP viven en realidad en el art.3 "Cambios posturales".
  Sugiere que el reparto entre `1.4` y el art.3 merece una pasada.

## Pendiente
- Mismo tratamiento para **"Eliminación y sondajes"** (art.6 = 16.747 chars) y **"Oxigenoterapia"**
  (art.4 = 15.074 chars), que son los otros dos mega-chunks.
- Con el material ya partido, **se puede escopar por subtema**: hoy los 28 temas reciben la ley entera
  (patrón de sobre-escopado). Ese es el beneficio de fondo del split, y sigue sin explotar.

## Scripts
`scripts/impugnaciones/split-movilizacion-fase1.cjs` (partir texto + ampliar scope) ·
`split-movilizacion-fase2.cjs` (repartir preguntas + guardarraíl de regresión).
