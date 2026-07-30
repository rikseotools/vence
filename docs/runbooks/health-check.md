# Runbook: estado de salud del sistema

Manual operativo para diagnosticar errores o salud del sistema Vence. Cuando el usuario diga "busca errores", "qué tal va", "estado", "salud", o similar, Claude debe seguir este runbook ANTES de improvisar.

Mantenedor: `docs/runbooks/health-check.md`. Referenciado desde `CLAUDE.md`.

> ## ⚠️⚠️ POST-CUTOVER A RDS (2026-07-04) — leer antes de diagnosticar
> La BD de prod migró a **AWS RDS** (`vence-prod`, Multi-AZ). **`observable_events` y todos los datos vivos
> están en RDS, NO en Supabase (congelado como backup).**
> - **Las queries de este runbook usan `DATABASE_URL`, que en `.env.local` AÚN apunta a Supabase (congelado)**
>   → correrlas en local mira la BD EQUIVOCADA. Usar la URL de RDS (en `prod` la tiene ECS vía SSM
>   `/vence-frontend/DATABASE_URL`; para diagnósticos manuales, la conexión RDS está en la memoria
>   `project_cutover_rds_prod`). Conectar con `ssl:{rejectUnauthorized:false}` + `?sslmode=require`.
> - **Ya NO hay Supavisor ni PgBouncer** en el camino: `getDb()`/réplica van directo a RDS con **`max:5`**
>   (era `max:1`, workaround del pooler compartido de Supabase). El self-hosted `pooler.vence.es` está bypassed.
>   → Los fingerprints históricos con `application_name='Supavisor'` (abajo, §incidentes) ya no aplican; en RDS
>   mirar `pg_stat_activity WHERE datname='app'` sin filtro de Supavisor. Panel `/admin/infraestructura`
>   (stats PgBouncer) queda obsoleto.
> - **Gotcha de migración**: tras una carga masiva, `ANALYZE;` es obligatorio (sin stats → seq scans → 503
>   "saturado"). Si reaparecen 503 de saturación tras cualquier recarga, ejecutar `ANALYZE` primero.
> Detalle: memoria `project_cutover_rds_prod` + `docs/roadmap/migracion-datos-supabase-a-rds.md`.
>
> **Incidente 11/07 — flood de logs benignos (503 en `/admin` + inbox de CRITICAL):** el 401
> "unauthenticated" de `/api/auth/token` (contrato: todo visitante SIN sesión lo recibe) se
> registraba como error en `validation_error_logs` (~340k/día, 96% anónimos) desde el cutover.
> Cascada: la tabla creció a ~1 GB / 2,3 M filas → el GROUP BY de su panel `/api/v2/admin/validation-errors`
> tardaba **112 s → 500**; y `observable_events` se llenó de 348k `auth` warns/día ahogando las alertas.
> Fix en 3 capas: (1) `withErrorLogging` ya NO loguea el 401 ANÓNIMO en VLE (solo el 401 con
> credenciales rechazadas = señal de auth real); (2) cron `telemetry-retention` (04:10 UTC) poda
> ambas tablas > 30d; (3) alert-rule `validation_log_flood` (≥5000/h por bucket) auto-detecta el
> próximo flood. Purga puntual del backlog: 2,08 M filas anónimas → GROUP BY 112s→3,3s. **Si
> reaparece un 503 en un panel admin, sospecha primero de una tabla de log inflada** (mira
> `pg_total_relation_size` + ritmo de inserción por endpoint/error_type).

---

## 0. LO PRIMERO: ¿qué ha disparado el alerting? (= tu bandeja de email) — OBLIGATORIO

> **Por qué existe (incidente 21/07/2026):** los avisos que se emailean (`[Vence CRITICAL]…`,
> `[Vence ERROR]…`) **ANTES solo se emaileaban** — no quedaban en ningún sitio consultable.
> Resultado: un "revisa la salud" muestreaba métricas crudas **punto-por-punto** y, como los
> spikes son intermitentes (cada ~30 min, breves), se declaraba "sana" **entre** spikes mientras
> el email los cazaba → falso "todo bien". Desde el 21/07 el cron de alertas **persiste cada
> aviso disparado** en `observable_events` (`event_type='alert_fired'`). **Consúltalo SIEMPRE
> primero**: es la señal continua, sin muestreo. Si aquí hay filas, NO digas "sana" —
> investiga esas reglas.
>
> ⚠️ **DESDE T-272 (30/07/2026) `alert_fired` YA NO ES 1:1 CON LA BANDEJA.** Que una regla
> DISPARE y que además mande CORREO son dos decisiones distintas: el correo lo decide la
> política de email (severidad mínima + backoff por problema, ver §1.bis.c). La diferencia
> está EN el dato, no en la cabeza de nadie:
> - **la bandeja de Manuel** = `alert_fired` **`WHERE metadata->>'emailed' = 'true'`**
> - **todo lo que el sistema vio** = `alert_fired` a secas (lo que no se emaileó lleva
>   `emailSkipped` = `severity` \| `backoff`, más `emailStreak`/`emailNextInMin`)
>
> Para diagnosticar **usa siempre la segunda**: un problema silenciado en el buzón sigue
> siendo un problema. La primera solo sirve para responder "¿por qué me llegan tantos/pocos
> correos?".

```bash
node -e "
const { createClient } = require('@supabase/supabase-js'); // o pg contra RDS (ver cabecera)
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { ssl:{rejectUnauthorized:false}, max:1 });
(async () => {
  const rows = await sql\`
    SELECT metadata->>'rule' AS rule, severity, count(*)::int AS veces,
           count(*) FILTER (WHERE metadata->>'emailed' = 'true')::int AS emailados,
           max(ts) AS ultimo, (array_agg(error_message ORDER BY ts DESC))[1] AS titulo
    FROM observable_events
    WHERE event_type = 'alert_fired' AND ts >= NOW() - INTERVAL '2 hours'
    GROUP BY 1,2 ORDER BY max(ts) DESC\`;
  if (!rows.length) console.log('✅ 0 avisos disparados en 2h — coincide con una bandeja limpia');
  else { console.log('🔴 avisos disparados (emailados / total — lo silenciado SIGUE siendo un problema):');
    rows.forEach(r => console.log('  ['+r.severity+'] '+r.rule+' x'+r.veces+' ('+r.emailados+' al buzón) (últ '+r.ultimo.toISOString().slice(11,16)+'): '+r.titulo)); }
  await sql.end();
})();
"
```

Regla de oro: **el veredicto de salud NO puede ser más verde que tu bandeja de email.** Si
`alert_fired` tiene filas y las métricas crudas salen limpias, es que muestreaste entre spikes
— el alerting (continuo) manda sobre el snapshot (puntual).

**Corolario desde T-272:** ahora la bandeja puede estar limpia **a propósito** (backoff de una
avería crónica ya fichada). Así que la bandeja limpia ya NO acredita salud: acredita que no hay
nada NUEVO. El veredicto sale de `alert_fired` completo, no de cuántos correos llegaron.

## 1. Comprobación rápida (30 segundos)

Por humano:

Abrir en navegador `https://www.vence.es/admin/infraestructura` (alias `/admin/salud-sistema`). Bloque CRÍTICOS (semáforo) + OBSERVABILIDAD (incluye errores de cliente + catch-all) + SANITY:

1. **Errores 5xx servidor últimas 24h** (`http_status >= 500`) — verde 0, ámbar ≥1, rojo ≥5.
2. **UI congelada cliente** (Watchdog hook `useAnswerWatchdog`, threshold 12s) — verde 0, ámbar ≥3, rojo ≥10. Cada evento = un user con UI bloqueada en ExamLayout/TestLayout. Suele correlar con saturación BD/antifraud, no con un fallo del servidor.
   - **Nota — drift residual del fix Page Visibility** (commit `a4051a6b`, 31/05/2026): si % de events con `duration_ms > 60s` sube de ~0% (post-fix) a >20%, hay regresión en un navegador real (probable Safari/mobile) donde la Page Visibility API no se comporta como en Chrome/JSDOM. La alerta `watchdog_wallclock_residual` lo detecta automáticamente con cooldown 4h. Investigar con: `SELECT user_id, duration_ms, metadata->>'userAgent' FROM validation_error_logs WHERE error_message ILIKE '%Watchdog%' AND duration_ms > 60000 ORDER BY duration_ms DESC LIMIT 20;`
3. **Drift contadores 24h** (>5%) — verde 0, ámbar ≥1, rojo ≥5.
   - **⚠️ Punto ciego conocido (03/06/2026)**: este indicador se alimenta de `check_stats_drift`, que muestrea solo **30 users al azar ~diario** y chequea `uqh_v2` por **row-count** (no por `total_attempts`). NO cazó el freeze de 14h de 5 tablas materializadas del 03/06 (corrió durante y no vio nada). Esa clase de fallo —pipeline outbox→handler congelado o escribiendo mal— la cubren ahora 3 alert-rules/canary dedicados: `materialized_stats_stale` (frescura), `stats_paridad_divergence` (correctitud en vivo) y el canary `canary-stats-pipeline` (e2e 24/7). Si sospechas stats materializadas mal, NO te fíes solo de este card: mira esos 3. Detalle: `[[project_incidente_outbox_cutover_a_medias_03_06]]`.
4. **Latencia INSERT test_questions** (mean histórico desde pg_stat_statements, incluye RTT cliente→pooler→DB) — verde <80ms, ámbar ≥80ms, rojo ≥250ms. Baseline actual (post-DROP de 2 NO-OPs el 23/05/2026): ≈44ms. El INSERT puro dentro de la BD es ~1.5ms p50 — la diferencia es RTT.
5. **Cron de drift vivo** — verde <26h sin correr, ámbar 26-36h, rojo >36h.
6. **Integridad exámenes 24h** — verde 0, ámbar ≥1, rojo ≥5. Nº de exámenes `is_completed` (`test_type='exam'`) a los que les faltan >5% de filas en `test_questions` respecto a `total_questions`. Clase de bug de Rosa (07/06/2026): el examen se marca completado con score/total correctos pero el detalle por-pregunta no se persiste (saves perdidos bajo carga) → `/revisar` sale vacío en silencio. Se alimenta del cron `check-exam-integrity` (04:30 UTC diario), que emite `exam_integrity_drift` a `observable_events` solo si hay afectados.
   - **Fix de raíz (08/06/2026):** `/api/exam/validate` ahora persiste todas las filas en bloque (1 UPSERT idempotente) en vez de ~50 saves fire-and-forget. Commits `e52b91fa` + `c19c6901`.
   - **⚠️ Baseline post-deploy:** el histórico PRE-fix tiene exámenes con filas faltantes; tardan ~24h en salir de la ventana tras el deploy del 08/06. Un pico el primer día NO es regresión. Tras 24h, cualquier afectado nuevo SÍ indica que el bulk-write de validate se rompió.
   - **⚠️ Punto ciego:** si el cron muere, no emite eventos → verde falso (mismo patrón que drift). Verificar que el workflow `check-exam-integrity.yml` corre.
   - Query manual: `SELECT t.id, t.total_questions, count(tq.id) AS filas FROM tests t LEFT JOIN test_questions tq ON tq.test_id=t.id WHERE t.test_type='exam' AND t.is_completed AND t.completed_at >= now()-interval '24 hours' AND t.total_questions>0 GROUP BY t.id HAVING count(tq.id) < t.total_questions*0.95 ORDER BY (t.total_questions-count(tq.id)) DESC;`

> Nota — Hasta 31/05/2026 los indicadores (1) y (2) estaban fusionados en un único card "Errores 5xx" que filtraba sólo por `severity=critical`. Eso metía los Watchdog (`http_status=null` pero `severity=critical`) en el mismo bucket que los 5xx servidor, distorsionando el verdict. La acción ante ámbar/rojo es distinta en cada caso (logs Fargate/Vercel vs pool BD + antifraud + topic-progress cold path), así que viven separados.

Además del bloque CRÍTICOS, mirar SIEMPRE (añadidos 05/07/2026 — cerraron un gap grande: el panel era **server-céntrico** y no veía el dolor real del usuario):

7. **🖥️ Errores de cliente** (sección OBSERVABILIDAD) — errores capturados IN-HOUSE en el navegador (Sentry se retiró): `unhandled_error`, `unhandled_rejection`, `react_error_boundary`, `client_error`, `http_5xx`/`http_4xx`/`http_network_error` (fetch del navegador), `chunk_load_error`. Verde <100, ámbar ≥100, rojo ≥500. **CLAVE:** el servidor puede decir 0 5xx y el panel/monitor "verde" mientras los clientes sufren (p.ej. **502 de `/api/auth/token`** = error de EDGE que el servidor no registra). Mirar el breakdown por `event_type` + `topEndpoint`.
8. **🧯 Todas las señales error/warn (catch-all, sin gaps)** — tabla con TODA señal error/warn de `observable_events` agrupada. Garantía por diseño: **nada capturado queda oculto**, ni tipos futuros. Las filas **benignas** (auth, forbidden, scraping, request_completed…) van en gris y no cuentan; las **accionables** (coloreadas por volumen) son las que investigar. Si aparece una accionable con volumen alto que no reconoces → sección 2.

Si CRÍTICOS + errores de cliente + catch-all están en verde, no hay fuego activo. Tarea cerrada en 30 segundos.

Si alguno está ámbar o rojo, ir a la sección 2 con esa pista.

### 1.bis — Volumen de alertas / emails enviados (fatiga de alertas)

**Cuándo:** SIEMPRE que se pida la salud ("dame la salud de la última hora", "busca errores", "hay fuego"). Si Manuel recibe **muchos** `[Vence CRITICAL]` en el correo, eso ES un síntoma: las alertas ruidosas ahogan las reales (alert-fatigue). Revisar **qué se está emitiendo y con qué frecuencia**, no solo si hay errores.

> ⚠️ **Contra RDS, NO Supabase.** El cliente `@supabase/supabase-js` apunta al Supabase CONGELADO (backup, datos viejos) tras el cutover a RDS del 04/07. Usar SIEMPRE `postgres`/`pg` con `DATABASE_URL` (que ya es RDS en `.env.local`).

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async()=>{
  const rows = await sql\`SELECT severity, event_type, count(*)::int n FROM observable_events WHERE ts >= NOW()-INTERVAL '24 hours' AND severity IN ('critical','error','warn') GROUP BY 1,2 ORDER BY 3 DESC\`;
  const total = rows.reduce((a,r)=>a+r.n,0);
  console.log('alertas 24h:', total);
  rows.forEach(r=>console.log('  '+String(r.n).padStart(4)+'  '+r.severity+' | '+r.event_type));
  await sql.end();
})();
"
```

**Lectura:**
- **Cualquier `event_type` con conteo desproporcionado (>~30/día) = candidato a recalibrar**, no a seguir emitiendo. La alerta debe agrupar/dedup (cooldown) o subir el umbral. El objetivo NO es 0 alertas — es que cada email signifique algo accionable.
- Spammers conocidos (2026-06): **`http_traffic_drop` ("Tráfico HTTP cayó X%")** dispara cada ~30-60 min sobre variación normal de tráfico → recalibrar umbral/ventana; y **`tts_error`** (238/24h en un muestreo) = error recurrente real a investigar, no a silenciar.
- **⚠️ Antes de declarar spammer a una regla, MIRA POR DÍA, no por ventana corrida (T-258, 29/07/2026).** Una ventana de 36 h mezcla el día de antes del arreglo con el de después y acusa a quien ya está arreglado: así `event_loop_lag` parecía el segundo spammer con 35 disparos cuando venía de 44-67/día (25-27/07) y el 28/07 ya iba por **3** — [T-160] había funcionado. La consulta correcta agrupa por `date_trunc('day', ts)` y compara los avisos con los EVENTOS que los provocan.
- **Cooldown persistido (T-258, 29/07/2026) — el motor ya no reabre el grifo al reiniciarse.** `AlertsCron` guardaba `lastFiredAt` en memoria del proceso, así que cada deploy borraba los cooldowns; la firma en los datos son disparos fuera de cadencia (dos del canary de PDFs a **7 segundos**). Ahora se hidrata por tick desde los propios `alert_fired` (`backend/src/alerts/alert-cooldown.ts`), lo que además lo hace correcto con varias instancias sin Redis. **Fail-open**: si la consulta falla se usa el Map en memoria (comportamiento anterior). El silencio se mide en el `cron_run` del motor (`rulesSkippedByPersistedCooldown`, `cooldownHydrated`) — si una regla deja de avisar, ahí se ve si es que no dispara o que está callada a propósito.
- **Regla crónica ⇒ cooldown de 24 h, no de 1 h.** Una alerta `critical` que avisa cada hora de una avería **ya fichada y bloqueada** no acelera el arreglo: entierra las que sí importan. `canary_pdf_queue_failed` mandaba **~28 correos/día** por [T-159] (cola de PDFs sin consumidor, parada por la cuota de vCPU) → `cooldownMin: 1440`. Cuando la causa se cierre, se devuelve a su cadencia normal. **Medir antes de tocar**: `node scripts/alerts/sim-cooldown-persistido.cjs --dias 7` compara los correos reales con los que mandaría el código actual (7 días: 497 → 347, **150 evitados**) y no escribe nada.
- **`client_edge_sustained` ("Errores de cliente sostenidos — X/h") — RECALIBRADO 2026-07-08.** Disparaba cada hora (cooldown 60m) porque sumaba `http_network_error` (baseline benigno ~100-120/h de móviles en background) con un umbral único de 80/h → el ruido cruzaba solo y ahogaba el 502 real (~8/h). Fix: separar signals — edge 5xx/timeout ≥30/h (accionable) O avalancha de red ≥500/h (outage). Además el cliente ahora suprime `http_network_error` durante unload/background (raíz del ruido). Regla mental: **network_error solo, por muy alto que sea bajo ~500/h, NO es accionable** (conectividad de cliente); el signal accionable es el edge 5xx. Detalle: §3 incidente 08/07.
- **`pool_hung_clientread` ("Pool: N muestras con conexiones colgadas en ClientRead") — RECALIBRADO 2026-06-12.** Disparaba un CRITICAL cada ~30 min (cooldown) sobre el goteo residual del path `getDb()`/Supavisor (raíz en `[[project_supavisor_zombie_conn_root_cause]]`, se cierra del todo con RDS). El piso de conn-min no bastaba: 2-3 conns sostenidas durante 5 muestras acumulan ~10-15 conn-min y lo cruzaban, pero el **pico simultáneo** (`maxHung`) nunca pasó de 3 en 24h reales y el pool frontend nunca rozó su techo. Fix: gate `maxHung >= 5` (`POOL_HUNG_MIN_PEAK`) además del piso — **pico ≤3 = goteo residual, NO dispara**; una cascada real satura muchas conns a la vez (pico ≫5) y sí dispara, además cubierta en paralelo por `canary_db_pool` + `pool_frontend_saturation` + `5xx_spike`. Regla mental: en este detector, **mira el pico simultáneo, no el conn-min acumulado** — el conn-min confunde "pocas conns mucho rato" (residual) con "muchas un instante" (real).
- **`cron_overdue` ("1 cron overdue") — FIX DE FONDO 2026-06-12.** Falso positivo auto-resuelto: `detect-oep-llm` (escaneo LLM, ~30 min) emitía su `cron_run` **al completar**, pasado el margen de 30 min de su tick de las 10:00 → la regla lo veía overdue durante toda la ejecución y disparaba, curándose al terminar. Causa: la regla medía "¿terminó el job?" en vez de "¿disparó el scheduler?", y el cap de margen asumía (falsamente) que "el cron más pesado tarda ~3.4 s". Fix profesional (no parche de margen por-cron, que reintroduciría el mapa hardcoded que la regla presume de haber eliminado): se emite un evento **`cron_tick` al ARRANCAR** el tick desde el wrapper compartido `runWithHeartbeat` (opt-in vía opts: `{ name, observability }`), y `cron_overdue` lee `cron_tick` ∪ `cron_run` (`MAX(ts)` de ambos). Así cualquier cron —de 3 s o de 30 min— se juzga por si disparó, sin config por-cron. El heartbeat in-memory del `HeartbeatRegistry` NO se tocó (sigue marcándose al completar, para no regresar su detección de cuelgue). **Los 32 crons `@Cron` migrados** (todos emiten `cron_tick`); `outbox-processor` se excluye a propósito (es `@Interval` cada 5 s, no lo vigila `cron_overdue`, y un tick cada 5 s saturaría `observable_events`). **NO se añade regla `cron_stuck`**: la detección de cron colgado ya existe y es superior a un email — `HeartbeatRegistry` (`thresholdMs` por-cron) → `/health/crons` (503 si alguno supera su umbral) → la ECS liveness probe **mata y relanza el container** (auto-recovery). Una alert-rule paralela sería redundante y añadiría superficie de falsos positivos.
#### 1.bis.a — Desglosar `alert_fired` POR REGLA + liveness de TODOS los crons (OBLIGATORIO)

> **Por qué (incidente 22/07/2026):** §1.bis agrupa por `event_type`, así que **todas** las alertas
> caen en UN bucket (`133 critical alert_fired`) y se pasan por alto. Y el veredicto de §1 solo vigila
> el cron de *drift*. Resultado: se declaró salud verde con 44 `[Vence CRITICAL]` en la bandeja y un
> cron parado 2 días. Hay que abrir las dos cosas SIEMPRE.

1. **`alert_fired` GROUP BY `metadata->>'rule'`** (24h) — es literalmente lo que llega al correo de
   Manuel. Cada regla con conteo alto es o un fuego real o una regla mal calibrada; las dos cosas
   se atienden, ninguna se ignora.
2. **Liveness de crons.** ⚠️ **NO usar un umbral plano de 26h**: la mitad de los crons son semanales
   (`0 9 * * 1`), en martes (`30 4 * * 2`) o L-V (`0 8 * * 1-5`), así que un `max(ts)` de 166h puede
   ser perfectamente sano un lunes por la mañana. Comparar SIEMPRE contra la expresión real:
   `grep -rn "@Cron(" backend/src --include=*.cron.ts`. Un L-V visto en lunes a las 07:00 lleva
   legítimamente ~71h sin correr (viernes 08:00 → hoy). La regla `cron_overdue` ya hace esto bien
   (lee `SchedulerRegistry` + `cron-parser`): **si ella no lo marca, probablemente está sano**.
2.bis **Y un cron que corre y FALLA no es un cron overdue — son cuatro preguntas distintas** (T-307,
   30/07/2026). Las reglas cubren cada una y conviene saber cuál te ha llegado:

   | pregunta | regla |
   |---|---|
   | ¿disparó el scheduler? | `cron_overdue` |
   | ¿terminó lo que arrancó? | `cron_started_not_finished` |
   | ¿está fallando en ráfaga? (≥3 en 1 h) | `cron_failure_burst` |
   | **¿corre, termina y termina MAL, tick tras tick?** | **`cron_sin_exito`** |

   La cuarta faltaba y el hueco no era teórico: `cron_failure_burst` exige **3 fallos en una hora**, un
   listón que un cron **diario** no alcanza jamás. `content-health-sweep` falló el 29 y el 30/07 con
   `cron_run` en `error` las dos veces y **ninguna regla dijo nada**. `cron_sin_exito` dispara cuando el
   último intento falló y no hay un solo éxito en **dos ticks** del propio cron (suelo de 90 min), con la
   guarda de que el cron tenga costumbre de anunciar éxito (≥3 en 30 d) — sin ella marcaría a la familia
   que solo emite `cron_run` al fallar. Calibrada contra los 53 endpoints reales: **1 disparo (el roto),
   0 falsos positivos**; se puede re-medir con `npm run sim:cron-sin-exito`.

   **Punto ciego ASUMIDO:** un cron que **nunca** ha tenido éxito (recién nacido y roto) queda fuera por
   esa misma guarda. Medido el 30/07: ninguno en esa situación.

   **Y lo que hay que mirar SIEMPRE cuando un cron falla: qué alimenta.** Lo que depende de un cron roto
   no se queda vacío — se queda con **el último dato bueno**, que a ojo humano es idéntico a un dato de
   hoy. El sweep de contenido dejó de escribir el 29/07 y el panel siguió enseñando el snapshot del 28
   como si fuera de hoy, badge tranquilo incluido. Desde T-307 el propio barrido lo canta con el hallazgo
   **`sweep_incompleto`** (app/error) cuando se corta a mitad, y el `cron_run` sale con `status: partial`.
3. **Para un cron que SÍ está overdue**, distinguir 3 causas con los logs de arranque
   (`aws --profile vence --region eu-west-2 logs filter-log-events --log-group-name /ecs/vence-backend
   --filter-pattern '"<nombre-cron>"'`):
   - **(1) retirado a propósito** → el boot loguea `… RETIRADO … Reactivar con XXX_ENABLED=true` y
     `… des-registrado del SchedulerRegistry`. Entonces `cron_overdue` NO debería verlo; si lo ve,
     **comprobar el env var en la task def viva**, no solo el default del código:
     `aws ecs describe-task-definition --task-definition vence-backend:<rev> | grep -A2 XXX_ENABLED`.
     Caso real 27/07: `check-seguimiento` estaba retirado por código desde el 20/07 pero alguien puso
     `CHECK_SEGUIMIENTO_ENABLED=true` en la task def el 26/07 → volvió a registrarse y el
     `cron_overdue` era **verdadero positivo** (habilitado y sin correr desde el 20/07), no el falso
     positivo que decía la nota anterior.
   - **(2) roto** → fix real.
   - **(3) el task no estaba vivo al tick** → si a esa misma hora OTROS crons SÍ dispararon, se
     descarta; si no disparó ninguno, mirar deploys/reinicios de ECS a esa hora.
   - **(4) es un job EXTERNO que no llegó a ARRANCAR** → el email lo marca como
     `⚠️ job EXTERNO` y `metadata.externalOverdue` lo lista. **No busques logs: no los hay.**
     Un contenedor programado que muere antes del entrypoint (imagen que ya no existe en el
     registry, credenciales, scheduler apagado) no escribe ni una línea. Comprobar, por ese
     orden: (a) que el scheduler sigue activo y con la cadencia del catálogo, (b) que la
     **imagen que su task def pinea TODAVÍA EXISTE** — es la causa del incidente 27→29/07 —,
     (b2) si existe, que es **la imagen correcta**: la del stage propio de la tarea, no la del
     frontend (`runner` no lleva devDependencies → `Cannot find module … tsx`; se distingue
     porque la tarea SÍ arranca y muere en el entrypoint, dejando logs),
     (c) las tareas paradas recientes y su `stoppedReason`:
     `aws --profile vence --region eu-west-2 ecs list-tasks --cluster vence-backend --family <familia> --desired-status STOPPED`
     → `describe-tasks` y leer `stoppedReason` (`CannotPullContainerError` = imagen purgada).
     Catálogo de estos jobs: `backend/src/cron-schedule/external-jobs.registry.ts`.

> **§1.bis.b — Jobs programados FUERA del proceso del backend (añadido 29/07/2026)**
>
> `cron_overdue` enumeraba solo los `@Cron` in-process (vía `SchedulerRegistry`), así que un job
> con su propio contenedor programado **no tenía liveness ninguna**. El worker de PDFs
> (`temario-pdf-worker`) estuvo **2 días muerto** sin una sola alerta: su imagen fue purgada de ECR
> por la retención de "últimas 10 imágenes" y cada invocación moría en el pull. El único síntoma
> fue `canary_pdf_queue_failed` quejándose de un backlog que envejecía — que **apunta al sitio
> equivocado**: la cola no estaba atascada, el consumidor no existía.
>
> **Regla mental:** un job que muere antes de arrancar no puede avisar de su propia muerte. La
> única señal posible es la AUSENCIA de señal frente a una cadencia declarada. Por eso estos jobs
> se declaran en `external-jobs.registry.ts` (nombre + cadencia, **agnóstico de proveedor**) y
> emiten el mismo contrato que los in-process: `cron_tick` al arrancar, `cron_run` al terminar.
> Se juzgan con la MISMA regla `cron_overdue` y salen en el mismo email.
>
> **Si un canary se queja de un backlog que no drena, comprueba PRIMERO que su consumidor está
> corriendo** antes de dar por hecho que el trabajo está atascado.
>
> ---
>
> **§1.bis.b.2 — CON FASE vs POR INTERVALO: declarar mal la cadencia genera un CRITICAL diario
> contra un job SANO (T-263, 29/07/2026).**
>
> El mismo día que se creó el catálogo, `temario-pdf-worker` se declaró con una expresión cron de
> cada 30 min —fase :00 y :30— cuando su scheduler es un **`rate(30 minutes)`, que NO compromete
> hora de reloj**: sus ticks reales caían a :20 y :50. `cron_overdue` comparaba el último tick
> contra el tick de calendario menos un margen del 20 % (6 min para 30), así que un desfase
> constante de 20 min lo marcaba overdue **en cada ventana**: 4 CRITICAL en un día contra un worker
> que estaba drenando la cola sin un fallo (verificado: `cron_tick` cada 30 min puntual y un PDF
> completado cada ~3 min).
>
> **Cómo se diagnostica en 1 minuto** — si `cron_overdue` señala un job pero el job parece vivo,
> mira la FASE de sus ticks reales antes de tocar nada:
> ```sql
> SELECT ts, EXTRACT(MINUTE FROM ts)::int % 30 AS fase
> FROM observable_events
> WHERE endpoint = '<job>' AND event_type IN ('cron_tick','cron_run')
> ORDER BY ts DESC LIMIT 10;
> ```
> Una `fase` constante distinta de 0 con una cadencia declarada `*/30` = declaración equivocada,
> no avería. **El job está sano; lo que está roto es lo que se dijo de él.**
>
> **Regla mental:** *cada N minutos* y *a las :00 y :30* no son lo mismo. Un `rate()` se declara
> `cadence: 'interval'` + `everyMinutes`; solo lo que el proveedor garantiza a hora fija se declara
> `cadence: 'phase'` + expresión cron. El guardarraíl compara la forma declarada con el programador
> que documenta `runner`, así que una entrada que se contradiga a sí misma ya no pasa CI.
>
> **Antes de cambiar la calibración de una alerta, MÍDELO** contra los ticks reales — nunca a ojo:
> ```bash
> npm run sim:cadencia-cron -- --dias 7 [--job <nombre>]
> ```
> No escribe nada: reproduce la decisión con el `findOverdueCrons` REAL (no una copia) cambiando
> solo el catálogo, y contrasta con los `alert_fired` que de verdad se mandaron.

#### 1.bis.c — La POLÍTICA DE EMAIL del canal: por qué un aviso puede no llegar al buzón (T-272, 30/07/2026)

> **El diagnóstico que la motivó:** 392 correos en 7 días (**56/día**) para **28 problemas
> distintos** = **14 correos por problema**. El canal no estaba inundado de fallos: estaba inundado
> de REPETICIONES. Y el mecanismo era estructural, no una regla mal puesta: el único silencio era
> `cooldownMin`, fijo y corto (20-60 min en las ruidosas). Ante una avería **crónica** —que dura
> días— un cooldown de 20 min no frena, marca cadencia: 72 correos/día. El correo nº 50 del mismo
> problema pesaba igual que el primero.

**Disparar ≠ mandar correo.** Son dos decisiones. El cooldown gobierna el disparo; el correo lo
decide `backend/src/alerts/email-policy.ts` (núcleo puro, 29 tests) en tres capas:

| capa | qué hace | dónde se configura |
|---|---|---|
| **Severidad mínima** | qué severidades llegan al buzón | env `ALERT_EMAIL_MIN_SEVERITY` (default del CÓDIGO: `critical`) |
| **Backoff por problema** | mismo `(regla, fingerprint)`: inmediato → 1 h → 6 h → **1/día** mientras siga | `BACKOFF_CURVE_MIN` |
| **Agrupación por tick** | los supervivientes del mismo tick (5 min) viajan en **un** correo | `EmailNotificationAdapter` |

> ### ⚙️ CONFIGURACIÓN VIVA EN PRODUCCIÓN (30/07/2026): `ALERT_EMAIL_MIN_SEVERITY=warn`
>
> **El default del código es `critical`, pero producción NO corre con el default.** Está declarada
> explícitamente en el task def del backend (`vence-backend:139` en adelante, sección `environment`;
> es una env var normal, NO un secret de SSM — no es un dato sensible y pasarla por SSM obligaría a
> tocar la allowlist del rol de ejecución sin ganar nada).
>
> **Por qué se decidió así, con el dato delante:** el filtro de severidad solo aportaba **3,7
> correos/día** de ahorro (el backoff hace el 90 % del trabajo) y a cambio dejaba **18 de 28
> problemas sin avisar nunca**. Lo que cerró la decisión fue el **primer disparo real tras el
> deploy**: `premium_sin_respaldo` —el detector de *premium que nadie paga*, estrenado en ese mismo
> deploy— salió con `emailed=false, emailSkipped=severity`. Un agujero de ingresos, mudo el día de
> su estreno. Ver [T-300].
>
> **Consecuencia para quien diagnostique:** hoy `error` y `warn` SÍ llegan al correo. Si alguien
> vuelve a poner `critical`, que sea con el simulador delante y sabiendo a quién calla.
> **Comprobar qué corre de verdad** (no fiarse ni de este párrafo ni del default del código):
> ```sql
> SELECT ts, metadata->>'emailMinSeverity', metadata->>'emailHistoryHydrated'
> FROM observable_events WHERE endpoint='alerts-engine' AND event_type='cron_run'
> ORDER BY ts DESC LIMIT 1;
> ```

Medido con `npm run sim:fatiga-email -- --dias 7`: con el mínimo en `critical`, **393 disparos → 35
correos (56 → 5,0/día, −91 %)**; con el mínimo en `warn` —lo que corre hoy— **61 correos (8,7/día,
−84 %)** y ningún problema mudo. El backoff aporta 318 de los 353 ahorrados; la severidad, 40.

**Lo que NO hace, y hay que tenerlo claro al diagnosticar:**
- **No silencia la señal, solo el correo.** El `alert_fired` se escribe siempre, con `emailed`,
  `emailSkipped`, `emailStreak` y `emailNextInMin` dentro. Si se suprimiera el disparo, el panel
  dejaría de ver que el problema sigue vivo: el modo de fallo de [T-162].
- **Ningún problema se queda mudo por el backoff.** Un `fingerprint` nuevo avisa YA; el backoff solo
  retrasa repeticiones, y la racha se reinicia tras 48 h de silencio.
- **La severidad SÍ puede dejar mudo a un problema** — por eso producción corre en `warn` (ver el
  recuadro de arriba). Con el mínimo en `critical`, 18 de los 28 problemas medidos dejan de
  emailear. Para las reglas cuyo significado es
  *la app está rota / nadie puede desplegar* existe `emailAlways: true` en la regla (hoy solo
  `main_ci_rojo`: es `error` pero bloquea a todo el mundo, y su coste medido es 1 disparo en 7 días).
  **`emailAlways` no exime del backoff.**

**Si Manuel dice "me llegan muchos correos" — el orden correcto:**
1. `alert_fired` **por día y por regla** (no por ventana corrida: mezcla el día de antes del arreglo
   con el de después y acusa a quien ya está arreglado, ver el aviso de T-258 arriba).
2. Contar **correos**, no disparos: `count(*) FILTER (WHERE metadata->>'emailed' = 'true')`.
3. `npm run sim:fatiga-email -- --dias 7` — dice qué regla pesa y qué pasaría al mover la política.
   **Nunca cambiar la curva, la severidad mínima ni añadir un `emailAlways` sin medirlo antes.**
4. Y mirar el `cron_run` de `alerts-engine`: `emailsSent`, `emailAlertsBatched`,
   `emailsSkippedBySeverity`, `emailsSkippedByBackoff`, `emailHistoryHydrated`. **Sin estas cifras,
   "hoy me llegan menos correos" no se distingue de "el canal está roto y no manda nada."**

⚠️ **Gotcha de diseño que costó un test (no repetir el razonamiento):** el reinicio de racha tiene
que ser **estrictamente mayor** que el último escalón de la curva. Con los dos a 1440 el backoff
**se desarma solo**: la avería crónica manda su correo diario, ese hueco de 24 h cuenta ya como
"silencio", la racha vuelve a 0 y el siguiente correo sale a la hora (9 correos en 3 días donde
debían salir 4-6). Por eso el reinicio son 48 h. Hay test que fija la relación.

⚠️ Y el gotcha de método: la primera versión del simulador llevaba **la curva copiada** del núcleo,
y por eso NO vio ese defecto. Las simulaciones de este repo importan el detector REAL — una copia
miente en cuanto divergen.

- Cruzar con la bandeja `[Vence CRITICAL]`: si un tipo domina el correo pero es un blip transitorio, **recalibrar la alert-rule** (ver `backend/src/alerts/alert-rules.ts` + `[[project_supavisor_zombie_conn_root_cause]]` para el precedente de recalibración pool/canary).
- Un `event_type` que **desaparece** de golpe (p.ej. geo fill-rate a 0) también es señal — lo cubre el framework de calidad de datos (§ roadmap obs).

---

Por Claude (CLI, cuando el humano pide "busca errores"):

Ejecutar el bloque siguiente y reportar el resumen al usuario. **No leer Sentry directamente — sus eventos llegan a validation_error_logs vía withErrorLogging y los ves más rápido por SQL que por la UI de Sentry.**

> **Sub-categorización admin vs user-facing (2026-06-01).** El verdict separa errores en `/api/admin/*`, `/api/cron/*`, `/api/debug/*`, `/api/verify-articles/*`, `/api/armando/*`, `/api/v2/admin/*`, `/api/health/*` (admin/infra, umbrales relajados ámbar≥5 / rojo≥20) del resto (user-facing, umbrales estrictos ámbar≥1 / rojo≥5). Sin esto, 13 errores en una herramienta interna disparaban ROJO sin afectar UX (incidente 2026-06-01). **Fuente de verdad de la lista**: `lib/api/admin/endpoint-classification.ts`. El bloque bash de abajo duplica los patrones manualmente porque Node desde shell no puede importar TS — si añades un patrón nuevo al módulo TS, actualizar también `ADMIN_PATTERNS` aquí.

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

(async () => {
  const since = new Date(Date.now() - 24*3600*1000).toISOString();

  // Identificar el deploy actual: el más frecuente entre eventos recientes.
  // Sirve para distinguir 'errores del deploy actual' vs 'errores históricos
  // de incidentes ya resueltos pero que aún caen en la ventana de 24h'.
  const deployRow = await sql\`
    SELECT deploy_version FROM validation_error_logs
    WHERE created_at >= NOW() - INTERVAL '2 hours' AND deploy_version IS NOT NULL
    GROUP BY deploy_version ORDER BY COUNT(*) DESC LIMIT 1
  \`;
  const currentDeploy = deployRow[0]?.deploy_version ?? null;

  // 1) Errores 5xx 24h — separa por deploy_version + sub-categoriza admin vs user-facing
  // - 'current' = ocurridos en el deploy actual (fuego activo)
  // - 'legacy'  = ocurridos en deploys anteriores (histórico)
  // - admin/infra endpoints (umbrales relajados): /api/admin/*, /api/cron/*,
  //   /api/debug/*, /api/verify-articles/*, /api/armando/*, /api/v2/admin/*,
  //   /api/health/* (probes ALB/ECS) — Fuente de verdad: lib/api/admin/endpoint-classification.ts
  const ADMIN_PATTERNS = [
    /^\\/api\\/admin(\\/|$)/,
    /^\\/api\\/v2\\/admin(\\/|$)/,
    /^\\/api\\/cron(\\/|$)/,
    /^\\/api\\/debug(\\/|$)/,
    /^\\/api\\/verify-articles(\\/|$)/,
    /^\\/api\\/armando(\\/|$)/,
    /^\\/api\\/health(\\/|$)/,
  ];
  const classify = (ep) => ADMIN_PATTERNS.some(p => p.test(ep || '')) ? 'admin' : 'user_facing';

  const errs = await sql\`
    SELECT endpoint, error_type, deploy_version, COUNT(*)::int AS n
    FROM validation_error_logs
    WHERE severity = 'critical' AND created_at >= \${since}
      AND http_status >= 500
    GROUP BY endpoint, error_type, deploy_version
    ORDER BY n DESC LIMIT 30
  \`;
  const errsCurrent = errs.filter(e => e.deploy_version === currentDeploy);
  const errsLegacy = errs.filter(e => e.deploy_version !== currentDeploy);
  const totalCurrent = errsCurrent.reduce((a,r) => a + Number(r.n), 0);
  const totalLegacy = errsLegacy.reduce((a,r) => a + Number(r.n), 0);
  // Sub-totales por categoría — solo deploy actual
  const totalCurrentUser = errsCurrent
    .filter(e => classify(e.endpoint) === 'user_facing')
    .reduce((a,r) => a + Number(r.n), 0);
  const totalCurrentAdmin = errsCurrent
    .filter(e => classify(e.endpoint) === 'admin')
    .reduce((a,r) => a + Number(r.n), 0);

  // 2) Drift 24h con drift_pct > 5 — excluye markers técnicos
  // (__cron_run__ tiene stored/fresh con semántica distinta y produce
  // drift_pct artificialmente alto que NO es bug — es ruido del filtro)
  const drifts = await sql\`
    SELECT target_table, field_name, COUNT(*)::int AS n, MAX(drift_pct) AS max_pct
    FROM stats_drift_log
    WHERE checked_at >= \${since} AND drift_pct > 5
      AND target_table NOT IN ('__cron_run__', '__exception__')
    GROUP BY target_table, field_name
    ORDER BY n DESC LIMIT 10
  \`;

  // 3) Latencia INSERT (top variante por calls)
  const lat = await sql\`SELECT * FROM v_insert_test_questions_latency ORDER BY calls DESC LIMIT 1\`;

  // 4) Último run del cron de drift — usa el marker '__cron_run__' (la
  // función SQL lo inserta al final de cada ejecución, garantiza
  // liveness check incluso si no hay drift real detectado).
  const cron = await sql\`SELECT MAX(checked_at) AS last_run FROM stats_drift_log WHERE target_table='__cron_run__'\`;
  const lastRun = cron[0].last_run;
  const staleH = lastRun ? (Date.now() - new Date(lastRun).getTime()) / 3600000 : null;

  console.log('Deploy actual:', currentDeploy ?? '(desconocido)');
  console.log();
  console.log('1) Errores 5xx 24h en deploy actual:', totalCurrent,
    '(user-facing: ' + totalCurrentUser + ', admin: ' + totalCurrentAdmin + ')');
  if (errsCurrent.length) for (const e of errsCurrent) console.log('   -', '[' + classify(e.endpoint) + ']', e.endpoint, e.error_type, '×', e.n);
  console.log('   (informativo) Errores 5xx 24h en deploys anteriores:', totalLegacy);
  if (errsLegacy.length) for (const e of errsLegacy.slice(0,5)) console.log('     -', e.endpoint, e.error_type, '×', e.n, '[' + (e.deploy_version || '?') + ']');

  console.log('\\n2) Drift >5% real (24h, excluyendo markers):', drifts.reduce((a,r) => a + Number(r.n), 0));
  if (drifts.length) for (const d of drifts) console.log('   -', d.target_table, d.field_name, '×', d.n, 'max', d.max_pct, '%');

  console.log('\\n3) INSERT test_questions:');
  if (lat[0]) console.log('   mean=' + lat[0].mean_ms + 'ms proxy_p95=' + lat[0].proxy_p95_ms + 'ms max=' + lat[0].max_ms + 'ms calls=' + lat[0].calls);

  console.log('\\n4) Cron drift último run:', lastRun, staleH != null ? '(hace ' + staleH.toFixed(1) + 'h)' : '');

  // Verdict — basado en errores del deploy actual, sub-categorizados:
  //   - user-facing: ámbar ≥1, rojo ≥5 (cualquier error afecta a UX)
  //   - admin:       ámbar ≥5, rojo ≥20 (bajo tráfico, ocasional aceptable)
  // El verdict final es el PEOR de las 2 sub-categorías + drift + latencia.
  const stale = staleH === null || staleH > 36;
  const userFire = totalCurrentUser >= 5;
  const adminFire = totalCurrentAdmin >= 20;
  const userWarn = totalCurrentUser >= 1;
  const adminWarn = totalCurrentAdmin >= 5;
  const fire = userFire || adminFire || drifts.length >= 5 || (lat[0] && Number(lat[0].mean_ms) >= 250) || stale;
  const warn = userWarn || adminWarn || drifts.length >= 1 || (lat[0] && Number(lat[0].mean_ms) >= 80) || (staleH != null && staleH > 26);
  console.log('\\nVeredicto:', fire ? '🔴 ROJO — atender ya' : warn ? '🟡 ÁMBAR — investigar' : '🟢 VERDE — todo OK');
  if (userFire || adminFire) {
    console.log('  - user-facing: ' + (userFire ? '🔴 ROJO' : userWarn ? '🟡 ÁMBAR' : '🟢') + ' (' + totalCurrentUser + ' errores, umbral rojo ≥5)');
    console.log('  - admin:       ' + (adminFire ? '🔴 ROJO' : adminWarn ? '🟡 ÁMBAR' : '🟢') + ' (' + totalCurrentAdmin + ' errores, umbral rojo ≥20)');
  }
  if (totalLegacy > 0 && !fire && !warn) {
    console.log('(Hay', totalLegacy, 'errores legacy de deploys anteriores en ventana 24h — informativo, no cuenta para verdict)');
  }

  await sql.end();
})();
"
```

Reportar el output al usuario. Si veredicto es rojo o ámbar, ir a sección 2.

### 1.ter — Errores de CLIENTE + catch-all (RDS) — OBLIGATORIO (añadido 05/07/2026)

El bloque anterior solo ve **5xx de servidor**. Desde que la captura de errores de cliente es 100% in-house (Sentry retirado), hay que mirar SIEMPRE el **dolor real del usuario** — el servidor puede decir "0 5xx" mientras los clientes sufren (p.ej. **502 de edge** que el servidor no registra). Ejecutar y reportar:

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
// ⚠️ Esta lista es COPIA de lib/observability/benignSignals.ts (fuente única; el guardarraíl
// __tests__/guardrails/senalesBenignasParidad.test.ts falla si divergen). NO editar aquí sin editar allí.
const BENIGN = new Set(['request_completed','auth','forbidden','rate_limit','scraping_challenge_shown','scraping_force_challenge_set','react_hydration_mismatch','external_heartbeat_skipped','console_warn','tts_session_end','custom','test_size_shortfall','browser_extension_error']);
(async () => {
  const cli = await sql\`SELECT event_type, count(*)::int n, mode() WITHIN GROUP (ORDER BY COALESCE(endpoint,'')) top FROM observable_events WHERE source='frontend' AND severity IN ('error','warn') AND ts >= NOW()-INTERVAL '1 hour' GROUP BY 1 ORDER BY 2 DESC\`;
  console.log('=== Errores de CLIENTE (1h) — capturados in-house ===');
  cli.forEach(r=>console.log('  '+String(r.n).padStart(4)+' '+r.event_type+' ['+r.top+']'));
  const all = await sql\`SELECT source, event_type, count(*)::int n, mode() WITHIN GROUP (ORDER BY COALESCE(endpoint,'')) top FROM observable_events WHERE severity IN ('error','warn') AND ts >= NOW()-INTERVAL '1 hour' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 40\`;
  const action = all.filter(r=>!BENIGN.has(r.event_type));
  console.log('\\n=== Señales ACCIONABLES (catch-all, no benignas, 1h) ===');
  action.forEach(r=>console.log('  '+String(r.n).padStart(4)+' '+r.source+' '+r.event_type+' ['+r.top+']'));
  const edge = await sql\`SELECT endpoint, metadata->>'status' st, count(*)::int n FROM observable_events WHERE source='frontend' AND event_type='http_5xx' AND ts>=NOW()-INTERVAL '1 hour' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 8\`;
  if (edge.length) { console.log('\\n=== http_5xx de cliente por endpoint+status ==='); edge.forEach(r=>console.log('  '+String(r.n).padStart(4)+' status='+r.st+' '+r.endpoint)); }
  await sql.end();
})();
"
```

**Interpretación:**
- Si dominan **502 en `/api/auth/*`** (o cualquier endpoint) → es el **502 keep-alive del ALB** (ver §3), NO un bug de la app. Verificar que los contenedores tienen el fix (`keepAliveTimeout=65s`).
- `console_error` alto pero con `topEndpoint` de auth/callback → suele ser ruido de 401 pre-login + Google GSI (ya filtrado a `debug` desde 05/07; si reaparece en `error`, revisar el filtro en `lib/observability/client.ts`).
- `chunk_load_error` → usuarios en bundle viejo tras deploy (el auto-reload los recupera; si sube mucho, revisar el sync a S3 — ver `docs/runbooks/pusheo-revision-despliegue.md`).
- Cualquier `unhandled_error` / `react_error_boundary` con volumen → **bug real de cliente**, ir a sección 2 (mirar `error_message` + `metadata.stack`).

#### 1.ter.a — TRIAJE de las señales accionables (dónde se ven y qué se hace con cada una)

**Dónde mirar (unificado, no hay otra lista):**

| Sitio | Para qué |
|-------|----------|
| `/admin/salud-sistema` → tarjeta **"Todas las señales (24h)"** | La foto completa. Toda señal `error`/`warn` de `observable_events` agrupada por tipo, con el endpoint dominante. Las benignas se listan aparte, plegadas (nada oculto) y no cuentan para el semáforo. |
| El comando de arriba (§1.ter) | Lo mismo en 1 h, desde la terminal, cuando el panel no está a mano. |
| Email `[Vence CRITICAL] Errores en volumen…` | La regla **catch-all** `senal_error_sin_vigilancia`: dispara ante cualquier señal `error` **≥150/h** que no sea benigna **ni tenga regla propia**. Es la red de seguridad para los tipos a los que nadie ha escrito alerta. |

**Por qué existe el catch-all (auditoría 29/07/2026):** 216 tipos de evento emitiéndose contra 154 reglas de alerta. Trece tipos GRAVES no aparecían en ninguna regla y el panel los agregaba pero no los pintaba: `server_render_error` (991 en 24 h), `pre_hydration_error` (277), `cron_error` (24), `cron_http_trigger_failed`, `question_image_error`, `law_completeness_regression`, `estado_proceso_drift`, `e2e_smoke_failed`. Estaban en la BD y nadie los miraba. Escribir "una regla por tipo" no cierra el hueco — el hueco lo abre el tipo que aún no existe. Por eso el criterio está invertido: **un evento nuevo nace vigilado; para callarlo hay que declararlo benigno a propósito** en `lib/observability/benignSignals.ts` (+ su copia `backend/src/alerts/benign-signals.ts`, con guardarraíl de paridad).

**Cómo leer la tarjeta.** Cada señal accionable trae una marca:
- **`✉ alerta propia`** → tiene regla fina en `alert-rules.ts` (`CON_REGLA_PROPIA` en `lib/observability/benignSignals.ts`). Alguien recibe email con SU umbral —3/h para impugnaciones perdidas, 1 para una clave rota— y por eso el catch-all no la cuenta: contarla dos veces mandaría dos correos del mismo incidente y el umbral grueso taparía al fino.
- **`solo catch-all (≥150/h)`** → nadie la vigila de cerca. Por debajo de ese volumen **solo se ve aquí**: es la cola que hay que triar a mano.

**Umbral del catch-all, calibrado (29/07/2026):** 150/h sale del suelo real medido, no de un número redondo. Tras las exclusiones, el ruido crónico más alto es `console_error` a ~75/h — y dentro hay daño de verdad (`answerSaveQueue Sin token`, timeouts de 15 s, callbacks de login sin sesión) que merece ficha propia, no un correo cada tres horas. Si se baja el umbral sin recalibrar, el correo suena solo y deja de leerse.

**Qué hacer con cada señal accionable — una de estas cuatro, ninguna otra:**

1. **Fallo real con dueño claro** → arreglarlo en esta sesión si es acotado; si no, **ficha en el backlog** (`node scripts/backlog.cjs`, ver `docs/runbooks/tareas-pendientes.md`) citando `event_type`, volumen y endpoint dominante. Nunca "lo miro luego" sin ficha: eso es exactamente lo que dejó 991 `server_render_error` un mes sin dueño.
2. **Ya cubierto por otra tarjeta del panel** (5xx, drift, pool, crons…) → no duplicar: se tría en su sección de este runbook.
3. **Ruido esperado POR DISEÑO** (un 401 pre-login, un heartbeat saltado) → declararlo benigno en `lib/observability/benignSignals.ts` **con el porqué en la misma línea** (el guardarraíl exige el comentario) y replicarlo en la copia del backend. Solo lo que es correcto que ocurra; nunca lo que "hace ruido pero deberíamos arreglar".
4. **Ruido que en realidad es un bug** (p. ej. un `console_error` masivo por un 401 mal clasificado) → se arregla en origen (el emisor), no se silencia. Precedente: el flood del 11/07 (§cabecera) se resolvió dejando de loguear el 401 anónimo, no metiéndolo en la lista de benignos.

**Regla de decisión rápida:** si al leer el `event_type` no sabes decir en una frase por qué es correcto que ocurra, **no es benigno** — es el caso 1.

**Qué NO cierra este catch-all:** vigila el VOLUMEN. Un fallo de 3 al día que arruina a 3 usuarios (una impugnación perdida, un cupo mal cobrado) no llega a 50/h y necesita su regla propia y fina — como `dispute_submit_failed` (≥3/h) o `daily_quota_overcharge`. El catch-all es la red de abajo, no el sustituto.

**Notas sobre los filtros del verdict** (introducidos 2026-05-23 tras detectar dos falsos positivos; sub-categorización admin/user-facing añadida 2026-06-01):

- Los **errores 5xx** se separan por `deploy_version`. Solo los del deploy actual cuentan para el verdict; los de deploys anteriores son informativos. Sin esto, un incidente histórico (ej. cascada 22/05) infla el indicador durante 24h aunque ya esté resuelto.
- Los **errores 5xx del deploy actual** se sub-categorizan en **admin/infra** (`/api/admin/*`, `/api/cron/*`, `/api/debug/*`, `/api/verify-articles/*`, `/api/armando/*`, `/api/v2/admin/*`, `/api/health/*`) y **user-facing** (todo lo demás). Umbrales diferenciados: user-facing ámbar≥1/rojo≥5 vs admin ámbar≥5/rojo≥20. Sin esto, una herramienta admin con 13 errores disparaba ROJO sin afectar UX (incidente real 2026-06-01); y el readiness probe `/api/health/db-ready` con sus 503 de warmup metía ~30-50 falsos positivos en cada deploy (diagnóstico 2026-06-01 — además filtrados en origen vía `withErrorLogging({expectedStatuses:[503]})`). **Fuente de verdad**: `lib/api/admin/endpoint-classification.ts`.
- Los errores 5xx filtran por `http_status >= 500` (excluye Watchdog client-side con `http_status=null`, que tiene su propio indicador en el panel).
- El **drift** excluye explícitamente `target_table IN ('__cron_run__', '__exception__')`. Esos son markers técnicos (la función `check_stats_drift` los inserta al final de cada ejecución para liveness check); su columna generated `drift_pct` puede salir alta por la semántica de stored/fresh values pero NO indica drift real.
- El **cron** se mide por `MAX(checked_at) WHERE target_table='__cron_run__'`, no por el `MAX` general — sin esto, un cron sano sin drift detectado parecería muerto.

---

## 2. Diagnóstico profundo

Si el indicador rojo es **errores 5xx**:

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async () => {
  const rows = await sql\`
    SELECT endpoint, error_type, error_message, http_status, duration_ms,
           user_id, deploy_version, created_at
    FROM validation_error_logs
    WHERE severity = 'critical'
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC LIMIT 30
  \`;
  // Nota: incluye deploy_version para distinguir 'errores nuevos' vs
  // 'errores de incidentes ya resueltos pero aún en ventana 24h'.
  for (const r of rows) console.log(r.created_at, r.endpoint, r.http_status, r.error_type, '—', (r.error_message||'').slice(0,80));
  await sql.end();
})();
"
```

Buscar patrón: ¿es un solo endpoint? ¿un solo user_id? ¿pico horario concreto? Si es `error_type='timeout'`, mirar el endpoint en pg_stat_statements para ver si una query subió de coste. Si es `'db_connection'`, mirar pgbouncer (panel /admin/infraestructura → pool stats).

Si el indicador rojo es **drift**:

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async () => {
  const rows = await sql\`
    SELECT target_table, field_name, user_id, stored_value, fresh_value, drift_pct, notes, checked_at
    FROM stats_drift_log
    WHERE checked_at > NOW() - INTERVAL '7 days' AND drift_pct > 5
    ORDER BY drift_pct DESC LIMIT 30
  \`;
  for (const r of rows) console.log(r.checked_at, r.target_table+'.'+r.field_name, 'user='+r.user_id.slice(0,8), 'stored='+r.stored_value, 'fresh='+r.fresh_value, 'drift='+r.drift_pct+'%');
  await sql.end();
})();
"
```

Identifica la tabla y el campo afectado. Lista de mantenedores conocidos:

- `user_stats_summary.total_questions` y `correct_answers` → trigger `update_user_stats_summary_trigger` sobre `test_questions`. Si drift hay, verificar que el trigger sigue vivo (`SELECT tgname FROM pg_trigger WHERE tgrelid='public.test_questions'::regclass`).
- `user_question_history_v2` → triggers `trigger_update_user_question_history_v2_insert` y `_update`. Misma verificación.
- (Cuando lleguen las tablas nuevas del fix de /api/stats: `user_difficulty_stats`, `user_hourly_stats`, `user_article_stats`, `user_daily_stats` y sus triggers correspondientes.)

Si el drift afecta a un solo user, suele ser un bug de race condition o un fallo silencioso del trigger en ese caso concreto. Reproceso del user: re-ejecutar el cálculo desde fresh scan y hacer UPDATE manual.

Si afecta a muchos users, es un bug del trigger global — rollback o fix urgente.

Si el indicador rojo es **latencia INSERT**:

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async () => {
  // Triggers vivos en test_questions
  const trigs = await sql\`SELECT tgname FROM pg_trigger WHERE tgrelid='public.test_questions'::regclass AND NOT tgisinternal ORDER BY tgname\`;
  console.log('Triggers (' + trigs.length + '):'); for (const t of trigs) console.log('  -', t.tgname);

  // Variantes del INSERT con coste
  console.log('\\nINSERTs por coste:');
  const ins = await sql\`SELECT * FROM v_insert_test_questions_latency LIMIT 5\`;
  for (const r of ins) console.log('  calls=' + r.calls + ' mean=' + r.mean_ms + 'ms max=' + r.max_ms + 'ms p_p95=' + r.proxy_p95_ms + 'ms');

  await sql.end();
})();
"
```

Si hay más triggers de los esperados (>12 en estado actual), alguien añadió uno sin auditar. Si hay menos, se cayó uno. Ver migraciones recientes en `supabase/migrations/`.

Si la latencia es alta pero los triggers son los mismos, suele ser contención de locks (mirar `pg_stat_activity` durante un pico) o que `calculate_user_streak` (escanea 365 días) se está disparando con frecuencia para heavy users — deuda anotada en task #17.

Si el indicador rojo es **cron de drift muerto**:

Ir a https://github.com/rikseotools/vence/actions/workflows/check-stats-drift.yml y ver por qué falló el último run. Causas típicas: CRON_SECRET caducado en secrets de GH, endpoint Vercel devolviendo 500, Vercel limit hit.

---

## 3. Incidentes conocidos (referencias rápidas)

**Una petición lenta ya dice POR QUÉ — evento `answer_save_lento` (30/07, T-312).** Si `/api/v2/answer-and-save` se arrastra, **no hace falta adivinar**: cada guardado por encima de **2 s** emite su desglose por fases, al 100% (el `request_completed` va muestreado al 10% y ese sesgo es justo el que no se puede permitir aquí).
```sql
SELECT to_char(ts,'HH24:MI') t, duration_ms,
       metadata->>'dominante' AS fase, metadata->>'pctDominante' AS pct,
       metadata->>'validarMs' AS validar, metadata->>'guardarMs' AS guardar,
       metadata->>'scoreMs' AS score, metadata->>'noExplicadoMs' AS no_explicado,
       metadata->>'instanceId' AS task
  FROM observable_events WHERE event_type='answer_save_lento'
   AND ts > now() - interval '24 hours' ORDER BY duration_ms DESC LIMIT 20;
```
- **`dominante` es lo primero que hay que mirar.** `guardar` → la escritura en `test_questions` (BD/pool). `validar` → la lectura de la pregunta. `score` → el UPDATE del test.
- **🎯 `fuera_de_fases` es la respuesta MÁS valiosa cuando aparece:** el handler apenas consumió tiempo, así que el problema **no es su lógica** sino el entorno — event-loop bloqueado, espera de pool, GC o throttle del contenedor. Distinguir «la BD tardó» de «el proceso no llegó a ejecutarme» es exactamente lo que faltó el 29/07, cuando atribuir un incidente costó medio día y la primera atribución (crons del backend) resultó **falsa**.
- **Contexto de base:** entre el **0,3% y el 1,3%** de los guardados superan los 5 s **todos los días** (~50-200 opositores). Un puñado de estos eventos al día es lo normal, no una regresión; lo que se mira es el cambio de `dominante` o un salto de volumen.
- ⚠️ **Al medir latencia aquí, cuidado con las ventanas cortas:** el endpoint tiene ~1.600 observaciones/día CON muestreo al 10%, así que en 5 minutos hay 2-3 muestras y `percentile_disc(0.95)` devuelve el MÁXIMO. El 30/07 eso produjo **tres falsas alarmas seguidas** («p95 de 25 s» con n=3). Núcleo puro con suelo de muestras: `lib/api/admin/endpoint-latency.ts` (`LATENCY_MIN_SAMPLES`).

**El detector que se vuelve más lento cuanto más SANA está la base (2026-07-30, T-307)** — el barrido nocturno de salud (`content-health-sweep`) murió entero el 29 y el 30/07, y estuvo dos días sin escribir mientras el panel enseñaba el snapshot del 28 como si fuera de hoy.
- **Causa inmediata:** la query del detector `audit_note_explanation` tardaba **40,6 s** contra el `statement_timeout: 30000` del cliente del backend (`backend/src/db/database.module.ts`). Como el barrido era todo-o-nada, el throw se llevó a los ~40 detectores restantes **y** al bloque de escritura.
- **Lo que hay que aprender, que no es el timeout:** la query llevaba `LIMIT 50`. Mientras hubo coincidencias, el escaneo cortaba en las primeras filas y era rápida; **al limpiar el cubo (274 explicaciones reescritas el 29/07) desapareció el atajo y quedó el seq scan completo**. Un detector con `LIMIT` sobre una columna de texto sin índice **es lento justo cuando ya no encuentra nada**. Si escribes uno, mídelo con el cubo VACÍO.
- **Y el coste no estaba donde parecía.** Medido con `EXPLAIN (ANALYZE, BUFFERS)` sobre 159.671 filas: los 23 `explanation ILIKE '%…%'` costaban **38,2 s**; las dos regex `~*`, **2,4 s**. Fundir los literales en UNA alternancia (`AUDIT_NOTE_LITERAL_RE_SRC` en `lib/health/auditNoteExplanation.cjs`) da el **mismo conjunto de resultados en 6,6 s**. Contraintuitivo y medible: 23 `ILIKE` con case-folding por fila son mucho más caros que un `~*`.
- **Qué lo impide ahora:** (1) el predicado fundido, con la equivalencia JS↔Postgres y el presupuesto de tiempo fijados en `__tests__/integration/auditNoteSweepBudget.integration.test.ts`; (2) el barrido **ya no es todo-o-nada** — escribe lo recogido y añade `sweep_incompleto` (app/error) diciendo qué se cayó, y el `cron_run` sale con `status: partial` y severity `error`; (3) la regla **`cron_sin_exito`** avisa del cron que corre y falla a diario (ver §1.bis.a).

**Mapa de visibilidad frío: un «Index Only Scan» que no lo es (2026-07-29, detector `visibility_map_frio`)** — si una consulta que usa índice tarda segundos y **no hay ni errores ni pico de tráfico**, mira esto antes que nada. Cuando el mapa de visibilidad se enfría, Postgres sigue diciendo *«Index Only Scan»* en el plan pero baja al heap fila por fila: el resultado es correcto y tarda cien veces más.
- **El número que hay que mirar es `Heap Fetches`**, no el nombre del nodo. Caso real: `test_questions` al 67,5% de páginas visibles → **72.695 heap fetches y 17.809 ms** en la consulta de `theme-stats`; tras calentar el mapa, **0 y 145 ms** (122×). El opositor veía sus estadísticas vacías porque el cliente corta a los 8 s.
- **La trampa:** la tabla PARECE bien configurada porque tiene `autovacuum_vacuum_scale_factor` afinado… que mira **filas MUERTAS**. Una tabla de INSERTS no genera ninguna, así que **ese ajuste no dispara jamás**. El que aplica es `autovacuum_vacuum_insert_scale_factor` (global 0.2 = cientos de miles de inserts por vacuum). Medido: 4 de 9 tablas afectadas eran insert-only puras y llevaban 25 días sin vacuum.
- **Comprobar:**
  ```sql
  SELECT c.relname, round(100.0*c.relallvisible/NULLIF(c.relpages,0),1) AS pct_visible
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
   WHERE c.relkind='r' AND c.relpages > 5000
     AND (100.0*c.relallvisible/NULLIF(c.relpages,0)) < 90;
  ```
- **Arreglar:** `ALTER TABLE public.<tabla> SET (autovacuum_vacuum_insert_scale_factor = 0.01, autovacuum_vacuum_insert_threshold = 1000)`. Es metadatos, instantáneo, y el autovacuum arranca solo acto seguido (con retardo por coste, sin pico de I/O). **Verificar el efecto, no declararlo:** repetir el `EXPLAIN (ANALYZE, BUFFERS)` y comprobar `Heap Fetches` a 0.
- **Vigilancia:** núcleo puro `lib/db/visibilityMap.cjs`, emitido por el barrido nocturno como `visibility_map_frio` (aviso <90%, error <70%, solo tablas de más de 5.000 páginas). Ficha: [T-275].

**El PDF del temario bloquea el frontend y tumba el guardado de respuestas (2026-07-29, ABIERTO — [T-270])** — si `endpoint_latency` se pone rojo en `/api/v2/answer-and-save` **y el tráfico NO ha subido**, mira esto ANTES de sospechar de la BD. `/api/temario/[oposicion]/[topic]/pdf` exige premium pero no tiene límite de tasa, y cuando el PDF no está en caché lo renderiza **en línea** con `@react-pdf` + `pdf-lib` — JS puro y CPU pura **en el proceso que sirve**. Con temas de hasta 760 páginas, eso bloquea el event-loop de esa task y todo lo demás hace cola. Medido el 29/07: 36 renders frescos en 18 min → CPU del frontend 98,5%, event-loop parado 215 s en 5 instancias, `answer-and-save` a p95 25.070 ms. Se recuperó solo al acabar el barrido.
- **Cómo confirmarlo en 30 s:** `SELECT count(*) FROM observable_events WHERE event_type='temario_pdf_stamped' AND created_at > now() - interval '30 minutes';` — si hay decenas, es esto.
- **Ojo con el contenedor equivocado:** la primera versión de [T-254] culpó a la CPU del BACKEND. El que se satura es el **frontend**, que es quien sirve `answer-and-save`. *"La CPU del backend está al 100%"* y *"el backend es la causa"* no son la misma frase.
- **Anatomía completa:** `docs/ARCHITECTURE_ROADMAP.md` → *«Incidente 2026-07-29»*. Guardarraíl anti-recaída: `__tests__/guardrails/cpuBoundRoutes.guardrail.test.ts`.

**Veredicto ROJO falso por canaries + fatiga de alertas de auth (2026-07-08, FIX aplicado)** — el panel daba ROJO user-facing con 73 "5xx en `/api/exam/answer`" que eran **100% el canary `answer-premium`** (`smoke@vence.es`, UA `Vence-Canary-AnswerPremium/1.0`, 1 fallo cada 5 min). Y la bandeja de Manuel se inundaba de `Errores de cliente sostenidos` sobre ruido benigno. **Tres causas + tres fixes de raíz:**
- **(A) Status semántico mal:** `/api/exam/answer` devolvía **500** cuando `saveAnswer` no podía derivar `correctAnswer` (pregunta nueva sin `questionId`) — eso es input insuficiente del cliente = **422**, no 5xx. Fix: discriminador `reason:'invalid_input'` en `SaveAnswerResponse` → route mapea a 422 (`lib/api/exam/{schemas,queries}.ts` + `app/api/exam/answer/route.ts`).
- **(B) Tráfico sintético en VLE:** `withErrorLogging` ahora reconoce el header canónico **`x-vence-canary`** (que TODOS los canaries envían) y NO escribe sus errores en `validation_error_logs` (sí emite `request_completed` marcado `synthetic`, severity info). Escalable: cualquier canary futuro queda excluido sin tocar código. Helper `lib/api/syntheticRequest.ts`. Los canaries tienen su propio canal (`canary_*_failed`) para regresiones reales.
- **(C) Ruido de `http_network_error`:** el cliente (`lib/observability/client.ts`) suprime el `http_network_error` durante unload/background (móvil en background aborta fetches con "Failed to fetch", que NO es AbortError) — era el grueso del ruido en `/api/auth/*`.
- **(D) Alerta recalibrada:** `RULE_CLIENT_EDGE_SUSTAINED` ya no suma `http_network_error` con umbral 80 (el baseline benigno ~100-120/h lo cruzaba y disparaba cada hora). Ahora: edge 5xx/timeout ≥30/h (accionable: keep-alive 502) **O** avalancha de network_error ≥500/h (outage real). Baseline benigno nunca dispara.

**502 keep-alive ALB↔Node (2026-07-05, FIX aplicado)** — 502 Bad Gateway intermitentes y **continuos** (no solo en deploys), peor en `/api/auth/token` (el más polleado). El **servidor registra 0 5xx** (la app responde en ~4ms) → error de EDGE, invisible en el panel server-céntrico hasta que la captura de cliente in-house lo destapó (`http_5xx` status=502, source=frontend). **Causa:** ALB `idle_timeout=60s` pero Node cierra las conexiones keep-alive ociosas a los **5s** (default) → el ALB reutiliza una conexión que Node ya cerró → 502. **Fix:** `keepAliveTimeout=65s` (> 60s) + `headersTimeout=66s` — frontend vía `docker/server-keepalive.cjs`, backend vía `main.ts`. **Diagnóstico:** mirar el bloque 1.ter → si `http_5xx` de cliente = status 502 → esto. **Detalle:** `docs/runbooks/pusheo-revision-despliegue.md` §502.

**pooler_instance_unreachable (2026-07-04 16:35–19:56, resuelto)** — 202 eventos `error` de la pooler no alcanzable en una ventana de ~3.3h la tarde del 04/07. NO reapareció después. Si vuelve: mirar salud de la(s) VM(s) del pooler self-hosted (HA 2 AZs + NLB) y la conectividad Fargate→pooler. No confundir con el pool de la app.

**App CONGELADA al desplegar / ChunkLoadError (2026-07-05, FIX aplicado)** — usuarios (Nila) con la app congelada tras un deploy. Chunks `_next/static` servidos del contenedor efímero → 404 tras deploy → ChunkLoadError sin manejo. **Fix:** assets en S3 con retención + CloudFront origin-group + auto-reload de cliente. Señal en el panel: `chunk_load_error`. Detalle: memoria `project_deploy_freeze_chunks_s3` + `docs/runbooks/pusheo-revision-despliegue.md`.

**Cascada statement_timeout (2026-05-22)** — afectó `/api/stats`, `/api/v2/difficulty-insights`, theme counts, `/teoria`. Pool sano pero queries lentas saturando lambdas. Mitigado con cache Redis + stale-if-error + `withDbTimeout`. Fix de fondo: materializar agregaciones — ver `docs/ARCHITECTURE_ROADMAP.md` sección "Tech debt CRÍTICO: queries no-escalables".

**Heavy user timeout Nila (2026-05-19)** — `/api/v2/difficulty-insights` daba 503 para users con >30k test_questions. Resuelto reescribiendo 4 RPCs para leer de `user_question_history_v2`. Patrón: cualquier endpoint que escanee `test_questions` por user sin pre-agregado está en riesgo de timeout para heavy users.

**INSERT degradado por triggers acumulados (2026-05-23)** — al auditar `test_questions` aparecieron 14 triggers, 2 de ellos NO-OP. Documentado en ADR "triggers SQL vs outbox/worker" en el roadmap. Regla operativa: si añades un trigger a `test_questions`, debe ser `INSERT ... ON CONFLICT DO UPDATE` con `+1 counter`, jamás scan o agregación.

**Cascada 503 por slots pool zombie (2026-05-27, 17:00–19:50 UTC)** — 1995 errores 503 en `/api/v2/answer-and-save` ("Servicio saturado momentáneamente"). Diagnóstico engañoso: `canary-database-pool` daba OK (SELECT 1 trivial encontraba slot), pero queries reales (DailyLimit, Medals, antifraud) timeouteaban. **Causa raíz**: `emitFireAndForget()` del backend Fargate hace `await db.execute(INSERT observable_events)` SIN timeout. Si Supavisor se cuelga en `wait=Client/ClientRead`, la promise nunca resuelve → slot pool zombie → pool postgres-js (max 7-8) se satura → antifraud quick-fail → 503 cascada. **Fingerprint**: `SELECT pid, wait_event_type, wait_event, query FROM pg_stat_activity WHERE application_name='Supavisor' AND state!='idle' AND NOW()-query_start > INTERVAL '30 seconds'` con `wait=Client/ClientRead` + `INSERT INTO observable_events`. **Mitigación**: `pg_terminate_backend(<pid>)` + `force-new-deployment`. **Fix aplicado** (commits `e1f639f6` + `a2b80393`): timeout 5s en `emit()` de backend + sink frontend + rollout-log. Tras fixes, 5xx bajaron de 357/h a 14/h baseline.

**Antifraud quick-fail intermitente sin zombies — investigación pendiente (2026-05-28, desde 03:27 UTC)** — TRAS aplicar el fix del incidente anterior, reaparecen burst de 503 esporádicos (~8-13/min, ventanas de 1-3 horas). Diagnóstico distinto al anterior:
- ✅ NO hay slots pool zombie (`pg_stat_activity` limpio, Supavisor con 0 hung >30s).
- ✅ NO hay autovacuum activo en tablas hot (`pg_stat_progress_vacuum` vacío).
- ✅ La función SQL `register_device` corre rápido: `mean=1.29ms stddev=3.17 max=99ms calls=6666` en `pg_stat_statements` — NO es problema de BD.
- ✅ Pool sano: 5+ idle postgres.js + 1 Supavisor active.
- ⚠️ PERO el backend Fargate reporta consistentemente `Timeout (quick-fail) en antifraud tras 10003ms (límite 10000ms)` desde `AnswerSaveController`.
- ⚠️ Pattern: cada 8s aprox, request tarda EXACTO ~10000-10100ms antes de fallar. = el timeout del antifraud disparándose limpiamente.

**Hipótesis fuerte**: latencia Fargate↔Supavisor degradada intermitentemente. El `Promise.all([registerAndCheckDevice, getDailyLimitStatus, checkDeviceDailyUsage])` del antifraud espera a la más lenta de las 3 RPCs; con TCP roundtrip alto en horas concretas, suma >10s aunque cada RPC sea rápida en BD. **Alternativa**: cliente postgres-js mantiene una conexión "zombie zombi" — cerrada en BD pero que el cliente cree tener; al usarla espera para siempre hasta timeout.

**Por qué NO se ataca aún**: detección requiere comparar latencia red Fargate↔Supabase vs latencia query pura (separar TCP de ejecución), y posible inspección de eventos VPC/NAT/Supavisor. Es trabajo de 2-4 h con cabeza fresca, no de emergencia (afecta a 8-13 users/h en horas valle 22 UTC-04 UTC). Anotado para retomar.

**Pistas para la próxima sesión**:
- Comparar `mean_exec_time` de `register_device` en pg_stat_statements vs duración medida server-side desde antifraud.service.ts (ya emitido a observable_events como `request_completed`).
- `aws cloudwatch get-metric-statistics` para `TargetResponseTime` del ALB durante el spike — si el ALB ya ve latencia alta antes de llegar al app, es network.
- `SELECT * FROM pg_stat_database` para ver `xact_commit/xact_rollback` rate (puede haber rollbacks ocultos).
- Considerar añadir `idle_in_transaction_session_timeout` y `statement_timeout` a nivel sesión postgres-js para defense in depth.
- Subir `ANTIFRAUD_TIMEOUT_MS` de 10s a 15s puede ser band-aid temporal (entender primero la causa).

---

## 4. Umbrales — fuente de verdad

**Catch-all de señales** (añadido 29/07/2026): panel `error_signals` → ámbar ≥20 de un tipo no-benigno en 24 h, rojo ≥100. Email (`senal_error_sin_vigilancia`, `critical`) → ≥50/h de un tipo `error` no-benigno. Fuente de los benignos: `lib/observability/benignSignals.ts`.


Los umbrales también están codificados en `app/api/admin/system-health/route.ts`. La clasificación admin/user-facing y sus umbrales viven en `lib/api/admin/endpoint-classification.ts` (importado por el endpoint). Si cambias cualquiera, actualiza también el script bash CLI de §1.

**Errores 5xx 24h** (sub-categorizados):
- **User-facing** (afecta UX): ámbar ≥ 1, rojo ≥ 5
- **Admin/infra** (`/api/admin/*`, `/api/cron/*`, `/api/debug/*`, `/api/verify-articles/*`, `/api/armando/*`, `/api/v2/admin/*`, `/api/health/*`): ámbar ≥ 5, rojo ≥ 20. Además, los 5xx esperados por contrato (ej. 503 de warmup del readiness probe) se filtran en origen y NO llegan a `validation_error_logs` — ver `withErrorLogging({expectedStatuses})`.

**Otros indicadores**:
- **Cupo free cobrado de más** (`daily_quota_overcharge`, alert-rule, 29/07/2026): usuarios `free` que llegan al tope diario (25) habiendo respondido **menos de 20** preguntas reales. Dispara con **>10 usuarios en 48 h**; cooldown 12 h. Mide sobre las **tablas de negocio completas** (`daily_question_usage` vs `test_questions` + psicotécnicos + ortografía, fecha `Europe/Madrid`), **no** sobre `observable_events` — las peticiones OK van muestreadas al 10% (`withErrorLogging.ts` → `SUCCESS_TIMING_SAMPLE_RATE`) y no sirven para contar. Baseline sano tras el arreglo: 0-6 casos/48 h (cola larga de sesiones a caballo entre dos días). Si dispara, el orden de sospecha está en el cuerpo de la alerta: (1) alguien volvió a cobrar desde el cliente → lo caza `__tests__/guardrails/dailyQuotaServerSide.test.ts`; (2) respuestas que dejaron de persistirse en `test_questions`; (3) una modalidad nueva que cobra sin guardar. Regla de negocio: `debeConsumirCupo` (`lib/api/dailyLimit.ts` + copia paritaria en `backend/src/daily-limit/daily-limit.service.ts`).
- Drift contadores 24h con drift_pct > 5: ámbar ≥ 1 fila, rojo ≥ 5 filas
- Latencia INSERT mean histórico de pg_stat_statements (incluye RTT): ámbar ≥ 80ms, rojo ≥ 250ms. proxy_p95 (mean + 2·stddev) se muestra como informativo en el panel pero sin umbral propio — es muy sensible a outliers de contención.
- Cron de drift staleness: ámbar > 26h, rojo > 36h

**Latencia POR ENDPOINT** (`endpoint_latency`, T-254 — núcleo en `lib/api/admin/endpoint-latency.ts`):
- `user_facing`: ámbar ≥ 2.000 ms, rojo ≥ 5.000 ms · `admin`: ámbar ≥ 5.000 ms, rojo ≥ 15.000 ms
- Se mide el **p95 del PEOR cubo de 5 minutos** de la ventana, no el agregado del periodo. Mínimo **10 muestras** por cubo: por debajo dice `unknown`, nunca verde.
- La alerta (`endpoint_latency_sustained`, cada 5 min) exige **≥2 cubos consecutivos en ámbar-o-peor con al menos uno rojo**, y solo en endpoints de usuario. Volumen medido: **~1/día**.
- ⚠️ **El `n` que ves NO son peticiones reales:** los `request_completed` de 2xx/3xx se emiten **muestreados al 10%** (`SUCCESS_TIMING_SAMPLE_RATE`); los 4xx/5xx van al 100%. Una petición lenta observada implica **~10 reales**. Consecuencia directa: con **n<20 el «p95» es de hecho el MÁXIMO del cubo** (`percentile_disc(0.95)` con n=19 devuelve el mayor de 19), y ahí cae el **85% de los hallazgos** — el panel lo marca como *«muestra corta (p95 = máx)»*. La señal sigue siendo válida; lo que no vale es leerla como un percentil. La protección contra el outlier suelto no es el suelo de muestras, es que **la alerta exige que la degradación DURE** (≥2 cubos).
- ⚠️ Los umbrales están DUPLICADOS en `backend/src/alerts/alert-rules.ts` (el backend no puede importar `lib/`: su Docker solo copia `backend/src`). La divergencia la caza `backend/src/alerts/alert-rules.endpoint-latency.spec.ts` — si tocas un número aquí, ese spec te avisa.

> **Por qué NO basta el indicador `request_latency` que ya había** (y por qué el incidente del 28/07 pasó desapercibido): agrega TODO el tráfico junto. Medido sobre los datos reales de ese día, mientras `/api/v2/answer-and-save` estaba a **p95 25.145 ms**, el p95 global de esos mismos 15 minutos marcaba **166 ms → verde**. Un endpoint que es el 3% del volumen no puede mover un percentil global, por muchos umbrales que se le pongan.
>
> **Y por endpoint tampoco basta si la ventana es larga:** el p95 de ese MISMO endpoint agregado a 24 h sale a 362 ms → verde, porque 13 minutos de incendio son el 0,9% del día. Hacen falta las dos cosas: por endpoint **y** en cubo corto. Simulación reproducible: `npx tsx scripts/sim-latencia-endpoints.ts --dias 7 [--detalle]`.

---

## 5. Acciones de emergencia

Si todo está en rojo a la vez, es cascada activa. Ir a `docs/ARCHITECTURE_ROADMAP.md` → sección "Incidentes pasados" y replicar el patrón de mitigación (cache Redis stale-if-error + withDbTimeout) en el endpoint afectado.

Si el cron de drift lleva días muerto y desactivarlo en GHA no era intencionado, re-activar con `gh workflow enable check-stats-drift.yml`. Si el cron falla constante, ejecutar manualmente desde `/admin/salud-sistema` botón "Refrescar" no — eso solo refresca el panel; para forzar la ejecución manual del cron va `gh workflow run check-stats-drift.yml` o desde la UI de GitHub Actions.

Rollback de la observabilidad si ella misma está rompiendo cosas (improbable, son lecturas):

- DROP VIEW v_insert_test_questions_latency
- DROP FUNCTION check_stats_drift
- DROP TABLE stats_drift_log
- Workflow GHA: deshabilitar desde la UI o renombrar `.yml` a `.yml.DISABLED`
