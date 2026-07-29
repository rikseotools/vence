# Runbook — Pusheo, revisión y despliegue (frontend + backend)

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

# Con VARIAS SESIONES pusheando, usa mejor el lanzador: espera a que el CI verdee y despliega solo.
scripts/deploy-cuando-verde.sh backend      # o: frontend [vueltas]
```

> **¿Por qué un lanzador y no ejecutar el script a pelo?** Los guardarraíles de abajo son correctos
> uno a uno, pero exigen que coincidan CUATRO cosas: árbol limpio, al día con `origin/main`, lock de
> deploy libre y **CI verde de ESE SHA exacto**. Con cuatro sesiones pusheando cada pocos minutos esa
> ventana casi no existe: el **28/07** desplegar un fix de UNA línea en el backend necesitó **siete
> intentos**, y solo uno falló por el código (un typecheck roto en `main`, ajeno). Los otros seis
> fueron CI en curso, run cancelado por un push ajeno, el lock ocupado por un build de frontend de
> >30 min, y un árbol sucio. `deploy-cuando-verde.sh` reacciona a cada uno de esos estados en vez de
> morir; solo aborta ante un CI **realmente** rojo.

Ambos: build (podman) → push ECR → task def pineada por **digest** clonando la viva (hereda secretos) → `update-service` rolling → `wait services-stable` → **smoke** (falla el deploy si el smoke no pasa).

> **Digest determinista (fix 11/07/2026):** el digest para pinear la task def se captura DIRECTO del push
> (`podman push --digestfile`), NO re-resolviendo por tag (`describe-images --image-ids imageTag=$TAG`) después.
> El re-lookup devolvía el digest EQUIVOCADO de forma intermitente (consistencia eventual de ECR / carrera entre
> deploys concurrentes) → prod quedaba con la imagen VIEJA aunque el deploy dijera "OK" y `/api/health` reportaba
> el SHA viejo. Guardarraíl: `__tests__/guardrails/deploy-scripts.test.ts`.
>
> **Ficheros temporales por-deploy con `mktemp` (fix 11/07/2026 — RAÍZ del clobber concurrente):** los scripts
> escribían el task-def en paths **`/tmp` FIJOS** (`/tmp/vence-td-new.json`). Con dos deploys concurrentes (sesiones
> paralelas), uno **sobreescribía el JSON del otro** entre `writeFileSync` y `register-task-definition` → se
> registraba la imagen del OTRO deploy (SHA equivocado) → prod servía código viejo aunque `--digestfile` hubiera
> resuelto el digest correcto (prueba: deploy resolvió `0dfcbb34` pero registró `:429` con `f46f31c4`). Fix: `mktemp`
> por-deploy (`TDLIVE`/`TDNEW`). Este era el mecanismo REAL de la "guerra de deploys" del 11/07, NO una sesión
> desplegando a mala idea: CUALQUIER par de deploys concurrentes se corrompía. Con `--digestfile` + `mktemp` +
> circuit breaker, el deploy es robusto ante concurrencia. Guardarraíl prohíbe `--cli-input-json file:///tmp/vence-*.json`.
>
> **Circuit breaker (fix 11/07/2026):** ambos servicios ECS tienen `deploymentCircuitBreaker={enable,rollback}=true`
> → un deploy que no estabiliza AUTO-REVIERTE al task def anterior (antes `vence-backend` lo tenía OFF y una
> deployment rota se quedaba atascada dejando el servicio frágil). `update-service --task-definition` (sin
> `--deployment-configuration`) preserva este ajuste, así que persiste entre deploys.

- **Infra:** cuenta AWS `349744179687`, perfil `vence`, región `eu-west-2`. Cluster ECS `vence-backend`, servicios `vence-frontend` y `vence-backend`. Front y back detrás del **ALB** `vence-backend-alb`, con **CloudFront** (`E1EH4WF1H7ZGLA`, `www.vence.es`) delante del front y `api.vence.es` para el back.
- **GHA auto-deploy DESACTIVADO** (metía builds Supabase por sorpresa). Deploy manual con estos scripts.
  - ⚠️ **`backend-deploy.yml` seguía con trigger `push` vivo hasta el 11/07/2026** (pese a este párrafo) y además **pinaba el task def a un digest equivocado** (distinto de la imagen que construía) → al pushear `backend/**` a `main`, ECS intentaba arrancar un task cuya imagen no existía en ECR → **deployment atascada + backend frágil** (el task vivo corría una imagen ya borrada de ECR; una muerte del task = caída no auto-curable; circuit breaker OFF). Recuperación: registrar task def clon apuntando a la imagen REAL (`...@sha256:<digest_existente>`) + `update-service` + esperar estable + smoke. **Fix:** el workflow se pasó a `workflow_dispatch` (sin `push`). No re-activar el `push` sin arreglar antes el pinning por digest.

## Post-deploy: CloudFront, o el cambio no se ve aunque el deploy esté vivo

`deploy-frontend.sh` invalida `/*` en CloudFront tras el smoke. **Si despliegas por otra
vía, invalida a mano** o la página cacheada tarda hasta 24 h en cambiar aunque el
contenedor nuevo ya sirva lo correcto:

```bash
AWS_PROFILE=vence aws cloudfront create-invalidation --distribution-id E1EH4WF1H7ZGLA --paths "/*"
```

Para distinguir «no se desplegó» de «está cacheado», un query-string cualquiera fuerza ir
al origen: si con `?nocache=123` sale lo nuevo, el deploy está bien y solo falta la CDN.
Detalle: `docs/maintenance/cache-revalidation.md` § CloudFront.

## Post-deploy: el smoke HTTP no lo ve todo

Tras el smoke (`home` 200 + `/api/auth/token` 401), el anti-clobber y el canary premium, el
deploy del frontend corre una **verificación en navegador** (`scripts/verify-release.sh`, Vence
Sim con los journeys `postDeploy`). Motivo: los controles del examen se sirvieron rotos —tapados
por la cabecera, invisibles y sordos al clic— **con el smoke en verde**, porque un 200 no dice
nada del pintado. Detalle y frontera agnóstica: `docs/runbooks/vence-sim.md`.

- **No bloquea**: un rojo puede ser del entorno (contenedor frío, límite de peticiones). Informa
  y emite a `observable_events`. Con `VERIFY_STRICT=1` sí bloquea.
- **Se salta limpiamente** si la máquina no tiene navegadores de Playwright o falta la identidad
  de la cuenta de test: un despliegue nunca falla por no poder verificar.
- **Con koigrid**: su script exporta `VERIFY_BASE_URL` + `SIM_AUTH_SECRET` + `SMOKE_USER_ID` y
  llama al MISMO verificador. Lo que sabe de AWS se queda en `deploy-frontend.sh`.

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

### El typecheck se comprueba ANTES de pushear (hook `pre-push`, T-225 — 28/07/2026)

**El problema que resuelve:** el check `Typecheck` es uno de los que mira el gate de arriba, así que **un `main` rojo por tipos bloquea el deploy de TODAS las sesiones** — y el diagnóstico se lo come quien no lo rompió. El `pre-commit` corre tests, pero **los tests unitarios no ven un error de tipos**: pasan igual. El caso del 28/07 fue el error más tonto posible (`scripts/backfill-explanation-data.ts` usaba un campo que el `SELECT` ya pedía pero el tipo no declaraba, TS2339) y costó **tres vueltas de deploy** a otra sesión.

**Dónde está:** `.husky/pre-push` → `scripts/typecheck-push-guard.cjs` (regla pura en `lib/hooks/typecheckRelevance.cjs`, guardarraíl en `__tests__/guardrails/typecheckHook.test.ts`). Va detrás del guard del backlog: primero el barato.

**Por qué en el pre-PUSH y no en el pre-commit — medido, no a ojo** (con la caché `incremental` que `tsconfig.json` ya tenía):

| escenario | coste |
|---|---|
| push que **solo toca documentación** | **0,2 s** (ni se lanza `tsc`) |
| caliente, sin cambios de código | ~14 s |
| caliente, tocando un módulo de amplio alcance | ~43 s |
| **en frío** (worktree recién creada, sin `.tsbuildinfo`) | ~72 s |

La ficha de T-225 daba *"más de 2 minutos"*: se había medido **en frío**, que es justo lo que pasa la primera vez en cada worktree nueva. Por commit sería intolerable (varios commits por sesión) y **un hook que molesta se acaba saltando con `--no-verify`**, que es peor que no tenerlo. Por push se paga una vez y sigue estando antes de que el rojo llegue a `main`, que es lo único que importa.

**Escape:** `TYPECHECK_GUARD_SKIP=1 git push …` (rama de trabajo que no va a `main`, rehacer historia). Está a la vista en el propio hook a propósito: si el escape específico no se ve, la gente usa `--no-verify`, que además se salta el guard del backlog.

**Fail-open ante infra** (no arranca `npm`, falta el script) y **fail-closed en lo suyo** (tipos rotos → push bloqueado), igual que su hermano del backlog.

### Los escapes de los hooks, y por qué NO usar `--no-verify` (28/07/2026)

Cada guardarraíl tiene su propio interruptor, y ese es el que hay que usar: `--no-verify` los apaga **todos a la vez**, y es lo que dejó `main` roto dos veces el 28/07.

| Situación | Escape | Qué sigue vigilando |
|---|---|---|
| Commit bloqueado por un test que **NO es tuyo** | `PRECOMMIT_TESTS_SKIP=1 git commit …` | `db:check` y `audit:display-drift` |
| Push de una rama que no va a `main` / rehacer historia | `TYPECHECK_GUARD_SKIP=1 git push …` | el guard del backlog |
| Mención suelta de un `T-NNN` que no tienes reclamado | `BACKLOG_GUARD_SKIP=1 git push …` | el typecheck |

**Antes de usar el primero, comprueba de quién es el rojo** — el `pre-commit` corre la suite ENTERA, así que un fallo de cualquier sesión bloquea a todas:

```bash
git stash push -u && npm run test:unit; git stash pop
```

⚠️ El stash es del **REPO**, no del worktree: con sesiones en paralelo, haz `pop` enseguida. Que el hook distinga solo un rojo heredado de uno tuyo es [T-255].

> ⚠️ El hook mira el **diff neto contra `origin/main`**, no cada commit: si añades un fichero roto y lo quitas en otro commit del mismo push, no paga peaje — porque a `main` no llega. Y `backend/` y `__tests__/` no lo disparan porque el typecheck de la raíz los excluye (paridad con `tsconfig.json` fijada por test: si alguien cambia ese `exclude`, el guardarraíl se pone rojo).

> **CI — dónde corre:** el workflow (`.github/workflows/test.yml`) dispara en **`pull_request` y push a `main`**, NO en push de una rama suelta. Para tener CI sobre una feature-branch (worktree, ver abajo) hay que **abrir un PR** — aunque seas solo tú: el PR es el mecanismo que dispara el CI, no una ceremonia de aprobación.

> ⚠️ **El gate exige solo los checks de CÓDIGO verdes (unit+typecheck+lint).** `integration` es una **señal aparte que NO bloquea**: pega a la BD real (readonly) y puede estar en ROJO por motivos de **datos** o por trabajo de **otra sesión** (p.ej. una oposición construida en DB pero aún sin entrada en config, un ratchet de temario de otra sesión, un test de otra feature a medias) — cosas ajenas al código que despliegas. **Decisión tomada (Manuel, 08/07):** el gate del script trata `integration` como informativa (la reporta pero no aborta). Aun así, míralo antes de soltar: si el rojo SÍ es de tu código, arréglalo primero.
>
> ⚠️ **`cancelled` NO es `failure` — y con varias sesiones pasa a menudo (27/07).** GitHub Actions
> **cancela** el run en curso cuando llega un push más nuevo (concurrency `cancel-in-progress`). Si
> tu gate de CI trata "no todos success" como rojo, **aborta el deploy por un motivo que no existe**:
> los checks aparecen como `cancelled`, no como `failure`. Pasó dos veces seguidas el 27/07 con
> cuatro sesiones pusheando. **Lo correcto ante `cancelled` es RESINCRONIZAR** (`git fetch` +
> `reset --hard origin/main`) y volver a esperar el CI del HEAD nuevo, reintentando unas cuantas
> veces; abortar solo ante un `failure` de verdad. Distinguirlos es una línea al leer los check-runs.
> Y ojo con el orden: el guardarraíl **anti-stale** de los scripts ya te obliga a resincronizar, así
> que un deploy que empieza con el árbol atrasado morirá igualmente más tarde y habrás perdido el build.
>
> ⚠️ **PUSHEA ANTES DE LANZAR EL DEPLOY, y no commitees mientras corre.** Esa resincronización es un
> `reset --hard origin/main` sobre **TU worktree**: un commit tuyo que aún no esté en `origin/main`
> desaparece del branch (queda solo en el reflog). Pasó el 29/07 — el deploy iba en la vuelta 3 y se
> llevó por delante un commit hecho durante la espera. Si te ocurre: `git reflog` → `git cherry-pick
> <sha>`, que sigue estando ahí.
>
> **✅ ARREGLADO EN EL SCRIPT (27/07/2026).** Este aprendizaje llevaba escrito aquí un rato mientras el
> gate seguía metiendo `cancelled` en el mismo saco que `failure` — y ese mismo día volvió a bloquear
> **tres** deploys seguidos con CERO checks en `failure`. Ahora `FAILED` cuenta solo `failure`/`timed_out`
> y los cancelados tienen su propia rama, que dice qué hacer (`git fetch origin && git reset --hard
> origin/main` y esperar el CI del HEAD nuevo). Lo fija `__tests__/guardrails/deploy-scripts.test.ts`.
> Lección transversal: **un aprendizaje que solo vive en el manual se vuelve a pagar** — si es una línea
> de código, va al código.

> ⚠️ **Ni un backtick dentro de los `node -e "…"` de los scripts de deploy (27/07).** El task def se
> construye con un bloque `node -e "…"` entre comillas **dobles**, así que bash interpreta cualquier
> backtick como **sustitución de comando**. Un comentario JS que documentaba un detector
> (`` `seguimiento_fuente_ciega` ``) hacía que el deploy escupiera *"seguimiento_fuente_ciega: orden
> no encontrada"* cinco veces. Aquella vez fue solo ruido —caía en comentarios—, pero el mismo patrón
> con `$(...)` **ejecutaría** lo que hubiera dentro mientras se registra la task def de producción.
> Usa comillas simples ahí. Lo vigila `__tests__/guardrails/deploy-scripts.test.ts`, que además
> comprueba que sigue encontrando los bloques (si el script dejara de usar `node -e`, el test pasaría
> por vacío y mentiría en silencio).

> ⚠️ **Sincronía script ↔ origin (gotcha real 09/07):** el gate solo-código vive en el **script** `deploy-{frontend,backend}.sh`. Si despliegas desde un checkout de `origin/main` cuyo script sea una versión ANTERIOR (gate "exige todo"), toparás con `integration` roja y el deploy abortará. En ese caso: verifica a mano que unit+typecheck+lint están verdes (GH API del SHA) y usa `SKIP_CI_GATE=1` de forma consciente. Y sincroniza script+manual en origin para que no vuelva a pasar.

### Auto-sincronización con `origin/main` (27/07/2026)

Los scripts **se resincronizan solos** antes del gate de CI cuando no hay nada que perder:
árbol limpio y `HEAD` ya contenido en `origin/main`. Es el caso habitual de un deploy con
varias sesiones activas — otra pushea mientras tu gate verifica el CI — y antes obligaba a
hacer `fetch` + `reset --hard` + reintentar **a mano**: tres abortos seguidos ese día, además
de otros tres por el bug de `cancelled`.

Va **antes** del gate a propósito, para que los checks se verifiquen sobre el SHA que de
verdad se construye, y **recalcula `SHA`/`FULL_SHA`** — si no, el build se pinearía al commit
viejo y el anti-clobber del final daría un falso positivo.

**No auto-sincroniza** (y el anti-stale aborta como siempre) en los dos casos donde perder
trabajo es posible: **árbol sucio**, o **`HEAD` con commits propios sin pushear**. Desactivar:
`NO_AUTO_SYNC=1`. Lo fija `__tests__/guardrails/deploy-scripts.test.ts`; probado en un repo de
laboratorio con los cuatro casos (limpio-atrasado → resincroniza · sucio → no toca · commits
propios → no toca · al día → silencio).

## Sesiones paralelas (varias sesiones de Claude a la vez)

> 🔑 **Distinción clave — pushear a `main` ≠ desplegar** (causa de confusión 09/07, dos sesiones lo leían opuesto):
> - **Pushear a `main`** = estacionar + disparar el CI. Es **reversible** (revert) y **seguro**. Se hace **cuando TU tarea está COMPLETA** (integrada + testeada), sin esperar a nadie. `main` es el punto de integración; que varias sesiones metan cosas es normal. **No hace falta PR** (el CI también corre en push a `main`; el PR solo sirve para tener CI en una rama ANTES de mergear).
> - **Desplegar** = coger el estado ACTUAL de `main` y mandarlo a prod. **Es el ÚNICO acto que se coordina**: se despliega cuando `main` tiene solo lo que quieres soltar y ninguna sesión está a media integración. El deploy es cumulativo (sube TODO lo de `main`), por eso solo se sube trabajo COMPLETO a `main`.
> - **Regla:** "mete X en main" (por sesión, al cerrar tarea) es libre; "despliega todo" (coordinado) es aparte. No encadenes el deploy al merge de UNA feature si hay otras sesiones activas.

**Convención (desde 09/07): un git worktree + rama por sesión** — directorio propio, misma `.git`. Ninguna sesión toca los ficheros de otra. Es la solución al lío de compartir el mismo directorio (stash / merge / colisiones / barrer WIP ajeno). Detalle: memoria `feedback_worktree_por_sesion_paralela`.

> 🛠️ **Bootstrap (desde 17/07): `scripts/sessions/`.** No montes el worktree a mano — usa el tooling que impone el buen setup:
> - `scripts/sessions/new-session.sh <slug> [--db shared|local] [--own-deps]` → worktree **desde `origin/main` fresco** (nunca el main local divergente), copia `.env.local`, symlink de `node_modules` (o `--own-deps`), y escribe un `.session-id` que `cola.cjs` lee solo (claim sin pisarse). `--db local` levanta un Postgres podman propio.
> - `scripts/sessions/list-sessions.sh` → sesiones vivas (rama, sid, commits sin subir, db), fuente = `git worktree list`.
> - `scripts/sessions/end-session.sh <slug>` → libera claims, **avisa si hay commits sin llevar a `origin/main`**, y limpia worktree + rama + contenedor.

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

## Tareas PROGRAMADAS que salen de este árbol (imagen propia, repo propio, en cada deploy)

**Regla:** una tarea programada necesita **su propia imagen, en su propio repo ECR, reconstruida en cada deploy**. Las tres condiciones, no dos.

**Incidente 27→29/07/2026 — el worker de PDFs estuvo 2 días muerto, por dos fallos encadenados:**

1. **No tenía camino de despliegue.** El Dockerfile ya traía su stage `worker` y `deploy-frontend.sh` documentaba que *"el worker se despliega por su propio camino"*… pero ese camino **no existía**. Su imagen se construyó **a mano** una vez (23-24/07) y se subió al repo **`vence-frontend`**, cuya retención conserva **solo las últimas 10 imágenes** con ~6 pushes al día. Estaba condenada a desaparecer en ~2 días. Cuando desapareció, cada tick moría con `CannotPullContainerError` **antes del entrypoint**: sin logs, sin eventos, sin alerta.
2. **Y no vale apuntarla a la imagen del frontend.** El frontend es el stage **`runner`** (Next standalone, **sin devDependencies**) y el worker arranca con `node_modules/.bin/tsx`, que es devDependency → `Cannot find module '/app/node_modules/.bin/tsx'`. Es el error del **primer** intento del 23/07, y el que se repite si "arreglas" el pineado sin mirar de qué stage sale la imagen.

`vence-content-radar` y `vence-instagram-daily` hacían esto bien desde el principio —repo propio, sin retención agresiva— y son las únicas que siguen vivas.

**Solución (en los DOS caminos de deploy, no tocar sin entender):**
1. `scripts/deploy/repin-derived-taskdefs.sh` — **fuente única**: `DERIVED_WORKERS` declara `familia|stage del Dockerfile|repo ECR`. Por cada una: `build --target <stage>` → push a **su** repo capturando el digest con `--digestfile` → clona la task def viva y solo swapea la imagen (hereda env/secrets/rol/cpu sin poder olvidarlos) → registra revisión. Construir su stage es barato: `worker` es `FROM deps`, no dispara el build de Next.
2. Lo invocan **el script manual** (`deploy-frontend.sh`, tras converger) y **el workflow de GHA** (tras `Esperar rollout estable`). El guardrail `__tests__/guardrails/deploy-scripts.test.ts` verifica que los dos lo llaman, que el stage declarado existe en el Dockerfile, que **ninguna usa el repo del frontend**, que se pinea por digest del push y que toda tarea derivada tiene liveness declarada.
3. Si falla, el frontend queda sano pero el deploy **termina en rojo** (`REPIN_OK`): lo que queda en riesgo son las tareas programadas.
4. El scheduler apunta a la **familia sin revisión**, así que coge la última ACTIVE automáticamente. No hay que tocarlo al re-pinear.

### ⚠️ Una tarea programada tiene que ACOTAR su duración (o se come la cuota de vCPU)

**El fallo no se ve con la cola vacía.** El worker de PDFs drenaba *hasta vaciar la cola* y el scheduler lo lanza cada 30 min: en operación normal termina en segundos y nunca dio problema. Con un backlog de 111 temas pesados (hasta 30 min por render) cada ejecución dura **horas** y los workers se **acumulan** —uno nuevo cada tick, 2 vCPU cada uno—. Medido el 29/07: 20,25 de **30 vCPU** ya en uso (frontend 8×2 + backend + 2 workers), con la cuota agotada proyectada en ~2,5 h. Y quedarse sin vCPU es exactamente lo que **revierte los deploys de frontend** (ver `project-deploy-frontend-cuota-fargate-vcpu`).

**Invariante:** `tope de ejecución + techo de una unidad de trabajo < 2 × cadencia` → como mucho 2 instancias vivas. Hoy: 20 + 30 < 60 min. Fijado en `__tests__/guardrails/externalScheduledJobs.test.ts`.

La comprobación del tope va **antes de reclamar** el siguiente trabajo, nunca a mitad de uno: cortar un render en curso lo manda a retry y tira el trabajo hecho. El backlog se drena igual, en varios ciclos — la cola es el estado, el worker no guarda nada.

> **Al añadir una tarea programada nueva:** entrada en `DERIVED_WORKERS` (con **repo propio**, nunca el del frontend) **y**, si es periódica, declararla en `backend/src/cron-schedule/external-jobs.registry.ts` para que tenga liveness (`cron_overdue`) — el guardrail exige lo segundo si haces lo primero. Y si procesa una cola, **acótala en el tiempo**: comprueba el invariante de arriba contra la cuota. Esa segunda parte es la red que **no** depende del proveedor: aunque este paso falle o desaparezca en la migración a koigrid, un job que deje de correr sigue avisando. Ver `health-check.md` §1.bis.b.

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

## ⚠️ Renombrar una RUTA: desplegar el redirect NO basta — hay que purgar la ruta vieja en LAS DOS cachés (28/07/2026)

**Lo que pasó:** al renombrar `/embajadores` → `/recompensas` con un redirect `permanent` en `next.config.mjs`, el deploy salió bien (imagen correcta en ECS, `/recompensas` → 200)… y **`/embajadores` seguía devolviendo 200 con la página vieja**, no el 308. El redirect estaba desplegado pero no se aplicaba nunca.

**Por qué:** la ruta vieja estaba cacheada **en dos capas**, y la respuesta cacheada se sirve ANTES de llegar a la lógica de redirects:
1. **Caché del servidor Next/OpenNext** — `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`. Se ve incluso pidiendo con una querystring nueva (que esquiva el CDN): si con `?cb=<aleatorio>` sigue dando 200, es ESTA.
2. **CloudFront** — `x-cache: Hit from cloudfront` + `age: 54846`. Y con `cache-control: s-maxage=31536000` (**un año**), habría servido la copia congelada durante meses.

**Cómo se arregla (las dos, en este orden):**
```bash
# 1) caché del servidor Next
curl -X POST https://www.vence.es/api/purge-cache -H "Content-Type: application/json" \
     -H "x-cron-secret: $CRON_SECRET" -d '{"path":"/ruta-vieja"}'
# 2) CloudFront (distribución E1EH4WF1H7ZGLA)
aws --profile vence --region eu-west-2 cloudfront create-invalidation \
    --distribution-id E1EH4WF1H7ZGLA --paths "/ruta-vieja" "/ruta-vieja/*"
```
**Verificar SIEMPRE la URL DESNUDA**, no solo con cache-buster: la querystring esquiva CloudFront y da un falso verde. El único veredicto válido es `curl -I https://www.vence.es/ruta-vieja` devolviendo `308`.

**Por qué importa más de lo que parece:** la ruta vieja vive en **emails YA ENVIADOS** y en mensajes de soporte. Si no se purga, esos enlaces siguen aterrizando en una copia congelada, el redirect nunca entra en vigor y el deploy parece correcto en todas las comprobaciones habituales.

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
