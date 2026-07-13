# Runbook — Programa de Embajadores / Recompensas (operación por API)

> **Para Claude Code.** El panel `/admin/embajadores` es un **escaparate de estadísticas (solo lectura)**.
> Las **operaciones** (crear recompensa/bonus, consultar saldos, pagar gift card) se ejecutan por **API**
> siguiendo este runbook. Este documento es la fuente única de "cómo se opera el programa".
>
> **Vista admin "ver como el usuario":** en `/admin/embajadores`, pinchar un nombre de "Top embajadores"/"Saldos" abre **`/admin/embajadores/[userId]`** en pestaña nueva = el panel del embajador **tal cual lo ve él** (saldo, vales, enlace, embudo, referidos), read-only (endpoint `/api/admin/embajadores/[userId]/panel`, requireAdmin).
> **Naming user-facing:** en los MENSAJES al usuario, el programa se llama **"Programa de Recompensas"** (no "de Embajadores"). Los referidos se muestran con nombre abreviado ("Nombre A. B.") y estado premium ("Registrado · No premium" / "Premium").

## Qué es

Los usuarios ganan **gift cards de Amazon.es** (compradas en Bitrefill con cripto de wallets viejas de Manuel) de **4 formas**. **Solo usuarios PREMIUM son candidatos** — el programa es exclusivo de embajadores (premium); un usuario **free NO recibe recompensa** aunque su bug/opinión sea válido. La creación manual (`/api/admin/rewards`, bug/ugc) **no** valida el plan → lo aplica quien la crea; el referido/registro-activo ya parten de un premium.

| Fuente | Importe | Cuándo | Quién lo dispara |
|---|---|---|---|
| **Referido** (`referido`) | **10 €** | Un premium refiere a alguien que **paga en ≤10 días** | Automático (webhook Stripe al calificar) |
| **Registro activo** (`registro_activo`) | **2 €** | Un referido llega a **≥5 tests** (opositor real). Inversión temporal de captación/marca | Automático (cron), **solo con `ACTIVE_SIGNUP_REWARD=1`** |
| **Bug / UX** (`bug`) | **3 €** | El usuario reporta un bug real/útil **y lo resolvemos** | Manual (Claude Code, tras validar) |
| **Opinión / UGC** (`ugc`) | **5 €** | Opinión REAL **nombrando Vence, SIN su enlace de referido**, en grupos FB/Telegram, IG, foros. (Con enlace → es Referido, no UGC — ver §2) | Manual (Claude Code, tras validar) |

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

> **⚠️ UGC (opinión, 5 €) ≠ compartir el enlace de referido (referido, 10 €). NO pagar UGC por un link-drop.** (Aprendizaje 11/07, caso Mari.) **ABRE SIEMPRE la captura** antes de crear la recompensa UGC y mira qué publicó de verdad:
> - **UGC legítimo** = una **reseña/opinión genuina nombrando Vence**, SIN su enlace de referido (ej.: Mari ayudando a alguien en un hilo de Facebook, hablando de su experiencia). → crea la `ugc` 5 €.
> - **NO es UGC** = soltar su **enlace de referido** (`vence.es/r/<code>`) con un pitch en un grupo. Eso es actividad del **Programa de Referidos** y **ya está incentivada** (10 €/venta + 2 €/registro activo). Pagar además 5 € de "opinión" sería **doble pago por el mismo acto** e **incentivaría a spamear el link** en cada grupo para farmear los 5 €. → **NO crees la recompensa**; respóndele explicando la diferencia (que su enlace ya le da dinero por sí solo) y cierra `resolved`.
> - Regla de una línea: **con enlace de referido → referido (10 €); nombrando Vence sin enlace → opinión (5 €). Son cosas distintas y nunca se pagan las dos por lo mismo.** La página (`app/embajadores/page.tsx`, tarjetas «Recomienda Vence» y «Comparte tu opinión») ya se lo explica al usuario.

**Anti-duplicado por MOTIVO (guardarraíl por construcción):** `createRewardSubmission` rechaza (`{ok:false, reason:'duplicate'}` → HTTP 409 + evento `reward_duplicate`) si ya existe una recompensa **no-rejected** con el mismo motivo: `feedback_id` en `bug`, `url` en `ugc` (el referido es idempotente aparte, por la fila `referrals`). Así el motivo no solo queda **registrado**, sino que **físicamente no se puede pagar dos veces lo mismo**. Tests: `__tests__/referrals/rewards-endpoints.test.ts` (unit) + `__tests__/integration/referrals-simulation.test.ts` (RDS).

### 2.bis Procedimiento para recompensar un bug resuelto — UNO A UNO
Cuando resolvemos un bug reportado y merece recompensa, procede **usuario a usuario** (nunca en lote):
1. **Verifica** que el bug es real y resuelto, y que el usuario **no tiene ya** recompensa por ese feedback (el guardarraíl lo impide, pero míralo).
2. **Emite la recompensa** (`POST /api/admin/rewards`, `type:'bug'` + `feedbackId`). El badge 🎁 empieza a **parpadear** en su header hasta que lo pinche (server-side, automático). **No se envía email.**
3. **Redacta el borrador** de la respuesta a su feedback y **espera aprobación** (nunca envíes sin OK). En el mensaje llámalo **"Programa de Recompensas"** (no "de Embajadores") y anúnciale el bonus. **Personalízalo con SUS datos, no plantilla genérica** (aprendizaje 11/07, Mari — Manuel rechazó un "cuando quieras canjear, dínoslo" boilerplate): mira su actividad en `tests` (`SELECT count(*), count(distinct date(created_at)) FROM tests WHERE user_id=<uid>` → nº de tests y días activos), los **bugs suyos que hemos arreglado**, y su **oposición + fecha de examen**, y menciónalos con naturalidad. NO cites datos que desmotiven (p.ej. % de aciertos bajo).
4. **Envía** por `POST /api/v2/feedback/respond` (email + campana) y cierra ese feedback **antes** de pasar al siguiente.

### 3. Consultar saldos por pagar
```
GET /api/admin/rewards/accumulated
→ { balances: [{ userId, name, email, balance, suggested }] }   // solo quienes llegan al mínimo (5 €)
```
`suggested` = mayor denominación ≤ saldo.

> **⚠️ ANTES de responder o de pagar, comprueba en BD el estado REAL de saldo y vales del embajador** (gotcha 11/07, caso Mari — Manuel tuvo que corregir dos veces). El endpoint da el `suggested`, pero para redactar el mensaje o decidir un canje mira los datos directamente:
> - **Vales ya emitidos:** `SELECT amount, status, giftcard_ref, created_at FROM reward_payouts WHERE beneficiary_user_id = '<uid>'`. ⚠️ La columna es **`beneficiary_user_id`, NO `user_id`** — una query por `user_id` **no filtra y devuelve 0 en silencio**, y creerás que nunca ha cobrado (me pasó: dije "nunca canjeado" cuando ya tenía un vale de 5€ emitido esa mañana).
> - **El saldo PAGABLE NO se calcula a mano — usa `GET /api/admin/rewards/accumulated` (campo `balance`) o la función `getUserOwedBalance(uid)`.** (Gotcha 11/07, caso Mari: hilé una SQL solo de `reward_submissions` y me perdí el **referido de 10€** y el **registro activo de 2€**, que viven en la tabla `referrals`, NO en `reward_submissions`.) La fórmula real (`getUserOwedBalance`) es:
>   ```
>   SUM(bounty_amount) FROM referrals        WHERE referrer_user_id=<uid> AND status='payable'   -- ⚠️ SOLO 'payable', NO 'qualified' (los qualified están en HOLD de 15 días, no pagables aún)
>   + SUM(amount) FROM reward_submissions     WHERE user_id=<uid> AND status='approved' AND (hold_until IS NULL OR hold_until <= now())
>   − SUM(amount) FROM reward_payouts         WHERE beneficiary_user_id=<uid>
>   ```
> - **El canjeable = ese `balance` pagable, nunca el "ganado" bruto del panel.** El panel muestra `earnedLifetime` (todas las fuentes, incluidas las en hold); el pagable excluye lo retenido. Error real: dije "13€ → vale de 10€" contando mal; lo pagable eran 3€ (+5€ del UGC nuevo = 8€ → vale de 5€), y el referido de 10€ seguía en hold.
> - **Denominación canjeable** = mayor denominación fija de Amazon.es (5/10/20/50…€) **≤ balance pagable**.

### 4. Pagar un vale (gift card) — SUPERVISADO, lo compra Claude (NO automático)

**MODELO (decisión Manuel):** el **cash-out es supervisado**. Los saldos se **acumulan solos** (contabilidad, cero dinero); **comprar el vale sí gasta dinero real → siempre lo pide Manuel** ("a fulano, vale de X€") **y lo ejecuta Claude con una compra DIRECTA controlada**. Nada de pagos automáticos. Por eso **`BITREFILL_LIVE` se queda OFF en prod** a propósito (el endpoint `/api/admin/rewards/issue-giftcard` existe como fallback pero en dry-run — red de seguridad anti-gasto accidental).

**Procedimiento de compra directa (patrón validado en la 1ª compra real, 11/07):**
1. **Pre-check OBLIGATORIO (STOP si falla), ANTES de comprar nada:** el **saldo PAGABLE** del embajador (`getUserOwedBalance` / `balance` del endpoint `accumulated`, que **ya excluye los referidos en hold** — ver §3) debe ser **≥ importe**. **Hazlo antes de la compra Bitrefill**, porque la compra gasta dinero real e **irreversible**: si compras primero y luego `payAccumulated` rechaza por saldo (backstop atómico, línea `if (amount > balance)`), te queda un **vale comprado sin dueño** = dinero perdido. (Aprendizaje 11/07: yo compré antes de pre-chequear el saldo del usuario; salió bien por suerte, pero el orden correcto es pre-check → compra → registro.) **NUNCA restes tú a mano los referidos: los `qualified` están en hold de 15 días y NO son pagables** — por eso se usa `getUserOwedBalance`, que solo cuenta `payable`. También comprueba el saldo de la cuenta Bitrefill: `GET https://api.bitrefill.com/v2/accounts/balance` (Bearer `BITREFILL_API_TOKEN`) — está en **BTC/sats** (un vale de 5€ ≈ **8.934 sats ≈ 5€**; se paga en cripto aunque el vale sea en EUR).
2. **Comprar** (formato CONFIRMADO en la 1ª compra real verificada, 13/07): `POST /v2/invoices` con `{ products:[{ product_id:'amazon_es-spain', value:'5', quantity:1 }], payment_method:'balance', auto_pay:… }`. ⚠️ **`value` es un STRING en EUROS** (`'5'`, `'10'`, `'20'`…, las denominaciones que lista `GET /v2/products/amazon_es-spain` → `packages[].value`) — `value:5` (número) **y** `value:500` (céntimos) dan **`wrong_value`**. **Flujo SEGURO anti-overspend (recomendado):** créalo con `auto_pay:false` → lee `payment.price` (sats; un 5€ ≈ **~9.370 sats**, varía con el BTC) → **si es sano** (≈5€, NO ≈500€ por un value mal interpretado) **paga ESE invoice** con `POST /v2/invoices/{id}/pay`. Verifica que el saldo Bitrefill baja ~9.370 sats. (El lib `lib/referrals/bitrefill.ts` ya manda el string correcto tras el fix 13/07.)
   - ⚠️ **GOTCHA:** el product_id es **`amazon_es-spain`** (NO `amazon_es` → 404 `product_not_found`). Denominaciones válidas 5/10/20/50/100/…€.
   - `auto_pay:true` **paga desde el saldo** (si vuelves a llamar /pay da `already_paid`). Verifica que el saldo Bitrefill **baja** (~8.934 sats por 5€).
3. **Leer el código:** viene en `orders[0].redemption_info`. Si no está al instante (`status` != `all_delivered`), **poll** `GET /v2/invoices/{id}` unas veces. ⚠️ **El formato varía por vale:** unos traen `{ code, pin, extra_fields."Serial Number" }`; otros Amazon.es solo traen **`{ code, extra_fields."Fallback link" }` (sin `pin` ni serial)** (caso 11/07). Guarda `{ code, pin: pin||'', serial: serial||'' }` — **el código basta para canjear** y la UI de "Tus vales" tolera pin/serial vacíos. No abortes si faltan pin/serial.
4. **Registrar el pago** — ⚠️ DOS casos, no confundir:
   - **Pago admin-initiated (sin solicitud previa del usuario):** `payAccumulated({ userId, adminUserId, amount, giftcardRef: JSON.stringify({code,pin,serial}), purchasedVia:'bitrefill' })` → INSERTA una fila `paid` (re-valida denominación + saldo, atómico).
   - **Cumplir una SOLICITUD del usuario (modelo pull — ya existe una fila `reward_payouts` status='pending'):** **NO uses `payAccumulated`** — insertaría una 2ª fila y **descuadraría** (una solicitud `pending` ya RESTA del `getUserOwedBalance`, así que payAccumulated podría duplicar el pago). En su lugar **`UPDATE` esa fila pending → `status='paid'`** con `giftcard_ref`, `purchased_via='bitrefill'`, `approved_by`, `paid_at=now()` (filtra `AND status='pending'` para idempotencia). La sección "🔔 Solicitudes de cobro pendientes" de `/admin/embajadores` lista estas filas. (Aprendizaje 13/07, caso MariSol.)
   - El vale se guarda como **JSON `{code,pin,serial}`** en `reward_payouts.giftcard_ref`. El usuario lo ve en **/embajadores → "Tus vales"** (endpoint `GET /api/referrals/vouchers`, identidad del token) con **botón Copiar** (copia solo el código) + **PIN/serial**, y **le parpadea el 🎁** (el badge cuenta vales nuevos sin ver, no solo ingresos).
   - **TRAZABILIDAD (añadir SIEMPRE, aprendizaje 11/07):** guarda en el mismo `giftcard_ref` claves internas con prefijo `_` — `_invoice_id`, `_order_id`, `_fallback_link` (el `redemption_info.extra_fields."Fallback link"` de revealyourgift.com), `_purchased_at`. **El endpoint de vales solo lee `code`/`pin`/`serial`** (línea `{code:p.code, pin:p.pin, serial:p.serial}`), así que las claves `_*` **NO se exponen al usuario** pero quedan para soporte/seguimiento/reclamación a Bitrefill. La hora exacta ya está en `reward_payouts.paid_at` (el panel muestra solo la fecha — decisión de UI).

**Endpoint fallback:** `POST /api/admin/rewards/issue-giftcard { userId, amount }` hace todo lo anterior en una llamada, pero **solo compra real con `BITREFILL_LIVE=1`** (si no, dry-run con código `DRYRUN-…` que no se muestra al usuario). No se usa mientras el cash-out sea supervisado.

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
