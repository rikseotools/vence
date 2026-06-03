# Roadmap — Trackeo de Conversiones de Venta (atribución + bus server-side + destinos enchufables)

> **Estado:** ✅ **F0 + F1 IMPLEMENTADOS y VERIFICADOS (2026-06-03).** Código
> commiteado en `main` local (sin pushear), migraciones aplicadas a prod, acción
> de conversión creada en Ads. Pendiente solo go-live (flags + push). Ver §12.
>
> **Origen:** investigación 03/06 — ayer hubo 4 primeras compras, todas correctas
> en el badge interno (webhook Stripe → `conversion_events`/`payment_settlements`),
> pero **0 llegaron a Google Ads**. Causas: (1) ninguna conversión de compra se
> dispara (la acción "vence (web) purchase" está HIDDEN y nada la llama),
> (2) captura de `gclid` rota (solo en `/landing/*`, `/api/acquisition` sin caller,
> tabla `user_acquisition` con 1 fila), (3) las campañas optimizan por "Registro"
> (señal client-side sujeta a consentimiento), no por venta.
>
> **Principio rector:** *pensar en grande* — diseñar para el destino, no para el
> volumen actual. Mismo patrón "agnóstico by contract" que observabilidad.
>
> **Principio rector:** *pensar en grande* — diseñar para el destino, no para el
> volumen actual. Mismo patrón "agnóstico by contract" que observabilidad (Sink
> intercambiable). AWS-native by contract: bus/outbox migrables a EventBridge/SQS
> sin tocar código de app.

---

## 0. El problema en una frase

La venta es un evento **de servidor** (webhook de Stripe), pero hoy se intenta (mal)
medir **en cliente**. Lo robusto es lo contrario: emitir la conversión desde el
servidor, con el valor real en €, y abanicarla a cada plataforma publicitaria con
su click-ID. El registro interno (badge) ya es así y por eso es fiable; falta
extender esa misma filosofía a la atribución de marketing.

---

## 1. Arquitectura del estado final

```
  [Edge / cualquier página]                    [Servidor — fuente de verdad]
  captura click-IDs + UTM        signup         webhook Stripe / auth
  (gclid,gbraid,wbraid,fbclid,    bind            │  (misma TX que graba la venta)
   ttclid,msclkid) + landing  ─────────►          ▼
        │                                   recordConversion(event)
        ▼                                          │
  attribution_touches (append-only)               ▼
        │  derive                           conversion_outbox  ──► worker (at-least-once, idempotente, DLQ)
        ▼                                          │ fan-out
  user_attribution (first + last touch)            ├──► GoogleAdsAdapter   (OCI por click-ID + Enhanced Conversions)
        └───────────── join por userId ───────────┤──► MetaCapiAdapter      (futuro)
                                                   ├──► GA4MpAdapter         (futuro)
                                                   └──► TikTokAdapter        (futuro)
                                                          │
                                          reconcile job: Stripe ⋈ outbox ⋈ entregado  → /admin ROAS + alertas
```

**Tres contratos limpios** (lo que hace que no haya deuda técnica):
1. `ConversionEvent` — el evento canónico (type, userId, value, currency, occurredAt, attribution, dedupId).
2. `ConversionDestination` — interfaz que implementa cada plataforma. Añadir Meta/TikTok = implementar la interfaz, **cero cambios en el bus**.
3. `AttributionTouch` — toque de atribución agnóstico de plataforma (cualquier click-ID).

---

## 2. Modelo de datos

### 2.1 `attribution_touches` (NUEVO, append-only)
Cada toque relevante, anónimo o identificado. Inmutable (auditoría + re-derivación).

| col | tipo | nota |
|---|---|---|
| id | uuid PK | |
| anon_id | text | cookie 1ª parte (pre-signup) |
| user_id | uuid null | se rellena al ligar en signup |
| gclid / gbraid / wbraid | text null | Google (web / iOS app / iOS web) |
| fbclid / ttclid / msclkid | text null | Meta / TikTok / Bing |
| utm_source/medium/campaign/term/content | text null | |
| landing_path / referrer | text null | |
| occurred_at | timestamptz | |

Índices: `anon_id`, `user_id`, `gclid`.

### 2.2 `user_attribution` (EVOLUCIÓN de `user_acquisition`)
La actual `user_acquisition` es single-touch y solo gclid/fbclid. Se mantiene como
vista/derivación, pero la verdad pasa a ser: **first-touch + last-touch** derivados
de `attribution_touches`. Migración aditiva (no romper readers de `roi.ts`).

### 2.3 `conversion_outbox` (NUEVO — espejo del patrón `test_questions_outbox`)
| col | tipo | nota |
|---|---|---|
| id | uuid PK | = dedupId del evento (idempotencia) |
| event_type | text | purchase / refund / registration / checkout_started |
| user_id | uuid | |
| value_cents / currency | int / text | valor real |
| occurred_at | timestamptz | momento del evento (no de la subida) |
| payload | jsonb | snapshot atribución + plan |
| destination | text | google_ads / meta / ga4 / ... (una fila por destino) |
| status | text | pending / delivered / failed |
| retry_count | int | DLQ a partir de N |
| delivered_at | timestamptz null | |

Worker reutiliza la mecánica del outbox existente (tick en `observable_events`,
DLQ, reintentos). **At-least-once + idempotente** → si Ads API cae, no se pierde.

---

## 3. Contratos (TypeScript)

```ts
// lib/conversions/types.ts
export interface ConversionEvent {
  dedupId: string                 // idempotencia (p.ej. `purchase:${invoiceId}`)
  type: 'purchase' | 'refund' | 'registration' | 'checkout_started'
  userId: string
  valueCents: number
  currency: string
  occurredAt: string
  attribution: AttributionSnapshot // click-IDs + email hash para enhanced
}

export interface ConversionDestination {
  readonly name: string                          // 'google_ads'
  deliver(event: ConversionEvent): Promise<DeliveryResult>  // idempotente
  supports(event: ConversionEvent): boolean      // p.ej. solo purchase/refund
}
```

`recordConversion(event)` valida, escribe una fila de outbox **por destino
suscrito**, y retorna. El worker llama `destination.deliver()` con reintentos.

---

## 4. Adapters de destino

### 4.1 `GoogleAdsAdapter` (Fase 1)
- **Offline Conversion Import** vía `ConversionUploadService` (click conversions
  por gclid/gbraid/wbraid) — nuevo `lib/services/googleAds/conversions.ts`, mismo
  patrón de seguridad que `mutations.ts` (`dryRun` + `validate_only`).
- **Enhanced Conversions for Leads/Web** (email hasheado SHA-256) como red para
  ventas sin click-ID.
- Activar en la cuenta la acción **"vence (web) purchase"** (hoy HIDDEN) y subir
  con valor € + plan.
- Reembolsos = conversión negativa / ajuste de retracción.

### 4.2 Futuros (Fase 4) — sin tocar el bus
`MetaCapiAdapter` (Conversions API + fbclid + email hash), `GA4MpAdapter`
(Measurement Protocol), `TikTokAdapter` (Events API), `BingAdapter` (msclkid).

---

## 5. Consentimiento y privacidad
- Consent Mode v2 en el edge para señales client-side.
- Las conversiones server-side con datos de 1ª parte (email hasheado, click-ID
  propio) son válidas bajo interés legítimo/relación contractual con el comprador.
- Hash SHA-256 normalizado (lowercase/trim) antes de enviar; nunca PII en claro a destinos.

---

## 6. Observabilidad y autoauditoría
- **Job de reconciliación diario:** Stripe (verdad) ⋈ `conversion_outbox` ⋈
  entregado-a-Ads. Automatiza lo que hoy se hace a mano. Emite a `observable_events`
  y alerta (regla tipo `RULE_CONVERSION_GAP`) si una venta no se entregó en X horas.
- **Panel `/admin`:** ROAS real por campaña = coste (Ads API, `reports.ts`) ⋈
  ingreso (`payment_settlements`). Extiende `roi.ts`.

---

## 7. Fases (cada una de producción, criterios de done)

### F0 — Capa de atribución duradera  *(base, desbloquea todo)*
- [ ] Captura de TODOS los click-IDs (gclid/gbraid/wbraid/fbclid/ttclid/msclkid) +
      UTM en **cualquier** página de entrada (no solo `/landing/*`).
- [ ] `attribution_touches` append-only + `anon_id` cookie 1ª parte.
- [ ] Binding anon→user en signup. `/api/acquisition` con caller real montado.
- [ ] `user_attribution` (first+last) derivada; `user_acquisition` sigue sirviendo a `roi.ts`.
- **Done:** un usuario que llega por anuncio a una página normal queda con su gclid ligado tras registrarse. `attribution_touches` crece.

### F1 — Bus + outbox + GoogleAdsAdapter  *(las ventas llegan a Ads)*
- [ ] `recordConversion` + `conversion_outbox` + worker (reusar patrón outbox).
- [ ] Emitir `purchase`/`refund` desde el webhook de Stripe (en la TX que ya graba el badge), `registration` desde auth.
- [ ] `lib/services/googleAds/conversions.ts` (OCI + Enhanced Conversions, dryRun/validate_only).
- [ ] Activar acción "vence (web) purchase" en la cuenta.
- **Done:** una compra real aparece en Google Ads (modo validate primero, luego live) con su valor € y dedup. Reproceso no duplica.

### F2 — Reconciliación + ROAS + alertas
- [ ] Job diario Stripe ⋈ outbox ⋈ entregado; alerta de hueco.
- [ ] Panel ROAS por campaña en `/admin`.
- **Done:** si una venta no llega a un destino, salta alerta sola.

### F3 — Cambiar puja a Compra / tROAS
- [ ] Con ~2-3 semanas de datos limpios, mover optimización de "Registro" a compra/valor.
- **Done:** campañas pujando por venta, ROAS medible.

### F4 — Destinos extra + valor por LTV
- [ ] `MetaCapiAdapter`, `GA4MpAdapter`, `TikTokAdapter` (cada uno = un fichero, contrato intacto).
- [ ] Enviar LTV predicho en vez del primer pago (value rules).
- **Done:** añadir una plataforma no toca el bus.

---

## 8. Garantías anti-deuda-técnica (resumen)
- **Un contrato, destinos como adapters** → nueva plataforma = fichero nuevo.
- **Outbox + idempotencia** → sobrevive caídas de API y reprocesos.
- **Click-ID agnóstico desde el día 1** → iOS/Meta/TikTok cubiertos sin rediseño.
- **Reconciliación** → el sistema caza sus propios huecos.
- **AWS-native by contract** → bus/outbox migrables a EventBridge/SQS sin tocar app.

---

## 9. Puntos de enganche en el código actual
- Webhook: `app/api/stripe/webhook/route.ts` → `handleCheckoutSessionCompleted`
  (ya llama `track_conversion_event('payment_completed')`; ahí va `recordConversion`).
- Atribución actual: `lib/campaignTracker.ts` + `app/api/acquisition/route.ts` +
  tabla `user_acquisition` (migración `20260602_user_acquisition.sql`).
- Cookie de campaña: solo `app/landing/layout.js` (ampliar a global).
- Google Ads: `lib/services/googleAds/` (client/config/mutations/reports/roi);
  añadir `conversions.ts`.
- Patrón outbox de referencia: `docs/runbooks/outbox-cutover.md` + `test_questions_outbox`.
```

---

## 10. Estado de implementación (2026-06-03)

**F0 + F1 implementados, verificados y commiteados** (rama mergeada a `main` local,
commits `e7d7e2a4` + `7ec99213`, **sin pushear**). Migraciones `20260603_attribution_touches.sql`
y `20260603_conversion_outbox.sql` **aplicadas a prod**.

Ficheros: ver commit. Flags introducidos:
- `ADS_CONVERSION_UPLOAD_ENABLED` (default off → cron en validate-only, no escribe en Ads).
- `ADS_CONVERSION_DRYRUN` (fuerza validate-only aunque esté enabled).
- `ADS_ENHANCED_CONVERSIONS_ENABLED` (default off → NO envía email hasheado; solo click-ID).

## 11. Hallazgos de la verificación (lo que destaparon los tests)

1. **La acción "vence (web) purchase" (7447588685) era de tipo `GOOGLE_ANALYTICS_4_PURCHASE`** —
   evento importado de GA4. **NO admite Offline Conversion Import por API.** Descartada.
   → Creada por API una acción dedicada **`Vence Compra (Offline Import)` =
   `customers/9148967335/conversionActions/7634202403`** (tipo `UPLOAD_CLICKS`, PURCHASE,
   ENABLED, one-per-click, valor del upload, lookback 90d, secundaria). Es la que usa el adapter.
2. **Aceptar los "customer data terms" NO basta para enviar el email hasheado** (`user_identifiers`):
   hace falta además configurar "Conversiones mejoradas" con método Google Ads API. Si se manda
   sin eso, Google **rechaza la conversión entera** (aunque el gclid sea válido). → El email va
   detrás de `ADS_ENHANCED_CONVERSIONS_ENABLED` (default off); por defecto se sube **solo el click-ID**.
3. **OCI por gclid funciona sin Enhanced Conversions** (validate_only limpio salvo gclid de prueba).
   Es el 80% del valor (ventas de clic de anuncio).

## 12. Go-live — ✅ HECHO (03/06)

- ✅ Desplegado en prod (ECS task def, deploy por workflow_dispatch).
- ✅ Credenciales `GOOGLE_ADS_*` + flags en SSM `/vence-frontend/` (cableado `ensure_secret`).
- ✅ `ADS_CONVERSION_UPLOAD_ENABLED=true` → envío real (verificado: `dryRun:false`).
- ✅ `ADS_ENHANCED_CONVERSIONS_ENABLED=true` → email hasheado (los customer data terms ya
  aceptados bastan; NO requiere config UI extra — verificado validate_only "solo email" ✅).
  **Recuperó 2 ventas reales de hoy sin gclid (79€) por email → `delivered`.**
- ✅ Acción `Vence Compra (Offline Import)` (UPLOAD_CLICKS) creada y activa = `7634202403`.
- Pendiente account/ops (no código): cuando haya histórico ~1-2 sem, promover la acción a
  **primaria** y cambiar la puja a **compra/tROAS**.

Verificado 03/06: 6 unit + sims BD + Google Ads validate_only + smoke live + **cadena completa en
prod con datos reales** (2 ventas `delivered` vía Enhanced Conversions).

## 13. Robustez post-go-live

- ✅ **#1 Alerta** `RULE_CONVERSION_DELIVERY_FAILED` (backend/src/alerts/alert-rules.ts):
  [Vence ERROR] si hay conversiones en DLQ o atascadas >6h. Red de seguridad ante token Ads
  caducado / API caída. Commit `86a1610a`.
- ✅ **#3 Cobertura webhook**: `enqueueAdsPurchaseConversion` llamado desde AMBOS caminos de
  checkout (metadata + búsqueda por email). Ya no se pierde ninguna venta. Commit `86a1610a`.
- ⏳ **#2 Reembolsos → retracción (PENDIENTE)**: hoy `supports = solo purchase`; un reembolso NO
  se descuenta en Google Ads → ROAS inflado cuando hay devoluciones. Falta enviar un *conversion
  adjustment* (RETRACTION) por `order_id` desde el flujo de reembolso de Stripe. Requiere:
  `GoogleAdsDestination.supports` acepte `refund` + un `uploadConversionAdjustment` en
  `conversions.ts` (servicio `conversionAdjustmentUploads`) + enganche en el webhook
  `charge.refunded`/`handleSubscriptionDeleted`. Decisión Manuel 03/06: dejarlo para después.
