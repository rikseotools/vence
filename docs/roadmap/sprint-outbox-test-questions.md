# Sprint Outbox — `test_questions` (path crítico de answer-and-save)

> **Detonante:** incidente 28/05/2026 (ver [`incidente-answer-save-503-28-05.md`](./incidente-answer-save-503-28-05.md)) — el INSERT a `test_questions` ejecuta **27 triggers en cascada** que tardan 10–25 s en hora punta. Bypass temporal activo (commit `cdf7c001`) hasta que esta solución estructural esté lista.
>
> **Objetivo:** sacar 20 triggers analíticos del path crítico vía Outbox Pattern + Worker async. INSERT pasa de 10–25 s a < 100 ms. Escala lineal a 100k+ DAU.
>
> **Principio agnóstico** ([[feedback_prioridades_escala_y_agnostico]]): el worker es un container NestJS estándar → corre en Fargate hoy, Kubernetes/Hetzner/GCE mañana sin reescribir.
>
> **Última actualización:** 2026-05-30 09:30 UTC. Estado: 🟡 Infraestructura COMPLETA, **objetivo principal del sprint NO ALCANZADO**.
>
> **HONESTIDAD BRUTAL — qué se ha hecho y qué falta:**
>
> ✅ HECHO:
> - Infraestructura outbox (schema + worker + 9 handlers + 8 shadow tables)
> - Defensa-en-profundidad anti-cuelgue (statement_timeout BD + heartbeat in-memory + ECS liveness probe)
> - Sistema sistémico de heartbeat para los 22 crons backend
>
> ❌ NO HECHO (objetivo principal del sprint):
> - **Los 27 triggers SQL siguen activos** escribiendo a tablas materializadas en cada INSERT
> - **Cutover atómico (DROP TRIGGER × 20 + RENAME shadow→real) NO ejecutado**
> - INSERT a `test_questions` sigue acoplado a 27 triggers + 1 outbox emit + 9 shadow handlers (carga doble cuando shadow está activo)
>
> 🚨 PROBLEMA DETECTADO 30/05 09:30 UTC:
> - Diff shadow vs real (`outbox-shadow-diff.cjs --hours 1`) reporta **39 blockers**:
>   - user_article_stats: 18 missing_in_real + 19 shadow_gt_real
>   - user_daily_stats: 2 shadow_gt_real
> - Bugs reales en handlers → si hicimos cutover con estos blockers, usuarios verían stats inconsistentes
>
> ➡️ DECISIÓN: desactivar SHADOW_HANDLERS_ENABLED inmediatamente (elimina carga doble), arreglar handlers, re-soak, cutover validado.
>
> **Resumen sesión 28-29/05/2026:**
> - ✅ Fase 1.1: schema outbox + trigger emisor — aplicado BD prod (`20260528_test_questions_outbox.sql`)
> - ✅ Fase 1.2: worker NestJS `outbox-processor` — desplegado Fargate (`7af9d386`)
> - ✅ Fase 1.3: handler `user_article_stats` shadow + tabla shadow (`20260529_user_article_stats_shadow.sql`) — desactivado por defecto vía `SHADOW_HANDLERS_ENABLED=false`.
> - ✅ Fase 1.5: cache Redis cross-lambda para 3 RPCs antifraude (`73a6804b`)
> - ✅ Fase 1.6: revert bypass antifraud `cdf7c001` — antifraud reactivado con cache Redis
> - 🔥 Hotfix `6457f8c8`: cron EVERY_SECOND → Interval(5s) anti-overlap. EVERY_SECOND saturó el scheduler de NestJS y rompió TODOS los crons del backend Fargate (canaries incluidos) entre 21:50 UTC del 28/05 y el deploy del hotfix.
> - 🚨 **Incidente 29/05 05:00–17:00 UTC**: activación `SHADOW_HANDLERS_ENABLED=true` durante tráfico alto generó cascade 503 (pico 14.875 errores/hora a las 09:00 UTC, ~133k errores totales en 16h). Causa: `batchSize=100` × 9 handlers en `Promise.all` = ~1800 queries/tick saturando pool BD. Mitigación inmediata: shadow disabled (task def `v13`) + force-restart ECS → 503 cerrado en 7 min.
> - ✅ **Hardening pre-shadow (`412a1f51`, 29/05 ~21:00 UTC)**: `batchSize 100→10` + `Promise.all → Promise.allSettled` + log estructurado por handler. Cambios INERTES mientras shadow=false. Permitirá reactivar shadow sin saturar pool (180 queries/tick vs 1800 anteriores). Ver §1.5bis.

---

## Diagnóstico de partida (28/05/2026)

- **27 triggers AFTER INSERT/UPDATE/DELETE** sobre `test_questions` (inventario completo en [`incidente-answer-save-503-28-05.md`](./incidente-answer-save-503-28-05.md) §3).
- 9 tablas materializadas escritas por trigger en cada INSERT, ~750 MB tocados en total:
  - `user_question_history` (legacy v1, 285 MB) ← duplicado de v2
  - `user_question_history_v2` (220 MB)
  - `user_article_stats` (83 MB)
  - `user_daily_stats` (4 MB)
  - `user_hourly_stats` (1.8 MB)
  - `user_difficulty_stats` (1.4 MB)
  - `user_stats_summary` (1.1 MB)
  - `user_stats_total_time` (small)
  - `question_first_attempts` (159 MB)
  - `law_question_difficulty`
- Métrica antes (28/05): `INSERT test_questions` mean 42 ms / p95 316 ms / max 7066 ms; bajo carga llega a 25 s.
- **Causa raíz:** mezcla de cascada de triggers + estadísticas Postgres desfasadas (`ANALYZE` hecho 20:02 UTC) + escasa optimización de queries.

## Objetivo cuantitativo

| Métrica | Hoy | Tras Sprint 1 |
|---|---|---|
| INSERT `test_questions` p99 | 25 s | **< 100 ms** |
| 503 en `/api/v2/answer-and-save` | 120k/día | **0** |
| Throughput máx soportado | ~100 req/s (timeout) | **10.000+ req/s** |
| Lag de stats user-facing | tiempo real (síncrono lento) | **< 2 s** (eventualmente consistente) |
| Antifraud bypass (cdf7c001) | activo | **reactivado** (con cache Redis) |

---

## Plan por fases

### Fase 1.1 — Schema outbox + trigger emisor (0.5 día) 🟡 EN MARCHA

**Entregable:** tabla `test_questions_outbox` + 1 trigger AFTER INSERT/UPDATE/DELETE que registra eventos sin tocar los 27 triggers existentes (convivencia).

Diseño SQL:

```sql
-- Migración: 20260528_test_questions_outbox.sql

CREATE TABLE IF NOT EXISTS public.test_questions_outbox (
  id BIGSERIAL PRIMARY KEY,
  test_question_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('INSERT','UPDATE','DELETE')),
  payload JSONB NOT NULL,          -- snapshot NEW (INSERT/UPDATE)
  old_payload JSONB,                -- snapshot OLD (UPDATE/DELETE)
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT
);

-- Polling del worker: índice parcial cubriente
CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed
  ON public.test_questions_outbox(created_at)
  WHERE processed_at IS NULL;

-- DLQ inspection
CREATE INDEX IF NOT EXISTS idx_outbox_errors
  ON public.test_questions_outbox(retry_count, created_at)
  WHERE retry_count >= 3 AND processed_at IS NULL;

-- Función trigger: emite evento outbox
CREATE OR REPLACE FUNCTION public.tg_test_questions_emit_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.test_questions_outbox (test_question_id, event_type, payload, user_id)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.test_questions_outbox (test_question_id, event_type, payload, old_payload, user_id)
    VALUES (NEW.id, 'UPDATE', to_jsonb(NEW), to_jsonb(OLD), NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.test_questions_outbox (test_question_id, event_type, payload, old_payload, user_id)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), to_jsonb(OLD), OLD.user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tg_test_questions_emit_outbox
  AFTER INSERT OR UPDATE OR DELETE
  ON public.test_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_test_questions_emit_outbox();
```

**Coste del nuevo trigger:** un solo INSERT a `test_questions_outbox` (tabla sin triggers ni FKs pesadas) → ~1 ms. Suma al INSERT actual de `test_questions` sin penalizar de forma apreciable.

**Validación:**
- Smoke insert: insertar 1 row en `test_questions` → comprobar que aparece la fila en `test_questions_outbox`.
- INSERT/UPDATE/DELETE cubiertos ([[feedback_triggers_3_tgops]]).

**Reversible:** `DROP TRIGGER tg_test_questions_emit_outbox; DROP TABLE test_questions_outbox;`

### Fase 1.2 — Módulo NestJS `outbox-processor` en Fargate (1.5 días)

**Entregable:** `backend/src/outbox-processor/` con polling 1 s, batch 100, retry 3, DLQ.

Estructura módulo:
- `outbox-processor.module.ts` — Module config
- `outbox-processor.service.ts` — loop polling + dispatch a handlers
- `outbox-processor.cron.ts` — schedule `@Cron('*/1 * * * * *')` (cada segundo)
- `handlers/` — un handler por tabla destino (user-article-stats.handler.ts, etc.)
- `outbox-processor.schema.ts` — Zod types para los payloads

Pseudo-código del loop:

```ts
@Cron('*/1 * * * * *')
async pollOutbox() {
  const batch = await this.db.execute(sql`
    SELECT id, test_question_id, event_type, payload, old_payload, user_id, retry_count
    FROM test_questions_outbox
    WHERE processed_at IS NULL AND retry_count < 3
    ORDER BY created_at
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  `);

  for (const event of batch) {
    try {
      await this.dispatch(event);
      await this.db.execute(sql`UPDATE test_questions_outbox SET processed_at = NOW() WHERE id = ${event.id}`);
    } catch (e) {
      await this.db.execute(sql`UPDATE test_questions_outbox SET retry_count = retry_count + 1, error_message = ${e.message} WHERE id = ${event.id}`);
      this.logger.error(`Outbox event ${event.id} failed`, e);
    }
  }
}

async dispatch(event) {
  switch (event.event_type) {
    case 'INSERT': await Promise.all([
      this.userArticleStats.onInsert(event),
      this.userDailyStats.onInsert(event),
      this.userHourlyStats.onInsert(event),
      // ... resto
    ]); break;
    case 'UPDATE': /* ... */ break;
    case 'DELETE': /* ... */ break;
  }
}
```

**Pre-existente:** el backend Fargate ya tiene patrón canary y worker (memoria [[project_backend_dedicado_fargate]] — 12 crons migrados con `@nestjs/schedule`). El nuevo módulo replica el patrón.

**Tests:** unit por handler + integración del loop completo.

### Fase 1.3 — Migrar 1er trigger en shadow (1 día)

Empezar por **`user_article_stats`** (3 triggers: INS/UPD/DEL; tabla mediana 83 MB).

Plan:
1. Implementar handler `user-article-stats.handler.ts` en worker que replique la lógica de las funciones SQL existentes.
2. **Modo shadow:** triggers SQL siguen activos + worker también escribe. Comparar resultados con query diff `WHERE user_article_stats.updated_at > last_check`.
3. Si 0 divergencias en 24h → flip:
   - `ALTER TRIGGER ... DISABLE`
   - Worker es la única fuente.
4. Soak 24h más → `DROP TRIGGER`.

**Patrón validado en proyecto:** memoria [[project_stats_v2_cutover_done]] — cutover stats v2 hecho con paridad bit-a-bit en mayo.

### Fase 1.4 — Migrar 19 triggers restantes (2 días)

Por orden de mayor → menor tamaño / impacto:

1. `user_question_history` v1 (285 MB) — eliminar directo (v2 ya cubierto, ver [[project_stats_v2_cutover_done]]; v1 está duplicado)
2. `user_question_history_v2` (220 MB) — migrar
3. `question_first_attempts` (159 MB) — migrar
4. `user_daily_stats` (3 triggers)
5. `user_hourly_stats` (3 triggers)
6. `user_difficulty_stats` (3 triggers)
7. `user_stats_summary` (3 triggers)
8. `user_stats_total_time` (3 triggers)
9. `law_question_difficulty`
10. `track_first_attempt` (analítico)

Cada uno: shadow → flip → soak → drop.

**Triggers que se quedan síncronos** (críticos UX, < 5 ms):
- `calculate_retention_score_trigger` (BEFORE INSERT — devuelve score al user)
- `update_user_streak_function` (la racha se ve inmediato)
- `update_timestamp_trigger` (trivial)

### Fase 1.5 — Cache Redis para 3 RPCs antifraude (0.5 día)

Las 3 RPCs (`registerAndCheckDevice`, `getDailyLimitStatus`, `checkDeviceDailyUsage`) hacen queries pesadas a `user_profiles` + `daily_question_usage`. Cachearlas:

- Clave: `antifraud:{user_id}:{deviceId}`
- TTL: 60 s
- Invalidación: tras INSERT a `test_questions` (decrementa cupo del día)

Coste: BD libera carga al 95% para estas RPCs. Latencia path crítico antifraud baja de 10-25 s a < 50 ms.

Stack: `lib/cache/redis.ts` ya existe en el proyecto.

### Fase 1.6 — Reactivar antifraud (0.5 día)

`git revert cdf7c001`. Las 3 RPCs vuelven a ejecutarse pero ahora con cache Redis (< 50 ms) y sin la cascada de triggers (INSERT < 100 ms). Sin coste de monetización a partir de aquí. Cierra el TODO de mañana ([[project_pending_reactivar_antifraud_answer_save]]).

### Fase 1.5quater — Patrón sistémico heartbeat aplicado a TODOS los 22 crons (30/05 ~08:30 UTC)

**Aprendizaje crítico:** el incidente del worker outbox NO era un caso aislado.
Los 22 crons del backend comparten el mismo riesgo de cuelgue silencioso. Una
fix puntual a uno (Fase 1.5ter) deja vulnerables a los demás. Solución:
generalizar el patrón en una abstracción reusable y aplicarlo a TODOS.

**Diseño:**

```
HeartbeatRegistry (singleton global)
  ├── register(name, getLastTickMsAgo, { thresholdMs, gracePeriodMs })
  ├── getAllSnapshot() → { 'refresh-rankings': 4s, 'check-boe': 2h, ... }
  ├── getStaleCrons() → filtra por threshold AND fuera del grace period
  └── isHealthy() → todos los registrados están sanos

helpers (sin clase base abstracta → no interfiere con DI NestJS):
  ├── runWithHeartbeat(host, tickField, work)
  │     finally: host[tickField] = Date.now()
  │     (éxito o error)
  └── getLastTickMsAgo(host, tickField) → ms desde último tick

HealthController.GET /health/crons (agregado)
  ├── 200 OK si TODOS los crons healthy
  └── 503 con lista de stale si AL MENOS UNO silencioso > threshold
```

**Cron registration pattern (idéntico en los 22):**

```ts
@Injectable()
export class XxxCron {
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: XxxService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'xxx',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: <2.2-2.5× interval>, gracePeriodMs: 120_000 },
    );
  }

  @Cron(...)
  async handle() {
    await runWithHeartbeat(this, 'lastTickAtMs', () => this.runImpl());
  }
}
```

**Threshold por intervalo:**
- @Interval(5s) → 30s (6× margin) — outbox-processor
- Cron `*/5min` → 12 min (2.4×)
- Cron `*/15min` → 35 min (2.3×)
- Cron horario → 75 min (1.25×)
- Cron cada 6h → 13 h (2.2×)
- Daily → 25 h (1× + margen)
- L-V daily → 4 días (tolera fines de semana)
- Weekly → 8 días (1× + margen)

Grace period 120s en todos cubre bootstrap NestJS (~30-60s con 30+ módulos).

**Crons migrados (22, commits `21cf1d1f` + `59de67c2`):**
outbox-processor, refresh-rankings, process-outbox, alerts-engine,
canary-{answer-save, smoke-auth, stripe-webhook, database-pool,
redis-upstash}, external-heartbeat, check-webhook-health,
subscription-reconciliation, refresh-theme-cache, update-streaks,
archive-interactions, observability-cleanup, detect-timeline-silence,
check-boe-changes, detect-generic-sources, detect-oep-llm,
check-seguimiento, process-verification-queue, avatar-rotation,
detect-regional-oeps.

**Próximo paso (no aplicado todavía):** registrar task definition v16 con
ECS healthCheck que apunte a `/health/crons` (no `/health/outbox`) →
auto-recovery sistémico. Coordinación: startPeriod ≥ 180s para tolerar
bootstrap NestJS bajo carga real.

---

### 🎓 Lecciones aprendidas del incidente 29-30/05

**1. Health endpoints DEBEN respetar grace period del bootstrap**
NestJS con 30+ módulos tarda ~30-60s en arrancar. Si `/health/outbox`
devuelve 503 durante ese tiempo, ECS mata el container antes de operativo.
Loop infinito: arranca → 503 → killed → arranca → 503 → killed. Fix:
`STARTUP_GRACE_MS = 120_000` — durante este tiempo, lastTickMsAgo=null
devuelve 200. Tras el grace period, NULL → 503 legítimo.

**2. `statement_timeout` en cliente postgres es ROOT CAUSE fix, no parche**
Sin statement_timeout, una query que cuelga (network glitch, pooler restart,
lock contention) bloquea el await indefinidamente. Postgres mata la query
en 30s, postgres-js libera el slot, catch del worker se dispara, siguiente
tick reintenta. SIN esto, los parches en código de app (Promise.race,
watchdog externo) son chapuza esconde-síntoma.

**3. Patrón aceptado en industria: 3 niveles de defensa independientes**
- **BD level:** statement_timeout=30s, idle_in_transaction_session_timeout=60s
- **App level:** heartbeat in-memory + observable cron_run cada 60s
- **Infra level:** ECS liveness probe → mata container si silencio > threshold

Si cualquier nivel falla, el siguiente lo cubre. NO es "defensive programming
exagerado" — es el patrón estándar de Stripe webhooks workers, AWS SQS
consumers, etc.

**4. `Promise.all` en handlers paralelos es trampa bajo carga BD**
9 handlers en `Promise.all` × batchSize=100 = ~1800 queries/tick. Si uno
cuelga, los demás esperan. Si pool BD se satura, cascade 503 a otros
endpoints. Fix: `Promise.allSettled` + log por handler + retry granular.

**5. `emitFireAndForget` se pierde silenciosamente**
Para señales críticas (cron_run que alimenta `cron_overdue` alert), usar
`await this.emit()`. Para hot paths donde no podemos esperar (answer-save),
fire-and-forget está OK porque la observabilidad es secundaria al endpoint.

**6. ALB target group ≠ ECS healthCheck — son 2 capas distintas**
- ALB target group: a quién enrutar tráfico (configurado en terraform main.tf)
- ECS healthCheck: cuándo matar el container (configurado en task definition)
Ambos pueden tener paths distintos. Si confundes uno con otro, debugging es
infierno.

**7. Falso positivo "X crons overdue" = emit a observable_events falla**
Cron SÍ corre (logs CloudWatch lo prueban) pero la regla `cron_overdue` mira
`observable_events`. Si emit falla por timeout, alerta dispara aunque el cron
funcione. Fix: `await this.emit()` en crons (commit `3a87d9c0`).

**8. `@Cron(EVERY_SECOND)` en NestJS satura ScheduleModule si la tarea es lenta**
Sin no-overlap protection, ticks acumulan. Para tareas con BD ops (>100ms),
usar `@Interval(5000)` que garantiza no-overlap. Aplicar SIEMPRE para crons
de alta frecuencia con operaciones I/O.

**9. Rolling deploy + ALB causa 503 transitorios esperables**
Durante v14 → v15, ALB enruta a ambos tasks. El task nuevo puede responder
404 mientras NestJS bootstrap. Los errores 503 durante rolling son normales,
NO escalar manualmente al ver el spike en monitor.

**10. Coordinación handlers + RENAME tablas**
Tras `RENAME table_shadow → table`, los handlers shadow seguirían escribiendo
a `table_shadow` que ya no existe → error. Necesario deploy adicional para
quitar el sufijo `_shadow` de los INSERTs ANTES del RENAME. Ventana de
pérdida temporal de stats ~5min (mitigada por backfill desde real).

**11. `task definition revisions` son inmutables**
Cada cambio (env var, healthCheck, image) requiere nueva revision (v13, v14,
v15...). Si mezclamos terraform + AWS CLI, se genera drift. Decisión:
SIEMPRE via AWS CLI para cambios operativos rápidos; terraform sólo para
infra estable (red, IAM, ALB, ECR).

**12. Grace period heartbeat ≠ uniforme — debe escalar con el threshold**
Primer intento: `gracePeriodMs=120_000` para TODOS los crons. Bug: tras 2 min
de uptime, los crons daily/weekly que aún NO han tickeado (porque su próximo
schedule está a 24h) aparecen como stale → liveness probe mata el container.
Fix: `effectiveGrace = MAX(gracePeriodMs, thresholdMs)`. Lectura semántica:
"considera vivo mientras `null` Y todavía estamos dentro de la ventana
esperada del siguiente tick". Daily cron sin tick tras 25h SÍ es legítimo
stale. Daily cron sin tick tras 2h NO lo es.

**13. Rolling deploys disfrazan estado real al monitor**
Mi monitor pegaba a `https://api.vence.es/health/crons` durante un rolling
deploy. Como ALB enruta entre task viejo y nuevo aleatoriamente, los eventos
del monitor mostraban `crons=2` y `crons=24` alternados. Solo tras
`services-stable` (un solo task PRIMARY) la métrica refleja el estado real.
Pattern: esperar `aws ecs wait services-stable` antes de validar el endpoint
en producción.

---

### Fase 1.5ter — Robustez worker outbox (30/05 ~07:30 UTC, post-incidente cuelgue silencioso)

Tras la activación shadow del 29/05 a las 21:02 UTC, el worker procesó eventos
con 0 errores hasta las **21:54:41 UTC**, momento en que dejó de tickar
silenciosamente (sin log, sin error). Detectado a las 05:30 UTC del 30/05:
8h sin procesar (queue=298 acumulada). Stats reales no afectadas
(triggers SQL siguen vivos), pero shadow no acumulaba paridad.

**Diagnóstico:** el `await processBatch()` se quedó esperando indefinidamente
por una operación BD (probable conexión zombi sin timeout). `@Interval(5000)`
respetó el contrato no-overlap → siguiente tick nunca disparó.

**Fix profesional aplicado (NO chapuza):**

#### 1. Causa raíz — `statement_timeout` en cliente postgres (DatabaseModule)

```ts
postgres(url, {
  // ...config existente
  connection: {
    statement_timeout: 30000,                    // 30s — mata query individual
    idle_in_transaction_session_timeout: 60000,  // 60s — mata txn ociosa
  },
});
```

Postgres mata cualquier query que tarde > 30s. El slot del pool se libera.
El catch del worker se dispara. Siguiente tick reintenta. Sin parches en
código de app.

#### 2. Visibilidad — heartbeat in-memory + observable cada 60s

`OutboxProcessorCron.tick()` ahora:
- Actualiza `lastTickAtMs = Date.now()` en cada tick (éxito o error).
- Emite `cron_run` observable cada 12 ticks (60s) AUNQUE batch vacío.
- Counter `tickCounter` reemplaza el módulo de timestamp para lag check.

Resultado: dashboard puede distinguir "worker idle por queue vacía" de
"worker muerto" sin necesidad de tablear adivinanzas.

#### 3. Auto-recovery — endpoint `/health/outbox` + ECS liveness probe

```
GET /health/outbox
  → 200 OK si lastTickMsAgo <= 30s
  → 503 SERVICE UNAVAILABLE si lastTickMsAgo > 30s
```

ECS task definition health check apunta al endpoint. Si 503 N consecutivos
(configurable en task def `healthCheck.retries`), ECS mata el container y
relanza. Auto-recovery a nivel correcto (container), no watchdog en app.

**No es chapuza:** patrón estándar de procesadores async (Stripe webhooks,
AWS SQS consumers). Tres niveles de defensa independientes:

```
┌── BD level: statement_timeout
│   Mata queries colgadas, libera slot del pool
│
├── App level: heartbeat + observable
│   Visibility "vivo aunque ocioso", alerta si silencio anormal
│
└── Infra level: ECS liveness probe
    Mata container si app no responde, auto-recovery sin intervención
```

Si cualquier nivel falla, el siguiente lo cubre. Defensa en profundidad.

---

### Fase 1.5bis — Hardening pre-shadow (`412a1f51`, 29/05 ~21:00 UTC)

Tras el incidente del 29/05 al activar `SHADOW_HANDLERS_ENABLED=true` durante tráfico real, dos cambios mínimos en `outbox-processor` que dejan el worker preparado para reactivar shadow sin saturar pool BD:

1. **`DEFAULT_CONFIG.batchSize` 100 → 10** (`outbox-processor.schema.ts`)
   - Cada evento dispara 9 handlers en paralelo, cada handler hace 2 queries (SELECT EXISTS + UPSERT shadow).
   - Con `batchSize=100` → ~1800 queries/tick (~5s) — pool BD saturado.
   - Con `batchSize=10` → 180 queries/tick, margen seguro.
   - Si la queue crece bajo carga, reducir `intervalSeconds` del @Interval del cron, NO subir batchSize.

2. **`Promise.all` → `Promise.allSettled`** en `dispatch()` (`outbox-processor.service.ts`)
   - Un handler caído ya NO arrastra a los 8 restantes.
   - Cada fallo se logea individualmente con contexto del handler (`user_article_stats: <error>`).
   - Solo se reintenta el evento si TODOS los handlers fallan; si fallan algunos, los exitosos ya escribieron a shadow y la divergencia será visible en `scripts/outbox-shadow-diff.cjs` antes del cutover.

**Cambios INERTES mientras `SHADOW_HANDLERS_ENABLED=false`** (estado actual prod tras task def `v13`). 213/213 tests backend siguen pasando. Listo para reactivación segura en ventana nocturna.

**Reactivación segura recomendada (Fase 1.5ter pendiente):**
- Ventana 01:00–04:00 UTC (mínimo tráfico real, fuera de horario laboral España).
- `aws ecs register-task-definition` con `SHADOW_HANDLERS_ENABLED=true` + `aws ecs update-service`.
- Monitor activo de 5xx + outbox queue depth + Postgres connection count + slow queries durante 30 min.
- Si métricas estables → dejar correr 24h → ejecutar `scripts/outbox-shadow-diff.cjs --hours 24`.
- Si divergencias detectadas → NO cutover, investigar handler.

### Fase 1.7 — Tests de carga (1 día)

Stack: **k6** (existe `loadtest.yml` GHA workflow).

Escenarios:
- 1.000 req/s sostenidos durante 5 min → p99 < 200 ms, 0 5xx.
- 5.000 req/s sostenidos durante 1 min (pico) → p99 < 500 ms, < 0.1% 5xx.
- Saturación gradual hasta encontrar punto de quiebre.

---

## Definition of Done

- ✅ INSERT `test_questions` p99 < 100 ms medido en prod 24h.
- ✅ `cdf7c001` revertido, antifraud activo, sin 503 en 24h.
- ✅ Worker `outbox-processor` con lag < 2 s p99.
- ✅ DLQ con 0 events en últimas 24h (errores < 0.01%).
- ✅ Test de carga 1.000 req/s pasado.
- ✅ Docs actualizados: este roadmap → marcado ✅ COMPLETO. Index `ARCHITECTURE_ROADMAP.md` actualizado.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Worker se cae → outbox crece sin procesar | Alert lag > 5 s + canary heartbeat + autorestart ECS |
| Handler tiene bug → stats incorrectas | Modo shadow + paridad bit-a-bit antes de cutover |
| Lag visible al user (stats no actualizan al instante) | Decidir caso a caso si algún stat necesita ser síncrono (streak, retention_score ya lo son) |
| Cache Redis inconsistente con BD | TTL corto (60 s) + invalidación explícita tras INSERT |
| BD se satura por escrituras a outbox | El INSERT a outbox es 1 ms (sin triggers); puede sostener 10k/s |

## Enlaces

- 🔥 [`incidente-answer-save-503-28-05.md`](./incidente-answer-save-503-28-05.md) — incidente origen.
- 🚀 [`migracion-vercel-a-aws.md`](./migracion-vercel-a-aws.md) — roadmap general.
- 🏗️ [`materialized-stats-aggregates.md`](./materialized-stats-aggregates.md) — patrón previo de materialización (ADR triggers vs outbox).
- ⛔ [Reactivar antifraud (TODO mañana)](../../../../home/manuel/.claude_cuenta1/projects/-home-manuel-Documentos-github-vence/memory/project_pending_reactivar_antifraud_answer_save.md)
- 📐 [`../ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md) §"Bloque 5 Fase D-bis CQRS-light".
