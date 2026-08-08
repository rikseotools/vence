### [T-651] 🟡 [ABIERTO 07/08] El antifraude marcaba como bot a nuestro propio canario y lo dejaba clavado en rojo

**Qué pasaba.** Nuestros canaries navegan con un navegador AUTOMATIZADO y con la cuenta
`smoke@vence.es`. BotD (cliente → `/api/fraud/report`) los reconoce como automatización —
correctamente, lo son — y con score alto el endpoint llamaba a `markForcedChallenge`, que pega en
Redis una marca de «retar siempre» (`captcha:force:<sujeto>`, TTL 24 h) sobre el usuario y su
dispositivo. A partir de ahí el gate de `/api/questions/filtered` reta a ese sujeto **sin mirar el
volumen**.

**Medido el 07/08:** a las 13:41 se puso la marca sobre `127063e1…` (= `smoke@vence.es`, score 175,
`severity: critical`). Desde entonces el canario `canary-questions-gate` recibía `challenge` con
`reason: 'bot_flag'` y `served: 1, tripped: false, threshold: 500` — o sea, **1 pregunta servida de
500** y aun así retado. Resultado: `canary_questions_gate_failed` (critical) disparando en bucle.

**Por qué importa más de lo que parece.** No es que un canario moleste: es que **un canario que no
puede volver a verde deja de ser una señal**. El que se apagó vigila precisamente que el gate
anti-scraping no le cierre la puerta a un usuario normal — la avería más cara que puede tener ese
subsistema — y estaba clavado en rojo por otra pieza nuestra. En 7 días la marca se puso 9 veces,
7 de ellas sobre cuentas reales y 2 sobre la sintética.

**Arreglo (hecho, pendiente de desplegar).** La exención vive en el **punto de escritura**
(`lib/security/challengePolicy/forceChallenge.ts`), no en el llamante: `markForcedChallenge`
consulta `user_profiles.is_synthetic` — la fuente central que ya existía desde la migración
`20260720_synthetic_user_central` y que el ranking ya usa para no premiar a los canaries — y no
marca si la cuenta es sintética. Si viviera en el llamante, el próximo sitio que marque un reto
nacería sin ella, que es exactamente cómo se pierden las protecciones (T-130).

- Decisión pura y exportada (`decidirMarcadoForzado`) + lector con **fail-open hacia MARCAR**: si la
  BD no contesta no se puede afirmar que la cuenta sea nuestra, y la defensa anti-scraping no debe
  caerse porque falle una consulta auxiliar.
- **La exención no es silenciosa:** emite `scraping_force_challenge_exento` (info) con el motivo. Una
  exención que no deja rastro es indistinguible de un marcado que nunca ocurrió.
- ⚠️ **NO confundir con `esCanaryDeConfianza`** (`lib/api/syntheticTrust.ts`): aquello exime a una
  PETICIÓN que demuestra con un secreto ser interna, y el canario del gate no lo usa a propósito
  (su cometido es pasar por el gate como un usuario normal). Esto decide sobre la CUENTA, que es un
  dato del servidor y nadie puede afirmar desde fuera.

**Capas:** 8 unit (`__tests__/security/forceChallengeSintetica.test.ts`, núcleo puro + puerta con el
lector mockeado) y guardarraíl `__tests__/guardrails/retoForzadoPuertaUnica.guardrail.test.ts`, que
exige que nadie construya `captcha:force:` fuera de la puerta y que todo llamante pase el `userId`
(sin él la exención es imposible). Los 43 tests de seguridad ya existentes siguen verdes.

**Qué falta:** verificar en producción tras el deploy que (a) el canario `canary-questions-gate`
vuelve a verde y (b) aparece algún `scraping_force_challenge_exento` cuando el canario de navegador
se autoreporte. La marca viva caduca sola por TTL (24 h desde el 07/08 13:41), pero **se rearma en
cada pasada del canario de navegador** mientras el arreglo no esté desplegado.

**Cabos sueltos que deja a la vista (NO son esta tarea):**
- No hay forma de **levantar una marca** de reto forzado sobre un usuario REAL mal marcado: hoy solo
  se puede esperar el TTL de 24 h. El 07/08 seis premium recibieron el captcha (575-1.200 servidas en
  2 días; una lo vio 33 veces) — si alguno fuera falso positivo, no tenemos herramienta.
- Si el umbral de 500/día es el correcto para premium es decisión de producto, sin tocar aquí.
