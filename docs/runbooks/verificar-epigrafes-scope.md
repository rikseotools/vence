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

## Modelo mental

- Estado por tema en `topic_scope_verification`: `never_verified` → `verifying` → `verified_correct` | `verified_issues` → (`stale` si cambia el scope/epígrafe).
- **`verified_issues` NO significa "seguro mal"** — significa "al menos un pase independiente encontró algo, revisión humana". Unos son bugs claros, otros límites debatibles.
- Solo `record_topic_verification()` marca verificado (captura el hash). Un edit manual de scope dispara el trigger → `stale`. Nunca queda un "verificado" viejo colgado.
- **Claude en el bucle:** el usuario dispara, Claude ejecuta este runbook. No es un cron autónomo.

## Procedimiento

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

## Sistema 2 — Literalidad del epígrafe vs convocatoria (integrado en convocatorias/OEP)

Sistema **independiente pero relacionado** con el de scope. Pregunta: *"¿`topics.epigrafe` es el texto LITERAL del temario de la convocatoria vigente?"* (el fallo T17: epígrafe paráfrasis). Fuente = `convocatorias.programa_url` (por-convocatoria); detección = el seguimiento OEP existente, extendido al programa (`convocatorias.programa_last_hash`).

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

## Gotchas
- El `dump` lee `topic_scope` en vivo — corre siempre `dump` justo antes de los agentes.
- Un `programa_url` puede estar stale/apuntar mal (Vector 3 del manual) — si el temario oficial no cuadra por número, es otro sabor de bug (numeración/versión), no lo fuerces.
- Datos contaminados: notas TODO (`_tmp_hold`) coladas en `article_numbers` aparecen como "artículos" — limpiar el dato, no es scope.
- El sistema verifica **scope↔epígrafe (semántico)**, no literalidad byte-a-byte del boletín (ver memoria `reference_epigrafe_programa_url_en_bd`: el epígrafe de BD no está garantizado literal).
