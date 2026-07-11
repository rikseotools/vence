# Runbook — Salud de la materialización (pipeline outbox → tablas materializadas)

> **Cuándo:** ante la alerta `canary_stats_pipeline_failed` o `materialized_stats_stale`, o si alguien dice *"el histórico de intentos / las estadísticas no se actualizan"*. También cuando dudes si un fallo del pipeline es **real** o un **artefacto del canary**.

## Veredicto en 30 segundos (empieza SIEMPRE por aquí)

```sql
SELECT * FROM v_materialization_health;
```
- Todas `fresh = true` (lag < 20 min) → **la materialización está VIVA**. Si aun así una alerta grita, es del **canary/fixture**, NO un incidente de usuarios. No pagines a nadie.
- Alguna `fresh = false` con lag alto **y hay tráfico** (respuestas entrando) → **incidente real**: el pipeline outbox→handlers está parado.

**Señal canónica = `updated_at`.** NO uses `last_attempt_at` (solo se escribe en el INSERT de fila nueva; en respuestas repetidas NO avanza → parece "parado" cuando no lo está). Este error costó ~1h el 11/07.

## Arquitectura (para entender qué mirar)

- `test_questions` (respuesta cruda del usuario) → trigger `tg_test_questions_emit_outbox` → fila en `test_questions_outbox`.
- El `outbox-processor` (backend, cada ~5s) consume el evento y **despacha a 9 handlers** (`user_question_history_v2`, `user_article_stats`, `user_daily_stats`, `user_hourly_stats`, `user_difficulty_stats`, `user_stats_summary`, …) que escriben las tablas materializadas.
- Los **triggers analíticos viejos están DESACTIVADOS** (`enabled=D`): tras el cutover, las canónicas se materializan **solo** vía los handlers. Flags en el task def `vence-backend`: `CUTOVER_DONE=true` (handlers escriben la tabla canónica, no `_shadow`) + `SHADOW_HANDLERS_ENABLED=true` (handlers activos).

## Las dos alertas y cómo se relacionan

- **`materialized_stats_stale` (SLI DIRECTO, fuente de verdad):** mira `MAX(updated_at)` real de las 6 tablas con un guard de tráfico (≥30 respuestas/30 min). Si dispara, es un **incidente real**. Es la que manda.
- **`canary_stats_pipeline_failed` (proxy sintético):** inyecta una respuesta del smoke user y comprueba que materializa. **Cross-check (11/07):** solo dispara si el canary falla **Y** ningún usuario real materializó en 5 min. Si los reales materializan, el fallo del canary es del **fixture** → no paginará. Su valor: detectar en **valle nocturno** (cuando el SLI directo no tiene tráfico para juzgar).

## Diagnóstico si es real (alguna tabla `fresh=false` con tráfico)

```sql
-- 1. ¿Cola del outbox? pending / DLQ
SELECT COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count<3) AS pending,
       COUNT(*) FILTER (WHERE processed_at IS NULL AND retry_count>=3) AS dlq
FROM test_questions_outbox;
-- 2. ¿Handlers erroring? (busca error_message en DLQ)
SELECT error_message, COUNT(*) FROM test_questions_outbox
WHERE processed_at IS NULL AND retry_count>=3 GROUP BY 1 ORDER BY 2 DESC LIMIT 5;
-- 3. Flags del task def vivo
--   aws --profile vence --region eu-west-2 ecs describe-task-definition \
--     --task-definition vence-backend \
--     --query "taskDefinition.containerDefinitions[0].environment[?contains(name,'CUTOVER')||contains(name,'SHADOW')]"
```
**Causas típicas:** (a) flags del cutover no desplegados tras un task def nuevo; (b) handlers erroring (DLQ); (c) triggers viejos desactivados sin relevo.

**No es pérdida de datos:** `test_questions` (la respuesta cruda) siempre se guarda. Las materializadas se pueden **reconstruir/replay** desde ahí.

## Trampa del canary: no lo purgues con DELETE crudo

El smoke fixture del canary escribe filas reales; borrarlas con `DELETE FROM test_questions` **dispara el trigger `emit_outbox`** → flood de eventos DELETE que atasca el propio fixture y hace fallar al canary (autoenvenenamiento, incidente 11/07). Para resetear el fixture: borra también sus eventos de `test_questions_outbox` y deja `test_questions`/`uqh` coherentes. Fondo: excluir el usuario sintético del `emit_outbox` (roadmap `docs/roadmap/canary-framework.md`, P1).
