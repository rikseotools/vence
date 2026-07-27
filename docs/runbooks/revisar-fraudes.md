# Runbook: Revisar señales de fraude

**Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** el usuario dice *"revisa las señales de fraude"*, *"revisa los fraudes"*, *"revisa el fraude"*, *"señales de fraude"*, o toca el **badge 🚨 de la pestaña "Fraudes"** del admin. Seguir este runbook ANTES de improvisar.

Sistema **Claude-en-el-bucle**: el sweep detecta y alerta (badge); **el humano dispara y Claude revisa cada señal, la verifica contra los datos y la marca revisada** (`dismissed` = falso positivo, `confirmed` = fraude real). NO es un cron autónomo que bloquee: el enforcement (bloqueo/límite) es fase aparte y siempre con aprobación de Manuel.

## Qué es cada pieza
- **Detección:** `scripts/fraud-sweep.cjs` (cron GHA diario `fraud-sweep.yml`) escribe SEÑALES en `fraud_alerts` (`status='new'`) con dedup por `match_criteria = kind:subject`.
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
| `curl_scraping` | **cosecha SIN navegador**: servidas ≫ respondidas + sin dispositivo + 0 page_views | humano cuyo fingerprint no se registró (pero ESE sí tiene page_views → no salta) |
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

Ahora existe `daily_questions_served`: rollup diario de preguntas **SERVIDAS** por sujeto (usuario / `ip:<ip>` / `device:<id>`). No es un contador nuevo — es el que ya alimentaba el gate anti-scraping (Redis `captcha:served:*`, TTL 26 h) hecho duradero, porque `fraud-sweep.cjs` corre en GitHub Actions (fuera de la VPC) y no puede leer ElastiCache.

- **Escritura:** `recordServedForSubjects()` → `persistServedRollup()` (`lib/security/challengePolicy/servedRollup.ts`), desde `/api/questions/filtered` y `/api/exam/validate`.
- **Clasificación:** núcleo puro `lib/security/harvestSignals.js`, compartido por el sweep y el panel para que no puedan divergir. Tests: `__tests__/security/harvestSignals.test.js`.

⚠️ **Falso verde:** si `daily_questions_served` está vacío en la ventana, la detección de cosecha está **CIEGA**, no limpia. Cuatro avisos independientes lo cubren (una lista vacía nunca debe tranquilizar):

| Señal | Dónde salta | Qué avería cubre |
|---|---|---|
| `fraud_detection_blind` (warn) | `observable_events` → catch-all de `/admin/salud-sistema` | el rollup no tiene datos: writer caído o sin desplegar |
| `served_rollup_write_failed` (error) | idem | el INSERT falla (permisos, tabla, timeout) |
| `served_rollup_module_failed` (error) | idem | el módulo del rollup no carga (bundling, ciclo) |
| `npm run canary:served-rollup` | exit 1 | liveness: sin filas frescas, o filas de usuario sin ninguna de dispositivo (se perdió `x-device-id`, el ancla anti-rotación) |

El panel `/admin/fraudes` muestra además un aviso ámbar explícito en la pestaña de bots cuando el endpoint devuelve `blind:true`.

**La medición NO depende de `CAPTCHA_ENABLED`** (fix 27/07/2026). Ese flag es el rollback instantáneo del *reto* al usuario; si además apagara la medición, un rollback de captcha dejaría la detección ciega en silencio. Detección y enforcement no comparten interruptor.

## Umbrales (env del sweep, calibrables)
`FRAUD_DEVICE_ACCOUNTS` (3), `FRAUD_IP_ACCOUNTS` (5), `FRAUD_DEVICE_DAILY_Q` (60), `FRAUD_SCRAPE_MIN_SERVED` (300), `FRAUD_WINDOW_DAYS` (30). Subirlos = menos ruido; bajarlos = más sensibilidad. Ajustar con datos reales (fase F3). Los umbrales de la cosecha (ratio 0,2 y volumen egregio 5.000) viven en `DEFAULTS` de `harvestSignals.js`.

## Gaps conocidos / roadmap (enforcement, aún NO activo)
F0 (esto) = **solo detección + revisión**. Pendiente en `docs/roadmap/`:
- **F1:** límite diario por `device_id`+IP además de por cuenta (mata el farmeo).
- **F2:** require-device anti-curl + cap de altas free por device/IP + bloqueo de `confirmed`.
- El límite free hoy es **25/día POR CUENTA** (`lib/api/daily-limit/config.ts`) → N cuentas = N×25. Ese es el hueco que F1 cierra.
- **El límite free cuenta RESPONDIDAS, no servidas** → es esquivable sin multicuenta: generar preguntas y no contestarlas no consume cupo (caso `anferbar987`: contador en 2, servidas 5.495). Lo hecho el 27/07 es solo **detección** — `daily_questions_served` mide el hueco pero NO lo cierra. Cambiar la base del límite a servidas es una decisión de PRODUCTO (un free que carga un test de 25 y responde 10 gastaría 25), no un arreglo técnico: no hacerlo sin OK de Manuel.
