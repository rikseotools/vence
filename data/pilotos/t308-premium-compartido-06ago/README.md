# T-308 — ¿el enforcement de "premium compartido" existe y está mudo? (06/08/2026, w2)

**Respuesta corta: NO es el patrón de [T-304]. No hay código de enforcement que esté mudo —
sencillamente no hay código de enforcement para la señal `premium_sharing`, y eso está
documentado a propósito (F0 = solo detección). PERO existe una protección DISTINTA, real y
activa, que si corta: el tope de 2 dispositivos por cuenta.** Y hay un hueco genuino, más
sutil que "mudo": confirmar una señal `premium_sharing` como fraude real hoy **no tiene
ningún efecto técnico** sobre la cuenta premium implicada.

Reproducible con `node data/pilotos/t308-premium-compartido-06ago/diagnostico.cjs`
(solo lectura, VENCE_LECTOR_URL + grep estático — nunca escribe).

## Paso 1 — ¿existe código de enforcement para `premium_sharing`? NO (confirmado por ausencia exhaustiva)

Grep de `premium_sharing` en TODO el repo (excluyendo `node_modules` y tests): **15
apariciones**, las 15 son o bien el detector (`backend/src/fraud-sweep/fraud-sweep.service.ts`,
`scripts/fraud-sweep.cjs`, gemelo CLI) escribiendo en `fraud_alerts`, o la etiqueta del panel
admin (`app/admin/fraudes/page.tsx`), o un script de otra investigación (`scratchpad/t418/`)
que solo LEE `fraud_alerts` para contar. **Cero líneas con vocabulario de bloqueo/suspensión/
revocación.** Esto es distinto de [T-304], donde el código de bloqueo SÍ existía (`deviceLimit.ts`,
`register_device`) y estaba wireado, pero nunca disparaba por un bug del ancla. Aquí no hay
bug que buscar porque no hay código que debiera dispararse.

Esto coincide con lo que el propio runbook ya dice, sin ambigüedad: *"F0 = solo detección +
revisión; NO bloquea (el enforcement —límite por device/IP, require-device anti-curl, cap de
altas— es fase F1/F2, con aprobación de Manuel)"* — y esto aplica a **todos** los `kind` del
sweep, no es una omisión específica de `premium_sharing`.

## Paso 1bis — el hueco real: confirmar `premium_sharing` no hace NADA

`fraud_confirmations` (la tabla que marca "fraude confirmado por revisión manual") tiene
**un único consumidor en todo el código, frontend Y backend**: `esFraudeConfirmado()`
(`lib/api/fraud/esConfirmado.ts` + su espejo `backend/src/daily-limit/daily-limit.service.ts`).
Y ese consumidor alimenta **solo** el cupo diario compartido del plan FREE
(`lib/api/dailyLimit.ts`) — que premium **esquiva por diseño**, comentado explícitamente en
TRES sitios: `app/api/answer/psychometric/route.ts:79`, `app/api/v2/answer-and-save/route.ts:165`,
`app/api/exam/answer/route.ts:83` (los tres dicen literalmente "solo free users — premium
bypass").

**Consecuencia medida, no supuesta:** si un admin revisa una señal `premium_sharing` y la
marca `confirmed`, la fila se escribe en `fraud_confirmations` — y el único código que la lee
la usa para algo que la cuenta premium implicada **ni siquiera pasa por ahí**. Confirmar
fraude premium hoy es papeleo sin dientes. Esto SÍ es un hueco real, aunque no sea el patrón
exacto de T-304 (aquí no hay bug de anclaje que arreglar; hay una ausencia de conexión entre
"lo confirmo" y "algo pasa").

## Paso 2 — la protección que SÍ existe, y SÍ corta (verificada viva en RDS)

El tope de **2 dispositivos por cuenta** (`register_device`, `lib/api/deviceLimit.ts`) se
aplica **igual a premium que a free** — a diferencia del cupo diario de preguntas, aquí NO
hay bypass para premium en el conteo de dispositivos. Confirmado dos veces:
- **Leyendo el código fuente vivo en RDS** (`pg_proc.prosrc` de `register_device`):
  `v_max := 2` sin excepción por `is_premium` en la rama que bloquea (`RETURN QUERY SELECT
  FALSE, ...`). Coincide EXACTO con la migración `20260804_device_slot_inactivo_7_dias.sql`
  (T-418, 04/08/2026) — está aplicada, no es un caso "mergeado sin aplicar" como T-573/T-038.
- **Con cifra real ya medida por esa misma migración** (no una estimación mía, cita literal
  de su cabecera): *"35 de 289 premium (12%) toparon el límite de 2 dispositivos en 14 días,
  con 183 respuestas rechazadas"*. Es decir: **este mecanismo SÍ corta, y lo hace hoy**.
- La propia migración analizó a esos 35-91 casos y **no encontró indicios de cuentas
  repartidas entre varias personas** (los pares son Android+Windows, Windows+Windows,
  iPad+Mac — pinta de una persona con dos aparatos), y encontró que 39 de 91 con los dos
  slots llenos tenían uno ocupado por un aparato inactivo — de ahí el TTL de 7 días que
  libera slots muertos sin bajar la ventana de 30 días que usa el resto del antifraude.

**Importante — esto NO es lo mismo que detecta `premium_sharing`.** El tope de 2 dispositivos
protege contra "una sola cuenta premium usada desde muchos aparatos" (compartir CREDENCIALES).
`premium_sharing` (fraud-sweep) detecta algo distinto: "un mismo aparato con ≥2 CUENTAS
distintas, una de ellas premium" — que puede ser una pareja/familia con cuentas propias, una
premium (falso positivo típico, ya anotado en el runbook). Los dos mecanismos NO se solapan
y uno no sustituye al otro.

## Paso 3 — no se pudo medir la población de `premium_sharing` hoy: bloqueo RLS nuevo

`fraud_alerts` (histórico de señales) y `user_devices` (población base del detector) dan
**0 filas SIEMPRE** para `vence_lector`: `relrowsecurity=true` y **0 políticas** — el mismo
mecanismo de bloqueo silencioso ya documentado en [T-573]/[T-038] para otras tablas, pero
**estas dos NO estaban catalogadas** en `scripts/canary-rol-lector.cjs` (ni en `DEBE_LEER` ni
en `NO_DEBE_LEER`): es un hueco nuevo, no una decisión ya tomada. `fraud_confirmations` y
`user_profiles` dan `permission denied` (bloqueo distinto, por GRANT, y ese SÍ parece a
propósito — PII directa: `fraud_confirmations` ya está en `NO_DEBE_LEER` por sus
`email_hashes`; `user_profiles` tiene correo/nombre/pago).

**No se re-verificó la cifra "35/289" con datos de hoy** por este bloqueo — se cita tal cual
la dejó la migración de T-418, que sí tenía acceso de escritura. `user_devices` no tiene
columnas de identificador directo (`device_id`, `user_id` uuid, `hw_fingerprint`,
`device_label`, `last_seen_at`) — mismo perfil que `test_questions`, que sí se aprobó — así
que probablemente sea seguro añadirla a `DEBE_LEER`, pero esa decisión y su migración quedan
fuera de esta tarea (no se ha escrito ninguna).

## Conclusión, sin vestir de certeza lo que no se pudo demostrar

1. **DEMOSTRADO por ausencia exhaustiva de código** (grep de todo el repo): `premium_sharing`
   no tiene enforcement automático, y coincide con la política F0 documentada — no es una
   sorpresa tipo T-304.
2. **DEMOSTRADO leyendo el código fuente vivo en RDS**: el tope de 2 dispositivos SÍ aplica a
   premium y SÍ corta — no está mudo.
3. **DEMOSTRADO por trazado de código**: confirmar `premium_sharing` no tiene ningún efecto
   sobre la cuenta premium (el único consumidor de `fraud_confirmations` es el cupo free).
4. **SOSPECHO, sin poder confirmarlo hoy**, que la cifra "35/289 premium, 183 respuestas
   rechazadas" sigue siendo representativa — no se pudo remedir por el bloqueo RLS de
   `user_devices`/`fraud_alerts`. Haría falta o bien acceso de escritura, o bien añadir
   `user_devices` a `DEBE_LEER` (decisión pendiente, no tomada aquí).

## Qué decidir (es de Manuel, no mío)

- ¿El tope de 2 dispositivos por cuenta es SUFICIENTE protección contra compartir premium, o
  hace falta además actuar sobre las señales `premium_sharing` confirmadas (hoy sin efecto)?
- Si hace falta actuar: ¿qué acción? (¿avisar al usuario, requerir verificación, limitar algo
  específico?) — no hay campo de decisión previo del que partir, es una página en blanco.
- ¿Vale la pena añadir `user_devices` a `DEBE_LEER` del canario para poder medir esto sin
  depender de quien tenga escritura?
