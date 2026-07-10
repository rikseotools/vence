# Runbook: Verificar epígrafes / contenido de una oposición (topic_scope)

**Cuándo consultarlo (CUALQUIERA de estas → este runbook):** el usuario dice *"verifica los epígrafes"*, *"verifica el contenido"*, *"verifica el scope"* de una oposición; o el **badge de verificación en `/admin/contenido`** está encendido. Seguir este runbook ANTES de improvisar.

Verifica que el `topic_scope` (artículos asignados a cada tema) **se corresponde con el epígrafe oficial** de cada tema, con **2 agentes independientes** (consenso), y deja constancia durable (estado + cuándo + hallazgos). Se **auto-invalida** cuando cambia el epígrafe/scope (trigger).

> Complementa al manual `docs/maintenance/verificar-epigrafe-topic-scope.md` (la metodología de fondo). Este runbook es el **procedimiento operativo** del sistema de verificación con provenance.

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

**Agente ANALISTA** — prompt:
> Eres auditor de contenido de oposiciones. Verifica que el `topic_scope` de cada tema coincide con su EPÍGRAFE oficial (fuente de verdad de QUÉ entra). Lee el JSON `<ruta_dump>`. Cada tema: `epigrafe`, `scope` (leyes con `rango`, `preguntas_activas`, `articulos`=títulos de artículos escopados). Metodología: (1) cada concepto del epígrafe debe estar cubierto; (2) NO debe haber artículos fuera del epígrafe (SOBRE-SCOPE: el epígrafe pide solo una parte pero el scope trae la ley entera — mira los TÍTULOS de los artículos escopados vs lo que pide el epígrafe); (3) ¿falta alguna ley/concepto del epígrafe?; (4) informática: si el epígrafe no especifica variante escritorio/web, no debería haber ley "· Escritorio". Pocas preguntas NO es problema de scope (no lo marques). Devuelve SOLO JSON: {"resultados":[{"tema":1,"verdict":"CORRECT"|"ISSUES","motivo":"breve; si ISSUES, qué sobra/falta y qué rango sugieres"}]}

**Agente ESCÉPTICO** — prompt:
> Eres un revisor ESCÉPTICO y estricto. Tu misión es CAZAR temas cuyo `topic_scope` NO coincida con su EPÍGRAFE. Asume que hay errores y búscalos. Lee el JSON `<ruta_dump>`. Busca sobre todo SOBRE-SCOPE: el epígrafe delimita una materia concreta pero el scope arrastra la ley entera o artículos de materias no mencionadas — lee los TÍTULOS de los `articulos` y compáralos uno a uno con el `epigrafe`. También leyes/conceptos del epígrafe que falten. NO marques: pocas preguntas (es cobertura), ni solapamientos legítimos entre temas hermanos. Devuelve SOLO JSON: {"resultados":[{"tema":1,"verdict":"CORRECT"|"ISSUES","motivo":"breve"}]}

### 3. Consenso
- `CORRECT` **solo si AMBOS** dicen CORRECT.
- Ambos `ISSUES` → `issues`.
- **Discrepan** (uno CORRECT, otro ISSUES) → lanzar un **3er agente JUEZ** (mismo dump + ambos motivos, sin decir quién dijo qué) y aplicar mayoría. Si no se lanza juez, por defecto → `issues` (conservador, fuerza revisión).

Construir `consensus.json`: `{ "<tema>": { "verdict": "correct"|"issues", "note": "...", "findings": {...} } }`

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

## Cobertura global (badge)
```bash
node scripts/verify-topic-scope.cjs audit          # legible
node scripts/verify-topic-scope.cjs audit --json   # datos del badge de /admin/contenido
```
El badge cuenta temas **pendientes** = `never_verified` + `stale` + `verified_issues`. "Todas perfectas" = 100% `verified_correct` fresco.

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
