# Propuesta: presupuesto único de timeout para `/api/v2/answer-and-save`

> **Estado:** PROPUESTA, sin aplicar. Pedida por Manuel el 05/08 (pregunta bloqueante #10 de
> [T-315]) tras corregir el diagnóstico: el muro de "25 s" no está en `route.ts` (código casi
> inerte desde que `shouldRouteToBackend('answer-and-save')` es `true` sin rollout desde el
> 24/05), está en `backend/src/answer-save/answer-save.controller.ts`. **No la aplico yo — es un
> endpoint keystone que toca el antifraude, y Manuel pidió explícitamente que decida una
> persona.**

## 1. El problema, con los cinco números que hoy no se hablan entre sí

| capa | fichero | valor hoy | qué mide |
|---|---|---|---|
| Cliente (navegador) | `lib/api/v2/answer-and-save/client.ts:48` | 25.000 ms | `AbortController` del `fetch` del usuario |
| Proxy Vercel→backend | `app/api/v2/answer-and-save/route.ts:98` | 25.000 ms | `AbortController` de la llamada al backend |
| Límite de plataforma | `app/api/v2/answer-and-save/route.ts:25` | `maxDuration=30` | Next.js mata la función entera a los 30 s |
| Antifraude (backend) | `backend/src/answer-save/answer-save.controller.ts:40` | 10.000 ms | 3 RPCs en paralelo |
| Validar+guardar (backend) | `backend/src/answer-save/answer-save.controller.ts:42` | 15.000 ms | cache miss + INSERT + triggers |

Los dos del backend son **secuenciales**: antifraude corre entero, y SOLO SI termina arranca
validar+guardar. El peor caso no es el mayor de los dos, es la **suma**: 10.000 + 15.000 =
**25.000 ms**. Y esos 25.000 ms del backend coinciden, por casualidad de haber subido cada
número por separado en momentos distintos, con los 25.000 ms del proxy y del cliente — pero
nada los ata entre sí. **Medido (14 días, 3 mediciones independientes — w2 05/08, w4 06/08
08:10 UTC, esta propuesta 06/08 ~23:30 UTC, cifras casi idénticas):**

| banda `duration_ms` | eventos | % con `http_status=503` |
|---|---|---|
| 10.000-10.999 ms | 19 | 84% |
| 15.000-15.999 ms | 15 | 80% |
| 25.000-25.999 ms | 46 | 0% (78% con 200 — los que llegan a tiempo) |

Los dos primeros muros son el corte de los quick-fail del backend fallando **cerrado** (503).
El tercero es la cola de peticiones que sí completan, pegadas al límite. `http_timeout` con
`timeoutMs=25000` (el de `route.ts`) lleva **0 eventos en 14 días** en las tres mediciones — ese
código casi no se ejecuta.

**Por qué "realinear los cuatro números" es la solución equivocada, no solo una parcheada:**
cuatro timeouts independientes que hoy suman bien (10+15=25, y el proxy/cliente también en 25)
vuelven a desalinearse en cuanto alguien toca UNO de los cinco sin acordarse de los otros
cuatro — que es exactamente cómo se llegó aquí (la historia de mayo: el timeout del backend
subió dos veces en dos días sin que nadie revisara el cliente hasta que un incidente lo obligó).
Y bajar el corte del backend sin arreglar por qué las RPCs/el INSERT tardan lo que tardan
devuelve los ~49k req/día con 503 de mayo (documentado en [T-315] y en
`incidente-answer-save-503-28-05.md`).

## 2. Diseño propuesto: un presupuesto, declarado en UN sitio, que se propaga

En vez de 5 números independientes, **UNA constante** (el total que el usuario está dispuesto a
esperar) de la que cada fase consume lo que le queda:

```ts
// backend/src/answer-save/presupuesto.ts (nombre tentativo)
export const ANSWER_SAVE_BUDGET_MS = 25_000 // el mismo suelo que hoy sí deja pasar el 78% de las lentas

export interface Presupuesto {
  /** Lo que queda del presupuesto total, nunca negativo. */
  restanteMs(): number
}

export function crearPresupuesto(totalMs: number, ahora: () => number = Date.now): Presupuesto {
  const inicio = ahora()
  return {
    restanteMs: () => Math.max(0, totalMs - (ahora() - inicio)),
  }
}
```

Uso en el controller (**boceto, no aplicado**):

```ts
const presupuesto = crearPresupuesto(ANSWER_SAVE_BUDGET_MS)
// antifraude consume del presupuesto total, no de un número propio
const antifraudResult = await withTimeout(() => Promise.all([...]), presupuesto.restanteMs(), 'antifraud')
// validar+guardar recibe SOLO lo que quedó — nunca puede hacer que el total supere el presupuesto
const result = await withTimeout(() => this.answerSave.validateAndSaveAnswer(...), presupuesto.restanteMs(), 'validate-and-save')
```

**Por qué esto es mejor que "bajar los dos números":** el peor caso deja de ser una SUMA sin
techo (10+15, y el día que alguien suba uno de los dos vuelve a crecer) para ser el propio
presupuesto declarado — un solo sitio que decide "cuánto puede esperar un opositor", y las fases
compiten por ÉL en vez de tener cada una su propia cuota fija. Si antifraude tarda poco (el caso
normal, <500 ms documentado en el propio código), validar+guardar sigue teniendo casi los 25 s
completos — hoy, en cambio, un antifraude lento SIEMPRE deja solo 15.000 ms a guardar, aunque el
presupuesto total hubiera bastado.

**El suelo mínimo importa:** si antifraude se come casi todo el presupuesto,
`presupuesto.restanteMs()` para guardar puede quedar en unos pocos ms — insuficiente para
intentarlo en serio. Con un **suelo** (p.ej. `Math.max(restante, 3_000)`) se garantiza que
guardar tenga SIEMPRE una oportunidad real, a costa de poder superar el presupuesto total en el
peor de los peores casos — es una decisión de producto (¿preferimos fallar rápido con seguridad
de presupuesto exacto, o dar siempre una última oportunidad a que la respuesta se guarde?) que
dejo escrita, no decidida.

## 3. El antifraude: las DOS opciones que Manuel planteó, con mi recomendación

"Antifraude" aquí son en realidad DOS cosas distintas mezcladas en el mismo `Promise.all`:
- **Seguridad anti-abuso real:** `registerAndCheckDevice`, `checkDeviceDailyUsage` — su fallo
  NO debe bloquear al usuario legítimo (ya falla en sombra/dirigido, ver [T-304]).
- **Gate de producto:** `getDailyLimitStatus` (el tope de 25 preguntas/día del plan free) — esto
  SÍ tiene que decidirse ANTES de responder, porque su resultado determina un 403. No es
  "antifraude", es negocio.

Confundir las dos es lo que hace arriesgado sacarlo entero del camino crítico sin más: si se
lanza sin esperar, un usuario que ya agotó su cupo recibiría la respuesta como si tuviera cupo
(200 en vez de 403) mientras el chequeo sigue en vuelo — un cambio de comportamiento de producto,
no solo de latencia.

- **Opción A — fuera del camino crítico (lo que pedía la ficha original):** lanzar las 3 RPCs sin
  esperarlas y responder ya. Requiere separar el gate de cupo (`getDailyLimitStatus`) del resto:
  ese SIGUE bloqueando (rápido — es una lectura simple, no la RPC lenta), lo que se saca es
  `registerAndCheckDevice`/`checkDeviceDailyUsage`, cuyo resultado hoy solo importa para marcar
  (`fraud_watch_list`) o bloquear en modo `enforce`/`dirigido` — casos que ya toleran resolverse
  un segundo tarde sin que el usuario lo note. Más rápido en el caso normal, pero cambia CUÁNDO
  se aplica un bloqueo por dispositivo (llega en la SIGUIENTE petición, no en ésta).
- **Opción B — presupuesto propio que no se come el de guardar:** todo el bloque antifraude
  (incluido el gate de cupo) sigue bloqueando como hoy, pero con SU PROPIO techo corto (p. ej.
  3.000-5.000 ms, acorde a que el propio código dice que en el caso normal tarda <500 ms) que NO
  resta del presupuesto de guardar — dos presupuestos independientes en vez de uno compartido
  para esta fase concreta. Más simple de razonar (nada cambia de "cuándo" bloquea), pero no ataca
  la causa de que a veces tarde 10 s: solo limita el daño.
- **Mi recomendación: B primero, A como fase 2.** B es reversible en un commit, no cambia
  semántica de producto, y ya usando el presupuesto único del §2 (guardar recibe lo que sobra
  DESPUÉS de los 3-5 s de antifraude, no unos 15.000 ms fijos) se recupera casi todo el margen
  perdido. A es la mejora estructural real (sacar del camino una comprobación cuyo fallo no debe
  bloquear) pero exige el trabajo de separar "seguridad" de "gate de producto" dentro del mismo
  bloque, que hoy están entrelazados — trabajo de diseño, no una tarde.

## 4. Alinear el resto de capas con el MISMO número (no una copia)

- **Cliente (`client.ts`) y proxy (`route.ts`):** que ambos importen `ANSWER_SAVE_BUDGET_MS` (o
  su equivalente compartido cross-runtime — el cliente es un bundle de frontend, así que sería
  una constante duplicada CON UN TEST DE PARIDAD que compare los tres valores, como ya existe el
  patrón en otros pares frontend/backend de este repo) en vez de tener su propio `25000` escrito
  a mano. Si el presupuesto cambia, cambia en los tres sitios a la vez o el test de paridad lo
  dice.
- **`maxDuration=30` de Vercel:** debe quedar SIEMPRE por encima del presupuesto + margen para
  el fallback local, no igual ni por debajo — es la causa exacta del hallazgo del §5.

## 5. Hallazgo aparte (ficha propia, no aquí): el 504 silencioso del proxy

El `AbortController` de `route.ts` (~línea 98) envuelve la llamada AL PROXY con el mismo
presupuesto (25 s), y `maxDuration=30` dispone de solo 5 s más. Si el proxy agota su presupuesto
y cae al fallback local, ese fallback vuelve a arrancar con SU PROPIO presupuesto completo (hoy
25.000+25.000 ms) en vez de con lo que queda de los 30 s totales — la función muere por el
**límite de la plataforma**, no por una excepción de nuestro código, así que no pasa por ningún
`catch`, no genera `request_completed`, no genera `errorRef`. Un 504 completamente invisible en
`observable_events`. Mecanismo demostrado leyendo el código; NO medido en frecuencia real —
necesita logs de ALB/Vercel a los que no tengo acceso como worker. Reservada ficha separada.

## 6. Qué NO propongo tocar todavía

- No toco `answer-save.controller.ts` — es el código real, no lo aplico sin decisión.
- No decido A vs B del antifraude — dejo la recomendación, decide una persona.
- No fijo el valor exacto de `ANSWER_SAVE_BUDGET_MS` — 25.000 ms es el suelo que hoy deja pasar
  el 78% de las peticiones lentas; bajarlo sin antes aplicar el presupuesto único (que YA da más
  margen a guardar en el caso normal) reproduce los 503 de mayo.
