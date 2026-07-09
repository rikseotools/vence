# Runbook — Pusheo, revisión y despliegue (frontend + backend)

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

> **CI — dónde corre:** el workflow (`.github/workflows/test.yml`) dispara en **`pull_request` y push a `main`**, NO en push de una rama suelta. Para tener CI sobre una feature-branch (worktree, ver abajo) hay que **abrir un PR** — aunque seas solo tú: el PR es el mecanismo que dispara el CI, no una ceremonia de aprobación.

> ⚠️ **El gate exige solo los checks de CÓDIGO verdes (unit+typecheck+lint).** `integration` es una **señal aparte que NO bloquea**: pega a la BD real (readonly) y puede estar en ROJO por motivos de **datos** o por trabajo de **otra sesión** (p.ej. una oposición construida en DB pero aún sin entrada en config, un ratchet de temario de otra sesión, un test de otra feature a medias) — cosas ajenas al código que despliegas. **Decisión tomada (Manuel, 08/07):** el gate del script trata `integration` como informativa (la reporta pero no aborta). Aun así, míralo antes de soltar: si el rojo SÍ es de tu código, arréglalo primero.
>
> ⚠️ **Sincronía script ↔ origin (gotcha real 09/07):** el gate solo-código vive en el **script** `deploy-{frontend,backend}.sh`. Si despliegas desde un checkout de `origin/main` cuyo script sea una versión ANTERIOR (gate "exige todo"), toparás con `integration` roja y el deploy abortará. En ese caso: verifica a mano que unit+typecheck+lint están verdes (GH API del SHA) y usa `SKIP_CI_GATE=1` de forma consciente. Y sincroniza script+manual en origin para que no vuelva a pasar.

## Sesiones paralelas (varias sesiones de Claude a la vez)

> 🔑 **Distinción clave — pushear a `main` ≠ desplegar** (causa de confusión 09/07, dos sesiones lo leían opuesto):
> - **Pushear a `main`** = estacionar + disparar el CI. Es **reversible** (revert) y **seguro**. Se hace **cuando TU tarea está COMPLETA** (integrada + testeada), sin esperar a nadie. `main` es el punto de integración; que varias sesiones metan cosas es normal. **No hace falta PR** (el CI también corre en push a `main`; el PR solo sirve para tener CI en una rama ANTES de mergear).
> - **Desplegar** = coger el estado ACTUAL de `main` y mandarlo a prod. **Es el ÚNICO acto que se coordina**: se despliega cuando `main` tiene solo lo que quieres soltar y ninguna sesión está a media integración. El deploy es cumulativo (sube TODO lo de `main`), por eso solo se sube trabajo COMPLETO a `main`.
> - **Regla:** "mete X en main" (por sesión, al cerrar tarea) es libre; "despliega todo" (coordinado) es aparte. No encadenes el deploy al merge de UNA feature si hay otras sesiones activas.

**Convención (desde 09/07): un git worktree + rama por sesión** — directorio propio, misma `.git`. Ninguna sesión toca los ficheros de otra. Es la solución al lío de compartir el mismo directorio (stash / merge / colisiones / barrer WIP ajeno). Detalle: memoria `feedback_worktree_por_sesion_paralela`.

```bash
git fetch origin
git worktree add -b feat/<tarea> <ruta-fuera-del-repo> origin/main   # rama desde origin limpio
cp  <repo>/.env.local  <wt>/.env.local        # un worktree NO trae gitignored (o symlink)
ln -s <repo>/node_modules <wt>/node_modules   # deps compartidas; QUITAR antes de `podman build`
```
- **Cierre de tarea:** cherry-pick del commit sobre `origin/main` (en un worktree) o merge del branch; **NUNCA** pushear el `main` local divergente (arrastra duplicados de otras sesiones).
- **Deploy:** SIEMPRE desde un checkout **LIMPIO de `origin/main`** (worktree con `.env.local`), no desde el dir compartido con WIP a medias — el build es `COPY . .` del working tree, así que un árbol sucio mete trabajo ajeno en la imagen.
- **RDS desde tsx/jest en el worktree:** `NODE_TLS_REJECT_UNAUTHORIZED=0` al ARRANCAR el proceso + URL con `sslmode=no-verify` (Node cachea el flag; postgres.js valida el cert self-signed).

**Modelo VIEJO (compartir el mismo directorio — EVITAR):** commitear a `main` local sin push y trabajar todos en `/home/manuel/Documentos/github/vence` provoca que cambiar de rama / `git add -A` / stash intercambie o barra ficheros de otras sesiones (08/07: un checkpoint se llevó 4 ficheros ajenos). Si por lo que sea trabajas ahí: **commit atómico** (`git add -u` de TUS ficheros, nunca `-A`) y **árbol limpio** antes de desplegar (el guardarraíl te frena si no).

## Capas de seguridad obligatorias (toda feature / fix)

Por defecto, TODA feature o fix lleva estas capas; **saltarse una se JUSTIFICA**, no al revés (un fix de una línea de copy no necesita canary; una feature sí todo):
1. **Unit** — lógica pura, importando la función **REAL** de producción (nunca una copia: una copia da falso verde cuando el código real cambia o desaparece).
2. **Integración** — el camino real contra la BD (INSERT/SELECT reales), gated si el entorno lo exige (`INTEGRATION_DB_WRITABLE=1`; el CI de integración es read-only).
3. **Simulación con datos reales** — replayear el caso del usuario/incidente por la lógica arreglada y verificar end-to-end (read-only), no solo casos sintéticos.
4. **Canary** — sintético contra infra viva que **VERIFICA en BD el invariante** (no solo que el endpoint responde 200). Si el fixture no ejercita el invariante, el canary es ciego → arreglarlo.
5. **Guardrail** — contrato/esquema (p.ej. afirmar que una columna está mapeada en Drizzle — caza el schema-drift que el typecheck no ve; o el cableado de una feature por lectura de código, sin BD → corre en CI).

**Clave (lección 09/07):** las capas solo valen si cubren **superficies DISTINTAS**, no el mismo slice 5 veces — la capa que tocas **+ las de al lado que ve el usuario** (conteos, selectores) + las **combinaciones** + el **timing de cliente**. Detalle: memoria `feedback_feature_multiples_capas_seguridad`.

## Antes de mergear: revisión independiente (features/fixes no triviales)

Los tests que escribe el autor se agrupan alrededor de lo que el autor cambió y de su modelo mental → **heredan sus puntos ciegos**. Por eso, antes de mergear a `main`, una **revisión adversarial por un agente FRESCO** (sin contexto de autor) sobre el diff, con el mandato de **romperlo**:
- Testear la **superficie que ve el USUARIO**, no solo la capa que tocaste (endpoints de al lado, conteos, selectores).
- Las **combinaciones** (flag + selección manual…), el **timing de cliente**, y los casos límite (datos vacíos/virtuales, inyección).
- **Regla:** si el auditor encuentra algo que tus tests no vieron, **añade el test que lo habría cazado** antes de mergear.

Con **solo-dev + Claude**, el PR-con-aprobación es teatro (yo aprobando lo mío no es independiente). Lo que aporta valor real: **CI sobre la rama** (vía PR) + **auditoría independiente** (agente fresco) + tu **vistazo de producto (UX)**. Caso real 09/07 (feature "por leyes"): la auditoría cazó que la feature acotaba el *test servido* pero **no la pantalla** que confundía al usuario (conteos + selector) — las 3 capas del autor cubrían el mismo slice. Ver `feedback_worktree_por_sesion_paralela`.

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

- ⚠️ **Páginas SSG (prerenderizadas) NO se refrescan solas en CloudFront tras un deploy** (incidente 09/07, `/premium`). El deploy sincroniza `_next/static` a S3, pero las **páginas HTML prerenderizadas** (p.ej. `/premium`) se sirven con `cache-control: s-maxage=31536000` y CloudFront las cachea → los visitantes ven el HTML VIEJO (apuntando al chunk viejo) hasta que caduque (1 año). Al cambiar una página SSG hay que **invalidar CloudFront a mano**: `aws cloudfront create-invalidation --distribution-id E1EH4WF1H7ZGLA --paths "/premium" "/premium/" --profile vence`. (Con `?cb=<n>` se fuerza render fresco de origin para verificar.) Rutas dinámicas/SSR no tienen este problema; SSG sí.
- ⚠️ **Los precios de Stripe NO salen del `.env.local`** (que es per-worktree y gitignored → driftaba y tumbaba pagos: incidente 09/07 task def `:386`, un `.env.local` viejo desplegó IDs antiguos y dejó `create-checkout` en 400 en 3 de 4 planes). Salen de `scripts/stripe-prices.sh` (**commiteado**, fuente de verdad), que el deploy sourcea DESPUÉS de `.env.local` para sobreescribirlo. Cambiar precios = editar ese fichero + crear los precios en Stripe + `EXPECTED` de `scripts/canary-planes-precios.cjs` + build-args de `frontend-deploy.yml`. El canary de precios verifica además el **task def vivo de ECS** (no solo el env local), que es lo que caza este modo de fallo.
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

**Regla operativa:** si añades (o un refactor introduce) una dependencia **server-side** de una `NEXT_PUBLIC_*` vía **acceso dinámico**, esa var **debe** ir al `environment` del task def — cablearla en el bloque de construcción del task def de `scripts/deploy-frontend.sh` (como se hace con los secretos SSM de Nila y con los **8** `NEXT_PUBLIC_STRIPE_PRICE_*`: monthly/quarterly/semester/**annual** × base+_NILA). Los IDs de precio son públicos → `environment` plano; algo secreto → SSM `secrets`. Grep rápido de riesgo: `grep -rE "process\.env\[" app lib` en código que corre en server.

> **Refuerzo (incidente 09/07, task def `:386`):** además de estar en el task def, los price IDs se sourcean de `scripts/stripe-prices.sh` (**commiteado**), NO del `.env.local` per-worktree. Motivo: un deploy desde un worktree con `.env.local` de precios viejo clonó el task def bueno pero **sobreescribió** monthly/quarterly/semester con los IDs antiguos (annual sobrevivió por herencia) → el cliente enviaba IDs nuevos y el server los rechazaba → `create-checkout` 400 en 3 de 4 planes, altas caídas. El canary local no lo veía (miraba `.env.local`); ahora `scripts/canary-planes-precios.cjs` verifica el **task def VIVO de ECS**.

**Deploy solo-de-runtime-config (env del task def, sin cambiar imagen):** es legítimo registrar una nueva revisión del task def (clonando la viva + añadiendo el env) y `update-service`, sin rebuild — es más rápido que el script y AWS-native. PERO te saltas el **smoke** del script: ejecútalo a mano (`home=200`, `/api/auth/token=401`, un chunk 200) y deja el cambio **también** en el deploy script para que persista en el próximo deploy canónico. La regla "usar siempre el script" sigue valiendo para cambios de **código/imagen**.

**Gap de observabilidad detectado:** el canary de Stripe (`CanaryStripeWebhookModule`) solo vigila el **webhook**, no la **creación de checkout** → esta caída pasó desapercibida hasta el feedback de usuarias. Pendiente: sintético/canary de `create-checkout` o alerta por pico de 400 `price_account_mismatch`. Ver `observability.md`.

## Relacionados
- `project_stripe_halfflip_nila_incidente` (memoria) — incidente pagos 07/07: `NEXT_PUBLIC` dinámico + runtime env.
- `project_deploy_freeze_chunks_s3` (memoria) — causa raíz + fix del congelamiento.
- `docs/ARCHITECTURE_ROADMAP.md` — contexto de la migración a AWS/Fargate.
- `docs/runbooks/observability.md` — qué mirar tras un deploy (errores client/server in-house).
