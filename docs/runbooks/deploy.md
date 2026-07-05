# Runbook — Deploy (frontend + backend)

> **Fuente única del deploy.** Antes el conocimiento estaba disperso (ARCHITECTURE_ROADMAP + comentarios de scripts + memorias). Aquí está el procedimiento canónico, la arquitectura de assets y el rollback, para front y backend.
>
> **Regla de oro:** desplegar SIEMPRE con el script (`scripts/deploy-{frontend,backend}.sh`), NUNCA a mano. Los scripts pinean la imagen por digest, esperan estabilidad y hacen smoke — un deploy a mano se salta todo eso.

## TL;DR

```bash
scripts/deploy-frontend.sh   # Next.js (OpenNext) → ECS Fargate + assets a S3
scripts/deploy-backend.sh    # NestJS → ECS Fargate
```

Ambos: build (podman) → push ECR → task def pineada por **digest** clonando la viva (hereda secretos) → `update-service` rolling → `wait services-stable` → **smoke** (falla el deploy si el smoke no pasa).

- **Infra:** cuenta AWS `349744179687`, perfil `vence`, región `eu-west-2`. Cluster ECS `vence-backend`, servicios `vence-frontend` y `vence-backend`. Front y back detrás del **ALB** `vence-backend-alb`, con **CloudFront** (`E1EH4WF1H7ZGLA`, `www.vence.es`) delante del front y `api.vence.es` para el back.
- **GHA auto-deploy DESACTIVADO** (metía builds Supabase por sorpresa). Deploy manual con estos scripts.

## Frontend — arquitectura de assets (CRÍTICO: por qué no se congela al desplegar)

**Problema histórico (05/07/2026):** los chunks `_next/static/*` se servían desde el **contenedor efímero**. Cada deploy reemplazaba el contenedor → chunks viejos 404 → `ChunkLoadError` → **app congelada** para usuarios en el bundle anterior (caso Nila). Ver memoria `project_deploy_freeze_chunks_s3`.

**Solución (en el script, NO tocar sin entender):**
1. **Assets en S3 con retención.** Paso `[2b]` del script: extrae `.next/static` de la imagen (`podman cp`) y `aws s3 sync` al bucket **`vence-frontend-static`** (privado, OAC `EQ1WY9CD6NF8M`) **SIN `--delete`** → los chunks de bundles viejos NUNCA desaparecen (modelo inmutable tipo Vercel). Self-check: si un chunk no llegó a S3, **aborta el deploy**.
2. **CloudFront** `/_next/static/*` → **origin group `vence-static-group`** = **S3 primario + ALB fallback** (failover 403/404/5xx). Aditivo-seguro: si falta en S3, cae al ALB (contenedor) = comportamiento previo.
3. **Red de seguridad cliente:** `lib/observability/client.ts` detecta `ChunkLoadError` y hace `window.location.reload()` (anti-bucle 30s). Convierte cualquier residual en, como mucho, una recarga.

> ⚠️ **NO** volver a servir `_next/static` solo desde el contenedor, **NO** quitar el sync a S3, **NO** añadir `--delete`, **NO** cambiar el behavior de CloudFront a solo-ALB. El guardrail `__tests__/guardrails/deploy-scripts.test.ts` lo bloquea.

El **version-check** (`hooks/useVersionCheck.ts`) fuerza reload al cambiar de versión, DIFIRIÉNDOLO en rutas de test para no interrumpir exámenes. Eso controla *cuándo* recarga el usuario, no la existencia de los chunks (por eso hace falta el S3).

## Backend

`scripts/deploy-backend.sh`: build `./backend` → push ECR `vence-backend` → task def por digest → rolling → estable → **smoke `GET https://api.vence.es/health` = 200**. No tiene assets estáticos de cliente (sin problema de chunks). Los crons NestJS se registran al arrancar (verlo en logs `/ecs/vence-backend`: "Nest application successfully started" + "Cron '…' registrado").

## Smoke (qué valida cada script)

| | Frontend | Backend |
|---|---|---|
| Home / health | `www.vence.es/` = 200 | `api.vence.es/health` = 200 |
| Auth gate | `/api/auth/token` sin sesión = 401 | — |
| Assets | un chunk de la home carga 200 vía CloudFront; chunk del build presente en S3 | — |

Gate extra de auth recomendado tras deploy front: `node scripts/fase-b-auth-surfaces-check.cjs` (regular+admin+finance).

## Rollback

- **Frontend/Backend ECS:** `aws ecs update-service --cluster vence-backend --service vence-{frontend,backend} --task-definition <TASKDEF_ANTERIOR> --profile vence --region eu-west-2`. El script imprime el task def anterior (`LIVE_TD`) al final.
- **CloudFront** (si se rompió el origin group): restaurar desde el backup de config + ETag (guardar antes de tocar). El de la migración a S3 quedó en scratchpad `cf-config-backup.json`.
- Rollback = instantáneo (task defs previas siguen registradas; imágenes previas siguen en ECR por digest).

## Gotchas

- El deploy **construye desde el working tree**, no desde git HEAD (podman `COPY . .`). Commitea lo que quieras desplegar; ojo con cambios ajenos sin commitear en el árbol.
- La task def se clona de la **VIVA** (hereda `AUTH_JWT_*`, `JWT_LOCAL_VERIFY_MODE=on`, pooler, secretos) — no hardcodear.
- `SUPABASE_WEBHOOK_SECRET` sigue en los `secrets` del task def frontend (inerte, el código ya no lo lee) — pendiente de limpiar registrando un task def sin él + borrar el param SSM.
- CloudFront tarda minutos en propagar cambios de config; el origin group con ALB-fallback hace que el cambio sea seguro durante la propagación.

## Relacionados
- `project_deploy_freeze_chunks_s3` (memoria) — causa raíz + fix del congelamiento.
- `docs/ARCHITECTURE_ROADMAP.md` — contexto de la migración a AWS/Fargate.
- `docs/runbooks/observability.md` — qué mirar tras un deploy (errores client/server in-house).
