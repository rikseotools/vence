# Runbook: Verificar epígrafes / contenido de una oposición (topic_scope)

**Cuándo consultarlo (CUALQUIERA de estas → este runbook):** el usuario dice *"verifica los epígrafes"*, *"verifica el contenido"*, *"verifica el scope"* de una oposición; o el **badge de verificación en `/admin/contenido`** está encendido. Seguir este runbook ANTES de improvisar.

Verifica que el `topic_scope` (artículos asignados a cada tema) **se corresponde con el epígrafe oficial** de cada tema, con **2 agentes independientes** (consenso), y deja constancia durable (estado + cuándo + hallazgos). Se **auto-invalida** cuando cambia el epígrafe/scope (trigger).

> Complementa al manual `docs/maintenance/verificar-epigrafe-topic-scope.md` (la metodología de fondo). Este runbook es el **procedimiento operativo** del sistema de verificación con provenance.

## ⚠️ Regla previa OBLIGATORIA — orden de trabajo cuando lo dispara un USUARIO

Siempre que un usuario (feedback, impugnación, duda) hable de **epígrafes, `topic_scope`, temario, artículos de un tema o "faltan/sobran preguntas de un tema"**, el orden es **este, y en este orden**, ANTES de responderle o tocar nada:

1. **Lee primero este manual de epígrafes** (y `docs/maintenance/verificar-epigrafe-topic-scope.md`). No improvises el diagnóstico de scope de memoria.
2. **Comprueba que la BD de SU oposición está OK y actualizada**: estado de verificación de esa `position_type` (`npm run verify:scope status <position_type>`), que los temas implicados están `disponible`, que su `topic_scope` no tiene **filas rotas** (ley enganchada con `article_numbers = '{}'` VACÍO → 0 preguntas de esa ley pese a existir banco), y que el epígrafe de BD casa con el programa oficial. Es decir: **primero pon en orden lo suyo**, no mires solo la pregunta literal.

   > ⚠️ **NULL ≠ vacío (no confundir).** La semántica la fija el API real de tests (`lib/api/filtered-questions/queries.ts:576-578, 983-986`) y la de teoría (`lib/api/topic-data/queries.ts:230`):
   > - `article_numbers IS NULL` → **"toda la ley"** (ley virtual/entera): sirve TODAS las preguntas. **VÁLIDO, NO tocar.** Es la convención de las enfermerías, Office común, etc.
   > - `article_numbers = '{}'` (array vacío) → **fila inerte**: no matchea nada → 0 preguntas. **ESTE es el bug.**
   > - `article_numbers = [vals]` → solo esos artículos.
   > (Ojo: `array_length(x,1) IS NULL` es TRUE para NULL y para `{}` a la vez → NO uses eso para detectar el bug, da falsos positivos masivos sobre las filas NULL sanas.)

   **Detección de filas rotas** (bug sistémico de scaffolding, cazado por Jen 15/07 en Cádiz; también p.ej. Madrid T14) — SOLO el array vacío, nunca NULL:
   ```sql
   SELECT t.position_type, t.topic_number, l.name
   FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id JOIN laws l ON l.id=ts.law_id
   WHERE ts.article_numbers = '{}'::text[];   -- vacío = inerte. NULL = "toda la ley" (válido).
   ```
   **Fix:** poblar `article_numbers` reusando el set que una oposición comparable ya usa para esa ley (verificar encaje con el epígrafe); si la ley enganchada es la EQUIVOCADA (Cádiz T20: Ley 33/2003 patrimonio ESTATAL en un tema de "bienes de las entidades LOCALES" → la correcta era RD 1372/1986 Reglamento de Bienes EELL + LBRL 79-83), sustituirla; si el banco resultante es fino, generar (fuente oficial + doble auditoría). **Barrido global HECHO (15/07): 0 filas `{}` en toda la BD** (Cádiz eran las únicas y ya se poblaron); las 1.696 filas NULL son "toda la ley" y están BIEN.
3. **Solo entonces analiza lo que pide el usuario** contra ese estado ya verificado, y decide (reasignar scope reusando banco existente, generar si el epígrafe lo pide y hay 0 preguntas, o explicar por qué es correcto).

Motivo: el texto literal del usuario suele ser la punta del iceberg (p.ej. "no hay preguntas de la Ley 29/1998 en el T16" resultó ser una fila de `topic_scope` con la LJCA enganchada pero `article_numbers` vacío, con 604 preguntas ya en BD listas para reusar). Si respondes sin poner antes la BD de su oposición en orden, das un diagnóstico parcial o equivocado. Relacionado: [[feedback_epigrafe_manda_0_preguntas_generar]], `docs/procedures/gestionar-feedback-bug.md`.

## Orden de los DOS pasos (DOCTRINA — no saltárselo)

**Son dos pasos y van EN ESTE ORDEN. El Paso 1 es BLOQUEANTE: sin él no se hace el Paso 2.**

1. **Paso 1 — Clonar el epígrafe oficial → BD (Sistema 2).** Traer el temario **LITERAL** de la fuente oficial (convocatoria / `programa_url`) a `topics.epigrafe` y dejarlo **registrado** (estado + fecha + hash de la convocatoria clonada) en `topic_epigrafe_verification`. Hasta que el epígrafe de la BD no esté confirmado como el oficial exacto (`verified_literal`), **NO se pasa al Paso 2** — comprobaríamos el scope contra una referencia posiblemente mal (el fallo T17: epígrafe paráfrasis).
2. **Paso 2 — Comprobar BD epígrafe vs scope del tema (Sistema 1), tema a tema.** Solo cuando el epígrafe ya es de fiar.

**Provenance del Paso 1** (queda anotado en BD con su fecha): si aparece **convocatoria nueva** → los epígrafes pasan a `outdated_convocatoria` → re-clonar y revisar por si cambió; si **no hay nueva** → vale el de la convocatoria anterior (`provisional_anterior`).

> Gotcha: ~30% de los boletines GVA/DOGV no parsean en automático (SPA/PDF). Cuando `verify-epigrafe-literality dump` da `temario_parseado=0`, el hash SÍ se captura (drift futuro) pero la **clonación/confirmación se hace a mano** contra el DOGV oficial, tema a tema, antes del Paso 2.

## Modelo mental

- Estado por tema en `topic_scope_verification`: `never_verified` → `verifying` → `verified_correct` | `verified_issues` → (`stale` si cambia el scope/epígrafe).
- **`verified_issues` NO significa "seguro mal"** — significa "al menos un pase independiente encontró algo, revisión humana". Unos son bugs claros, otros límites debatibles.
- Solo `record_topic_verification()` marca verificado (captura el hash). Un edit manual de scope dispara el trigger → `stale`. Nunca queda un "verificado" viejo colgado.
- **Claude en el bucle:** el usuario dispara, Claude ejecuta este runbook. No es un cron autónomo.

## Triaje en lote — `npm run scope:health` (clasificador de salud, complementa a scope-over-inclusion)
Antes de verificar oposición por oposición, **corre el clasificador** para saber CUÁL es cada una y en qué orden:
```bash
npm run scope:health -- --pending    # solo las que tienen temas sin verificar, orden por usuarios
npm run scope:health -- --json        # para pipelines
node scripts/scope-health-classify.cjs --simulate   # ground truth sin BD
```
Clasifica cada oposición en 4 buckets (los 3 patrones recurrentes de la campaña 21-22/07 + limpio):
- **BUILD** → tiene temas VACÍOS (0 topic_scope) = medio construida → `crear-nueva-oposicion.md`, NO este runbook.
- **REPARTO** → una LEY REAL escopada entera/con solape grande en ≥2 temas (misma ley duplicada) → repartir por materia (dump + 2 agentes o adjudicación por títulos + simulación orphan-check). *Es un prefiltro: solape 1-2 arts = cross-cutting legítimo (no lo marca); >2 = candidato a dup, el humano confirma.*
- **CLINICO** → solo CONTENEDORES de contenido compartidos (NULL en ≥2 temas) → casi siempre legítimos (no partibles por artículo); asignar al tema dueño si hay uno claro, o aceptar compartido.
- **LIMPIA** → sin vacíos ni duplicados → verify directo (coherencia título↔scope) o ya correcta.

**GOTCHA que cazó:** `article_numbers=NULL` = LEY/CONTENEDOR ENTERO; un check de solape por rango numérico da "limpio" en falso. El clasificador cuenta NULL-compartido como duplicado. Núcleo puro testeable (`--simulate`, 9 casos ground-truth).

## Procedimiento

### 0. Pipeline semi-autónomo (RECOMENDADO desde 13/07)
En vez de ensamblar a mano cada paso (fuente de fallos: olvidar recache/record, medir mal el impacto, borrar contenido implícito), usa el pipeline. Hace **la parte mecánica sola** y **para en la parte de juicio**:

```bash
node scripts/verify-topic-scope.cjs dump  <pt>                    # 1) scope+epígrafe+arts crudos
# 2) Workflow tool: verify-scope-oposicion con args = ese dump → propuestas (2 agentes+juez, BOE)
node scripts/verify-topic-scope.cjs plan  <pt> <propuestas.json>  # 3) enriquece+clasifica → tabla + plan.json
node scripts/verify-topic-scope.cjs apply <pt> --dry-run          # 4) previsualiza los AUTO-SEGUROS
node scripts/verify-topic-scope.cjs apply <pt>                    # 5) aplica auto-seguros + recache + record (horneados)
```

**Clasificador PURO testeado** (`scripts/lib/scope-classifier.cjs`, `__tests__/verification/scopeClassifier.test.js`) — decide `auto_safe` vs `judgment_gate`. Manda a la **puerta de juicio** (NO auto-aplica) cuando detecta:
- `reglamento_desarrolla`: se vacía un Decreto/Orden que **desarrolla** una ley nombrada en el epígrafe (caso T17 GVA: Decreto 77/2019 → **se mantiene**). Contenido IMPLÍCITO.
- `epigrafe_tematico`: el epígrafe describe la materia por concepto, no por estructura (caso T8 GVA: Ley 4/2023 "medidas en el ámbito administrativo").
- `impacto_alto`: el recorte afecta a > `--impact-threshold` preguntas (default 150; caso T10 GVA: 272).
- `delta_invalido` / `epigrafe_no_localizable`: dato sospechoso → gate por cautela (protege de planes stale: si los arts a quitar ya no están, no re-aplica).

`apply` sin flags aplica **solo** los `auto_safe`, refresca la MV, purga las rutas de los temas tocados, revalida el tag temario y hace `record_topic_verification` (correct si el tema queda limpio; issues si le queda algo en la puerta). Los `judgment_gate` requieren **criterio humano** y, tras decidir, `apply <pt> plan.json --include-gate` (aborta si algún delta es inválido). **Nada se borra nunca** — quitar del scope solo deja de mostrar preguntas fuera del temario oficial.

Los pasos manuales de abajo (§1-§5) siguen valiendo como detalle/fallback.

### 1. Dump del input de los agentes
```bash
node scripts/verify-topic-scope.cjs dump <position_type>
# escribe /tmp/verify_scope_<position_type>.json (epígrafe + scope + títulos de artículos + counts)
```

### 2. Lanzar 2 agentes INDEPENDIENTES (Agent tool, model sonnet)
No les cuentes conclusiones previas ni el resultado del otro. Cada uno lee el dump y devuelve `{"resultados":[{"tema":N,"verdict":"CORRECT|ISSUES","motivo":"..."}]}`.

> ⚠️ **LENTE OBLIGATORIA en AMBOS prompts (anti word-matching):** el epígrafe describe una **MATERIA**, a veces por sus **cualidades/conceptos** sin nombrar la ley ni el artículo. Una ley/artículo puede regular esa materia **sin que su título repita la palabra del epígrafe**. NO marques SOBRE-SCOPE porque el título de un artículo no contenga la palabra literal del epígrafe — **solo** si el artículo regula una **materia DISTINTA** (o que pertenece a otro tema del programa). Ej.: "principios generales de la Hacienda" abarca **todo el régimen general del Título I** (derechos/obligaciones económicas incluidos), no solo los artículos titulados "principio". Ante duda genuina, **scope más extenso** (manual de epígrafes §"cobertura por contenido").

**Agente ANALISTA** — prompt:
> Eres auditor de contenido de oposiciones. Verifica que el `topic_scope` de cada tema coincide con su EPÍGRAFE oficial (fuente de verdad de QUÉ entra). Lee el JSON `<ruta_dump>`. Cada tema: `epigrafe`, `scope` (leyes con `rango`, `preguntas_activas`, `articulos`=títulos de artículos escopados). Metodología: (1) cada concepto del epígrafe debe estar cubierto; (2) NO debe haber artículos fuera del epígrafe (SOBRE-SCOPE: el epígrafe pide solo una parte pero el scope trae la ley entera — mira los TÍTULOS de los artículos escopados vs lo que pide el epígrafe); (3) ¿falta alguna ley/concepto del epígrafe?; (4) informática: si el epígrafe no especifica variante escritorio/web, no debería haber ley "· Escritorio". **LENTE ANTI-WORD-MATCHING: el epígrafe describe una MATERIA (a veces por cualidades/conceptos sin citar la ley); un artículo puede regularla aunque su título no repita la palabra del epígrafe — NO marques SOBRE-SCOPE por eso, solo si el artículo es de materia DISTINTA/de otro tema. Ante duda, scope más extenso.** Pocas preguntas NO es problema de scope (no lo marques). Devuelve SOLO JSON: {"resultados":[{"tema":1,"verdict":"CORRECT"|"ISSUES","motivo":"breve; si ISSUES, qué sobra/falta y qué rango sugieres"}]}

**Agente ESCÉPTICO** — prompt:
> Eres un revisor ESCÉPTICO y estricto. Tu misión es CAZAR temas cuyo `topic_scope` NO coincida con su EPÍGRAFE. Asume que hay errores y búscalos. Lee el JSON `<ruta_dump>`. Busca sobre todo SOBRE-SCOPE: el epígrafe delimita una materia concreta pero el scope arrastra la ley entera o artículos de materias no mencionadas — lee los TÍTULOS de los `articulos` y compáralos uno a uno con el `epigrafe`. También leyes/conceptos del epígrafe que falten. **LENTE ANTI-WORD-MATCHING: el epígrafe describe una MATERIA (a veces por cualidades/conceptos sin citar la ley); un artículo puede regularla aunque su título no repita la palabra del epígrafe — NO lo marques SOBRE-SCOPE por eso, solo si es materia DISTINTA/de otro tema. Ante duda, scope más extenso.** NO marques: pocas preguntas (es cobertura), ni solapamientos legítimos entre temas hermanos. Devuelve SOLO JSON: {"resultados":[{"tema":1,"verdict":"CORRECT"|"ISSUES","motivo":"breve"}]}

### 3. Consenso
- `CORRECT` **solo si AMBOS** dicen CORRECT → verdict `correct`.
- Ambos `ISSUES` → verdict `issues`.
- **Discrepan** (uno CORRECT, otro ISSUES) = **DUDA** → verdict **`needs_human`** (estado que **ALERTA a un humano** para que decida; NO cae en `issues` silencioso). El humano es el árbitro, no un 3er agente. Lo mismo para juicios de criterio genuinos (p.ej. límite "principios generales" Cap I vs Título I). Función `scopeConsensus` en `lib/verification/consensus.ts`.

Construir `consensus.json`: `{ "<tema>": { "verdict": "correct"|"issues"|"needs_human", "note": "...", "findings": {...} } }`

### 4. Registrar
```bash
node scripts/verify-topic-scope.cjs record <position_type> /ruta/consensus.json
node scripts/verify-topic-scope.cjs status <position_type>   # ver resultado
```

### 5. Tratar los `verified_issues`
Para cada tema en issues, aplicar el manual de epígrafes:
1. Verificar contra la **estructura real de la ley** (títulos de artículos) y el **`programa_url` oficial** (fuente literal). No adivinar rangos de contenido legal.
2. Decidir el rango correcto (regla de oro: *ante duda genuina, scope más extenso*; estrechar solo si el contenido extra pertenece claramente a otro tema).
3. Aplicar el fix al `topic_scope` (esto lo pone `stale` automáticamente).
4. **Re-verificar** ese tema (repetir 1-4) → vuelve a `verified_correct`.
5. Revalidar caché (`purge-cache` de la ruta del tema, ver `verificar-epigrafe-topic-scope.md` §"revalidar cache").

### 5-bis. Casos genuinamente ambiguos → `needs_human` + SEGUIMIENTO (nota informativa)
Cuando la decisión de scope/epígrafe **no se resuelve con la ley + el programa oficial** porque el temario es ambiguo — típico: **variante de Office no especificada** (Word/Excel escritorio vs web), versión de software, o el alcance de un concepto ("principios generales" Cap I vs Título I) — **NO fuerces la decisión**:
1. Marca el tema **`needs_human`** (no `issues`) para que alerte.
2. **Sigue el seguimiento de la oposición**: el tribunal muy a menudo publica una **NOTA INFORMATIVA / aclaración** posterior a la convocatoria que resuelve justo estas dudas (variante Office, versión, contenido exacto). Ese cambio lo **detecta el seguimiento OEP** (`convocatorias.seguimiento_*` / `oep_detection_signals`, badge 🎯) — al aparecer, revisar la nota y decidir el scope contra ella.
3. Solo cuando haya fuente que lo aclare (nota informativa, o Manuel decide con conocimiento del examen real) → aplicar y re-verificar. Mientras tanto, `needs_human` es el estado honesto: "duda pendiente de aclaración oficial".

Ejemplo real (SMS T24, 10/07): el temario no dice si Word/Excel es de escritorio o web → `needs_human`, a la espera de nota informativa del SMS o decisión de Manuel, en vez de adivinar la variante.

## Cobertura global (badge)
```bash
node scripts/verify-topic-scope.cjs audit          # legible
node scripts/verify-topic-scope.cjs audit --json   # datos del badge de /admin/contenido
```
El badge cuenta temas **pendientes** = `never_verified` + `stale` + `verified_issues`. "Todas perfectas" = 100% `verified_correct` fresco.

## Canales de entrega (badge PULL + digest PUSH) — y por qué NO va en la alerta roja

Dos preguntas DISTINTAS, dos canales:
- **`health-digest.cjs`** (EventBridge→ECS **diario**, email-on-**ROJO**) = *"¿está VIVO y sirviendo?"* — canary HTTP 200 + temas disponibles sirven preguntas + errores 5xx. **NO** consulta verificación: un scope sobre-escopado no es una caída.
- **`content-quality-digest.cjs`** (`npm run digest:calidad`, EventBridge→ECS **semanal**, email **informativo azul**) = *"¿el CONTENIDO es CORRECTO?"* — deuda de verificación scope↔epígrafe por oposición (issues + needs_human), misma fuente que el badge (S1+S2). **Anti-fatiga:** solo manda si hay deuda accionable (issues/needs_human > 0); `never_verified`/`stale` no disparan (son cobertura, no bug). `DRY_RUN=1` imprime sin enviar. Función pura `buildQualityReport` testeada en `__tests__/verification/qualityDigest.test.js`.
- **Badge** en `/admin/contenido` (PULL) = el canal natural del día a día: lo miras cuando entras a curar.

Por qué separados: meter la deuda de calidad en el email rojo de caídas generaría **rojo permanente** (fatiga) — la deuda de scope no urge como una caída. El único caso que SÍ es rojo de verdad (comodín-NULL que fuga una ley entera, tipo T101) lo pilla el canary indirectamente (temas incoherentes) y el pipeline por-oposición.

**Despliegue del digest semanal** (infra, mismo patrón que health-digest): regla EventBridge Scheduler semanal → task ECS Fargate que corre `node scripts/content-quality-digest.cjs` con `DATABASE_URL`+`RESEND_API_KEY` desde SSM. Mientras no esté programado, corre a mano: `npm run digest:calidad` (o `DRY_RUN=1 npm run digest:calidad`).

## Sistema 2 — Clonación del epígrafe oficial (convocatoria → BD)  *(antes «Literalidad del epígrafe»)* — integrado en convocatorias/OEP

> **Es el PASO 1 (bloqueante).** Ver "Orden de los DOS pasos" arriba.

Sistema **independiente pero relacionado** con el de scope. Pregunta: *"¿`topics.epigrafe` es el texto LITERAL del temario de la convocatoria vigente?"* (el fallo T17: epígrafe paráfrasis). Fuente = `convocatorias.programa_url` (por-convocatoria); detección = el seguimiento OEP existente, extendido al programa (`convocatorias.programa_last_hash`).

**Provenance de la fuente exacta (columnas `topic_epigrafe_verification.source_url` + `source_notes`, desde 13/07):** al confirmar un epígrafe (Paso 1), se guarda la **URL exacta** del documento oficial del que se sacó + un comentario libre, para ir DIRECTO a la fuente en cada re-verificación (crítico para el ~30% de boletines no parseables). El `consensus.json` de `record` acepta `source_url` y `source_notes` por tema. Se muestran como enlace en el drill-down "Epígrafe" de `/admin/contenido`. Migración `20260713_epigrafe_source_url.sql`.

**Estados** (`topic_epigrafe_verification` + vista `topic_epigrafe_verification_effective`): `never_sourced` / `verified_literal` / `drift_detected` / `provisional_anterior` / `stale` / `outdated_convocatoria` (derivado: la convocatoria vigente o su programa cambió).

**Cascada a S1:** cuando corriges un epígrafe en `drift_detected`, el trigger de S1 pone su scope `stale` → re-verificar scope. Una dirección.

**Procedimiento:**
```bash
node scripts/verify-epigrafe-literality.cjs dump <position_type>
#   fetch programa_url de la convocatoria vigente → hash a convocatorias.programa_last_hash
#   → parsea el temario oficial → vuelca {tema, epigrafe_bd, oficial}
#   ⚠️ si el boletín no parsea (temario_parseado < 3): literalidad NO verificable automáticamente
#      para esa oposición (los 42 boletines son heterogéneos, ~30% no parsean).
```
Luego agente(s) juzgan `epigrafe_bd` vs `oficial` por tema → veredicto `literal` (permite abreviaturas/erratas/formato) o `drift` (difiere materialmente / cambia el alcance) → consenso →
```bash
node scripts/verify-epigrafe-literality.cjs record <position_type> /ruta/consensus.json
node scripts/verify-epigrafe-literality.cjs status <position_type>
```
Tratar los `drift_detected`: coger el texto oficial literal del temario → **actualizar `topics.epigrafe`** (cambiarlo dispara el trigger → re-verificar S1 scope) → revalidar caché. Cuando **el radar/seguimiento detecta convocatoria nueva** (badge 🎯 OEPs), los epígrafes pasan a `outdated_convocatoria` → re-sourcing.

### Clonación MANUAL cuando el boletín NO parsea (~30% de casos) — método probado

Cuando `dump` da `temario_parseado=0` (los portales GVA/DOGV son SPA de JS y WebFetch no los lee), la clonación se hace **a mano contra el PDF PRIMARIO**. Método validado (subalterno_gva, 13/07):

1. **Encuentra el PDF primario** (NO las páginas de sede/sumario, que son SPA): `WebSearch` acotado con `allowed_domains:["dogv.gva.es"]` (o `boe.es`) + la referencia de la convocatoria → devuelve la **URL directa del PDF** con patrón `dogv.gva.es/datos/AAAA/MM/DD/pdf/AAAA_NNNNN_es.pdf`. Ejemplo real: `…/2026/03/26/pdf/2026_8075_es.pdf` (conv. 80/26, DOGV núm. 10330).
2. **Lee el PDF** (es legible, NO es SPA): `WebFetch` del PDF guarda el binario en local y devuelve la ruta → `Read` ese fichero con `pages:"1-N"`. El temario va en un **Anexo** al final (aquí, Anexo IV).
3. **Compara VERBATIM** el temario oficial (Anexo) contra `topics.epigrafe` de la BD, tema a tema. Señal de literal correcto: mismos Títulos/Capítulos/Secciones. **Una ley nombrada SIN delimitar = ley entera** (contraste deliberado con las delimitadas del mismo tema → esto INFORMA el scope del Paso 2: p.ej. Ley 9/2003 y Decreto 42/2019 en subalterno_gva van completos).
4. **Registra** con `record` un `consensus.json` de TODOS los temas: `verdict:"literal"` + **`source_url` = la URL EXACTA del PDF (con su nº de doc)** + `source_notes` con los identificadores (DOGV núm., fecha, convocatoria, ORDEN, Anexo, `programa_hash`) para re-verificación directa.

**Gotchas del sourcing manual:**
- `sede.gva.es/…` y `dogv.gva.es/…/sumari` = **SPA** → WebFetch devuelve solo el cascarón. Hay que ir al **PDF `/datos/…` directo** (WebSearch acotado al dominio lo encuentra).
- `dump` captura el `programa_hash` **aunque no parsee** → el drift futuro se detecta igual (no pierdes la vigilancia).
- Guarda SIEMPRE la URL del PDF **con su numeración** (`2026_8075`) en `source_url`: es el puntero durable para la próxima revisión — no re-buscar.
- Es Paso 1: hasta que las N temas no queden `verified_literal`, **NO** se cierra el Paso 2 (scope).

**Visibilidad (columna "Epígrafe" en `/admin/contenido`, desde 13/07):** por oposición, badge `X/Y` con color (🟢 todos literal · 🟡 drift/stale · 🔵 faltan por verificar · ⚪ `—` sin verificar) y, al pinchar, **modal tema a tema** (epígrafe BD + estado + hallazgo + fecha). Es el mapa de "qué falta": las oposiciones sin `dump`/`record` salen `—`. Helper puro `lib/api/admin-contenido/epigrafeBadge.ts`; agregación en `getContenidoOverview` (CTE `epi`); drill-down `getEpigrafeDetail` + `/api/admin/contenido/epigrafe/[slug]`. Cobertura al lanzar: 3/115 oposiciones. Detalle: memoria `project_epigrafe_verificacion_columna_admin`.

## Gotchas
- El `dump` lee `topic_scope` en vivo — corre siempre `dump` justo antes de los agentes.
- Un `programa_url` puede estar stale/apuntar mal (Vector 3 del manual) — si el temario oficial no cuadra por número, es otro sabor de bug (numeración/versión), no lo fuerces.
- Datos contaminados: notas TODO (`_tmp_hold`) coladas en `article_numbers` aparecen como "artículos" — limpiar el dato, no es scope.
- El sistema verifica **scope↔epígrafe (semántico)**, no literalidad byte-a-byte del boletín (ver memoria `reference_epigrafe_programa_url_en_bd`: el epígrafe de BD no está garantizado literal).

## Huecos del temario: títulos huérfanos (`scope_titulo_huerfano`)

> **Frase-gatillo: *"revisa los huecos del temario"*.** Complementa al pipeline de arriba: éste
> verifica lo que SÍ está escopado; el detector de huérfanos caza lo que **falta**.

**Qué detecta** (prefiltro determinista del barrido nocturno, `scripts/health-sweep.cjs`): un
**título** de una ley que la oposición sí usa, con ≥8 preguntas activas, con **0 artículos suyos
en el `topic_scope`** de esa oposición, y flanqueado a ambos lados por artículos escopados de la
misma ley (hueco **INTERNO**, no un recorte de borde). Son preguntas ya en BD que el usuario no
puede practicar.

**Es un UPPER BOUND ruidoso.** Análisis a fondo del backlog (20/07, 471 títulos / 98 oposiciones):
la precisión cruda medida a mano fue **~25 %**. No lo drenes fila a fila ni te lo creas al pie de
la letra. Herramientas: `scripts/scope/analiza-titulos-huerfanos.cjs` (reproduce el prefiltro y lo
enriquece con demanda/clusters) y `scripts/scope/refina-titulos-huerfanos.cjs` (separa hueco real
de artefacto).

### Cómo drenarlo (por CLUSTER, no por fila)

Las 471 filas son solo **42 criterios únicos** `(ley, título)` → **11,2x de apalancamiento**. Decidir
"¿el programa de tipo X incluye el Título IV de la Ley 7/1985?" resuelve decenas de filas de golpe.
Ordena por `preguntas × usuarios` y ataca clusters.

### Las 3 fuentes de ruido (medidas, con su antídoto)

1. **Cola suelta (18 % de las filas).** El criterio "flanqueado" usa solo min/max de los artículos
   escopados: **un único artículo lejano** hace que TODOS los títulos intermedios parezcan hueco.
   *Caso real:* `auxiliar_administrativo_madrid` escopa CE 0-55 (lo que pide su epígrafe) **+ art.116**
   (por "garantía y **suspensión**" de derechos) → como el 116 es del Título V, los Títulos II
   (Corona), III (Cortes) y IV (Gobierno) saltan como huérfanos aunque el programa de Madrid no los
   incluya. **3 falsos positivos de un artículo.**
   → **Antídoto:** métrica de **fuerza del flanco** (nº de artículos escopados a cada lado). Si un
   lado se sostiene sobre ≤2 artículos, es artefacto de cola.

2. **Word-matching contra el epígrafe equivocado.** Buscar las palabras del título en *todos* los
   epígrafes de la oposición da falsos masivos: "El Gobierno **de Canarias**" casa con CE Tít.IV
   "Del Gobierno"; "**adquisición** de patrimonio" casa con EBEP "Adquisición de la relación de
   servicio"; "bienes de las **entidades locales**" casa con "Otras entidades locales".
   → **Antídoto:** comparar SOLO contra los epígrafes de los **temas que escopan esa ley**
   (atar tema↔ley). Bajó los candidatos de 120 → 49.

3. **El nombre de la propia ley.** "Ley 40/2015 de Régimen Jurídico del **Sector Público**" casa con
   su título "Sector público institucional" sin que el programa lo pida.
   → **Antídoto:** descontar las palabras del nombre de la ley antes de comparar.

**Señal de mayor valor:** que la **frase del título aparezca casi literal y agrupada** en el epígrafe
del tema que escopa esa ley. Bolsa-de-palabras genérica ("entidades locales") es débil; frase larga y
distintiva ("relaciones entre el Gobierno y las Cortes Generales") es casi siempre hueco real.

### ⚠️ NO descartes por "ya verificado" — es el punto ciego del pipeline

Tentación (y error cometido y revertido el 20/07): filtrar los `(oposición, ley)` cuyos temas ya están
`verified_correct` asumiendo que el recorte fue deliberado. **Esconde justo lo que este detector existe
para cazar.** 169 de las 471 filas caen en temas ya verificados — y entre ellas está el mejor hallazgo:

> **`administrativo_seguridad_social` · CE Título V (108-116) · 227 preguntas · 156 usuarios.**
> Escopa 153 artículos de la CE y **ninguno** del 108-116, pese a que el epígrafe del **T7 dice
> literalmente "Relaciones entre el Gobierno y las Cortes Generales"**. Sus temas de CE están
> `verified_correct`: el pipeline los dio por buenos y el hueco existe igual.

`verified_correct` es **bandera de contexto, nunca filtro**.

### Adjudicación

Con el cluster priorizado, la decisión sigue siendo del pipeline `verify:scope` (epígrafe↔scope) contra
el **programa oficial**: si el epígrafe pide el título → **añadir su rango al scope reusando el banco ya
en BD**; si el programa no lo incluye → **dejarlo**. Nunca añadir un título que el epígrafe no pida ni
quitar el que sí. Caso raíz resuelto: CE Título V huérfano en Diputación de Córdoba (186 preguntas).

## Sobre-inclusión de scope: scope más ancho que el epígrafe (`scope_over_inclusion_suspect`)

> **Frase-gatillo: *"revisa la sobre-inclusión del temario"*.** El **reverso** de los títulos
> huérfanos: allí FALTA scope, aquí SOBRA. El epígrafe enumera sub-materias CONCRETAS de una ley
> pero el `topic_scope` mete **casi la ley entera** → el tema sirve preguntas **fuera de programa
> en silencio**.

**Por qué se nos escapó (caso raíz 21/07, SMS T11 Ley 3/2009):** doble punto ciego. (1) Los
detectores de HUECOS (`empty_topic`, `low_coverage`, `scope_titulo_huerfano`,
`scope_phantom_article`) no lo ven porque el tema rebosa preguntas. (2) El pipeline `verify:scope`
lo dio en **FALSO VERDE** — el juicio LLM razonó a grano grueso ("la ley va de derechos/deberes →
cabe entera") sin mapear los 4 bloques del epígrafe a Títulos II-IV + VII y ver que excluye Títulos
I, V (consentimiento), VI (historia clínica), VIII (garantías). El run lo marcó `verified_correct`
a las 18:34; una usuaria lo cazó a las 18:38.

**Sistema de 2 fases (embudo):**
1. **Stage-1 determinista** — `lib/laws/scopeOverInclusion.ts` (`classifyScope`), mirror en
   `health-sweep.cjs` (kind `scope_over_inclusion_suspect`). Baja ~5.800 scopes → decenas de
   sospechosos. Señales: cobertura ≥90 % de una ley grande (≥12 arts) + epígrafe enumerador
   (colon + ≥3 segmentos por `;`/`,`); reglas de alta confianza = epígrafe con **títulos-con-hueco**
   (nombra II y IV, salta III) o **artículos citados** (arts. 45 a 49) que el scope ignora. Guardas
   negativas: epígrafe que declara la ley "íntegra", o que enumera **todos** los títulos en
   secuencia + cierre (reforma/disposiciones) = monográfico legítimo. **Solo la banda HIGH pinga el
   badge**; la MEDIUM (patrón prosa tipo T11, precisión ~35 %) es la cola de adjudicación bajo
   demanda. Scan ad-hoc: `node scripts/scope-over-inclusion.cjs --scan`.
2. **Stage-2 adjudicador (LLM)** — para cada sospechoso: obtén la **estructura oficial** de la ley
   (títulos/capítulos y rangos, vía BOE/BORM con WebFetch), **mapea cada materia que nombra el
   epígrafe** a su título/capítulo, y **LISTA los títulos con preguntas escopadas que el epígrafe NO
   nombra**. Es el paso que le faltó a `verify:scope`.

**Remediar:** si el epígrafe acota de verdad (deja títulos fuera) → recortar `article_numbers` a lo
que pide el epígrafe (las preguntas fuera quedan en BD, dejan de servirse en ese tema, pueden servir
a otras oposiciones). Si el epígrafe abarca genuinamente toda la ley → falso positivo, dejar.
**NUNCA** recortes un bloque que el epígrafe sí pide, ni des por buena la ley entera sin mapear su
estructura (ese atajo fue el falso verde). El límite fino de artículos siempre se confirma con la
fuente oficial + revisión humana.
