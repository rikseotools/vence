# Runbook — Cutover Outbox `test_questions` (post-Sprint 1)

> **Propósito:** ejecutar el cutover final del Sprint 1 outbox: activar
> handlers, validar paridad bit-a-bit con triggers SQL, hacer DROP atómico,
> verificar SLOs. Operación de bajo riesgo si se siguen los pasos en orden.
>
> **Roadmap:** [`../roadmap/sprint-outbox-test-questions.md`](../roadmap/sprint-outbox-test-questions.md)
> **Estado pre-runbook:** 9 handlers implementados (gated por env var OFF),
> 8 shadow tables creadas, outbox emisor activo. Listo para activar.
> **Reversible:** cada paso tiene revert documentado.

---

## Paso 1 — Pre-flight check (5 min)

Antes de activar nada, confirmar estado base:

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async () => {
  // 1. Trigger emisor activo
  const tg = await sql\`SELECT tgname, tgenabled FROM pg_trigger WHERE tgname='tg_test_questions_emit_outbox'\`;
  console.log('Trigger emisor:', tg[0]?.tgenabled === 'O' ? '✅ activo' : '❌ inactivo');

  // 2. Las 8 shadow tables existen
  const shadows = await sql\`SELECT COUNT(*) AS n FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%_shadow'\`;
  console.log('Shadow tables:', shadows[0].n === '8' ? '✅ 8/8' : '⚠️  ' + shadows[0].n + '/8');

  // 3. Outbox sano (no DLQ, lag mínimo)
  const ob = await sql\`SELECT
    COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count < 3) AS pending,
    COUNT(*) FILTER (WHERE retry_count >= 3 AND processed_at IS NULL) AS dlq,
    EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE processed_at IS NULL)))::int AS oldest_pending_sec
  FROM public.test_questions_outbox\`;
  console.log('Outbox: pending=' + ob[0].pending + ' dlq=' + ob[0].dlq + ' oldest_pending_sec=' + (ob[0].oldest_pending_sec ?? 'n/a'));

  // 4. Worker procesando (último cron_run < 30s)
  const wkr = await sql\`SELECT MAX(ts) AS last FROM public.observable_events WHERE endpoint='outbox-processor' AND ts > NOW() - INTERVAL '5 minutes'\`;
  console.log('Worker último tick:', wkr[0].last || '❌ inactivo últimos 5min');

  await sql.end();
})();
"
```

**Resultado esperado:**
- Trigger emisor ✅ activo
- 8/8 shadow tables
- pending < 100, dlq = 0
- Worker tick reciente

Si algo falla → STOP. Investigar antes de seguir.

---

## Paso 2 — Activar `SHADOW_HANDLERS_ENABLED=true` (5 min)

Edit `backend/infra/ecs-service.tf` (o donde esté la env var del task definition):

```hcl
environment = [
  { name = "SHADOW_HANDLERS_ENABLED", value = "true" },
  # ...
]
```

```bash
cd backend/infra
terraform plan
# Revisar diff: debe ser SOLO env var, NADA MÁS
terraform apply
# ECS hace rolling update de los tasks
aws ecs wait services-stable --cluster vence-backend --services vence-backend
```

**Verificación post-deploy:**

```bash
# El worker debe empezar a escribir en las shadow tables
node -e "
... (query a user_article_stats_shadow esperando filas nuevas tras N answers reales)
"
```

**Revert si va mal:** `terraform apply` con `value = "false"` + esperar rolling update (~3min).

---

## Paso 3 — Soak 24h (24 horas)

Dejar que el worker escriba en shadow durante 24 horas con tráfico real.

Vigilar cada 6h:

```sql
-- Pending del outbox no debe crecer (worker keeps up)
SELECT
  COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count < 3) AS pending,
  COUNT(*) FILTER (WHERE retry_count >= 3 AND processed_at IS NULL) AS dlq,
  MAX(EXTRACT(EPOCH FROM (NOW() - created_at))::int) FILTER (WHERE processed_at IS NULL) AS oldest_sec
FROM public.test_questions_outbox;

-- Errores en handlers (DLQ con error_message)
SELECT error_message, COUNT(*) FROM public.test_questions_outbox
WHERE retry_count >= 3 GROUP BY error_message ORDER BY COUNT(*) DESC LIMIT 10;
```

**SLO esperado durante soak:**
- pending < 1000 estable (no creciendo monotónicamente)
- dlq = 0 (o errores explicables: payload viejo, NULL inesperado)
- oldest_sec < 30 (worker keeps up)

Si algo falla → `SHADOW_HANDLERS_ENABLED=false`, investigar, fix, retry soak.

---

## Paso 4 — Query diff paridad (15 min)

Tras 24h de soak, comparar shadow vs real. **Deben ser bit-a-bit iguales** en filas creadas/modificadas durante el soak.

```sql
-- Ejemplo para user_article_stats. Repetir para las 8 tablas.
SELECT
  COUNT(*) FILTER (WHERE s.total_questions IS DISTINCT FROM r.total_questions) AS divergent_q,
  COUNT(*) FILTER (WHERE s.correct_answers IS DISTINCT FROM r.correct_answers) AS divergent_c,
  COUNT(*) FILTER (WHERE r.* IS NULL) AS only_in_shadow,
  COUNT(*) FILTER (WHERE s.* IS NULL) AS only_in_real
FROM public.user_article_stats_shadow s
FULL OUTER JOIN public.user_article_stats r
  USING (user_id, article_id, article_number, law_name, tema_number)
WHERE COALESCE(s.updated_at, r.updated_at) > NOW() - INTERVAL '24 hours';
```

**Resultado esperado:** `divergent_q=0 divergent_c=0 only_in_shadow=0 only_in_real=0` para las 8 tablas.

**Si hay divergencias:**
- Investigar handler causa (probable bug en cálculo de deltas).
- NO seguir al paso 5 hasta tener 0 divergencias.
- Reset shadow: `TRUNCATE {tabla}_shadow` → soak otras 24h tras fix.

---

## Paso 5 — Cutover atómico (10 min, downtime ~1s)

Atomic swap. Dentro de UNA transacción:

```sql
BEGIN;

-- 1. Desactivar los 20 triggers analíticos (mantener críticos UX:
--    calculate_retention_score, update_user_streak, update_timestamp)
ALTER TABLE public.test_questions DISABLE TRIGGER law_question_difficulty_update_trigger;
ALTER TABLE public.test_questions DISABLE TRIGGER track_first_attempt_trigger;
ALTER TABLE public.test_questions DISABLE TRIGGER trigger_update_user_question_history_correct;
ALTER TABLE public.test_questions DISABLE TRIGGER trigger_update_user_question_history_insert;
ALTER TABLE public.test_questions DISABLE TRIGGER trigger_update_user_question_history_v2_insert;
ALTER TABLE public.test_questions DISABLE TRIGGER trigger_update_user_question_history_v2_update;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_article_stats_delete;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_article_stats_insert;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_article_stats_update;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_daily_stats_delete;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_daily_stats_insert;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_daily_stats_update;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_difficulty_stats_delete;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_difficulty_stats_insert;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_difficulty_stats_update;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_hourly_stats_delete;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_hourly_stats_insert;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_hourly_stats_update;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_stats_summary_on_delete_trigger;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_stats_summary_on_update_trigger;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_stats_summary_trigger;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_stats_total_time_delete_trigger;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_stats_total_time_insert_trigger;
ALTER TABLE public.test_questions DISABLE TRIGGER update_user_stats_total_time_update_trigger;

-- 2. Tablas shadow tienen TODOS los datos del soak.
--    Cargar el histórico antes del soak desde las tablas reales (deltas):
INSERT INTO public.user_article_stats_shadow
SELECT * FROM public.user_article_stats r
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_article_stats_shadow s
  WHERE s.user_id = r.user_id AND s.article_id IS NOT DISTINCT FROM r.article_id
    AND s.article_number = r.article_number AND s.law_name = r.law_name
    AND s.tema_number IS NOT DISTINCT FROM r.tema_number
)
ON CONFLICT (user_id, article_id, article_number, law_name, tema_number) DO UPDATE
SET total_questions = user_article_stats_shadow.total_questions + EXCLUDED.total_questions,
    correct_answers = user_article_stats_shadow.correct_answers + EXCLUDED.correct_answers,
    updated_at = NOW();
-- Repetir para las otras 7 tablas con sus PKs respectivas

-- 3. Swap atómico: shadow → real, real → backup
ALTER TABLE public.user_article_stats RENAME TO user_article_stats_pre_outbox;
ALTER TABLE public.user_article_stats_shadow RENAME TO user_article_stats;
-- Repetir para las 7 tablas restantes

COMMIT;
```

**SLO durante swap:** lecturas no se bloquean (RENAME es metadata-only, instantáneo).

**Revert si va mal:**
```sql
BEGIN;
ALTER TABLE public.user_article_stats RENAME TO user_article_stats_shadow;
ALTER TABLE public.user_article_stats_pre_outbox RENAME TO user_article_stats;
ALTER TABLE public.test_questions ENABLE TRIGGER update_user_article_stats_insert;
-- ... resto de triggers
COMMIT;
```

---

## Paso 5-bis — Desplegar `CUTOVER_DONE=true` (CRÍTICO, no omitir) ⚠️

> **🚨 ESTE PASO FALTABA en el runbook original y causó el incidente del
> 2026-06-03** (`[[project_incidente_outbox_cutover_a_medias_03_06]]`): se hizo
> el Paso 5 (RENAME + triggers OFF) pero NO se desplegó el flag → los handlers
> quedaron no-op apuntando a `*_shadow` ya renombradas → **5 tablas
> materializadas congeladas 14h para todos los users, sin alerta** (lo reportó
> una usuaria). El RENAME y el flag son **una sola operación lógica**; entre
> ambos nadie escribe las canónicas.

Tras el COMMIT del Paso 5, las tablas `*_shadow` pasaron a ser las canónicas.
Para que los handlers escriban en ellas, `shadow-suffix.ts` exige
`CUTOVER_DONE=true` (si no, computan `*_shadow`, que ya no existe). Desplegar
**inmediatamente** después del Paso 5:

```bash
# Editar backend/infra/main.tf → environment del task def backend:
#   { name = "SHADOW_HANDLERS_ENABLED", value = "true" },
#   { name = "CUTOVER_DONE",           value = "true" },
cd backend/infra
terraform plan -target=aws_ecs_task_definition.backend -target=aws_ecs_service.backend
# Diff debe ser SOLO los 2 env vars. Aplicar:
terraform apply -target=aws_ecs_task_definition.backend -target=aws_ecs_service.backend
# El recurso service referencia la FAMILY (no la revisión) → forzar:
LATEST=$(aws ecs list-task-definitions --family-prefix vence-backend --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text)
aws ecs update-service --cluster vence-backend --service vence-backend --task-definition "$LATEST" --force-new-deployment
aws ecs wait services-stable --cluster vence-backend --services vence-backend
```

**Verificación obligatoria (los handlers deben escribir las canónicas):**
```sql
-- Tras ~2 min de tráfico, MAX(updated_at) de las 5 tablas debe ser reciente:
SELECT 'uqh' t, MAX(updated_at) FROM user_question_history_v2
UNION ALL SELECT 'art', MAX(updated_at) FROM user_article_stats
UNION ALL SELECT 'dif', MAX(updated_at) FROM user_difficulty_stats
UNION ALL SELECT 'day', MAX(updated_at) FROM user_daily_stats
UNION ALL SELECT 'hr',  MAX(updated_at) FROM user_hourly_stats;
```

**Red de seguridad (desde el incidente 03/06):** dos reglas en
`backend/src/alerts/alert-rules.ts` vigilan esto en producción y disparan en
~20 min si recae: `RULE_MATERIALIZED_STATS_STALE` (tabla parada con tráfico
activo) y `RULE_STATS_PARIDAD_DIVERGENCE` (escribe valores incorrectos).

---

## Paso 6 — Validación post-cutover (30 min)

```sql
-- 1. Triggers analíticos desactivados (debería ser 4 ENABLED solo: críticos UX)
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid='public.test_questions'::regclass AND NOT tgisinternal AND tgenabled='O'
ORDER BY tgname;

-- 2. INSERT de prueba: debe ir a las tablas (no _pre_outbox)
BEGIN;
INSERT INTO public.test_questions (id, test_id, user_id, ...) VALUES (...);
SELECT * FROM public.user_article_stats WHERE user_id='...';  -- debe tener la nueva fila
ROLLBACK;

-- 3. Latencia INSERT — debe ser <10ms p99 (vs 25s pre-cutover)
SELECT * FROM v_insert_test_questions_latency ORDER BY calls DESC LIMIT 1;
```

**SLOs post-cutover:**
- INSERT test_questions p99 < 10ms
- Outbox worker lag < 2s
- 0 errores en `/api/v2/answer-and-save`
- Stats actualizadas con lag < 2s (eventualmente consistente)

---

## Paso 7 — Cleanup (1 semana después)

Tras 7 días sin issues:
```sql
-- DROP las tablas _pre_outbox (espacio: 750 MB liberados)
DROP TABLE public.user_article_stats_pre_outbox;
DROP TABLE public.user_daily_stats_pre_outbox;
-- ... resto

-- DROP triggers desactivados (ya no harán falta)
DROP TRIGGER law_question_difficulty_update_trigger ON public.test_questions;
-- ... resto

-- DROP funciones SQL legacy
DROP FUNCTION update_user_article_stats;
-- ... resto
```

---

## Memorias y precauciones

- [[feedback_audit_before_destructive]] — audit completo antes de DROP. Confirmar 0 readers en las _pre_outbox tablas durante semana de cleanup.
- [[feedback_triggers_3_tgops]] — los handlers cubren INSERT/UPDATE/DELETE ya (verificado por test antes del soak).
- [[feedback_post_deploy_monitor]] — monitor tras cada paso del cutover. Si SLO degrada → revert.
- [[feedback_always_update_roadmap]] — actualizar `sprint-outbox-test-questions.md` con `✅ COMPLETO` y fecha tras paso 6.
