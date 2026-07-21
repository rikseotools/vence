# Runbook: Completitud de leyes contra su fuente oficial

**Cuándo consultarlo (CUALQUIERA → este runbook):** el usuario dice *"revisa la completitud de las leyes"*, o el badge de Salud del contenido muestra el hallazgo `law_unverified_source`. Seguir este runbook ANTES de improvisar.

## Qué detecta (y por qué existe)

Una ley del temario puede estar **importada a medias, sin fuente, o marcada "actualizada" sin haberse verificado jamás** — y ser **invisible** al monitor BOE, que solo compara contra el BOE consolidado. Las ~400 leyes regionales (BOCYL/DOGV/DOG/BOJA/BOCM) y las editoriales quedan fuera de ese monitor.

**Caso que lo origina (Ana Llano, ULE T18, 18/07/2026):** el tema *"Normas de ejecución presupuestaria del Presupuesto de la Universidad de León"* tenía **9 de 74 artículos** (digest editorial de la primera mitad), `boe_url = NULL`, `verification_status = 'actualizada'` pero `last_verification_summary = NULL`. O sea: **fingía estar verificada**. Lo cazó una opositora, no nosotros.

La **fuente única del criterio** es `lib/laws/completeness.ts` (`classifyLawCompleteness`). El sweep (`scripts/health-sweep.cjs`) y el audit (`scripts/audit-law-completeness.cjs`) llevan un mirror inline; el test `__tests__/lib/laws/completeness.test.ts` fija las fixtures.

## Estados (honestos, derivados de la EVIDENCIA, no del label)

| Estado | Qué significa | Fix |
|---|---|---|
| `false_green` | `verification_status='actualizada'` **sin** `last_verification_summary` → miente | Registrar fuente + verificar de verdad (§3) |
| `no_source` | No virtual y **sin `boe_url`** → inverificable por construcción | Encontrar y registrar la URL oficial (§2) |
| `never_verified` | Hay fuente pero nunca se comparó | Verificar (§3) |
| `incomplete` | Summary con `missing_in_db > 0` → faltan artículos | Importar los que falten (§3) |
| `issues` | Summary con `content/title mismatch` | Reconciliar (manual de monitoreo BOE §"reconciliación") |

> **`verified` legítimo** sin acción: summary con `is_ok`, o `no_consolidated_text=true` (doc no parseable clasificado), o `historical=true` (versión anual sustituida). Las **virtuales** quedan fuera (las cubre scope↔epígrafe).

## Procedimiento

### 1. Ver el estado real
```bash
node scripts/audit-law-completeness.cjs            # informe (prioriza temas VIVOS)
node scripts/audit-law-completeness.cjs --json     # datos del badge
node scripts/audit-law-completeness.cjs --gate      # exit 1 si hay actionable sirviendo (CI/cron)
```
Prioriza SIEMPRE las que **sirven en temas vivos** (impacto a usuarios ahora).

**Triaje del trabajo real (qué clase de fix necesita cada una):**
```bash
node scripts/triage-law-completeness.cjs --all-false-green   # clasifica las false_green
node scripts/triage-law-completeness.cjs <slug>              # detalle de una
```
Responde lo que el detector NO distingue: ¿los artículos en BD cubren lo que el `topic_scope` de los temas VIVOS pide?
- **DIGEST-COMPLETO** — imported ⊇ scoped: no falta nada servido, solo la EVIDENCIA. Fix barato (§3-bis).
- **FALTAN-ESCOPADOS** — un tema vivo pide artículos que no están en BD → import (§3).
- **SCOPE-LEY-ENTERA** — un tema escopa la ley entera (`article_numbers=NULL`) → requiere la fuente para dictaminar.

> **Patrón medido (21/07, barrido de las 43 false_green):** ninguna tenía artículos escopados faltantes — el "falso verde" es, para la mayoría, un problema de **evidencia, no de contenido**. Y hay **dos mundos**: las **ordenanzas municipales** (Madrid, Sevilla) salen **verbatim limpias**; las **digests universitarias/autonómicas** (estatutos, convenios, normativas de permanencia) **mezclan articulado verbatim con filas de resumen editorial** (`article_number` no numérico tipo `"s. 11-12 (Título V)"`) **o anexos parafraseados que no existen en la norma**. Las primeras se cierran rápido; las segundas necesitan además limpieza (retirar/relinkar las filas editoriales) — patrón `reference_leyes_virtuales_editoriales`.

### 2. Registrar la fuente que falta (`no_source`)
Localiza la norma oficial (BOE si es estatal; boletín autonómico BOCYL/DOGV/DOG/BOJA/BOCM si es regional; para universidades, el presupuesto/estatuto en su boletín). Escribe la URL en `laws.boe_url`. **Verifica que la URL abre el documento correcto** (no otra norma) antes de seguir — un `boe_url` mal apuntado da `boe_count=0` permanente (monitoreo BOE §1ter).

### 3. Verificar contra la fuente e importar lo que falte
- **Ley estatal (BOE):** usa el monitor BOE — `curl /api/verify-articles?lawId=…` → mira `missing_in_db` → `sync-all` importa lo que falte. Ver `docs/maintenance/monitoreo-boe-y-crear-leyes-nuevas.md` §2-3.
- **Ley regional / editorial (no-BOE):** el `sync-all` NO parsea boletines autonómicos → **inserción manual verbatim** del boletín (mismo flujo que "Crear ley nueva" §"Fuente NO-BOE"): descarga el HTML/PDF crudo, parte por `Artículo N`, inserta cada artículo con `content` **íntegro literal** (NUNCA resumir/parafrasear/inventar), verifica `shortCount`.
- Al terminar, **escribe `last_verification_summary` con la evidencia real** (`boe_count`, `db_count`, `missing_in_db`, `source`, `verified_at`). **NUNCA** marques `verification_status='actualizada'` sin ese summary — eso es el falso verde que origina el bug.

### 4. Generar las preguntas de los artículos nuevos
Si los artículos importados quedan a 0 preguntas y el epígrafe los pide → generar (fuente oficial + doble auditoría + GATE), flujo `docs/maintenance/generar-preguntas-con-ia.md`. Reusar banco existente si lo hay.

### 5. Revalidar caché
Tras tocar artículos/scope: invalidar `temario` + `teoria` + `laws` + rutas ISR de la ley y del tema. Ver `docs/maintenance/cache-revalidation.md`.

## Sistema robusto (roadmap)

El detector de este runbook es la **capa 1** (deterministe, hace VISIBLE el problema). La solución completa —verificación con provenance + hash auto-invalidante, extractores por boletín, gate por construcción y observabilidad— está diseñada en `docs/roadmap/verificacion-completitud-leyes.md`.
