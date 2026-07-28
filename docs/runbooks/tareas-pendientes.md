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

## Guardarraíles (lo que evita que vuelva a pasar lo del 20/07)

- **`__tests__/guardrails/backlogRegistry.guardrail.test.ts`** (corre en CI, sin BD): toda cabecera lleva id, los ids son únicos y con formato `T-NNN`, toda tarea viva declara prioridad, y existe la sección `## Abiertas`. Si alguien añade una tarea sin id, el CI se pone rojo — porque sin id **nadie puede cogerla**.
- **`lib/backlog/claim.ts` → `findBacklogDrift()`**: detecta el fallo exacto del 20/07 — tarea `done` en BD que sigue anunciada como abierta en el markdown (y el caso inverso). Testeado en `__tests__/backlog/claim.test.ts`.
- **`findZombieClaims()`**: `in_progress` con el lease caducado hace >24 h = sesión zombi o cierre olvidado.
- **`backlog.cjs sync`** avisa de ids que están en la tabla pero no en el markdown (tareas fantasma, sin contexto).

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
