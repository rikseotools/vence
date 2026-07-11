# Roadmap — Particionado temporal de tablas de telemetría (Fase 2)

> **Contexto:** el incidente del 11/07/2026 (flood de 401 benignos → `validation_error_logs` a
> ~1 GB → panel admin 503) se cerró con 3 capas: filtro en origen (`withErrorLogging`), cron de
> retención `telemetry-retention` (borra > 30 d) y alert-rule `validation_log_flood`. Esta Fase 2
> es la **estructura durable**: convertir las tablas de telemetría en **particionadas por tiempo**,
> para que la retención sea `DROP PARTITION` (instantáneo, sin bloat, sin VACUUM) en vez de un
> `DELETE` masivo nocturno. Ver `docs/runbooks/health-check.md` (§incidente 11/07) y memoria
> `project_flood_401_validation_logs`.

## 1. Estado actual de las tablas gigantes (11/07/2026)

| Tabla | Tamaño | Filas | Tipo | Tratamiento correcto |
|---|---|---|---|---|
| `user_interactions` | 8,1 GB | 9,1 M | telemetría | YA tiene cron `archive-interactions` (>30d→archive, >6m→delete). Candidata a partición. |
| `test_questions` | 5,3 GB | 1,66 M | **producto** (histórico de respuestas) | NO retención. Partición solo por perf/mantenimiento. |
| `observable_events` | 5,0 GB | 9,4 M | telemetría (firehose) | Retención 30d (cron nuevo). **Mejor candidata a partición.** |
| `test_questions_outbox` | 1,7 GB | 505 k | outbox | Debería vaciarse al procesar; 505k filas = **no poda las procesadas** (hygiene aparte). |
| `law_question_first_attempts` | 1,6 GB | 1,05 M | **producto** | NO retención. |
| `validation_error_logs` | 995 MB | 265 k | telemetría (post-purga) | Retención 30d (cron nuevo). Candidata a partición. |
| `pwa_events` | 511 MB | 362 k | telemetría | Retención + partición candidata. |

**Clasificación clave:** separar **telemetría** (append-only, time-series, se retiene/particiona) de
**datos de producto** (`test_questions`, `law_question_first_attempts` — historial del usuario, NO se
borran por antigüedad). El particionado por retención solo aplica a la telemetría.

## 2. Alcance propuesto (Fase 2)

Particionar por **RANGE mensual sobre `created_at`** (hora de inserción, fiable — `ts` puede venir
corrupta: visto un `ts`=2067 que por `ts` nunca se podaría):

1. `observable_events` — la de mayor ritmo (~313 k filas/día). Máximo beneficio.
2. `validation_error_logs`.
3. `pwa_events`.

`user_interactions` ya tiene archivado funcional; particionarla es optimización, no urgencia.
`test_questions` / `law_question_first_attempts` quedan **fuera** (datos de producto).

## 3. Enfoque técnico (PostgreSQL 17, nativo, sin extensiones)

Partición declarativa por rango + automatización de particiones. Dos vías:

- **`pg_partman`** (extensión) — crea/mantiene particiones y aplica retención automática
  (`retention` + `retention_keep_table=false` → DROP de la partición vieja). Es el estándar. Verificar
  disponibilidad en RDS (`SELECT * FROM pg_available_extensions WHERE name='pg_partman'`).
- **Manual** — tabla `_parent` particionada + un cron que hace `CREATE TABLE ... PARTITION OF` del mes
  próximo y `DROP TABLE` de los > retención. Más código, cero dependencias. El cron
  `telemetry-retention` ya existente puede absorber esto (DROP PARTITION en vez de DELETE).

### Migración zero-downtime (por tabla)

Como son tablas calientes (escritura continua), NO se puede `ALTER TABLE ... PARTITION BY` in-place.
Patrón *dual-write + swap*:

1. `CREATE TABLE observable_events_p (LIKE observable_events INCLUDING ALL) PARTITION BY RANGE (created_at);`
   + crear particiones mensuales (histórico dentro de retención + mes actual + siguiente).
2. Backfill: copiar filas < 30 d a `_p` en batches (las > 30 d se descartan — son el objetivo de la retención).
3. Swap en una transacción corta: `ALTER TABLE observable_events RENAME TO observable_events_old;`
   `ALTER TABLE observable_events_p RENAME TO observable_events;` (los writers apuntan al nombre lógico).
4. Verificar (conteos, últimas filas, que los writers insertan en la partición correcta) → `DROP TABLE observable_events_old`.

Alternativa más simple si se acepta ventana mínima: como la retención es 30 d y `observable_events` solo
tiene ~30 d de datos, se puede recrear particionada y backfillear solo lo reciente (barato).

## 4. Riesgos y guardarraíles

- **FKs / triggers**: verificar que ninguna tabla referencia estas por FK (telemetría no suele). `INCLUDING ALL` copia índices/defaults; revisar triggers de writer.
- **Writers**: `ObservabilityService.emit` (Fargate) + writer Vercel deben seguir insertando por el nombre lógico — el swap por RENAME lo respeta.
- **Índices**: cada partición hereda los índices; confirmar que las queries de los runbooks (por `ts`/`event_type`/`endpoint` en ventana reciente) siguen usando índice y hacen *partition pruning*.
- **Guardarraíl**: test que afirme que la retención es `DROP PARTITION` y que existe siempre la partición del mes actual+siguiente (un writer sin partición destino → error de inserción).

## 5. Higiene relacionada (NO es particionado, pero salió al investigar)

- **`test_questions_outbox` (1,7 GB / 505 k filas):** un outbox procesado debería quedar casi vacío.
  505 k filas ⇒ las filas `processed_at IS NOT NULL` no se están podando. El cron `outbox-processor`
  además daba errores (ver eventos `cron_run` 11/07). Revisar aparte: poda de procesadas + DLQ.
- **`observable_events` con `ts` corrupto (2067):** añadir un guard en el writer (`emit`) que acote
  `ts` a un rango sano (p.ej. `[now()-1d, now()+1h]`) o caiga a `created_at`. Con la retención por
  `created_at` ya no crece sin techo, pero el `ts` basura ensucia queries por rango de evento.

## 6. Esfuerzo estimado

- pg_partman disponible → **~medio día** (setup + backfill + swap de las 3 tablas + guardarraíl).
- Vía manual → **~1 día** (más código de mantenimiento de particiones + tests).
- Riesgo: **medio** (migración de tablas calientes; mitigado por dual-write/swap y por ser telemetría, no producto).

## 7. Estado

- ✅ Fase 1 (filtro origen + retención 30d cron + guardarraíl + purga + índice `created_at`) — hecha 11/07 (rama `fix/telemetria-401-retencion`).
- ⏳ Fase 2 (este documento) — planificada, sin implementar. Sesión aparte.
