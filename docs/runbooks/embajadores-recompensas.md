# Runbook — Programa de Embajadores / Recompensas (operación por API)

> **Para Claude Code.** El panel `/admin/embajadores` es un **escaparate de estadísticas (solo lectura)**.
> Las **operaciones** (crear recompensa/bonus, consultar saldos, pagar gift card) se ejecutan por **API**
> siguiendo este runbook. Este documento es la fuente única de "cómo se opera el programa".

## Qué es

Los usuarios ganan **gift cards de Amazon.es** (compradas en Bitrefill con cripto de wallets viejas de Manuel) de **3 formas**:

| Fuente | Importe | Cuándo | Quién lo dispara |
|---|---|---|---|
| **Referido** (`referido`) | **10 €** | Un premium refiere a alguien que **paga en ≤10 días** | Automático (webhook Stripe al calificar) |
| **Bug / UX** (`bug`) | **3 €** | El usuario reporta un bug real/útil **y lo resolvemos** | Manual (Claude Code, tras validar) |
| **Opinión / UGC** (`ugc`) | **5 €** | Opinión REAL en grupos FB/Telegram, IG, foros de opositores | Manual (Claude Code, tras validar) |

**Modelo ACUMULADO:** las recompensas se **acumulan por usuario** y se pagan en gift cards de **denominación fija** de Amazon.es (5/10/20/50/100…€). Amazon.es no baja de 5 € ni admite importe libre → por eso los 3 € se acumulan hasta llegar a una denominación pagable. Al pagar una tarjeta de N €, el resto del saldo **se queda acumulado** para la siguiente.

- Referido: nuevo usuario recibe **5 € de descuento** (cupón Stripe `referral_5eur` en la cuenta **Nila**). Hold 5 días (= ventana de reembolso) + clawback si hay chargeback.
- UGC: tope **3/mes**, requiere link + captura, hold hasta comprobar que el post sigue vivo.

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
body: { email: "<email del usuario>", type: "bug" | "ugc", url?: "<link de la opinión>" }
→ crea reward_submission (bug 3 € / ugc 5 €), estado approved, entra en hold.
```
- `bug` = 3 €, `ugc` = 5 €. El importe lo pone el sistema, no se envía.
- UGC exige `url` (link a la opinión) y respeta el tope 3/mes (devuelve `reward_cap_hit`).
- Al crearse, el usuario recibe **solo el badge 🎁** (bug/ugc NO envían email — ver "Notificación al embajador"). Avísale tú por su hilo de feedback.

### 3. Consultar saldos por pagar
```
GET /api/admin/rewards/accumulated
→ { balances: [{ userId, name, email, balance, suggested }] }   // solo quienes llegan al mínimo (5 €)
```
`suggested` = mayor denominación ≤ saldo.

### 4. Pagar una gift card (contra el saldo)
1. Comprar la gift card de Amazon.es en **Bitrefill** por el importe `amount` (una denominación válida ≤ saldo). Token en SSM `/vence-frontend/BITREFILL_API_TOKEN`.
2. Registrar el pago (baja el saldo ese importe; el resto se acumula):
```
POST /api/admin/rewards/accumulated
body: { userId, amount, giftcardRef?: "<ref/redemption>", purchasedVia?: "bitrefill" }
```

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
