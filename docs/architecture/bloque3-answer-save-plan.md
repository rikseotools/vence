# Bloque 3 — Plan port `/api/v2/answer-and-save` al backend

**Fecha:** 2026-05-24
**Status:** Plan aprobado, Fase 1 en curso.
**Pre-requisitos:** AuthModule + JwtGuard ya en producción (commit `0b04f294`), módulo `medals` ya migrado (commit `eb8ebcf5`). Patrón validado.

---

## 1. Objetivo y justificación

Migrar el endpoint POST `/api/v2/answer-and-save` de Vercel al backend NestJS/Fargate. Es el **KEYSTONE** del Bloque 3 según el audit [`bloque3-audit-hot-path.md`](bloque3-audit-hot-path.md):

- **222 errores en 7 días** (32 son 503 quick-fail por timeout 15s).
- **3 cascadas en 7 días** que arrastran 8 endpoints más (medals, questions/filtered, profile, topics, exam/answer, ranking, laws-configurator, teoria/sections).
- **1.061 inserts/h promedio**, picos de 5.704/h a las 18h Madrid (mayor tráfico del hot path).

Causa raíz: el endpoint vive en Vercel con `pool max:1` por lambda. Cuando una request tarda más de lo normal (blip pooler Supabase, user heavy), el pool se satura y las siguientes fallan instantáneo. En backend NestJS proceso largo el pool es real (5-10 conexiones TCP persistentes) — el cuello desaparece.

Cumple las **dos prioridades** del roadmap:
1. **Que no falle y escale**: cierra el principal cuello de cascadas.
2. **Agnóstico**: saca el hot path #1 de Vercel, sustituye las RPCs Supabase del antifraud por SQL puro estándar.

---

## 2. Componentes a portar

### 2.1 Endpoint principal (`route.ts` → `AnswerSaveController`)

206 líneas en `app/api/v2/answer-and-save/route.ts`. Flujo:

1. Auth Bearer JWT → en backend `@UseGuards(JwtGuard)` + `@CurrentUser()` (ya implementado).
2. Parse body con Zod (port literal de `schemas.ts`, 108 líneas).
3. Anti-fraud `Promise.all` paralelo: `registerAndCheckDevice` + `getDailyLimitStatus` + `checkDeviceDailyUsage`.
4. 3 checks de bloqueo: device limit alcanzado, device daily exhausted, user daily exhausted.
5. `validateAndSaveAnswer` con timeout 15s.
6. `after()` background: `markActiveStudentIfFirst` + invalidar caches.
7. Response con status 200/400/401/403/500/503/404.

**Timeouts**: 10s antifraud + 15s validate + 30s maxDuration global (Vercel). En backend NestJS no hay `maxDuration` de lambda — los 10s+15s se mantienen como salvaguarda.

### 2.2 Módulo Anti-fraud (`AntifraudModule`)

Port de `lib/api/deviceLimit.ts` (164 líneas):

- `getDeviceIdFromRequest` — lectura header `x-device-id`.
- `getHwFingerprintFromRequest` — lectura header `x-hw-fingerprint`.
- `registerAndCheckDevice` — invoca función SQL `register_device(...)`.
- `parseDeviceLabel` — lógica pura (User-Agent → "Chrome / Mac").
- Cache in-memory 60s por `${userId}:${deviceId}` para evitar 100 RPCs en exámenes de 100 preguntas.

Funciones SQL Postgres ya existentes (creadas por Supabase pero estándar): `register_device`, `get_accounts_on_device`. Se invocan vía Drizzle `db.execute(sql\`SELECT * FROM register_device(${a}::uuid, ${b}, ...)\`)` — **cero dependencia a `supabase.rpc()`**.

### 2.3 Módulo DailyLimit (`DailyLimitModule`)

Port de `lib/api/dailyLimit.ts` (248 líneas):

- `getDailyLimitStatus` — invoca SQL `get_daily_question_status(p_user_id)`.
- `checkDeviceDailyUsage` — invoca SQL `get_device_daily_usage(p_device_id)`.
- `incrementDailyCount` — invoca SQL `increment_daily_questions(p_user_id, p_limit)` (no usado en answer-and-save GET pero sí para futuros endpoints — `count` se incrementa en frontend tras OK).
- `getDynamicLimit` — port del helper `./daily-limit.ts` (lógica de límites graduados según edad + historial).
- Cache premium-only 60s (free users siempre consultan BD).

Mismas funciones SQL Postgres invocadas vía Drizzle, no `supabase.rpc()`.

### 2.4 Módulo TestAnswers (`TestAnswersModule`)

Port de `lib/api/test-answers/queries.ts` (358 líneas, function `insertTestAnswer` + helpers):

- `insertTestAnswer` — INSERT a `test_questions` con manejo de constraint único (23505 = ya guardado, no es error).
- `buildTestAnswerRow` — función pura que construye el row.
- Helpers puros: `mapAnswerToLetter`, `generateContentHash`, `buildQuestionContext`, `buildBehaviorData`, `buildLearningAnalytics`.
- Schema: `testQuestions` (tabla grande con ~30 columnas, JSONB fields).

### 2.5 Módulo TemaResolver (`TemaResolverModule`)

Port de `lib/api/tema-resolver/queries.ts` (665 líneas — sólo necesitamos `resolveTemaByQuestionIdFast`, ~80 líneas):

- `resolveTemaByQuestionIdFast` — 1 query SQL CTE con JOIN `questions → articles → topic_scope → topics`. Devuelve `topic_number` o null.
- Cache in-memory por `cacheKey(questionId, positionType)`.
- Otras funciones del módulo (`resolveTemasBatch`, `resolveTemaByArticle`, etc.) NO se portan — sólo el fast path.

### 2.6 Service principal (`AnswerSaveService`)

Port de `lib/api/v2/answer-and-save/queries.ts` (310 líneas):

- `validateAndSaveAnswer`: orquestador.
  - `getQuestionValidationCached` (cache Upstash 1h, tag `'questions'` — **compartido con Vercel** para invalidación cross-runtime coherente). Lee `questions` con JOIN `articles+laws`, fallback a `psychometric_questions`.
  - `resolveTemaByQuestionIdFast` en paralelo (si `tema=0` y legislativa).
  - `insertTestAnswer` (delegado a `TestAnswersService`).
  - UPDATE `tests.score`.
- `markActiveStudentIfFirst` (background): SELECT + UPDATE en `user_profiles`. En Nest se ejecuta vía pool dedicado o simplemente fire-and-forget tras response.

---

## 3. Schema Drizzle ampliado (`backend/src/db/schema.ts`)

Tablas a añadir/ampliar. Cada una sólo con las **columnas que el código toca** (subset, mismo patrón que medals):

| Tabla | Estado actual backend | Columnas necesarias |
|---|---|---|
| `questions` | NO existe | id, correct_option, explanation, primary_article_id, is_active |
| `articles` | NO existe | id, article_number, law_id |
| `laws` | ✅ parcial | añadir: nada (ya tiene id/short_name/name/slug) |
| `psychometric_questions` | NO existe | id, correct_option, explanation |
| `tests` | NO existe | id, score, total_questions, completed_at, user_id |
| `test_questions` | NO existe | ~30 columnas (la grande con JSONB) |
| `user_profiles` | ✅ parcial | añadir: is_active_student, first_test_completed_at, target_oposicion |
| `topic_scope` | NO existe | id, law_id, topic_id, article_numbers (text[]) |
| `topics` | NO existe | id, topic_number, title, position_type, is_active |

NO incluir tablas usadas SOLO por las funciones SQL Postgres (`device_registrations`, `daily_questions`, etc.) — esas las gestiona la función `register_device`/`increment_daily_questions`, no las tocamos directamente desde Drizzle.

---

## 4. RPCs Supabase → SQL puro (decisión técnica clave)

Las funciones SQL existen en Postgres como `CREATE FUNCTION` estándar (no son Supabase-specific, sólo el SDK `supabase.rpc()` que las invoca lo es). Estrategia agnóstica:

```typescript
// ❌ Vercel actual (lock-in Supabase SDK):
const { data, error } = await supabase.rpc('register_device', {
  p_user_id: userId,
  p_device_id: deviceId,
  p_device_label: label,
  p_hw_fingerprint: hwFingerprint,
});

// ✅ Backend NestJS (agnóstico Postgres puro):
const rows = await db.execute<RegisterDeviceRow>(sql`
  SELECT * FROM register_device(
    ${userId}::uuid,
    ${deviceId}::text,
    ${label}::text,
    ${hwFingerprint}::text
  )
`);
const result = rows[0];
```

**Funciones SQL a invocar así** (todas siguen funcionando idéntico — la función SQL no cambia):
- `register_device(p_user_id uuid, p_device_id text, p_device_label text, p_hw_fingerprint text)`
- `get_accounts_on_device(p_device_id text)`
- `increment_daily_questions(p_user_id uuid, p_limit int)`
- `get_device_daily_usage(p_device_id text)`
- `get_daily_question_status(p_user_id uuid)`

**Beneficio**: si mañana migramos Supabase → Neon / RDS / Aurora, las funciones siguen existiendo (son PostgreSQL puro) y el código sigue funcionando. **Cero deuda de proveedor añadida.**

---

## 5. `after()` block de Next.js en NestJS

El `route.ts` de Vercel usa `after(async () => { ... })` para ejecutar trabajo tras enviar la response al cliente (no bloquea el TTFB).

En NestJS hay 2 opciones equivalentes:

**Opción A — Fire-and-forget en el Controller**: tras `return result`, el code que viene después se ejecuta tras flush. Pero Nest devuelve la response al finalizar el handler, no antes. Para asegurar que NO bloquea:

```typescript
@Post()
async post(...): Promise<AnswerSaveResponse> {
  // ... lógica principal
  const result = await this.service.validateAndSaveAnswer(...);

  // Fire-and-forget — no await, no bloquea response
  this.backgroundService.runAfter(() => this.service.markActiveStudentIfFirst(userId));
  this.backgroundService.runAfter(() => this.cache.invalidateMany([...]));

  return result;
}
```

Con `BackgroundService.runAfter(fn)` que internamente usa `setImmediate(fn)` para garantizar ejecución tras flush + captura errors con `Promise.catch`.

**Opción B — Interceptor `@AfterResponse()`** customizado.

Vamos por **A**: es más explícito y testeable. El BackgroundService es trivial (10 líneas) y reusable para futuros endpoints.

---

## 6. Invalidación de cache cross-runtime

Tras response OK, invalidar las 5 keys Upstash:
- `user_stats:${userId}`
- `exam_pending:${userId}:all:10`
- `exam_pending:${userId}:exam:10`
- `exam_pending:${userId}:practice:10`
- `theme_stats:${userId}`

Como Vercel + backend comparten Upstash, la invalidación se propaga automáticamente. El frontend ve datos frescos en la próxima request.

---

## 7. Fases del port

### Fase 1 — Foundational (HOY, ~1.5-2h)

1.1. Ampliar `backend/src/db/schema.ts` con las 8 tablas faltantes (subset de columnas).
1.2. Crear esqueleto de módulos: `AntifraudModule`, `DailyLimitModule`, `TestAnswersModule`, `TemaResolverModule`, `AnswerSaveModule`. Cada uno con su Service vacío + module decorator.
1.3. Registrar todos en `app.module.ts`.
1.4. Build local TS limpio.
1.5. Commit + push.

**Output**: estructura del backend lista para implementar Fase 2 sin pensar en "dónde meto esto".

### Fase 2 — Lógica pura (~1.5h)

2.1. `buildTestAnswerRow` + helpers (mapAnswerToLetter, generateContentHash, buildQuestionContext, buildBehaviorData, buildLearningAnalytics) en `TestAnswersService`.
2.2. `parseDeviceLabel` en `AntifraudService`.
2.3. `getDynamicLimit` y helpers de `daily-limit.ts` en `DailyLimitService` (cálculo de límites graduados, sin tocar BD).
2.4. Tests unitarios completos de las funciones puras (50-80 tests entre todas).

### Fase 3 — Queries (~1h)

3.1. `getQuestionValidationCached` en `AnswerSaveService` con `CacheService` (Upstash key `question-validation-v1:${id}`, TTL 1h, mismo tag `'questions'` que Vercel).
3.2. `resolveTemaByQuestionIdFast` en `TemaResolverService`.
3.3. `registerAndCheckDevice` invocando `register_device` vía SQL puro.
3.4. `getDailyLimitStatus` + `checkDeviceDailyUsage` + `incrementDailyCount` vía SQL puro.

### Fase 4 — Service principal (~1h)

4.1. `AnswerSaveService.validateAndSaveAnswer` orquestador completo.
4.2. `AnswerSaveService.markActiveStudentIfFirst` (background).
4.3. `BackgroundService.runAfter` (utility).
4.4. Integración entre módulos.

### Fase 5 — Controller + Auth (~30 min)

5.1. `AnswerSaveController` POST con `@UseGuards(JwtGuard)` + `@CurrentUser()`.
5.2. Validación Zod del body.
5.3. Quick-fail timeouts vía `Promise.race`.
5.4. Mapeo de errores a status codes (400/401/403/500/503/404).

### Fase 6 — Deploy + Frontend proxy + Canary (~1h)

6.1. Build + commit backend.
6.2. GHA construye imagen + push ECR.
6.3. Force update task def + redeploy.
6.4. Smoke directo `api.vence.es/api/v2/answer-and-save` con JWT real.
6.5. Frontend proxy en `app/api/v2/answer-and-save/route.ts` con flag `answerAndSave: false` inicial.
6.6. Tests del proxy (10-12 casos: flag OFF, flag ON, fallback, 401, 403, body inválido).
6.7. Commit + push frontend (flag OFF, deploy Vercel ~2 min).
6.8. Verificar regresión OFF (smoke 5 POSTs, x-served-by ausente, comportamiento idéntico).
6.9. Activar flag a `true`, commit + push.
6.10. Monitor 30 min: latencia, errores, fallbacks, cascadas.

**Total estimado**: 6-7 horas distribuidas. Fases 1-3 hoy si hay tiempo, 4-6 en sesión dedicada.

---

## 8. Decisiones tomadas (no re-debatir en implementación)

| Pregunta | Decisión | Razón |
|---|---|---|
| ¿Portar las RPCs Supabase o invocarlas igual? | Invocar como SQL puro vía `db.execute(sql\`SELECT * FROM rpc(...)\`)` | Funciones SQL son agnósticas; el SDK supabase.rpc es el lock-in |
| ¿`insertTestAnswer` se simplifica? | NO. Port literal con sus 8 triggers DB | Triggers en BD ya están, no son del code app |
| ¿`resolveTema` completo o sólo fast path? | Solo `resolveTemaByQuestionIdFast` (1 de 7 funciones) | Único usado por answer-and-save |
| ¿`after()` cómo se hace en Nest? | `BackgroundService.runAfter` con `setImmediate` | Explícito + testeable + reusable |
| ¿Cache `getQuestionValidationCached` qué store? | CacheService Upstash (mismo store que Vercel) | Coherencia cross-runtime cero pub/sub |
| ¿Mismo tag `'questions'`? | Sí | Para que `revalidateTag('questions')` del admin Vercel invalide también el backend |
| ¿`incrementDailyCount` se llama en el endpoint? | NO (igual que Vercel: lo hace el frontend tras OK) | Evita doble conteo |
| ¿Timeouts mismos que Vercel? | Sí (10s antifraud + 15s validate) | Salvaguarda para evitar requests colgadas |
| ¿Validación email opt-out de los emails de medal? | No aplica aquí | answer-and-save no envía emails |

---

## 9. Tests strategy

### Unit tests por módulo (mocks de DB y CacheService):
- `TestAnswersService`: ~15 tests (mapAnswerToLetter, generateContentHash, buildTestAnswerRow con device, sin device, psychometric, legislative, isBlank true/false).
- `AntifraudService`: ~10 tests (extractors header, parseDeviceLabel para Chrome/Firefox/Safari/Edge × iOS/Android/Win/Mac/Linux, registerAndCheckDevice mocked).
- `DailyLimitService`: ~10 tests (getDynamicLimit cálculos, getDailyLimitStatus con/sin cache premium, checkDeviceDailyUsage allowed/blocked).
- `TemaResolverService`: ~5 tests (encuentra/no encuentra, fallback default oposicionId).
- `AnswerSaveService`: ~15 tests (correctOption null → 404, isCorrect calculation, isBlank, save_failed branch, ON CONFLICT, score update).

### Integration tests (in-memory pgs + Upstash mock):
- POST flow completo con user real, question real → INSERT + UPDATE OK.
- 401 sin JWT, 403 device limit, 403 daily limit, 503 timeout.

Total esperado: ~70-80 tests para el módulo entero.

---

## 10. Riesgos identificados + mitigación

| Riesgo | Mitigación |
|---|---|
| `insertTestAnswer` toca tabla con 8 triggers → comportamiento sutil | Tests integration con BD real verifican que triggers se disparan igual |
| RPCs Postgres devuelven JSON `out_*` con prefijo (Supabase quirk) | Tests verifican parseo de ambos prefijos (`out_allowed` y `allowed`) |
| Cache `'questions'` no se invalida cross-runtime si admin edita por API directa | Documentar en el código: `revalidateTag('questions')` desde admin → también invalida el cache backend (mismo Upstash) |
| `after()` background falla silenciosamente | BackgroundService loguea errores en CloudWatch + Sentry tagging |
| Vercel proxy POST debe reenviar `x-device-id` y `x-hw-fingerprint` headers | Test del proxy verifica reenvío de headers críticos |
| Si backend tiene bug y devuelve datos mal, frontend proxy fallback NO se activa (devuelve OK con datos erróneos) | Validación pre-response en el proxy: si shape JSON no es válido, throw → fallback. O añadir versión del backend al header `x-backend-version` |

---

## 11. Patrón aplicable a otros endpoints

Este plan establece el patrón para los siguientes endpoints del Bloque 3:
- `/api/v2/complete-test` — finalización de test (similar a answer-and-save pero menos antifraud).
- `/api/v2/test-config/*` — sin auth, sólo queries cacheadas.
- `/api/daily-limit` — GET informativo, ya sano (baja prioridad).

Cuando se migre cada uno, reusar `AntifraudModule`, `DailyLimitModule`, `TestAnswersModule`, `TemaResolverModule`, `BackgroundService` ya hechos.

---

## 12. Referencias

- Audit Bloque 3: [`bloque3-audit-hot-path.md`](bloque3-audit-hot-path.md)
- Patrón BACKEND_URL: [`bloque3-backend-url-pattern.md`](bloque3-backend-url-pattern.md)
- Adapter Redis cross-runtime: [`bloque3-redis-cross-runtime.md`](bloque3-redis-cross-runtime.md)
- Module medals como referencia de patrón: commit `eb8ebcf5` (POST canary), `dc1b039c` (backend code)
- AuthModule + JwtGuard: commit `0b04f294`
- Roadmap principal: [`../ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md)
