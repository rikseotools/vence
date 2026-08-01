# Runbook: Revisar señales de fraude

**Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** el usuario dice *"revisa las señales de fraude"*, *"revisa los fraudes"*, *"revisa el fraude"*, *"señales de fraude"*, o toca el **badge 🚨 de la pestaña "Fraudes"** del admin. Seguir este runbook ANTES de improvisar.

Sistema **Claude-en-el-bucle**: el sweep detecta y alerta (badge); **el humano dispara y Claude revisa cada señal, la verifica contra los datos y la marca revisada** (`dismissed` = falso positivo, `confirmed` = fraude real). NO es un cron autónomo que bloquee: el enforcement (bloqueo/límite) es fase aparte y siempre con aprobación de Manuel.

## Qué es cada pieza
- **Detección:** el barrido que corre en PRODUCCIÓN es **`backend/src/fraud-sweep/`** — un `@Cron('15 3 * * *')` **dentro del backend NestJS en Fargate**. Escribe SEÑALES en `fraud_alerts` (`status='new'`) con dedup por `match_criteria = kind:subject`.
  > ⚠️ **NO existe `fraud-sweep.yml` en GitHub Actions.** Esta línea decía "cron GHA diario" hasta el 27/07/2026 — quedó obsoleta al migrar a `@Cron` (commit `e5cfe988b`) y **indujo un error real**: se reescribió el detector solo en `scripts/fraud-sweep.cjs` creyendo que era el que corría. **`scripts/fraud-sweep.cjs` es un gemelo CLI para uso manual**; tocarlo NO cambia nada en producción. Un cambio de detección necesita **deploy de BACKEND**. La paridad entre los dos la vigila `__tests__/backend/fraudSweepHarvestParity.test.ts`.
- **Trazo de `/api/exam/validate`** (27/07/2026): evento `exam_validate_served` en `observable_events`, uno por llamada. NO es una `fraud_alert` — es la materia prima que antes no existía (ver §Cosecha por corrección).
- **Badge:** `/api/v2/admin/fraud/pending-count` cuenta `fraud_alerts status='new'` → badge 🚨 en `app/admin/layout.tsx` (rojo si hay `critical`, naranja si no).
- **Panel:** `/admin/fraudes` (pestaña "Señales") lista las pendientes; también `/api/v2/admin/fraud/signals?status=new`.
- **Revisar:** `POST /api/v2/admin/fraud/signals/review` `{id, action: reviewed|dismissed|confirmed, notes}` → sale del badge.

## Los `kind` de señal (qué mira cada uno)
| kind | Qué detecta | Falso positivo típico |
|---|---|---|
| `multi_account_device` | ≥N cuentas distintas en un mismo dispositivo | familia/academia que comparte equipo (pocas cuentas, uso normal) |
| `multi_account_reg_ip` | ≥N cuentas desde una IP **con device compartido** (o ≥20 = egregio), excluyendo rangos CDN/proxy | raro tras el afinado 21/07 (antes: Cloudflare + CGNAT eran 20/21 falsos positivos) |
| `device_daily_farming` | un dispositivo suma > umbral preguntas/día across cuentas | poco frecuente; casi siempre farmeo real del límite free |
| `device_pair_farming` | **la PAREJA clavada en su tope**: las dos cuentas agotan su cupo el mismo día, repetido (T-372) | familia con un día intenso — por eso exige repetición **y** proporción |
| `curl_scraping` | **cosecha SIN navegador**: servidas ≫ respondidas + sin dispositivo + 0 page_views | humano cuyo fingerprint no se registró (pero ESE sí tiene page_views → no salta) |
> ⚠️ **El límite diario distorsiona el denominador — dos veces ya.** El ratio solo significa algo si el usuario pudo contestar libremente. (1) Los **premium** no incrementan `daily_question_usage` (lo esquivan) → por eso `answered` se cuenta en `test_questions`. (2) Los **free** que topan sus 25/día tienen ratio ≤ 0,25 **por construcción** si arman un test grande → por eso existe `answerCapped`, que exime a quien topó su tope. Las 2 primeras señales reales del detector (28/07) fueron justo eso y se descartaron. Contrapartida asumida y anotada en T-179: un cosechador free que conteste hasta su tope queda exento.

| `harvest_no_answer` | **cosecha CON navegador**: servidas ≫ respondidas (ratio < 0,2) pero con huella/page_views → automatización sobre navegador real (Playwright) o extensión | usuario que abre muchos tests y abandona (ratio suele quedar >0,2) |

> **El volumen NO es señal por sí solo** (lección del 27/07/2026). Hubo un tercer detector, `harvest_volume`, que marcaba a partir de 5.000 servidas aunque el ratio fuera sano. Los datos reales lo tumbaron antes de desplegarlo: el usuario más intenso de la plataforma respondió **4.897** preguntas en 30 días —a un 2 % del umbral— y las servidas siempre superan a las respondidas. Habría marcado como sospechosos justo a los opositores de pago más activos. Quien responde el 97 % de lo que se le sirve no está cosechando, está estudiando: **la señal es el RATIO**. El volumen solo AGRAVA (high → critical) una cosecha ya detectada por ratio. No reintroducirlo subiendo el número: el fallo era el razonamiento.
| `premium_sharing` | dispositivo compartido que incluye premium + ≥2 cuentas activas | pareja/familia con una premium legítima |
| `bot_detected` / `suspicious_behavior` | (heredado) respuestas muy rápidas | usuario rápido real |

## Procedimiento de revisión (Claude en el bucle)
1. **Vuelca las pendientes** (RDS, `pg`/`DATABASE_URL`, NUNCA supabase-js):
   ```sql
   SELECT id, alert_type, severity, user_ids, details, detected_at
   FROM fraud_alerts WHERE status='new'
   ORDER BY (severity='critical') DESC, detected_at DESC;
   ```
2. **Verifica cada señal contra los datos** (no te fíes del título):
   - Multicuenta: ¿altas el mismo día en el mismo device? (`user_profiles.created_at`) ¿emails casi idénticos? → farmeo. ¿Uso repartido y espaciado, emails dispares? → posible familia/academia.
   - Farmeo: mira `daily_question_usage` sumado por device/día.
   - **Cosecha** (`curl_scraping` / `harvest_*`): la señal es el RATIO respondidas/servidas, no el volumen suelto. Mira el reparto por días y el `answer_ratio` de los `details`. Un opositor real responde la mayor parte de lo que se le sirve; por debajo de 0,2 hay que explicarlo. Contraste rápido:
     ```sql
     SELECT s.usage_date, s.served,
            coalesce(u.questions_answered, 0) AS respondidas
       FROM daily_questions_served s
       LEFT JOIN daily_question_usage u
         ON u.user_id = s.subject_key::uuid AND u.usage_date = s.usage_date
      WHERE s.subject_key = '<user_id>' AND s.subject_kind = 'user'
      ORDER BY s.usage_date DESC;
     ```
     `dismissed` si el ratio bajo se explica (abandona tests, usa modo examen sin contestar). `confirmed` si el patrón es sostenido y con amplitud rara.
   - IP compartida: ¿es una IP residencial con N cuentas (granja) o una IP de operador/CGNAT/campus? (heurística: nº de cuentas + patrón de nombres).
   - Premium sharing: ¿la premium se usa desde N cuentas free en el mismo device? → sharing.
3. **Adjudica** con `POST /api/v2/admin/fraud/signals/review`:
   - `dismissed` = uso legítimo (falso positivo). Anota el motivo en `notes`.
   - `confirmed` = fraude real. Anota evidencia. **NO bloquees aún**: el bloqueo lo decide Manuel (enforcement fase 1/2).
   - `reviewed` = vista, sin veredicto duro (p.ej. dudosa, a vigilar).
4. **Resume a Manuel** los `confirmed` y propón acción (bloqueo/límite) para su OK. El auto-bloqueo NO está activo en F0.

## ⚠️ El barrido puede estar MUERTO y el badge parecer tranquilo (incidente 21-28/07/2026)

**Lo que pasó:** `backend/src/fraud-sweep/` falló **7 noches seguidas con CERO éxitos**, muriendo siempre en su **primer detector**. Ninguno de los cinco llegó a ejecutarse. Durante esa semana el badge 🚨 estaba bajo no porque no hubiera fraude, sino **porque nadie estaba mirando**. Al arreglarlo, el primer barrido completo destapó **9 señales** que llevaban días sin detectar.

**La causa, y es una trampa reutilizable:** Drizzle interpola un array JS como parámetros SUELTOS, no como array de Postgres. `ANY(${'${users}'})` genera `ANY(($1,$2,$3))` → *"op ANY/ALL (array) requires array on right side"*; y escribir en una columna `uuid[]` da *"expression is of type record"*. **Siempre `pgUuidArray()`** (`backend/src/db/sql-arrays.ts`, espejo de `lib/api/sqlArrays.ts`).

**Lo que NO lo cazó** — importa tanto como la causa:
- `tsc` y `nest build`: la forma del SQL no es un problema de tipos.
- El spec del módulo: **mockea `execute`**, así que el SQL no llega a ejecutarse. Un test verde no dice nada aquí.
- El heartbeat: SÍ emitía `cron_run`/`error` cada noche y entra en `/admin/salud-sistema`. La alarma funcionó; **falló el triaje** — 7 días de señal roja en un panel con ruido (ver T-185).

**Comprobación (30 s), antes de fiarte del badge:**
```bash
npm run canary:fraud-sweep     # formas de SQL + ¿ha terminado bien alguna vez en 3 días?
```
```sql
SELECT created_at::date, metadata->>'status', error_message
  FROM observable_events WHERE endpoint='fraud-sweep' AND event_type='cron_run'
 ORDER BY created_at DESC LIMIT 7;
```
**Un badge a 0 con `status=failure` en esa consulta significa CIEGO, no limpio.**

## Cosecha por corrección (`/api/exam/validate`) — punto ciego cerrado el 27/07/2026

**Qué pasaba:** ese endpoint devuelve la clave **y la explicación completa** de cada `questionId` del lote. Es el único sitio donde la clave no viaja con la pregunta (modo examen), así que es el único que se puede usar como **oráculo**: le pasas una lista de UUIDs y te los corrige. Y cuando la llamada **no trae `testId` no persistía nada** — ni `test_questions`, ni score, ni contador diario. Una cosecha por ahí no dejaba rastro en NINGUNA tabla, así que ninguno de los detectores de este runbook podía verla. Verificado contra prod el 27/07: 50 preguntas en una petición, sin cuenta ni token, 200 con las 50 respuestas y las 50 explicaciones.

**Qué se hizo (solo visibilidad, NO bloquea ni cambia la UX):**
1. Cada llamada emite `exam_validate_served` en `observable_events` con el sujeto (usuario/IP/dispositivo) y la **forma** de la llamada.
2. La corrección cuenta como preguntas **servidas** y alimenta el MISMO gate anti-scraping de `/api/questions/filtered` (no hay contador nuevo). Sin coste para nadie real: el gate solo reta por encima de 500/día y el examen más grande son 110 preguntas.

**Formas** (`metadata.shape`, lógica pura en `lib/api/exam/validateShape.ts`, tests en `__tests__/api/exam/validateShape.test.ts`):

| shape | severidad | Qué es |
|---|---|---|
| `exam` | info | Examen normal con `testId` y respuestas. |
| `exam_blank` | info | Examen entregado entero en blanco. **Normal** — 160 usuarios reales en 30d. No alarma por sí solo. |
| `orphan` | warn | **Sin `testId`.** El cliente real (`ExamLayout`) SIEMPRE lo manda. |
| `orphan_bulk` | error | Sin `testId` y lote > 150 (el examen legítimo más grande son 110). |

**Consulta:**
```sql
SELECT metadata->>'shape' shape, metadata->>'ip' ip, metadata->>'deviceId' device,
       user_id, count(*) n, max(created_at) ultima
FROM observable_events
WHERE event_type='exam_validate_served' AND severity IN ('warn','error')
  AND created_at > now() - interval '7 days'
GROUP BY 1,2,3,4 ORDER BY n DESC;
```

**Cómo interpretarlo — las dos lecturas son útiles:**
- `orphan` **raro y concentrado** en un sujeto → señal de cosecha. Verificar volumen y amplitud antes de confirmar.
- `orphan` **frecuente y repartido** entre usuarios normales → NO es fraude, es un **bug**: el examen no está quedando anclado a su `test` (fallo creando la sesión). Arreglar la causa, no silenciar la señal.

No hace falta tocar `/admin/salud-sistema`: el catch-all de señales error/warn lo recoge solo. **No añadir `exam_validate_served` a `BENIGN_SIGNALS`** sin decidir antes cuál de las dos lecturas de arriba aplica.

## Medir SERVIDAS, no respondidas — el punto ciego de fondo (27/07/2026)

Todos los detectores de consumo se apoyaban en `daily_question_usage.questions_answered`, es decir en respuestas **guardadas**. Pero **cosechar un banco de preguntas no requiere responder**: se cargan y se pasa a la siguiente. Dos consecuencias medidas:

- El usuario `anferbar987` tuvo ese contador en **2** el 16/05/2026 mientras se le servían **5.495** preguntas.
- `curl_scraping`, construido sobre ese contador, **no disparó ni una vez** en toda la vida de la tabla.

Ahora existe `daily_questions_served`: rollup diario de preguntas **SERVIDAS** por sujeto (usuario / `ip:<ip>` / `device:<id>`). No es un contador nuevo — es el que ya alimentaba el gate anti-scraping (Redis `captcha:served:*`, TTL 26 h) hecho duradero, porque el TTL de Redis es de **26 h** y la ventana de detección del barrido es de **30 días**: esa ventana no se puede reconstruir desde el contador efímero, corra donde corra el proceso.

- **Escritura:** `recordServedForSubjects()` → `persistServedRollup()` (`lib/security/challengePolicy/servedRollup.ts`), desde `/api/questions/filtered` y `/api/exam/validate`. Necesita **deploy de FRONTEND**.
- **Clasificación:** núcleo puro `lib/security/harvestSignals.js` (lo usan el panel admin y el gemelo CLI) + su **espejo** `backend/src/fraud-sweep/harvest-signals.ts` (el backend compila con `rootDir: src` y no puede importar de la raíz). Los dos se mantienen alineados por el guardarraíl de paridad `__tests__/backend/fraudSweepHarvestParity.test.ts`, que compara veredictos sobre casos reales — **no** por buena voluntad. Tests del núcleo: `__tests__/security/harvestSignals.test.js`.

⚠️ **Falso verde:** si `daily_questions_served` está vacío en la ventana, la detección de cosecha está **CIEGA**, no limpia. Cuatro avisos independientes lo cubren (una lista vacía nunca debe tranquilizar):

| Señal | Dónde salta | Qué avería cubre |
|---|---|---|
| `fraud_detection_blind` (warn) | `observable_events` → catch-all de `/admin/salud-sistema` | el rollup no tiene datos: writer caído o sin desplegar |
| `served_rollup_write_failed` (error) | idem | el INSERT falla (permisos, tabla, timeout) |
| `served_rollup_module_failed` (error) | idem | el módulo del rollup no carga (bundling, ciclo) |
| `npm run canary:served-rollup` | exit 1 | liveness: sin filas frescas, o filas de usuario sin ninguna de dispositivo (se perdió `x-device-id`, el ancla anti-rotación) |

El panel `/admin/fraudes` muestra además un aviso ámbar explícito en la pestaña de bots cuando el endpoint devuelve `blind:true`.

**La medición NO depende de `CAPTCHA_ENABLED`** (fix 27/07/2026). Ese flag es el rollback instantáneo del *reto* al usuario; si además apagara la medición, un rollback de captcha dejaría la detección ciega en silencio. Detección y enforcement no comparten interruptor.


## 🔒 Límite diario POR DISPOSITIVO — el enforcement que estuvo 3 meses mudo (T-304, 30/07/2026)

**Cuándo mirar aquí:** alerta `device_limit_mudo`, o la pregunta *"¿por qué un free hace 75 preguntas al día?"*.

### Lo que pasó, porque es la lección más cara del subsistema
El bloqueo por dispositivo se construyó el **17/04/2026**: función SQL, `checkDeviceDailyUsage`,
cableado en 4 endpoints del frontend **y** en el backend, con tests y su pantalla de bloqueo. Y
**no cortó ni una sola vez en tres meses**, mientras 3-11 dispositivos al día se pasaban del tope.

No fallaba el enforcement: fallaba **el ancla**. Se agrupaba por el `device_id` de `localStorage`,
que se borra en dos clics. Medido: el trío `suusyyr`/`susanaborgesr`/`susistrawberryy` aparece bajo
**tres `device_id` distintos**, rotando de cuenta cada 15 minutos — 25+25+25 = 75 con un tope de 25.

**Regla mental:** un enforcement anclado a algo que el usuario puede borrar no es un enforcement.
Y sin telemetría de sus bloqueos, es indistinguible de estar apagado — que es justo por qué nadie
lo notó.

### Cómo funciona ahora
- **Ancla:** huella de hardware **v2** (`fp2_…`) — SHA-256 de canvas completo + WebGL + AudioContext
  + RAM + CPU + pantalla normalizada. Sobrevive a borrar `localStorage` porque se **recalcula** del
  hardware: la caché es caché, no identidad (fijado por test).
- **Las huellas v1 (`hw_…`) se IGNORAN a propósito**: colisionan hasta **83 cuentas** (hash de 32
  bits + canvas recortado a su parte constante). Agrupar por ellas sería apagar a usuarias que solo
  comparten modelo de móvil. No es un olvido: está escrito en la función SQL.
- **Función:** `get_device_daily_usage_v2(device_id, fingerprint)` = unión de ambas señales. Es
  **aditiva**: nunca cuenta menos que la anterior (verificado sobre 200 dispositivos, 0 regresiones).
- **Tope:** 25/día por dispositivo, **el mismo que por cuenta** (decisión de Manuel: las cuentas son
  individuales). Medido: **0 device-días con UNA sola cuenta se ven afectados** — quien usa su
  equipo solo nunca lo nota, porque su propio límite ya lo topa en 25.
- **Cada bloqueo deja rastro:** evento `device_daily_limit_blocked` en `observable_events` (con
  `anchor`, para saber si lo cazó la huella o el device_id) **y** anotación en `fraud_watch_list`
  (idempotente por usuario: reincidir sube `suspicion_score` en vez de duplicar filas, y respeta el
  motivo si ya estaba fichado por otro detector). `confirmed_fraud` lo sigue poniendo una persona.

### Encendido en dos tiempos: primero MIDE, luego corta (`DEVICE_LIMIT_MODE`)

El ancla nueva agrupa cuentas que antes no se agrupaban. Eso es lo que se busca **y** el riesgo:
si la huella junta a dos personas que no tienen nada que ver, les cortamos el servicio. Ya hay
precedente en este mismo subsistema (la huella v1 llegó a agrupar 83 cuentas). Por eso NO se
enciende a ciegas:

| modo | qué hace |
|---|---|
| `off` | ni se evalúa — rollback total sin desplegar |
| **`shadow`** | evalúa y REGISTRA lo que habría pasado. **Nadie se bloquea.** ← por defecto |
| `enforce` | corta de verdad |

**⚡ ESTADO 31/07/2026: `enforce` ACTIVADO.** Decisión de Manuel, y con ella la **regla de producto
que faltaba escrita**: *el límite free son **25 preguntas/día por cuenta Y por dispositivo**. Si en
una casa hay dos personas, usan dos dispositivos, cada una con su cuenta.* Eso zanja la duda que
frena a todo el que llega aquí: **una familia compartiendo ordenador limitada a 25 entre todos NO es
un daño colateral, es el comportamiento querido.**

- **Corolario para el triaje:** dos cuentas en un mismo equipo **no necesitan ser la misma persona**
  para que el tope aplique. La marca de **fraude** sí exige evidencia (mismo nombre, alta el mismo
  día, IP compartida); el **límite**, no. No hace falta confirmar a nadie para que el tope corte.
- **Dónde vive el interruptor:** parámetros SSM `/vence-frontend/DEVICE_LIMIT_MODE` y
  `/vence-backend/DEVICE_LIMIT_MODE`. Va por SSM y no por `environment` a propósito — un valor
  horneado en la task def obliga a registrar otra para cambiarlo; por SSM se resuelve al arrancar,
  así que **encender o apagar es cambiar el parámetro y forzar un new deployment** (~5 min, sin
  build). Rollback inmediato: ponerlo en `shadow`.
- **SIEMPRE las dos superficies.** `answer-and-save` hace proxy al backend cuando el canary está
  activo, y entonces el antifraude local no corre. Con una sola, el agujero sigue abierto por la otra.
- **Cómo se comprueba que corta de verdad** (no basta con que el deploy termine): que aparezcan
  eventos `device_daily_limit_blocked` con **`mode:enforce`** — antes de esto el único evento de 7
  días salía con `mode:shadow`, es decir, midiendo y dejando pasar.
- El **defecto del código sigue siendo `shadow`** a propósito: si alguien despliega sin el parámetro,
  el sistema mide en vez de cortar. Un fallo de configuración no puede dejar sin servicio a nadie.

**El defecto es `shadow` a propósito**: un despliegue sin decidir mide, no corta. Y un valor con
typo (`enfoce`, `activar`) tampoco se lee como `enforce` — un error de configuración no puede dejar
a nadie sin servicio. Lo fija `__tests__/guardrails/deviceLimitModeParity.test.ts`, que además
compara el interruptor del frontend con su espejo del backend: `answer-and-save` reparte tráfico
entre los dos caminos, y si discrepan el mismo usuario se bloquea o no según por dónde entre.

**Tras 1-2 días en sombra, la decisión se toma con esto:**
```bash
npm run fraude:sombra-device -- --dias 2
```
Lista, uno a uno, **a quién se habría cortado**: su correo, su plan, cuántas respuestas reales
lleva, en cuántos días distintos, y **con qué otras cuentas comparte equipo**. Ese último dato es
el que separa una granja de una coincidencia. Cómo leerlo:
- correos que son variantes del mismo nombre + altas escalonadas → granja, **activar**;
- correos sin relación y actividad repartida en muchos días → posible familia, **mirar a fondo**;
- *"comparte equipo con: (nadie)"* → la huella está agrupando mal, **no activar**.

Y ojo con el falso alivio: si el script dice "sin registros", lo primero es comprobar la cobertura
(`hw_fingerprint LIKE 'fp2\_%'`). Cero registros con cero huellas v2 significa que no estamos
midiendo, no que no haya farmeo. El script lo avisa solo.

### Diagnóstico en 3 pasos si vuelve a estar mudo
```sql
-- 1) ¿Llega la huella v2? Si es ~0, el cliente no la manda (revisar getFingerprintHeader).
SELECT count(*) FROM user_devices WHERE hw_fingerprint LIKE 'fp2\_%';
-- 2) ¿Agrupa la función?
SELECT get_device_daily_usage_v2('<device_id>', '<fp2_...>');
-- 3) ¿Hay farmeo sin bloqueos? (es lo que vigila la alerta)
SELECT count(*) FROM observable_events
 WHERE event_type='device_daily_limit_blocked' AND ts >= NOW()-INTERVAL '3 days';
```
**Y comprueba el camino que sirve el tráfico:** `answer-and-save` hace **proxy al backend** cuando
el flag está activo, y en ese caso el antifraude LOCAL no se ejecuta. Frontend y backend tienen que
pasar la huella a `checkDeviceDailyUsage` — si solo lo hace uno, el agujero sigue abierto por el otro.


## 🧾 Confirmar una señal la SACA del badge — y por eso hay una alerta (30/07/2026)

El badge 🚨 cuenta las señales en estado `new`. Al confirmar una, **desaparece**: el trabajo de
detectarla y verificarla acaba enterrándola. Medido el 30/07: **20 confirmadas sin resolver, la más
antigua del 21/07**, con el badge en verde y la sensación de que no quedaba nada pendiente.

- **`npm run fraude:dossier`** — expediente de cada confirmada sin acción: quién es cada cuenta, qué
  consume el equipo entero, cuántos días lleva activo, cuánto se sale del tope y si hay algún
  **premium** implicado (en cuyo caso, no tocar sin mirarlo despacio). Solo lee.
- **Alerta `fraude_sin_triar`** (diaria, a partir de 3 días **sin mirar** una señal `new`). Ojo al
  cambio del **31/07 ([T-426])**: hasta esa fecha se llamaba `fraude_confirmado_sin_accion` y
  vigilaba las **confirmadas**. El razonamiento era bueno —confirmar saca la señal del badge 🚨— y
  el dato cierto, pero **pedía una acción que no existía**: con F0 (solo detección + revisión),
  confirmar ERA el último paso, así que la alerta solo podía acumularse y volver a sonar. Y una
  alerta que no se puede atender enseña a ignorar el buzón, que se contagia a las reglas que sí
  importan. Ahora vigila lo accionable: señales que **nadie ha triado**.
  Lo que la desbloqueó: el **límite por dispositivo ya está en `enforce`** ([T-304]) y corta de
  verdad —1.127 bloqueos en 7 días—, así que el farmeo multicuenta sobre un mismo equipo (18 de las
  23 confirmadas del 31/07) **se mitiga solo**. Lo que sigue sin remediación automática son las
  altas masivas desde una misma IP de registro, y eso es **decisión de producto**, no deuda de
  triaje: no se reclama por alerta.
- **Alerta `evasion_multidispositivo`**: cuentas ya marcadas que aparecen en equipos nuevos. Es el
  patrón de quien, al topar el límite del dispositivo, prueba con el móvil de su pareja. No es
  concluyente por sí solo (cambiar de móvil es legítimo), pero en cuentas ya marcadas merece mirada.

**La marca de multicuenta ahora SOBREVIVE al borrado de la cuenta.** `fraud_watch_list.user_id` y
`user_devices.user_id` van con `ON DELETE CASCADE`: pedir la baja limpiaba el historial y permitía
empezar de cero. La marca persistente vive en `fraud_confirmations`, anclada a la **huella de
hardware v2** y al **hash SHA-256 de los correos** (nunca el correo en claro), con **retención de 2
años** — con plazo está amparada por el RGPD art. 17.3; sin plazo, no. Reincidir reinicia la cuenta
atrás. Al crear una cuenta nueva se comprueba y se emite `alta_con_marca_previa`: **solo detecta**,
bloquear un alta es decisión de Manuel.

**El mensaje al usuario NO revela el mecanismo.** Antes había dos textos —uno para el límite de
cuenta y otro para el de dispositivo—, y bastaba compararlos para deducir cómo contamos; sabiéndolo,
el siguiente paso es coger otro móvil. Ahora es **uno solo e idéntico**, lo fija
`__tests__/guardrails/limiteDiarioMensajeUnico.test.ts`. Personalizar el del dispositivo «para que
se entienda mejor» es exactamente el problema.

## Umbrales (env del sweep, calibrables)
`FRAUD_DEVICE_ACCOUNTS` (3), `FRAUD_IP_ACCOUNTS` (5), `FRAUD_DEVICE_DAILY_Q` (60), `FRAUD_SCRAPE_MIN_SERVED` (300), `FRAUD_WINDOW_DAYS` (30).

> **⚠️ El punto ciego que estos umbrales tenían, y por qué NO se arregla tocándolos (T-372).**
> `multi_account_device` exige **≥3 cuentas** y una pareja tiene 2; `device_daily_farming` exige
> **>60 preguntas/día** y 2 cuentas × el tope free de 25 son **50**. O sea: **el patrón que
> produce el propio límite free caía por debajo de los dos cortes a la vez** — el farmeo mínimo
> viable era el invisible. Medido el 31/07 triando a mano los equipos que más consumían: **de 5
> revisados, 4 no habían generado JAMÁS una señal**.
>
> Bajar `FRAUD_DEVICE_ACCOUNTS` a 2 **no es la solución**: inundaría el inbox de familias y
> ordenadores compartidos, y un inbox inundado se deja de mirar. La señal no es cuántas cuentas
> hay, es la **FORMA**: las dos al tope, el mismo día, **repetido**. Una familia reparte de forma
> desigual y variable; una pareja farmeando clava las dos su cupo día tras día.
>
> El criterio vive en `lib/security/parejaFarmeo.js` (núcleo puro, espejado en el backend con
> test de paridad) y tiene **dos partes, porque ninguna basta sola**: ≥3 días clavados **y** ≥50%
> de sus días ACTIVOS. Medido sobre los equipos de 2-3 cuentas de 30 días, el reparto es bimodal
> —`18 de 20` y `9 de 10` frente a `1 de 16`— y los **tres equipos confirmados a mano** el 31/07
> caen los tres en la banda alta (75%, 90%, 60%): la calibración reproduce el veredicto humano.
> La zona intermedia (≥3 días pero <50%) **no abre señal**: sale impresa en el CLI para que un
> humano decida. Subirlos = menos ruido; bajarlos = más sensibilidad. Ajustar con datos reales (fase F3). Los umbrales de la cosecha (ratio 0,2 y volumen egregio 5.000) viven en `DEFAULTS` de `harvestSignals.js`.

## Gaps conocidos / roadmap (enforcement, aún NO activo)
F0 (esto) = **solo detección + revisión**. Pendiente en `docs/roadmap/`:
- **F1:** límite diario por `device_id`+IP además de por cuenta (mata el farmeo).
- **F2:** require-device anti-curl + cap de altas free por device/IP + bloqueo de `confirmed`.
- ~~El límite free hoy es **25/día POR CUENTA** → N cuentas = N×25.~~ **CERRADO el 31/07/2026:** el tope es ahora por cuenta **Y por dispositivo** (`DEVICE_LIMIT_MODE=enforce`, ver arriba). Rotar cuentas en el mismo equipo ya no multiplica el cupo. Lo que sigue abierto de F1 es el límite por **IP**, que es otra ancla.
- **El límite free cuenta RESPONDIDAS, no servidas** → es esquivable sin multicuenta: generar preguntas y no contestarlas no consume cupo (caso `anferbar987`: contador en 2, servidas 5.495). Lo hecho el 27/07 es solo **detección** — `daily_questions_served` mide el hueco pero NO lo cierra. Cambiar la base del límite a servidas es una decisión de PRODUCTO (un free que carga un test de 25 y responde 10 gastaría 25), no un arreglo técnico: no hacerlo sin OK de Manuel.
