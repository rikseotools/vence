# Verificación de completitud de leyes contra su fuente oficial

> **Estado (18/07/2026):** Capa 1 (detección) CONSTRUIDA y verde. Capas 2-4 (verificación con provenance, extractores no-BOE, gate, observabilidad) diseñadas + schema listo. Disparado por el feedback de Ana Llano (ULE T18): 9 de 74 artículos, `boe_url` NULL, `verification_status='actualizada'` sin evidencia → invisible al monitor BOE; lo cazó una usuaria.

## El gap

El monitor BOE (`verify-articles` → `missing_in_db` → badge Monitoreo) **sí** compara artículo por artículo y cazaría "faltan 46 artículos". Pero:
1. Solo parsea el **BOE consolidado** → las **~400 leyes regionales** (BOCYL/DOGV/DOG/BOJA/BOCM) y las editoriales quedan fuera.
2. Una ley puede **fingir estar verificada**: `verification_status='actualizada'` sin `last_verification_summary` (falso verde).
3. Una ley puede no tener **fuente** registrada (`boe_url` NULL) → inverificable, y nadie lo avisa.

**Dimensión real (barrido 18/07):** de 1.331 leyes, **126 sirven en temas VIVOS con estado problemático** — 78 falso verde, 28 sin fuente, 20 nunca verificadas.

## Principio rector

**Clonar SIEMPRE el documento oficial completo (conocer el universo); el EPÍGRAFE decide qué parte entra; la verificación comprueba que lo que el epígrafe declara está presente. NUNCA marcar verificada sin evidencia contra fuente.**

## Arquitectura (4 capas)

### Capa 1 — Detección determinista (CONSTRUIDA ✅)
- **Criterio único:** `lib/laws/completeness.ts` (`classifyLawCompleteness`) — deriva el estado REAL de la evidencia (`last_verification_summary` + `boe_url`), ignorando el label. Test `__tests__/lib/laws/completeness.test.ts` (10).
- **Audit CLI/CI:** `scripts/audit-law-completeness.cjs` (`--json`, `--gate`). Prioriza las que sirven en temas vivos.
- **Sweep nocturno:** `scripts/health-sweep.cjs` emite `content_health_findings` kind `law_unverified_source` (mirror inline en sync con el módulo).
- **Ruta operador:** `lib/admin/runbookRegistry.ts` → frase *"revisa la completitud de las leyes"* → `docs/runbooks/completitud-leyes.md`. Badge en `/admin/contenido`.

### Capa 2 — Verificación con provenance + hash auto-invalidante (SCHEMA LISTO ✅ / falta cablear)
- **Migración `supabase/migrations/20260718_law_source_verification.sql`** (calcada a `topic_scope_verification`):
  - `law_source_verification` (estado por ley + dos hashes: contenido propio + fuente) + historial append-only.
  - `record_law_source_verification()` — **única vía** de marcar verificado; rechaza `verified` con faltantes; captura ambos hashes.
  - Trigger sobre `articles` → `stale` cuando el articulado cambia (re-verificar).
  - **Guard anti-falso-verde** (`tg_laws_block_false_green`): RAISE si se pone `verification_status='actualizada'` sin `last_verification_summary`. Cierra el bug raíz **por construcción**.
  - **Vista `law_verification_effective`** (mirror SQL del módulo): el badge/lectores leen el estado honesto, no el label.
- **Pendiente de cablear:** aplicar la migración (deploy) + que el flujo de `verify-articles` escriba también en esta tabla vía `record_*`.

### Capa 3 — Extractores de fuente no-BOE (PENDIENTE — el trabajo de verdad)
El `sync-all` solo parsea BOE. Para cerrar el gap regional hace falta un **inventario de artículos de la fuente** por boletín:
- Interfaz `SourceExtractor { fetch(url) → { articleNumbers[], titles[], hash } }`, una impl por boletín (BOCYL, DOGV, DOG, BOJA, BOCM, BOA…) + editorial.
- Reutiliza la fontanería existente: `fetchPdfText`/`pdf-parse` (ya en `detect-notas-convocatoria`), descarga HTML cruda + split por `Artículo N` (patrón del manual de monitoreo §"Fuente NO-BOE").
- Con el inventario, corre la MISMA comparación `missing_in_db` que el BOE → `record_law_source_verification`.
- **Escalable:** añadir un boletín = 1 extractor. Todo lo inteligente (comparación, persistencia, estado) vive una vez.

### Capa 4 — Gate por construcción + observabilidad (PENDIENTE)
- **Gate:** un tema no pasa a `disponible=true` si alguna ley de su `topic_scope` está `never_verified`/`incomplete`/`no_source`/`false_green` (análogo al GATE de generación de preguntas y a la invariante `is_active` GENERATED). Guardarraíl CI: `audit-law-completeness.cjs --gate`.
- **Observabilidad:** emitir `observable_events` (source `fargate`) en cada barrido — `law_verification_swept`, `law_false_green_detected`, `law_verified` (con counts). Dashboard en `/admin/contenido` y SLO "leyes vivas verificadas contra fuente %". Digest semanal (mismo canal que `content-quality-digest`).

## Modos de fallo cubiertos
- **Falso verde** → guard trigger + vista efectiva (label deja de mandar).
- **Sin fuente** → estado `no_source`, badge; el fix registra la URL oficial.
- **Regional/editorial** → extractor por boletín (Capa 3) corre el mismo `missing_in_db`.
- **Ley anual** (presupuesto que cambia cada enero) → el trigger sobre `articles` + el hash de fuente la ponen `stale` al cambiar → re-verificar. Complementa a `lib/laws/staleDatedLaw.ts` (que mira el nombre-con-año).
- **Doc no parseable / histórico** → `no_consolidated_text`/`historical` en el summary → estado `verified` legítimo, sin ruido.
- **NUNCA auto-flip / auto-import de contenido legal:** el detector avisa; la importación la hace Claude/humano con fuente oficial + doble auditoría (política del repo).

## Primer backfill recomendado
Empezar por las **126 que sirven en temas vivos**, priorizando `false_green` (mienten) y las de oposiciones con tráfico. ULE T18 es el caso piloto (importar arts 29-74 del BOCYL 16/01/2026).
