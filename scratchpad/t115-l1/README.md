# T-115 — lote `gen_lo12004_t115_2026-08-05_l1` (LO 1/2004, arts. 33-38)

**Estado: preparado y auditado, PENDIENTE de insertar/aprobar.** Este lote lo generó
la sesión trabajadora `l1` de la flota, que por regla dura **no escribe en la BD de
negocio** (§reglas del encargo). Todo el trabajo de lectura/verificación/generación/
auditoría está hecho; falta el tramo de escritura (Pasos 4-11 del manual
`docs/maintenance/generar-preguntas-con-ia.md`), que tiene que correrlo una sesión
con acceso de escritura.

## Por qué esta ley (elegida por alcance MEDIDO, no por el top de `huerfanos:plan`)

`npm run huerfanos:plan --deuda` da individualmente los artículos de LO 1/2004
(`lo-1-2004`, **no** confundir con el duplicado inerte `lo-violencia-genero` — 0 scopes,
0 preguntas, comprobado) arts. 33-72 con **25-27 oposiciones cada uno** en el top of
the ranking global — el bloque huérfano más grande medido en esta sesión. Se generó
sobre los 6 primeros (33-38, Título penal: reforma de arts. 83, 84, 88, 148, 153 y 171
CP) por ser los de contenido más autocontenido y verificable.

**Impacto medido (topic_scope, vía `VENCE_LECTOR_URL`):** los arts. 33-38 están
escopados en **27 temas de 26 oposiciones activas** (una, `auxiliar_museos_estado` T7,
tiene `disponible=false`). Lista completa al final de este README.

## Cadena hecha

1. **Selección** — `npm run huerfanos:plan --deuda` (adaptado a `VENCE_LECTOR_URL`, ver
   más abajo).
2. **Paso 1 (verificación contra el BOE vigente)** —
   `node scripts/verificar-articulos-vs-boe.cjs lo-1-2004 BOE-A-2004-21760 33 34 35 36 37 38`
   → **6/6 artículos idénticos al BOE vigente** (fecha de vigencia 20050629).
3. **Paso 2 (generación)** — 12 preguntas iniciales sobre los 6 artículos, ancladas a
   citas literales de `articles.content` (que a su vez transcribe literalmente los
   artículos del Código Penal que LO 1/2004 modifica — la pregunta cuelga de LO 1/2004,
   no de una fila de CP que no existe en BD).
4. **Paso 3 + 3.bis (dedup + simulación, SOLO LECTURA)** —
   `node scripts/simular-batch-preinsercion.cjs <borrador> lo-1-2004`. Primera pasada:
   28 bloqueantes (formato `primary_article_id`/`option_a..d` del manual ≠ formato real
   del inserter, que exige `primary_article_number`+`options[]` — el propio Paso 3.bis
   ya avisa de este desajuste de contrato; corregido) + 3 `NO_LITERAL` reales (opciones
   que resolvían una anáfora del artículo — "de este apartado" → "del apartado 1 del
   artículo 83 del CP" — de forma válida por autocontención pero no ya contigua al
   texto). Se repararon manteniendo la cita CONTIGUA (mover la resolución de la anáfora
   al enunciado en vez de a la opción) → **segunda pasada: 0 bloqueantes**.
   El simulador destapó además un duplicado real: la pena del art. 153.1 CP y la del
   art. 171.4 CP (ambos reformados por esta ley) son **literalmente idénticas**
   ("seis meses a un año... un año y un día a tres años"), así que dos preguntas sobre
   "qué pena prevé" habrían tenido la misma CLAVE (Jaccard 1.00, aviso `MÍRALO`, no
   falso positivo) — se **retiró** la pregunta redundante del art. 38 en vez de forzar
   una diferencia que la ley no tiene. **Lote final: 11 preguntas** (no 12).
   Quedan 2 avisos 🟡 de duplicado intra-lote entre arts. 33/34 y arts. 35(a)/35(b),
   ambos con CLAVE Jaccard 0.00 → el propio simulador los marca "probable falso
   positivo" (mismo patrón que el lote RGPD del 31/07: boilerplate de §2.2-quater
   inflando el Jaccard del enunciado sin que la clave se parezca).
5. **Auditoría doble ciega (Paso 6+7, sobre el borrador — no pude insertarlo en BD)** —
   2 agentes `general-purpose` independientes, cada uno SIN saber que el otro existía
   ni que yo había generado las preguntas, con instrucción explícita de ser
   adversariales y re-derivar la respuesta desde el artículo antes de mirar cuál estaba
   marcada. **Las dos auditorías CONVERGIERON en el mismo único defecto**
   (Q6, art. 148.4º CP: la viñeta que descarta la opción A decía que la agravante
   "se aplica precisamente cuando NO hay convivencia", invirtiendo el sentido real de
   "aun sin convivencia" — que es que la convivencia NO es requisito, ni para exigirla
   ni para excluirla). **Reparado en el borrador** con la redacción que las dos
   auditorías proponían casi textualmente. El resto (10/11) salió PERFECT en ambas
   pasadas — ninguna clave equivocada, ninguna cifra de pena trasplantada de otro
   apartado, ninguna cita truncada antes de una cláusula condicionante.
   Transcripts completos de las dos auditorías: pégalas desde esta conversación si
   hace falta el detalle pregunta a pregunta; aquí solo el resultado aplicado.
6. **Verificación final** — re-simulado tras la reparación: **0 bloqueantes, mismos
   2 avisos ya adjudicados como falsos positivos.** Distribución de `correct_option`:
   A 3 · B 2 · C 3 · D 3 (27/18/27/27%, dentro del margen ±10-40% que exige §2.2-ter);
   secuencia `CADBACBDCDA`, no cíclica.

## Lo que NO se ha hecho (y por qué)

Esta sesión es un **trabajador de la flota** con regla dura de NO escribir en la BD de
negocio. Por eso **nada de esto está insertado**: ni siquiera en `draft` (que sería
invisible para usuarios, pero sigue siendo una escritura de negocio). Pendiente para
quien retome:

```bash
# Paso 4-5: insertar en draft (formato ya listo, options[] + primary_article_number)
node scripts/insertar-batch-generado.cjs \
  scratchpad/t115-l1/gen_lo12004_t115_2026-08-05_l1_borrador.json \
  lo-1-2004 gen_lo12004_t115_2026-08-05_l1

# Paso 5.bis: gate mecánico sobre lo insertado en BD (repetir el verificador; el
# Paso 3.bis ya corrió en solo lectura sobre el borrador y dio 0 bloqueantes)
node scripts/verificar-batch-generado.cjs gen_lo12004_t115_2026-08-05_l1

# Paso 6-7: la auditoría doble ciega YA SE HIZO sobre el borrador (ver arriba) —
# no hace falta repetirla si el contenido insertado es idéntico al borrador de este
# directorio. Si se repara algo más al insertar, SÍ repetir sobre lo vivo.

# Paso 8: transición draft → approved (función SQL transition_question_state,
# registrando ai_verification_results con las dos auditorías de este README)

# Paso 9: re-verificación post-aplicación con agente Sonnet NUEVO sobre BD viva
node scripts/auditar-batch-input.cjs gen_lo12004_t115_2026-08-05_l1 <input.json>
# ... lanzar agente ...
node scripts/registrar-paso9.cjs gen_lo12004_t115_2026-08-05_l1 <veredictos.json> --apply
npm run batch:servido -- gen_lo12004_t115_2026-08-05_l1
```

También pendiente tras aprobar: invalidar caché/tags de los 27 temas y comprobar
`batch:servido`.

## Gotcha de herramientas resuelto en esta sesión (independiente del lote, reutilizable)

`huerfanos-plan.cjs`, `verificar-articulos-vs-boe.cjs` y
`simular-batch-preinsercion.cjs` leían `DATABASE_URL` directamente (del fichero
`.env.local` los dos primeros, de `process.env` el tercero) — con el rol de
coordinación de la flota (T-539) restringido a 4 tablas, los tres daban
`permission denied` contra tablas de negocio y la campaña T-115 quedaba inservible
para un trabajador. Añadido `lib/db/negocioSoloLectura.cjs` (con test) que resuelve
`VENCE_LECTOR_URL` con prioridad sobre `DATABASE_URL` — es SOLO LECTURA, así que
preferir el rol de menor privilegio es correcto también para sesiones interactivas,
no solo para trabajadores. Los tres scripts ahora lo usan. Además, `huerfanos-plan.cjs`
degradaba con una excepción no capturada al no poder leer `user_profiles` (columna
"usuarios", que no está en el rol de lectura por tener datos personales) — ahora
degrada a `usuarios: 0` con aviso en vez de morir.

También se añadió `CP` (Código Penal) al diccionario de siglas de
`lib/generacion/siglasSinDesarrollar.js` (antes no estaba catalogada — solo salía
como aviso "candidata", no como error duro — y esta ley reforma el CP en bloque).

## Temas afectados (27, de 26 oposiciones activas)

```
administrativo_agencia_tributaria_canaria T12    enfermero_scs_canarias T3
administrativo_seguridad_social T21               enfermero_scs_cantabria T5
auxiliar_administrativo_ayuntamiento_murcia T16   enfermero_sms T8
auxiliar_administrativo_ayuntamiento_salamanca T34 guardia_civil T21
auxiliar_administrativo_clm T12                   mecanico_conductor_estado T5
auxiliar_administrativo_sermas T6                 policia_municipal_madrid T37
auxiliar_clinica_diputacion_sevilla T4             policia_nacional T23
auxiliar_enfermeria_gva T10                        tcae_galicia T8
auxiliar_enfermeria_osakidetza T129                tcae_murcia T7
auxiliar_museos_estado T7 [NO disponible]          tcae_sas T7
celador_galicia T8                                 tcae_sermas_madrid T4
celador_ibsalut T8                                 tcae_sescam T1
celador_ics T8                                     tramitacion_procesal T2
celador_sas T7
```

## Ficheros de este directorio

- `gen_lo12004_t115_2026-08-05_l1_borrador.json` — las 11 preguntas, formato completo
  (manual §Paso 2 + `primary_article_number`/`options[]` que exige el inserter real +
  `explanation_data` §8.2 estructurado, shuffle-safe desde el nacimiento).
- `lo12004_audit_input.json` — el input que se les dio a los dos agentes auditores
  (preguntas + texto íntegro de los 6 artículos), por si hace falta repetir o extender
  la auditoría.
