# T-291 — lote CE (Constitución Española), 06/08/2026, w2

12 preguntas activas de examen oficial (`is_official_exam=true`), de la Constitución
Española, sin `explanation_data` (no barajables), con explicación estructurada nueva
**verificada** y **sin aplicar** — este worker solo tiene `VENCE_LECTOR_URL` (SELECT).

## Por qué CE y por qué este tamaño

- **No se pudo usar la cola de la propia ficha** (`ORDER BY servidas DESC` contra
  `test_questions`, `NOT EXISTS ai_verification_results`): las dos tablas devuelven 0 filas
  para `vence_lector` por el bloqueo RLS de [T-573]/[T-038] (migraciones en `main`, sin
  aplicar en RDS — mismo hallazgo que la revisión anterior de esta ficha, sigue igual).
  Sin esa cola no hay forma de ordenar por exposición real ni de saber qué se ha verificado
  ya, así que se usó un proxy razonable y verificable: `is_official_exam=true` (valor
  intrínseco: son preguntas de examen real) + concentrar el lote en UNA sola ley (CE, la
  que más candidatas tiene: 838) para que leer los artículos de una vez cubra muchas
  preguntas a la vez.
- El tamaño (12) es a propósito pequeño: cada pregunta se verificó leyendo el artículo
  ENTERO vinculado en BD (no de memoria) y, en un caso, tres artículos adicionales que la
  pregunta cita sin estar vinculada a ellos. Es trabajo de escalón 2 (juicio, agente), no de
  escalón 1 — no hay atajo de volumen aquí sin arriesgar precisión.

## Qué se hizo, y cómo se verificó

Para cada pregunta: se leyó el `article.content` de su `primary_article_id` (texto real de
BD, no la ficha ni memoria), se contrastó cada opción contra ese texto, y se escribió
`explanation_data` en el formato §canónico (`{v:1, cita, options:{"0".."3"}, frame, estilo}`)
con la razón de CADA opción referida a su CONTENIDO, nunca a su letra.

**Validado con los gates REALES de la campaña, importados sin reimplementar**
(`data/pilotos/t291-ce-06ago/validar.ts`, mismos módulos que usa
`scripts/revision/validar-lote-t291.ts`): `isStructuredExplanation`,
`structuredNarrativeStaleLetters`, `explanationReferencesLetters` (de
`lib/shuffle/structuredExplanation.ts` y `lib/shuffle/classifyShuffleMode.ts`) +
`citaNoLiteral` (de `scripts/impugnaciones/validar-explicacion.cjs`, el criterio ÚNICO de
cita literal). **Resultado: 12/12 pasan los cuatro gates.**

**Comprobación extra, no automática en el arnés original: que mi opción marcada "correcta"
coincide EXACTAMENTE con `questions.correct_option` de BD, en las 12.** Ninguna clave se
tocó ni se cuestionó — es la misma que ya estaba.

## Un caso que merece nota: `014e50cc` (art. 124 CE)

La pregunta («Del Poder Judicial. Señale la proposición INCORRECTA») cuelga de un solo
`primary_article_id` (art. 124, Ministerio Fiscal) pero sus 4 opciones citan hechos de
**cuatro artículos distintos** de la CE: A) art. 127.1 (sindicación de jueces), B) art. 123.2
(nombramiento del Presidente del TS), C) art. 117.6 (prohibición de tribunales de excepción)
y D) art. 124.4 (nombramiento del Fiscal General — la única que SÍ vive en el artículo
vinculado, y es la incorrecta tal como está redactada: dice "oídos el Congreso y el Senado"
cuando el texto real es "oído el Consejo General del Poder Judicial"). Se verificó A/B/C
contra sus artículos reales (117, 123, 127, leídos aparte) pero **la `cita` estructurada
solo lleva el texto del art. 124** (el vinculado) — las razones de A/B/C se escribieron en
prosa propia, sin blockquote, precisamente para no reclamar como "cita literal" un texto que
no vive en el artículo al que la pregunta está enlazada. Esto es del mismo tipo que documenta
`docs/maintenance/revisar-preguntas-con-agente.md` sobre preguntas ancladas a un artículo
"vecino" — no se re-vinculó nada, solo se dejó constancia.

## Y otro: `060158e0` (art. 107 CE, Consejo de Estado)

La opción correcta habla de que el Consejo de Estado asesora "al Gobierno y a las
Comunidades Autónomas". El art. 107 CE dice literalmente solo "del Gobierno" — la extensión
a las CCAA viene de la ley orgánica reguladora (LO 3/1980), no del propio artículo
constitucional. Se escribió la razón dejando esa frontera explícita, en vez de citar el
art. 107 como si dijera algo que no dice.

## No aplicado

Como en la tanda anterior de este worker ([T-302], 06/08), no hay escritura en la BD de
negocio disponible. Para aplicar: `aplicar-explicacion.ts` espera el formato
`{lotes/, veredictos/, estructuradas/}` de `scripts/revision/validar-lote-t291.ts` — este
lote solo trae `estructuradas/` (no pasó por agentes en lote, lo verificó este worker
directamente), así que aplicar cada fichero requiere el `UPDATE questions SET
explanation_data=... WHERE id=...` directo (los 12 ya están verificados y con gates en
verde) o adaptar el lote al formato completo si se quiere pasar también por
`validar-lote-t291.ts`.

## Cómo continuar

1. Alguien con `DATABASE_URL` de escritura aplica los 12 `explanation_data` (contenido en
   `estructuradas/*.json`, ids = nombre de fichero).
2. Invalidar caché (`teoria`, `temario`, `laws`) y `POST /api/admin/revalidate`.
3. Registrar en `ai_verification_results` (mismo criterio que el resto de T-291,
   `ai_provider='claude_code_t291_w2_ce'`) para que la próxima cola de "nunca verificadas"
   ya no las incluya.
4. El resto del cubo CE (826 restantes de las 838 candidatas) y las otras leyes grandes
   (LECrim 519, Ley 39/2015 461, CP 315…) siguen el mismo patrón — este lote es la prueba
   de que el método funciona sin exposición ordenada, no el final del trabajo.
