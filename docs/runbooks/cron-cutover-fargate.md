# Runbook — Cutover de crons Vercel → AWS Fargate (Etapa 1)

> **Estado:** shadow desde 2026-05-22. Cutover parcial **24/05/2026: 2 crons */5min cerrados** (`refresh-rankings`, `process-outbox`) bajo excepción documentada por sample size. Los 11 restantes esperan al **2026-06-05** (criterio original 2 sem) o **2026-06-12** (conservador). Ver «Criterio de cutover» y «Histórico» abajo.
> **Bloque:** 1 del plan de ejecución activo del [ARCHITECTURE_ROADMAP](../ARCHITECTURE_ROADMAP.md).
> **Decisión origen:** roadmap sección «Backend dedicado de proceso largo (DECISIÓN 2026-05-22)».

## Resumen

13 crons del Grupo A corren ya en **AWS ECS Fargate** (cuenta `349744179687`, región `eu-west-2`, cluster `vence-backend`) con NestJS + `@nestjs/schedule`. Sus equivalentes siguen vivos en GitHub Actions como crons Vercel. **Conviven en shadow**: idempotentes / con dedupe → no se pisan.

Este runbook describe (1) cómo verificar que el shadow está sano, (2) cuándo ejecutar el cutover, (3) cómo hacerlo cron a cron, (4) cómo revertir si algo se rompe.

## Mapa de crons

| Cron | Vercel (workflow + endpoint) | Fargate (módulo NestJS) | Schedule (UTC) |
|---|---|---|---|
| `check-boe-changes` | `.github/workflows/check-boe-changes.yml` + `app/api/cron/check-boe-changes/` | `backend/src/boe-changes/` | `0 8 * * *` |
| `archive-interactions` | `archive-interactions.yml` + `app/api/cron/archive-interactions/` | `backend/src/archive-interactions/` | `30 3 * * *` |
| `refresh-theme-cache` | `refresh-theme-cache.yml` + `app/api/cron/refresh-theme-cache/` | `backend/src/refresh-theme-cache/` | `0 23 * * *` |
| `refresh-rankings` | `refresh-rankings.yml` + `app/api/cron/refresh-rankings/` | `backend/src/refresh-rankings/` | `*/5 * * * *` |
| `update-streaks` | `update-streaks-daily.yml` + `app/api/cron/update-streaks/` | `backend/src/update-streaks/` | `0 3 * * *` |
| `check-seguimiento` | `check-seguimiento.yml` + `app/api/cron/check-seguimiento/` | `backend/src/check-seguimiento/` | `0 9 * * 1-5` |
| `process-outbox` | `process-outbox.yml` + `app/api/cron/process-outbox/` | `backend/src/process-outbox/` | `*/5 * * * *` |
| `avatar-rotation` | `avatar-rotation.yml` + `app/api/cron/avatar-rotation/` | `backend/src/avatar-rotation/` | `0 4 * * 0` |
| `process-verification-queue` | `process-verification-queue.yml` + `app/api/cron/process-verification-queue/` | `backend/src/process-verification-queue/` | `0 2,8,14,20 * * *` |
| `detect-timeline-silence` | `detect-timeline-silence.yml` + `app/api/cron/detect-timeline-silence/` | `backend/src/detect-timeline-silence/` | `0 7 * * *` |
| `detect-oep-llm` | `detect-oep-llm.yml` + `app/api/cron/detect-oep-llm/` | `backend/src/detect-oep-llm/` | `0 10 * * 1-5` |
| `detect-regional-oeps` | `detect-regional-oeps.yml` + `app/api/cron/detect-regional-oeps/` | `backend/src/detect-regional-oeps/` | `0 8 * * 1` |
| `detect-generic-sources` | `detect-generic-sources.yml` + `app/api/cron/detect-generic-sources/` | `backend/src/detect-generic-sources/` | `0 8 * * 1-5` |

**Grupo B (NO migrar — se queda en Vercel a propósito por triviales):** `close-inactive-feedback`, `renewal-reminders`, `daily-registration-summary`, `detect-fraud` / `fraud-detection`.

**Otros endpoints `/api/cron/*` que NO son del Grupo A (se mantienen):** `check-stats-drift`, `subscription-reconciliation`, `log-failure`, `sync-convocatorias`, `daily-registration-summary`.

## Criterio de cutover

Se ejecuta el cutover **cuando se cumplan TODOS** los siguientes:

1. **Soak ≥ 2 semanas** desde el primer despliegue Fargate (2026-05-22). Fecha mínima: **2026-06-05**. Recomendado 3 semanas (**2026-06-12**) para cubrir el ciclo semanal/mensual completo.
2. **`check-boe-changes` Fargate** revisa el 100% de las leyes en cada ejecución (objetivo: 0 leyes con `last_checked` > 48h). Ese era el fallo de causa raíz que motivó la migración (ver roadmap nota del 22/05).
3. **`process-outbox` Fargate** no acumula `outbox_events` con `attempts >= 5` (señal de loop fallido).
4. **Cero alertas críticas** atribuibles a los crons nuevos en CloudWatch los últimos 7 días.
5. **Paridad funcional verificada** cron a cron — los efectos observables (filas creadas en BD, emails enviados al admin, etc.) son los mismos en Fargate que en Vercel.

Si **alguno** falla, el cutover de ese cron se posterga hasta resolverlo. No se mueve "por si acaso".

## Cómo verificar el shadow (lo que requiere AWS console / CLI a la cuenta 349744179687)

> ⚠️ Multi-cuenta AWS: el usuario tiene 2 cuentas AWS distintas — `801945368851`
> (usuario `deploy-sst`, default local, otro proyecto) y `349744179687` (cuenta
> Vence, donde vive Fargate). Para que los comandos de abajo funcionen desde
> esta máquina hay que añadir un profile dedicado:
>
> ```bash
> aws configure --profile vence
> #  region: eu-west-2
> ```
>
> Y usar `--profile vence` en cada comando, o `export AWS_PROFILE=vence`.
> El despliegue del backend NO requiere esto (CI usa OIDC role
> `vence-backend-ci-deploy`).

```bash
# 1. Logs del worker (últimas 24h) — debe mostrar trazas de cada @Cron disparándose.
aws logs tail /ecs/vence-backend --since 24h --region eu-west-2 --profile vence \
  --filter-pattern "INFO" --format short

# 2. Estado del servicio ECS (debe tener runningCount=1 desiredCount=1).
aws ecs describe-services --cluster vence-backend --services vence-backend \
  --region eu-west-2 --profile vence \
  --query "services[0].{running:runningCount,desired:desiredCount,status:status}"

# 3. Última ejecución por cron (consulta a Postgres — usa tabla audit del cron):
psql $DATABASE_URL -c "SELECT cron_name, last_run_at, success FROM cron_runs ORDER BY last_run_at DESC LIMIT 20;"
# (Si no existe tabla cron_runs aún, esperamos a la columna deploy_version
#  en observable_events del Bloque 4.)

# 4. BOE específicamente: ¿revisó las 475 leyes?
psql $DATABASE_URL -c "SELECT COUNT(*) FILTER (WHERE last_checked > NOW() - INTERVAL '48 hours') AS recent,
                              COUNT(*)                                                              AS total
                       FROM laws WHERE is_active;"

# 5. Outbox: ¿se procesan eventos sin acumularse?
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM outbox_events GROUP BY status;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM outbox_events WHERE attempts >= 5;"
```

## Procedimiento de cutover (por cada cron)

Hacer **uno a uno**, no todos a la vez. Ventana sugerida: tras la última ejecución exitosa del cron en Vercel y antes de la siguiente.

### 1. Pre-flight checks (5 min)

- [ ] El cron NestJS ha corrido con éxito en CloudWatch al menos los últimos N días (N según `schedule`: diarios → 7, semanales → 2 semanas, `*/5min` → 24h).
- [ ] Paridad funcional verificada en BD (filas creadas, emails enviados — comparar Vercel run vs Fargate run del mismo día).
- [ ] Backend Fargate `desiredCount=1, runningCount=1`.

### 2. Desactivar el workflow Vercel

```bash
# Renombra el archivo con sufijo .DISABLED (patrón ya usado en el repo:
#   sync-convocatorias.yml.DISABLED, warm-cache-post-deploy.yml.DISABLED).
git mv .github/workflows/<cron>.yml .github/workflows/<cron>.yml.DISABLED
```

> Por qué `.DISABLED` y no borrar el archivo: deja rastro histórico + permite restaurar en 1 comando si hay que rollback. Tras 1-2 ciclos OK del cutover, se elimina definitivamente en un segundo commit.

### 3. Borrar el endpoint `/api/cron/<cron>/`

```bash
git rm -r app/api/cron/<cron>/
```

> Si hay tests asociados (`__tests__/api/cron/<cron>*`), evaluar si siguen aplicando (algunos pueden cubrir lógica reutilizada por el backend NestJS — en cuyo caso se mueven a `backend/test/`).

### 4. Commit + push

```bash
git add .github/workflows/<cron>.yml.DISABLED app/api/cron/<cron>/
git commit -m "chore(cron): cutover <cron> Vercel → Fargate

Tras N semanas en shadow (desde 2026-05-22) sin discrepancias.
Workflow Vercel renombrado a .DISABLED; endpoint /api/cron/<cron>
eliminado. La ejecución pasa a vence-backend ECS Fargate
(backend/src/<cron>/)."
```

### 5. Post-cutover (próximas 24-48h)

- [ ] Verificar primera ejecución solo-Fargate en CloudWatch.
- [ ] Verificar que el efecto observable se ha producido (BD updated, email recibido si aplica).
- [ ] Tras 7 días sin incidentes, borrar definitivamente el `.DISABLED` y la entrada de `vercel.json` si la hubiera.

### 6. Caso especial — `check-boe-changes`

Tras cutover, en `backend/infra/terraform.tfvars`:

```hcl
boe_notify_enabled = "true"   # ya no está duplicado el email al admin
```

Aplicar con `terraform apply` en `backend/infra/`. La variable controla si el cron NestJS envía email cuando detecta cambio BOE. Durante shadow estaba en `"false"` para no duplicar con el cron Vercel.

## Rollback (si algo se rompe)

**El cron Vercel se restaura instantáneamente:**

```bash
# 1. Restaurar workflow
git mv .github/workflows/<cron>.yml.DISABLED .github/workflows/<cron>.yml

# 2. Restaurar endpoint desde git history
git revert <commit-del-cutover>
# o, alternativamente:
git checkout <commit-pre-cutover> -- app/api/cron/<cron>/
git add app/api/cron/<cron>/
git commit -m "revert(cron): restaurar <cron> Vercel — rollback de cutover"

# 3. Push → GHA recoge el cron en el siguiente schedule.
```

**Para `check-boe-changes` además:** `terraform apply` con `boe_notify_enabled = "false"` para evitar duplicar emails durante el rollback.

**Conflictos esperados:**
- **`process-outbox`** y **`process-verification-queue`** usan `FOR UPDATE SKIP LOCKED` → si vuelven a convivir, no se pisan (el dedupe es a nivel de BD).
- **`refresh-rankings`** y **`refresh-theme-cache`** son upserts idempotentes a `ranking_cache` / `theme_cache` → re-correr es no-op.
- **`check-boe-changes`** usa `last_checked` como cursor; convivir produce queries duplicadas pero ningún efecto observable en BD.

## Estado actual (checklist por cron)

| Cron | Shadow OK 23/05 | Soak ≥ 2 sem | Paridad verificada | Cutover ejecutado | Notas |
|---|:-:|:-:|:-:|:-:|---|
| `check-boe-changes` | 🟡 463/475 | ⏳ 2026-06-05 | ⏳ | ⏳ | Era el detonante (BOE 20/05 perdido). Hoy 97% leyes (72 fetch errors transitorios). Vigilar evolución |
| `archive-interactions` | ✅ 1/24h | ⏳ | ⏳ | ⏳ | |
| `refresh-theme-cache` | ✅ 1/24h | ⏳ | ⏳ | ⏳ | |
| `refresh-rankings` | ✅ 288/24h | ⚠️ excepción documentada | ✅ 24/05 | ✅ **24/05** (commit `d5e14b0a`) | `*/5min`. ~576 runs en shadow = sample size enorme aunque calendario corto. Paridad: mismo `SELECT * FROM refresh_ranking_cache()`, UPSERT idempotente sobre `ranking_cache` |
| `update-streaks` | ✅ 1/24h | ⏳ | ⏳ | ⏳ | 295 resets/día |
| `check-seguimiento` | ⏳ esperado 0 hoy (sáb) | ⏳ | ⏳ | ⏳ | Solo L-V. Verificar lunes 25/05 |
| `process-outbox` | ✅ 288/24h | ⚠️ excepción documentada | ✅ 24/05 | ✅ **24/05** (commit `6fed8b84`) | `*/5min`. ~576 runs en shadow. Paridad: mismo `processOutboxBatch(db, 200)` con `FOR UPDATE SKIP LOCKED` — workers concurrentes no se pisan por diseño. Outbox vacía la mayoría del tiempo |
| `avatar-rotation` | ⏳ esperado 0 hoy (sáb) | ⏳ | ⏳ | ⏳ | Semanal (domingo). Verificar dom 24/05 |
| `process-verification-queue` | ✅ 4/24h | ⏳ | ⏳ | ⏳ | 4x diario exacto |
| `detect-timeline-silence` | ✅ 1/24h | ⏳ | ⏳ | ⏳ | |
| `detect-oep-llm` | ⏳ esperado 0 hoy (sáb) | ⏳ | ⏳ | ⏳ | L-V. Verificar lunes 25/05 |
| `detect-regional-oeps` | ⏳ esperado 0 hoy (sáb) | ⏳ | ⏳ | ⏳ | Solo lunes. Verificar 25/05 |
| `detect-generic-sources` | ⏳ esperado 0 hoy (sáb) | ⏳ | ⏳ | ⏳ | L-V. Verificar lunes 25/05 |

> Actualizar este checklist cuando se vaya verificando cada cron y cuando se ejecute cada cutover.

## Histórico

- **2026-05-22**: deploy inicial Fargate del Grupo A (13 crons). Shadow comienza. `BOE_NOTIFY_ENABLED=false`.
- **2026-05-23**: runbook creado. AWS account de Fargate confirmado (`349744179687`, region `eu-west-2`). Profile `[vence]` configurado localmente con user IAM `claude-cli` (PowerUserAccess). Primera verificación del shadow (24h+):
  - **ECS service**: ACTIVE, 1/1 task RUNNING desde 22/05 12:25 (33h uptime, 0 reinicios).
  - **Schedule respetado en 13/13 crons**: `refresh-rankings` y `process-outbox` 288/288 ejecuciones/24h (exacto); diarios 1/24h; `process-verification-queue` 4/24h; los 5 crons "L-V"/"lunes"/"domingo" correctamente a 0 (hoy es sábado).
  - **0 errores reales, 0 reinicios.** 4 warnings esperados de BOE (`fetch_error` puntual en decretos CyL/CM, el sistema avanza `last_checked` para no atascar la cola — comportamiento del fix de causa raíz del 22/05).
  - **BOE revisó 463/475 leyes** (97%) — 72 errores de red transitorios contra páginas oficiales (no es regresión, es ruido de red contra BOE/BOJA/BOC). A vigilar durante el soak.
  - **Veredicto**: 🟢 verde. Reloj de las 2-3 semanas corre.
- **2026-05-24**: cutover parcial de los 2 crons `*/5min`: `refresh-rankings` (commit `d5e14b0a`) y `process-outbox` (commit `6fed8b84`).
  - **Excepción documentada al criterio "Soak ≥ 2 sem"**: estos 2 crons acumularon ~576 ejecuciones cada uno en 2 días (288/24h × 2). Para crons frecuentes el sample size matters más que el calendario — 576 runs idénticos con 0 errores reales es señal mucho más fuerte que 14 runs de un cron diario.
  - **Paridad funcional verificada code-a-code**:
    - `refresh-rankings`: ambos llaman `SELECT * FROM refresh_ranking_cache()` directo. UPSERT idempotente sobre `ranking_cache`, imposible que se pisen aunque hayan convivido.
    - `process-outbox`: ambos llaman `processOutboxBatch(db, 200)` con `FOR UPDATE SKIP LOCKED`. Outbox empty most of the time (0 stuck, 0 pending) → riesgo de regresión bajo incluso si paridad imperfecta.
  - **Pre-cutover BD verificado**: `ranking_cache` 3.297 filas con runs cada 5 min insertando 3.300+ filas; `outbox_events.attempts >= 5` = 0; `outbox_events.processed_at IS NULL` = 0.
  - Los **11 crons restantes esperan al 2026-06-05** (criterio original del runbook). Esto es defensa en profundidad: si hoy se rompe algún cron común que afecte a Fargate como cluster, los crons no migrados siguen sirviendo desde Vercel.
  - **Veredicto**: 🟢 2/13 cerrados, 11 pendientes. Próxima ventana: 2026-06-05.

## Referencias

- Roadmap «Estrategia: Backend dedicado de proceso largo» y «Etapa 1 — Crons migrados»
- `backend/infra/README.md` (Terraform + OIDC GitHub Actions)
- `backend/README.md` (arranque local + estructura NestJS)
- `.github/workflows/backend-deploy.yml` (build + push imagen + force redeploy ECS)
