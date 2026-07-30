# Runbook — Montar una oferta de precio personalizada

Cuando a una persona hay que mantenerle un precio que ya tenía (o darle uno concreto), esto
es lo que se hace. **Frases-gatillo:** *"mantenle el precio"*, *"hazle una oferta"*,
*"móntale un precio para ella"*, *"respétale la tarifa antigua"*.

> **De dónde sale (29/07/2026).** Al vaciar la cuenta antigua de Stripe se pusieron ~200
> suscripciones en "no renovar" y se apagaron solas. A esas personas les habíamos mandado
> antes el recordatorio de que *"se renovará automáticamente, no tienes que hacer nada"*.
> Hicieron lo que les pedimos —nada— y se quedaron sin premium. La primera que escribió fue
> Rocío, y de ahí salió toda esta herramienta.

---

## 1. Antes de nada: ¿procede?

1. **Mira Stripe, no supongas.** Si su suscripción se apagó, averigua si fue **baja suya** o
   **cancelación nuestra** (`docs/procedures/gestionar-feedback-bug.md` § «Mi suscripción no
   se ha renovado»). No es lo mismo pedir disculpas que explicar una baja voluntaria.
2. **Comprueba qué pagaba de verdad**, no lo que crees: `subscriptions.list` + las últimas
   facturas. Con cupón de fidelidad, el importe facturado no es el de tarifa.
3. **Verifica los precios vigentes contra lo que sirve la web**, nunca contra `.env.local`
   (trae ids viejos). El 29/07 se le dieron a Rocío 35 € y 59 € cuando eran 39 € y 69 €:
   volvió dos veces a pagar, vio otro número y se fue sin comprar.
   ```bash
   curl -s https://www.vence.es/premium > /tmp/p.html
   for u in $(grep -oE '/_next/static/chunks/[A-Za-z0-9._~-]+\.js' /tmp/p.html | sort -u); do
     curl -s "https://www.vence.es$u" | grep -oE 'price_1T[A-Za-z0-9]+'; done | sort -u
   # y luego stripe.prices.retrieve(<id>) en la cuenta NILA
   ```

---

## 2. Crear la oferta

```bash
node scripts/stripe/precio-heredado.cjs crear <email> <importe€> \
  [--intervalo mensual|trimestral|semestral|anual] \
  --motivo "usuaria antigua: se le mantiene el precio que tenía" \
  --feedback <uuid del feedback>  [--dry-run]
```

Qué hace, y por qué así:

- **Un PRICE dedicado, no un cupón.** Un cupón obliga a pensar en porcentajes (18/29 =
  −37,93 %, con redondeos que no cuadran) y se descoloca en cuanto cambie la tarifa base. El
  precio propio factura la cifra exacta mes tras mes y es lo que la persona ve en su recibo.
- **Idempotente:** el price se identifica por `lookup_key` derivada de (intervalo, importe),
  así que dos personas con el mismo precio comparten uno en vez de generar duplicados.
- **Sin tocar código:** el plan (mensual/trimestral/…) lo deduce el webhook del INTERVALO, no
  del importe, así que cualquier cifra funciona.
- **Registra la oferta** en `user_price_offers`, que es lo que hace que pueda contratarla en
  **vence.es/premium/personal** — dentro de Vence, viendo lo que contrata, en vez de un
  enlace de pago suelto que no dice a dónde lleva.
- **Varias ofertas vivas por persona, una por precio** (índice único sobre `(user_id,
  stripe_price_id)`). El índice original era «una sola viva» y se relajó el mismo 29/07: a
  Rocío se le ofrecieron su mensual Y su trimestral para que eligiera, y con el índice
  antiguo la segunda habría retirado a la primera. Ojo al concederlas: el endpoint y la
  página tienen que devolverlas y pintarlas **todas** (`ofertas`, en plural).

Comprobar después:

```bash
node scripts/stripe/precio-heredado.cjs listar     # precios y enlaces vivos
```

---

## 3. Qué se le dice

Enlace **`https://www.vence.es/premium/personal`**, no el de Stripe. El de `buy.stripe.com`
queda como respaldo por si no puede entrar en su cuenta.

- **Con la sesión iniciada**, ahí ve su precio y un botón para activarlo.
- **Sin iniciar sesión** ve «Inicia sesión con tu cuenta para ver el precio que te hemos
  guardado» — díselo en el mensaje: el 29/07 Rocío contestó *"no puedo acceder a la oferta"*
  y era eso.

No hace falta explicarle el mecanismo. Basta con que sepa el precio, la periodicidad y dónde
pinchar.

---

## 4. Seguridad (ya resuelta, para que nadie la desmonte)

El checkout acepta el `priceId` que le manden, así que un precio a medida filtrado sería un
descuento para cualquiera. Por eso `/api/stripe/create-checkout` comprueba que la oferta es
**suya** y sigue viva antes de aceptar un precio fuera de catálogo, y **rechaza si no puede
comprobarlo** (al revés que los demás guardias del fichero: ahí un fallo significaría cobrar
al precio de otro). Guardarraíl: `__tests__/guardrails/precioPersonalizadoSeguridad.test.ts`.

Además, un precio heredado **no acumula** encima el cupón de fidelidad del 10 %: ese precio
ya reconoce la antigüedad, y sumar los dos sería contar el mismo beneficio dos veces.

---

## 4-bis. Cómo comprobar que de verdad puede pagar

> **Los tres días que costó aprender esto (29-30/07).** A Rocío se le dijo tres veces que ya
> lo tenía resuelto, y las tres seguía sin poder pagar: primero un 405, luego un 401, luego
> otra vez el 405 por una causa distinta. Cada vez se comprobó algo que salía verde y no era
> lo que ella hacía.

**Probar el endpoint con un token a mano NO prueba nada.** Un `curl` con Bearer devuelve 200
mientras la página sigue rota: la página puede llamar con otro método, sin cabeceras, o no
llamar. Lo que hay que mirar es **su camino real**:

```sql
-- ¿Qué le pasó a ELLA, en su navegador? (source='frontend' = lo emite el cliente)
SELECT ts, event_type, endpoint, metadata->>'method' AS metodo,
       metadata->>'status' AS estado, deploy_version
  FROM observable_events
 WHERE user_id = '<uuid>' AND ts > NOW() - INTERVAL '24 hours'
 ORDER BY ts DESC LIMIT 30;
```

Cómo leerlo:

- **405** → el cliente llama con un método que el endpoint no acepta. Suele ser
  `apiFetch(url, body, options)` con las opciones escritas en la posición del **cuerpo**:
  `options` queda `undefined` y sale POST por defecto. Para un GET, usar **`apiGet`**.
- **401** → la llamada no lleva `getAuthHeaders()`.
- **200 y la página vacía** → mirar el contrato (¿`ofertas` en plural?, ¿`LIMIT 1` en la
  consulta?).
- **`deploy_version`** dice qué versión estaba ejecutando. Es lo que distingue «no le ha
  llegado el arreglo» de «el arreglo no arregla». El 30/07 salía el despliegue nuevo con un
  POST, y eso descartó de golpe la hipótesis de la caché.

Y si necesita pagar **ya**, sin esperar a un despliegue: mándale su **Payment Link**
(`user_price_offers.payment_link_url`). Lleva `supabase_user_id` en la metadata de la
suscripción, así que el webhook le activa el premium en su cuenta igual que el checkout.
Comprobar antes que el enlace está activo y con el precio correcto:

```bash
node scripts/stripe/precio-heredado.cjs listar
```

---

## 5. Al terminar

- El webhook marca la oferta como **usada** al activarse la suscripción, así que no se puede
  contratar dos veces al precio especial.
- En su perfil verá **su importe**, no el de tarifa: la pestaña de suscripción lee el precio
  de su suscripción en Stripe.
- Si la persona **no llega a pagar**, la oferta se queda viva y se puede retirar a mano
  (`revoked_at`) o dejarla por si vuelve.

**Relacionados:** `docs/procedures/gestionar-feedback-bug.md` (§ «Mi suscripción no se ha
renovado»), `docs/runbooks/embajadores-recompensas.md`, memoria `project-stripe-manuel-vaciado`.
