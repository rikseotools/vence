# Sprint Outbox — `test_questions` (path crítico de answer-and-save)

> **Detonante:** incidente 28/05/2026 (ver [`incidente-answer-save-503-28-05.md`](./incidente-answer-save-503-28-05.md)) — el INSERT a `test_questions` ejecuta **27 triggers en cascada** que tardan 10–25 s en hora punta. Bypass temporal activo (commit `cdf7c001`) hasta que esta solución estructural esté lista.
>
> **Objetivo:** sacar 20 triggers analíticos del path crítico vía Outbox Pattern + Worker async. INSERT pasa de 10–25 s a < 100 ms. Escala lineal a 100k+ DAU.
>
> **Principio agnóstico** ([[feedback_prioridades_escala_y_agnostico]]): el worker es un container NestJS estándar → corre en Fargate hoy, Kubernetes/Hetzner/GCE mañana sin reescribir.
>
> **Última actualización:** 2026-05-28 21:16 UTC (creación). Estado: 🟡 EN MARCHA Fase 1.1.

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
