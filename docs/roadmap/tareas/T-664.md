### [T-664] 🟠 [ABIERTO 07/08] El correo de «pago fallido» sigue colándose durante el 3DS: T-594 cerró el 87% y la causa de fondo es avisar al instante

**Lo que ya funciona (no rehacerlo).** T-594 (05/08) metió `decidirAvisoPagoFallido`
(`lib/stripe/falloPagoReal.ts`): el webhook consulta el PaymentIntent y calla cuando la persona
está en la pantalla de su banco. **Está vivo y trabajando**: 18 omisiones registradas
(`pago_fallido_email_omitido`, motivo `autenticacion_pendiente`) en 7 días, la última el 07/08 a
las 17:45.

**Y el efecto se mide:**

| día | correos de pago fallido | de ellos, a quien SÍ pagó |
|---|---|---|
| 03/08 | 25 | 16 |
| 04/08 | 21 | 19 |
| 05/08 | 19 | 15 |
| **06/08** | 4 | **2** |
| **07/08** | 0 | **0** |

A 30 días: **213 enviados y 143 falsos (67%)**. Tras el arreglo, ~2 y bajando.

**El hueco que queda, con la prueba.** El 06/08 el arreglo estaba vivo —hay omisiones a las
15:31, 15:35 y 15:38 del cliente `cus_V1TGMzDApcKS12`— y **entre medias salieron dos correos, a
las 15:33 y 15:36, a esa misma persona** (`mariajo.978@`), cuya suscripción quedó activa a los
105 s y 301 s. Es decir: dentro de una misma secuencia de 3DS, algunos intentos llegan con el
PaymentIntent en un estado de rechazo REAL (no `requires_action`), el criterio dice «avisa» —
correctamente, según lo que Stripe cuenta en ese instante— y la persona completa la compra
segundos después.

**Por qué no se arregla afinando más el criterio.** Se puede seguir añadiendo estados de Stripe a
la lista de silencio, pero el defecto no está en leer mal el estado: está en **decidir en el peor
instante posible**, en mitad de una negociación con el banco que dura minutos. Cualquier criterio
instantáneo va a equivocarse en algún punto de esa secuencia.

**Propuesta: no mandar el correo al instante.** Un fallo de pago REAL no necesita avisarse en 5
segundos; nada cambia si el aviso sale 15 minutos después. Diferirlo y **volver a mirar la factura
antes de enviar** elimina la clase entera de falsos positivos sin depender de acertar el estado en
el momento más ambiguo. Al llegar el momento del envío: si la factura está `paid`, no se manda
nada; si sigue impagada, se manda — y encima con información más fiable.

**Qué mirar antes de construir:** existe `outbox_events` con su procesador cada 5 min
(`backend/src/outbox-processor/`), pero hoy es para materialización de estadísticas, no para
correo. Decidir si se reutiliza o si el diferido va por otro lado es parte de esta tarea, no algo
que dar por hecho.

**Qué NO hacer:** quitar el correo. Un pago que falla de verdad y no se avisa es peor —
la persona pierde el acceso sin saber por qué.

**Vigilancia ya existente:** la regla `pago_fallido_falsa_alarma` (tolerancia cero, ≥1 en 24 h) y
`npm run stripe:pago-fallido-falsos`, que lista a quién y con cuánto desfase. Si esta tarea se
hace bien, las dos se quedan mudas.
