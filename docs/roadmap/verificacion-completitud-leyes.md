# Verificación de completitud de leyes contra su fuente oficial

> **Estado (19/07/2026):** **las 4 capas CONSTRUIDAS y operativas** (Capa 2 aplicada a RDS prod). Disparado por el feedback de Ana Llano (ULE T18): 9 de 74 artículos, `boe_url` NULL, `verification_status='actualizada'` sin evidencia → invisible al monitor BOE; lo cazó una usuaria. Backfill en curso: 125 → 117 leyes actionable (limitado por dato, no por código — ver Capa 3).

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

### Capa 3 — Extractores de fuente no-BOE (CONSTRUIDA ✅)
- **`scripts/verify-law-source.cjs`**: extractor genérico de inventario de artículos (regex `Artículo N.–/./bis` sobre PDF vía `pdftotext` o HTML crudo `curl`+strip), compara vs BD → `missing_in_db`, escribe evidencia vía `record_law_source_verification` **+ dual-write** a `laws.last_verification_summary` (lo que lee la vista/detector), y emite observabilidad. `--law <id>` | `--all-regional [--limit N]` | `--dry`.
- **NUNCA falsea:** si la fuente no parsea (heterogeneidad de boletines: universitarias, planes, protocolos, sedes JS/WAF) NO inventa veredicto → emite `law_source_unparseable` y queda `never_verified` (honesto).
- **Backfill 19/07:** sobre las 61 regionales-con-fuente → **7 verified + 8 incomplete (huecos reales) + 46 unparseable** (honestas). Reconciliadas al detector.
- **Límite honesto (dato, no código):** 60 leyes sin `boe_url` no se pueden auto-verificar (no hay fuente que fetchear → research URL manual); ~46 boletines no parsean (sede JS/login/formato → headless fetcher o manual). El código auto-verifica todo lo parseable; el resto queda honestamente marcado.

### Capa 4 — Gate + observabilidad (CONSTRUIDA ✅)
- **Gate CI/cron:** `scripts/audit-law-completeness.cjs --gate` → exit 1 si hay leyes actionable sirviendo en temas vivos. (El gate DB "tema no `disponible` si ley sin verificar" se deja como señal CI, NO trigger duro, para no bloquear los 100+ temas ya publicados; se endurece cuando el backfill baje el número.)
- **Observabilidad:** el runner emite por-ley (`law_source_verified`/`law_source_incomplete`/`law_source_unparseable`/`law_source_no_url`); el audit emite el snapshot del barrido (`law_completeness_swept` con `by_state`), rastreable en el tiempo en `observable_events` (source `fargate`). Base para dashboard + SLO "leyes vivas verificadas %".

## Modos de fallo cubiertos
- **Falso verde** → guard trigger + vista efectiva (label deja de mandar).
- **Sin fuente** → estado `no_source`, badge; el fix registra la URL oficial.
- **Regional/editorial** → extractor por boletín (Capa 3) corre el mismo `missing_in_db`.
- **Ley anual** (presupuesto que cambia cada enero) → el trigger sobre `articles` + el hash de fuente la ponen `stale` al cambiar → re-verificar. Complementa a `lib/laws/staleDatedLaw.ts` (que mira el nombre-con-año).
- **Doc no parseable / histórico** → `no_consolidated_text`/`historical` en el summary → estado `verified` legítimo, sin ruido.
- **NUNCA auto-flip / auto-import de contenido legal:** el detector avisa; la importación la hace Claude/humano con fuente oficial + doble auditoría (política del repo).

## Primer backfill recomendado
Empezar por las **126 que sirven en temas vivos**, priorizando `false_green` (mienten) y las de oposiciones con tráfico. ULE T18 es el caso piloto (importar arts 29-74 del BOCYL 16/01/2026).
