# Roadmap — Agnosticismo de Supabase

> **Estado**: 🟢 Fase 1 ✅ + Fase 3 prep ✅ + Fase 5 audit ✅ + Fase 5 2/3 migrados ✅ (2026-05-27 tarde).
> **Propietario**: equipo Vence.
> **Coste recurrente añadido**: 0 € (todas las fases reutilizan infra existente Postgres / Drizzle / SSM / ECS / Lightsail pooler).
> **Última actualización**: 2026-05-27 ~14:35 CEST.

Este roadmap profundiza en el **Bloque 5 — Salir de Vercel + Supabase** del [`docs/ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md). Aquel cubre la migración global; este describe el plan operativo específico para **quitarle a Vence cualquier dependencia propietaria de Supabase**, ordenado por urgencia y riesgo.

---

## Contexto y motivación

### El incidente que dispara este documento (2026-05-27)

Auditoría sistemática descubrió que `app/admin/feedback/page.tsx` tiene **10 ocurrencias** del patrón:

```ts
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGc...'  // ← JWT real hardcoded
)
```

Dos problemas en uno:

1. **Fuga de seguridad activa.** El prefijo `NEXT_PUBLIC_*` hace que Next.js inline el valor literal en el bundle JS cliente. **Cualquier persona que abra `/admin/feedback` puede leer el `service_role` key del bundle** → bypass total de RLS → acceso completo a la BD.
2. **Acoplamiento profundo a Supabase REST API.** El código habla `supabase.from(table).select()` — sintaxis propietaria. No portable a RDS, Aurora, Neon o cualquier Postgres puro.

El JWT leaked está vivo desde **25 jun 2025** (~11 meses expuesto). Probabilidad de explotación: baja por ser una app pequeña, pero impacto si ocurre: catastrófico.

### La causa raíz no es un copy-paste: es falta de barrera arquitectónica

Los `createClient(url, service_role)` aparecieron porque eran la forma más directa de hacer "queries privilegiadas desde admin", **sin que nada en el repo prohibiera el patrón**. No hay ESLint rule, no hay revisión obligatoria de PRs admin, no hay catálogo de patrones prohibidos.

Este roadmap arregla los síntomas Y monta la barrera para que el patrón **no vuelva a colarse**.

### El requisito agnóstico — recordatorio

Memoria del proyecto, prioridad #2: *"Agnóstico de proveedor. Poder cambiar de base de datos (Supabase → Neon / RDS / …) y de cloud (Vercel → AWS → Azure → …) fácilmente, sin reescribir código."*

Cada uso de `supabase.from()`, `supabase.auth.X()`, `supabase.storage.X()`, `supabase.realtime.X()` o `createClient(url, JWT)` que NO esté detrás de un wrapper agnóstico = deuda directa contra esa prioridad.

---

## Estado actual — auditoría detallada (2026-05-27)

### Dependencias de Supabase por superficie

| Superficie | Estado actual | Agnosticidad | Bloqueador |
|---|---|---|---|
| **Postgres BD** | Supabase Pro 17.4 | 🟢 90 % — Drizzle + `DATABASE_URL` ya estándar | Queda migrar usos REST (sección abajo) |
| **Pooler conexiones** | PgBouncer propio (Lightsail London) | 🟢 100 % — agnóstico, `pooler.vence.es:6543` | — |
| **`supabase.from()` REST** | **10 archivos** (auditado 27/05 tarde, no 96 como decía) | 🟡 Acoplado pero acotado | Strangler fig (Fase 3) |
| **`createClient(.., service_role)` en cliente** | 10 ocurrencias en `app/admin/feedback/page.tsx` | 🔴🔴 Crítico — fuga activa | **Fase 1 de este roadmap** |
| **`SUPABASE_SERVICE_ROLE_KEY` server-side** | ~20 endpoints API en server (`app/api/...`) | 🟡 Servible, pero atado al concepto Supabase | Fase 2 — migrar al sistema nuevo de keys |
| **Auth (login/sessions/JWT)** | Supabase Auth | 🔴 Acoplado | Fase 3 — wrapper agnóstico |
| **Storage** | S3 nativo (cutover 2026-05-25 ✅) | 🟢 100 % | — |
| **Realtime** | **3 usos** (auditado 27/05): admin/feedback, ChatInterface, useDisputeNotifications | 🟡 Acoplado pero acotado | Fase 5 (trivial-medio) |

### Dónde NO hay deuda (estado sano)

- **Backend NestJS / Fargate**: cero uso de `SUPABASE_SERVICE_ROLE_KEY`. Habla Postgres via Drizzle + `DATABASE_URL`. Migración a RDS sería 1 env var.
- **50+ endpoints user-facing** ya migrados al PgBouncer propio (Fase 5 del [`self-hosted-pooler.md`](./self-hosted-pooler.md)).
- **Storage** ya migrado a S3 (2026-05-25).
- **Crons** todos en Fargate o GHA, agnósticos.
- **Email**: Resend SDK directo, sin Supabase Functions intermedias.

### Sistema legacy vs nuevo de API keys (cambio importante de Supabase)

Supabase introdujo un sistema **nuevo** de API keys (`sb_publishable_*` / `sb_secret_*`) que permite:

- **Rotar cada key individualmente** sin tocar el JWT secret del proyecto.
- **Múltiples secret keys** con scopes distintos (no es un único `service_role` monolítico).
- **Sistema "Disable JWT-based API keys"** que invalida todo el sistema legacy a la vez.

El sistema **legacy** (`anon` + `service_role` JWT-based) tiene un problema crítico: rotar el `service_role` requiere regenerar el JWT secret del proyecto, lo cual:

- Invalida el `anon` key también (TODA la app pública rompe).
- Desloguea a todos los usuarios (sus tokens están firmados con el secret viejo).
- Rompe webhooks de Supabase firmados con el secret viejo.

**Decisión arquitectónica**: migrar al sistema nuevo (`sb_secret_*`) antes de cualquier rotación. Es el camino estándar moderno y soporta rotación granular.

---

## Principios arquitectónicos

1. **Cero `NEXT_PUBLIC_*` para credenciales.** Una env var con prefijo `NEXT_PUBLIC_` se inlina en el bundle cliente. **Cualquier credencial allí es pública por definición.** Regla ESLint a añadir (Fase 1).
2. **Cero `createClient(..., service_role)` desde código que se ejecute en cliente.** Si necesita bypass de RLS, va detrás de un endpoint API server-side.
3. **Cero `supabase.from()` directo en código de aplicación migrable.** Usar Drizzle ORM con `DATABASE_URL`. Aceptable en endpoints API muy específicos (legacy), pero marcar con TODO.
4. **`getAdminDb()` es el único portal autorizado para operaciones privilegiadas.** Server-side, con Drizzle, agnóstico a si por debajo es Supabase, RDS o Neon.
5. **Una capa abstraía cada feature de Supabase.** Auth → `lib/auth/*.ts`. Storage → `lib/storage/*.ts`. BD → `db/client.ts`. Si un endpoint necesita Supabase, lo importa del wrapper, nunca de `@supabase/supabase-js` directo.

---

## Fases

### 🚨 Fase 1 — Refactor agnóstico de `/admin/feedback` (HOY)

**Por qué primero**: fuga activa de `service_role` en bundle público. Cualquier minuto que esté así es minuto que la key puede ser exfiltrada.

**Entregables**:
1. **Crear 5 endpoints API server-side** con `getAdminDb()` (Drizzle):
   - `POST /api/v2/admin/feedback/mark-viewed` — UPDATE feedback_conversations.
   - `POST /api/v2/admin/feedback/create-conversation` — INSERT feedback_conversations.
   - `POST /api/v2/admin/feedback/find-user-by-email` — SELECT user_profiles.
   - `POST /api/v2/admin/feedback/create-admin-conversation` — INSERT user_feedback + feedback_conversations.
   - `POST /api/v2/admin/feedback/enrich-profiles` — SELECT user_profiles + cancellation_feedback + user_sessions.
2. **Refactor `app/admin/feedback/page.tsx`** — sustituir las 10 ocurrencias de `createClient(url, service_role)` por `fetch('/api/v2/admin/feedback/*')`.
3. **Borrar `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` del Dockerfile/workflow** si está como build-arg (verificar — no debería usarse client-side jamás).
4. **Tests de paridad**: para cada endpoint, verificar que la respuesta es bit-perfect contra el comportamiento actual sobre 3 conversaciones reales.

**Criterio de éxito**: bundle `/admin/feedback` deja de contener el JWT del service_role. Verificable con:
```bash
curl -sS /_next/static/chunks/*.js | grep -c 'eyJhbGc.*service_role'
# debe devolver 0
```

**Rollback**: revertir el commit. Los endpoints quedan creados pero sin consumidores.

**Tiempo estimado**: 1-2 h.

### Fase 2 — Migración al sistema nuevo de API keys de Supabase (esta semana)

**Por qué**: el sistema legacy no permite rotación segura. Si la key sigue leaked tras la Fase 1 (por bundles viejos cacheados, GitHub commits, etc.), rotar JWT secret = catástrofe.

**Entregables**:
1. **Crear `sb_secret_*` nueva** en pestaña "Publishable and secret API keys" de Supabase Dashboard con permisos de bypass RLS (equivalente a service_role).
2. **Refactor los ~20 endpoints server-side** que usan `process.env.SUPABASE_SERVICE_ROLE_KEY` → cambiar a `process.env.SUPABASE_SECRET_API_KEY` (nuevo nombre, mismo concepto, key nueva).
3. **Actualizar SSM** + redeploy.
4. **Verificar** que `/admin/*` endpoints siguen funcionando con la nueva key.
5. **Deshabilitar JWT legacy** en Supabase (botón "Disable JWT-based API keys") → la key vieja queda invalidada **sin afectar `anon` ni sesiones de usuarios** (porque el sistema nuevo es independiente).
6. **Programar rotación trimestral** del `sb_secret_*` como parte de la disciplina de seguridad.

**Criterio de éxito**: cero uses del `SUPABASE_SERVICE_ROLE_KEY` legacy. Sistema nuevo soportando rotación sin downtime.

**Rollback**: re-habilitar JWT legacy en Supabase (botón existe). La transición es reversible.

**Tiempo estimado**: 4-6 h en ventana planificada.

### Fase 3 — Refactor de `supabase.from()` → Drizzle (10 archivos)

**Por qué**: `supabase.from('tabla').select(...)` usa PostgREST de Supabase, API propietaria. **Cualquier migración a RDS / Neon / Aurora rompe estos sitios**. Mucho más acotado de lo previsto.

**Estrategia**: NO refactor masivo en un solo PR. Patrón **strangler fig** — cada PR que toque uno de estos archivos por otra razón **aprovecha** para migrar a Drizzle.

**Hecho (27/05/2026 tarde):**
1. ✅ **2 antipattern ESLint rules** añadidas a `eslint.config.mjs`:
   - `NEXT_PUBLIC_*` con SECRET/KEY/TOKEN/PASSWORD (excepto `SUPABASE_ANON_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_*`).
   - `createClient(.., SERVICE_ROLE)` en código cliente (excluye `app/api/`, `*.server.ts`, `middleware.ts`).
2. ✅ **Patrón documentado** en `docs/patterns/migrar-supabase-from-a-drizzle.md`.
3. ✅ **Inventario completo** abajo (lista checkeable).

**Pendiente:**
- ⏳ Strangler fig sobre los 10 archivos a continuación. Cada PR que toque uno → migrar.

#### Inventario de archivos con `supabase.from()` (10 archivos, **~70 usos reales** — actualizado 27/05/2026 15:00 CEST)

> 🔴 **RE-AUDITORÍA 2026-06-01**: la cifra de "10 archivos" era SOLO el subconjunto del módulo admin/feedback auditado el 27/05. El recuento real en **toda la app** es **92 ficheros** con `.from('tabla')` REST (excluyendo los `.from(tablaDrizzle)` legítimos). Top por volumen: `stripe/webhook` (31), `chat/domains/search/queries` (22), `admin/fraudes` (14), `topic-review/verify` (14), `ai/create-test` (12), múltiples SSR y crons. **Implicación**: agnosticar la BD para migrar a RDS es un programa de **1-2 sprints concentrados** (mayoría server-side, riesgo bajo) o meses en strangler-fig — NO una tarea de sesión. Auth (Fase 4) es bloqueador aparte para dejar Supabase del todo.

> ✅ **STRANGLER 2026-06-01 — 3 SSR legales migrados** (`ley39SSR`, `constitucionSSR`, `procedimientoAdministrativoSSR`): `createClient(SERVICE_ROLE)`+`supabase.from()` → `getReadDb()`+Drizzle (joins propietarios → innerJoin/leftJoin). Paridad verificada contra BD real (secciones, slugs, artículos, lawsUsed, questionsCount). **Bug latente arreglado**: el conteo de preguntas vía `.length` sobre el SELECT estaba capado a 1000 por PostgREST → las landings de Ley 39 y CE mostraban "1000 preguntas" cuando hay 2779 y 3533; ahora `count()` agregado da el real. Código muerto eliminado en procedimiento (`loadProcedimientoSectionQuestions` + `getSectionKeywords` + 3 interfaces). Commits `71c18796`, `883b283b`.

> ✅ **STRANGLER 2026-06-01 (cont.) — `lib/api/avatar-settings/queries.ts`** (6 `.from()` + 1 `.rpc()`): → `getAdminDb()` + Drizzle. Incluye writes (upsert `onConflictDoUpdate` sobre unique `user_id`, update rotación) y la RPC `get_active_users_with_automatic_avatar` → `db.execute(sql\`...\`)`. Paridad verificada: avatar_profiles (orden), getAvatarSettings (campos), y upsert probado en transacción+ROLLBACK (0 mutación). Nota: `video-courses/queries.ts` NO es target — su único `.from('videos-premium')` es **storage**, no tabla; su acceso a BD ya es Drizzle.

> ✅ **STRANGLER 2026-06-01 (cont.) — `lib/teoriaFetchers.ts` 100% sin supabase** (4 funciones: fetchLawsList, fetchRelatedArticles, searchArticles, fetchLawSections → Drizzle; las otras 2 ya lo eran). Joins `laws!inner(articles)` → innerJoin; `.or(ilike)` → or()+ilike(). Cliente supabase eliminado del módulo. Paridad verificada (related/search/sections idénticos). **FIX latente**: el embed anidado de PostgREST capaba los artículos en fetchLawsList (45434 vs 46345 reales) → articleCount infra-contado en el índice /teoria; el join da el total correcto. Commit `46ba7303`.

> 📊 **Resumen sesión 2026-06-01**: 5 ficheros migrados (3 SSR legales + avatar-settings + teoriaFetchers), con 2 bugs latentes de cap de PostgREST arreglados de paso (conteos de preguntas y de artículos infra-reportados en landings/índices). Patrón + verificación de paridad (reads + txn-rollback para writes) rodados. Quedan ~87 ficheros (varios son falsos positivos de storage).

> ⚠️ El recuento inicial en este roadmap subestimaba (contaba solo líneas que matcheaban, no usos por línea). Recuento real corregido: 70 usos en 10 archivos (módulo admin). Tras 2 migrados quedan 8 archivos con ~67 usos en ese módulo.

| # | Archivo | Usos | Notas |
|---|---|---|---|
| - [ ] | `app/api/stripe/webhook/route.ts` | **31** | 🐘 El más grande. Refactor sustancial. Tocar con cuidado: el webhook ya tuvo incidente 27/05 por otra causa. |
| - [~] | `lib/emails/emailService.server.ts` | 16 (13 migrados, 3 deuda) | 🟡 **Mayoría migrado 27/05** (commit pendiente): testServerConnection + checkEmailSystemHealth + sendWelcomeEmailImmediate + getEmailCampaignStats + cleanupExpiredTokens + detectUsersForWeeklyReport + sendWeeklyReportEmail → Drizzle. **3 deuda**: `validateUnsubscribeToken` (depende PGRST116) + `processUnsubscribeByToken` (mocks del test mockean @supabase/supabase-js, no @/db/client → migrarlos rompe 4 tests). Plan: migrar los 3 a la vez con actualización paralela de `__tests__/emails/unsubscribeFlow.test.ts` (mock framework). |
| - [~] | `app/api/cron/subscription-reconciliation/route.ts` | 9 | 🗑️ **ELIMINAR**, no migrar. Ya replicado en backend Fargate (commit `3b25b152`, cron activo per `observable_events`). Pendiente borrar este endpoint Next.js tras soak Fargate. |
| - [ ] | `lib/services/adaptiveDifficulty.ts` | 5 (+ 5 `.rpc()`) | ⚠️ Complejo: servicio con 10 métodos + constructor que recibe cliente, mezcla `.from()` + `.rpc()`, bug pre-existente línea 93 (subquery mal usada en `.eq`). Migración requiere refactor de firma. |
| - [x] | ~~`app/api/admin/infra-stats/route.ts`~~ | ~~3~~ | ✅ **Migrado 27/05** (commit pendiente): 3 queries (`user_sessions count`, `daily_question_usage`, `validation_error_logs` con OR+ILIKE) → Drizzle. Eliminado el `createClient(SERVICE_ROLE)` paralelo a Drizzle que mantenía el archivo. |
| - [ ] | `components/TestLayout.tsx` | 2 | **Cliente sensible** (tests E2E lo cubren — verificar al migrar). |
| - [ ] | `components/ExamLayout.tsx` | 2 | **Cliente sensible**. Mismo cuidado que TestLayout. |
| - [ ] | `contexts/AuthContext.tsx` | 1 | ⚠️ **Intento de migración 27/05 revertido**: el `supabase.from('user_profiles').single()` devuelve `error.code='PGRST116'` para "no encontrado" vs otro código para "error HTTP transitorio". `loadUserProfile()` no discrimina ambos (devuelve `null` en ambos casos), lo que provocaría duplicación de perfil si el endpoint falla transitoriamente. Para migrar: o cambiar `loadUserProfile` a discriminated union, o crear endpoint `GET /api/profile/exists?userId=...` con 200/404 explícito. |
| - [x] | ~~`lib/api/rollout/problematic-articles-logs.ts`~~ | ~~1~~ | ✅ **Migrado 27/05 tarde**: `createClient(SERVICE_ROLE).insert()` fire-and-forget → `getAdminDb()` + raw SQL `db.execute(sql\`INSERT ...\`)`. |
| - [x] | ~~`app/api/admin/conversions/views/route.ts`~~ | ~~2~~ | ✅ **Migrado 27/05 tarde**: `admin.supabase.from(view)` → `db.select().from(pgView)`. Vistas tipadas en schema. `Promise.allSettled` mantiene patrón "no rompe si una falla". |

**Criterio de éxito**: 0 archivos en el inventario tras strangler.

**Tiempo estimado revisado**: trabajo continuo. Realista con cifras reales: 6-12 meses si va por strangler fig, **1-2 sprints concentrados** si se ataca de golpe (la mayoría son server-side, riesgo bajo).

### Fase 4 — Wrapper agnóstico de Auth (mes 1-2)

**Por qué**: Supabase Auth es funcional pero acoplado. Si decidimos migrar a Cognito / Auth0 / Clerk, hoy es trabajo de meses.

**Entregables**:
1. **Wrapper `lib/auth/`** que exponga: `signIn`, `signUp`, `signOut`, `getUser`, `getSession`, `verifyJWT`.
2. **Implementación Supabase-backed** (la única hoy). Pero el resto del código solo conoce el wrapper.
3. **Toda llamada `supabase.auth.*` directa en app/ y lib/ migra al wrapper** (~30-50 puntos).
4. **POC paralela con Auth.js (NextAuth)** apuntando al mismo Postgres — verificación de que el wrapper funciona con backend distinto.

**Criterio de éxito**: 0 imports directos de `supabase.auth` fuera de `lib/auth/`.

**Tiempo estimado**: 3-4 semanas.

### Fase 5 — Migrar Supabase Realtime (2/3 migrados, 1 pendiente)

**Por qué**: WebSocket propietario que no migra trivialmente a otro proveedor Postgres. Hay que migrar a SSE o polling.

**Estado (27/05/2026 ~14:30 CEST)**:

| # | Archivo | Estado | Acción aplicada |
|---|---|---|---|
| 1 | `app/admin/feedback/page.tsx:327-354` | ⏳ **PENDIENTE** | Migrar `supabase.channel('feedback_changes')` a polling 30s del endpoint `/api/v2/admin/feedback/list` (creado en Fase 1 por la sesión que owns el archivo). Patrón idéntico al aplicado en `useDisputeNotifications` (commit pendiente). |
| 2 | `components/ChatInterface.js:200-249` | ✅ **MIGRADO** | Polling cada 5s con `loadMessages(silent=true)` que evita spinner + scroll bouncing. Visibility pause (zero coste cuando tab inactivo). |
| 3 | `hooks/useDisputeNotifications.ts:101-145` | ✅ **MIGRADO** | Polling cada 60s. Visibility pause. Refresh inmediato al volver al tab. |

**Patrón aplicado** (replicable para el archivo pendiente):

```ts
const POLL_INTERVAL_MS = 60_000 // ajustar según latencia requerida

let pollTimer: ReturnType<typeof setInterval> | null = null
const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadXXX(true /* silent */)
  }, POLL_INTERVAL_MS)
}
const stopPolling = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') { loadXXX(true); startPolling() }
  else stopPolling()
}

startPolling()
document.addEventListener('visibilitychange', handleVisibilityChange)
return () => {
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}
```

**Criterio de éxito**: 0 imports de `RealtimeChannel` / `supabase.channel` en `app/` `lib/` `components/` `hooks/`. Actualmente queda 1 uso (`app/admin/feedback/page.tsx`).

**Tiempo restante**: 30-60min para migrar el último archivo (a hacer por la sesión que refactorizó el componente en Fase 1).

### Fase 6 — Tests de paridad y POC RDS (mes 3+)

**Por qué**: para verificar agnosticismo real, hay que ejecutar la app contra un Postgres NO-Supabase.

**Entregables**:
1. **Suite de integration tests** que apunte a `DATABASE_URL=postgres://rds-host/...` en CI nightly.
2. **POC RDS Postgres 17** con un snapshot replicado de Supabase.
3. **Plan de cutover** documentado en `docs/runbooks/db-migration-supabase-to-rds.md`: replicación logical + dual-write + flip + decom.
4. **NO migrar todavía** — solo capacidad demostrada.

**Tiempo estimado**: 4-8 semanas.

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Refactor Fase 1 rompe `/admin/feedback` | Media | Bajo (admin único, Manuel) | Tests de paridad por endpoint + soak 24 h antes de merge |
| Migrar a `sb_secret_*` rompe los 20 endpoints server | Media | Alto | Refactor uno-por-uno con flag, no batch |
| ESLint rule de Fase 3 explota PRs en curso | Alta | Bajo | Allowlist permisiva al inicio + tightening gradual |
| Refactor Auth desincroniza sesiones existentes | Baja | Alto | Wrapper backward-compatible primero, swap motor después |
| POC RDS revela features Supabase no triviales (RLS, triggers Postgres) | Media | Medio | RDS también soporta esos; verificar en POC sin pánico |

---

## Antipatterns prohibidos (ESLint rules)

**Implementadas 27/05/2026** en `eslint.config.mjs`. Spec original:

```js
'no-restricted-syntax': ['error', {
  // Antipattern 1: credencial en NEXT_PUBLIC_*
  selector: "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/NEXT_PUBLIC_.*(SECRET|KEY|TOKEN|PASSWORD)/i]:not([property.name='NEXT_PUBLIC_SUPABASE_ANON_KEY'])",
  message: 'NEXT_PUBLIC_* con SECRET/KEY/TOKEN/PASSWORD se inlina en bundle cliente. Usa env var server-side y un endpoint API.',
}, {
  // Antipattern 2: createClient con service_role en componente cliente
  selector: "CallExpression[callee.name='createClient'] Identifier[name=/SERVICE_ROLE/]",
  message: 'createClient con service_role expone privilegios. Usa getAdminDb() server-side via endpoint API.',
}],
```

---

## Métricas de éxito (objetivos medibles)

| Métrica | Estado pre-roadmap | Estado 27/05 tarde | Objetivo (Fase 6 completa) |
|---|---|---|---|
| `NEXT_PUBLIC_*` con credenciales en código | 1 (`SUPABASE_SERVICE_ROLE_KEY`) | 0 (limpiado en Fase 1 + ESLint rule) | 0 ✅ |
| Ocurrencias `createClient(.., service_role)` cliente | 10 | 0 (Fase 1 commit `1e65f76f`) | 0 ✅ |
| Archivos con `supabase.from()` | ~96 (estimación pre-audit) | **8** (4 archivos completamente migrados tarde 27/05 + 1 parcial + 1 a eliminar; 5 pendientes) | ≤ 5 (allowlist documentada) |
| Imports directos `supabase.auth.*` fuera de `lib/auth/` | ~30-50 | pendiente auditar (Fase 4) | 0 |
| Usos de Supabase Realtime | desconocido | **1** (auditado 27/05: eran 3, 2 migrados a polling esta tarde) | 0 |
| Tiempo a migrar BD a RDS (estimación) | meses | semanas (cuando se complete F3) | 1 PR + cutover planificado |

---

## Anti-objetivos

- **NO eliminar Supabase completamente en sprint corto.** Es trabajo de meses. Cada fase aporta valor por sí sola.
- **NO migrar Auth si no hay razón clara** (incidente, coste, escala). Es riesgoso y caro. La Fase 4 monta el wrapper sin obligar a migrar.
- **NO sobre-abstraer por si acaso.** El wrapper Auth tiene sentido porque hay 2+ implementaciones realistas. Inventar adaptadores para features que solo Supabase tiene (ej. trigger-based RLS específico) es over-engineering.
- **NO romper users durante una rotación.** Toda rotación de Auth/sesiones va en ventana planeada con banner de aviso.

---

## Enlace con el resto del manual

- Bloque 5 del [`ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md) — visión global de "salir de Vercel + Supabase". Este roadmap es el detalle operativo del componente Supabase.
- [`self-hosted-pooler.md`](./self-hosted-pooler.md) — Fase 5 completada del pool propio. Pre-requisito para agnosticismo de BD.
- [`materialized-stats-aggregates.md`](./materialized-stats-aggregates.md) — patrón counter-table + triggers Postgres puro, agnóstico de Supabase.
- [`docs/runbooks/observability.md`](../runbooks/observability.md) — patrón Sink interface (AWS-native by default, agnóstico by contract) aplicado a observabilidad. Mismo patrón mental que aquí.
