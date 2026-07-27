# Runbook: Verificar epígrafes / contenido de una oposición (topic_scope)

**Cuándo consultarlo (CUALQUIERA de estas → este runbook):** el usuario dice *"verifica los epígrafes"*, *"verifica el contenido"*, *"verifica el scope"* de una oposición; o el **badge de verificación en `/admin/contenido`** está encendido. Seguir este runbook ANTES de improvisar.

Verifica que el `topic_scope` (artículos asignados a cada tema) **se corresponde con el epígrafe oficial** de cada tema, con **2 agentes independientes** (consenso), y deja constancia durable (estado + cuándo + hallazgos). Se **auto-invalida** cuando cambia el epígrafe/scope (trigger).

> Complementa al manual `docs/maintenance/verificar-epigrafe-topic-scope.md` (la metodología de fondo). Este runbook es el **procedimiento operativo** del sistema de verificación con provenance.

## ⚠️ Regla previa OBLIGATORIA — orden de trabajo cuando lo dispara un USUARIO

> 🗺️ **ENFORZADA POR CÓDIGO (desde 24/07):** los dossiers `revisar-impugnacion.cjs` y `revisar-feedback.cjs` detectan solos cuando la queja va de temario/epígrafe/scope y **imprimen un CHECK con el estado Paso 1/Paso 2 de la oposición + un 🛑 bloqueante si el epígrafe está `never_sourced`**. Módulo `scripts/impugnaciones/lib/scope-enforcement.cjs`. Nace porque la regla se saltaba (caso Sara 24/07: scope `verified_correct` pero epígrafe `never_sourced` = falso verde). Si ves el 🛑, haz el Paso 1 antes de resolver.

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

> 🆕 **Temario versionado por convocatoria (desde 25/07).** El temario ahora es una entidad versionada (`temario_versions`) que las convocatorias referencian — **el temario cuelga de una convocatoria, no de la oposición "en abstracto"**. Consecuencias para este runbook: (1) cada oposición activa tiene 1 `temario_version` `active`+default (Fase 1; los topics llevan `temario_version_id`); (2) al detectar una **convocatoria nueva** el sistema marca la oposición en la cola `temario_revision_pendiente` (frase *"revisa las revisiones de temario pendientes"*) → tocará repetir Paso 1 (clonar el epígrafe nuevo) + Paso 2 (re-verificar scope) contra su fuente, y aplicar los diffs al temario vivo (el temario suele ser estable pero SIEMPRE cambia algo); (3) fallback: OEP aprobada sin temario propio → se sirve el de la convocatoria anterior (vista `convocatoria_temario_efectivo`). Diseño completo: `docs/roadmap/temario-versionado-por-convocatoria.md`. **Caso raíz:** `auxiliar_administrativo_extremadura` (temario parafraseado que no casaba con el Anexo IV 2024; se realineó epígrafes verbatim + reparto de scope 25/07).

> Gotcha: ~30% de los boletines GVA/DOGV no parsean en automático (SPA/PDF). Cuando `verify-epigrafe-literality dump` da `temario_parseado=0`, el hash SÍ se captura (drift futuro) pero la **clonación/confirmación se hace a mano** contra el DOGV oficial, tema a tema, antes del Paso 2.
>
> 🧩 **Aprendizajes de la campaña T-107 (25/07, memoria `reference-verify-epigrafe-fuentes-multibloque`):**
> - **El campo `oficial` del dump NO es fiable en fuentes multi-bloque/multi-cuerpo** (DRIFT masivo = 0 exactos). Extraer a mano el bloque del cuerpo correcto: BOCYL = ANEXO por cuerpo (el auxiliar suele ser el ANEXO II, no el I=administrativo); BOE de Justicia = ANEXO VI.c con "Tema" en **espacio duro `\xa0`** (`grep "Tema [0-9]"` da 0); DOGV/BOC/BORM/SS = **dos partes numeradas 1-N** (parte general + específica) que BD aplana → capturar en orden y partir por el reinicio del número.
> - **PATRÓN mismatch `programa_url` ≠ temario de BD → FLAGGEAR, no reescribir** (`project-cadiz-temario-desalineado-scope`). Si el dump da DRIFT masivo y la frase distintiva de BD T1 **no aparece** en la fuente descargada → sospechar desfase de convocatoria / anuncio multi-categoría / programa legal vs temario de estudio. Registrar `drift_detected` y confirmar la convocatoria vigente ANTES de tocar. Casos: Cádiz, Murcia, Asturias.
> - **Fuentes con WAF/SPA → Playwright** (`reference-fetch-boletin-waf-playwright`): BOA/mia.aragon.es (SPA CSV → `page.on('response')` filtra el PDF), BOPZ (`boletin.dpz.es`, curl=http 000 → evento `download`). El programa de Aragón NO está en el BOA sino en `mia.aragon.es` por CSV.
> - **Boletines nuevos reconocidos por el canonicalizador** (para el enlace al hub): BOC (Canarias), BOJA (Andalucía), DOG (Galicia), MIA (Aragón CSV). Ver `provenance-convocatorias.md §0.bis`.

> 🧩 **EL PROGRAMA PUEDE ESTAR REPARTIDO EN VARIOS DOCUMENTOS (base + comunicados) — apunte crítico.** La convocatoria publica un programa, pero luego salen **notas/comunicados que lo AFINAN**: por dudas, por versiones de software, por añadir una 2ª parte, etc. El `programa_url` es UN solo campo → NO basta mirar ese PDF. **Verifica cada tema contra su documento fuente REAL** (base o comunicado) y enlaza `source_documento_id` por-tema (el modelo lo soporta: distintos temas pueden apuntar a distintos documentos). Los comunicados **ya están clonados en el hub** (`convocatoria_documentos`, `tipo='nota'`, 6.403 a 25/07) con su URL+texto → **léelos del hub, cero re-descarga**. **Los feedbacks suelen señalar estos casos** (un usuario avisa "en la 2ª parte entra X según el BOE"). **Caso raíz CARM (25/07):** el programa base 2016 (BORM, 16 temas) NO tenía ofimática; casi jubilo 5 temas — pero el BORM 2025 (disp. 5341) + notas afinaban con un Anexo de PowerPoint/Excel/Firma/Word/Outlook, y un feedback lo señalaba. T1-16 se verificaron contra el base 2016, T17-21 contra el comunicado 2025. **NUNCA concluir "temario de más" sin mirar los comunicados del hub + los feedbacks.**

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
>
> ⚠️ **CARVE-OUT — TÍTULO COMPUESTO (contrapeso de la lente anterior):** el `dump` incluye la **materia** de cada artículo (heading `nº: Artículo N · <Materia>`, extraído del contenido). Úsala. Cuando el epígrafe pide un concepto que es **sub-parte de un título cuyo nombre agrupa dos materias** ("Derechos de **X y de Z**") y el epígrafe **solo cita X**, los artículos cuya materia es **Z** SÍ son SOBRE-SCOPE aunque estén en el mismo título → marca **ISSUES**. Aquí NO aplica "ante duda, scope más extenso": es una materia que el programa omitió a propósito. Caso raíz: SMS T11, Ley 3/2009 Título II = "promoción de la salud **y** atención sanitaria"; el epígrafe pide "atención y asistencia sanitaria" → el art 10 "Derechos básicos en **promoción de la salud**" sobra (los colectivos 15-20 SÍ son atención sanitaria, se quedan). Distingue las dos direcciones: título NO repite la palabra pero misma materia = NO tocar; mismo título pero **materia del otro concepto del compuesto** = sobra.

**Agente ANALISTA** — prompt:
> Eres auditor de contenido de oposiciones. Verifica que el `topic_scope` de cada tema coincide con su EPÍGRAFE oficial (fuente de verdad de QUÉ entra). Lee el JSON `<ruta_dump>`. Cada tema: `epigrafe`, `scope` (leyes con `rango`, `preguntas_activas`, `articulos`=lista `nº: Artículo N · <Materia>` de cada artículo escopado — usa la MATERIA). Metodología: (1) cada concepto del epígrafe debe estar cubierto; (2) NO debe haber artículos fuera del epígrafe (SOBRE-SCOPE: el epígrafe pide solo una parte pero el scope trae la ley entera — mira la MATERIA de los artículos escopados vs lo que pide el epígrafe); (3) ¿falta alguna ley/concepto del epígrafe?; (4) informática: si el epígrafe no especifica variante escritorio/web, no debería haber ley "· Escritorio". **LENTE ANTI-WORD-MATCHING: el epígrafe describe una MATERIA (a veces por cualidades/conceptos sin citar la ley); un artículo puede regularla aunque su título no repita la palabra del epígrafe — NO marques SOBRE-SCOPE por eso, solo si el artículo es de materia DISTINTA/de otro tema. Ante duda, scope más extenso.** **CARVE-OUT título compuesto: si el epígrafe pide un concepto de un título "X y Z" y solo cita X, los artículos de materia Z SÍ sobran (marca ISSUES) — ahí no rige "scope más extenso".** Pocas preguntas NO es problema de scope (no lo marques). Devuelve SOLO JSON: {"resultados":[{"tema":1,"verdict":"CORRECT"|"ISSUES","motivo":"breve; si ISSUES, qué sobra/falta y qué rango sugieres"}]}

**Agente ESCÉPTICO** — prompt:
> Eres un revisor ESCÉPTICO y estricto. Tu misión es CAZAR temas cuyo `topic_scope` NO coincida con su EPÍGRAFE. Asume que hay errores y búscalos. Lee el JSON `<ruta_dump>`. Busca sobre todo SOBRE-SCOPE: el epígrafe delimita una materia concreta pero el scope arrastra la ley entera o artículos de materias no mencionadas — lee la MATERIA de cada `articulos` (`nº: Artículo N · <Materia>`) y compárala una a una con el `epigrafe`. También leyes/conceptos del epígrafe que falten. **LENTE ANTI-WORD-MATCHING: el epígrafe describe una MATERIA (a veces por cualidades/conceptos sin citar la ley); un artículo puede regularla aunque su título no repita la palabra del epígrafe — NO lo marques SOBRE-SCOPE por eso, solo si es materia DISTINTA/de otro tema. Ante duda, scope más extenso.** **CARVE-OUT título compuesto: si el epígrafe pide un concepto de un título "X y Z" y solo cita X, los artículos de materia Z SÍ sobran → márcalos ISSUES (ahí no rige "scope más extenso"). Ej.: art "promoción de la salud" sobra en un tema que pide solo "atención sanitaria".** NO marques: pocas preguntas (es cobertura), ni solapamientos legítimos entre temas hermanos. Devuelve SOLO JSON: {"resultados":[{"tema":1,"verdict":"CORRECT"|"ISSUES","motivo":"breve"}]}

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

> **Provenance ENLAZADA al hub (T-107, 24/07):** además del `source_url` (texto, espejo), `record` **enlaza el epígrafe al documento oficial clonado** vía `topic_epigrafe_verification.source_documento_id` → `convocatoria_documentos` (mismo patrón que los hitos). Lo hace canonicalizando el `source_url` (`lib/convocatoria/canonicalizeBoletinUrl.cjs`) y llamando a `ensure_convocatoria_documento` (camino único, dedup por `doc_key`). Así "verificado contra la fuente oficial" apunta al **snapshot clonado con hash**, no a una URL que puede dar 404. El detector `epigrafe_provenance_no_doc` (frase *"revisa la provenance de epígrafes"*) caza los `verified_literal` sin enlazar. Detalle: `provenance-convocatorias.md` §0.bis.

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

### Clonación MANUAL cuando el boletín NO parsea — método probado

> ⚠️ **Antes de darlo por "no parseable", comprueba que no sea culpa nuestra (27/07/2026).** `execFileSync` trae un `maxBuffer` de **1 MB** por defecto, y los boletines que publican el programa de TODOS los cuerpos lo pasan de largo: la Orden PRE/76/2024 de Cantabria extrae **1.205.140 caracteres**. Al desbordar, `pdftotext` lanzaba y el `catch` lo traducía a `pdf_empty` — o sea, **los documentos con MÁS temario eran justo los que se declaraban ilegibles**, y en silencio. Arreglado en `fetchProgramaText` (256 MB; timeout de descarga configurable con `VERIFY_FETCH_TIMEOUT`). Efecto medido al repuntar Cantabria: el `dump` pasó de `pdf_empty` a `fetch=pdf` con 58 bloques parseados, y `tcae_murcia`, `auxiliar_administrativo_madrid_2027`, `auxiliar_enfermeria_gva` y `auxiliar_enfermeria_osakidetza` pasaron a extraer texto. **La cifra de "~30% no parsean" incluía este bug: mide de nuevo antes de asumir trabajo manual.** Los que siguen sin parsear son los de `fetch=html` (el `programa_url` apunta a un portal, no a un documento).

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

### ⚠️ El programa puede estar MODIFICADO por una Orden POSTERIOR (punto ciego, 27/07/2026)

**El `programa_url` de la convocatoria apunta a UN documento y se queda ahí para siempre.** Si el boletín publica después una Orden que **modifica** ese programa, el `dump` sigue comparando contra el texto viejo y **todo cuadra en verde estando mal**. Ningún detector lo ve: no es un enlace roto (la URL vive y es del boletín correcto), no es un ciclo cerrado, y el hash no cambia porque el documento original no ha cambiado — es que ya no es el vigente.

**Caso raíz `auxiliar_administrativo_cantabria`:** el `programa_url` apunta a la **Orden PRE/76/2024** (BOC 171, 4/09/2024), y el programa exigible de hoy es esa Orden **modificada por la Orden PRE/12/2026, de 10 de febrero** (BOC 30, 13/02/2026), que sustituye el T16 de la parte general y **la parte específica entera** (Windows 10/Office 2016 → Windows 11/Microsoft 365/Teams/Seguridad). Quien lo detectó no fue el sistema: fue **una usuaria** (07/07/2026, *"el temario de la parte específica ha cambiado, ¿se va a actualizar?"*). Y una sesión posterior, comparando contra el `programa_url`, estuvo a punto de **revertir** el temario correcto a la versión vieja «por fidelidad al boletín».

**Comprobación obligatoria antes de declarar drift contra el programa (30 segundos, y evita un destrozo):**
1. **La convocatoria manda, no el `programa_url`.** Lee la norma de la convocatoria que declara el programa exigible (*"El programa de materias exigible… es el que figura en la Orden X"*) — ahí está el documento bueno, con su número.
2. **Busca modificaciones de ESA Orden** en el boletín (`"modifica la Orden <X>"` + el nombre del cuerpo). Las modificaciones de temario suelen publicarse justo antes de una convocatoria nueva.
3. **Señal de alarma que NO se puede ignorar:** si la parte general casa verbatim y **solo** una sección entera (típicamente ofimática) diverge, casi nunca es que nos lo hayamos inventado — es que **esa sección se modificó** y el `programa_url` apunta a la versión anterior.
4. Al confirmarlo, **repunta el `programa_url`** a la Orden vigente con `repuntar-enlace-convocatoria.cjs` (escritor registrado; resetea `programa_last_hash`), o el `dump` seguirá comparando contra el documento superado para siempre.

### Reescribir los epígrafes: `verify:epigrafe apply` (NO a mano)

Cuando la comparación da drift REAL y hay que alinear la BD al literal oficial, **no se editan los `topics` a mano**:

```bash
npm run verify:epigrafe -- apply <position_type> <plan.json>            # DRY-RUN: diff campo a campo
npm run verify:epigrafe -- apply <position_type> <plan.json> --apply    # escribe
```

`plan.json` = `{ "<tema>": { title, epigrafe, description, descripcion_corta, oficial?, oficial_manual?, source_url, source_notes } }`. La guarda pura (`lib/temario/epigrafeApply.js`, 15 tests) **rechaza el plan entero** —sin escribir nada— si:

- falta cualquiera de los **4 campos de display** (`title`, `epigrafe`, `description`, `descripcion_corta`). Es la checklist de abajo convertida en invariante: estaba escrita en el manual y **aun así se incumplió** el 08/07/2026;
- el `epigrafe` propuesto **no coincide con el literal oficial** → por esta puerta no entra temario inventado. Para los ~30% de boletines que no parsean, la literalidad se acredita a mano con `oficial` + `oficial_manual: true` + `source_url`, y el comando lo **anuncia en voz alta** (excepción trazable, no agujero);
- hay **drift de versión/app** entre los campos, con la misma definición que usa el detector nocturno (`lib/temario/displayDrift.js` — un solo concepto, dos usuarios: el detector a posteriori y el escritor a priori).

Al aplicar: transacción → `record_epigrafe_verification` a `literal` con su fuente → recache compartida (`scripts/lib/temario-recache.cjs`: MV + purga de rutas + revalidate-temario). **Ojo:** reescribir el epígrafe dispara el trigger que deja el **scope en `stale`** → toca re-verificar el Paso 2 de esos temas (sin cambio de contenido, pero hay que cerrarlo).

**Por qué la literalidad no es cosmética (caso Cantabria 27/07/2026):** los 7 temas de informática tenían la versión CORRECTA pero escritos "a ojo". La paráfrasis sonaba igual de bien… y se había comido *"Navegadores Google Chrome y Microsoft Edge: favoritos, historial, búsqueda, certificados personales"*, *"Herramienta Recortes"* y *"Snap Layouts"*. Medido: la oposición servía **CERO preguntas de navegadores** pese a que el programa vigente las exige. Una paráfrasis fiel en el tono es indistinguible de una infiel en el alcance — por eso se exige verbatim.

### Tras reescribir a literal: medir la materia GANADA (`sim-materias-ganadas`)

Reescribir un epígrafe condensado a su literal **casi siempre añade materia**, y eso invalida el Paso 2 **hacia arriba**: el veredicto anterior se emitió contra el texto viejo, que no pedía lo nuevo. Sellar esos temas en bloque como `correct` es declarar una cobertura que nadie ha medido.

```bash
node scripts/temario/sim-materias-ganadas.cjs <position_type> [--json salida.json]
```

Compara el epígrafe anterior (del `dump` previo, que queda en `/tmp/verify_epigrafe_<pt>.json`) con el actual, extrae los segmentos añadidos y mide si el tema **sirve preguntas de esa materia**. Con eso el Paso 2 se cierra con datos: el tema que ganó materia **y la sirve** recupera su veredicto; el que tiene hueco va a `issues` **con el bloque concreto escrito**.

Medido el 27/07/2026: `tcae_murcia` 40 temas ganaron materia y solo **8** segmentos sin cobertura (37 correct / 6 issues); `tcae_galicia` 22 y **3** (19 correct / 3 issues). Uno de los de Galicia —*"Representación, participación y negociación colectiva"*— se había detectado antes a mano leyendo el diff: la herramienta lo encuentra sola, que es justo lo que no escala a 75 oposiciones.

### Añadir una ley a un tema: `verify:scope` con `ley_nueva`

El pipeline de scope sabía recortar y ampliar **dentro de una ley que el tema ya tenía**. Desde el 27/07 también admite **añadir una ley nueva** al tema (el movimiento con el que se tapan los huecos que deja una reorganización de temario, y el que hace falta cuando una norma sustituye a otra): basta con proponerla en el `veredicto` con sus `anadir`. El pipeline comprueba que la ley existe, que **sus artículos existen y están activos** (si no, estaría creando artículos fantasma en el scope) y mide **cuántas preguntas pasan a servirse**. Se clasifica **SIEMPRE como puerta de juicio** (`ley_nueva` → exige `--include-gate`): decir "este tema también va de esta norma" no tiene versión mecánica, y el gate de impacto no lo veía porque mide preguntas que SALEN, y una ley nueva no saca ninguna.

**Visibilidad (columna "Epígrafe" en `/admin/contenido`, desde 13/07):** por oposición, badge `X/Y` con color (🟢 todos literal · 🟡 drift/stale · 🔵 faltan por verificar · ⚪ `—` sin verificar) y, al pinchar, **modal tema a tema** (epígrafe BD + estado + hallazgo + fecha). Es el mapa de "qué falta": las oposiciones sin `dump`/`record` salen `—`. Helper puro `lib/api/admin-contenido/epigrafeBadge.ts`; agregación en `getContenidoOverview` (CTE `epi`); drill-down `getEpigrafeDetail` + `/api/admin/contenido/epigrafe/[slug]`. Cobertura al lanzar: 3/115 oposiciones. Detalle: memoria `project_epigrafe_verificacion_columna_admin`.

## Gotchas
- El `dump` lee `topic_scope` en vivo — corre siempre `dump` justo antes de los agentes.
- Un `programa_url` puede estar stale/apuntar mal (Vector 3 del manual) — si el temario oficial no cuadra por número, es otro sabor de bug (numeración/versión), no lo fuerces.
- Datos contaminados: notas TODO (`_tmp_hold`) coladas en `article_numbers` aparecen como "artículos" — limpiar el dato, no es scope.
- El sistema verifica **scope↔epígrafe (semántico)**, no literalidad byte-a-byte del boletín (ver memoria `reference_epigrafe_programa_url_en_bd`: el epígrafe de BD no está garantizado literal).

## Artículos fantasma del scope (`scope_phantom_article`): re-anclar preguntas invisibles

Un artículo escopado pero con `articles.is_active=false` **no se sirve, aunque tenga preguntas
activas**: contenido ya escrito que ningún opositor ve. La remediación casi siempre es
**re-anclar** las preguntas al artículo oficial que sí está activo.

**Hazlo con `node scripts/reanclar-preguntas.cjs <plan.json>`** (dry-run por defecto,
`--apply` para escribir). Guardas puras en `lib/contenido/reanclarGuardas.js`, testeadas en
`__tests__/lib/contenido/reanclarGuardas.test.js`.

**Por qué no a mano.** Una pregunta se sirve en un tema si SU ARTÍCULO está en el
`topic_scope` de ese tema. Mover el ancla a un artículo escopado en otros temas **no la
rescata: la cambia de sitio, y puede dejarla huérfana** — y como el artículo viejo se queda
sin preguntas, el detector se apaga y el informe canta victoria. El script bloquea destino
inactivo, destino sin ningún scope y pérdida de temas no declarada (declararla exige escribir
el motivo), y avisa cuando el destino no contiene el texto del origen.

**Cómo encontrar el destino.** `relacionContenido(origen, destino)` del mismo módulo: recorre
los artículos ACTIVOS de la ley y dice cuál contiene el texto del inactivo. En el barrido del
26/07 eso resolvió solo 19 de 31 filas. Familias que aparecieron:

| familia | pinta | destino |
|---|---|---|
| fragmento de un artículo | `2.2`, `3.4`, `69.1` | el artículo padre (contiene el texto) |
| preámbulo/EM troceado | `EM`, `EXP`, `preámbulo1a`, `Preámbulo_II` | la fila `preámbulo` activa |
| disposición con clave del import | `da`, `df`, `dd` (título «Artículo da.Primera Ley…») | `DA1`/`DF6`/`DDunica` |
| **otra ley, mismo número** | art. 88 y 93 del **CP** con preguntas de la **CE** | el artículo de la ley correcta |
| número inventado | TREBEP «art. 101» (acaba en el 100) | el artículo real que dice el texto |
| glosa editorial | «España cuenta con 17 autonomías» | el artículo oficial de la materia |

**Tres trampas medidas el 26/07:**
- **El ancla de origen puede estar mal ya.** En la Ley 4/2015 dos preguntas de *entrada en
  vigor* colgaban de la disposición final PRIMERA (30.000 caracteres de reforma de la
  LECrim). El destino se decide por lo que pregunta la pregunta, no por dónde estaba.
- **Un `0` en `limpiarScope` no es «limpio».** Si el tema escopa la ley entera
  (`article_numbers IS NULL`) no hay lista que podar. El script lo dice ahora en voz alta.
- **Sin gemelo activo, re-anclar no aplica** → se reactiva contra el BOE (abajo).

### Sin gemelo activo: reactivar contra el BOE

`node scripts/reactivar-articulo-boe.cjs "<short_name>" "<article_number>" [--bloque <id>]`
(dry-run por defecto). Compara con el bloque **vigente**, reescribe el texto con el oficial
si hace falta, reactiva, y verifica lo escrito dentro de la misma transacción.

El veredicto lo da el núcleo puro `lib/laws/compararArticuloOficial.js` (14 tests), y
distingue cinco cosas porque **piden remedios opuestos**:

| veredicto | qué es | qué se hace |
|---|---|---|
| `identico` | igual salvo formato | reactivar sin tocar |
| `erratas` | el oficial mal copiado (*«el Defensor del Puebla»*) | reactivar reescribiendo |
| `reordenado` | están todos los apartados, en otro orden | reactivar reescribiendo |
| `incompleto` | faltan apartados | importar el oficial |
| `contaminado` | material que el BOE no tiene | **NO reactivar**: averiguar de dónde sale |

**No compares longitudes contra el bloque crudo.** El bloque crudo del BOE trae todas las
versiones y las notas de modificación. Así se dio por *truncado* el art. 28 del Reglamento de
Armas (4.628 caracteres frente a «8.839»); contra el bloque vigente eran 4.628 vs 4.672, y no
faltaba nada: estaban sus 23 apartados **desordenados**, con el 10 donde va el 2.

**Dos trampas del troceado**, las dos vistas el 26/07: nuestro texto puede **fusionar** varios
apartados en una línea (comparar párrafo a párrafo lo acusaba de contaminado teniéndolo todo)
y puede **partir** un párrafo en dos (la errata de la LO 3/1981 se leía como texto ajeno). Por
eso se juzga desde el lado oficial y por residuo, y las erratas se miran también sobre el
texto completo — con tope **absoluto**, que un 10% de un artículo de 4.000 caracteres es un
apartado entero.

**Para las disposiciones, el id de bloque es la rúbrica, no un número** (`dt`, `dasegunda`,
`dfunica`): el mapeo por número no las encuentra y hay que pasar `--bloque`.

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

## Frontera de título: artículo escopado de un título que el epígrafe NO nombra

**Herramienta:** `npx tsx scripts/scope/sim-title-boundary.ts <position_type> [topic] [--scope=1,2,6]`
(ON-DEMAND: **no pinga el badge**). Pipeline real: BD (epígrafe + `topic_scope`) → estructura
título→rango desde el índice del BOE (`parseBoeSections`) → `classifyTitleBoundary`
(`lib/laws/scopeTitleBoundary.js`) → overflow. `--scope=` fuerza un scope concreto y sirve como
**control positivo** para comprobar que el detector no está ciego antes de fiarte de un verde
(el caso raíz es LOSU T6 de `tecnico_auxiliar_universidad_de_murcia` con `--scope=1,2,6`).

### 🚨 «Silencio no es salud» — lee el veredicto, no la ausencia de hits

El runner imprimía `✅ Sin overflow` de forma **indistinguible** en tres situaciones: banco sano,
`position_type` con un **typo** (0 temas — un `administrativo_` en vez de `administrativa_` basta), y
—la grave— **índices del BOE que no se pudieron descargar** (el fallo se tragaba con `catch { continue }`).
En una barrida de 120 oposiciones, un BOE que limite el ritmo a mitad deja el resto "limpio" y el
informe sale **falso pero convincente**.

Desde T-121 la decisión la toma el núcleo puro `resumenBarrida()` (mismo fichero que el detector,
8 tests + validado por mutación) y el runner solo la imprime. **Solo 2 de 5 veredictos son concluyentes:**

| veredicto | ¿se puede afirmar salud? |
|---|---|
| `sin_temas` (typo) · `nada_evaluado` · `incompleto` (índices sin bajar) | **NO** — exit ≠ 0 |
| `limpio` · `con_hallazgos` | sí |

Matiz que importa: un hueco de cobertura **no invalida un positivo** (lo hallado es real), pero sí
impide decir "limpio". Cada ejecución imprime además `📊 temas · scopes evaluados · omitidos por causa`.

### Resultado de la barrida bank-wide (26/07) y cómo triarla

120 oposiciones · 2.671 scopes evaluados · 0 índices sin bajar → **concluyente**: **59 hits / 1.022
artículos** (frente a 83 el 24/07, −29% tras el fix del "Título preliminar").

**Los 59 hits NO son un fenómeno, son dos o tres mezclados. Trocea la cola POR TAMAÑO:**

- **1-2 artículos (16 hits)** → es el off-by-one de frontera de verdad. **Aquí sí** se adjudica: cada
  artículo contra el BOE, **por número Y por rúbrica**, antes de recortar nada.
- **3+ artículos (43 hits, uno con 239)** → **NO es una frontera.** Es mayoritariamente
  sobre-inclusión → va a la sección de arriba (`scope_over_inclusion_suspect`), no aquí.

Por eso el detector "parecía tener precisión baja": en 43 de 59 casos responde a una pregunta distinta
de la que se le hace. Y contexto para no sobre-interpretarlo: **2.432 de 2.671 scopes (91%) tienen
epígrafe no mapeable a títulos** (`applicable:false`), o sea que solo puede opinar sobre ~9% del banco.

### 📐 Cómo medir un cambio en un detector (método, no improvisar)

Comparar dos barridas seguidas **NO vale**: el banco cambia por debajo (otras sesiones añaden temas;
entre mis dos barridas del 26/07 pasó de 2.671 a 3.000 scopes, y los hits "subían" por eso, no por el
cambio). La medición correcta es **una sola pasada sobre los MISMOS datos llamando al detector real dos
veces**, con y sin el parámetro nuevo, y contar tres cosas: hits/artículos antes, después, y —lo que de
verdad importa— **qué hits SILENCIA y qué hits NUEVOS crea**. Los nuevos hay que adjudicarlos uno a uno
antes de dar el cambio por bueno: es lo que cazó los TRES modelos fallidos de T-129 (trocear por
paréntesis perdía el "Título Preliminar" escrito fuera; una ventana de ±90 caracteres se colaba en la
cláusula de la ley siguiente; y `nameReferenced` no reconoce una ley citada por NÚMERO porque los borra
a propósito). Sin esa medición habría publicado como "mejora" un cambio que solo movía el ruido de sitio.

### Dos defectos conocidos del detector (antes de adjudicar, descártalos)

1. ~~**Fuga entre leyes.**~~ ✅ **ARREGLADO 26/07 (T-129).** El detector aplicaba los títulos del
   epígrafe a TODAS las leyes del tema (caso `auxiliar_administrativo_ayuntamiento_marbella` T5:
   *"(Constitución, Título VIII)"* → `permitidos:8` aplicado al **Estatuto de Autonomía de Andalucía**
   → **239 artículos** marcados). Ahora **cada título se atribuye a la ÚLTIMA norma mencionada antes
   de él** —así se escriben estos epígrafes ("Ley X: Título A, Título B. Ley Y: Título C")— y si todos
   los títulos resultan de otra norma, devuelve `applicable:false` en vez de marcar la ley entera.
   Medido sobre los 3.000 scopes del banco: **80 → 62 hits y 1.668 → 1.180 artículos (−488 de ruido)**,
   silenciando 20 hits y creando solo 2 (pequeños y adjudicables). El matcher ley↔epígrafe vive en
   `lib/laws/lawNameMatch.cjs` (promovido desde `scripts/audit-epigrafe-scope.cjs`, donde era un silo).
2. **Nivel LIBRO no soportado** (`parseBoeSections`): las leyes-código estructuradas en libros
   (`Ley 9/2017` de Contratos: 4 libros + 12 títulos) mapean mal. Comprobado que de las 8 leyes más
   señaladas solo esa usa libros.

**NUNCA recortar por cercanía numérica sin confirmar el título en el BOE.**

## Sobre-inclusión de scope: scope más ancho que el epígrafe (`scope_over_inclusion_suspect`)

> 🆕 **Segundo patrón de la banda MEDIUM — MATERIA ACOTADA EN PROSA (26/07/2026).** Hasta ahora la
> banda media exigía un epígrafe *enumerador* (dos puntos + ≥3 bloques). Faltaba el caso en que el
> epígrafe acota la materia **en prosa**: *«Conceptos y Principios en el tratamiento de los datos
> personales»* con **los 99 artículos del RGPD** escopados. Se encontró investigando por qué el RGPD
> tenía 54 artículos sin preguntas — parecía trabajo de generación y era **scope de más**: escribir
> esas preguntas habría servido contenido fuera de programa. Regla: ley **≥60 artículos**, ≥90%
> escopada, epígrafe que acota (*concepto, principios, disposiciones generales, ámbito de aplicación,
> definiciones, especialmente protegidos*) y **no** enumera. El corte por tamaño es lo que separa
> señal de ruido: en una norma pequeña la materia acotada ES la norma entera (un reglamento de
> archivos de 22 artículos para *«El archivo. Concepto. Tipos de archivos»* es legítimo). Calibrado
> sobre las 4.000 parejas del banco: 33 candidatos sin corte → 18 con él. **No pinga el badge** (sigue
> siendo cola de adjudicación, como el resto de la MEDIUM).
>
> ⚠️ **El criterio vive en TRES sitios** — `lib/laws/scopeOverInclusion.ts` (fuente única),
> el mirror del sweep y la copia inline de `scripts/scope-over-inclusion.cjs`. El guardarraíl del
> 26/07 los compara los tres con las mismas fixtures: antes solo vigilaba dos, y al añadir esta banda
> el CLI se quedó atrás dando los números viejos sin avisar.

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
1-bis. **Señal de CONSENSO DEL BANCO** (`consensoBanco`, en el mismo núcleo puro + mirror en el CLI;
   sale en cada sospechoso de `--suspects` como `consenso_banco`). Responde a *«¿tener esta ley
   ENTERA es lo raro o lo normal?»* mirando **cómo escopan esa misma ley los demás temas activos**.
   Nace de T-154: adjudicar un epígrafe en PROSA («El Poder Judicial. El principio de unidad
   jurisdiccional…») no se puede hacer mapeando bloques —no los hay— y leerlo y opinar es justo lo
   que el proyecto prohíbe. El banco responde mejor: de los **40 temas que escopan la LOPJ, solo DOS
   la tenían entera**; los otros 38 la acotaban, y dos oposiciones estatales con epígrafe casi
   idéntico usaban 75 y 73 artículos → esa fue la referencia del recorte.
   - `anomalia` = ≤25 % de los temas la tienen entera (con ≥6 temas comparables) → **mira esto
     primero**, y el motivo trae la **mediana de artículos** de los que la acotan como tamaño de
     referencia.
   - `norma` = ≥50 % la tienen entera → probablemente legítima (caso Estatuto de Autonomía de
     Madrid: 4 de 7).
   - `insuficiente` = pocos temas comparables o reparto ambiguo. **No se moja a propósito**: es lo
     normal en leyes autonómicas, que tienen 3-4 temas en todo el banco.
   Medido el 26/07 sobre los 263 sospechosos: **93 anomalía · 145 insuficiente · 25 norma**, o sea
   que enfoca el trabajo a poco más de un tercio. **NO decide el recorte** — decide qué mirar antes
   y con qué tamaño de referencia.

> 🧭 **Paso 2 de la evidencia comparada — ¿en quién apoyarse?**
> `node scripts/scope-over-inclusion.cjs --peers <position_type> <tema> "<short_name>"`
> Lista los temas HERMANOS que escopan esa misma ley, ordenados por parecido de epígrafe, y marca
> con ★ el que sirve de referencia: **parecido alto + scope acotado + epígrafe verificado**. Si no
> lo hay, lo dice en vez de ofrecer el más parecido como si valiera. Casos que lo estrenaron:
> `administrativo_madrid` T14 · Ley 29/1998, donde `auxiliar_administrativo_madrid` T7 tiene la
> **misma frase literal**, es de la misma administración y está verificado con 75 artículos — y
> además **resolvió una duda que el epígrafe no cierra**: si "las fases principales del
> procedimiento" incluye recursos y ejecución de sentencias (no las incluye). Y `administrativo_
> madrid` T20 · Ley 19/2013, donde el mejor hermano se queda en 42 % → **no hay referencia** y hay
> que adjudicar contra la estructura. Núcleo puro: `lib/laws/peerScopes.js`.

> 🧰 **Para obtener la estructura oficial NO improvises un parser:**
> `node scripts/scope/arbol-ley-boe.cjs "<short_name>" --rubricas` (registrado como `arbol_ley_boe`).
> Da el árbol **LIBRO › TÍTULO › CAPÍTULO › artículos** con la **rúbrica VIGENTE** de cada bloque,
> que es lo que `poblar-law-sections-boe` no puede dar: allí los títulos reinician por libro y las
> leyes-código se rechazan a propósito (T-104). Pásale el `short_name`, no el id del BOE — existen
> DOS "LO 14/2007" y teclear el id de memoria cuesta un diagnóstico entero.
> **No cubre normativa de la UE** (RGPD, TUE, TFUE): no está en la API del BOE consolidado, vive
> como documento DOUE (`DOUE-L-2016-80807`, `DOUE-Z-2010-70002`) y hay que parsear ese espejo, con
> dos avisos: el doc de los Tratados trae **el TUE y el TFUE juntos** y con el **índice repetido
> antes del cuerpo**, y ahí los títulos **reinician por PARTE**.

2. **Stage-2 adjudicador (LLM)** — para cada sospechoso: obtén la **estructura oficial** de la ley
   (títulos/capítulos y rangos, vía BOE/BORM con WebFetch), **mapea cada materia que nombra el
   epígrafe** a su título/capítulo, y **LISTA los títulos con preguntas escopadas que el epígrafe NO
   nombra**. Es el paso que le faltó a `verify:scope`.

### Batch Stage-2 durable e incremental

Para adjudicar la banda MEDIUM en bloque (recall alto, ~35% precisión → no pinga el badge sola) sin
re-adjudicar lo ya visto:

```bash
node scripts/scope-over-inclusion.cjs --suspects --only-new > /tmp/sus.json   # solo lo nuevo/cambiado
# Workflow: pasa /tmp/sus.json como args a  .claude/workflows/adjudicar-sobre-inclusion.js
#   (fan-out adjudicador BOE + verificación ADVERSARIAL de cada over_inclusion)
node scripts/scope-over-inclusion.cjs --record /tmp/adj_result.json           # upsert + observable_event
```

- **Persistencia**: tabla `scope_over_inclusion_adjudications` (`(topic_id, law_id)` único), veredicto
  `over_inclusion|ok|unverifiable` + `content_hash` = md5(epígrafe+scope). `--suspects --only-new`
  excluye lo adjudicado cuyo hash no cambió (patrón `topic_scope_orphan_triage`) → **incremental**.
- **Observabilidad**: `--record` emite `observable_event` (`event_type='scope_adjudication_recorded'`)
  con `{registradas, over_inclusion, ok, unverifiable, verificados, cola_recorte_confirmada}`. La cola
  accionable = `WHERE verdict='over_inclusion' AND verificado`.
- **Robusto**: cada `over_inclusion` pasa un 2º agente que intenta **refutarla**; solo `verificado=true`
  entra en la cola de recorte. **NUNCA** se auto-recorta: el recorte de `article_numbers` lo confirma
  un humano (borrador + OK).

**Remediar:** si el epígrafe acota de verdad (deja títulos fuera) → recortar `article_numbers` a lo
que pide el epígrafe (las preguntas fuera quedan en BD, dejan de servirse en ese tema, pueden servir
a otras oposiciones). Si el epígrafe abarca genuinamente toda la ley → falso positivo, dejar.
**NUNCA** recortes un bloque que el epígrafe sí pide, ni des por buena la ley entera sin mapear su
estructura (ese atajo fue el falso verde). El límite fino de artículos siempre se confirma con la
fuente oficial + revisión humana.
