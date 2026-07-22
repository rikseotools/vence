# CLAUDE.md - Información del Proyecto

> 📋 **Contexto Adicional:** Ver también `PROJECT_CONTEXT.md` para configuración MCP y `docs/` para documentación organizada por categorías.

## Descripción del Proyecto
**Vence** es una aplicación web de preparación para oposiciones, específicamente para Auxiliar Administrativo del Estado. Permite a los usuarios realizar tests personalizados con preguntas de exámenes oficiales y contenido generado por IA.

## Arquitectura Principal

### Componentes Clave de Tests
- **`TestLayout.js`** - Componente principal para tests normales/personalizados
- **`DynamicTest.js`** - Componente para tests generados con IA
- **`ExamLayout.js`** - Componente para modo examen (todas las preguntas visibles, corrección al final)
- **`PsychometricTestLayout.js`** - Componente para tests psicotécnicos
- **`TestPageWrapper.js`** - Wrapper que maneja diferentes tipos de tests
- **`TestConfigurator.js`** - Configurador avanzado de tests (general)
- **`LawTestConfigurator.js`** - Configurador específico para tests de leyes individuales

### APIs de Respuesta y Validación
- **`/api/v2/answer-and-save`** - Endpoint unificado de tests normales: **re-valida en servidor + guarda en `test_questions` + actualiza score + anti-fraude**. Se invoca ASÍNCRONO desde la cola (`utils/answerSaveQueue`), desacoplado del feedback que ve el usuario (ver "Sistema de Respuestas" abajo).
- **`/api/exam/validate`** - Validación batch de exámenes completos (modo examen, `ExamLayout`). El modo examen SÍ retiene `correct_option` hasta el final.
- **`/api/answer/psychometric`** y **`/api/answer/spelling`** - Validación de respuestas psicotécnicas y de ortografía.
- ⚠️ **`/api/answer` (validación individual) YA NO EXISTE** — los tests normales validan **en cliente** con el `correct_option` que viaja en el payload (feedback instantáneo, ver abajo).

### Fetchers de Datos
- **`lib/testFetchers.ts`** - Funciones para obtener preguntas por tema. **Incluye `correct_option` y `explanation` a propósito** (validación client-side instantánea).
- **`lib/lawFetchers.ts`** - Funciones específicas para preguntas por ley.

### Utilidades de Test
- **`testAnswers.js`** - Manejo de guardado de respuestas
- **`testSession.js`** - Gestión de sesiones de test
- **`testTracking.js`** - Sistema de tracking de interacciones

## Funcionalidades Recientes

### Stripe MULTI-CUENTA (Manuel renovaciones + Nila altas) (Implementado: 07/07/2026)
- **Objetivo:** operar N cuentas Stripe a la vez SIN que los usuarios lo sufran. Cuenta **Manuel** (`acct_1SnGoj…`) cobra las **renovaciones** de lo existente; cuenta **Nila** (`acct_1TogG60lMFwxldqj`) cobra las **altas nuevas**. Las suscripciones NO se mueven entre cuentas; `price_id`, `cus_`, webhooks, portal y cupones son POR-CUENTA.
- **Registro multi-cuenta:** `lib/stripe.ts` → `getStripeFor(account)`, `newSignupAccount()`, `priceBelongsToAccount()`, `getWebhookAccounts()`, `resolveAccount()`, `getPricesFor()`. `stripe()` = cuenta por defecto (Manuel), back-compat. **Escalable:** añadir cuenta = 1 fila en `ACCOUNT_ENV` + su bloque de env.
- **Atribución por usuario:** columna `user_profiles.payment_account` (`NOT NULL DEFAULT 'manuel'`, nombre NEUTRO por si entra otro proveedor). El alta nueva la marca; cancelar/portal/consultar/reactivar/cupones/recordatorios resuelven el cliente por esa columna. Migración `supabase/migrations/20260707_stripe_multi_cuenta_payment_account.sql`.
- **Webhook doble cuenta:** `app/api/stripe/webhook` verifica la firma contra AMBOS secrets; el que valida fija la cuenta y se inyecta ese cliente (`sc`) a todos los handlers. Un solo endpoint para las dos cuentas.
- **Flip controlado:** flag `STRIPE_NEW_SIGNUPS_ACCOUNT` (SSM runtime, default `manuel` = comportamiento histórico). Ponerlo en `nila` desvía las altas; hay que mover a la vez las 4 `NEXT_PUBLIC_STRIPE_*` a los valores `_NILA` (build-args, ver deploy) y redeploy. Reversible. Guardrail anti "half-flip" en create-checkout (el price debe ser de la cuenta destino).
- **Cupones de fidelidad:** `loyalty_10`/`loyalty_20` clonados en Nila con el MISMO id (los cupones son por-cuenta).
- **Tests:** `__tests__/stripe/multiAccount.test.ts` (12). Detalle/estado go-live en memoria `project_stripe_dual_cuenta_nila`.

### Barra de Meta Diaria movible + ocultable (Implementado: 04/06/2026)
- **Componente:** `components/DailyGoalBanner.tsx` (pill premium "X/Y (%)" en el Header)
- **Problema:** en móvil vive en la fila flotante `absolute top-full` del Header y tapaba contenido.
- **Arrastrable:** pointer events (ratón+táctil), posición persistida en `localStorage` (`daily_goal_pos:<uid>`, per-dispositivo), **clampada al viewport** (helper puro `clampBannerOffset`) y **re-clampada** en mount/resize (no queda fuera al rotar/cambiar pantalla). Distingue click de drag (umbral 6px) para no romper el dropdown.
- **Ocultable con ✕:** es **preferencia de CUENTA** (`user_profiles.show_daily_goal_banner`, NO localStorage) → se ve igual en todos los dispositivos. La ✕ la pone `false`; el **único** sitio para re-activarla es el toggle en `/perfil`.
- **Cableado:** `db/schema.ts` → `lib/api/profile/{schemas,queries}.ts` → `contexts/AuthContext.tsx` → `types/database.types.ts`. Helpers puros exportados (`effectiveBannerVisible`, `nextBannerVisible`, `clampBannerOffset`) testeados en `__tests__/components/DailyGoalBanner.test.ts` (18 tests).
- **Observabilidad in-house:** evento `daily_goal_banner_action` (con `userId` auto) — `action ∈ {drag,hide,show}` en éxito; en fallo del PUT **revierte** el cambio optimista y emite `severity:'warn'` (`hide_failed`/`toggle_failed`). Consulta: `observable_events WHERE event_type='daily_goal_banner_action'`.
- **Migración:** `supabase/migrations/20260604_show_daily_goal_banner.sql` (columna `boolean NOT NULL DEFAULT true`, additiva).

### Landing Pages Dinámicas con Datos de BD (Implementado: 22/03/2026)
- **Ubicación:** `app/auxiliar-administrativo-estado/page.tsx` (primera migrada)
- **Datos dinámicos de tabla `oposiciones`:** plazas, fechas, BOE reference, salario, título requerido
- **Timeline del proceso selectivo:** tabla `convocatoria_hitos` con hitos (completed/current/upcoming)
- **Links oficiales:** convocatoria BOE (`programa_url`) y seguimiento INAP (`seguimiento_url`)
- **ISR:** `revalidate = 86400` (24h) — se sirve desde el contenedor Next.js en AWS ECS
- **SEO:** JSON-LD FAQPage + Event (fecha examen), epígrafes oficiales BOE
- **Función compartida:** `getOposicionLandingData(slug)` en `lib/api/convocatoria/queries.ts`
- **Hitos:** `getHitosConvocatoria(slug)` - timeline visual en la landing
- **Helpers de formato:** `formatNumber()` (regex, sin depender de locale), `formatDateLarga()`, `formatDateCorta()`

### Monitoreo de Seguimiento de Convocatorias (Implementado: 22/03/2026)
- **Objetivo:** Detectar cambios en páginas oficiales de seguimiento de cada oposición
- **Cron:** `/api/cron/check-seguimiento` (L-V 9:00 UTC via GitHub Actions)
- **Mecanismo:** Fetch → limpiar HTML → hash SHA-256 → comparar con hash anterior
- **Tabla:** `convocatoria_seguimiento_checks` (historial) + columnas `seguimiento_*` en `oposiciones`
- **Admin:** `/admin/seguimiento-convocatorias` - lista con badges (CAMBIO/ERROR/OK)
- **Flujo:** Cron detecta cambio → badge en admin → usuario avisa a Claude → Claude actualiza hitos y landing
- **Workflow:** `.github/workflows/check-seguimiento.yml`

### Sistema de Respuestas (actualizado 21/07/2026 — el modelo anti-scraping viejo QUEDÓ OBSOLETO)

> **⚠️ Cambio de modelo.** Hasta principios de 2026 el diseño ocultaba `correct_option` y validaba cada
> respuesta llamando a `/api/answer` antes de mostrar feedback. **Ese endpoint ya no existe y ese modelo
> se abandonó a propósito:** en los tests normales la pregunta se muestra y se corrige **al instante en
> el cliente**. Priorizar la UX instantánea sobre el anti-scraping fue una decisión de producto.

**Cómo funciona HOY, por tipo de test:**

- **Tests normales (`TestLayout.tsx`, `DynamicTest`):**
  - `lib/testFetchers.ts` carga la pregunta **CON `correct_option` y `explanation`** — a propósito
    (`// Respuesta correcta incluida para validación client-side instantánea`).
  - Al responder, el cliente compara en local y fija `verifiedCorrectAnswer` **desde ese `correct_option`
    del payload** (`TestLayout.tsx`, `setVerifiedCorrectAnswer(currentQ.correct_option)`). No hay ida y
    vuelta al servidor para el feedback.
  - **La persistencia + score autoritativo va aparte y ASÍNCRONA:** `enqueueAnswer` (`utils/answerSaveQueue`)
    → `/api/v2/answer-and-save`, que **re-valida en servidor** (`lib/api/v2/answer-and-save`) para el registro
    en `test_questions`, el score y el anti-fraude. Es decir: el usuario ve el resultado al instante, y el
    servidor tiene su propia verdad para las estadísticas. Los dos caminos están desacoplados.
- **Modo examen (`ExamLayout.js`):** **SÍ sigue el modelo seguro.** Las preguntas se sirven **sin
  `correct_option`** (`/api/exam/resume`: *"NO incluir correct_option — se valida via /api/exam/validate"*)
  y la corrección es **batch al final** vía `/api/exam/validate`. Aquí la clave no viaja hasta terminar.
- **Psicotécnicos / ortografía:** validan por su endpoint (`/api/answer/psychometric`, `/api/answer/spelling`).

#### Endpoints vigentes
| Endpoint | Uso |
|----------|-----|
| `/api/v2/answer-and-save` | Tests normales: re-valida + guarda + score + anti-fraude (async, vía cola) |
| `/api/exam/validate` | Modo examen: validación batch al terminar |
| `/api/answer/psychometric` · `/api/answer/spelling` | Psicotécnicos y ortografía |
| ~~`/api/answer`~~ | **ELIMINADO** — los tests normales validan en cliente |

#### Tests
- **`__tests__/security/answerValidation.test.ts`** (+ `answerValidationRobustness.test.ts`) — fijan el
  comportamiento actual de validación/guardado.

#### Logs de Debug
- `✅ [answer-and-save]` - guardado + validación server-side de tests normales
- `✅ [API/exam/validate]` - validación batch de modo examen

### Configurador de Tests para Leyes Específicas (Implementado: 17/10/2025)
- **Ubicación:** `app/leyes/[law]/LawTestConfigurator.js`
- **Funcionalidad:** Configurador especializado para tests de leyes individuales
- **Características:**
  - Preselecciona automáticamente la ley específica
  - Oculta opciones no relevantes (preguntas oficiales, artículos imprescindibles)
  - Calcula correctamente las preguntas disponibles por ley
  - Interfaz simplificada para estudio de leyes específicas
- **Diferencias con TestConfigurator general:**
  - No permite selección múltiple de leyes
  - No incluye opciones de oposición (solo estudio de ley)
  - Optimizado para una sola ley preseleccionada

### Sistema Dual de Respuestas (Implementado: 01/01/2025)
- **Ubicación:** `TestLayout.js` líneas 924-943, `DynamicTest.js` líneas 393-412
- **Funcionalidad:** Los usuarios pueden responder de dos formas:
  1. **Método tradicional:** Haciendo clic en las opciones de respuesta completas
  2. **Método rápido:** Usando botones cuadrados A/B/C/D sin scroll
- **Diseño:** Botones cuadrados azules (56x56px) con efectos hover y selección
- **Comportamiento:** Los botones aparecen solo antes de responder y desaparecen después
- **Compatibilidad:** Dark mode y diseño responsive

### Características Técnicas
- **Framework:** Next.js 15.3.3
- **Base de datos:** AWS RDS PostgreSQL (ver sección BD; Supabase congelado como backup)
- **Autenticación:** Context-based con Supabase Auth
- **Estilos:** Tailwind CSS con dark mode
- **Tracking:** Sistema completo de analíticas de usuario
- **Hosting/Deploy:** **AWS ECS/Fargate** (contenedor Docker en ECR, NO Vercel). Deploy por GitHub Actions `.github/workflows/frontend-deploy.yml` (+ `backend-deploy.yml`). Variables: las `NEXT_PUBLIC_*` se inyectan como **build-args** (se inlinean en el bundle al construir la imagen); los secrets de **runtime** viven en **SSM Parameter Store** bajo `/vence-frontend/<NAME>` y el task def de ECS los referencia (helper `ensure_secret` en el workflow). AWS CLI: `aws --profile vence --region eu-west-2` (cuenta 349744179687).

## Estructura de Tests

### Tipos de Test Disponibles
1. **Test Aleatorio** - Preguntas mezcladas automáticamente
2. **Test Personalizado** - Configuración avanzada (cantidad, dificultad, exclusiones)
3. **Test Rápido** - 10 preguntas para práctica rápida
4. **Test Oficial** - Solo preguntas de exámenes oficiales reales
5. **Test Dinámico IA** - Preguntas generadas con inteligencia artificial

### Configuraciones de Test
- Número de preguntas (configurable)
- Exclusión de preguntas recientes
- Filtros por dificultad
- Solo preguntas oficiales
- Enfoque en áreas débiles
- Límite de tiempo

## Flujo de Respuesta a Preguntas (tests normales)

1. **Carga de pregunta** → la pregunta llega CON `correct_option` y `explanation` en el payload (fetcher)
2. **Botones rápidos** → Aparecen botones cuadrados azules A/B/C/D al final
3. **Selección** → Usuario puede usar cualquiera de los dos métodos
4. **Validación anti-duplicados** → Sistema previene respuestas múltiples
5. **Corrección INSTANTÁNEA en cliente** → se compara con el `correct_option` del payload y se fija `verifiedCorrectAnswer` sin llamar al servidor
6. **Resultado** → Muestra explicación y feedback usando `verifiedCorrectAnswer` (al instante)
7. **Guardado + score (async, en 2.º plano)** → `enqueueAnswer` → `/api/v2/answer-and-save` re-valida en servidor, persiste en `test_questions`, actualiza score y pasa anti-fraude
8. **Navegación** → Botón para siguiente pregunta

> En **modo examen** el flujo es distinto: sin `correct_option` en el payload, corrección batch al final vía `/api/exam/validate`.

## Comandos de Desarrollo

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Tests
npm run test

# Lint
npm run lint

# Type check
npm run typecheck

# Git push (SIEMPRE usar origin main)
git push origin main
```

## Lifecycle de Preguntas (Implementado: 03/05/2026)

**Sistema robusto de visibilidad de preguntas con state machine de 8 estados + audit trail completo + invariante por construcción.**

- **Roadmap completo:** `docs/roadmap/sistema-desactivacion-preguntas.md`
- **Estados:** `draft`, `needs_review`, `needs_human`, `quarantine`, `approved`, `tech_approved`, `retired_duplicate`, `retired_irreparable`
- **Invariante física:** `is_active` es `GENERATED ALWAYS AS (lifecycle_state IN ('approved', 'tech_approved')) STORED`. Imposible que se desincronicen — el motor Postgres rechaza cualquier `UPDATE is_active` con "can only be updated to DEFAULT".
- **Única vía legítima de cambio:** función SQL `transition_question_state(question_id, expected_state, new_state, reason_code, changed_by, ai_verification_id, notes)`. Valida transiciones legales, optimistic check anti-race, rechaza estados terminales (`retired_*`).
- **Audit completo:** tabla `question_lifecycle_history` (append-only, fuente única de verdad). Trigger fallback `tg_questions_lifecycle_audit_fallback` registra cualquier UPDATE directo como `reason_code='bypass_detected'`.
- **Endpoint admin:** `POST /api/admin/questions/lifecycle/transition` (requiere admin auth)
- **Constants:** `lib/constants/lifecycleReasons.ts` (taxonomía cerrada de 25 `reason_code`s + helpers `isLegalTransition`, `legacyStatusToTransition`)
- **Cron grandfather (no programado aún):** `SELECT public.lifecycle_grandfather_expire(90)` — degrada a `draft` preguntas legacy approved sin verificar tras 90d

**Columnas legacy** (`topic_review_status`, `verification_status`, `deactivation_reason`) se siguen escribiendo por compatibilidad pero `lifecycle_state` es la fuente de verdad. Eliminación pendiente cuando todos los readers (admin UI, funciones SQL `get_topic_questions_*`, tests) migren.

## Base de Datos (~~Supabase~~ → AWS RDS desde 2026-07-04)

> ⚠️ **CUTOVER A RDS (04/07):** la BD de prod es **AWS RDS** (`vence-prod`, PostgreSQL 17.6 Multi-AZ, eu-west-2).
> **Todos los datos vivos están en RDS; Supabase quedó CONGELADO como backup** (a decomisionar tras 48-72h).
> - **La sección "Consultas a Base de Datos desde Claude Code" (abajo) usa el cliente Supabase (ANON key) →
>   apunta a Supabase CONGELADO → datos desactualizados.** Para consultar la BD VIVA, conectar a RDS con
>   `postgres`/`pg` usando la URL de RDS (memoria `project_cutover_rds_prod`; `ssl:{rejectUnauthorized:false}`).
> - El pool de la app es `max:5` (era `max:1`, workaround de Supabase); pooler self-hosted bypassed.
> - Detalle + gotchas: memoria `project_cutover_rds_prod`, `docs/roadmap/migracion-datos-supabase-a-rds.md`.

### 🧩 Modelo NUCLEAR: preguntas ↔ artículos ↔ temas (FUENTE DE VERDAD)

**Tenerlo SIEMPRE claro — no liarse con los `tags`:**

1. **La pregunta cuelga de un ARTÍCULO de una ley** (`questions.primary_article_id` → `articles`; adicionales en `question_articles`). **El artículo es la fuente única de la verdad** del contenido de la pregunta.
2. **Cada tema de cada oposición se forma con `topic_scope`**: filas `(position_type, topic_id, law_id, article_numbers[])` construidas **según el epígrafe oficial** de ese tema. Un tema = "estos artículos de estas leyes porque su epígrafe los incluye".
3. **Una pregunta aparece en un tema SI su artículo (law_id + article_number) está en el `topic_scope` de ese tema.** La misma ley/artículo escopa en temas distintos de oposiciones distintas (cada `position_type` arma su temario).
4. **`questions.tags` son metadatos y NO mandan en la colocación** (suelen venir cruzados/stale de otra oposición). Para colocación, IGNORAR tags y mirar `topic_scope`. No existe tabla `question_topics`.

**Diagnóstico `tema_incorrecto`:** coger el artículo de la pregunta → buscar en qué `topic_scope` de la oposición del usuario aparece → comparar el artículo con el `topics.epigrafe` → si no encaja con el epígrafe, quitarlo del `article_numbers`. Detalle: `docs/maintenance/verificar-epigrafe-topic-scope.md` + impugnaciones §7.2.

### Tablas Principales
- `questions` - Preguntas de exámenes (con `lifecycle_state`, `is_active` GENERATED)
- `question_lifecycle_history` - Audit trail append-only de transiciones de estado
- `test_sessions` - Sesiones de tests de usuarios
- `detailed_answers` - Respuestas detalladas con analytics
- `user_profiles` - Perfiles de usuario
- `articles` - Artículos de legislación
- `oposiciones` - El **CUERPO** estable (identidad, temario, SEO). Sus columnas de convocatoria (plazas/fechas/estado/BOE) son **LEGACY** en deprecación (Sprint G)
- `convocatorias` - **SSOT del PROCESO** (plazas, fechas, estado, BOE por año; `is_current`). Fuente única que alimenta landing/catálogo/banner
- `oposiciones_ssot` (**VISTA**) - drop-in de `oposiciones` con los campos temporales resueltos desde la convocatoria vigente + fallback. **Los lectores leen de aquí**, no de `oposiciones` directo. Objeto Drizzle en `db/oposicionesSsot.ts`. Detalle: `docs/roadmap/consolidacion-convocatorias-radar-ssot.md`
- `convocatoria_hitos` - Hitos del proceso selectivo (timeline en landings)
- `convocatoria_seguimiento_checks` - Historial de checks de páginas de seguimiento

### Formato de Respuestas (questions.correct_option)
- **0 = A**, **1 = B**, **2 = C**, **3 = D** (0-indexed)
- Constraint: `correct_option >= 0 AND correct_option <= 3`

### Sistema de Tracking de Notificaciones (Implementado: 04/08/2025)
- `notification_events` - Eventos de notificaciones push (permisos, envíos, clicks, etc.)
- `email_events` - Eventos de emails (enviados, abiertos, clickeados, rebotes)
- `user_notification_metrics` - Métricas agregadas por usuario para análisis rápido

### Vistas de Analytics
- `admin_notification_analytics` - Vista consolidada para métricas de notificaciones push
- `admin_email_analytics` - Vista consolidada para métricas de emails por tipo

### Funciones RPC
- `get_personalized_questions` - Obtener preguntas personalizadas
- `get_weak_areas` - Análisis de áreas débiles del usuario
- `save_test_result` - Guardar resultados de test
- `update_user_notification_metrics()` - Trigger automático para actualizar métricas


## Notas de Implementación

### Exposición de `correct_option` — modelo por tipo de test (revisado 21/07/2026)

> **El modelo "NUNCA exponer `correct_option`" YA NO aplica a los tests normales.** Se abandonó a
> propósito para dar **feedback instantáneo**: en los tests de práctica la clave viaja en el payload y
> la corrección es client-side (ver "Sistema de Respuestas"). No es un bug ni una fuga a arreglar — es
> el diseño actual. **No "resegurizar" los tests normales** salvo decisión de producto explícita.

- **Tests normales / práctica:** la pregunta se sirve **CON `correct_option` y `explanation`**
  (`lib/testFetchers.ts`, `lib/lawFetchers.ts`) para corrección instantánea. El endpoint
  `/api/questions/filtered` los devuelve por diseño. La verdad para score/estadística la recalcula el
  servidor aparte en `/api/v2/answer-and-save`.
- **Modo examen (donde el anti-scraping SÍ importa):** las preguntas se sirven **SIN `correct_option`**
  y se validan batch al final. Esto NO se toca:
  | Endpoint | Comportamiento |
  |----------|----------------|
  | `/api/exam/resume` | Reanudar examen — preguntas **sin** `correct_option` |
  | `/api/exam/validate` | Validación batch server-side al terminar |
- **Tests:** `__tests__/security/answerValidation.test.ts` + `answerValidationRobustness.test.ts`.

#### QuestionContext (`contexts/QuestionContext.js`)
- Expone `correctAnswer` solo cuando `showResult = true` (patrón `correct: showResult ? verifiedCorrectAnswer : null`).
  Es un tema de **UX/render** (no revelar la respuesta en la UI antes de contestar), no de red — en los
  tests normales el dato ya está en el cliente. Usado por `AIChatWidget` para sugerencias contextuales.

### Anti-Duplicados
- Sistema robusto para prevenir respuestas múltiples
- Uso de Maps globales y timeouts
- Validación en cliente y servidor

### Performance
- Lazy loading de componentes
- Optimización de consultas a BD
- Cache de sesiones de usuario
- Cleanup automático de eventos

### Accesibilidad
- Dark mode completo
- Responsive design
- Keyboard navigation
- Screen reader compatible

## Mantenimiento

### 📋 Tareas pendientes / backlog con CLAIM entre sesiones (runbook obligatorio)
- **Runbook:** `docs/runbooks/tareas-pendientes.md`
- **Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** *"revisa las tareas pendientes"*, *"revisa el backlog"*, *"revisa los pendientes"*, *"¿qué tareas pendientes tenemos?"*, *"lista las tareas pendientes"*, *"tareas pendientes"*, *"coge una tarea"*, *"ataca la tarea X"*, *"dame la siguiente tarea"*, *"qué hago ahora"*, *"añádelo a pendientes"*, *"cierra la tarea X"*. Seguirlo **ANTES** de ponerse a trabajar en nada del backlog.
- **REGLA DURA — coger ANTES de trabajar:** con 2-10 sesiones en paralelo, si no has hecho `claim` la tarea está libre para las demás aunque tú lleves una hora con ella. Caso real 20/07: una sesión montó un worktree para el RD 176/2022 mientras otra ya lo estaba arreglando.
- **ENFORCEMENT (no depende de tu memoria):** el hook **`.husky/pre-push`** (`scripts/backlog-push-guard.cjs`) **bloquea el push** si un commit que empujas menciona un `T-NNN` vivo que **no tienes reclamado** (o lo tiene otra sesión). Fail-open si la BD no está accesible; escape legítimo con `BACKLOG_GUARD_SKIP=1 git push …`. Y `claim` ahora **imprime la ficha entera**, así reclamar y leer son el mismo acto. Nace de la reincidencia del 20/07 (RD 176/2022 y T-044). Lógica pura testeada en `__tests__/backlog/pushGuard.test.ts`.
- **Reparto:** el **contenido** vive en `docs/roadmap/tareas-pendientes.md`; el **estado de claim** en la tabla `backlog_tasks` (RDS). Se unen por el id `T-xxx` de la cabecera. Un markdown NO admite claim atómico (dos sesiones leen "libre", ambas escriben, gana la última).
- **Comandos:** `node scripts/backlog.cjs list | next | claim T-042 | heartbeat | mine | done T-042 --outcome "…" | release T-042 | sync`. El session-id se auto-deriva (igual que `cola.cjs`).
- **Lease, no lock:** el claim caduca a los 90 min y se renueva con `heartbeat`. Una sesión que muere libera su tarea sola; una viva la conserva mientras dé señales.
- **Al cerrar: `done --outcome` Y mover la entrada a `## Hechas`** en el markdown. Las dos cosas — el guardarraíl de CI (`__tests__/guardrails/backlogRegistry.guardrail.test.ts`) falla si divergen. Eso evita el otro fallo del 20/07: una ficha anunciando *"9 mislinks EN VIVO"* que ya estaban resueltos.
- **Al terminar, para pushear/desplegar:** `docs/runbooks/pusheo-revision-despliegue.md` (fuente única del deploy). Recordatorio: **pushear a `main` ≠ desplegar** — pushear es libre en cuanto TU tarea está completa; el deploy es cumulativo (sube todo `main`) y se coordina.

### 🚨 Salud del sistema (runbook obligatorio)
- **Runbook:** `docs/runbooks/health-check.md`
- **Cuándo consultarlo:** cuando el usuario diga *"busca errores"*, *"qué tal va"*, *"estado del sistema"*, *"salud"*, *"hay fuego"*, o similar, Claude DEBE seguir el runbook ANTES de improvisar.
- **Panel admin:** `/admin/salud-sistema` (4 indicadores con semáforo verde/ámbar/rojo, auto-refresh 60s)
- **Indicadores:** errores 5xx 24h, drift de contadores materializados, latencia INSERT a test_questions, salud del cron de drift.
- **Comando CLI rápido** (30s para veredicto verde/ámbar/rojo) en la sección 1 del runbook.

### 🗺️ Salud del contenido — hallazgos → runbook (frases-gatillo)
- **Fuente única del mapa:** `lib/admin/runbookRegistry.ts` (kind → frase → runbook → qué hace Claude). El panel `/admin/salud-sistema` y `/admin/contenido` muestran un chip *"→ dile a Claude: «…»"* por hallazgo + una "Guía de runbooks". Sweep nocturno `scripts/health-sweep.cjs` → `content_health_findings`.
- **Cuándo:** cuando el usuario diga una de estas frases (o toque el badge de Salud del contenido), Claude sigue el runbook indicado ANTES de improvisar. Guardarraíl: `__tests__/lib/admin/runbookRegistry.test.ts` verifica que registro ↔ CLAUDE.md no divergen.
- **Mapa (frase → qué mira):**
  - *"busca errores"* → fallos de app (5xx, páginas caídas, webhook, render) → `health-check.md`.
  - *"revisa los temas vacíos"* → temas publicados con 0 preguntas → `salud-contenido.md`.
  - *"revisa la coherencia de las tarjetas"* → tarjetas de plazas/temas que no cuadran con la convocatoria → `salud-contenido.md`.
  - *"revisa el dual-write de convocatorias"* → campos de convocatoria sin propagar → `salud-contenido.md`.
  - *"revisa los hitos de convocatoria"* → inscripción abierta con timeline vacío → `rollover-oposiciones.md`.
  - *"revisa los hitos vencidos"* → hitos `upcoming` con la fecha YA PASADA → `rollover-oposiciones.md`. Distinguir por `origen`: `registro` = fecha REAL cuyo evento ya ocurrió y nadie cerró el hito (→ `completed`; si era el examen, rollover); `estimacion` = fecha que nos inventamos como marcador y encima venció (NO se publica — el render la oculta desde el 20/07 — pero hay que revisarla contra fuente oficial o quitarla). Detección: `health-sweep.cjs` (kind `hito_vencido_abierto`). Render: `lib/convocatoria/fechaEstimada.ts`. NUNCA convertir una estimación en fecha oficial sin cita literal de boletín.
  - *"revisa las urls de seguimiento"* → `seguimiento_url` que vigila un ciclo YA CERRADO (falso negativo silencioso: parece que hay monitoreo y no lo hay) → `oeps-convocatorias-seguimiento.md`. Detección graduada `lib/convocatoria/seguimientoUrlSalud.cjs` (kind `seguimiento_url_stale`): `stale_boletin` (URL a documento de boletín inmutable de año viejo) = casi seguro, es `error`; `posible_ciclo_viejo`/`url_generica` = cola de revisión, pueden ser legítimas. Al repuntar, poner `seguimiento_last_hash=NULL` o el cron da un `changed` falso. NUNCA repuntar sin confirmar la URL nueva contra fuente oficial.
  - *"revisa los textos de examen pasado"* → `landing_faqs`/`landing_description` que anuncian un examen ya pasado como vigente ("¿Cuándo es el examen? El 18 de abril de 2026") → `rollover-oposiciones.md`. Punto ciego del badge de rollover (solo mira `exam_date`, no los textos). Detección calibrada `lib/convocatoria/examenPasadoEnTexto.cjs` (kind `texto_examen_pasado`): solo marca el ENGAÑO (presentado como vigente), no el histórico ("se celebró el…") ni fechas de plazo/publicación. Verificar estado real contra fuente oficial y reescribir forward. GOTCHA jsonb: reescribir `landing_faqs` con `sql.json(x)`, nunca `JSON.stringify(x)::jsonb`.
  - *"revisa la cobertura de temas"* → temas con <6 preguntas → `salud-contenido.md`.
  - *"revisa los artículos sin preguntas"* → artículos que están en el `topic_scope` con contenido real pero **0 preguntas activas** (al usuario nunca le salen en los tests aunque el tema en conjunto sí tenga preguntas; caso M/SMS Tema 7) → `salud-contenido.md`. Detección: `article_no_coverage` en `health-sweep.cjs` (≥4 arts sin preguntas en un tema, excluye derogados). Generar preguntas ancladas al texto del artículo + doble auditoría ciega antes de activar.
  - *"revisa las tablas de artículos"* → tablas aplanadas (import PDF sin rejilla) → `tablas-articulos.md`. Detección: `lib/teoria/detectFlattenedTable.ts`; render table-aware: `lib/teoria/formatLegalText.ts`. NUNCA inventar cifras; reconstruir con verificación humana.
  - *"revisa las leyes anuales caducadas"* → ley "para el año XXXX" ya pasado que sigue en un `topic_scope` (presupuestos anuales; gap que ni el radar de epígrafes ni el monitor BOE cazan) → `leyes-anuales-caducadas.md`. Detección: `lib/laws/staleDatedLaw.ts`. ACTUALIZAR a la vigente + generar preguntas, NUNCA quitar si el epígrafe la pide.
  - *"revisa el timeline de convocatorias"* → hitos que se contradicen **entre sí** (orden imposible, dos fechas de examen del mismo ciclo) o previsiones caducadas / `status` que contradice su propia fecha → `verificar-convocatorias.md`. Deterministas: sin IA y sin documentos. Casos reales: `celador-sermas-madrid` abría el plazo el 7-ago y lo cerró el 6-ago; `guardia-civil` mostraba el examen del 10-jul como "próximo" seis días después.
  - *"revisa las explicaciones rotas"* → preguntas visibles cuya "explicación" es en realidad la nota de un pase IA anterior (*"La explicación debería…"*, *"posible errata"*, *"Nota técnica:"*, *"Esta pregunta debería anularse"*) — defecto de pipeline → `salud-contenido.md`. Detección: grep de patrones en `health-sweep.cjs` (kind `audit_note_explanation`). Verificar clave contra la ley/fuente → reescribir explicación o `needs_human` (flujo `revisar-preguntas-con-agente.md`). NUNCA auto-flip de clave.
  - *"revisa la completitud de las leyes"* → leyes que sirven en temas vivos SIN verificar contra su fuente oficial: `false_green` (marcada "actualizada" sin evidencia), `no_source` (sin `boe_url`), `never_verified`, `incomplete` (faltan artículos) → `completitud-leyes.md`. Detección: `lib/laws/completeness.ts` (`classifyLawCompleteness`) + `scripts/audit-law-completeness.cjs` (kind `law_unverified_source`). Gap que el monitor BOE no ve (solo parsea BOE consolidado; las regionales/editoriales quedan fuera). Registrar fuente + comparar artículo por artículo + importar lo que falte (verbatim, doble auditoría). NUNCA marcar verificada sin evidencia (`last_verification_summary`). Diseño robusto: `docs/roadmap/verificacion-completitud-leyes.md`.
  - *"revisa los incisos anulados"* → **inciso anulado por el TC** (o disposición derogada) que servimos SIN nota de vigencia: un artículo con un inciso declarado inconstitucional y nulo por una STC (marcado en el BOE consolidado) que nuestro import no capturó → la clave de una pregunta puede dar por válido lo anulado → `incisos-anulados-tc.md`. Detección: `lib/laws/annulledProvisions.ts` + `scripts/audit-annulled-provisions.cjs` (kind `article_annulled_unmarked`) — cruza el **análisis del BOE datosabiertos** (`referencias.posteriores` "SE DECLARA … inconstitucional/nulidad … art. N") con nuestros artículos. Gap que ni el monitor BOE (cambios futuros) ni completitud (artículos que faltan) vigilaban. Caso origen: art. 126.2 LBRL / STC 103/2013 (incidente Alfonso). Verificar el inciso contra la sentencia → añadir nota de vigencia + revisar la clave de las preguntas; NUNCA auto-flip de clave. v1 = leyes nacionales (la API datosabiertos no cubre regionales); barrido completo = cron incremental pendiente.
  - *"revisa los huecos del temario"* → **título con preguntas huérfanas**: un título de una ley que la oposición usa, con preguntas activas, flanqueado a ambos lados por artículos escopados, pero con 0 artículos suyos en el `topic_scope` (hueco INTERNO) → `verificar-epigrafes-scope.md`. Detección: prefiltro determinista en `health-sweep.cjs` (kind `scope_titulo_huerfano`) → adjudicación con el pipeline LLM `verify:scope` (epígrafe↔scope). Punto ciego entre la detección ley-entera (`audit-epigrafe`: la ley SÍ está) y la tema-servido (`empty_topic`/`low_coverage`: el tema tiene cientos de preguntas por otros títulos). Caso raíz: CE Título V (108-116) huérfano en Diputación Córdoba, 186 preguntas sin practicar. Si el epígrafe nombra el título → añadir su rango al scope reusando las preguntas ya en BD; si el programa no lo incluye → dejarlo. NUNCA añadir un título que el epígrafe no pida ni quitar el que sí.
  - *"revisa la sobre-inclusión del temario"* → **scope MÁS ANCHO que el epígrafe**: el epígrafe enumera sub-materias concretas de una ley pero el `topic_scope` mete casi la ley entera → sirve preguntas **fuera de programa en silencio** → `verificar-epigrafes-scope.md`. Detección: `lib/laws/scopeOverInclusion.ts` (`classifyScope`) + mirror en `health-sweep.cjs` (kind `scope_over_inclusion_suspect`, solo banda **HIGH**: el epígrafe cita títulos-con-hueco o artículos concretos y el scope los ignora; la MEDIUM —patrón prosa tipo T11— alimenta la adjudicación bajo demanda, no pinga el badge). **Punto ciego doble:** los detectores de HUECOS no lo ven (el tema rebosa preguntas) y el verificador epígrafe↔scope lo dio en **FALSO VERDE** ("el epígrafe abarca toda la ley"). Caso raíz 21/07: SMS T11 Ley 3/2009 con los 73 arts cuando el epígrafe solo pide Títulos II-IV + VII; el run lo marcó `verified_correct` y una usuaria lo cazó 4 min después. Adjudicar con verify:scope mapeando epígrafe→título y recortar a lo que el epígrafe pide (las preguntas fuera quedan en BD, dejan de servirse en ese tema). NUNCA recortar un bloque que el epígrafe sí pide ni dar por buena la ley entera sin mapear su estructura.
  - *"revisa los artículos fantasma del scope"* → **número escopado sin fila ACTIVA en `articles`**: una entrada de `topic_scope.article_numbers` que no tiene artículo servible (mismo `law_id`) → sirve 0 preguntas y 0 teoría **en silencio**, por dos causas → `verificar-epigrafes-scope.md`. (a) `inexistente` (no hay fila: `article_numbers` es `text[]`, no FK); (b) `desactivado` (la fila existe con `is_active=false` → aunque tenga preguntas activas, no se sirven). Detección determinista en `health-sweep.cjs` (kind `scope_phantom_article`), separada por `boe_url` (ley real = hueco accionable; virtual/ofimática `· Escritorio/Web` = variante mal, va como contexto). Punto ciego del verificador epígrafe↔scope (razona sobre materia/rangos, no existencia/actividad por-artículo — da CORRECT dando por cubierto el artículo que falta) y del detector de filas rotas (solo caza `'{}'`). Casos raíz 21/07 (los cazó una usuaria): LPRL art 3 **inexistente** en administrativa_universidad_de_murcia, y LPRL art 3 **desactivado** (con 38 preguntas) en auxiliar_administrativo_sms. Remediar: si inexistente → importar del BOE (verbatim, doble auditoría) + generar preguntas; si desactivado → reactivar (revisando por qué se desactivó); si la ley NO tiene ese artículo → recortar el scope. NUNCA inventar el artículo ni dejar el número colgado.
  - *"revisa la provenance de convocatorias"* → **documento oficial referenciado por un hito pero SIN clonar/enlazar**: el timeline cita un BOE/boletín (`convocatoria_hitos.url` + `cita_literal`) pero ese documento no está clonado en `convocatoria_documentos` o no está enlazado (`source_documento_id`) → `provenance-convocatorias.md`. Detección: vista `convocatoria_docs_coverage` (kind `convocatoria_docs_incompletos`). Gap medido 21/07: solo 18/1044 hitos enlazados, 239 documentos referenciados sin clonar (mayoría BOE), la capa de verificación sin usar. Arreglo por coste: enlazar lo ya clonado sin fetch (`backfill-hito-source-documento.cjs`) → clonar los que falten desde su URL oficial (tipo real, no `nota`; `content_hash`+snapshot) → resolver citas sin fuente. NUNCA clonar sin verificar la URL ni fabricar cita/hash; si la URL da 403 dejar el hueco anotado.
  - *"revisa el barajado"* → **pregunta `shuffle_safety='safe'` cuya explicación cita una opción por letra/número/posición** (regresión: miss del detector/auditoría LLM, o edición que el trigger no invalidó) → barajarla rompería la explicación → `barajar-opciones-verificacion-robusta.md`. Detección: `scripts/sweep-shuffle-safety-drift.ts` (detector REAL, sin copia) invocado por `health-sweep.cjs` (kind `shuffle_safe_regressed`); comprueba también hash desincronizado (integridad del trigger `tg_questions_shuffle_safety_invalidate`). Remediar: confirmar y bajar a `unsafe` vía `record_shuffle_safety`, o reescribir la explicación a formato sin letras (Fase 2). NUNCA dejar barajable una explicación letra-anclada ni auto-editar la clave.

### 📡 Observabilidad (manual completo)
- **Manual:** `docs/runbooks/observability.md`
- **Cuándo consultarlo:** al añadir un nuevo writer (cron, endpoint, handler), al diseñar dashboards/alertas, al investigar incidente, o cuando se pregunte sobre client-side errors / SLOs / tracing.
- **Filosofía martillo:** *"Si un usuario nos reporta un bug que la observabilidad podía haber capturado, hemos fallado."*
- **Principio rector arquitectural:** **AWS-native by default, agnóstico by contract.** La intención futura es migrar a AWS (escala mejor que Vercel/Supabase) pero el código de app habla con interfaces estándar — swap de sink ≠ rewrite.
- **Estado actual (2026-05-25):** MVP — tabla `observable_events` + writers Vercel/Fargate + 1 cron + espejo `validation_error_logs`. Falta Fase 1 (client-side observability + interceptor backend + endpoint ingest + más crons), Fase 2 (alertas + dashboard), Fase 3 (smoke E2E), Fase 4 (SLOs), Fase 5 (tracing OpenTelemetry).
- **Roadmap priorizado:** §13 del manual — siguiente paso recomendado es **endpoint `/api/observability/ingest`** (gateway universal, desbloquea client-side + GHA + Sentry webhook).
- **Migración a AWS:** §11 del manual explica qué cambia (sinks, alertas) y qué NO (todo el código de app, queries SQL, dashboards, SLOs). Diseño Sink intercambiable en §4.

### 📣 Análisis de Google Ads / Campañas (runbook)
- **Runbook:** `docs/runbooks/google-ads-analisis.md`
- **Cuándo consultarlo:** cuando el usuario diga *"investiga ads"*, *"campañas"*, *"rendimiento de anuncios"*, *"dónde meto presupuesto"* o similar, Claude DEBE seguir el runbook ANTES de improvisar.
- **Resumen:** integración Google Ads API (`lib/services/googleAds/`, comandos `npm run ads:*`, panel `/admin/ads`). El runbook explica cómo mirar coste/clics/registros + ingreso real + fecha de examen, con queries listas y el framework de decisión de presupuesto. Aprendizaje clave (02/06/2026, datos reales): la gente compra premium cerca del examen (pico 0-30 días), el examen pasado seca las ventas, y el coste/registro solo engaña si no se cruza con fecha de examen e ingreso. Mantener puja por CLIC (decisión Manuel).

### 📘 Análisis y gestión de Meta Ads (Facebook/Instagram) (runbook)
- **Runbook:** `docs/runbooks/meta-ads-analisis.md`
- **Cuándo consultarlo:** cuando el usuario diga *"meta ads"*, *"facebook ads"*, *"instagram ads"*, *"campañas de meta"*, *"publi en meta"* o similar.
- **Resumen:** Marketing API v21.0 vía System User (credenciales `META_ADS_*` en `.env.local`), página de anuncios **Vence Oposiciones** (`META_PAGE_ID`). El runbook tiene comandos `curl` listos (listar/insights/pausar/activar/presupuesto/crear campaña-conjunto-anuncio), playbook de creación, cruce con ingresos en BD y los **gotchas** del alta (app en modo Live, política de no discriminación en Usuarios del sistema → "+ Agregar", unidades en céntimos, géneros 1/2, geo region keys, subir imágenes multipart). **Cliente ideal que paga (datos reales 17/06): MUJER, 25-55** (73% mujeres; 92% de ventas en 25-54; 18-24 solo 3%). Pujar por CLIC con techo bajo (Conversiones arranca caro). Creativos: `marketing/ad-creatives/meta/generate.py`. Atribución BD: `registration_source='meta'` (NO `'meta_ads'`).

### 🔎 Oportunidades SEO (runbook)
- **Runbook:** `docs/runbooks/seo-oportunidades.md`
- **Cuándo consultarlo:** cuando el usuario diga *"oportunidades SEO"*, *"qué mejoro de SEO"*, *"subir en Google"*, *"posiciones orgánicas"* o similar.
- **Resumen:** datos de Google Search Console (conectado por API, `lib/services/googleSearchConsole/`). Comandos `npm run gsc:seo` (oportunidades con tendencia ↑/↓) y `gsc:keywords -- <slug>`. Panel `/admin/ads` tiene columna "Orgánico". Bucle: identificar (gsc:seo) → estudiar competidor (Google la query / Semrush) → mejorar contenido → medir a 3-4 semanas. **Ads NO sube el orgánico**; SEO se sube con contenido + enlaces. Mayor demanda: tests de leyes (39/2015, 40/2015, CE) + "examen auxiliar administrativo estado".

### 🏫 Analizador de Competidores (runbook)
- **Runbook:** `docs/runbooks/analizador-competidores.md`
- **Cuándo consultarlo:** cuando el usuario diga *"añade el competidor X"*, *"quién prepara la oposición Y"*, *"compara precios de competidores"*, *"re-sincroniza/actualiza competidores"*, *"qué oposiciones no cubrimos que ellos sí"* (gaps) o similar. Seguir el runbook ANTES de improvisar.
- **Resumen:** subsistema (BD durable `competitor_*` en RDS) que cataloga por competidor **qué oposiciones prepara, a qué precio, y qué cambia**; la **oposición es el nexo** con el radar. **1 fichero adapter por competidor** en `backend/src/competitors/adapters/`. Panel `/admin/competidores` (oposición-céntrico + badge). El runbook cubre: recon paralelo → adapter → seed → aplicar a RDS → sync → re-match → verificar; captura de precios (JSON-LD/plan-includes); y los gotchas (CDATA en `<loc>`, JSON-LD con Offer anidado, lastmod string vs timestamptz, matcher precisión>recall, JS/Firebase/Cloudflare → headless, sesiones git paralelas → commit atómico, NUNCA inventar nombres/precios). Estado: 13 competidores, 29 oposiciones cubiertas. Detalle diseño: `docs/roadmap/analizador-competidores.md`; memoria `project_analizador_competidores`.

### 🎯 Señales OEP / seguimiento de convocatorias (manual)
- **Manual:** `docs/maintenance/oeps-convocatorias-seguimiento.md`
- **Cuándo consultarlo (CUALQUIERA de estas frases → este manual):** *"revisa OEPs"*, *"revisa las señales OEPs"*, *"revisa señales de convocatorias"*, *"qué OEPs hay/pendientes"*, o el **badge 🎯 (naranja/rojo) del nav "OEPs"**. Todas apuntan aquí. (NO confundir con el **rollover 🎓** = examen pasado; ni con *"revisa monitoreo"* = cambios de leyes BOE.)
- **Resumen:** el badge 🎯 cuenta `oep_detection_signals` con `status='pending'` (cambios detectados en el seguimiento de convocatorias + procesos descubiertos por el **radar multi-capa**). Panel `/admin/oep-signals` (salud del motor en `/admin/radar-salud`). Procedimiento: ver señales pendientes → **verificar contra fuente oficial** (WebFetch a la `seguimiento_url`) → actualizar hitos/estado si hay cambio real → marcar señal `applied`/`dismissed`. GOTCHA (fix 07/07): la Capa 3 del radar (competidores) inundaba el inbox → filtrada a **huecos únicos con ≥2 competidores** (`from-competitor-db.ts`); badge bajó de 2.053 → ~31. Detalle radar: `docs/roadmap/radar-multicapa.md`; memoria `project_radar_oep_sesion_05jul`.

### 🚨 Señales de fraude / abuso (runbook)
- **Runbook:** `docs/runbooks/revisar-fraudes.md`
- **Cuándo consultarlo (CUALQUIERA → este runbook):** *"revisa las señales de fraude"*, *"revisa los fraudes"*, *"revisa el fraude"*, *"señales de fraude"*, o el **badge 🚨 de la pestaña "Fraudes"**. Seguir el runbook ANTES de improvisar.
- **Resumen:** el badge 🚨 cuenta `fraud_alerts` con `status='new'` (señales del sweep `scripts/fraud-sweep.cjs`, cron GHA diario). Detecta **multicuenta** (`multi_account_device`/`multi_account_reg_ip`/`device_daily_farming`/`premium_sharing`) y **scraping por curl/API sin navegador** (`curl_scraping`). Claude-en-el-bucle: el usuario dispara → Claude vuelca las pendientes, **verifica cada una contra los datos** (altas mismo día/device, page_views, uso por device/día), y marca `dismissed` (falso positivo) o `confirmed` (fraude real). Panel `/admin/fraudes` (pestaña "Señales"); revisar vía `POST /api/v2/admin/fraud/signals/review`. **F0 = solo detección + revisión; NO bloquea** (el enforcement —límite por device/IP, require-device anti-curl, cap de altas— es fase F1/F2, con aprobación de Manuel). GOTCHA: el límite free es **25/día POR CUENTA** → N cuentas en un device = N×25 (hueco que F1 cierra).

### 📡 Salud del RADAR — la MÁQUINA que produce las señales (runbook)
- **Runbook:** `docs/runbooks/salud-radar.md`
- **Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** *"revisa el radar"*, *"revisa señales de radar"*, *"revisa la salud del radar"*, o el panel **`/admin/radar-salud`** en ámbar/rojo.
- ⚠️ **NO confundir con *"revisa las señales OEPs"*** (badge 🎯 = **el TRABAJO**: triar señales pendientes). Esto es **la MÁQUINA**: ¿los sensores están vivos y viendo lo que deberían? **Un badge de OEPs a cero puede ser "todo tranquilo"… o "el motor está parado"** — sin este runbook no se distinguen, y las dos cosas hacen falta.
- **Resumen:** mira (1) si cada sensor sigue produciendo (`oep_detection_signals` por `sensor_type`: un `max(created_at)` viejo = sensor MUERTO), (2) si las fuentes viven (`detection_sources`: `is_active=true` NO significa que funcione — mirar `last_error`/`last_success_at`; si `last_checked` > 2 días, el cron no corre), y (3) la **cobertura** (2.542 en catálogo, 472 con fuente, **2.070 sin ninguna**). Las 2.070 solo las puede ver el **BOLETÍN** (por ley tiene todo; ~70 fuentes acotadas) — añadir páginas de entidad NO escala. Averías reales que motivaron el runbook (16/07): **101 de 173 fuentes en error 45 días** sin que nada avisara, y **los 16 boletines tirando 30 convocatorias/día** durante meses mientras el badge de OEPs parecía normal.

### 🔄 Rollover de oposiciones (runbook)
- **Runbook:** `docs/runbooks/rollover-oposiciones.md`
- **Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** *"haz rollover"*, *"revisa rollover"*, *"revisa los rollover"*, *"revisa exámenes hechos"*, *"revisa exámenes pasados/realizados"*, *"oposiciones con examen pasado/hecho"*, *"actualiza las landings viejas/caducadas"*, o cuando vea el **badge ámbar del nav "Oposiciones"** y lo indique. Todas apuntan aquí. (NO confundir con *"revisa OEPs"* = seguimiento de convocatorias, badge 🎯.) Seguir el runbook ANTES de improvisar.
- **Resumen:** una landing no muere cuando pasa su examen (las oposiciones son recurrentes) → hay que **pivotarla hacia delante** (próxima OEP/convocatoria, `exam_date=null`/futura, plazas, hitos `upcoming`, SEO forward), **verificado con fuente oficial, nunca inventar**. El **badge ámbar** en el nav "Oposiciones" cuenta las que preparamos con `exam_date` pasada; la **pestaña "Rollover"** (`/admin/oposiciones?tab=rollover`) las lista por demanda de usuarios. Triaje: examen reciente + `examen_realizado` = correcto (ciclo vivo); examen antiguo/`nombramientos` = pivotar YA. NO tocar temario/epígrafes/tests (solo datos de convocatoria). Detalle del pivote: `crear-nueva-oposicion.md` §2a.1-bis.

### ✅ Verificar epígrafes / scope de una oposición (runbook)
- **Runbook:** `docs/runbooks/verificar-epigrafes-scope.md`
- **Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** *"verifica los epígrafes"*, *"verifica el contenido"*, *"verifica el scope"* de una oposición; o cuando el **badge de verificación en `/admin/contenido`** esté encendido. Seguir el runbook ANTES de improvisar.
- **Resumen:** sistema de verificación + provenance del `topic_scope` contra el epígrafe. Estado por tema en `topic_scope_verification` (`never_verified`/`verifying`/`verified_correct`/`verified_issues`/`stale`), **auto-invalidado por trigger** al cambiar epígrafe/scope (hash) — calcado al lifecycle de preguntas. **Claude en el bucle — PIPELINE semi-autónomo (13/07):** `npm run verify:scope dump <pt>` → **Workflow tool `verify-scope-oposicion`** (2 agentes+juez anclados a BOE, args = el dump) → `verify:scope plan <pt> <propuestas.json>` (enriquece: valida delta vs scope real, mide impacto en preguntas, **clasifica** auto_safe vs judgment_gate con `scripts/lib/scope-classifier.cjs` PURO+testeado) → `verify:scope apply <pt> [--dry-run] [--include-gate]` (transacción + recache MV/purga/revalidate + record, **horneados**). El **clasificador manda a puerta de juicio** (NUNCA auto-quita) si detecta reglamento que desarrolla una ley nombrada, epígrafe temático, impacto alto (>150 preg) o delta inválido → esos requieren criterio humano antes de `--include-gate`. **Nada se borra nunca.** Subcomandos deterministas: `verify:scope <dump|plan|apply|record|status|audit|gate>`. `verified_issues` = "revisión humana", no "seguro mal". Migración `20260710_topic_scope_verification.sql`. Metodología de fondo: `docs/maintenance/verificar-epigrafe-topic-scope.md`.

### 🏗️ Crear una oposición (framework + manual)
- **Manual:** `docs/maintenance/crear-nueva-oposicion.md` (con la nota-framework arriba) + **scaffolder `scripts/create-oposicion.cjs`** (memoria `project_scaffolder_crear_oposicion`).
- **Cuándo (frases-gatillo):** cuando el usuario diga *"haz / crea / monta / construye la oposición X"*, *"añade la oposición X"* (implementar una aspiracional), o al promover una demanda a implementada. Seguir el manual ANTES de improvisar.
- **Cómo:** las **FASES 2-5 las hace el scaffolder** desde un `spec.json`, NO a mano: `node scripts/create-oposicion.cjs data/temarios/<slug>.json --insert-config --routes --registros` (corre `--dry-run` primero) → FASE 2 (BD: oposición+bloques+topics+convocatoria SSOT+hitos) + 3 (topic_scope, anti-duplicados + verifica artículos) + 4 (config `oposiciones.ts`) + 4c (OnboardingModal/perfil/mapeo CCAA) + 5 (rutas, straggler-check). **A mano solo el JUICIO** — FASE 1 (temario **literal** del boletín) + el mapeo `scope` por tema, que van EN el spec — y **CcaaFlag** (bandera). **Gates OBLIGATORIOS después (el framework NO los sustituye):** `npm run audit:oposicion <slug> && audit:served` + **`verify:scope`** (2 agentes) + refresh MV (§6.bis). Go-live (is_active=true + deploy) con OK del usuario. **NUNCA inventar temario/artículos** (regla nuclear).

### Logs Importantes
- Prefijo `🔍` para debug de renderizado
- Prefijo `💾` para operaciones de guardado
- Prefijo `🎯` para funcionalidades de test
- Prefijo `❌` para errores críticos
- Prefijo `✅ [answer-and-save]` para el guardado + validación server-side de tests normales
- Prefijo `✅ [API/exam/validate]` para la validación batch del modo examen

### Archivos de Configuración
- `.env.local` - Variables de entorno
- `next.config.js` - Configuración de Next.js
- `package.json` - Dependencias y scripts

### Documentación de Base de Datos

#### Drizzle ORM (Schema Tipado)
- **`db/schema.ts`** - Schema completo con 85 tablas tipadas, índices, foreign keys y RLS policies
- **`db/relations.ts`** - Relaciones entre tablas
- **`drizzle.config.ts`** - Configuración de Drizzle
- **IMPORTANTE:** Consultar `db/schema.ts` para conocer la estructura exacta de cualquier tabla
- Para regenerar el schema: `DATABASE_URL="..." npx drizzle-kit introspect`

#### Documentación Adicional
- **La estructura de tablas es `db/schema.ts` (Drizzle, FUENTE DE VERDAD).** No se documentan tablas a mano en markdown (se desincroniza). Para regenerar: `npx drizzle-kit introspect`.

### Consultas a Base de Datos desde Claude Code
Claude puede consultar la base de datos Supabase directamente usando Node.js con `@supabase/supabase-js`:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty')
    .eq('is_active', true)
    .limit(5);

  if (error) console.error('❌ Error:', error);
  else console.log('✅ Resultados:', data);
})();
"
```

**Ventajas:**
- ✅ 100% confiable (usa las mismas credenciales que la app)
- ✅ No requiere contraseña de Postgres (usa ANON_KEY)
- ✅ Respeta RLS policies automáticamente
- ✅ Sintaxis familiar (igual que en el código de la app)

**Notas importantes:**
- MCP NO funciona con Supabase (ver docs/MCP-POSTGRES-SUPABASE.md en otros proyectos)
- Variables de entorno se cargan automáticamente de `.env.local`
- Útil para debugging, verificación de datos, y análisis de queries complejas

### ⚠️ CRÍTICO: Verificación de Contenido Legal
- **NUNCA crear estructuras de leyes sin verificar primero con BOE oficial**
- **SIEMPRE consultar fuentes oficiales ANTES de crear contenido normativo**
- **Verificar artículos, títulos y rangos contra documentos oficiales**
- **En contenido legal, la precisión es crítica para la plataforma**

### Política de Commits
- **NUNCA hacer commits automáticos sin autorización explícita del usuario**
- Solo hacer commit cuando el usuario específicamente lo solicite
- Anotar cambios completados pero esperar instrucciones para commit
- **IMPORTANTE:** A veces los problemas no se solucionan completamente al primer intento
- Siempre verificar que el fix funciona antes de proponer commit