# Postmortem — Cascada de 504 por health check bajo pico (21/07/2026)

> **TL;DR.** En el pico de tarde (~17:10-18:25 Madrid) la app devolvió **504 (ELB_5XX)** a usuarios reales
> (pico 1.698/min). Causa raíz **a ciencia cierta**: cada task del frontend tiene **1 vCPU**; bajo alta
> concurrencia el **event-loop de Node (single-thread) se satura** en tasks individuales; el health check
> de contenedor (`/api/health/db-ready`, timeout 4-5s) no consigue CPU para responder → ECS marca el task
> UNHEALTHY y lo **mata** (exit 137) → su carga cae sobre los demás → **cascada hasta 0 tasks vivos** → la
> ALB devuelve 504 porque no hay targets sanos. El health check convertía "lento" en "caído". **Contenido**
> con un health check tolerante + capacidad. **No es la BD** (SELECT 1 trivial, RDS 132/400 conexiones).

## Síntomas (lo que se vio)

- Correos **[Vence CRITICAL] Spike de errores 5xx — 32/52/94 en 5 min** + **[Vence ERROR] Errores de cliente sostenidos — 671/758/1044/h (edge 5xx/timeout)** en `/api/interactions`, `/api/auth/token`, `/api/answer-and-save`.
- `HTTPCode_ELB_5XX_Count` altísimo (313→617→**1698**→653→550/min) con **`HTTPCode_Target_5XX_Count = 0`** (los tasks NO daban error) y **`TargetResponseTime` bajo** (0,25-0,63s). Firma inequívoca: la ALB genera 504 porque **no hay target sano al que enrutar**, no porque el origen falle.
- ECS: `runningCount` oscilando **0↔8** (llegó a 0 varias veces); tasks parando con `stoppedReason = "Task failed ELB health checks — Request timed out"`, `exitCode 137` (SIGKILL), `healthStatus UNHEALTHY`.
- La home seguía 200 (servida por **caché de CloudFront**), enmascarando la caída del contenido dinámico.

## Causa raíz (a ciencia cierta, con evidencia)

1. **Tasks de 1 vCPU.** `vence-frontend` task def: `cpu: 1024` (= **1 vCPU**), `memory: 2048`. Node ejecuta JS en **un solo hilo** → con 1 vCPU, el event-loop corre esencialmente en 1 core.
2. **Saturación de event-loop bajo el pico.** Tráfico ~9.700 req/5min, dominado por **`/api/auth/token`** (el #1 por goleada, **4,5× el siguiente**; hace firma **RS256** = crypto CPU-bound) + SSR + serialización. En 1 vCPU, la concurrencia de trabajo CPU-bound **bloquea el event-loop** de tasks individuales.
   - **Evidencia dura:** `pool_capacity_samples.hung_clientread_over_10s` = **4-5** justo en el pico (16:11-16:13 UTC) = conexiones donde el task mandó una query, la BD respondió, pero **el proceso Node no lee la respuesta** (loop bloqueado). Y `CPUUtilization` **max=100% / avg=40%**: no es saturación de flota, es **un task pegado al 100%** cada vez (su único core al tope) mientras el resto está ocioso.
3. **El health check mata al task ocupado.** `/api/health/db-ready` solo hace `SELECT 1` (trivial, timeout interno 2s) — pero si el event-loop está bloqueado, el **handler ni siquiera se ejecuta** en los 4-5s del health check. Config asesina: container health check `timeout 5s, retries 3, startPeriod 60s` (`wget --timeout=4`) + ELB health check `timeout 5s, unhealthy 3`.
4. **Cascada.** ECS mata el task "unhealthy" (que en realidad servía, solo iba lento) → su carga se reparte entre los que quedan → esos se saturan MÁS → más health checks fallan → **cascada a 0 running** → 504 generalizado.

**Lo que NO era** (descartado con datos): no era la BD (RDS 93-132/400 conexiones, 2 queries activas, `SELECT 1` trivial); no era agotamiento de pool (`frontend_active_conns` 4-9, `max:5`/task sin topar la flota); no era OOM (memoria max 73%); no era un deploy (task def 499 estable desde las 14:52); no era el `importPKCS8` (la clave RS256 se **cachea** por PEM en `lib/api/auth/rs256.ts`).

**Error propio reconocido:** la primera reacción (subir a 10 tasks) **empeoró** el incidente — 10 cold-starts a la vez compiten por CPU (Next.js arranca al 100%) → aún más health checks fallando. Y se tardó en ver que el killer era el **health check de contenedor** (relajar solo el de ELB no bastó).

## Contención aplicada (21/07, en caliente, por CLI — es DRIFT de Terraform)

1. **Health check de contenedor tolerante** (task def `:501`→`:502`): `timeout 5→10`, `retries 3→5`, `startPeriod 60→180`, `wget --timeout 4→8`. **Esto rompió la cascada** — un task ocupado-pero-vivo ya no muere.
2. **ELB health check relajado:** `timeout 5→15`, `unhealthy 3→5`.
3. **Capacidad:** autoscaling `max 3→6→10→12`, `min 2→6→8`, `desired→9`; scheduled pre-warm 10-23h Madrid; step-burst +2 si CPU>85%.

Resultado: `ELB_5XX` de **1.698/min → ~3-50/min**, cascada detenida (no vuelve a 0 running).

## Cómo atacar la causa RAÍZ (plan)

El health check tolerante **contiene** (evita que "lento" sea "caído") pero no elimina la fragilidad de fondo: **1 vCPU + trabajo CPU-bound en el hot path**. Ataque por capas:

1. **Tasks más grandes (2 vCPU)** `cpu: 1024→2048`. Node sigue con 1 hilo JS, pero el 2º core absorbe GC + libuv threadpool (crypto RS256, DNS) → menos bloqueo del loop. Cuesta ~2× por task; evaluar vs. más tasks pequeños.
2. **Bajar CPU/request del hot path** (**backlog T-071**): `/api/auth/token` (#1) — mover el RS256 fuera del hot path (acuñar en el backend NestJS / worker), o reducir su volumen (mejor caché cliente), o mover el minteo a un runtime con más cores. Idem polls (`interactions`, `notifications`, `streak`).
3. **Autoscaling por la métrica CORRECTA.** El escalado por **CPU media** NO captura este cuello (media 40% mientras hay 504s): la media baja mientras tasks individuales revientan. Escalar por **`RequestCountPerTarget`** o **ALB 5xx** (target-tracking / step) capta la saturación real. Es la palanca que faltó: el autoscaler escaló IN a 6 justo cuando había 504s.
4. **Health check = liveness, no readiness-bajo-carga.** Separar: liveness (¿proceso vivo? — que responda aunque esté ocupado, idealmente sin tocar el loop bloqueado) de readiness (¿BD ok? — con umbral tolerante). El `db-ready` actual mezcla ambos y castiga la ocupación transitoria.
5. **Medir event-loop lag (punto ciego).** HOY no se mide (`perf_hooks.monitorEventLoopDelay`) → no vemos la saturación hasta que cascadea. Emitir `event_loop_lag` a `observable_events` + alerta = detección temprana. Complementa `RULE_FRONTEND_SATURATION` (que caza la cascada por el storm de canaries, pero tarde).

## Cabos abiertos (URGENTE tras el pico)

- **Drift de Terraform**: TODOS los cambios de contención están por CLI. Un `terraform apply` los revertiría (frontend.tf: `max_capacity`, `aws_appautoscaling_policy` target; ALB health check en alb.tf/frontend.tf; y el health check de contenedor vive en el **Dockerfile HEALTHCHECK** o el task def — hay que codificarlo). Sin esto, el incidente **recurre** al próximo apply. → tarea de codificación.
- El task def `:502` con el health check tolerante lo hereda `deploy-frontend.sh` (clona el task def vivo), PERO si el HEALTHCHECK está en el **Dockerfile**, un rebuild lo re-hornea al valor estricto → verificar y arreglar en el origen.

## Observabilidad que SÍ funcionó / faltó

- ✅ `RULE_FRONTEND_SATURATION` (desplegada horas antes) **habría disparado 5 veces** durante el incidente (≥4 canaries en timeout simultáneo) — 1 aviso legible en vez del storm. Validada contra los datos del incidente.
- ❌ Falta **event-loop lag** directo (capa 5 de arriba) y **autoscaling por request-count** (capa 3).
