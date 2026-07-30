# Manual de migración — AWS (ECS/RDS) → Koigrid (PaaS tarifa plana EU)

> **Enlazado desde:** `docs/ARCHITECTURE_ROADMAP.md` §"Principio transversal: agnóstico al proveedor" (eje **hosting/compute**). Este manual es el **destino concreto** de la portabilidad que ese principio exige: la app se diseñó agnóstica *por contrato* precisamente para poder ejecutar este movimiento sin reescribir código.
>
> **⚠️ NO SOLO HAY WEB Y BASE DE DATOS — inventario obligatorio antes del cutover (30/07/2026).** Además del frontend y el backend corren **tres tareas programadas** (`vence-temario-pdf-worker` cada 30 min, `vence-content-radar` L-X-V a las 6, `vence-instagram-daily` a diario a las 10) que este manual **no mencionaba**. Migrar sin ellas deja tres trabajos atrás en silencio, y ese fallo ya ocurrió dentro de AWS: el worker de PDFs estuvo **dos días muerto** sin que saltara nada (27→29/07). Inventario completo, con el origen de cada uno: `docs/ARCHITECTURE_ROADMAP.md` §"QUÉ CORRE EN PRODUCCIÓN".
>
> **Estado:** 🟡 POC WHOLE-STACK PROBADO. NADA en producción migrado (prod sigue 100% en AWS). Cutover gated por load-test de pico (§6) — plan de pago.
> **Última actualización:** 2026-07-24.
> **Token API:** SSM `/vence-tools/KOIGRID_API_TOKEN` (perfil `vence`). Memoria: `reference_koigrid_evaluacion_fase_d`.
>
> **📌 Avance 2026-07-24 (POC, proyecto Koigrid `demo`=`7a9881f4`):** los 4 componentes VIVOS en Koigrid y probados individualmente:
> - **BD** `vence-mig2` (31GB 1:1) · **frontend** `vence-web7` (renderiza páginas reales de BD) · **backend** `vence-backend` (`/health` 200, sirve contenido real, cron engine, escribe en la BD copia) · **Redis** `cache` (`rediss://` TLS, SET/GET E2E).
> - **Flujos de usuario probados E2E** contra la copia: **login/auth** (`GET /api/profile` 200 con RLS; sin token 401) y **guardar respuesta** (`POST /api/v2/answer-and-save` 200 con INSERT real + score + explicación, 0,79s). **Webhook Stripe:** handler OK (rechaza firma no-cuadrada), verde pendiente de emparejar el webhook secret (config).
> - **Desbloqueado por Koigrid (23-24/07):** defecto #2 (pull ECR-native con creds) + sugerencias #1 (`/manifest` whole-app) y #4 (`/apps/{id}/loadtest`). Deploy vía imagen ECR (no build en Koigrid) + `POST /manifest`.
> - **2 bugs de plataforma hallados** (en el journey para Koigrid): **plan≠apply en `project`** (id en plan/nombre en apply → creó stack paralelo vacío; fix=pasar el NOMBRE) y **`build_export_failed`** (todo deploy de imagen falla al 1er intento por I/O del runner; un `POST /deployments` de retry lo aterriza; sin downtime).
> - **Gate pendiente = load-test de pico:** plan-gated en Free (1 réplica; CDN necesita dominio propio). Floor medido: 1 réplica 2GB CDN-off satura el estático ~8.7 rps. Pico ~43M req/mes ≈16,6 rps → necesita CDN + ~6-10 réplicas (plan de pago).
> - **Detalle completo y feedback para Koigrid:** `docs/roadmap/koigrid-migration-journey.md` (secciones fechadas 24/07). **Incremental vs big-bang** analizado ahí: la BD va en un flip coordinado (replicate-then-flip, near-zero downtime); el tráfico sí es incremental (canary DNS 1→100%); NUNCA escribir en las 2 BD a la vez.

---

## 0. Honestidad primero: qué resuelve y qué NO

**El problema real de los incidentes 21-22/07** no fue la BD (RDS estuvo sana todo el rato: 93-132/400 conexiones, queries rápidas). Fue el **frontend saturándose bajo picos** por dos causas: (a) autoscaling **reactivo** de ECS con lag de arranque (3-5 min por task nueva vs picos instantáneos), y (b) bugs propios de config (scheduled action con `max=6` hardcodeado). Compuesto por la **complejidad operativa** de ECS + ALB + task-def + Terraform + SSM + GHA build-args, que es la superficie donde se cuelan esos bugs.

**Qué Koigrid NO resuelve:** su autoscale de apps es el **mismo modelo reactivo por CPU** que ECS (`{enabled, min, max, targetCpuPct}`). Migrar NO elimina por sí solo el burst-lag → **seguirás necesitando `min` holgado**. No hay magia anti-pico.

**Qué Koigrid SÍ resuelve:**
1. **Coste plano y predecible.** ~$89/mes (plan Scale) vs ~$800-1200/mes estimados en AWS (Fargate + RDS Multi-AZ + ALB + transfer). "Holgado siempre" en AWS es caro; holgado en tarifa plana es barato → la solución robusta (sobreaprovisionar) deja de doler.
2. **Simplicidad operativa.** `git push` → deploy. TLS + CDN + autoscale + dominios gestionados. Desaparecen ALB, task-def, Terraform de infra, SSM build-args, el maze de GHA — es decir, **la superficie que generó los bugs de config**. Menos piezas = menos modos de fallo.
3. **Portabilidad cumplida.** Es el destino que el principio de agnosticismo venía preparando. Sin lock-in (Postgres estándar, Docker, S3-compatible, Redis estándar).

**Conclusión de encuadre:** la migración se justifica por **coste + simplicidad**, no por "arregla los picos". El fix inmediato de los picos es el **"holgado" en AWS** (carril 1, ya aplicándose). Koigrid es el carril 2 (estratégico), y **solo se ejecuta si el load-test (§6) valida que $89 aguanta el pico real de Vence**. Si no lo valida → NO se migra; se queda en AWS holgado.

---

## 1. Qué es Koigrid (inventario verificado 22/07)

PaaS completo de tarifa plana en EU, "the anti-AWS": API-first (164 endpoints), sin egress sorpresa, sin lock-in. No es solo Postgres — es Render/Railway/Fly-class.

| Recurso Koigrid | Endpoints | Sustituye en Vence |
|---|---|---|
| **`/apps`** (compute) | 27 | ECS Fargate (frontend + backend) + ALB + autoscaling |
| **`/databases`** (Postgres 14-17) | 17 | RDS `vence-prod` |
| **`/redis`** | 6 | Upstash (caché) |
| **`/buckets`** (S3 + registry OCI) | 6 | S3 (avatares, storage) |
| **`/queues`, `/jobs`** | 9 | outbox / BullMQ futuro |
| **`/dns`, `/email`, `/webhooks`** | 10 | Route53 / Resend (opcional) |

**Apps ofrece:** deploy desde GitHub (`/apps/{id}/github`) o imagen OCI (`docker push koigrid.com/<name>:<tag>`) o `source-upload`; `/apps/{id}/autoscale` (min/max/targetCpuPct); `/scale` (réplicas fijas); `/resources` (RAM/CPU); dominios + TLS auto (`/domains`); CDN (`/cdn`); reglas rewrite/header estilo `vercel.json` (`/rules`); env encriptadas + **reference vars** entre recursos del mismo project (`${{db.main.DATABASE_URL}}`, `${{redis.cache.REDIS_URL}}`); preview-per-branch; rollback sin rebuild; health-check path; volúmenes persistentes EBS-style; private networking intra-project.

### Precios (medidos 22/07 · **CONFIRMADOS OFICIALMENTE el 29/07**: koigrid los publicó en `llms.txt` + `/pricing` y coinciden con lo que habíamos inferido)

| Plan | $/mes | Apps | RAM/CPU por app | DB | Storage | Banda | Overage |
|---|---|---|---|---|---|---|---|
| Free | 0 | 1 | 0.5vCPU/512MB | 512MB/1GB | 1GB | 100GB | — |
| Starter | 12 | 3 | 1vCPU/1GB | 1GB/10GB | 25GB | 500GB | — |
| **Pro** | 35 | 8 | 2vCPU/4GB | 4GB/50GB | 100GB | 2TB | storage $0.05/GB, banda $0.03/GB |
| **Scale** | 89 | 20 | 4vCPU/8GB | 8GB/200GB | 500GB | **5TB** | idem |

**Sin cobro por-request ni por-cpu-second** = plano de verdad. BD prod = **33GB** (medido 29/07; el dump comprime a **4,09GB**) → cabe en Pro (50GB disco) con 1,5× de margen, y de sobra en Scale. Vence hace ~43M req/mes; 5TB banda holgado. **La incógnita es si 1 app (4vCPU/8GB + réplicas) aguanta el pico** — eso lo decide §6.

---

## 2. Decisión de arquitectura: híbrido vs full-Koigrid

El punto crítico es la **latencia app→BD**. Hoy Fargate y RDS están co-ubicados en `eu-west-2` (<1ms por query). Si mueves solo el frontend a Koigrid dejando la BD en RDS, **cada query cruza de proveedor** (RTT ~90-100ms medido local→koigrid) → un endpoint con 10 queries secuenciales suma ~1s solo en red. **Inviable** para el hot path.

| Opción | Frontend | BD | Latencia app→BD | Veredicto |
|---|---|---|---|---|
| **A — Híbrido** | Koigrid | RDS | cross-provider ~90ms/query | 🔴 NO (mata el hot path) |
| **B — Full-Koigrid** | Koigrid | Koigrid | co-ubicada <5ms | 🟢 SÍ (destino real) |
| **C — Solo BD** | ECS | Koigrid | cross-provider | 🔴 NO (mismo problema, sin ganar simplicidad de hosting) |

→ **La migración correcta es B (full): frontend + BD + redis a Koigrid, co-ubicados.** Media tinta (solo mover una pieza) reintroduce latencia cross-provider. Esto es coherente con la memoria (una réplica Koigrid no engancha en caliente a un primario RDS).

**Backend NestJS (crons):** puede migrar a otra app Koigrid (o quedarse en Fargate en shadow) en una fase posterior — no es hot path de usuario, riesgo bajo. Prioridad: frontend + BD primero.

---

## 3. Arquitectura destino

```
                    ┌──────────────── Koigrid project "vence-prod" (private networking) ────────────────┐
   usuarios ──TLS──▶│  app "frontend" (Next.js, autoscale min=N/max=M)  ──${{db.main}}──▶  db "main" (PG17, 29GB, HA)  │
                    │        │                                            ──${{redis.cache}}─▶ redis "cache"          │
                    │        └── CDN (estáticos)                                                                      │
                    │  app "backend" (NestJS crons) [FASE POSTERIOR]                                                  │
                    └────────────────────────────────────────────────────────────────────────────────────────────────┘
        buckets: "avatars", "storage" (S3-compatible)   ·   dominio vence.es → app frontend
```

- **DATABASE_URL** = `${{db.main.DATABASE_URL}}` (reference var, resuelto en deploy; readUri en HA → encaja con `getReadDb`/`DATABASE_URL_REPLICA`).
- **Secrets de runtime** (Stripe, OpenAI, Resend, etc.): hoy en SSM `/vence-frontend/*` → pasan a `/apps/{id}/env` (encriptadas) o `${{shared.<KEY>}}` a nivel project.
- **NEXT_PUBLIC_\***: se inlinean en build → se pasan como build env en el deploy de Koigrid (equivalente a los build-args de ECR hoy).
- **Autoscale:** `min` holgado (dimensionar en §6 con el load-test), `max` generoso, `targetCpuPct` ~55-60%.

---

## 4. Fases (cada una reversible; el contenido NO se congela)

| Fase | Qué | Riesgo | Reversible |
|---|---|---|---|
| **K0 — POC plataforma** | App hello-world en Koigrid: deploy, dominio+TLS, autoscale, logs, métricas. Validar mecánica. | 🟢 | Borrar app ($0) |
| **K1 — POC app real + load-test** | Deploy del Next.js real (Pro plan) contra una **BD Koigrid clonada** (branch/restore del dump prod). Load-test al perfil de pico. **GATE GO/NO-GO** (§6). | 🟢 (aislado, no toca prod) | Borrar |
| **K2 — BD en paralelo (CDC)** | Provisionar db "main" en Koigrid (Scale/HA). Replicación lógica RDS→Koigrid (`publications FOR ALL TABLES`). Soak hasta lag≈0. | 🟡 | Parar replicación |
| **K3 — Frontend prod en Koigrid (shadow)** | App frontend prod en Koigrid apuntando a la BD Koigrid (aún replicando desde RDS = read-only sanity). Canaries + smoke contra el dominio de staging. | 🟡 | No enrutar tráfico |
| **K4 — Cutover** | Blue/green: parar writes un instante, promover BD Koigrid (parar replicación), flip DNS `vence.es`→app Koigrid, `DATABASE_URL` ya resuelto. Monitor. | 🟠 | Rollback DNS + reactivar RDS |
| **K5 — Decomiso** | Tras soak 48-72h estable: bajar ECS a 0, apagar RDS (snapshot final), retirar Terraform de infra. Backend crons → Koigrid o quedan en Fargate. | 🟢 | RDS snapshot restaurable |

**Regla de oro:** ninguna fase destruye la anterior hasta soak verde. RDS se mantiene con snapshot final restaurable ≥1 semana post-cutover.

---

## 5. Mapa de variables (inventario a portar)

> Fuente hoy: build-args `NEXT_PUBLIC_*` en `.github/workflows/frontend-deploy.yml` + secrets runtime en SSM `/vence-frontend/*` (helper `ensure_secret`). **Antes de K1: dump exhaustivo de ambos** para no dejar ninguna env fuera (un secret olvidado = 500 en caliente).

```bash
# Runtime secrets (SSM):
aws --profile vence --region eu-west-2 ssm get-parameters-by-path \
  --path /vence-frontend/ --recursive --query 'Parameters[].Name' --output text
# Build-args NEXT_PUBLIC_*: grep en el workflow
grep -oE 'NEXT_PUBLIC_[A-Z_]+' .github/workflows/frontend-deploy.yml | sort -u
```

Categorías: BD (`DATABASE_URL`, `DATABASE_URL_REPLICA` → reference vars Koigrid), Stripe (×2 cuentas Manuel/Nila), OpenAI/OpenRouter, Resend, Upstash→redis Koigrid, Auth.js (RS256 keys/JWKS), SSM tokens varios. **Nada de esto es propietario de AWS** (el diseño agnóstico lo garantiza) → portar = copiar valores a `/apps/{id}/env`.

---

## 6. POC / prueba y simulación — GATE GO/NO-GO (§ crítica)

**No se migra sin pasar esto.** El objetivo es responder empíricamente: *¿$89 (o el plan que sea) aguanta el pico real de Vence con latencia sana?*

### 6.1 Perfil de carga a reproducir
- Pico real medido (memoria `project_frontend_autoscaling_capacidad_21jul`): ALB ~60k req/h sostenido, picos 2×. Franja 10-23h Madrid.
- Reproducir: k6/artillery contra el dominio de staging Koigrid, escalón hasta 2× el pico, mezcla de rutas (home ISR, /test hot-path con queries, /api/answer).

### 6.2 Métricas GO/NO-GO
| Métrica | Umbral GO | Medido | Veredicto |
|---|---|---|---|
| Capacidad en pico | aguantar el pico real (~16,6 rps) | **615 rps con 1 réplica de 2GB** (p50 19ms, p95 50ms, CDN+A3 activos), 838 a conc 50 | ✅ **GO — 37× el pico** (25/07: 8,8 rps saturado; lo desbloqueó el edge-caching de HTML) |
| Errores 5xx bajo pico | < 0,1% | **0,00%** en todas las pasadas, sin saturar, CPU 0% | ✅ **GO** |
| Latencia app→BD co-ubicada | < 5ms/query | **6,45ms** (22/07, instancia Free mínima) | 🟡 casi: por encima del umbral pero irrelevante al lado de los ~40ms de red que ahorra |
| Latencia usuario vs AWS | comparable | **página completa: 1,02-1,15×** (105/136/91ms AWS vs 107/157/100ms) con tamaños ±3% | ✅ **GO — paridad.** (TTFB da 1,4-1,9× pero engaña: base pequeña, ver journey) |
| Réplicas necesarias en pico | ≤ límite del plan | **1** (Pro incluye 5) | ✅ **GO** |
| Coste proyectado @ perfil real | ≤ plan + overage tolerable | **Pro $35/mes** cubre app (2GB), BD (4GB RAM = paridad exacta con nuestra `db.t4g.medium`), 2TB banda (usamos ~400GB) y 100GB storage | ✅ **GO — 14× más barato que los $619 medidos** |
| **Restore del dump completo** | **completa y con datos verificados** | **⏳ EN CURSO 30/07 00:36** (24,7GB SQL / 204 tablas). Lo probado hasta ahora eran 624MB = 1/40 | ⏳ **ÚLTIMO GATE ABIERTO** |
| Recuperación tras burst | ≥ ECS | `resume` de app pausada → sirviendo en **~12-45s**; escalar réplicas ~30s | ✅ GO |
| Redundancia entre máquinas (`scale-out`) | funcional | **roto**: el contenedor de la réplica nunca se crea (7 repros) | ⚠️ **NO bloquea** (1 réplica sobra y el CDN es nuestro), pero sin HA cross-máquina |

### 6.3 Protocolo
1. Clonar BD prod a Koigrid (dump 29GB → restore, o branch si ya hay db Koigrid). **Datos reales**, no sintéticos.
2. Deploy del Next.js real con todas las env (§5) apuntando a esa BD.
3. Warm-up (ISR caches), luego escalón de carga.
4. Medir tabla 6.2. **Cualquier NO-GO rojo → parar y reportar; NO migrar.**
5. Registrar resultado en este manual (§9 bitácora) y en memoria.

**Si NO-GO:** Koigrid se descarta (o se re-evalúa plan superior); Vence se queda en **AWS holgado** (carril 1). Sin drama — el POC costó ~$35-89 de un mes de Pro/Scale, dinero bien gastado por la certeza.

---

## 7. Playbook de cutover (K4) — near-zero-downtime

Mismo patrón que el cutover Supabase→RDS del 04/07 (probado):
1. **Pre:** BD Koigrid replicando desde RDS, lag≈0 sostenido ≥24h. App frontend Koigrid desplegada, canaries verdes contra staging.
2. **Ventana** (hora muerta, ~03:00 Madrid): activar página de mantenimiento breve O aceptar ~30-60s de reintentos (la app ya tiene `localAnswerStore` + reintentos → los usuarios no pierden respuestas).
3. Parar writes a RDS (drenar) → confirmar lag replicación = 0 → **promover** BD Koigrid (parar suscripción lógica, resetear secuencias).
4. Flip DNS `vence.es` → app Koigrid (TTL bajado a 60s con antelación).
5. Monitor 30 min: 5xx, latencia, `alert_fired`, canaries. 
6. **Rollback** (si rojo): DNS de vuelta a ALB + reactivar writes RDS (RDS nunca se tocó como origen de verdad hasta soak verde).

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| $89 no aguanta el pico | Media | Alto | **§6 GATE** antes de cualquier cutover. NO-GO = quedarse en AWS |
| Autoscale reactivo = mismo burst-lag | Alta | Medio | `min` holgado (barato en tarifa plana); dimensionar en §6 |
| Koigrid joven → fiabilidad/soporte | Media | Alto | RDS snapshot + ECS restaurables ≥1 sem; rollback DNS ensayado |
| Env/secret olvidado → 500 caliente | Media | Alto | §5 dump exhaustivo + smoke que ejercita cada integración pre-cutover |
| Latencia cross-provider si híbrido | Alta | Alto | Solo full-Koigrid (§2), nunca híbrido |
| Replicación lógica cross-provider con lag | Media | Medio | Soak K2 hasta lag≈0; ensayar en POC antes de prod |
| Lock-in inverso (a Koigrid) | Baja | Bajo | Todo estándar (Postgres/Docker/S3/Redis) → salida = mismo playbook |

---

## 9. Bitácora de ejecución

> **Nota de lectura (30/07):** las entradas del 22/07 de abajo se conservan como registro, pero **varias de sus conclusiones quedaron superadas**. En concreto: el «$800+ de AWS» era una estimación (lo medido son **$619/mes**), la BD son **33GB** y no 29, y la duda de si «1 app aguanta el pico» está **resuelta con holgura**. El detalle día a día, con las evidencias y el feedback enviado a koigrid, está en **`koigrid-migration-journey.md`**; aquí solo el resumen decisorio.

- **2026-07-25 → 30/07 — SE CIERRAN TODOS LOS GATES TÉCNICOS Y EL COMERCIAL. Queda uno: el restore completo.**
  - **A3 (caché de HTML en el edge) resuelto** → es lo que convierte el veredicto: de **8,8 rps saturado con 1 réplica** (25/07) a **615 rps sin saturar** (29/07), con `s-maxage` a secas honrado. **37× nuestro pico** con una sola réplica de 2GB en plan gratis.
  - **Paridad de latencia con AWS en página completa** (1,02-1,15×), que es la métrica que siente el usuario. El TTFB (1,4-1,9×) exagera la brecha porque parte de una base de 40ms; y la varianza entre pasadas es mayor que la propia diferencia. **Para decidir manda la tabla de página completa.**
  - **Precio publicado y calculado con nuestros números: Pro $35/mes**, con **paridad exacta de RAM de BD** (4GB, igual que la `db.t4g.medium` de RDS) y 5× de margen de banda. Contra **$619/mes medidos en AWS** = ~**$584/mes ≈ $7.000/año**. Hallazgo del desglose: **$40 de nuestro CloudFront son PETICIONES** (43,3M/mes), y koigrid no las mide.
  - **Restore gestionado: A1/A2/B1/B2 y `preSeed` verificados**, con la **primera restauración completa** (61.123 `articles` + 1.404 `laws`, exactos vs RDS, índice ivfflat construido, `owner=app`).
  - **Dos bugs que solo aparecen a tamaño real** (la razón por la que koigrid insistió en el ensayo completo, y tenían razón): **D1** — `preSeed` choca con el `CREATE SCHEMA extensions;` del volcado completo (sin `IF NOT EXISTS`) y muere en la línea 32; en un dump `-t tabla` no pasa porque no hay `CREATE SCHEMA`. **D2** — ese `preSeed` deja un esquema que el rol `app` no puede borrar, así que todo reintento muere igual y hay que **tirar la base**. → **Método correcto para el cutover: restaurar SIN `preSeed` sobre BD limpia.**
  - **D3 — el ensayo estuvo bloqueado 24h por algo suyo:** el almacén de volcados (`koi-db-dumps`) se llenó, y resulta que **vive en la misma flota que el object storage viejo** → 94GB de vídeo subidos a un sitio equivocado tumbaron el *managed restore*. Sin endpoint para borrar volcados y sin que borrar la BD libere el suyo. Reportado; se desbloqueó al borrar ellos la copia vieja.
- **2026-07-30 — STORAGE DE VÍDEOS MIGRADO EN PRODUCCIÓN (primer trozo real del cutover, ya hecho).** Producción lee de `storage.koigrid.com`: 2 secretos en SSM + `KOIGRID_VIDEO_ENDPOINT` en el task def, desplegado como **revisión de solo-variables con el mismo digest de imagen** (`:570`→`:571`) para no arrastrar código ajeno. 8/8 tareas, `200` durante todo el rollout, ~28 min. **Paridad verificada objeto por objeto antes de tocar: 56.691 objetos / 99.137.723.146 bytes idénticos, 0 diferencias.** Vídeos confirmados por Manuel en la app. **Plan B verificado:** los backups locales `~/vence-video-{faststart,hls}` cubren el bucket entero → **NO son borrables** (memoria corregida). **Lección para el cutover grande:** llave y endpoint son **atómicos** (cada mitad por separado da `InvalidAccessKeyId` en todos los objetos), y el patrón «deploy de solo-variables» es la forma de mover configuración sin arrastrar `main`.
- **2026-07-30 — Y una corrección sobre AWS que reordena el ahorro:** el sobrecoste NO se arregla bajando `min-capacity`. Medido: el pico horario son **214 req/target/min contra el objetivo de 250** del autoescalado, así que **de día las 8 tareas son las que pide la política**. Donde sobran es **de noche** (3-6% del objetivo) y eso son ~$25-30/mes, no cientos. Los picos de CPU al 98% tienen postmortem propio (`docs/architecture/incidente-frontend-healthcheck-cascade-21jul.md`): event-loop de Node saturándose por tarea con el RS256 de `/api/auth/token`. **4 de 5 capas del plan están aplicadas** y la telemetría dice que el loop está sano (p99 mediano 22-24ms sobre un suelo de resolución de 20ms). **Cabo abierto más urgente que el dinero: `frontend.tf` dice `min_capacity = 2` y producción está en 8** — un `terraform apply` reabre el incidente de los 504.

- **2026-07-22** — Manual creado + linkado desde agnosticismo. Investigación API: Koigrid = PaaS completo (no solo Postgres); precios verificados; cuenta en Free (1 app demo, 0 DB).
- **2026-07-22 — K2 ESQUEMA REAL ✅ 100% PORTADO (pg_dump RDS→Koigrid, 0 ERRORES).** `pg_dump --schema-only --no-owner --no-privileges` de RDS (via podman `postgres:17`, `--network host`) → aplicado a Koigrid PG17 con **0 errores**. Portó ÍNTEGRO: **195 tablas (191 public + auth), 245 funciones, 30 vistas+matviews, 81 triggers, columnas GENERATED (`is_active`), la state-machine de lifecycle**. **Ningún supabase-ismo rompió.** Esta es la vía real (no drizzle-kit). Herramienta: podman (sin instalar nada); RDS `sslmode=require` (libpq no verifica → OK pese al cert self-signed).
- **2026-07-22 — LÍMITES DE PROVISIÓN medidos (no asumidos):** (a) **Compute (app RAM/CPU) SÍ acepta overPlan** → `PUT /apps/{id}/resources {memoryMb:4096,cpus:2}` en cuenta Free devolvió `overPlan:true, clamped:false` = **pay-later real** (facturación mensual, sin dashboard). (b) **CORRECCIÓN — el disco de BD NO tiene cap duro: es ELÁSTICO con overage.** El `diskGb:1` de la respuesta es el *suelo del plan*, no un techo. **Test empírico: escritos 1.3M filas → BD creció a 1473 MB (1,4GB) SIN error** en cuenta Free. Se factura el exceso a **$0.05/GB** (los 31GB ≈ ~$1.5 de overage de storage). → **Los datos SÍ caben en Free facturando después = pay-later real, igual que el compute.** Mi "cap duro" previo (leído del `diskGb:1` de la respuesta) era ERRÓNEO. `PATCH /databases/{id}` solo renombra pero da igual: no hace falta resize, el disco crece solo. **→ La migración COMPLETA (esquema+datos+frontend) es ejecutable en cuenta Free SIN tocar el dashboard**, con overage facturado a fin de mes. (c) No hay API de plan/billing pero **ya no importa** para migrar (overage cubre disco+compute).
- **2026-07-22 — K2 DDL-compat ✅ PROBADA ($0, BD Free).** Aplicado el esquema Vence a Koigrid PG17: **774 statements OK, 133/135 tablas public + `auth.users`** (el DDL de `db/schema.ts` **crea** `auth.users` → schema auto-contenido/portable, no acoplado externamente; 94 refs `auth.` son FKs a esa tabla). Los **88 fallos = artefactos de `drizzle-kit generate`** (índices con operator-class incorrecto tipo `timestamptz_ops`/`text_ops` sobre columna de otro tipo; 1 default uuid vacío en `verification_queue`) — **fallarían en cualquier Postgres, incluido RDS**, NO son incompatibilidades de Koigrid. **Vía correcta del migration real = `pg_dump --schema-only` de RDS → Koigrid** (fiel, incluye las funciones/triggers/generated de las 160 `.sql` que Drizzle no modela), NO drizzle-kit push (que además es interactivo con views). Estructura + 6 extensiones = 100% compatibles. **Falta para K2-full:** cargar datos (29GB → necesita plan Scale por disco) + replicación lógica desde RDS. El plan de pago es el *coste de la migración misma* ($35-89 plano vs **$619/mes AWS medidos** en Cost Explorer el 30/07 — el «$800+» era una estimación nuestra, no un dato), no un coste de POC.
- **2026-07-22 — CORRECCIÓN 3 (memoria/build, del Dockerfile real):** (a) El frontend usa **Next.js standalone** (imagen ~180-250MB, runtime idle ~150-300MB) → **CABE en Free 512MB; Pro NO es necesario por memoria.** El "2-4GB" era falso. (b) **BLOQUEO REAL del smoke-deploy = build DB-acoplado, no dinero:** `next build` consulta Postgres en `generateStaticParams` + prerender de ~500 páginas SSG (+ pre-scripts `sync-theme-names-from-bd`). Requiere `DATABASE_URL` con **esquema+datos reales**; la BD POC vacía haría fallar el build. → **Confirma el orden K2 (BD poblada) ANTES de K3 (frontend)**; el frontend no se levanta sin BD. Camino sin gasto = seguir por K2. Build-args necesarios: los 24 `NEXT_PUBLIC_*` + `DATABASE_URL`/`DATABASE_URL_REPLICA` + guard que aborta si `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` vacío. Deploy en Koigrid = vía **Dockerfile** (Koigrid lo reusa; standalone) no buildpack.
- **2026-07-22 — CORRECCIÓN + K1 arquitectura ✅ VALIDADA ($0, sin Pro).** Error previo: framear K1 como "bloqueado por pago". **Se PUEDE desplegar cualquier app en Free** vía `source-upload` (CLI `koigrid apps deploy <name> --dir ./`, sin Docker ni git ni dashboard). Desplegada app POC Node (`vence-poc-web`, 512MB/0.5vCPU) que conecta a la BD Koigrid del mismo project. Resultado clave:
  - **Latencia app→BD co-ubicada = `6.45ms`/query** (private network, 20 SELECT secuenciales, instancia Free minúscula). → **VALIDA la arquitectura full-Koigrid (opción B §2):** co-ubicado es sano (~6ms), NO el desastre cross-provider (~90ms). En Pro (2vCPU/4GB) mejoraría.
  - **Reference vars** (`${{db.vence-poc.DATABASE_URL}}`) + **private networking** (project flag) funcionan.
  - **Gotcha TLS documentado:** el reference-var URL trae `sslmode` y `pg` lo trata como `verify-full` → pisa `rejectUnauthorized:false`. Fix POC: `NODE_TLS_REJECT_UNAUTHORIZED=0`; **fix producción: pasar el `caCert`** (de `GET /databases/{id}/connection`) como `ssl.ca`, o `sslmode=verify-ca` con el CA cargado.
  - **Deploy mechanics:** build por buildpack (detecta package.json, `npm install`), ~1-2 min, URL `<slug>.apps.koigrid.com` con TLS auto. Env por API `POST /apps/{id}/env` redespliega.
  - **CORRECCIÓN 2 (memoria, medida en CloudWatch):** el frontend Vence NO usa "2-4GB" (era suposición inflada). Uso REAL: **~700MB media / ~1,7GB pico** (task provisionado 4096MB, util 15-20% avg / 42% max). → Free 512MB no aguanta carga real, pero **al ralentí (~300-450MB) es plausible que arranque y sirva un smoke-test en Free** (medible, no asumir). **Pro NO es necesario para DECIDIR:** el gate de viabilidad ya pasó a $0; el load-test a 2× pico era gold-plating — la prueba de capacidad real es **K3 (shadow con tráfico real)** sobre el plan de migración, con right-sizing según footprint medido. Pagar solo cuando se migre de verdad, no para decidir.
- **2026-07-22 — DB half de K1 ✅ DE-RISKEADA ($0, BD Free `vence-poc`).** Provisión en ~segundos, `running`. **PG 17.2** (prod RDS 17.6, mismo major). **Las 6 extensiones de Vence disponibles y createable:** `pg_stat_statements` v1.11, `pg_trgm` v1.6, `pgcrypto` v1.3, `unaccent` v1.1, `uuid-ossp` v1.1, **`vector` v0.8.0** (pgvector). Connection URI vía `GET /databases/{id}/connection` (write/read/pool ports separados → mapea a `getDb`/`getReadDb`; TLS con caCert propio, usar `sslmode=verify-ca` o `rejectUnauthorized:false` en POC). RTT local→koigrid ~50ms (co-ubicado app→BD sería <5ms, se mide en K1). **BLOQUEO K1-compute:** plan Pro NO se puede subir por API (sin endpoint billing en el OpenAPI; rewards balance $0) → requiere que **el usuario añada método de pago en koigrid.com**. Todo lo demás listo.
- **2026-07-22 — K0 POC plataforma ✅ VALIDADA (vía API, $0).** La app demo (`nginxdemos/hello`, image, running) prueba la mecánica end-to-end: `/apps/{id}` deploy desde imagen OK; control `/resources` (512MB/0.5vCPU), `/autoscale` (min1/max3/target60), `/scale`, `/cdn` responden; `/metrics` da **serie diaria con coste real** (requests/egress por día en céntimos). **Flag amarillo — latencia edge:** demo Koigrid TTFB ~135-160ms (estático, CDN OFF) vs vence.es CloudFront ~47-88ms (~2× desde este punto). No descalifica (falta CDN + regional), pero a vigilar. **Decisivo = K1** (app real + BD co-ubicada). **Siguiente:** K1 requiere DECISIÓN (spend Pro/Scale $35-89 + clonar BD prod 29GB + copiar secrets prod a Koigrid) — no ejecutado unilateralmente. Carril 1 (holgado AWS) sigue siendo el fix del fuego inmediato, independiente de esto.

---

## 10. Checklist

- [x] K0: plataforma validada vía API (app demo running, control endpoints, métricas de coste) — 22/07
- [x] DB half: BD Free PG17 provisionada, 6 extensiones Vence OK (incl. pgvector) — 22/07
- [x] **Deploy real validado ($0):** app POC desplegada vía source-upload; **latencia app→BD co-ubicada 6.45ms** → arquitectura full-Koigrid validada — 22/07
- [ ] Fix TLS producción: `caCert` como `ssl.ca` en la fontanería de BD (no `NODE_TLS_REJECT_UNAUTHORIZED=0`)
- [ ] (opcional $0) smoke-deploy del Next.js real en Free → medir footprint de arranque + latencia hot-path a baja concurrencia
- [x] Right-sizing decidido con datos: **Pro $35/mes** (1-2 réplicas × 2GB, BD 4GB = paridad con RDS, banda 5× de margen) — 29/07
- [ ] Pago en koigrid.com cuando se ejecute (plan **Pro**, medido; no hace falta Scale)
- [x] §5: env mapeado (se usó para el cambio de storage de vídeos) — 30/07
- [x] **K1: Next.js real desplegado contra BD Koigrid** — clon fiel sirviendo, `/api/health` con `database: ok` — 29/07
- [x] **§6: load-test corrido y tabla GO/NO-GO rellenada** — 615 rps con 1 réplica = 37× el pico, 0% errores — 29/07
- [x] **GATE técnico + comercial: GO** (§6.2 con datos). **Falta SOLO el restore del dump completo** (en curso 30/07) para tener la VENTANA DE CUTOVER y poder fijar fecha → decisión final de Manuel
- [ ] K2: BD Koigrid replicando desde RDS, lag≈0 ≥24h
- [ ] K3: frontend prod Koigrid en shadow, canaries verdes
- [x] **Cutover del STORAGE de vídeos ejecutado** (trozo real, paridad verificada, confirmado en la app) — 30/07
- [ ] K4: cutover de app+BD ejecutado, monitor 30min verde
- [ ] Antes de K4 (obligatorio): fix `getClientIp()`/`CF-Connecting-IP` — hoy confía en una cabecera de CloudFront que detrás de nuestro Cloudflare no existe, y debajo corre el antifraude
- [ ] Antes de K4: codificar en Terraform la contención del 21/07 (`min_capacity` real) — hoy `frontend.tf` dice 2 y prod está en 8
- [ ] K5: soak 48-72h → decomiso ECS/RDS (snapshot final guardado)
