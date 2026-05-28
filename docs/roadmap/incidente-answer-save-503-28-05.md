# Incidente 28/05/2026 — Cascada 503 en `/api/v2/answer-and-save`

> **Estado:** 🔴 **ACTIVO** al cierre del documento (28/05/2026 ~20:25 UTC).
> **Impacto:** ~1.493 usuarios afectados (no se guardan respuestas, sesiones expulsadas).
> **Causa raíz REAL DEFINITIVA (verificada 28/05 21:01 UTC):** `const timeoutMs = 10000` en **`lib/api/v2/answer-and-save/client.ts:52`** (CLIENTE JS, no servidor). El navegador del usuario aborta vía `AbortController` a los 10 s exactos, antes de que el servidor tenga oportunidad de responder.
>
> **Cómo se confirmó:** tras desplegar `c2550895` (subir `ANTIFRAUD_TIMEOUT_MS` server a 25 s), **0 requests 200 OK en 30 min y 1.586 errores 503 con duration 10.054 ms promedio**. El servidor no abortaba — el cliente sí, antes de recibir respuesta.
>
> **NO es de Vercel, NO es de AWS.** Vence ya está 100% en AWS Fargate (ECS + ALB + CloudFront, ver [`migracion-vercel-a-aws.md`](./migracion-vercel-a-aws.md)). El "desactivé Pro Vercel" del 27/05 fue coincidencia. Tampoco era el server-side `ANTIFRAUD_TIMEOUT_MS` (esa pista era falsa pista).
>
> **Acciones aplicadas:**
> - 28/05 20:33 UTC commit `c2550895` — subido `ANTIFRAUD_TIMEOUT_MS` server 10000 → 25000. (Necesario pero insuficiente: el cliente cancelaba antes.)
> - 28/05 21:02 UTC commit `cfed5218` — subido `timeoutMs` cliente 10000 → 25000 en `client.ts`. Alineado. **Esta es la acción que debe resolver el sangrado.**
>
> **Acción estructural pendiente:** optimizar las 3 RPCs antifraude (índices, Redis cache, simplificar `getDailyLimitStatus`). Y sprint outbox para sacar los 24 triggers analíticos del path crítico de `test_questions`. Ambos fixes son parche acotado — el INSERT real sigue tardando 10-25 s en hora punta, lo cual es lo que debe arreglarse.

---

## 1. Síntomas reportados (feedbacks en `user_feedback`)

6 usuarios distintos reportaron el mismo bug entre 09:56 y 19:36 (Madrid) del 28/05:

| Feedback ID | Usuario | Hora | Síntoma |
|---|---|---|---|
| `4dd51a25` | aila2302 | 09:56 | 25 respondidas pero solo 11 en registro |
| `1cb23889` | redaccioncontenidoseo | 10:30 | *"la web no para de darme errores, sacándome de la sesión continuadamente"* |
| `e7f549df` | Isabel Iglesias | 10:46 | *"tests realizados no figuran o figuran tarde"* |
| `65075923` | Cristina Manso | 16:19 | *"hago preguntas y no se cuentan en estadísticas"* |
| `bb21be1f` | angela.upere | 16:38 | *"plataforma expulsa continuamente, tests no se guardan"* |
| `e192b795` | messicomebimbo | 19:36 | *"desde ayer no se guarda el avance ni en temas ni en tests"* |

**El patrón:** respuestas que el usuario envía y el frontend no consigue guardar → la pregunta queda como "no contestada", las stats no se actualizan, y en algunos casos la SDK de Supabase se reinicia (efecto "expulsión de sesión").

---

## 2. Alertas previas no atendidas

El sistema canary YA detectó el fallo el 27/05 y mandó emails:

- `[Vence CRITICAL] 🚨 Canary answer-save FAL…` — 27/05
- `[Vence CRITICAL] Spike de errores 5xx — 162 e…` — 27/05
- `[Vence CRITICAL] Spike de errores 5xx — 105 e…` — 27/05
- `[Vence CRITICAL] 1 cron overdue` — 27/05
- `[Vence CRITICAL] Spike de errores 5xx — 81 e…` — 28/05 19:05
- `[Vence CRITICAL] 2/3 crons overdue` — 28/05
- Sentry: *"Errors have consumed 80% of monthly budget"* — 27/05
- Sentry: *"Errors and replays are being dropped"* — 28/05 00:37

**Lección operativa:** los emails de canary deben ser tratados como interruptions, no como informativos. El incidente lleva 24h+ activo porque nadie atacó las primeras alertas.

---

## 2.bis Evidencia que prueba la causa raíz (Vercel Hobby maxDuration=10s)

Verificado el 28/05 20:24 UTC con query directa a `observable_events`:

**Distribución de `duration_ms` de los 503 últimas 6h:**

| Bucket | n | % |
|---|---|---|
| <5 s | 0 | 0% |
| 5–10 s | 0 | 0% |
| **10–11 s ★** | **49.882** | **98.2%** |
| 11–15 s | 903 | 1.8% |
| >15 s | 143 | 0.3% |

El 98.2% de los 503 dura exactamente entre 10 y 11 segundos. Eso **no es una variable** — es un **cap fijo**: el `maxDuration` del plan Vercel Hobby/Free es 10 s. Los Lambdas que sobrepasan 10 s son **forzosamente cancelados por la infraestructura del proveedor**, antes de que el `withDbTimeout` (configurado a 15 s) o el `statement_timeout` de Postgres (30 s) lleguen a dispararse.

Endpoints user-facing que en condiciones normales (Pro) pasan de 10 s y por tanto se ven afectados:

- `/api/v2/answer-and-save` → max 37.662 ms (37 s)
- `/api/user/question-history` → max 23.868 ms
- `/api/medals` → max 20.020 ms (ya cutover a Fargate, no afecta)
- `/api/exam/pending` → max 17.065 ms

**Primer hour-bucket con >100 503s:** 2026-05-27 18:05 UTC — cuadra con el momento del downgrade Pro → Hobby.

`refresh_ranking_cache`, los 27 triggers en `test_questions`, el backfill `article_id`, las estadísticas Postgres desfasadas: **son lentitudes reales pero NO la causa del incidente**. Son síntomas que Pro absorbía sin problema (60 s de margen) y que Hobby corta a los 10 s. La aplicación NO se ha vuelto más lenta — el techo se ha bajado.

## 3. Diagnóstico técnico

### 3.1 Métricas observable_events 24h

```
Timeline 503 por hora (UTC, endpoint=/api/v2/answer-and-save):
  27/05 20:00 →  1.682
  27/05 21:00 →  5.580     ← primer pico
  27/05 22:00 →  1.914
  27/05 23:00 →    547
  28/05 00:00 →    224     ← noche tranquila
  28/05 01:00 →     18
  28/05 02:00 →     16
  28/05 03:00 →    668
  28/05 04:00 →  1.465
  28/05 05:00 →  2.460
  28/05 06:00 →  5.706     ← retorno usuarios mañana
  28/05 07:00 →  6.465
  28/05 08:00 →  7.897
  28/05 09:00 →  7.892
  28/05 10:00 → 13.812
  28/05 11:00 → 10.135
  28/05 12:00 →  4.187
  28/05 13:00 →  2.404
  28/05 14:00 →  6.197
  28/05 15:00 → 11.422
  28/05 16:00 → 14.461     ← pico tarde
  28/05 17:00 →  2.451
  28/05 18:00 →  5.519
  28/05 19:00 →  7.413

TOTAL 24h: 120.535 errores 503 sobre answer-and-save (988 también en /api/medals)
```

Veredicto del runbook `docs/runbooks/health-check.md` ejecutado durante diagnóstico:

```
🔴 ROJO — atender ya
Errores 5xx 24h en deploy actual: 61.430
Errores 5xx 24h legacy: 5.801   (el bug ya existía antes del deploy actual)
INSERT test_questions:
  mean = 42.6ms (baseline ≈44ms, OK)
  proxy_p95 = 316ms (7× baseline)
  max = 7.066ms (7 SEGUNDOS — timeout)
  calls = 16.553 en la ventana
Cron drift último run: hace 56.8h (caído desde 26/05 11:07)
```

### 3.2 Causa raíz: `refresh_ranking_cache()`

`pg_stat_statements` mostró el culpable:

| Métrica | `refresh_ranking_cache()` | INSERT `test_questions` |
|---|---|---|
| Calls | 434 | 16.553 |
| Mean | **1.986 ms** | 42.6 ms |
| Max | **19.082 ms** (19 SEGUNDOS) | 7.066 ms |
| Total exec | 862 s | 706 s |

La función `refresh_ranking_cache()`:

- Recalcula **4 timeFilters** (today / yesterday / week / month) por ejecución.
- Cada timeFilter es un `GROUP BY user_id` agregado sobre `test_questions` (1.158.551 inserts + 1.686.717 updates acumulados).
- Se ejecuta **cada 5 minutos** por el cron Fargate `refresh-rankings`
  (`backend/src/refresh-rankings/refresh-rankings.service.ts`).
- Mientras corre (hasta 19 s), toma IO y locks ligeros que hacen
  TIMEOUT a los INSERTs concurrentes de `answer-and-save` →
  `withDbTimeout` dispara `isDbTimeoutError(error)` →
  HTTP 503 con *"Servicio saturado momentáneamente. Reintenta en 5 minutos."*

### 3.3 Cofactores

1. **Estadísticas Postgres desactualizadas.** `pg_stat_user_tables` muestra:

   ```
   test_questions:
     inserts = 1.158.551
     updates = 1.686.717
     dead_tup = 6.315
     last_vacuum = 2026-05-01   (hace 27 días)
     last_autovacuum = 2026-05-27 12:24
     last_analyze = 2026-05-06   (hace 22 días)
   ```

   Con 1M inserts + 1.5M updates desde el último ANALYZE, el planner está usando estadísticas obsoletas. Posible elección de sequential scan en vez de index scan dentro de `refresh_ranking_cache()`.

2. **8 triggers AFTER INSERT en `test_questions`** (deuda histórica del roadmap, ver `ARCHITECTURE_ROADMAP.md` sección "Diagnóstico actual mayo 2026"). Cada INSERT debe esperar a 8 triggers más el lock que tome `refresh_ranking_cache()` por contención.

3. **Cron de drift caído desde 26/05 11:07** (56.8h sin correr al detectar el incidente). Sin él, no detectamos drift de stats hasta este análisis manual.

4. **Cutover Fargate del 24-27/05** (memorias `[[project_gha_cron_lag_migrate_fargate]]`, `[[project_sistema_canary_completo]]`). El cron de ranking ya estaba migrado antes; los 6 canarys nuevos */5min añaden carga marginal de conexiones DB pero no son los causantes directos.

---

## 4. Mitigaciones — opciones evaluadas (orden por menor riesgo / mayor reversibilidad)

| # | Acción | Coste | Riesgo | Efecto esperado | Reversible |
|---|---|---|---|---|---|
| 1 | `ANALYZE test_questions` | 1-2 min, 1 query | **Cero** (solo refresca catálogo `pg_statistic`, no bloquea inserts) | Si el planner estaba eligiendo mal por stats obsoletas → la query del `refresh_ranking_cache` pasa de 19 s a ~1 s y la cascada se detiene | Sí (se vuelve a desfasar solo con el tiempo) |
| 2 | Modificar `refresh_ranking_cache()` para rotar 1 timeFilter por ejecución en vez de 4 | 1 migración SQL idempotente | Bajo (function `OR REPLACE`) | -75% carga del cron, los 4 filters se refrescan cada 20 min en vez de cada 5 | Sí (volver a versión anterior) |
| 3 | Aumentar `db.timeoutMs` en `answer-and-save` | 1 edit + redeploy | Bajo, pero solo enmascara | Menos 503 pero los INSERTs siguen lentos | Sí (revert) |
| 4 | Desactivar cron Fargate `refresh-rankings` temporalmente | Requiere AWS CLI con role correcto | Medio (ranking público dejará de actualizarse hasta reactivar) | Para el sangrado de inmediato | Sí (re-enable) |
| 5 | `VACUUM ANALYZE test_questions` | Mantenimiento 5-15 min | Bajo (no bloquea selects/inserts) | Limpia 6.315 dead tuples + refresca stats. Más completo que solo ANALYZE | Sí |

**Recomendación pendiente de validar con Manuel:** ejecutar 1 + 5 (sin riesgo) y medir 30 min. Si los 503 no bajan, escalar a 2 o 4.

---

## 5. Trabajo de fondo (no esta noche)

- **Aclarar relación canary ↔ refresh_ranking_cache.** Confirmar si el canary `answer-save FAIL` que se disparó el 27/05 detecta correctamente este modo de fallo y por qué nadie atacó.
- **ADR sobre frecuencia de refresh.** ¿Cada 5 min para ranking público es razonable? Mover a cada 15-30 min en horas de baja carga.
- **Materializar `ranking_cache` por triggers** en vez de full-refresh (patrón ya usado en `user_question_history_v2`, `user_stats_summary` — ver ADR del roadmap).
- **Particionado de `test_questions`** (mencionado en ARCHITECTURE_ROADMAP §10 como overengineering hoy con 1.1M filas — reevaluar cuando crezca >100M).
- **Autovacuum más agresivo** en `test_questions` (tabla muy escribida).
- **Email canary → escalación clara.** Los emails CRITICAL deberían disparar SMS / Slack además de email para evitar otro retraso de 24h.

---

## 6. Refs

- `lib/api/withDbTimeout.ts` — wrapper que decide cuándo cortar query y devolver 503.
- `app/api/v2/answer-and-save/route.ts:226-236` — bloque que captura `isDbTimeoutError` y devuelve 503 con Retry-After 300.
- `backend/src/refresh-rankings/refresh-rankings.service.ts` — cron Fargate cada 5 min.
- `supabase/migrations/20260517_ranking_cache.sql` — función `refresh_ranking_cache()` y tabla `ranking_cache`.
- `docs/runbooks/health-check.md` — runbook que detectó este incidente como 🔴 ROJO.
- `docs/ARCHITECTURE_ROADMAP.md` §"Diagnóstico actual (mayo 2026)" — deuda técnica que enmarca el incidente.
- Memorias relacionadas: `[[project_sistema_canary_completo]]`, `[[project_gha_cron_lag_migrate_fargate]]`, `[[feedback_incident_mitigation_act_fast]]`, `[[feedback_post_deploy_monitor]]`.
