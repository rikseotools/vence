# Roadmap — Programa de Recompensas (Referidos + Bug Bounty + Recomendación genuina)

> Estado: **CONSTRUIDO al 100% a nivel código (2026-07-10)** — las 3 formas de ganar (referido/bug/ugc),
> circuito completo, payout operativo (cron + panel admin), 76 tests verdes (4/5 capas; canary=script
> listo post-deploy). En `main` hasta `132f5c15`; bloque bug/UGC pendiente de commit. **Sin desplegar aún.**
> Proveedor gift card decidido: Bitrefill. Este doc recoge decisiones + arquitectura + fases.

## 1. Objetivo

Programa de recompensas donde el usuario puede **ganar dinero (gift card de Amazon) de 3 formas**:
1. **Referido** — traer usuarios nuevos que pagan (10 €).
2. **Bug / mejora de usabilidad** — reportar algo que ayude a mejorar Vence (3 €).
3. **Recomendación genuina (UGC)** — opinión real sobre Vence en grupos de FB/Telegram, post en
   Instagram, comentario o hilo en foros de opositores (5 €).

Todas comparten la misma **fontanería de payout**: gift card de Amazon comprada con **cripto de
wallets viejas** de Manuel (Bitrefill/Coinsbee), **aprobación manual**, topes, y las capas de
seguridad. La cripto parada da salida al pago sin coste percibido.

**Por qué encaja:** ya pagamos CAC por Ads/Meta; un referido que *ya paga* sale más barato y retiene
mejor; el bug bounty compra mejoras de producto por 3 €; el UGC es publicidad boca a boca genuina.

## 2. Modelo (doble cara)

- **Embajador** (quien recomienda): **10 € en gift card de Amazon** por cada usuario que **NUNCA
  ha pagado** (registro nuevo O free existente) que llega por su código y **paga en ≤10 días desde
  la atribución** (clic del enlace / código aplicado). **Excluye ex-premium** (como OpositaTest).
- **Usuario nuevo** (referido): **5 € de descuento** en su primer pago (cupón Stripe de un solo uso).
- **Pago del bounty:** gift cards de Amazon compradas con **cripto de wallets viejas** vía
  Bitrefill / Coinsbee / Cardstorm (MANUAL en el MVP).
- **Sin acumulación:** el embajador cobra **por conversión**, no espera a juntar un mínimo.
- **Con hold:** la gift card se compra **tras pasar la ventana de reembolso** del referido
  (ver §5). "Sin acumular" ≠ "sin hold".

### Economía por conversión
Coste ≈ **10 € (bounty) + 5 € (descuento) + comisión Stripe + spread cripto ≈ 16-17 €/venta**.
Sobre un mensual de 29 € consume casi todo el primer mes → de ahí la decisión pendiente sobre
qué planes califican (§4). Con premium a 39/69/99 el margen es cómodo.

## 2-ter. Las 3 formas de ganar (tipos de recompensa)

Un mismo sistema, tres `reason`. Todas: gift card Amazon (cripto vieja) + aprobación manual + tope.

**A) Referido — 10 €** (detallado arriba). Solo **premium** refiere; referido nunca-pagó paga en
≤10 días desde la atribución; hold 5 días + clawback. Referido nuevo recibe **5 € de descuento** (cupón).

**B) Bug / mejora de usabilidad — 3 €**
- Por cada **bug reproducible** o **sugerencia de UX accionable** que Manuel apruebe como **útil**.
- **Reutiliza el sistema de feedback existente** (`FeedbackModal`, `/api/feedback`, `/admin/feedback`):
  un feedback marcado como "recompensado" por el admin → dispara payout de 3 €.
- Pago **solo lo aprobado**: duplicados/triviales/conocidos/inválidos = 0 €. **Tope por usuario/mes.**
- Riesgo bajo (es tu producto, tu canal). Un bug/UX real vale mucho más de 3 €.

**C) Recomendación genuina / UGC — 5 €**
- Opinión **real** sobre Vence en **grupos de FB/Telegram, post en Instagram, comentario/hilo en foros**
  de opositores. NO reseñas en Google/Trustpilot/App stores (esas prohíben incentivos → deslistado).
- Debe ser una **cualidad real de Vence que le guste al usuario**, veraz, no simulada.
- **Tope 3/mes.** Aporta **link + captura**. **Hold corto:** pagar tras comprobar que el post **sigue
  vivo** unos días (evita borrar-tras-cobrar). **Aprobación manual** (calidad + que no sea spam).
- **Respetar normas del grupo/foro** (muchos prohíben autopromo → baneo + efecto rebote). Poco y bueno.
- **DECISIÓN (Manuel, 2026-07-10): SIN requisito de disclosure de momento** en la opinión de foro.
  ⚠️ Nota honesta: una opinión incentivada sin declarar es técnicamente *publicidad encubierta*
  (Ley Competencia Desleal / Omnibus UE). Se asume el riesgo conscientemente por ahora; revisar si
  escala o si alguna plataforma (Instagram "colaboración pagada") lo exige.

## 2-quater. Proveedor de gift cards (payout) — comparativa (2026-07-10)

Objetivo: el que sea **más fácil + tenga API con token + gestionable por código/Claude**, pagando con
la cripto de wallets viejas.

- **Bitrefill — 🥇 RECOMENDADO.** Personal API con **Bearer token** (`bitrefill.com/account/developers`),
  paga con cripto o saldo, compra Amazon (product_id `amazon_*`), rastrea orden y **recupera el código
  de canje**. Además tiene un **MCP server** (eCommerce MCP) → un asistente (yo) puede buscar y comprar
  vía OAuth. Batches por Business API. = token + automatizable + AI-manageable. **El más fácil.**
- **CryptoRefills — 🥈 alternativa fuerte.** **REST API** de negocio (6.600 marcas, liquidación en USDC,
  **sin prefunding, sin KYC**), Amazon incluido, desde 2018, orientado a "rewards platforms". Buen plan B
  si el acceso a la API de Bitrefill se demora.
- **Coinsbee — 🥉 posible.** Tiene compra de Amazon con 200+ criptos, pero la documentación de API es
  menos clara/AI-friendly (más orientado a consumidor). A verificar si abren API con key.
- **Cardstorm — ❌ manual.** Marketplace de consumidor (páginas de producto tipo tienda); **sin API de
  desarrollador evidente** → solo compra manual. Descartado para automatizar.

**Decisión propuesta:** integrar **Bitrefill API** para el payout automatizado (Fase 2); en el MVP,
compra manual (Bitrefill/Coinsbee) mientras se aprueba el acceso a la API.
**Verificar en build:** que haya **Amazon.es (España)** en denominaciones necesarias (los ejemplos de
los proveedores usan `amazon_com-usa`). Nota: la **Amazon Incentives API** (oficial) exige *prefunding
en fiat* (no cripto) → NO encaja con "usar la cripto vieja".

## 3. Decisiones tomadas

1. **Doble cara:** 10 € embajador + 5 € descuento al nuevo usuario.
2. **Evento que califica:** usuario que **NUNCA ha pagado** (registro nuevo O free existente) +
   primer pago en ≤10 días **desde la atribución** (no desde el registro). Excluye ex-premium (win-back
   es otra campaña). Modelo OpositaTest: "sin cuenta previa O registrado sin compras".
3. **Pago:** gift card Amazon (cripto de wallets viejas, Bitrefill/Coinsbee). Manual en MVP.
4. **Sin acumulación**, pago por conversión.
5. **Excepción consciente a "Vence nunca cupones":** el descuento de 5 € es un cupón Stripe.
   Se acepta SOLO para este programa (feedback `feedback_vence_nunca_cupones`).
6. **Antifraude: el referido paga** = el mayor blindaje (farmear cuentas falsas no es rentable:
   29 € de gasto para recuperar 10 €). Gate premium deja de ser necesario por fraude.
7. **Único vector de fraude residual:** tarjetas robadas / carding → chargebacks. **Lo cubre el hold.**
8. **Payout MANUAL** en el MVP (Manuel aprueba y compra cada gift card) → control total.

## 4. Decisiones de negocio (TODAS RESUELTAS — 2026-07-10)

1. ~~**Ventana de reembolso de Vence**~~ → **DECIDIDO (2026-07-10): reembolso = 5 días → hold = 5 días.**
   El hold de 5 días cubre el refund-abuse voluntario. Matiz asumido: el chargeback de tarjeta robada
   llega semanas después (hasta 120d por red de tarjeta), fuera del hold → se cubre con **clawback**
   (Opción B): si un referido ya pagado hace chargeback más tarde, se banea al embajador y se descuenta
   de sus payouts futuros. Se acepta que algún carder aislado se cuele a cambio de agilidad de pago.
2. ~~**¿Qué planes disparan el bounty?**~~ → **DECIDIDO (2026-07-10): cualquier plan** (incluye
   mensual 29 €). Implicación de margen: sobre un mensual de 29 €, coste ≈16-17 € (bounty+descuento+fees)
   → primer mes casi a coste. Se asume: el referido retiene y el LTV lo cubre. **Vigilar en KPIs** la
   retención de referidos-mensuales; si churnean rápido, reconsiderar bounty escalado por plan.
3. ~~**¿Quién puede referir?**~~ → **DECIDIDO (2026-07-10): solo premium.** Carril 1 = premium activo.
   Motivo: credibilidad (recomienda quien paga y cree en el producto) + refuerza retención premium
   (si caduca, deja de poder referir/cobrar). **Carril 2 (invitados con audiencia)** queda **fuera del
   MVP**; se añade a mano en Fase 2. Regla: si el embajador deja de ser premium, sus referidos EN CURSO
   ya calificados se respetan, pero no puede generar nuevos (definir en Términos).

## 4-bis. Benchmark competidor — OpositaTest (2026-07-10)

Cómo lo hace el líder del sector (fuentes: opositatest.com/mes-gratis-opositatest + blog):
- **Doble cara, pagado en MESES GRATIS de suscripción, NO en dinero.** Recomendador y referido
  reciben 1 mes gratis cada uno.
- **Se activa con la PRIMERA COMPRA** del referido (≥5 €), no con el registro → valida "el referido paga".
- Solo **usuarios nuevos** (sin cuenta o sin compras); **excluye ex-suscriptores**.
- Meses gratis **no caducan y se acumulan**.
- Antifraude: **no acumulable con otras promos**, **1 email máx./día** en invitaciones (rate-limit).

**Aprendizaje:** OpositaTest paga en crédito (meses gratis). **DESCARTADO para Vence (Manuel, 2026-07-10):**
el premio es **gift card de Amazon pagada con cripto de wallets viejas** (motivo: dar salida a esa cripto).
El descuento de 5 € al referido **es un cupón, deliberado y aceptado** para este programa. No se
reconsidera a meses-gratis. Se toma de OpositaTest solo lo mecánico, no el formato de premio.

**Mecánicas a adoptar de OpositaTest** (independientes del formato de premio): activación por
**primera compra**, **solo-nuevos + excluir ex-suscriptores**, **rate-limit de invitaciones (1 email/día)**,
**no acumulable con otras promos**.

## 5. Antifraude (resumen)

| Vector | Defensa |
|---|---|
| Cuentas falsas gratis | **El referido debe pagar** (no rentable) |
| Auto-referido | Bloqueo por email/teléfono nuevo + match device fingerprint / IP / método de pago |
| Tarjetas robadas / chargeback | **Hold** hasta pasada la ventana de reembolso/chargeback |
| Refund-abuse (paga → gift card → reembolsa) | **Hold** + clawback: si reembolsa dentro del hold, no califica |
| Colusión / abuso masivo | Tope por embajador + revisión manual > umbral + kill switch |

El **payout manual** del MVP es en sí mismo una capa: nada se paga sin que Manuel lo apruebe.

## 6. Arquitectura técnica (MVP)

### 6.1 Datos (RDS / Drizzle — `db/schema.ts`)
Reutilizar lo existente donde se pueda (`registration_source`, `conversion_events`, `user_subscriptions`).

- **`referral_codes`** — code (único), owner_user_id, tier (`user`|`premium`|`invited`), active,
  created_at. (O bien columna `referral_code` en `user_profiles` para el carril 1.)
- **`referrals`** — id, referrer_user_id, referred_user_id, code, registered_at,
  `status` (`pending`→`qualified`→`held`→`payable`→`paid` | `rejected`|`expired`),
  qualifying_payment_id, qualified_at, hold_until, plan_type, bounty_amount, discount_applied,
  payout_id, fraud_flags[], notes. Índices por referrer y por status.
- **`referral_payouts`** — id, referrer_user_id, amount, method (`amazon_giftcard`),
  purchased_via (`bitrefill`|`coinsbee`|…), giftcard_ref (guardar cifrado/parcial),
  status, approved_by, paid_at.

### 6.2 Atribución (captura del código)
1. Cada embajador tiene **código + enlace**. **Formato recomendado: ruta `vence.es/r/<code>`**
   (NO query param suelto tipo OpositaTest `?capturar=` — los `?param=` se pierden al compartir/acortar).
   `/r/<code>` → redirect que **setea cookie first-party** y lleva a la **landing de la oferta** (convierte
   más que la home pelada). **Token opaco por defecto** (anti-enumeración) **+ código vanity opcional**
   para embajadores con audiencia (`/r/manuel`).
2. **Atribución NO depende solo del cookie** (por si el usuario los rechaza — GDPR):
   - **Logueado (free existente):** clic en `/r/<code>` → se **engancha el código a su cuenta en BD
     en el acto** (server-side). Cookie irrelevante.
   - **Anónimo → registro:** el `ref` se **propaga por la URL** (`/r/<code>` → `…/registro?ref=<code>`)
     y viaja como **campo oculto en el form**; se captura al **crear la cuenta** en el POST. Cookie-free.
   - **Cookie first-party (30-90 días) = solo "puente"** para quien clica, se va y vuelve en el mismo
     navegador. Si lo rechaza, se pierde esa persistencia entre visitas, NO el flujo principal.
   - **Clasificar el cookie de referido como FUNCIONAL/necesario** (se pone porque el usuario pulsó
     activamente un enlace de referido) → idealmente el banner de consentimiento no lo bloquea.
   **Flujo principal MVP = solo CLIC, cero teclear** (misma suavidad que OpositaTest). El **embajador
   tampoco teclea** — solo copia y comparte su enlace.
   **Campo "¿tienes código de invitación?" (registro/checkout): OPCIONAL, Fase 2.** Único caso que se
   pierde sin él: anónimo + rechaza cookie + vuelve más tarde/otro dispositivo sin la URL. Minoritario.
3. **Dos vías de atribución** (porque el elegible puede ser nuevo O free existente):
   - **Registro nuevo:** al registrarse con la cookie/`ref` presente → persiste `referrer_user_id` +
     `code` en el usuario y crea `referrals` en `pending`. Sella `attributed_at`.
   - **Free existente (nunca pagó):** clic en el enlace **estando logueado** (engancha el código a su
     cuenta) **o** mete el código en el **checkout**. Crea/actualiza `referrals` en `pending` con
     `attributed_at` = ese momento. Rechazar si el usuario **ya fue premium alguna vez**.
4. El **reloj de ≤10 días cuenta desde `attributed_at`**, NO desde el registro (un free existente se
   registró hace meses). Regla first-touch para el mérito; una atribución activa por usuario elegible.

### 6.3 Descuento de 5 € (referido)
- **Cupón/promo Stripe** de 5 €, **un solo uso, primer pago**, aplicado en el checkout cuando hay `ref`.
- Cuenta Stripe **Nila** (altas nuevas van a Nila; ver `lib/stripe.ts` multi-cuenta).
- Guardrail: el cupón solo se emite si la atribución es válida (evitar filtrado del descuento a todos).

### 6.4 Calificación (el referido paga)
- Webhook Stripe `payment_completed` / `conversion_events` → si el pagador tiene `referrals.pending`,
  **nunca fue premium antes**, y paga en **≤10 días desde `attributed_at`** → `qualified`,
  `hold_until = pago + ventana_reembolso (5 días)`.
- Al vencer el hold sin reembolso/chargeback → `payable`.

### 6.5 Payout (manual MVP)
- Panel admin lista `payable` → Manuel **aprueba** → compra gift card en Bitrefill/Coinsbee con cripto
  → registra `referral_payouts` → `paid` → **email al embajador** con el código de la gift card.
- Nota: reutilizar el sistema de emails existente (Resend). NO reutilizar el email de feedback (desactivado).

### 6.6 Panel del embajador
- Vista con: sus referidos, estado de cada uno (pendiente/pagando/en hold/pagado), total ganado,
  cuándo cobra. Transparencia = promocionan más.
- **Métrica núcleo (obligatoria): `registros` vs `compradores` por embajador** + **tasa de conversión**
  (compradores / registros). Sale directa de `referrals` (nº filas = registros; filas con status
  ≥ `qualified` = compradores). Se muestra al embajador (su embudo) y al admin.

### 6.7 Panel admin (vista de programa + antifraude)
- Tabla por embajador: **registros, compradores, conversión, € pagados, € pendientes**.
- **Señal antifraude sobre esa misma métrica:**
  - Muchos registros + **0 compras** → spam / cuentas basura → revisar/bloquear.
  - Conversión **anómalamente alta** (p.ej. 100% con volumen) → posible auto-compra/carding → revisar.
  - Cruce con device fingerprint / IP / método de pago repetidos entre los referidos de un mismo código.

## 7. Fases

### Fase 0 — Decisiones + validación (antes de código)
- Cerrar las 3 decisiones pendientes (§4).
- Validar demanda: ¿hay 3-5 premium/creadores dispuestos a promocionar? Si no, no construir aún.
- Redactar **Términos del programa** (elegibilidad, antifraude, derecho a retener/rechazar, caducidad).

### Fase 1 — MVP (payout manual)
- Schema (`referral_codes`, `referrals`, `referral_payouts`) + migración additiva.
- Generación de código + enlace por usuario (carril 1).
- Captura de atribución en registro (cookie + persistencia) — solo registros nuevos.
- Cupón Stripe 5 € (Nila) en checkout con `ref`.
- Calificación por webhook de pago (≤10 días) + cálculo de hold.
- Panel admin de payouts (aprobar → registrar gift card → email al embajador).
- Panel embajador (estado + ganancias).
- Antifraude mínimo: nuevo-registro-only, bloqueo auto-referido (device/IP/método), tope + revisión manual.
- Observabilidad: eventos `referral_*` en `observable_events` (creado, calificado, pagado, rechazado).

### Fase 2 — Reforzar + segundo carril
- **Carril 2 (embajadores invitados):** alta manual de gente con audiencia + condiciones especiales.
- Antifraude reforzado (fingerprinting, scoring, límites dinámicos).
- Automatizar payout vía API (Tremendous/Tango envían gift card Amazon programática) si el volumen
  lo pide — solo si Manuel quiere dejar el pago manual con cripto.

### Fase 3 — Escala
- Leaderboard, tiers de recompensa, rev-share para top embajadores.
- Medir canibalización (incremental vs orgánico) y ajustar bounty.

## 8. KPIs
- **Por embajador: registros vs compradores + tasa de conversión** (núcleo — §6.6/§6.7). Doble uso:
  medir calidad del embajador y detectar fraude (muchos registros / 0 compras, o conversión anómala).
- Nº referidos iniciados / calificados (conversión del embudo de referido).
- **Coste por usuario pagador adquirido** (bounty + descuento + fees) vs CAC de Ads/Meta.
- Tasa de reembolso/chargeback de referidos (salud antifraude).
- Retención de referidos vs no-referidos.
- % de ventas totales que vienen por referido.

## 9. Riesgos
- **Margen** (no fraude) es el riesgo principal: ~16-17 €/conversión → cuidar qué planes califican.
- Chargebacks tardíos (>hold): mitigar con clawback y ban del embajador reincidente.
- ToS de Amazon sobre gift cards como pago de comisiones → asumido por Manuel.
- Operativa manual del payout no escala → Fase 2 la automatiza.
- Cupón de 5 € filtrándose fuera de referidos → guardrail de emisión.

## 11. Anexo A — Diseño técnico Fase 1 (buildable)

Ancla a la arquitectura real: Drizzle/RDS (`db/schema.ts`), Stripe multi-cuenta (`lib/stripe.ts`,
`getStripeFor('nila')`), `conversion_events` (`lib/services/conversionTracker.ts`), `observable_events`,
wrapper `withErrorLogging`. Migración **additiva** (no toca tablas vivas).

### A.1 Tablas nuevas (Drizzle)
**`referral_codes`** — un código por embajador (MVP):
- `id` uuid pk · `owner_user_id` uuid → user_profiles (unique) · `code` text unique (token opaco;
  vanity opcional Fase 2) · `active` bool default true · `tier` text default 'premium' · `created_at`.

**`referrals`** — una fila por usuario referido (first-touch):
- `id` uuid pk · `referrer_user_id` uuid · `referred_user_id` uuid **unique** (un usuario se refiere una
  vez) · `code` text · `status` text · `attributed_at` timestamptz · `qualified_at` · `plan_type` ·
  `qualifying_payment_ref` text (id de invoice/payment Stripe) · `hold_until` timestamptz ·
  `bounty_amount` numeric default 10 · `discount_applied` bool · `payout_id` uuid → referral_payouts ·
  `fraud_flags` jsonb · `notes` · `created_at` · `updated_at`.
- **Status (state machine):** `pending` → `qualified` → `payable` → `paid` | `rejected` | `expired`.
  (`held` es implícito: `qualified` con `hold_until` en el futuro.) Mismo espíritu que el lifecycle de
  preguntas: transiciones legales + audit.

**`referral_payouts` → generalizar a `reward_payouts`** (payout compartido por los 3 tipos):
- `id` · `beneficiary_user_id` · **`reason` ('referral'|'bug'|'ugc')** · `source_id` (id del referral
  o del reward_submission que lo origina) · `amount` · `method` ('amazon_giftcard') · `purchased_via`
  ('bitrefill'|'coinsbee'|…) · `giftcard_ref` (parcial/cifrado) · `status` ('pending'|'paid'|'void') ·
  `approved_by` · `paid_at` · `created_at`. (Migración de generalización: añade `reason`+`beneficiary`,
  renombra; la tabla está vacía en prod → sin riesgo.)

**`reward_submissions`** — envíos de **bug/UX (3 €)** y **UGC (5 €)** (el referido usa `referrals`):
- `id` · `user_id` · `type` ('bug'|'ugc') · `status` ('pending'|'approved'|'rejected'|'paid') ·
  `url` (link del post/UGC) · `screenshot_url` · `feedback_id` (si viene del feedback, para bug) ·
  `amount` · `hold_until` (UGC: post vivo tras N días) · `approved_by` · `notes` · `created_at`.
- **Topes:** bug y UGC con **tope por usuario/mes** (UGC = 3/mes). Aprobación manual siempre.

### A.2 Endpoints / flujo
- **`GET /r/[code]`** (`withErrorLogging`): resuelve code→owner. Setea cookie funcional `ref` (30-90d) y
  redirige a `/registro?ref=<code>` (landing de oferta). Si hay **usuario logueado** elegible
  (≠ owner, nunca pagó, no ex-premium) → crea `referrals` (`pending`, `attributed_at=now`) en el acto.
  Guardas anti-auto-referido aquí.
- **Registro:** si `ref` (cookie o campo oculto de la URL) + usuario **nunca pagó** → crea `referrals`
  `pending` con `attributed_at`. Persiste `referrer_user_id`.
- **Checkout (Nila):** al crear la sesión Stripe para un referido `pending`, aplica **cupón 5 € un-uso**
  en la cuenta **Nila** (`getStripeFor('nila')`). Guard: solo si la atribución es válida (que el descuento
  no se filtre a no-referidos).
- **Webhook Stripe `payment_completed`:** si el pagador tiene `referrals.pending`, **nunca fue premium**,
  y paga en **≤10 días desde `attributed_at`** → `qualified`, `hold_until = paid_at + 5d`,
  `qualifying_payment_ref`. Emite `observable_event` `referral_qualified`.
- **Webhook refund/chargeback dentro del hold:** → `rejected` (o clawback si ya estaba `paid`).
- **Job/cron:** `qualified` con `hold_until` vencido y sin reembolso → `payable`.
- **Admin payout:** lista `payable` → Manuel aprueba → compra gift card (Bitrefill/Coinsbee) → registra
  `referral_payouts` → `paid` → **email al embajador** con el código (Resend; NO el email de feedback).
- **Panel embajador:** referidos + estado + **registros vs compradores + conversión** + € ganado/cuándo cobra.

### A.3 Guardas antifraude (código)
- Embajador **premium activo** en el momento de atribuir; si no, no atribuye.
- Referido: **nunca pagó** + **no ex-premium** + `≠ referrer`.
- **Bloqueo auto-referido:** match device fingerprint / IP / método de pago entre referrer y referido.
- **Unique(referred_user_id)** = una atribución por referido (first-touch).
- **Tope por embajador** + **revisión manual** > umbral. **Kill switch** por flag.

### A.4 Observabilidad
- `observable_events`: `referral_attributed`, `referral_qualified`, `referral_payable`, `referral_paid`,
  `referral_rejected`, `referral_fraud_flag`. Dashboard sobre esos + la métrica registros/compradores.

### A.6 Página pública "Embajadores" (con icono en el Header)
- **Nombre/ruta: `/embajadores`** (decisión 2026-07-10 — NO "gana dinero", suena spam; "referidos" se
  queda corto ahora que hay 3 vías). Alternativa considerada: "Colaboradores". Título aspiracional
  ("Hazte embajador de Vence"), no transaccional. **Icono en el Header** (nav) que lleva a ella,
  visible para usuarios logueados (al menos premium para el referido).
- **Explica las 3 formas de ganar** de forma clara y honesta, **con énfasis en el boca a boca /
  recomendación genuina** (qué cuenta, qué no, cómo enviar link+captura, topes, cuándo se cobra).
- Muestra el **enlace de referido** del usuario + su **panel** (registros vs compradores, ganancias,
  estado de cada recompensa). Copiar/compartir. Diseño responsive + dark mode (patrón del resto).
- SEO/legal: términos del programa enlazados.

### A.5 Orden de construcción sugerido
1. Migración + tablas + state machine (referral ✅ hecho; falta generalizar payouts + `reward_submissions`).
2. `/r/[code]` + captura (cookie + URL + server-side logueado). 3. Cupón 5 € en checkout Nila + guard.
4. Calificación por webhook + hold. 5. **Página pública `/embajadores` + icono Header** + panel embajador
+ métrica. 6. Bug/UX reward sobre el feedback existente. 7. UGC reward (link+captura+hold+tope).
8. Panel admin payout manual + email + integración Bitrefill API. 9. Antifraude + observabilidad. 10. Términos.

## 12. Capas de seguridad (memoria `feedback_feature_multiples_capas_seguridad`)

Cada capa = un modo de fallo distinto. Estado:
1. **Unit** — `__tests__/referrals/logic.test.ts`: lógica pura (ventana ≤10d, hold 5d, elegibilidad,
   state machine, generación de código). ✅ **HECHO (20 tests verdes).**
2. **Integración** — `__tests__/referrals/queries.integration.test.ts`: queries reales contra RDS
   en tx con ROLLBACK (atribución + first-touch, elegibilidad, qualify dentro/fuera de ventana, hold,
   promoción a payable, métrica registros/compradores). ✅ **HECHO (7 tests verdes).** Requiere
   `@jest-environment node` (postgres.js necesita globals de node). Código: `lib/referrals/queries.ts`.
3. **Simulación (E2E)** — `__tests__/integration/referrals-simulation.test.ts`: circuito completo en tx
   RDS (atribuir → cupón aplicable → pagar → calificar → hold → payable, + rama clawback). ✅ **HECHO (2).**
4. **Canary (verifica en BD)** — post-deploy: un referido sintético recorre los estados en prod. ⏳ PEND
   (necesita deploy). El guard "cupón 5 € SOLO con atribución" ya está en código (gate `hasPendingReferral`).
5. **Guardarraíl (ratchet)** — PARCIAL:
   - ✅ **HECHO** `__tests__/guardrails/referral-state-machine-ratchet.test.ts` (4): congela estados +
     matriz de transiciones + terminales + **detección de drift código↔BD** (lee la migración y compara
     los `CHECK` de status con `REFERRAL_STATES`). Además los invariantes están enforced en Postgres
     (`CHECK` status, `unique(referred_user_id)`, `no_self`).
   - ⏳ PEND (dependen de piezas aún no construidas): guard "cupón 5 € nunca sin atribución válida" y
     "ningún payout con `hold_until` futuro".

**Cerrado 2026-07-10:** capas 1, 2 y 5(parcial) + test del endpoint `/api/referrals/me`. 38 tests verdes.
Faltan **Simulación (3)** — necesita cerrar el circuito (cupón Nila + webhook + captura en registro) —
y **Canary (4)** — necesita deploy.

## 10. Relacionados
- `lib/stripe.ts` (multi-cuenta Manuel/Nila), memoria `project_stripe_dual_cuenta_nila`.
- `conversion_events` / `lib/services/conversionTracker.ts` (funnel: checkout_started, payment_completed).
- `registration_source` (atribución de canal existente).
- `docs/runbooks/observability.md` (eventos `referral_*`).
- feedback `feedback_vence_nunca_cupones` (excepción documentada en §3.5).
