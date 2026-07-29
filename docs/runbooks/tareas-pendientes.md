# Runbook — Tareas pendientes (backlog con claim entre sesiones)

**Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** *"revisa las tareas pendientes"*, *"revisa el backlog"*, *"revisa los pendientes"*, *"¿qué tareas pendientes tenemos?"*, *"lista las tareas pendientes"*, *"tareas pendientes"*, *"coge una tarea"*, *"ataca la tarea X"*, *"dame la siguiente tarea"*, *"qué hago ahora"*, *"añádelo a pendientes"*, *"cierra la tarea X"*. Seguirlo ANTES de ponerse a trabajar en nada del backlog.

> **Nota de idioma:** el proyecto usa *"revisa X"* como disparador estándar (*"revisa los temas vacíos"*, *"revisa OEPs"*, *"revisa rollover"*…). *"revisa las tareas pendientes"* sigue esa misma convención y es la forma más natural — está cubierta arriba a propósito.

> **Por qué existe.** Con 2-10 sesiones de Claude a la vez, dos sesiones cogían la misma tarea sin enterarse. **Caso real (20/07):** una sesión montó un worktree para arreglar el RD 176/2022 mientras otra ya lo estaba arreglando — y encima la ficha decía *"9 mislinks EN VIVO"* cuando ya estaban resueltos. Se perdió tiempo por dos motivos distintos: **falta de claim** y **ficha desfasada**. Este sistema ataca los dos.

## Crear una ficha nueva: `reserve` PRIMERO

```bash
node scripts/backlog.cjs reserve "Título provisional de la tarea"
#  ✅ id reservado: T-216
#     escribe la ficha en docs/roadmap/tareas-pendientes.md como:  ### [T-216] 🟡 [ABIERTO …] <título>
#     y luego:  node scripts/backlog.cjs sync
```

**Nunca elijas el id mirando el markdown.** La fuente de verdad de los ids es la **tabla
`backlog_tasks`**, igual que para el claim: con 2-10 sesiones en paralelo, otra puede haber creado
T-196 hace diez minutos y no haber pusheado todavía su ficha. Tú ves el número libre en el fichero,
lo usas, y al fusionar hay dos tareas distintas con el mismo id.

`reserve` lo resuelve de forma atómica: calcula el siguiente, lo INSERTA con un título provisional y
deja que la PK arbitre las carreras (reintenta hasta 10 veces). A partir de ahí el id es tuyo y el
`sync` posterior solo actualiza el título real.

**Si aun así colisionas, `sync` ABORTA** y te enseña las dos fichas y el comando. Antes reconciliaba
en silencio: le pisaba el título a la tarea de la otra sesión y lo reportaba como un `↻` normal.

Y aborta en los **dos** sitios donde se puede chocar, que no son el mismo:

| Choque | Cómo se ve | Qué lo caza |
|---|---|---|
| El id sale **dos veces en tu markdown** | dos fichas con el mismo `T-nnn` en el fichero | comparación dentro del markdown |
| El id **ya es de otra sesión en la BD** | en TU fichero aparece una sola vez (la tuya): su ficha aún no está pusheada | comparación contra `backlog_tasks` (`lib/backlog/syncGuard.cjs`) |

**Pero un retitulado NO es una colisión** (añadido 29/07). Reescribir el título de tu propia ficha cuando el trabajo cambia lo que sabes de ella es normal, y a veces no deja ni una palabra en común — `esOtraTarea` compara vocabulario, así que lo daba por ajeno y **abortaba el `sync` de TODAS las sesiones**. Pasó dos veces en diez minutos: **T-219** (*«308 preguntas de señale la INCORRECTA…»* → *«El marco contradictorio de las preguntas de tipo NEGATIVO»*, y la propia ficha explica el porqué: *«el cubo NO eran 308, era más del TRIPLE»*) y **T-089** (*«gate de PICO SUPERADO»* → *«A3 RESUELTO»*). El discriminante no es el parecido de los títulos sino **si esa ficha ha existido alguna vez en el fichero**: si estaba en el historial es NUESTRA y se reconcilia; si nunca estuvo, es de otra sesión y se para. El caso T-225 —donde la ficha era nueva— sigue abortando igual (`esColisionReal` en `lib/backlog/syncGuard.cjs`, con su test de regresión).

> Y no era solo la molestia de repetir el `sync`: **cada aborto se llevaba por delante los avisos que van después**. El de T-219 estuvo horas ocultando que las fichas de T-251 y T-254 se habían borrado de `main`.

El segundo es el que pasa de verdad y estuvo suelto hasta el 28/07: la otra sesión reservó T-225 a
las 09:17, en esta copia el markdown no tenía esa ficha, y el `sync` reconcilió el id como propio
**pisándole el título**. La decisión de parar es pura y testeada (`__tests__/backlog/syncGuard.test.ts`):
compara el vocabulario de los dos títulos, exime el provisional de `reserve` y no se mete en un
retitulado normal — un guardarraíl que grita por cualquier cambio de redacción se acaba saltando.

> Historial: el problema se repitió con T-123/T-126, y otra vez cuatro veces el 28/07 (T-188, T-196,
> T-201, T-204). `reserve` existía desde el primer episodio — lo que faltaba era que estuviera escrito
> donde alguien lo lee. Por eso está aquí y en CLAUDE.md.

## Reparto de responsabilidad (no duplicar)

| Vive en | Qué | Por qué ahí |
|---|---|---|
| **`docs/roadmap/tareas-pendientes.md`** | CONTENIDO: título, por qué, cómo, hallazgos, links | Narrativa larga + historia de git |
| **Tabla `backlog_tasks` (RDS)** | ESTADO: quién la tiene, desde cuándo, en qué acabó | Un fichero de texto **no admite claim atómico**: dos sesiones leen "libre", ambas escriben, gana la última |

El join es el **id `T-xxx`** de la cabecera del markdown (`### [T-042] 🔴 Título`). Es estable aunque cambie el título.

## Flujo de trabajo

```bash
node scripts/backlog.cjs list              # qué hay y quién tiene qué
node scripts/backlog.cjs next              # sugiere la siguiente por prioridad (NO la coge)
node scripts/backlog.cjs claim T-042       # la COGE (atómico; falla si otra sesión la tiene)
node scripts/backlog.cjs heartbeat         # renueva el lease mientras trabajas
node scripts/backlog.cjs mine
node scripts/backlog.cjs done T-042 --outcome "qué pasó de verdad"
node scripts/backlog.cjs release T-042     # soltarla sin cerrar
node scripts/backlog.cjs snooze T-042 --horas 12 --motivo "…"   # espera a un reloj (ver abajo)
node scripts/backlog.cjs pause T-042 --tras-deploy --hecho "…" --falta "…"   # empezada, espera deploy
node scripts/backlog.cjs wake T-042        # la despierta antes de tiempo
node scripts/backlog.cjs deployed <sha> --superficie frontend   # lo llama el propio deploy
node scripts/backlog.cjs sync              # importa ids nuevos del markdown a la tabla
```

El **session-id se resuelve solo** (`--sid` > fichero `.session-id` > `CLAUDE_CODE_SESSION_ID`), igual que en `scripts/impugnaciones/cola.cjs`. No hay que teclear nada.

### Reglas

1. **Coge ANTES de trabajar.** Si no está cogida en la tabla, para el resto de sesiones está libre — aunque tú ya lleves una hora con ella. **Y no depende de que te acuerdes:** el hook **`.husky/pre-push`** (`scripts/backlog-push-guard.cjs`) **bloquea el push** si un commit que empujas menciona un `T-NNN` vivo que no tienes reclamado (o lo tiene otra sesión). Fail-open si la BD no responde; escape legítimo con `BACKLOG_GUARD_SKIP=1 git push …`. Además `claim` **imprime la ficha entera** → reclamar y leer son el mismo acto.
2. **Renueva el lease** (`heartbeat`) si la tarea dura más de 90 min. Si no, otra sesión la considerará abandonada y la cogerá, con razón.
3. **Al cerrar, `done --outcome` Y mueve la entrada a `## Hechas` en el markdown.** Las dos cosas. Si solo haces una, el guardarraíl de CI te lo tira.
4. **`next` sugiere, no coge.** Está pensado para que elijas por encaje: si acabas de construir una oposición, la siguiente oposición te cuesta la mitad.

## Lease, no lock

`lease_until` es un **arriendo renovable**, no un candado eterno. Una sesión que muere (se acaba el contexto, peta, cierras la ventana) libera su tarea sola al caducar el lease; una sesión viva la conserva mientras dé señales con `heartbeat`. Sin esto, el backlog se bloquearía solo la primera vez que una sesión muriese con una tarea cogida.

En `list` verás tres estados: `🟢 libre` · `🔒 <sid> (Xm)` cogida con lease vivo · `🟡 lease caducado (libre)`.

## Las CUATRO esperas, y por qué no son la misma

| Situación | Campo | Qué significa | ¿`claim` la entrega? |
|---|---|---|---|
| La estoy haciendo yo | `claimed_by` + `lease_until` | ocupa a una sesión; caduca a los 90 min | ❌ nunca (forzarlo es pisar trabajo ajeno) |
| Depende de otra tarea nuestra | `blocked_by` | dependencia interna del backlog | ❌ salvo `--force --motivo` |
| Hasta cierta hora no hay NADA que hacer | `snooze_until` | reloj EXTERNO: un cron que no ha corrido, una cosecha, la fecha en que toca medir | ❌ salvo `--force --motivo` |
| **Hecha, pero no se puede verificar hasta que se despliegue** | **`wake_on_deploy_sha`** | **CONDICIÓN, no reloj: «mi commit ya está vivo». No hay fecha que poner** | ❌ salvo `--force --motivo` |

**El reloj IMPIDE coger, no avisa (cambio del 29/07).** Hasta ese día `claim` te dejaba coger una aplazada y solo imprimía un aviso. Medido 24 h después de estrenar el campo: **T-221 seguía con `⛔ NO COGER HASTA EL 29/07 07:00 UTC` en el título y T-234 con `⏱ MEDIR EL 11/08`** — o sea, ni con el campo disponible se confió en el aviso. Un aviso impreso entre otras diez líneas no es una condición. Las colas de trabajo serias (DelaySeconds de SQS, scheduled sets de Sidekiq, ETA de Celery) no avisan de que un trabajo no toca: **no lo entregan**. La comprobación va **en el mismo `UPDATE` atómico que el lease y con el reloj del SERVIDOR** — con 2-10 sesiones, el reloj de cada portátil no es una fuente de verdad.

**El escape sigue existiendo, pero deja rastro:**

```bash
node scripts/backlog.cjs claim T-234 --force --motivo "adelanto la preparación, no la medición"
```

Queda en `force_claim_reason` + `force_claimed_at`. Lo que NO se puede forzar es el lease de otra sesión.

## Dejar una tarea a medias sin perder dónde la dejaste (`pause`)

El caso más común de tarea sin cerrar no es "se me olvidó": es **"hecho, pero hay que verificarlo otro día o cuando se despliegue"**. Antes las dos salidas eran malas — `release` borra que estaba a medias y el siguiente empieza de cero; `snooze` conservando el claim deja el lease agonizando (medido el 29/07: 3 tareas `in_progress` con el lease caducado, una desde hacía 32 h).

```bash
# espera a un DEPLOY (lo normal cuando el trabajo ya está en main)
node scripts/backlog.cjs pause T-266 --tras-deploy --superficie frontend \
  --hecho "arreglado el churn y desplegable" --falta "comprobar en /admin/conversiones que ya no satura al 15%"

# espera a una FECHA (una medición, una cosecha)
node scripts/backlog.cjs pause T-234 --hasta "2026-08-11 07:00" \
  --hecho "detector desplegado y midiendo" --falta "leer el cruce a 14 días y decidir"
```

- **Suelta el claim** (nada de leases agonizando), pone la espera y guarda **las dos notas, que son obligatorias**: una pausa sin ellas es indistinguible de un abandono.
- Al volver a cogerla, `claim` **imprime «se retoma donde se dejó»** con lo hecho y lo que falta. Eso es lo que hace que retomarla dentro de dos semanas no cueste releer una ficha entera.
- **`--tras-deploy` sin fecha es deliberado:** un deploy no tiene hora. Si te la inventas y te quedas corto, la tarea despierta y sigue sin poder verificarse; si te pasas, duerme de más. Se guarda el commit y **lo despierta el propio `deploy-frontend.sh` / `deploy-backend.sh` al terminar** (llaman a `backlog.cjs deployed <sha>`, best-effort: nunca tumban un deploy). El commit tiene que estar **contenido** en el desplegado, no ser igual — el deploy es cumulativo.
- **`--superficie frontend|backend|both`**: se despliegan por separado. `both` exige las dos; despertar a medias manda a alguien a verificar algo incompleto.

## Aplazar una tarea que espera a un RELOJ (`snooze`)

```bash
node scripts/backlog.cjs snooze T-217 --hasta "2026-07-29T06:00" --motivo "el cron corre a las 03:15 UTC; antes no hay nada que medir"
node scripts/backlog.cjs snooze T-234 --dias 14 --motivo "la medición es a los 14 días del cambio"
node scripts/backlog.cjs wake T-217        # despertarla antes de tiempo
```

- **`list` la pinta `🕒 en espera hasta …` con su motivo debajo**, y `next` **no la sugiere**. El motivo es obligatorio: un aplazamiento sin explicación es indistinguible de un olvido.
- **Aplazamiento, no candado.** Vence solo, igual que el lease: nadie tiene que acordarse de despertarla. Desde el 29/07 **`claim` tampoco la entrega** (ver arriba); el caso legítimo de adelantar preparación va por `--force --motivo`.
- **Aplazar en bucle no es programar.** Cada `snooze`/`pause` incrementa `snooze_count`; a partir de 3, `list` y `claim` lo cantan: eso ya no es una tarea programada, es una decisión que nadie toma.
- **Por qué existe (28/07/2026):** T-221 llegó a llevar `⛔ NO COGER HASTA EL 29/07 07:00 UTC` **en el título de la ficha**… y `next` la seguía ofreciendo, porque ni el CLI ni la tabla leen el texto del markdown. Gritar en la ficha no es un mecanismo. Con 2-10 sesiones, eso es otra sesión montando un worktree para descubrir a los cinco minutos que no había nada que medir.

## Guardarraíles (lo que evita que vuelva a pasar lo del 20/07)

- **`__tests__/guardrails/backlogRegistry.guardrail.test.ts`** (corre en CI, sin BD): toda cabecera lleva id, los ids son únicos y con formato `T-NNN`, toda tarea viva declara prioridad, existe la sección `## Abiertas`, y **ningún título codifica un candado de fecha** (`NO COGER HASTA`, `MEDIR EL 11/08`, `⛔`, `⏱`) — eso va a `snooze_until`, que vence solo; un título no. Si alguien añade una tarea sin id, el CI se pone rojo — porque sin id **nadie puede cogerla**.
- **`lib/backlog/claim.ts` → `findBacklogDrift()`**: detecta el fallo exacto del 20/07 — tarea `done` en BD que sigue anunciada como abierta en el markdown (y el caso inverso). Testeado en `__tests__/backlog/claim.test.ts`.
- **`findZombieClaims()`**: `in_progress` con el lease caducado hace >24 h = sesión zombi o cierre olvidado.
- **`backlog.cjs sync`** avisa de ids que están en la tabla pero no en el markdown (tareas fantasma, sin contexto). **Ese aviso va lo PRIMERO y separa dos casos que no se parecen** (`lib/backlog/fichaHuerfana.cjs`, testeado en `__tests__/backlog/fichaHuerfana.test.ts`):
  | Motivo | Qué pasó | Qué hacer |
  |---|---|---|
  | 🔴 `borrada` | el id SÍ estuvo en el markdown y ya no está → **regresión** | recuperarla: `git log -S'### [T-NNN]' -- docs/roadmap/tareas-pendientes.md` |
  | ℹ️ `sin_pushear` | el id nunca estuvo en esta rama → otra sesión lo reservó y su ficha viaja en su worktree | nada: es lo normal con 2-10 sesiones |

  **Por qué se cambió (29/07/2026).** El commit de tests `4127f3e17` subió una **copia rancia** del markdown y borró de `main` las fichas de **T-251 y T-254**. Las dos tareas seguían VIVAS en la tabla, así que `list` las ofrecía por su título y detrás no había ficha que leer — una sesión podía cogerlas sin poder saber qué eran. El aviso que lo cazaba ya existía, pero fallaba por dos motivos independientes: **(1)** se imprimía al FINAL, después de dos `process.exit(2)`, y ese día el `sync` abortaba antes por una colisión de id **ajena** (T-219), así que no llegaba nunca; **(2)** no distinguía la regresión del trabajo en vuelo de las demás sesiones, que es lo habitual — y un aviso que se enciende todos los días por algo sano se acaba ignorando, el mismo final que ya tuvo cuando incluía a las CERRADAS (T-033/T-039/T-046). La prueba de que la ficha existió es el **historial del fichero**, no la antigüedad de la tarea. **Fail-open:** si git no puede contestar, se calla — inventarse una regresión es peor que perderla.

  > **Lección de método:** un hallazgo que solo se publica cuando todo lo demás va bien es un hallazgo que falta justo el día que hace falta. Las comprobaciones de solo lectura van antes que los abortos.

## Añadir una tarea nueva

0. **Pide el id con `node scripts/backlog.cjs reserve "<título>"`. NUNCA lo elijas mirando el markdown.**
   El markdown que tú ves va por detrás de la realidad: con 2-10 sesiones en paralelo, las otras ya
   tienen ids cogidos en `backlog_tasks` con sus fichas **sin pushear todavía**, así que «el siguiente
   al último que veo» está ocupado casi siempre. `reserve` lo saca de la tabla, que es atómica.
   *Medido el 28/07: elegí T-210 mirando el markdown y era de otra sesión; volví a elegir T-213 y
   también. Lo cazó el guardarraíl de ids únicos al rebasar —dos tareas con el mismo id comparten
   claim— pero después de haber pisado en BD el título de la tarea ajena, que hubo que reconciliar.*
1. Añádela al markdown con ESE id y su prioridad: `### [T-044] 🟠 Título`. Debajo, 1-3 líneas: **qué, por qué/prioridad, link al cómo**. El detalle largo va en su runbook/roadmap, no aquí.
2. `node scripts/backlog.cjs sync` para que entre en la tabla.

Prioridades: `🔴 crítica` (daño en vivo) · `🟠 alta` · `🟡 media` · `🟢 baja`.

## Cuando termines: pushear y desplegar

El trabajo no está hecho hasta que está en `main` (y, si toca código de app, desplegado). **El procedimiento completo está en [`docs/runbooks/pusheo-revision-despliegue.md`](./pusheo-revision-despliegue.md)** — léelo, no improvises. Resumen de lo que más afecta a este flujo:

- **Un worktree + rama por sesión** (`git worktree add -b feat/<tarea> <ruta> origin/main`). Ninguna sesión toca los ficheros de otra.
- **Pushear a `main` ≠ desplegar.** Pushear es estacionar + disparar CI: se hace en cuanto TU tarea está completa, sin esperar a nadie. **Desplegar es cumulativo** (sube TODO lo que haya en `main`) y por eso se coordina.
- **El deploy tiene gate de CI y guardarraíl anti-stale**: aborta si los checks de código (unit/typecheck/lint) no están verdes para tu HEAD, o si tu árbol va por detrás de `origin/main`. Con varias sesiones pusheando, sincroniza al último `origin/main` **verde** y reintenta.
- `integration` en rojo **no** bloquea el deploy (es señal de datos/otras sesiones), pero míralo antes de soltar.

## Manuales relacionados

- **Push y despliegue:** `docs/runbooks/pusheo-revision-despliegue.md` — fuente única del deploy.
- **Cola de impugnaciones y feedback:** `scripts/impugnaciones/cola.cjs` — el hermano de este sistema, mismas convenciones de claim para las colas de usuarios.
- **Backlog (contenido):** `docs/roadmap/tareas-pendientes.md`.
