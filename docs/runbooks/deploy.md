# Runbook — Deploy (frontend + backend)

> **Fuente única del deploy.** Antes el conocimiento estaba disperso (ARCHITECTURE_ROADMAP + comentarios de scripts + memorias). Aquí está el procedimiento canónico, la arquitectura de assets y el rollback, para front y backend.
>
> **Regla de oro:** desplegar SIEMPRE con el script (`scripts/deploy-{frontend,backend}.sh`), NUNCA a mano. Los scripts pinean la imagen por digest, esperan estabilidad y hacen smoke — un deploy a mano se salta todo eso.

## §0 — Bootstrap de sesión (LO PRIMERO al abrir una sesión de Claude)

> **Si eres una sesión de Claude recién abierta, corre esto ANTES de tocar nada:**
> ```bash
> scripts/session-start.sh <nombre-corto-de-lo-que-vas-a-hacer>
> ```
> Crea tu **propio git worktree** desde `origin/main` (rama `work/<slug>`), enlaza `node_modules`/`.env.local`, te registra, y te dice qué otras sesiones hay activas y si el lock de deploy está tomado. **Trabaja SOLO en ese worktree** — nunca edites el checkout compartido.

**Por qué (modelo de N sesiones simultáneas en el mismo repo):** varias sesiones de Claude a la vez se pisan si comparten checkout (editan los mismos ficheros; un `git add -A` barre lo de otra; un deploy desde una rama **stale** revierte main). La coordinación **NO recae en el humano** — la garantizan tres mecanismos automáticos:

1. **Aislamiento:** 1 worktree + 1 rama por sesión (desde `origin/main`, la última verdad). Ver `feedback_worktree_por_sesion_paralela`.
2. **Serialización de deploy:** `flock` en `/tmp/vence-deploy.lock` dentro de los scripts → dos deploys al mismo servicio ECS NO corren a la vez; el 2º espera. Se libera solo al morir el proceso (sin locks zombi). Lock único front+back.
3. **Anti-stale:** los scripts abortan si tu rama **no contiene** `origin/main` (desplegarías perdiendo trabajo de otra sesión — el casi-clobber del 11/07 con `feat/uc3m-golive`).

**Enviar a prod = 3 pasos (main = única verdad; el tooling serializa):**
```bash
git fetch origin && git rebase origin/main   # 1) reconciliar sobre lo último
git push origin HEAD:main                    # 2) publicar (dispara CI); si lo rechaza por no-ff → repite el paso 1
scripts/deploy-frontend.sh / deploy-backend.sh  # 3) el flock serializa; el gate CI + anti-stale protegen
```
**Regla de convergencia:** "si empujas a main, despliegas". El deploy envía `origin/main` HEAD; con el lock, el último push gana y main↔prod convergen solos.

## TL;DR

```bash
scripts/deploy-frontend.sh   # Next.js (OpenNext) → ECS Fargate + assets a S3
scripts/deploy-backend.sh    # NestJS → ECS Fargate
```

Ambos: build (podman) → push ECR → task def pineada por **digest** clonando la viva (hereda secretos) → `update-service` rolling → `wait services-stable` → **smoke** (falla el deploy si el smoke no pasa).

- **Infra:** cuenta AWS `349744179687`, perfil `vence`, región `eu-west-2`. Cluster ECS `vence-backend`, servicios `vence-frontend` y `vence-backend`. Front y back detrás del **ALB** `vence-backend-alb`, con **CloudFront** (`E1EH4WF1H7ZGLA`, `www.vence.es`) delante del front y `api.vence.es` para el back.
- **GHA auto-deploy DESACTIVADO** (metía builds Supabase por sorpresa). Deploy manual con estos scripts.

## Pre-deploy: árbol limpio + commit pusheado + CI verde (guardarraíles del script)

Desde 07-08/07/2026 los scripts NO despliegan a ciegas. Antes del build comprueban dos cosas y **abortan** si no se cumplen:

1. **Árbol de trabajo LIMPIO** (`git status --porcelain`). El build usa el **WORKING TREE** (podman `COPY . .`), así que un árbol sucio desplegaría cambios a medias — **muy peligroso con sesiones paralelas editando** (ver abajo). Override deliberado: `ALLOW_DIRTY=1`.
2. **CI VERDE en GHA para el SHA de HEAD** (`[gate CI]`). Consulta los check-runs de GitHub Actions del commit y aborta si:
   - **no hay runs** → el commit NO está pusheado (el CI corre en push a `main`; mensaje *"¿Has hecho git push?"*).
   - **algún check de CÓDIGO en ROJO** (unit / typecheck / lint). `integration` **NO** bloquea (señal aparte, ver abajo).
   - **algún check de CÓDIGO aún EN CURSO** → espera a que acabe y reintenta.
   Override: `SKIP_CI_GATE=1` (necesita `GITHUB_PAT` en `.env.local` + `jq`).

**Flujo canónico, por tanto:**
```bash
git add -A && git commit -m "..."     # TODO lo que quieras desplegar (build = working tree)
git push origin main                  # dispara el CI en GHA
# esperar a que el CI de CÓDIGO (unit+typecheck+lint) esté VERDE
scripts/deploy-frontend.sh            # el gate confirma verde y despliega
```
Un commit local **sin pushear NO se puede desplegar** (el gate no encuentra runs). Es intencional: no desplegar código que no pasó CI.

> ⚠️ **El gate exige solo los checks de CÓDIGO verdes (unit+typecheck+lint).** `integration` es una **señal aparte que NO bloquea**: pega a la BD real (readonly) y puede estar en ROJO por motivos de **datos** o por trabajo de **otra sesión** (p.ej. una oposición construida en DB pero aún sin entrada en config, un ratchet de temario de otra sesión, un test de otra feature a medias) — cosas ajenas al código que despliegas. **Decisión tomada (Manuel, 08/07):** el gate del script trata `integration` como informativa (la reporta pero no aborta). Aun así, míralo antes de soltar: si el rojo SÍ es de tu código, arréglalo primero.
>
> ⚠️ **Sincronía script ↔ origin (gotcha real 09/07):** el gate solo-código vive en el **script** `deploy-{frontend,backend}.sh`. Si despliegas desde un checkout de `origin/main` cuyo script sea una versión ANTERIOR (gate "exige todo"), toparás con `integration` roja y el deploy abortará. En ese caso: verifica a mano que unit+typecheck+lint están verdes (GH API del SHA) y usa `SKIP_CI_GATE=1` de forma consciente. Y sincroniza script+manual en origin para que no vuelva a pasar.

## Sesiones paralelas (varias sesiones de Claude a la vez)

> 🆕 **Coordinación automática (desde 11/07/2026):** el pisado entre sesiones ya NO se
> resuelve a mano. Ver **§0 Bootstrap**: worktree-por-sesión + `flock` que serializa los
> deploys + guarda anti-stale en los scripts. Lo de abajo es el CONTEXTO histórico del
> problema; el mecanismo actual es §0. La regla operativa sigue siendo: **commitea tu
> trabajo de forma atómica** (`git add` de TUS ficheros, no `-A` a ciegas).

Varias sesiones trabajan el MISMO repo a la vez y **commitean a `main` local SIN pushear** (checkpoints tipo `chore: checkpoint trabajo pendiente (sesiones paralelas), sin push`). Consecuencias para el deploy:

- **`main` va por delante de `origin`** con trabajo mezclado de varias sesiones. Un `git push` sube TODO ese trabajo acumulado, no solo el de una sesión.
- **El deploy es CUMULATIVO**: build desde working tree/HEAD = el trabajo de TODAS las sesiones. No hay aislamiento por sesión en el momento del deploy.
- Un `git add -A` de una sesión puede **barrer ficheros sin commitear de otra** hacia su checkpoint (pasó el 08/07: un checkpoint paralelo se llevó 4 ficheros de otra sesión). **Commitea tu trabajo de forma atómica** (`git add -u` de tus ficheros, no `-A` a ciegas) para que no se mezcle ni te barran.

**Antes de desplegar con sesiones paralelas activas:**
1. Coordina un **momento de release**: que ninguna sesión esté a media edición → árbol limpio (el guardarraíl te frena si no).
2. Confirma que TODO lo intencional está commiteado y que `main` contiene solo lo que quieres soltar.
3. UN `git push origin main` → esperar CI verde → deploy. **No** pushear/desplegar por sesión de forma descoordinada.

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

## §502 keep-alive (ALB + Node) — causa de 502 intermitentes

**Síntoma:** 502 Bad Gateway intermitentes y CONTINUOS (no solo en deploys), peores en endpoints muy polleados (`/api/auth/token`). El servidor registra 0 5xx (la app responde bien) → es error de EDGE.

**Causa:** el ALB mantiene conexiones keep-alive hasta su `idle_timeout` (**60s**), pero Node cierra las ociosas a los **5s** (default). El ALB reutiliza una conexión que Node ya cerró → 502.

**Fix (aplicado 05/07):** `keepAliveTimeout` del servidor **> idle del ALB**, y `headersTimeout` mayor aún (65s / 66s):
- **Frontend** (Next standalone): wrapper `docker/server-keepalive.cjs` (parchea `http.createServer`), Dockerfile `CMD ["node","server-keepalive.cjs"]`.
- **Backend** (NestJS): `backend/src/main.ts` → `app.getHttpServer().keepAliveTimeout/headersTimeout`.

**Verificar tras deploy:** que bajen los `http_5xx` (status 502) de cliente en `/admin/infraestructura` → "Errores de cliente".

## Gotchas

- El deploy **construye desde el working tree**, no desde git HEAD (podman `COPY . .`). Commitea lo que quieras desplegar; ojo con cambios ajenos sin commitear en el árbol.
- La task def se clona de la **VIVA** (hereda `AUTH_JWT_*`, `JWT_LOCAL_VERIFY_MODE=on`, pooler, secretos) — no hardcodear.
- `SUPABASE_WEBHOOK_SECRET` sigue en los `secrets` del task def frontend (inerte, el código ya no lo lee) — pendiente de limpiar registrando un task def sin él + borrar el param SSM.
- CloudFront tarda minutos en propagar cambios de config; el origin group con ALB-fallback hace que el cambio sea seguro durante la propagación.

## ⚠️ Aprendizaje: verificar si un fix concreto está DESPLEGADO (no fiarse de notas)

**Episodio real (06/07/2026, bug "se me cambia la oposición" de Raquel):** un fix (`cd7a31cb`, "resolver tema por la oposición del usuario, no por Estado fijo") figuraba en una nota de memoria como *"SIN pushear/desplegar"*. Casi se re-preparó su despliegue basándose en esa nota — **pero estaba desactualizada**: el commit ya se había mergeado a `main` Y estaba en el deploy vivo de prod. Se perdió tiempo por confiar en la nota en vez de en el estado real.

**Regla: antes de asumir que un fix está o no desplegado, VERIFÍCALO contra el deploy vivo.** Método:
```bash
# 1. Commit que corre AHORA en prod (campo "deploy"):
curl -s https://www.vence.es/api/health | grep -oE '"deploy":"[a-f0-9]+"'
# 2. ¿El deploy vivo incluye el fix? (¿es el fix ancestro del commit desplegado?)
git merge-base --is-ancestor <commit-del-fix> <commit-desplegado> && echo "DESPLEGADO" || echo "NO desplegado"
# 3. ¿El fix está en main?
git merge-base --is-ancestor <commit-del-fix> main && echo "en main"
```
Las notas de memoria sobre estado de despliegue **envejecen**; el `/api/health` (`deploy`) + `git merge-base` es la fuente de verdad. El backend expone lo mismo en `https://api.vence.es/health`.

**Aprendizaje de contenido (el bug en sí):** hardcodear una oposición por defecto (`auxiliar_administrativo_estado`) en vez de usar el `target_oposicion` del usuario mal-etiqueta el nº de tema para usuarios de OTRA oposición (el tema es relativo a la oposición). Es un bug **silencioso**: solo lo notan los no-Estado y solo en los artículos cuyo tema difiere. **Al probar flujos de test/tema, usar una oposición NO-Estado** (Madrid, Cantabria…), no la de por defecto, o estos bugs pasan desapercibidos.

## ⚠️ Aprendizaje: `NEXT_PUBLIC_*` leído DINÁMICAMENTE en el server necesita estar en el RUNTIME (task def), no solo en build

**Episodio real (07/07/2026, pagos caídos — incidente half-flip Nila, memoria `project_stripe_halfflip_nila_incidente`):** el refactor multi-cuenta de Stripe pasó de leer los precios con acceso **estático** (`process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`) a **dinámico** (`process.env[nombreVar]`). Resultado: **toda alta de premium daba 400** (`price_account_mismatch`) porque el server veía `undefined`. Costó horas de diagnóstico; el Stripe CLI no lo cazó (prueba el webhook, no la creación de checkout).

**La regla de Next.js que hay que tener presente:**
- **Acceso estático** `process.env.NEXT_PUBLIC_FOO` → Next lo **inlinea en build** (sustituye por el literal) tanto en cliente como en server → funciona en runtime aunque la var no exista en el entorno de ejecución.
- **Acceso dinámico** `process.env[algo]` (con variable, en bucle, con nombre computado) → Next **NO lo inlinea** → en el server se lee del `process.env` de **runtime**. Si la var no está en el entorno de ejecución, es `undefined`.

**Y en nuestro Docker multi-stage:** `ENV NEXT_PUBLIC_*` está en el stage **builder** (para que `next build` hornee el bundle **cliente** y resuelva los accesos estáticos). **Esos ENV NO se propagan al stage `runner`.** Por tanto el entorno de **runtime** del server = **el task def de ECS** (`environment` + `secrets` SSM), NO el ENV del builder. (Comprobar lo horneado en una imagen: `podman image inspect <img> --format '{{range .Config.Env}}{{println .}}{{end}}'`.)

**Regla operativa:** si añades (o un refactor introduce) una dependencia **server-side** de una `NEXT_PUBLIC_*` vía **acceso dinámico**, esa var **debe** ir al `environment` del task def — cablearla en el bloque de construcción del task def de `scripts/deploy-frontend.sh` (como se hace con los secretos SSM de Nila y con los 6 `NEXT_PUBLIC_STRIPE_PRICE_*`). Los IDs de precio son públicos → `environment` plano; algo secreto → SSM `secrets`. Grep rápido de riesgo: `grep -rE "process\.env\[" app lib` en código que corre en server.

**Deploy solo-de-runtime-config (env del task def, sin cambiar imagen):** es legítimo registrar una nueva revisión del task def (clonando la viva + añadiendo el env) y `update-service`, sin rebuild — es más rápido que el script y AWS-native. PERO te saltas el **smoke** del script: ejecútalo a mano (`home=200`, `/api/auth/token=401`, un chunk 200) y deja el cambio **también** en el deploy script para que persista en el próximo deploy canónico. La regla "usar siempre el script" sigue valiendo para cambios de **código/imagen**.

**Gap de observabilidad detectado:** el canary de Stripe (`CanaryStripeWebhookModule`) solo vigila el **webhook**, no la **creación de checkout** → esta caída pasó desapercibida hasta el feedback de usuarias. Pendiente: sintético/canary de `create-checkout` o alerta por pico de 400 `price_account_mismatch`. Ver `observability.md`.

## Relacionados
- `project_stripe_halfflip_nila_incidente` (memoria) — incidente pagos 07/07: `NEXT_PUBLIC` dinámico + runtime env.
- `project_deploy_freeze_chunks_s3` (memoria) — causa raíz + fix del congelamiento.
- `docs/ARCHITECTURE_ROADMAP.md` — contexto de la migración a AWS/Fargate.
- `docs/runbooks/observability.md` — qué mirar tras un deploy (errores client/server in-house).
