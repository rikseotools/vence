# Desacople PostgREST + RLS (preparación portable de Fase D)

> **Estado:** Fase P1 (inventario) COMPLETADA 2026-06-18. P2/P3 pendientes, incrementales.
> **Relación:** prepara `docs/ARCHITECTURE_ROADMAP.md` → Fase D (datos → RDS) SIN big-bang.
> **Principio:** cada paso mejora HOY (menos latencia/HTTP, queries por PgBouncer) y desbloquea Fase D mañana. Reversible fichero a fichero.

## 0. Por qué esto y no "migrar a RDS ya"

Fase D (mover datos a RDS) está **gated** (>$200/mes o ≥2 incidentes/mes) y el cutover en sí es barato a baja escala. El verdadero coste — y lo único **independiente de la carga**, por tanto lo único que conviene adelantar — es el **acoplamiento a Supabase de la capa de datos**:

1. **PostgREST** (`supabase.from(...)`): el SDK `supabase-js` consulta vía el servicio HTTP PostgREST de Supabase. En RDS ese servicio NO existe.
2. **RLS** (`auth.uid()`): 205 políticas, **125 usan `auth.uid()`** en 93 tablas. `auth.uid()` es una función del esquema `auth` de Supabase Auth. En RDS no existe.

### El insight que lo simplifica todo

Las conexiones **Drizzle** de la app (PgBouncer, user `postgres`) **ya bypasean RLS** — la autorización en ese path **ya vive en la app** (`verifyAuth` + `WHERE user_id = …`). RLS solo protege el path **PostgREST** (JWT anon/authenticated del navegador).

→ **Desacoplar RLS ≈ migrar los `supabase.from` a Drizzle con authz explícita.** Cuando PostgREST llegue a 0, las 125 políticas quedan **vestigiales** (nadie las usa); en RDS simplemente no están y la authz ya está en la app. **No hay que reescribir 125 políticas — hay que dejar de depender de ellas.**

### Lo que NO entra (separable, decisión posterior)

El **proveedor de identidad** (login Google OAuth, `exchangeCodeForSession`, `onAuthStateChange`, reset, signup) se queda en Supabase Auth. Puedes tener **datos en RDS + Auth en Supabase** (Supabase emite el JWT, la app lo verifica local con `verifyAuth` — ya agnóstico, Fase 0.7, 63+ endpoints). Migrar el IdP (Auth.js/Clerk) es otra decisión, posterior y opcional.

## 1. Inventario (Fase P1 — 2026-06-18)

**45 ficheros**, ~140 query-sites `supabase.from(...)`. Dos ejes ordenan el trabajo:

- **server vs client** — los `client` no pueden ir directos a Drizzle (Drizzle es server-side); requieren crear/usar un endpoint API + server action. Mayor lift.
- **tabla pública vs por-usuario** — define si la migración necesita authz explícita.
  - **Pública / shared-read** (sin authz; RLS = read-all): `laws`, `articles`, `oposiciones`, `questions`†, `video_courses`, `video_lessons`, `public_user_profiles`, `shared_question_responses`.
  - **Por-usuario** (RLS `user_id = auth.uid()`; **REQUIERE `WHERE user_id`** al migrar): `user_profiles`, `tests`, `test_questions`, `feedback_conversations`, `feedback_messages`, `user_feedback`, `psychometric_test_sessions`, `psychometric_test_answers`, `psychometric_first_attempts`, `psychometric_adaptive_logs`, `question_disputes`, `share_events`, `user_streaks`, `user_message_interactions`, `user_avatar_settings`.
  - **Admin / all-users** (gate admin; sirve datos de todos): `email_logs`, `email_events`, `notification_events`, `notification_logs`, `fraud_alerts`, `validation_error_logs`, `daily_question_usage`, `user_devices`, `user_sessions`, `upgrade_messages`, `upgrade_message_impressions`, `ai_api_config`, `question_verifications`, `email_preferences`, `user_notification_metrics`, `problematic_articles_rollout_logs`.

† `questions` es pública para LEER pero **nunca** debe exponer `correct_option` antes de responder (anti-scraping, ya respetado por los fetchers). Mantener al migrar.

### Tabla completa (45 ficheros)

| # sites | Fichero | S/C | Tablas | Clase |
|---|---|---|---|---|
| 5 | `app/page.tsx` | S | articles, laws, oposiciones, questions | pública |
| 1 | `app/oposiciones/page.tsx` | S | oposiciones | pública |
| 1 | `app/oposiciones/[filtro]/page.tsx` | S | oposiciones | pública |
| 3 | `app/cursos/[slug]/page.tsx` | S | video_courses, video_lessons | pública |
| 1 | `lib/api/laws/warmCache.ts` | S | laws | pública |
| 1 | `lib/api/video-courses/queries.ts` | S | (dinámica) | pública |
| 1 | `lib/lawFetchers.ts` | S | questions | pública† |
| 1 | `components/QuestionEvolution.tsx` | S | test_questions | por-usuario |
| 4 | `components/OposicionDetector.tsx` | S | user_profiles | por-usuario |
| 2 | `contexts/OposicionContext.tsx` | S | user_profiles | por-usuario |
| 1 | `lib/api/setTargetOposicion.ts` | S | user_profiles | por-usuario |
| 3 | `lib/adaptiveQuestionSelection.ts` | S | psychometric_adaptive_logs, psychometric_test_answers | por-usuario |
| 4 | `lib/psychometricDifficulty.ts` | S | psychometric_first_attempts, psychometric_questions | mixta |
| 2 | `lib/notifications/motivationalAnalyzer.ts` | S | tests | por-usuario |
| 1 | `lib/api/rollout/problematic-articles-logs.ts` | S | problematic_articles_rollout_logs | admin |
| 13 | `app/admin/feedback/page.tsx` | S | feedback_conversations, feedback_messages, user_feedback | admin |
| 3 | `app/api/ai/verify-answer/route.ts` | S | ai_api_config, articles, question_verifications | admin |
| 7 | `app/api/cron/fraud-detection/route.js` | S | fraud_alerts, tests, user_profiles, user_sessions | admin/cron |
| 3 | `app/api/v2/admin/broadcast/route.ts` | S | email_preferences, user_profiles | admin |
| 2 | `app/Header.tsx` | C | feedback_conversations, user_streaks | por-usuario |
| 1 | `contexts/AuthContext.tsx` | C | user_profiles | por-usuario |
| 2 | `components/OnboardingModal.tsx` | C | user_profiles | por-usuario |
| 1 | `app/teoria/[law]/LawArticlesClient.tsx` | C | user_profiles | por-usuario |
| 4 | `app/perfil/page.tsx` | C | user_feedback, user_profiles | por-usuario |
| 3 | `components/ArticleModal.tsx` | C | feedback_conversations, user_feedback, user_profiles | por-usuario |
| 7 | `components/ChatInterface.js` | C | feedback_conversations, feedback_messages, user_feedback | por-usuario |
| 2 | `components/ExamLayout.tsx` | C | share_events | por-usuario |
| 1 | `components/SharePrompt.js` | C | share_events | por-usuario |
| 1 | `components/ShareQuestion.js` | C | share_events | por-usuario |
| 2 | `components/MotivationalMessage.js` | C | user_message_interactions | por-usuario |
| 3 | `components/AvatarChanger.js` | C | public_user_profiles | pública |
| 3 | `components/UserProfileModal.js` | C | public_user_profiles, tests, user_avatar_settings | mixta |
| 1 | `components/PsychometricQuestionEvolution.tsx` | C | psychometric_test_answers | por-usuario |
| 1 | `components/Statistics/PsychometricWeakAreasAnalysis.js` | C | psychometric_test_answers | por-usuario |
| 1 | `components/Statistics/OfficialExamAttempts.tsx` | C | tests | por-usuario |
| 1 | `app/mis-estadisticas/psicotecnicos/page.js` | C | psychometric_test_sessions | por-usuario |
| 1 | `app/mis-impugnaciones/page.js` | C | question_disputes | por-usuario |
| 1 | `app/pregunta/[id]/page.tsx` | C | shared_question_responses | pública |
| 1 | `app/soporte/page.tsx` | C | notification_logs | admin |
| 1 | `app/admin/configuracion/page.js` | C | email_logs | admin |
| 2 | `app/admin/conversiones/page.tsx` | C | upgrade_message_impressions, upgrade_messages | admin |
| 14 | `app/admin/fraudes/page.tsx` | C | daily_question_usage, test_questions, user_devices, user_profiles, user_sessions, validation_error_logs | admin |
| 1 | `app/admin/newsletters/page.tsx` | C | user_profiles | admin |
| 2 | `app/admin/notificaciones/events/page.js` | C | email_events, notification_events | admin |
| 4 | `app/admin/notificaciones/overview/page.js` | C | email_events, notification_events, user_notification_metrics, user_profiles | admin |
| 6 | `app/admin/notificaciones/users/page.js` | C | email_events, notification_events, user_notification_metrics, user_profiles | admin |

## 1-bis. Audit de existencia contra el schema vivo (2026-06-18) — PRERREQUISITO

Antes de migrar nada hay que separar **acoplamiento vivo** de **código muerto** (Batches A/C demostraron que mucho código referencia objetos que ya no existen, con el error tragado). Audit de las 43 tablas referenciadas en `.from(...)` contra la BD prod:

- **🟢 40 tablas EXISTEN** → su `supabase.from` es acoplamiento real a migrar.
- **🔴 3 tablas NO EXISTEN** (código muerto, inserts/selects que fallan en silencio):
  - `shared_question_responses` → tracking en `app/pregunta/[id]/page.tsx` (dead)
  - `question_verifications` → insert en `app/api/ai/verify-answer` (dead)
  - `psychometric_adaptive_logs` → `lib/adaptiveQuestionSelection.ts` (dead)
- **🟡 Drift a nivel columna/función** (tabla existe, pero la query referencia algo inexistente → query parcialmente rota): `user_profiles.display_name` (broadcast), `articles.law_name`/`law_short_name` + función `match_articles_by_embedding` (verify-answer).

**Decisión de producto pendiente (las 3 tablas muertas + los 4 RPCs de fraude parecen "features intencionadas nunca terminadas", no basura):** por cada una → ¿se construye (crear tabla/función + completar) o se borra el código muerto? No es decisión de desacople. Mientras tanto, **NO migrar** queries sobre objetos inexistentes.

**Regla añadida al checklist (§3):** antes de migrar un fichero, ejecutar el check de existencia tabla+columnas+función contra la BD. El audit reproducible: extraer tablas con `grep -rEoh "\.from\(['\"][a-z_]+" ... | sort -u` y `select('*').limit(0)` por cada una.

## 2. Plan incremental

Lotes en orden de riesgo creciente. Cada fichero es independiente, testeable y reversible (patrón de los 6 batches de `verifyAuth`).

### Batch A — server + tabla pública (SSG) ⛔ INTENTADO y REVERTIDO 2026-06-18
Se migraron a Drizzle `app/page.tsx`, `app/oposiciones/page.tsx`, `app/oposiciones/[filtro]/page.tsx`, `app/cursos/[slug]/page.tsx` (helper `getOposicionesDirectory()`, `getTopLaws` N+1→single-query, reuso de `getCourseBySlug`). **`tsc`/eslint OK, pero el `next build` FALLÓ** (timeout >180s en `/` y varias `/oposiciones/[filtro]`). **Revertido al patrón Supabase HTTP original.**

> **⚠️ Lección clave — las páginas SSG son MAL primer batch:**
> - Estas 4 páginas son **estáticas (SSG/ISR)**: consultan en **build-time** y hornean HTML. **En runtime NO tienen acoplamiento PostgREST/RLS** (sirven HTML estático) → migrarlas aporta **poco** al desacople.
> - El cliente HTTP de Supabase (PostgREST, **stateless**) es **más robusto en build** que Drizzle. Con 13 workers de `next build` concurrentes contra el **pooler Supavisor** (`aws-0-eu-west-2.pooler`), Drizzle sufre los **zombis de conexión** documentados (ver `self-hosted-pooler.md` / ARCHITECTURE_ROADMAP §Fase 3) → cuelgues **no deterministas** (build #1 falló en `[filtro]`, build #2 en `/`). Medido: las queries en sí son rápidas (`getTopLaws` 7,5s, directorio 35ms) — **el fallo es el pooler bajo concurrencia de build, no la query.**
> - Conclusión: **diferir SSG/build-time** hasta post-RDS (RDS Proxy, sin Supavisor flaky) o hasta usar una conexión de build robusta. El desacople debe atacar **PostgREST de RUNTIME** (request-time), que es donde está el acoplamiento real.
>
> **⚠️ Corrección de inventario (lección P1):** la heurística "¿tiene `'use client'` en cabecera?" NO basta para `lib/`/componentes sin directiva: se bundlean al cliente al ser importados por código client. Hay que **trazar importadores reales**. Reclasificados a Batch D: `lib/lawFetchers.ts`, `lib/api/laws/warmCache.ts` (importados por componentes client). `lib/api/video-courses/queries.ts` ya está 100% Drizzle (su único `createClient` es Storage → S3 aparte, fuera de alcance).

### Batch B — server + por-usuario → **VACÍO** (todos client-reachable)
Los 7 candidatos de P1 (`QuestionEvolution.tsx`, `OposicionDetector.tsx`, `OposicionContext.tsx`, `setTargetOposicion.ts`, `adaptiveQuestionSelection.ts`, `psychometricDifficulty.ts`, `motivationalAnalyzer.ts`) resultaron **client-reachable** al trazar importadores (componentes/hooks/contexts client; `motivationalAnalyzer` se instancia en `hooks/useIntelligentNotifications` y hace `fetch('/api/...')` con URL relativa = navegador). → **Todos a Batch D.**

**Insight arquitectónico:** en el **servidor**, lo por-usuario **YA usa Drizzle** (migrado con `verifyAuth`). El `supabase.from` por-usuario que queda es **íntegramente client-side**. No hay deuda server por-usuario.

### Batch C — admin/cron server RUNTIME ⛔ INTENTADO 2026-06-18 → BLOQUEADO por schema-drift
Alcance recalculado a **3 ficheros** reales (no 5): `app/admin/feedback/page.tsx` resultó **`'use client'`** (línea 4, tras comentarios) → es **client → Batch D**; `lib/api/rollout/problematic-articles-logs.ts` ya estaba **migrado a raw SQL** (27/05) → 0 cambios.

Los 3 restantes (`broadcast`, `fraud-detection/route.js`, `ai/verify-answer`) son **API routes server runtime** (sin fragilidad de build), pero al migrar se descubrió que **los 3 están ROTOS por schema-drift** — referencian columnas/funciones que ya no existen, y el cliente Supabase lo **enmascaraba** (devuelve error suave / 500 que nadie mira en herramientas admin poco usadas):

| Fichero | Bug pre-existente (verificado contra BD prod) |
|---|---|
| `api/v2/admin/broadcast` | `SELECT … display_name` — la columna no existe (es `full_name`/`nickname`) → **500 siempre** al invocar |
| `api/cron/fraud-detection` | `INSERT fraud_alerts(description, affected_user_ids, metadata)` — columnas reales son `user_ids`, `details` → **insert falla en silencio, nunca persiste alertas** |
| `api/ai/verify-answer` | función `match_articles_by_embedding` **no existe** + `SELECT articles.law_name/law_short_name` (no existen) → **búsqueda semántica no-op** |

> **Por qué se revirtió todo:** migrar fiel a Drizzle **lanzaría** donde Supabase tragaba → convierte un no-op/500-silencioso en un throw (rompe el endpoint). "Behavior-preserving" no es posible sobre código roto. Arreglarlos es un **bugfix que cambia comportamiento** (p.ej. broadcast funcional = envío masivo de emails real) → **decisión de producto, NO parte del desacople.** Net: 0 código cambiado en Batch C.
>
> **Hallazgo sistémico (valioso aparte):** las herramientas admin/cron han sufrido **schema-drift** y están silenciosamente rotas; la blandura de errores de Supabase lo oculta. Migrar a Drizzle (que lanza) es, de paso, un **detector de rot**. → Tarea separada sugerida: "auditar y arreglar el tooling admin rotos".
>
> **🚨 Sub-hallazgo grave — el sistema de detección de fraude por cron está MUERTO (dos formas), descubierto 2026-06-18 al intentar arreglar `fraud-detection`:**
> - `app/api/cron/fraud-detection/route.js` — **es el que el workflow `fraud-detection.yml` ejecuta a diario**. Detecta en código (los SELECT funcionan) pero **no persiste** (insert a columnas `description/affected_user_ids/metadata` inexistentes; reales `user_ids/details`) → **0 alertas guardadas**. Taxonomía divergente (`same_ip_multiple_accounts`, `bot_behavior`…) que nunca casó con el enum canónico (`same_ip/same_device/multi_account/suspicious_premium/location_anomaly`).
> - `app/api/cron/detect-fraud/route.js` — **reemplazo bien escrito** (typed, `createFraudAlert`+`hasActiveAlert`, email admin, taxonomía correcta) pero **NADIE lo llama** (no está en ningún workflow) y sus **4 RPCs no existen** en BD (`detect_same_ip_fraud`, `detect_same_device_fraud`, `detect_multi_account_fraud`, `detect_suspicious_premium`) → no detecta nada.
> - Diagnóstico: **migración abandonada** — se escribió `detect-fraud` para sustituir a `fraud-detection`, pero nunca se crearon sus RPCs, nunca se cambió el workflow, y nunca se borró el viejo. Resultado: anti-fraude batch = 0 alertas desde hace tiempo. (El path real-time `api/fraud/report` + `sessions/track-block` usa `createFraudAlert` y podría sí crear alertas — verificar aparte.)
> - **NO migrado/arreglado:** revivirlo es trabajo de producto (crear las 4 funciones SQL O resucitar el viejo) + decisiones (reglas/umbrales/alert-fatigue), no desacople. **Decisión pendiente del usuario:** (a) construir bien UNA detección (crear RPCs + apuntar workflow a `detect-fraud` + borrar `fraud-detection`), o (b) si el anti-fraude batch no es prioridad, **borrar ambos crons + el workflow** (quita endpoints rotos y su acoplamiento). El real-time queda en cualquier caso.

**Conclusión de re-scope:** las 3 vías "fáciles" resultaron: A (SSG público) = frágil en build, B (server por-usuario) = vacío, C (admin/cron) = roto/bugs. **El trabajo real y útil del desacople está concentrado en Batch D** (client→endpoint), que además es código que **sí funciona** y tiene el acoplamiento PostgREST de runtime real.

### Batch D — client (EL trabajo real del desacople) ← SIGUIENTE
~28 ficheros client (los 26 de P1 + `lawFetchers.ts`/`warmCache.ts` reclasificados; `admin/feedback.tsx` resultó client también). Cada query de navegador debe convertirse en **endpoint API + Drizzle + authz**, y el componente pasa a `fetch()`. Plan detallado en §6.

> Nota: muchas de estas client-queries YA dependen de RLS para no filtrar datos. En RDS, sin PostgREST, **dejan de funcionar de raíz** — D es el blocker real del cutover, no un nice-to-have.

### Fase P3 — RLS vestigial
Cuando PostgREST llegue a 0 sitios: documentar que la authz es de capa app, mantener RLS como defensa-en-profundidad hasta el cutover, y en RDS prescindir de ella. Métrica de progreso: `grep -rc "\.from(['\"]" ...` → 0.

## 3. Checklist por fichero (guardarraíl no-chapuza)

1. Leer el fichero ENTERO. Identificar tabla y si es pública/por-usuario/admin.
2. Reemplazar `supabase.from(...)` por query Drizzle (server). Si es client → crear endpoint server primero.
3. **Si la tabla es por-usuario: añadir `WHERE user_id = <userId verificado>`.** ⚠️ Omitirlo = fuga de datos entre usuarios (RLS ya no protege). Es el riesgo nº1.
4. Mantener invariantes de seguridad existentes (p.ej. `questions` sin `correct_option`).
5. Test + canary. Verificar que un usuario solo ve lo suyo (probar con 2 user_id).
6. Commit por fichero/lote. Reversible.

## 4. Riesgo y mitigación

| Riesgo | Mitigación |
|---|---|
| Fuga cross-user al perder RLS | `WHERE user_id` explícito + test con 2 usuarios (paso 3/5) |
| Exponer `correct_option` | Revisar selects de `questions` (paso 4) |
| Romper el `next build` (SSG×Supavisor) | NO migrar páginas SSG/build-time hasta post-RDS; empezar por runtime (Batch C/D) |
| Client→server regresiones UX | D al final, con endpoint testeado antes de cambiar el componente |

## 5. Fuera de alcance

- **Proveedor de identidad** (login/OAuth/session) → Supabase Auth, separable, decisión posterior.
- **El cutover de datos a RDS** en sí → sigue gated en ARCHITECTURE_ROADMAP. Este doc solo lo prepara.
- **Resucitar el anti-fraude batch** → era trabajo de producto, no desacople. Decisión 2026-06-18: **borrados** ambos crons muertos (`fraud-detection` + `detect-fraud`) y el workflow `fraud-detection.yml` (opción b). Reconstruir cuando sea prioridad (git conserva `detect-fraud` como scaffold; faltarían las 4 RPCs SQL). El path real-time de fraude (`api/fraud/report`, `sessions/track-block`) NO se tocó.

## 6. Plan detallado de Batch D (siguiente trabajo real)

**Meta:** eliminar el `supabase.from` de runtime client (el acoplamiento PostgREST/RLS que de verdad bloquea Fase D), reemplazándolo por endpoints server tipados con Drizzle + authz explícita. Es código que SÍ funciona (a diferencia de A/B/C), así que es migración real, no rescate.

### Patrón por query (repetible, probado en el estilo de `verifyAuth`)
1. **Endpoint server**: crear/extender `lib/api/<dominio>/queries.ts` (Drizzle, tipado) + un route handler `app/api/.../route.ts` que llame `verifyAuth(request)`.
2. **Authz**: si la tabla es por-usuario, la query Drizzle lleva `WHERE user_id = <userId de verifyAuth>` (sustituye a RLS). Si es pública, sin authz. Si admin, gate admin.
3. **Cliente**: el componente cambia `supabase.from(...)` por `fetch('/api/...')` con `getAuthHeaders()`.
4. **Verificación**: tipos (tsc) + **test funcional con 2 usuarios distintos** (confirmar que A no ve datos de B) + canary. Como es runtime (no SSG), el `next build` no lo ejecuta → sin la fragilidad de Batch A.

### Orden (riesgo creciente)
- **D.1 — client + pública (warm-up, sin authz):** valida el patrón endpoint+fetch end-to-end con riesgo casi nulo. Candidatos: `app/pregunta/[id]` (`shared_question_responses`), `AvatarChanger.js` (lectura `public_user_profiles`), `lawFetchers.ts`/`warmCache.ts` (lecturas `questions`/`laws` públicas — ojo: `questions` SIN `correct_option`).
- **D.2 — client + por-usuario (el grueso, sensible):** `AuthContext`, `OnboardingModal`, `Header`, `perfil`, `ChatInterface`, `ArticleModal`, `ExamLayout`/`SharePrompt`/`ShareQuestion` (share_events), `MotivationalMessage`, `QuestionEvolution`/`PsychometricQuestionEvolution`, `OposicionDetector`/`OposicionContext`/`setTargetOposicion`, `adaptiveQuestionSelection`, `psychometricDifficulty`, stats psicotécnicos, `mis-impugnaciones`, `useIntelligentNotifications`+`motivationalAnalyzer`. **Cada uno con `WHERE user_id` — riesgo nº1 de fuga.**
- **D.3 — client + admin:** `admin/feedback`, `admin/fraudes`, `admin/conversiones`, `admin/newsletters`, `admin/notificaciones/*`, `admin/configuracion`, `soporte`. Endpoint admin-gated. (Ojo: pueden tener schema-drift como Batch C → verificar columnas reales contra BD antes de migrar.)

### Ratchet anti-regresión (lo que lo hace escalable)
Cuando D.1/D.2 reduzcan el conteo, añadir **regla ESLint que prohíba nuevos `supabase.from(` en `app/`, `components/`, `contexts/`** (allowlist decreciente con los ficheros pendientes). Así el desacople **converge** en vez de re-acoplarse con cada feature nueva. Métrica: `grep -rc "\.from(['\"]" app components contexts` → objetivo 0.

### Lección transversal aplicable a todo D
Antes de migrar cada fichero, **verificar las columnas/funciones reales contra la BD** (Batch C demostró que el código referencia columnas que ya no existen). Y los `catch {}`/`if (!error)` que se encuentren → **instrumentar con `emit()`**, no volver a tragarlos.
