# Runbook — Tareas pendientes (backlog con claim entre sesiones)

**Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** *"¿qué tareas pendientes tenemos?"*, *"lista las tareas pendientes"*, *"coge una tarea"*, *"ataca la tarea X"*, *"dame la siguiente tarea"*, *"añádelo a pendientes"*, *"cierra la tarea X"*. Seguirlo ANTES de ponerse a trabajar en nada del backlog.

> **Por qué existe.** Con 2-10 sesiones de Claude a la vez, dos sesiones cogían la misma tarea sin enterarse. **Caso real (20/07):** una sesión montó un worktree para arreglar el RD 176/2022 mientras otra ya lo estaba arreglando — y encima la ficha decía *"9 mislinks EN VIVO"* cuando ya estaban resueltos. Se perdió tiempo por dos motivos distintos: **falta de claim** y **ficha desfasada**. Este sistema ataca los dos.

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

1. **Coge ANTES de trabajar.** Si no está cogida en la tabla, para el resto de sesiones está libre — aunque tú ya lleves una hora con ella.
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

1. Añádela al markdown con id nuevo y prioridad: `### [T-044] 🟠 Título`. Debajo, 1-3 líneas: **qué, por qué/prioridad, link al cómo**. El detalle largo va en su runbook/roadmap, no aquí.
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
