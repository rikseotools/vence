# Runbook — Tareas pendientes (backlog con claim entre sesiones)

**Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** *"revisa las tareas pendientes"*, *"revisa el backlog"*, *"revisa los pendientes"*, *"¿qué tareas pendientes tenemos?"*, *"lista las tareas pendientes"*, *"tareas pendientes"*, *"coge una tarea"*, *"ataca la tarea X"*, *"dame la siguiente tarea"*, *"qué hago ahora"*, *"añádelo a pendientes"*, *"cierra la tarea X"*. Seguirlo ANTES de ponerse a trabajar en nada del backlog.

> **Nota de idioma:** el proyecto usa *"revisa X"* como disparador estándar (*"revisa los temas vacíos"*, *"revisa OEPs"*, *"revisa rollover"*…). *"revisa las tareas pendientes"* sigue esa misma convención y es la forma más natural — está cubierta arriba a propósito.

> **Por qué existe.** Con 2-10 sesiones de Claude a la vez, dos sesiones cogían la misma tarea sin enterarse. **Caso real (20/07):** una sesión montó un worktree para arreglar el RD 176/2022 mientras otra ya lo estaba arreglando — y encima la ficha decía *"9 mislinks EN VIVO"* cuando ya estaban resueltos. Se perdió tiempo por dos motivos distintos: **falta de claim** y **ficha desfasada**. Este sistema ataca los dos.

## Crear una ficha nueva: `reserve` PRIMERO

```bash
node scripts/backlog.cjs reserve "Título provisional de la tarea" --esfuerzo rato
#  ✅ id reservado: T-216
#     escribe la ficha y COLÓCALA con la herramienta (a mano se coloca mal — T-515):
#       node scripts/backlog.cjs ficha T-216 --texto <fichero.md>
#     y luego:  node scripts/backlog.cjs sync
```

### Y COLÓCALA con `ficha`, no a mano (T-515)

```bash
node scripts/backlog.cjs ficha T-216 --texto mi-ficha.md   # o por stdin
```

**A mano se coloca mal, y no es cuestión de tener cuidado.** Este fichero pasa de 11.000 líneas y la
frase `## Abiertas` aparece **dentro del texto** de varias fichas (las que hablan justamente de este
problema), *antes* que el encabezado de verdad. Un `index()`, un `sed` o «pégala arriba del todo»
aciertan la MENCIÓN, y la ficha aterriza en el preámbulo, fuera de toda sección.

Medido el 04/08 al estrenar el comando: **58 fichas huérfanas en el preámbulo, 27 de ellas VIVAS**
(T-504 🔴 entre ellas). O sea que colocarla mal era el resultado **normal**, no el desliz. Y el aviso
escrito no lo evitaba: el ancla falsa con la que tropezó la sesión que construyó esto era **un bullet
de otra sesión documentando esta misma trampa** — un aviso no es un guardarraíl.

`ficha` localiza el encabezado por **línea exacta** y se NIEGA a escribir si: el id no está reservado
en `backlog_tasks`, el id ya tiene ficha, la cabecera dice otro id, la ficha nace con `✅`, o
desaparecería alguna ficha previa (el guardarraíl de ids solo mira unicidad, y un id sigue siendo
único después de vaciarle el cuerpo).

⚠️ **No reduce los conflictos de git** y no lo pretende: todas las sesiones insertan en el mismo
punto del mismo fichero. Eso se resuelve al fusionar conservando **los dos lados**.

### Si alguna se quedó fuera: `reubicar`

```bash
node scripts/backlog.cjs reubicar            # simula
node scripts/backlog.cjs reubicar --apply    # escribe
```

Devuelve las fichas VIVAS huérfanas **al final de `## Abiertas`** (no al principio: arriba es donde
todas las sesiones escriben las fichas nuevas, y meter ahí un puñado es chocar con quien esté
creando una). **No toca las cerradas** huérfanas: su sitio sería `## Hechas` y hay TRES secciones
con ese nombre, así que elegir una es adivinar — y una ficha cerrada mal colocada no le cuesta nada
a nadie, mientras que una abierta invisible sí.

Comprueba antes de escribir que no desaparece ninguna ficha. La pasada del 04/08 movió 27 (cinco
🔴) dejando **498 fichas y 10.701 líneas con contenido, idénticas antes y después**.

Lo vigila el guardarraíl «ninguna ficha VIVA fuera de sección» (`backlogRegistry.guardrail`), que
nació en verde: cualquier subida es una regresión.

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
| **`docs/roadmap/tareas/T-nnn.md`** (uno por ficha, desde [T-532]) | CONTENIDO: título, por qué, cómo, hallazgos, links | Dos sesiones creando/editando fichas DISTINTAS nunca tocan el mismo fichero — el conflicto de git desaparece por construcción |
| **`docs/roadmap/tareas-pendientes.md`** | **ÍNDICE GENERADO** desde lo de arriba (`generarIndice()`) | Vista legible de siempre (preámbulo + `## Abiertas` + `## Hechas`), pero calculada, no editada a mano. Editarlo directamente se pierde en la próxima regeneración |
| **Tabla `backlog_tasks` (RDS)** | ESTADO: quién la tiene, desde cuándo, en qué acabó | Un fichero de texto **no admite claim atómico**: dos sesiones leen "libre", ambas escriben, gana la última |

El join es el **id `T-xxx`** de la cabecera de la ficha (`### [T-042] 🔴 Título`). Es estable aunque cambie el título. La SECCIÓN (`Abiertas`/`Hechas`) la decide la propia cabecera (`✅` = hecha), no dónde vive el fichero ni su posición.

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
node scripts/backlog.cjs due T-042 --fecha "2026-08-02 23:59" --motivo "quién lo espera o qué fecha externa lo fija"   # FECHA LÍMITE (lo contrario de snooze)
node scripts/backlog.cjs due T-042 --quitar
node scripts/backlog.cjs pause T-042 --tras-deploy --hecho "…" --falta "…"   # empezada, espera deploy
node scripts/backlog.cjs verificado T-042 --nota "…"   # YA lo comprobé y la tarea sigue viva (gemelo de pause)
node scripts/backlog.cjs wake T-042        # la despierta antes de tiempo
node scripts/backlog.cjs deployed <sha> --superficie frontend   # lo llama el propio deploy
node scripts/backlog.cjs reap              # SIMULA: qué claims son de sesiones muertas
node scripts/backlog.cjs reap --apply      # …y los devuelve al pool
node scripts/backlog.cjs sync              # importa ids nuevos del markdown a la tabla
```

El **session-id se resuelve solo** (`--sid` > fichero `.session-id` > `CLAUDE_CODE_SESSION_ID`), igual que en `scripts/impugnaciones/cola.cjs`. No hay que teclear nada.

### Reglas

1. **Coge ANTES de trabajar.** Si no está cogida en la tabla, para el resto de sesiones está libre — aunque tú ya lleves una hora con ella. **Y no depende de que te acuerdes:** el hook **`.husky/pre-push`** (`scripts/backlog-push-guard.cjs`) **bloquea el push** si un commit que empujas menciona un `T-NNN` vivo que no tienes reclamado (o lo tiene otra sesión). Fail-open si la BD no responde; escape legítimo con `BACKLOG_GUARD_SKIP="por qué" git push …` (pide MOTIVO desde T-497). Además `claim` **imprime la ficha entera** → reclamar y leer son el mismo acto.
2. **Renueva el lease** (`heartbeat`) si la tarea dura más de 90 min. Si no, otra sesión la considerará abandonada y la cogerá, con razón.
3. **Al cerrar, `done --outcome` basta.** Desde [T-532] («una ficha = un fichero») `done`/`reopen` marcan la cabecera de `docs/roadmap/tareas/T-nnn.md` y regeneran `tareas-pendientes.md` ellos solos — **NO edites el markdown grande a mano**, es un ÍNDICE GENERADO. Si quieres tocar el CONTENIDO de una ficha viva (añadir un hallazgo, corregir una cifra), edita `docs/roadmap/tareas/T-nnn.md` directamente; el índice se regenera solo al cerrar/reabrir, o a mano con `node scripts/backlog.cjs sync`.
4. **`next` sugiere, no coge.** Está pensado para que elijas por encaje: si acabas de construir una oposición, la siguiente oposición te cuesta la mitad.

## Al cerrar, SIEMPRE se sugiere lo siguiente (T-498)

`done` ya no acaba en seco. Imprime, en dos escalones:

1. las **relacionadas libres** — las que cita la propia ficha entre `[T-nnn]`. Son las que cuestan
   la mitad, porque el contexto ya está cargado;
2. si no hay ninguna, **lo que propondría `next`** (mismo criterio, no una copia);
3. y si tampoco hay nada libre, lo dice: *«el backlog está al día»*.

**Por qué ahí.** Cerrar es el momento en que el contexto está más cargado **y a punto de tirarse**:
acabas de leerte un subsistema entero. Hasta ahora `claim` sugería relacionadas y `done` no decía
nada, así que ese contexto se perdía salvo que alguien se acordara de mirar. Es el principio 10
—la regla llega en el MOMENTO DE LA VERDAD— aplicado al final en vez de al principio.

> El criterio de «qué toca ahora» vive en `lib/backlog/orden.cjs` y lo comparten `next` y `done`.
> Prioridad → lo más corto → lo no declarado al final (no se puede afirmar que algo sea rápido si
> nadie lo ha mirado). Y no se sugiere lo aparcado, lo que espera a un reloj o a un deploy, lo
> bloqueado por otra tarea abierta, ni lo que tiene lease vivo de otra sesión.

## El recordatorio de método llega a MEDIA tarea, no solo al empezar (T-495)

El método ya se imprimía al reclamar (`claim` suelta el orden entero con el `tools:buscar` escrito
para esa tarea) y el `pre-push` **bloquea** el push sin una sola capa. Entre esos dos extremos hay
horas — y la decisión de *«¿esto ya existe?»* o *«¿esto es un silo?»* se toma **en medio**.

Ahora vuelve en **tres momentos**, y ninguno es un reloj:

| cuándo | quién lo imprime | por qué ahí |
|---|---|---|
| el commit **estrena** ficheros | `pre-commit` | es exactamente cuando aplica «¿ya existe?», y trae el `tools:buscar` **con las palabras de ese fichero** |
| llevas **90 min** con la tarea | `heartbeat` | renovar el lease significa que el recordatorio del `claim` ya está sepultado |
| cada **15 mensajes** | hook `UserPromptSubmit` (`.claude/settings.json`) | cubre los tramos largos en que no estrenas nada ni renuevas el lease, pero sigues decidiendo |

**Por qué NO un temporizador.** Un texto cada N minutos dispara mientras la sesión piensa, compila
o espera un deploy — momentos sin ninguna decisión que corregir — y se aprende a saltar, que es
como murieron tres guardarraíles el 31/07. El turno de conversación sí es una unidad de trabajo:
cada uno es una decisión tomada.

**Y calla cuando no aplica**, que es lo que lo mantiene vivo: un commit que solo modifica ficheros
existentes no dice nada, y estrenar documentación, migraciones o tests tampoco (eso no es construir
una herramienta). El texto vive en **un solo sitio** (`lib/sessions/recordatorio.cjs`, 23 tests):
tres copias acabarían diciendo tres cosas distintas.

> Intervalo ajustable con `VENCE_RECORDATORIO_CADA` (por defecto 15).

## El PARTE: qué hace cada sesión y quién está parado (T-494)

```bash
npm run parte              # una pantalla; exit 3 si hay algo parado
npm run parte -- --json    # para encadenarlo
```

**La pregunta que no contestaba nadie era «¿quién está PARADO?»**, y no lo hacía porque **no vive
en ninguna tabla**: es el cruce de `backlog_tasks` (quién tiene qué) con `worktree_sessions` (quién
da señal). `list` pintaba la tarea como cogida, `latidos` pintaba la sesión como dormida, y había
que atar los dos cabos a mano cada vez.

**Qué enseña, en este orden y por este motivo:**

1. **El embudo de preguntas** ([T-493]) — lo único que depende de Manuel, y lo único cuyo coste
   corre mientras nadie lo lee.
2. **Tareas sin señal de su sesión**, con **tres motivos que no son el mismo**: `parada` (la sesión
   existe y calla) · `lease_vencido` (además `reap --apply` ya puede segarla) · `desaparecida` (esa
   sesión **nunca** latió — puede ser un CLI viejo, así que se dice, no se supone).
3. Quién trabaja ahora, con su worktree y su máquina.
4. Sesiones vivas **sin** tarea cogida: brazos libres.
5. Listas para verificar.
6. **Guardarraíles que se están rodeando** (7 días). No importa cuántas veces bloquean —eso solo
   dice que trabajan—: importa cuántas se **rodean**, que es el indicador adelantado de que van a
   dejar de servir ([T-423]).

**Lo que NO hace, a propósito:** repartir ni mandar. El claim ya reparte, es atómico y no se
olvida; un supervisor que redistribuyera metería una opinión y un punto único de fallo donde hoy
hay una regla. Y **no usa ningún modelo**: los hechos son deterministas, el resumen en prosa lo
pone quien lo lea.

**Nunca dice «todo bien» cuando no ha podido mirar.** Si ninguna sesión ha dado señal, el veredicto
es ⚪ *«no se puede afirmar nada»*, no 🟢. Un parte en verde por ceguera es la peor mentira posible.

> **Lo primero que encontró, en su primera ejecución:** el guardarraíl del índice compartido
> **rodeado el 67% de las veces** (banda `muerto`) — y es el único que bloquea de verdad. Es
> [T-496].

## Preguntar a Manuel sin entrar en su terminal — el EMBUDO (T-493)

```bash
node scripts/backlog.cjs preguntar "¿hago A o B?" --contexto "lo que ya he mirado" --tarea T-487 [--bloquea]
node scripts/backlog.cjs preguntas            # el embudo, como lo lee Manuel
node scripts/backlog.cjs responder 12 "haz B" # y la sesión se entera sola
node scripts/backlog.cjs retirar 12 --motivo "lo resolví solo: …"
```

**Por qué existe.** Con 2-10 sesiones, Manuel no puede entrar en cada terminal a ver si alguien le
necesita. Antes de esto una duda solo tenía dos destinos, y los dos malos:

- la **terminal de la sesión**, donde muere cuando la sesión muere;
- el `resume_check` de una tarea **PAUSADA**, donde `clasificarEspera` intenta adivinarla con cinco
  expresiones regulares. Si la sesión escribía *«falta que Manuel me diga si esto va a
  producción»*, ninguna casaba y **la pregunta desaparecía de la lista**.

Y obligaba a **pausar la tarea** para poder preguntar, que es una condición inventada: se puede
tener una duda y seguir trabajando en otra cosa.

**Las cuatro reglas, y cada una viene de un fallo ya pagado en este repo:**

1. **Preguntar NO bloquea.** Sigues con otra cosa. Si de verdad no puedes avanzar en nada, eso ya
   tiene nombre y es `pause` — decirlo con `--bloquea` es informar, no parar.
2. **La respuesta vuelve sola.** No hay bandeja que mirar: el CLI del backlog imprime lo que te han
   contestado en **cualquier** comando, igual que el latido late dentro de todo. Trabajar *es*
   enterarse.
3. **Se avisa UNA vez** (`seen_at`). Un aviso que se repite para siempre se vuelve indistinguible
   del ruido, que es exactamente cómo murieron tres guardarraíles el 31/07.
4. **Sin lease.** Todo lo demás aquí caduca porque caducar libera. Una pregunta no: caducar sería
   perderla, que es el fallo que este canal arregla.

**Se valida al escribirla**, no después: una pregunta de menos de 15 caracteres, o que expone un
problema sin plantear la decisión («esto va lento»), se rechaza con el ejemplo escrito. Si además
`--bloquea`, el **contexto es obligatorio** — es lo que permite desbloquearte sin ida y vuelta. El
criterio es puro y está en `lib/backlog/preguntas.cjs` (16 tests).

**Orden del embudo:** primero lo que tiene una sesión **parada**, y dentro de eso lo más viejo.
Ordenar solo por antigüedad enterraría una sesión bloqueada hace diez minutos detrás de cinco dudas
cómodas de ayer.

> **Lo viejo sigue ahí, marcado como legacy:** `list` aún pinta *«esperando una decisión de Manuel
> (por texto de pausa)»* deduciéndolo del `resume_check`. Se queda mientras haya tareas pausadas con
> la fórmula vieja y **no debe crecer**: para preguntar está `preguntar`. Dos criterios sobre el
> mismo hecho no protegen el doble, se contradicen ([T-130]).

## Lease, no lock

`lease_until` es un **arriendo renovable**, no un candado eterno. Una sesión que muere (se acaba el contexto, peta, cierras la ventana) libera su tarea sola al caducar el lease; una sesión viva la conserva mientras dé señales con `heartbeat`. Sin esto, el backlog se bloquearía solo la primera vez que una sesión muriese con una tarea cogida.

En `list` verás tres estados: `🟢 libre` · `🔒 <sid> (Xm)` cogida con lease vivo · `🟡 lease caducado (libre)`.

### …pero la fila hay que SEGARLA (`reap`, 31/07)

El lease vencía, sí, pero **nadie limpiaba la fila**: se quedaba `in_progress` con el `claimed_by`
de una sesión que ya no existe, para siempre. `list` lo pintaba «🟡 lease caducado (libre)» —que es
cosmético— mientras el registro seguía afirmando que alguien la estaba haciendo. Medido el 31/07:
**T-214, T-221 y T-238 llevaban 72-79 h así**, y sus sesiones (`cordoba-plazas`,
`clonado-provenance`, `sesion-28jul-d`) no tenían ni worktree ni latido.

No era solo higiene. El **push-guard sí miraba `claimed_by`** y no el lease, así que cualquiera que
mencionara una de esas tres en un commit se comía un *«la tiene la sesión X — coordina o espera a
que libere»* **de un muerto**, sin más salida que `BACKLOG_GUARD_SKIP=1`, que apaga el guard
ENTERO. Un bloqueo imposible de satisfacer no protege: enseña a saltarse la protección.

```bash
node scripts/backlog.cjs reap            # simula (por defecto): quién está muerto y desde cuándo
node scripts/backlog.cjs reap --apply    # las devuelve al pool: open, sin dueño
```

**Dry-run por defecto a propósito** — soltar el trabajo de otra sesión es justo el accidente que
este subsistema existe para evitar. El margen (`--horas`, 24 por defecto) se cuenta *sobre* el
vencimiento: el lease son 90 min, así que 24 h ya es una sesión inequívocamente muerta. **No toca
la ficha**: el contexto de la tarea se conserva entero.

> Antes de segar, mira si esa sesión dejó trabajo sin pushear (`git -C <wt> status` y
> `git log origin/main..`). `reap` no borra nada, pero saberlo evita re-hacer lo que ya está hecho.

## Las CINCO esperas, y por qué no son la misma

| Situación | Campo | Qué significa | ¿`claim` la entrega? |
|---|---|---|---|
| La estoy haciendo yo | `claimed_by` + `lease_until` | ocupa a una sesión; caduca a los 90 min | ❌ nunca (forzarlo es pisar trabajo ajeno) |
| Depende de otra tarea nuestra | `blocked_by` | dependencia interna del backlog | ❌ salvo `--force --motivo` |
| Hasta cierta hora no hay NADA que hacer | `snooze_until` | reloj EXTERNO: un cron que no ha corrido, una cosecha, la fecha en que toca medir | ❌ salvo `--force --motivo` |
| **Hecha, pero no se puede verificar hasta que se despliegue** | **`wake_on_deploy_sha`** | **CONDICIÓN, no reloj: «mi commit ya está vivo». No hay fecha que poner** | ❌ salvo `--force --motivo` |
| **Hecha, con entregable, y falta que una PERSONA lo revise** | **`review_requested_at` + `review_note`** | **la despierta alguien mirando, ni el reloj ni el deploy** | ❌ salvo `--force --motivo` |

### La quinta: `revision` — «hecho, esperando que lo mires» (T-539, 04/08)

```bash
node scripts/backlog.cjs revision T-533 --entrega "propuesta de recorte 25-37 verificada contra el BOC, sin aplicar"
node scripts/backlog.cjs wake T-533        # al aprobarla: vuelve al pool
```

**Suelta el claim**, como `pause`: entregar es soltarla, y un lease agonizando sobre algo terminado
impide que la coja quien vaya a revisarla. Sale bajo 🙋 en `list` y en `npm run parte` con **desde
cuándo espera** —una revisión parada tres días es el dato que importa— y **quién la dejó**, para
poder preguntarle.

**La entrega es OBLIGATORIA** (≥20 caracteres; «revisar», «listo», «ok» no cuelan) y lo hace cumplir
un CHECK de la tabla, no solo el CLI. No es burocracia: con varios trabajadores entregando a la vez,
una petición sin entregable obliga a quien revisa a reconstruir el contexto y adivinar qué se espera
de él — y la revisión es el recurso escaso.

**Por qué hacía falta un campo.** Esto se DEDUCÍA de la prosa de `resume_check` con cinco
expresiones regulares, y el propio código lo defendía: *«no hay campo para esto y añadir uno
costaría una migración para algo que se resuelve leyendo lo que la gente YA escribe»*. La primera
vuelta del piloto de flota lo desmintió en una tarde: el trabajador terminó una auditoría, dejó una
propuesta lista y **no tenía comando con el que decirlo** — acabó en `pause --hasta "2026-08-06
09:00"` con una fecha inventada, porque su bloqueo no era el reloj. Es el mismo patrón corregido ya
dos veces aquí (`snooze_until`, `due_at`): **una condición en prosa no es una condición**. La
heurística de texto se conserva SOLO para las filas anteriores.

> **Lo que encontró la simulación y no los tests:** la comprobación estaba puesta únicamente en
> `claimGate`, que es quien REDACTA el motivo del rechazo. Los unit pasaban y la tarea **se
> entregaba igual**, porque quien decide es el `UPDATE ... WHERE` del claim. Y en el mismo pase, el
> `SELECT` que alimenta el gate no traía la columna, así que el rechazo ocurría pero se explicaba
> con otro motivo. Las dos cosas solo se ven ejecutando: `npm run sim:espera-revision` (17 casos).

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

## El push-guard: qué bloquea y las CUATRO cosas que ya no (31/07)

El guard existe para un fallo concreto: **el olvido de reclamar** (colisión T-047/T-050 del 20/07).
Ese sigue bloqueando igual. Lo que se quitó son tres bloqueos que **no se podían satisfacer**, y que
por eso empujaban al `BACKLOG_GUARD_SKIP=1` — que apaga el guard entero, para todos los ficheros del
push. Un guardarraíl al que se aprende a rodear protege menos que uno que no existe.

| Situación | Antes | Ahora |
|---|---|---|
| La tarea la tiene otra sesión **con lease vivo** | ❌ bloquea | ❌ **bloquea** (es su razón de ser) |
| Tarea viva **sin reclamar** | ❌ bloquea | ❌ **bloquea** (el olvido) |
| La tiene una sesión cuyo **lease ya venció** | ❌ bloqueaba para siempre | ✅ pasa (con aviso) |
| La **pausaste tú** (`pause`) y espera deploy/reloj | ❌ callejón sin salida | ✅ pasa (con aviso) |
| El push toca **solo** `docs/roadmap/tareas-pendientes.md` | ❌ bloqueaba | ✅ pasa (con aviso) |
| El commit la **CITA en el cuerpo** y declara otra en el asunto | ❌ bloqueaba | ✅ pasa (con aviso) |

- **Lease vencido:** `claim` ya entregaba esa fila (`lease_until < now()`); el guard decía lo
  contrario. **Dos puertas al mismo recurso con criterios distintos no protegen: se contradicen.**
- **Pausa propia:** `pause` suelta el claim a propósito y `claim` no entrega una tarea en espera,
  también a propósito. Juntos cerraban la salida — pausas, pusheas, te manda a reclamar, y `claim`
  se niega. Y el orden natural al terminar es **cerrar la tarea y luego pushear**, así que lo pisaba
  cualquiera que hiciese las cosas bien.
- **Solo la ficha:** documentar una tarea **no es trabajarla**. Abrir una ficha para dejar
  constancia de algo que NO vas a atacar y tener que reclamarla para poder pushear es peor que no
  reclamar: se la quitas a quien sí iba a hacerla. El corte es estrecho a propósito — **solo ese
  fichero** (escribir un runbook sí es trabajo), y **cede** si otra sesión la tiene con lease vivo.

- **Citar no es trabajar (T-403):** las fichas de este repo se cruzan sin parar
  (`Relacionadas: [T-xxx]`) y los mensajes de commit copian esa costumbre, así que **cuanto mejor
  escrito estaba el commit, más probable era que el guard lo parase**. Pasó dos veces el 31/07 —
  `feat(T-400)` citando T-361 y T-385, y `fix(T-408, T-410)` citando T-321— con las tres salidas
  malas probadas: reclamar una tarea que no vas a trabajar (le robas el reparto a quien sí),
  `BACKLOG_GUARD_SKIP=1` (apaga el guard entero), o **quitar el id del mensaje**, que es lo que se
  hizo y tiene coste real: ese id era la traza de por qué NO se abrió un cuarto script duplicado.
  El guard empujaba a escribir peores mensajes de commit.

  La regla es más estrecha que la obvia, **y la diferencia la decidió la medida**:

  | Dónde sale el id | ¿Exige claim? |
  |---|---|
  | En el **asunto** de algún commit, o en el nombre de la rama | ✅ sí — eso es declarar trabajo |
  | Solo en el **cuerpo** de un commit **cuyo asunto ya declara** otra tarea | ❌ no: es una cita |
  | Solo en el cuerpo de un commit **cuyo asunto no declara nada** | ✅ **sí** (ver abajo) |

  La ficha proponía «el cuerpo nunca bloquea». Medido sobre los 6.070 commits del repo, eso
  **habría abierto un 17,2 %**: con el asunto mudo el id del cuerpo sí suele ser el trabajo —22
  casos son de T-089, cuyos commits se titulan `docs(koigrid): …` y dejan el id abajo—. En la
  banda que sí se relaja (asunto con id) la cifra es **2,8 %**, y las 6 revisadas a mano eran
  contexto o tarea vecina que comparte fichero.

  ```bash
  npm run sim:push-guard-menciones -- --ejemplos    # re-mide sobre el historial; GATE al 6 %
  ```

  Es un **gate, no un informe**: la regla se apoya en cómo escribe los commits este repo, y si esa
  costumbre cambia la relajación deja de ser segura sin que nadie se entere. Y a diferencia de la
  exención de «solo documento la ficha», **esta no cede ante un lease vivo ajeno**: escribir la
  ficha de otro toca su producto de trabajo, nombrarlo en un párrafo no toca nada suyo.

**Los avisos se imprimen siempre**, pase o no el push: una excepción silenciosa es una excepción que
nadie revisa. Núcleo puro en `lib/backlog/pushGuard.cjs`, con tests de las cuatro reglas y de que
ninguna abre el hueco del olvido.

**Y este cambio se MIDE con el contador de fricción, no con uno propio** (T-403 + [T-423]). La
relajación existe para que el guard pare menos veces sin dejar de proteger, y eso se lee en la serie
de `sesion_friccion`: menos `guard_bloqueo` de `backlog-push` y, sobre todo, menos `guard_escape` —
el ratio entre los dos es el indicador adelantado de que un guardarraíl se está muriendo.

```bash
npm run sesiones:friccion      # ratio de escape por guardarraíl: sano / erosión / muerto
```

No se añadió un evento aparte a propósito: dos emisores del mismo hecho no miden el doble, divergen.


## El OTRO guard del push: no borrar la ficha de otra sesión (T-428, 31/07)

El de arriba mira **claims**. Este mira **contenido**, y son cosas distintas: puedes tener tu tarea
perfectamente reclamada y aun así llevarte por delante la documentación de otro.

**Qué bloquea:** que tu push borre el cuerpo de una ficha **viva** que ya está publicada en
`origin/main` — la ficha entera (`desaparecida`) o más de la mitad de su texto (`mermada`).

**Por qué hacía falta.** Este fichero es el que **todas** las sesiones tocan, y las fichas nuevas se
insertan todas en el mismo sitio, así que el conflicto de merge no es la excepción: es lo normal
(cuatro veces en una sola tarde del 31/07). Resolverlo quedándose con «su» lado borra el trabajo del
otro **en silencio**, y no lo veía nada: `backlogRegistry.guardrail` comprueba que los **ids** sean
únicos —y un id sigue siendo único después de que le borres el cuerpo entero—, `sync` reconcilia
título y prioridad, y el push-guard mira claims. **La ficha podía quedarse en una línea con el CI en
verde.** Pasó dos veces el mismo día (T-427 perdió 5 fichas por un cherry-pick) y las dos se
recuperaron por casualidad, porque alguien volvió a abrir la ficha.

**Si te bloquea, lo más probable es que sea correcto.** Mira qué se pierde con
`git diff origin/main -- docs/roadmap/tareas-pendientes.md` y **conserva los dos lados**: son fichas
distintas de sesiones distintas, casi nunca hay que elegir.

**Si el borrado es a propósito** (renumerar una ficha, quitar una entrada que no era una tarea —los
dos casos legítimos que aparecieron al medir la historia—):

```bash
CONTEXTO_GUARD_SKIP="por qué lo borras a propósito" git push …
```

Escape **propio**, no el del otro guard: compartirlo apagaría los dos de una vez. Se imprime y se
cuenta (`npm run sesiones:friccion`).

**No confundir con el aviso de fichas huérfanas del `sync`** (`lib/backlog/fichaHuerfana.cjs`): aquél parte de la **BD** (fila viva sin ficha), informa y no bloquea, y es la red que recoge lo que llegue por cualquier vía. Éste parte del **markdown**, en el `pre-push`, y bloquea. Por eso ve dos cosas que el otro no puede ver: la ficha **vaciada** —el id sigue ahí, así que su fila no es huérfana y para él está sana— y el **momento**, porque lo para antes de que entre en `main` en vez de contarlo después. Y al revés, él cubre la ficha que nunca llegó a escribirse. Se solapan solo en «ficha desaparecida», y ese solape es a propósito: una red detrás de una puerta.

**Calibrado, no intuido.** `npm run sim:perdida-contexto` pasa el detector por los 1.063 commits del
fichero: dispara en el **0,9%** de ellos, y en el **91%** de las fichas que señala alguien tuvo que
restaurarlas a mano después. Comprobación de extremo a extremo con repo de usar y tirar:
`npm run sim:contexto-guard` (8 casos, incluido el del merge). Núcleo puro
`lib/backlog/perdidaDeContexto.cjs`, 29 tests.

## Saber EN VIVO si otra sesión va a lo mismo (T-400, 31/07)

El claim reparte **ids de tarea**. El trabajo colisiona en **rutas de fichero**, y eso el claim no
lo ve: [T-361] fue el mismo bug encontrado por dos sesiones el mismo día, [T-130] un quinto escritor
de `seguimiento_url` sin ver los otros cuatro, y T-375/T-382 se cogieron por separado siendo los
mismos ficheros. Con el claim funcionando perfectamente en los tres casos.

Ahora **cada sesión publica su huella** —los ficheros que tiene sucios o por delante de
`origin/main`— y lo hace el propio latido, sin que nadie tenga que anotar nada:

```bash
node scripts/sessions/latidos.cjs     # el mapa: quién pisa a quién, ahora mismo
```

Y **`claim` avisa al reclamar**, antes de que escribas una línea: cruza los ficheros que ya movió
esa tarea (commits que la mencionan) y los que cita su ficha, contra la huella de las sesiones vivas.

- **Se OBSERVA, no se declara.** Sale de git. Una intención anotada se pudre en cuanto el trabajo se
  desvía —y se desvía siempre—; el estado observado no puede mentir.
- **Avisa, nunca bloquea.** Dos sesiones pueden tocar el mismo fichero por motivos legítimos, y un
  corte por solape se acabaría rodeando (la lección de T-375: el bloqueo imposible enseña a apagar
  el guard entero).
- **Si no puede ver a alguien, lo dice.** Una sesión con el latido viejo sale como *«no puedo
  descartar solape»*, nunca como verde.
- **Calibrado sobre los worktrees reales**, no a ojo: el único fichero que comparten 3+ sesiones es
  el propio markdown del backlog, así que está excluido junto a `CLAUDE.md` y las rutas desechables.
  El solape real es escaso → el aviso salta poco → se lee.

> 🚨 **Y lo primero que encontró:** cuatro sesiones latiendo desde el **mismo checkout**. Eso es peor
> que el solape y sale aparte: en worktrees separados el choque acaba en un conflicto de git, visible
> y reversible; en el mismo directorio se sobrescriben en vivo y no hay nada que avise. Lo sano es un
> worktree por sesión (`scripts/worktrees/crear-worktree.sh <slug>`).

## Guardarraíles (lo que evita que vuelva a pasar lo del 20/07)

- **`__tests__/guardrails/backlogRegistry.guardrail.test.ts`** (corre en CI, sin BD): toda cabecera lleva id, los ids son únicos y con formato `T-NNN`, toda tarea viva declara prioridad, existe la sección `## Abiertas`, y **ningún título codifica un candado de fecha** (`NO COGER HASTA`, `MEDIR EL 11/08`, `⛔`, `⏱`) — eso va a `snooze_until`, que vence solo; un título no. Si alguien añade una tarea sin id, el CI se pone rojo — porque sin id **nadie puede cogerla**.
- **`lib/backlog/claim.ts` → `findBacklogDrift()`**: detecta el fallo exacto del 20/07 — tarea `done` en BD que sigue anunciada como abierta en el markdown (y el caso inverso). Testeado en `__tests__/backlog/claim.test.ts`.
- **`findZombieClaims()`**: `in_progress` con el lease caducado hace >24 h = sesión zombi o cierre olvidado.
- **`backlog.cjs sync`** avisa de ids que están en la tabla pero no en el markdown (tareas fantasma, sin contexto). **Ese aviso va lo PRIMERO y separa cuatro casos que no se parecen** (`lib/backlog/fichaHuerfana.cjs`, testeado en `__tests__/backlog/fichaHuerfana.test.ts`):
  | Motivo | Qué pasó | Qué hacer |
  |---|---|---|
  | 🔴 `borrada` | la ficha SÍ estuvo en `origin/main` y ya no está → **regresión** | recuperarla: `git log -S'### [T-NNN]' -- docs/roadmap/tareas-pendientes.md`. El aviso **nombra el commit** que se la llevó |
  | ⚠️ `no_verificable` | no se pudo consultar `origin/main` | **no es «está bien»**: es que no se sabe. Comprobar el remoto y repetir el `sync` |
  | ↻ `desactualizada` | la ficha está VIVA en `origin/main`; tu rama va por detrás | `git pull --rebase origin main`. No falta nada — y ojo: escribirla otra vez es como nacen dos fichas con el mismo id |
  | ℹ️ `sin_pushear` | la ficha nunca existió en `origin/main` → otra sesión lo reservó y viaja en su worktree | nada: es lo normal con 2-10 sesiones |

  **La prueba está en `origin/main`, no en tu rama (T-427, 31/07).** El aviso de arriba se construyó el 29/07, llevaba **dos días en `main`** cuando pasó el incidente que tenía que cazar… y lo anunció como sano: *«ℹ️ sin ficha aquí todavía (otra sesión sin pushear): T-414, T-416, T-422…»* mientras el commit `a9797ae3a` acababa de borrar esas cinco fichas de `main`. El motivo es estructural: miraba `git log -S` sobre el **HEAD local**, y un worktree nace de `origin/main` en un instante T0 — no alcanza nada de lo que otra sesión pushee después, o sea que era ciego **justo para las fichas ajenas**, que son las que protege. Ahora se consulta `origin/main` (con `git fetch` previo) y los hechos de git viven aparte (`lib/backlog/gitFichas.cjs`) para poder ejercitarlos contra un repo de prueba que reproduce el incidente.

  > **Dos lecciones que valen fuera de aquí.** (1) El núcleo puro tenía seis tests en verde y acertaba con los datos que le daban: **el fallo estaba en los datos**, y lo que hablaba con git no era testeable porque vivía dentro de un CLI que arranca conectándose a la BD. Lo no testeable es donde se esconden los fallos. (2) Al estrenarlo acusó de «BORRADA» a la primera ficha huérfana **teniéndola delante en `origin/main`**: el markdown pesa **2,2 MB** y el `maxBuffer` por defecto de `execFileSync` es 1 MB, así que `git show` moría y ese `null` se leía como «no está». Lo cazó correr el `sync` de verdad, no los tests —su repo de prueba tenía tres líneas—. Por eso ahora hay un test con un fichero de más de 1 MB, y `hechosDeOrigin` **se niega a contestar** si no pudo leer el fichero: decir «no lo sé» cuesta una comprobación a mano; acusar en falso cuesta la credibilidad del aviso, y un aviso desacreditado no vuelve.

  **Y no depende de que alguien esté mirando esa terminal:** el caso `borrada` emite `backlog_ficha_borrada` en `observable_events` y lo vigila una regla propia con el mismo nombre (`backend/src/alerts/alert-rules.ts`, correo con cooldown de 12 h). Hacía falta porque **quien borra la ficha no es quien corre el `sync` después**, y la sesión víctima puede haber muerto ya — las dos veces que pasó se descubrió por casualidad.

  **Por qué se cambió (29/07/2026).** El commit de tests `4127f3e17` subió una **copia rancia** del markdown y borró de `main` las fichas de **T-251 y T-254**. Las dos tareas seguían VIVAS en la tabla, así que `list` las ofrecía por su título y detrás no había ficha que leer — una sesión podía cogerlas sin poder saber qué eran. El aviso que lo cazaba ya existía, pero fallaba por dos motivos independientes: **(1)** se imprimía al FINAL, después de dos `process.exit(2)`, y ese día el `sync` abortaba antes por una colisión de id **ajena** (T-219), así que no llegaba nunca; **(2)** no distinguía la regresión del trabajo en vuelo de las demás sesiones, que es lo habitual — y un aviso que se enciende todos los días por algo sano se acaba ignorando, el mismo final que ya tuvo cuando incluía a las CERRADAS (T-033/T-039/T-046). La prueba de que la ficha existió es el **historial del fichero**, no la antigüedad de la tarea. **Fail-open:** si git no puede contestar, se calla — inventarse una regresión es peor que perderla.

  > **Lección de método:** un hallazgo que solo se publica cuando todo lo demás va bien es un hallazgo que falta justo el día que hace falta. Las comprobaciones de solo lectura van antes que los abortos.

## Lo que cuenta como ABIERTA lo dice el ✅, no dónde caiga la ficha (31/07)

**Al cerrar, la cabecera lleva `✅`.** No es decoración: es la única marca que leen el `sync`, el
detector de deriva y los guardarraíles de CI.

```
### [T-286] ✅ [HECHA 29/07] Título…      ← cerrada
### [T-342] 🟡 [ABIERTO 30/07] Título…    ← abierta
```

Hasta el 31/07 «abierta» se deducía de la POSICIÓN: caer entre `## Abiertas` y el siguiente `##`.
Medido sobre el fichero real, **145 de las 177 tareas vivas quedaban fuera** — hay tres secciones
`## Hechas` y varias `##` sueltas, y las fichas se escriben donde caben. Consecuencias, todas
reales y ninguna visible:

- `sync` daba esas 145 por cerradas y **no reconciliaba su título ni su prioridad**. Al arreglarlo
  saltaron 31 divergencias, **4 de ellas de prioridad 🔴 que la tabla tenía como `media`**: el orden
  de ataque llevaba días mintiendo (T-244, T-315, T-392, T-399).
- Peor: el **guardarraíl anti-colisión del `sync`** —el que impide pisarle la ficha a otra sesión,
  nacido de T-225— solo consultaba los ids «abiertos», o sea **32 de 177**. El 82% del backlog
  estaba fuera de la protección y nadie lo sabía.
- Y `findBacklogDrift()` no podía delatar una ficha desfasada, que es su único trabajo.

**Se descartó a propósito** aceptar además la primera etiqueta (`[HECHA …]`) como marca: habría
acertado 8 casos más pero fallado uno en la dirección **peligrosa** —la ficha viva
*«[HECHO 24/07 — quedan 3 follow-ups pequeños]»* pasaría por cerrada, en silencio—. Una convención
que se hace cumplir vale más que un heurístico que adivina, así que hay **guardarraíl de CI**: una
cabecera que anuncie cierre (`[HECHA …]`, `[CERRADA …]`) sin el `✅` pone el CI rojo.

> El parseo vive en **`lib/backlog/parseMarkdown.cjs`**, que ahora es la **fuente única**: hasta ese
> día estaba escrito dos veces —`scripts/backlog.cjs` y `lib/backlog/claim.ts`— y los criterios ya
> habían empezado a divergir. Dos lectores del mismo fichero que no coinciden en qué está abierto
> son exactamente el fallo que este subsistema existe para evitar.

## ¿Está vivo el andamiaje? — `npm run sesiones:friccion` (T-423)

Todo lo de arriba contesta *«¿qué pasa AHORA?»*. Esto es lo único que deja **serie temporal**, y
lo que mide no es lo que parece:

> **No importa cuántas veces bloquea un guardarraíl —eso solo dice que trabaja—. Importa cuántas
> veces lo RODEAN.** Ese ratio es un indicador **adelantado**: se ve subir antes de que el
> guardarraíl deje de servir.

| se rodea… | veredicto | qué hacer |
|---|---|---|
| <25% | 🟢 sano | nada: el escape hace de válvula, que es su función |
| 25-66% | 🟠 erosión | hay un caso legítimo que no contempla — búscalo |
| ≥66% | 🔴 **muerto** | ya no protege, es un peaje: arregla el criterio **o quítalo** |

El 31/07 murieron **tres** guardarraíles exactamente así —el aviso que gritaba en falso hasta que
se ignoró, el bloqueo imposible de satisfacer, y el escape que se volvió rutina— y los tres se
descubrieron **por casualidad**. Esto existe para no depender de la casualidad.

Con pocos datos **no opina**, y un cero recién estrenado se lee como *«todavía no ha corrido»*, no
como *«no hay fricción»*.

## ⛔ UNA SESIÓN POR DIRECTORIO — el `pre-commit` lo hace cumplir (T-415, 31/07)

Si otra sesión viva trabaja en TU mismo directorio, **el commit se para**.

```
scripts/worktrees/crear-worktree.sh <un-nombre>     # el arreglo, 30 segundos
git commit -m "…" -- <tus/ficheros>                 # commit PARCIAL: no lo bloquea (T-486)
INDICE_COMPARTIDO_OK="por qué tienes que commitear aquí" git commit …   # el escape: pide MOTIVO (T-496)
```

**El commit PARCIAL no dispara el guardarraíl, y esa es la salida para el caso más común** (T-486,
04/08): ya estabas trabajando aquí y otra sesión ha empezado a latir en el directorio *después*.
Al nombrar las rutas, git construye un **índice temporal propio** (`next-index-<pid>`) y commitea
desde ahí: lo que la otra sesión tenga preparado **ni entra en tu commit ni se toca** — sigue
staged para ella. No es una excepción de confianza, es que el fallo no puede ocurrir.

Salió de medir los escapes: de los 3 posteriores a T-496 —los primeros con motivo escrito— **2
decían exactamente eso**, o sea que ya se estaba resolviendo bien y el guardarraíl obligaba a
apagarse para hacer lo correcto.

> ⚠️ **`git commit -a` NO vale**, aunque también traiga un índice distinto (`index.lock`): barre el
> árbol de trabajo entero, que también se comparte, y **se lleva lo ajeno** — medido. Por eso el
> criterio es el nombre exacto del índice temporal y no «un índice distinto del normal».
> Comprobable sobre repos git de verdad: `npm run sim:indice-parcial`.

**Por qué no basta con tener cuidado:** `git add` escribe en el índice del **REPOSITORIO**, no de
tu sesión. Con dos sesiones en el mismo directorio, el `add` de una y el `commit` de la otra son
**la misma cola**, y git no puede saber quién puso qué — el dato de «quién» no existe, así que
ningún guardarraíl sobre el contenido puede arreglarlo.

Pasó el 31/07: el trabajo de una sesión (una migración, un núcleo puro, sus tests y un
guardarraíl) acabó en `main` **bajo el mensaje de commit de otra**. No se perdió nada, pero la
historia miente y el `outcome` de la ficha no correspondía a su commit. El mismo día se midieron
**cinco sesiones latiendo desde el checkout principal**.

> **Este bloqueo SÍ bloquea, y el mismo día se quitaron tres que no.** Los de T-375 eran
> *imposibles de satisfacer* (esperar a una sesión muerta) y por eso enseñaban a apagar el guard
> entero. Éste se arregla con **un comando**, y la alternativa corrompe trabajo ajeno de forma
> irreversible. **Una sola** sesión en el checkout principal es lo normal y no dispara nada: el
> problema no es el sitio, es la concurrencia.

## Una sola identidad de sesión (T-407)

Todo el reparto —claim, lease, cola de impugnaciones, push-guard, latido, mapa de solape— cuelga
del `session-id`. Se resuelve en **un solo sitio** (`lib/sessions/sid.cjs`): `--sid` > el fichero
`.session-id` del worktree > `CLAUDE_CODE_SESSION_ID`. **El fichero gana a la variable** porque es
del worktree y describe dónde estás trabajando, mientras que la variable puede venir heredada.

Había **seis copias** de esa resolución con **dos reglas distintas**, y una sesión llegaba a verse
a sí misma como ajena («la tiene otra sesión» siendo ella). Un guardarraíl de CI impide que nadie
vuelva a leer el fichero o la variable por su cuenta.

## Esfuerzo y tiempo: se declara en cajones y se MIDE (T-414)

```bash
node scripts/backlog.cjs reserve "Título" --esfuerzo rato   # OBLIGATORIO: sin él, aborta
node scripts/backlog.cjs esfuerzo T-042 sesion_propia       # cambiarlo después
```

| cajón | qué decisión habilita |
|---|---|
| `minutos` | se cierra ya — encaja al final de cualquier sesión |
| `rato` | una hora larga; cabe en una sesión con otras cosas |
| `larga` | media sesión: ya no cabe junto a otra tarea grande |
| `sesion_propia` | necesita una sesión entera para ella sola |

- **En cajones y no en horas** a propósito: una estimación en horas se vuelve ficción («2h» para
  todo) y envejece sola, igual que las fechas que se escribían en los títulos. **La frontera que
  de verdad cambia una decisión es la última.**
- **`list` y `next` ordenan por prioridad y, a igualdad, por lo más CORTO.** Lo **no declarado va
  al final** de su prioridad, nunca al principio: no se puede afirmar que algo sea rápido si nadie
  lo ha mirado.
- **Se MIDE solo** (`worked_seconds`): se acumula el rato con la tarea reclamada de verdad, por
  tramos. Al cerrar, `done` canta el contraste: *«3h 12m — declaraste rato (techo 2 h): se PASÓ»*.
  Antes de esto había **0 tareas con duración medible** —cerrar borraba `claimed_at`— así que
  ninguna estimación se podía desmentir, y un campo que nadie puede desmentir se rellena a ojo.
- **Deuda:** las 182 tareas anteriores no lo llevan; se declara según se tocan. `list` cuenta
  cuántas faltan. **No se rellenaron en bloque a propósito**: sería una tarde inventando datos.

**Tareas RELACIONADAS: no hay campo que rellenar.** `claim` las deduce de los `[T-nnn]` que la
propia ficha ya cita y enseña las que están vivas y libres. Derivarlo es mejor que pedirlo: un
campo obligatorio se rellena vacío o miente; el enlace lo escribe quien sabe que existe, mientras
escribe. Y el contexto es lo caro — si acabas de leerte un subsistema, la siguiente tarea de ese
subsistema cuesta la mitad.

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

## Lo que arreglas AL VUELO también lleva ficha (regla de Manuel, 30/07/2026)

Atendiendo un feedback, revisando otra cosa o de pura casualidad, aparecen fallos que se
arreglan en el momento. **Ese arreglo no puede quedarse solo en el commit.** Un commit
explica qué se cambió; lo que hace falta meses después, cuando el fallo reaparece con otra
cara, es **qué lo originó, qué se vio y por qué se resolvió así**. Sin ficha, la siguiente
sesión vuelve a investigarlo desde cero y no sabe siquiera que ya pasó.

**Antes de arreglarlo:**

```bash
grep -ni "<palabra clave>" docs/roadmap/tareas-pendientes.md   # ¿hay ficha ya?
node scripts/backlog.cjs list | grep -i "<palabra clave>"      # ¿la tiene alguien cogida?
```

- **Si YA hay ficha** → trabájala ahí: `claim`, y al cerrar `done --outcome "…"` (marca la
  cabecera y regenera el índice solo, desde [T-532]). No abras una segunda: el mismo fallo con
  dos fichas es peor que sin ninguna.
- **Si NO hay** → `reserve` y escríbela **aunque ya lo hayas arreglado**. Nace y muere en el
  mismo commit, y está bien: lo que importa es que quede el rastro.

**Qué tiene que decir la ficha** (las tres, siempre):

1. **ORIGEN** — cómo apareció. Quién lo reportó y con qué palabras, o qué estabas mirando
   cuando saltó. *«Salió verificando la pregunta de un usuario premium sobre el filtro de
   artículos»* vale mucho más que *«bug del contador»*.
2. **CONTEXTO Y MEDIDA** — qué se vio, con números. Cuánta gente afectada, cuántas veces,
   desde cuándo. Sin cifra, dentro de un mes nadie sabe si fue un caso o doscientos.
3. **RESOLUCIÓN** — qué se cambió, **por qué no lo cazó nada antes** y qué capa se añadió
   para que la próxima vez sí. Esa parte es la que evita repetir el fallo, no el diff.

Y si al arreglarlo descubres que el problema **no era el que creías**, escríbelo también: un
diagnóstico descartado ahorra la siguiente investigación entera.

## Cuando termines: pushear y desplegar

El trabajo no está hecho hasta que está en `main` (y, si toca código de app, desplegado). **El procedimiento completo está en [`docs/runbooks/pusheo-revision-despliegue.md`](./pusheo-revision-despliegue.md)** — léelo, no improvises. Resumen de lo que más afecta a este flujo:

- **Un worktree + rama por sesión** (`git worktree add -b feat/<tarea> <ruta> origin/main`). Ninguna sesión toca los ficheros de otra.
- **Pushear a `main` ≠ desplegar.** Pushear es estacionar + disparar CI: se hace en cuanto TU tarea está completa, sin esperar a nadie. **Desplegar es cumulativo** (sube TODO lo que haya en `main`) y por eso se coordina.
- **La política es AGRUPAR: no despliegues al pushear** (decisión de Manuel, 29/07). Una sola sesión despliega por todas — un deploy por sesión multiplica build y minutos de Fargate sin que nada llegue antes. Si tu trabajo no se puede verificar hasta estar vivo, **no te quedes esperando: apúntate** con `pause <id> --tras-deploy --superficie …` y suelta el claim. Antes de desplegar, `npm run deploy:pendiente` dice si toca (🔴 = hay tareas terminadas esperando) o si se sigue acumulando (🟡).
- **Cuando alguien despliega, tu tarea te vuelve sola.** El deploy llama a `backlog.cjs deployed <sha>` y despierta las que ya van dentro; aparecen en `list` bajo **`⏰ LISTA(S) PARA VERIFICAR`** con lo que dejaste escrito en `--falta`. **Míralo al empezar sesión**: puede haber trabajo tuyo (o de otra sesión que ya no existe) a un solo `claim` de poder cerrarse.
- **El deploy tiene gate de CI y guardarraíl anti-stale**: aborta si los checks de código (unit/typecheck/lint) no están verdes para tu HEAD, o si tu árbol va por detrás de `origin/main`. Con varias sesiones pusheando, sincroniza al último `origin/main` **verde** y reintenta.
- `integration` en rojo **no** bloquea el deploy (es señal de datos/otras sesiones), pero míralo antes de soltar.

## Al TERMINAR de trabajar: cuatro salidas, y el CLI no te deja equivocarte

**Programar la vuelta no puede depender de que alguien se acuerde** (Manuel, 30/07: *"si no se
quedan en el olvido y tengo que fiarme de que tú te acuerdes de ponerles un temporizador"*). Por
eso `done` es una PUERTA, no un consejo:

| situación | comando | qué pasa |
|---|---|---|
| Terminada **y verificada** | `done <id> --outcome "…"` | se cierra |
| Hecha, **falta verla desplegada** | `pause <id> --tras-deploy --superficie frontend\|backend\|both --hecho "…" --falta "…"` | suelta el claim; **la despierta el deploy** |
| Hecha, **falta verificar a una hora** | `pause <id> --hasta "2026-08-11 07:00" --hecho "…" --falta "…"` | suelta el claim; **la despierta el reloj** |
| **Comprobada, pero SIGUE viva** | `verificado <id> --nota "…"` | cumple el pendiente y la saca de «sin comprobar»; queda abierta |
| No avanzo, que la coja otro | `release <id>` | vuelve al pool, sin memoria de lo hecho |

**El `done` tiene DOS puertas, y miran cosas distintas.**

1. **El TEXTO** — aborta si el `--outcome` confiesa que queda trabajo ("pendiente", "falta",
   "queda", "sin desplegar", "hay que comprobar", "medir en N días") y te imprime el `pause` ya
   escrito. Caza al que confiesa.
2. **LOS HECHOS** (T-392 F1) — aborta si los commits que **declaran** esa tarea tocan una
   superficie **servida** y el `sha` vivo todavía **no los incluye**. Eso no se puede maquillar:
   si el código no está vivo, no se ha podido verificar. Es lo que faltó con [T-363], que decide
   cuándo se le cobra a alguien y se cerró con el código en `main` sin desplegar — con un outcome
   que sonaba perfectamente terminado, así que la puerta del texto lo dejó pasar.

   ```bash
   npm run backlog:verificacion -- T-392      # ¿por qué me bloquea / me deja?
   npm run sim:verificacion -- --listar       # calibración: a cuántas tareas les habla
   ```

   **Lo que lo salva de ser un sello** es que solo habla del código que llega al usuario, y eso se
   **deriva**: un fichero de `lib/` está servido si algo bajo `app/`, `components/`, `contexts/`,
   `hooks/` o `backend/src/` lo **importa** (línea con forma de import, no una mención en un
   comentario), y solo cuentan los commits que **declaran** la tarea, no los que la citan (mismo
   criterio que el push-guard). Medido: alcanza al **36 %** de las tareas cerradas en 7 días; el
   otro 64 % —documentación, tooling, datos— se cierra igual que siempre. Fail-open: si no se
   puede leer el `sha` vivo, no bloquea.

**Ambas puertas comparten el escape `--igualmente`**, que queda contado en el bus de fricción
(`npm run sesiones:friccion`): si el ratio de escape sube, es que una de las dos se ha vuelto un
peaje.

**`done` ABORTA si el `--outcome` confiesa que queda trabajo** — "pendiente", "falta", "queda",
"sin desplegar", "hay que comprobar", "medir en N días"— y te imprime el `pause` ya escrito.
Cerrar en falso saca la tarea del backlog **y** deja el trabajo sin hacer, con apariencia de
terminada: lo peor de los dos mundos. Escape consciente: `--igualmente`.
Núcleo puro `detectarTrabajoPendiente` (`lib/backlog/claimGate.cjs`), con tests que separan
*"consolidados los 6 grupos"* (cierra) de *"quedan 6 grupos"* (bloquea).

## «Ya lo comprobé, pero la tarea sigue viva» — `verificado` (T-449, 01/08)

`pause` sabe decir *«esto está hecho a falta de que llegue un momento»*. Lo que no había forma de
decir era lo contrario: **«el momento llegó, lo comprobé, y todavía queda trabajo»**. Ninguna de
las cuatro salidas encajaba:

- `done` no, porque la tarea sigue viva;
- `pause` no, porque **no hay ninguna espera** — ponerle una fecha sería inventarse una condición,
  justo lo que un CHECK impide en `due_at` y por el mismo motivo;
- `release` no, porque **no toca `resume_check`**: la suelta con el pendiente obsoleto intacto.

```bash
node scripts/backlog.cjs verificado T-385 --nota "deploy real: árbol efímero borrado, deploy_runs cerró con ok, anti-clobber pasó"
```

- **La nota es OBLIGATORIA.** Sin ella, «verificado» es indistinguible de «lo doy por bueno», que
  es exactamente el atajo que este subsistema lleva toda la semana cerrando.
- **El pendiente cumplido NO se borra:** baja a `progress_note` junto con la nota. Borrarlo dejaría
  la tarea sin rastro de que hubo una verificación — que es lo que hace falta para no repetirla.
- **No se puede marcar lo que aún espera** un deploy o un reloj: si el código no está vivo, la
  comprobación no ha podido hacerse, y marcarla sería escribir la misma mentira en la otra
  dirección. El CLI lo impide (`puedeMarcarseVerificada`, con tests).
- **`resume_check` conserva UN solo escritor:** `pause` la escribe, `verificado` la cumple. Dos
  criterios sobre la misma columna es como nació el quinto escritor de `seguimiento_url` (T-130);
  hay guardarraíl de CI que lo fija.

> **Por qué no era cosmético.** `list` pone esa sección ARRIBA porque son las que «se cierran en
> minutos». Un `resume_check` ya cumplido convierte esa promesa en una trampa, **y la paga la
> sesión más diligente**: la que hace caso al orden sugerido. Pasó el 01/08 — `list` ofrecía
> [T-385] como «IMPLEMENTADA Y SIN COMPROBAR» con un pendiente que otra sesión acababa de
> resolver, y una tercera montó un worktree y la reclamó para repetir trabajo hecho. Con 196
> tareas abiertas basta que unas pocas se queden así para que la cabeza de la lista deje de ser
> fiable: es como murieron los avisos de T-427 y T-221 — no por ser falsos, por volverse
> indistinguibles de los verdaderos.

## Al EMPEZAR: lo primero que enseña `list` es lo que se cierra rápido

Desde el 30/07, pedir las tareas pendientes muestra **arriba del todo**, antes del listado largo:

- **⏰ LISTAS PARA VERIFICAR** — pausadas cuyo deploy o reloj ya llegó. Trabajo casi terminado:
  se cierran en minutos y liberan el backlog. `next` también las sugiere **antes** que nada nuevo.
- **🙋 ESPERANDO UNA DECISIÓN DE MANUEL** — por muy despiertas que estén, Claude no puede
  cerrarlas. Van aparte para poder **enseñárselas en bloque**.

Por qué se separan: el 30/07 había seis tareas despiertas y solo tres eran verificaciones nuestras;
las otras tres esperaban una decisión suya desde hacía 10, 16 y 1 horas sin que nadie se las
pusiera delante. Y una, T-270, estaba **perdiendo su ventana de medición** (11:00-13:00) sin que
nadie lo supiera, porque la sección salía al final de 128 líneas.

### ⚖️ Y las YA REVISADAS se reparten en dos, porque no piden lo mismo (T-720, 08/08)

`reviewed_at` se pone y **no se quita nunca**, así que una tarea mergeada al minuto siguiente
seguía saliendo como «falta que decidas» para siempre. Medido el 08/08 al vaciar la cola: **de 36
con veredicto, 29 ya estaban en `main`**. Una lista en la que 4 de cada 5 son fantasmas se deja de
mirar — y con ella se pierden las que sí piden un merge.

Ahora `list` separa:

- **📦 ya SIN RAMA PENDIENTE** — ninguna rama sin fusionar declara esa tarea, así que su trabajo
  parece estar dentro. Se cierran con `done` (o `pause` si falta verificarlas en producción).
- **⬇️ las que de verdad piden mirar el merge** — hay rama con contenido que `main` no tiene.

**No se estrenó columna ni comando: el dato es COMPROBABLE, así que se observa.** Se apoya en
`indiceDeRamas()` ([T-629]), que pregunta *«¿qué ramas traen contenido que `main` no tiene?»* **por
ÁRBOL, no por sha ni por nombre de rama** — lo único que sobrevive a un cherry-pick o a un rebase.
El reparto es puro (`repartirRevisadas` en `lib/backlog/revision.cjs`, 7 tests) y delega el
criterio en `claseDeEspera`, que ya existía: no hay una segunda regla que pueda divergir.

⚠️ **La asimetría es deliberada y no se toca:** si no se puede leer git, la tarea **NO** se da por
integrada. Un falso «pendiente» cuesta una mirada; un falso «ya está en main» cierra algo cuyo
código no está vivo. Igual que una devuelta con `problemas`, que nunca cae en el montón de
integradas por muchas ramas que le falten: lo que pide no es un merge, es que alguien lea el
veredicto.

Cuesta ~3 s y **solo se paga si hay revisadas**.

## Mergear una rama CORTADA ANTES de [T-532] (una ficha = un fichero)

Desde T-532 el contenido vive en `docs/roadmap/tareas/T-nnn.md` y
`docs/roadmap/tareas-pendientes.md` es un **índice GENERADO**. Una rama abierta antes de ese
cambio edita el índice, no la ficha — y hay que llevarlo a su sitio a mano.

**Los dos casos, y el segundo es el traicionero:**

1. **Git da CONFLICTO** en `tareas-pendientes.md`. Se ve, y se resuelve.
2. **Git NO da conflicto** y auto-fusiona. Parece lo bueno y es lo malo: el texto entra en un
   fichero **generado**, así que la siguiente regeneración lo borra. **Pasó en 2 de las 3 ramas
   que se mergearon el 08/08** (T-679 y T-465) — ninguna dio conflicto.

**La receta, igual en los dos casos:**

```bash
git merge --no-ff origin/flota/<rama>
# si hay conflicto en el índice, quédate con el TUYO (es el generado, ya al día):
git checkout --ours docs/roadmap/tareas-pendientes.md && git add docs/roadmap/tareas-pendientes.md

# lleva la ficha del índice a SU fichero (esto es lo que se olvida):
awk '/^### \[T-nnn\]/{f=1} f&&/^### \[T-/&&!/T-nnn/{exit} f' \
  docs/roadmap/tareas-pendientes.md > docs/roadmap/tareas/T-nnn.md

node -e "require('./lib/backlog/fichasDir.cjs').regenerarIndice()"
```

**Comprueba SIEMPRE que el índice y la ficha coinciden**, aunque el merge fuera limpio:

```bash
diff <(awk '/^### \[T-nnn\]/{f=1} f&&/^### \[T-/&&!/T-nnn/{exit} f' docs/roadmap/tareas-pendientes.md) \
     docs/roadmap/tareas/T-nnn.md
```

**No se pierde en silencio**: el guardarraíl de CI (`backlogRegistry.guardrail` → *«regenerar el
índice desde los ficheros fuente da EXACTAMENTE el fichero comiteado»*) falla si divergen —
comprobado provocándolo a propósito. Pero te lo dice en CI y con el commit ya hecho; esta receta
es para no llegar ahí.

## Manuales relacionados

- **🧩 El SISTEMA entero (diseño, principios y cómo portarlo):** [`sistema-sesiones-paralelas.md`](./sistema-sesiones-paralelas.md) — este runbook cuenta CÓMO se opera el backlog; aquél explica **por qué** el andamiaje de sesiones paralelas es como es.

- **Push y despliegue:** `docs/runbooks/pusheo-revision-despliegue.md` — fuente única del deploy.
- **Cola de impugnaciones y feedback:** `scripts/impugnaciones/cola.cjs` — el hermano de este sistema, mismas convenciones de claim para las colas de usuarios.
- **Backlog (contenido):** `docs/roadmap/tareas-pendientes.md`.
