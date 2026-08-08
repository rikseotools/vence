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
- 🟡 Fase 2 (este documento) — **T-360 (07/08/2026): diseño cerrado + código listo, migración SQL SIN aplicar.**
  Alcance recortado a `observable_events` sola (la mayor y la más urgente; `validation_error_logs`/`pwa_events` quedan para otra ficha con este mismo patrón).

### 7.1 Decisión que CORRIGE este documento: partición DIARIA, no mensual

El §3 de más arriba proponía "RANGE mensual". **Es un error con la retención EXACTA de 30 días
que ya existe**: una partición mensual no se puede `DROP` hasta que TODA ella caiga fuera de la
ventana de 30 días — en el peor caso eso retiene datos hasta ~60 días, justo lo contrario de lo
que el particionado viene a resolver. Con partición **diaria**, cada día se dropea en cuanto
cumple los 30 días exactos, igual que la retención de hoy. Medido contra RDS el 07/08/2026 sin
escanear la tabla (`pg_stats.histogram_bounds`, gratis): 85 k-1,27 M filas/día (el pico es el
incidente 07-10/07 ya documentado), volumen que no acerca a ningún problema de "demasiadas
particiones" (pg_partman recomienda cientos, no miles — aquí son ~30-40 particiones vivas en todo
momento con retención de 30d + 7d de premake).

### 7.2 `pg_partman` SIN el background worker (evita tocar el parameter group de RDS)

`pg_partman` 5.2.4 está **disponible** en esta instancia (`SELECT * FROM pg_available_extensions
WHERE name='pg_partman'` → confirmado 07/08/2026), pero su automatización "en segundo plano"
(`pg_partman_bgw`) exige añadirlo a `shared_preload_libraries` del parameter group de RDS **y
rebootear la instancia** — mismo tipo de operación que costó el gotcha de `hot_standby_feedback`
en la réplica (§3 del runbook de contención). **No hace falta para nada de esto**: las funciones
SQL de `pg_partman` (`create_parent`, `run_maintenance_proc`) se pueden llamar sin el bgw, así que
el mantenimiento de particiones se dispara desde el cron `telemetry-retention` que YA EXISTE
(`backend/src/telemetry-retention/`), sin tocar infraestructura de AWS. Es la opción "Manual" del
§3 original, pero apoyada en las funciones probadas de `pg_partman` en vez de reimplementar el
parseo de límites de partición a mano.

### 7.3 Lo construido en T-360 (07/08/2026), sin escritura en RDS

- **`lib/db/particionadoObservableEvents.cjs`** — núcleo puro: nombres/rangos de partición y el
  DDL exacto (tabla nueva con `PRIMARY KEY (id, created_at)` — obligatorio en Postgres para
  particionar por rango —, los 8 índices reales medidos contra RDS, el `CHECK` de `severity`).
  14 tests unitarios, `__tests__/lib/db/particionadoObservableEvents.test.ts`.
- **`scripts/db/particionar-observable-events.cjs`** — dry-run por defecto, subcomandos `plan`
  (solo lectura, **ejecutado de verdad contra RDS vía `VENCE_LECTOR_URL` el 07/08/2026** — es lo
  único que un rol `trabajador` puede correr), `create`/`backfill`/`swap` (requieren
  `DATABASE_URL` de escritura, **sin ejecutar ni probar contra un Postgres real** — esta máquina
  no tiene `psql` ni Docker) y `verify` (solo lectura, post-swap).
- **`backend/src/telemetry-retention/telemetry-retention.service.ts`** — el cron de retención
  ahora comprueba `pg_class.relkind` de `observable_events` EN CADA EJECUCIÓN: si sigue sin
  particionar (el estado de HOY), seguridad total — toma la rama DELETE de siempre, sin cambio de
  comportamiento. En cuanto la migración se aplique y la tabla pase a `relkind='p'`, la MISMA
  ejecución del cron (sin otro deploy) empieza a llamar a `partman.run_maintenance_proc()` en su
  lugar. Es deliberado: el código de retención se puede desplegar HOY, antes de la migración, sin
  ningún riesgo — es la migración la que falta, no el código que la consume. 9 tests
  (`telemetry-retention.service.spec.ts`, los 5 originales sin tocar + 4 nuevos de la rama por
  partición).
- **NO tocado**: ninguna escritura en RDS. `CREATE EXTENSION pg_partman`, la tabla particionada,
  el backfill y el swap siguen sin ejecutarse — necesitan `DATABASE_URL` de escritura, que un
  `trabajador` de la flota no tiene por diseño.

### 7.4 Lo que falta, en orden, y quién puede hacerlo

1. `node scripts/db/particionar-observable-events.cjs plan` — releer el DDL que imprime (puede
   haber cambiado si `observable_events` ganó/perdió columnas o índices desde el 07/08/2026).
2. Revisar la firma exacta de `partman.create_parent()` contra la documentación oficial de
   pg_partman 5.2.4 (github.com/pgpartman/pg_partman) — el script la genera de memoria, sin
   verificarla contra una instancia real; puede variar entre 4.x/5.x.
3. Si es posible, probar `create`→`backfill`→`swap`→`verify` contra una instancia de prueba antes
   de tocar `vence-prod`. Si no lo es, aplicar con vigilancia activa (los paneles de salud +
   `canary_db_pool_failed`) durante y después del `swap`.
4. `create --apply`, luego `backfill --apply` (repetible, `ON CONFLICT DO NOTHING` por
   `(id, created_at)` — reanudable si se corta a medias), luego un último `backfill --apply` justo
   antes de `swap --apply` para minimizar la ventana entre el último backfill y el rename.
5. `verify` y vigilar 24-48h. Con la app estable: `DROP TABLE observable_events_old;` **a mano, no
   por script** — es irreversible y merece una decisión explícita, no un flag.
6. Configurar `partman.part_config` con `retention='30 days'` y `retention_keep_table=false` (el
   `plan` ya imprime el `UPDATE` exacto).
