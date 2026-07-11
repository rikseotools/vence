# Runbook — Programa de Embajadores / Recompensas (operación por API)

> **Para Claude Code.** El panel `/admin/embajadores` es un **escaparate de estadísticas (solo lectura)**.
> Las **operaciones** (crear recompensa/bonus, consultar saldos, pagar gift card) se ejecutan por **API**
> siguiendo este runbook. Este documento es la fuente única de "cómo se opera el programa".

## Qué es

Los usuarios ganan **gift cards de Amazon.es** (compradas en Bitrefill con cripto de wallets viejas de Manuel) de **4 formas**:

| Fuente | Importe | Cuándo | Quién lo dispara |
|---|---|---|---|
| **Referido** (`referido`) | **10 €** | Un premium refiere a alguien que **paga en ≤10 días** | Automático (webhook Stripe al calificar) |
| **Registro activo** (`registro_activo`) | **2 €** | Un referido llega a **≥5 tests** (opositor real). Inversión temporal de captación/marca | Automático (cron), **solo con `ACTIVE_SIGNUP_REWARD=1`** |
| **Bug / UX** (`bug`) | **3 €** | El usuario reporta un bug real/útil **y lo resolvemos** | Manual (Claude Code, tras validar) |
| **Opinión / UGC** (`ugc`) | **5 €** | Opinión REAL en grupos FB/Telegram, IG, foros de opositores | Manual (Claude Code, tras validar) |

**Registro activo (`registro_activo`) — dinero real, OFF por defecto.** Bonus de 2€ al embajador cuando su referido llega a ≥5 tests (señal de opositor real, no bot). **Compensa** (ARPU neto ≈36€, conversión de activos ≥5 tests ≈16% → +1,33€ netos/registro tras el referido y el cupón). Es **inversión temporal** (1-2 años) de captación/marca, sunset-eable. **Capas:** flag `ACTIVE_SIGNUP_REWARD=1` (runtime, OFF por defecto → nada se concede), anti-fraude (IP del referido ≠ del embajador + ≥5 tests + no fraud-flagged), **tope por embajador/mes** (`ACTIVE_SIGNUP_MONTHLY_CAP`, def 30) + **presupuesto global/mes** (`ACTIVE_SIGNUP_MONTHLY_BUDGET_EUR`, def 500€, tipo línea de Ads). Lógica: `lib/referrals/activeSignup.ts` (idempotente, 1 bonus/referido vía `referrals.active_reward_at`), disparada por el cron `/api/cron/referrals-promote`. **Para activarlo:** setear `ACTIVE_SIGNUP_REWARD=1` (+ opcional ajustar caps/budget) en el task def (SSM) y redeploy; para sunsetear, quitar el flag. Migración `20260711_active_signup_reward.sql`.

**Modelo ACUMULADO:** las recompensas se **acumulan por usuario** y se pagan en gift cards de **denominación fija** de Amazon.es (5/10/20/50/100…€). Amazon.es no baja de 5 € ni admite importe libre → por eso los 3 € se acumulan hasta llegar a una denominación pagable. Al pagar una tarjeta de N €, el resto del saldo **se queda acumulado** para la siguiente.

- **Hold = solo referido** (VENTA). El hold (5 días = ventana de reembolso + clawback si hay chargeback) tiene sentido únicamente cuando hay una compra que se puede reembolsar. **bug/ugc NO tienen hold** (decisión Manuel 11/07): no hay venta ni reembolso posible → el saldo es elegible al crearse. El post de UGC se verifica al **pagar el vale**, no con un hold.
- Referido: el nuevo usuario recibe **5 € de descuento** (cupón Stripe `referral_5eur` en la cuenta **Nila**).
- UGC: tope **3/mes**, requiere link + captura.

## Notificación al embajador

Cualquier **ingreso nuevo** (referido que compra, o bonus bug/ugc que creamos) **enciende el badge** en el icono 🎁 del header (parpadea hasta que lo pincha) — es server-side vía la vista `reward_earnings`, común a las 3 fuentes.

El **email** proactivo, en cambio, **solo se manda en el caso `referido`** (webhook Stripe): ahí no hay hilo de soporte por el que avisar. El email va **SIN spoiler** — dice "tienes una recompensa nueva, entra a verla", no revela importe ni fuente (decisión Manuel 10/07; la revelación celebratoria con confeti vive en `/embajadores`).

En **bug/ugc NO se envía email** (decisión Manuel 10/07): esas recompensas nacen de un feedback que **ya le respondemos por su hilo**, así que el email sería redundante. El usuario se entera por el badge 🎁 + tu respuesta en el chat de soporte.

## Operaciones (API)

Todos los endpoints requieren **admin** (token de admin; ver `feedback_admin_token_method` / `lib/api/shared/auth`). Ejemplos con `adminFetch`/curl autenticado.

### 1. Ver estadísticas (escaparate)
```
GET /api/admin/referrals/stats
→ { stats: { totalEarned, totalPaid, outstanding, earners, bySource[], referralStatus{}, funnel{}, topEmbajadores[] } }
```

### 2. Crear recompensa / bonus (bug o ugc) — TRAS VALIDAR
Usar cuando **resolvemos un bug reportado por el usuario** o **validamos una opinión (UGC)** real.
```
POST /api/admin/rewards
body: { email: "<email del usuario>", type: "bug" | "ugc", url?: "<link de la opinión>", feedbackId?: "<uuid del feedback>" }
→ crea reward_submission (bug 3 € / ugc 5 €), estado approved, entra en hold.
```
- `bug` = 3 €, `ugc` = 5 €. El importe lo pone el sistema, no se envía.
- **Pasa SIEMPRE `feedbackId` en las de `bug`** (traza del motivo + anti-duplicado, ver abajo).
- UGC exige `url` (link a la opinión) y respeta el tope 3/mes (devuelve `reward_cap_hit`).
- Al crearse, el usuario recibe **solo el badge 🎁** (bug/ugc NO envían email — ver "Notificación al embajador"). Avísale tú por su hilo de feedback.

**Anti-duplicado por MOTIVO (guardarraíl por construcción):** `createRewardSubmission` rechaza (`{ok:false, reason:'duplicate'}` → HTTP 409 + evento `reward_duplicate`) si ya existe una recompensa **no-rejected** con el mismo motivo: `feedback_id` en `bug`, `url` en `ugc` (el referido es idempotente aparte, por la fila `referrals`). Así el motivo no solo queda **registrado**, sino que **físicamente no se puede pagar dos veces lo mismo**. Tests: `__tests__/referrals/rewards-endpoints.test.ts` (unit) + `__tests__/integration/referrals-simulation.test.ts` (RDS).

### 2.bis Procedimiento para recompensar un bug resuelto — UNO A UNO
Cuando resolvemos un bug reportado y merece recompensa, procede **usuario a usuario** (nunca en lote):
1. **Verifica** que el bug es real y resuelto, y que el usuario **no tiene ya** recompensa por ese feedback (el guardarraíl lo impide, pero míralo).
2. **Emite la recompensa** (`POST /api/admin/rewards`, `type:'bug'` + `feedbackId`). El badge 🎁 empieza a **parpadear** en su header hasta que lo pinche (server-side, automático). **No se envía email.**
3. **Redacta el borrador** de la respuesta a su feedback y **espera aprobación** (nunca envíes sin OK). En el mensaje llámalo **"Programa de Recompensas"** (no "de Embajadores") y anúnciale el bonus.
4. **Envía** por `POST /api/v2/feedback/respond` (email + campana) y cierra ese feedback **antes** de pasar al siguiente.

### 3. Consultar saldos por pagar
```
GET /api/admin/rewards/accumulated
→ { balances: [{ userId, name, email, balance, suggested }] }   // solo quienes llegan al mínimo (5 €)
```
`suggested` = mayor denominación ≤ saldo.

### 4. Emitir un vale (gift card) — automático vía Bitrefill
**Una sola llamada admin** compra la gift card de Amazon.es en Bitrefill y registra el payout contra el saldo:
```
POST /api/admin/rewards/issue-giftcard
body: { userId, amount }   // amount = denominación válida (5/10/20…) ≤ saldo pagable
→ { ok, dryRun, code, payoutId, amount }
```
- **El usuario ve su vale** (código Amazon, importe, fecha) en su panel **/embajadores → "Mis vales"** (endpoint `GET /api/referrals/vouchers`, identidad del token).
- **🔒 GUARDARRAÍL DE DINERO:** la compra REAL solo ocurre con **`BITREFILL_LIVE=1`** (env de runtime). Por defecto es **dry-run** (NO gasta, devuelve código `DRYRUN-…`, `purchased_via='bitrefill_dryrun'` y NO se muestra al usuario). Para ir a real: setear `BITREFILL_LIVE=1` en SSM + hacer una **primera compra controlada** y verificar el código antes de operar en serie. Token en SSM `/vence-frontend/BITREFILL_API_TOKEN`.
- Orden seguro anti-descuadre: valida denominación + saldo ANTES de comprar; si la compra falla NO registra el payout. Idempotencia: 1 payout por llamada.
- **Alternativa manual** (comprar a mano + registrar): `POST /api/admin/rewards/accumulated` con `{ userId, amount, giftcardRef, purchasedVia:'bitrefill' }`.

## Observabilidad

Todo pasa por `observable_events` (source `fargate`) vía `emitReferralEvent`. Eventos clave:
`referral_page_view`, `referral_link_copy`, `referral_link_click`, `referral_attributed`, `referral_qualified`,
`referral_promoted_payable`, `referral_paid`, `referral_refund_clawback`, `referral_expired`, `referral_error`,
`reward_created`, `reward_cap_hit`, `reward_paid`.

Consulta de embudo/errores: `SELECT event_type, count(*) FROM observable_events WHERE event_type LIKE 'referral_%' OR event_type LIKE 'reward_%' GROUP BY 1;`

## Referencias

- Código: `lib/referrals/{logic,queries,observability,coupon}.ts`, `app/embajadores/`, `app/admin/embajadores/`, `app/api/admin/{rewards,referrals}/`.
- Vista escalable de ingresos: `reward_earnings` (migración `supabase/migrations/20260710_reward_earnings_view.sql`) — añadir una fuente futura = 1 rama `UNION ALL`.
- Canary: `scripts/canary-referrals.cjs`.
- Memoria: `project_programa_recompensas`.
- **Manual de feedback:** `docs/procedures/gestionar-feedback-bug.md` (cuando un bug reportado se resuelve, valorar recompensa `bug` con §2 de arriba).
