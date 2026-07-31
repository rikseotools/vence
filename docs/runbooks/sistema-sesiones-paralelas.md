# Sistema de trabajo con MÚLTIPLES SESIONES en paralelo

**Qué es esto:** el diseño completo del andamiaje que permite que **2-10 sesiones de un agente**
(aquí, Claude Code) trabajen sobre el **mismo repositorio** sin pisarse. Está escrito para dos
lectores:

1. **Quien opera este proyecto** — para saber qué existe, dónde está y por qué.
2. **Quien quiera PORTARLO a otro proyecto** — la §8 dice qué es genérico y qué es de Vence.

> Los runbooks de operación (cómo coger una tarea, cómo desplegar) están aparte y se enlazan
> desde aquí. **Este documento explica el SISTEMA**, no el procedimiento del día a día.

---

## 1. El problema, dicho con precisión

Varias sesiones autónomas comparten un repositorio, una base de datos y una máquina. Lo que
choca **no es lo que la gente supone**:

| lo que se cree que choca | lo que choca de verdad |
|---|---|
| el trabajo (dos hacen lo mismo) | eso también, pero es lo más fácil de evitar |
| — | **los FICHEROS**: tareas distintas que tocan las mismas rutas |
| — | **el ÍNDICE de git**: `git add` es del repositorio, no de la sesión |
| — | **el árbol de trabajo**: un `reset --hard` mueve el HEAD de quien esté ahí |
| — | **recursos de un solo uso**: el lock del deploy, una fila reservada |

Y el modo de fallo caro no es el conflicto ruidoso: es el **silencioso**. Dos sesiones arreglando
mitades del mismo bug sin saberlo. Una reserva que caduca mientras su dueño sigue trabajando. Un
commit que se lleva ficheros de otro. Nada de eso rompe nada — simplemente se pierde trabajo y
nadie se entera.

---

## 2. Los nueve principios (esto es lo portable)

Salieron de fallos reales, no de teoría. Si portas el sistema, porta esto primero.

1. **LEASE, no lock.** Una reserva es un arriendo que caduca; nunca un candado eterno. Una sesión
   que muere libera su trabajo sola, o el sistema se bloquea la primera vez que alguien cierra la
   ventana.
2. **Se OBSERVA, no se declara.** La huella de una sesión (qué toca) se saca de `git`, no de lo
   que alguien anote. *Una intención declarada se pudre en cuanto el trabajo se desvía — y se
   desvía siempre; el estado observado no puede mentir.*
3. **La señal de VIDA manda sobre la ANTIGÜEDAD.** ¿Sigue viva la sesión dueña? Eso decide, no
   cuánto tiempo lleva. La antigüedad es solo el recurso cuando no hay señal.
4. **«No lo sé» tiene que poder decirse.** Nunca se convierte un desconocido en un veredicto. Una
   fila sin datos no es «libre», es «no se puede afirmar».
5. **Avisar ≠ bloquear, y elegir mal mata el guardarraíl.** Se bloquea solo lo que (a) se puede
   satisfacer y (b) causa daño irreversible. Todo lo demás avisa.
6. **Un bloqueo IMPOSIBLE de satisfacer es peor que ninguno**, porque enseña a usar el escape
   general — y ese escape apaga *todas* las protecciones, no solo la que estorbaba.
7. **Medir cuándo se RODEA un guardarraíl.** Es un indicador *adelantado*: se ve subir antes de
   que deje de servir. Contar bloqueos solo dice que trabaja.
8. **Impedir en el punto de ESCRITURA, no detectar tarde.** Un guardarraíl en CI avisa cuando el
   daño ya está en la rama principal.
9. **FAIL-OPEN en la telemetría, FAIL-CLOSED en lo que existe para cazar.** Que la observabilidad
   no responda jamás puede impedir trabajar.

---

## 3. Los componentes

### 3.1 Reparto de TAREAS — claim con lease

| pieza | fichero |
|---|---|
| CLI | `scripts/backlog.cjs` |
| núcleo puro | `lib/backlog/claim.ts`, `lib/backlog/claimGate.cjs` |
| tabla | `backlog_tasks` |

Estados de espera, que **no son el mismo**: `claimed_by`+`lease_until` (la tengo yo) ·
`blocked_by` (depende de otra tarea) · `snooze_until` (espera a un reloj) ·
`wake_on_deploy_sha` (espera a estar desplegada) · `due_at` (**lo contrario**: fecha límite).

- **`reap`** siega los claims de sesiones muertas: el lease vencía pero nadie limpiaba la fila, y
  seguía diciendo que alguien la estaba haciendo.
- **Esfuerzo y tiempo** (`lib/backlog/esfuerzo.cjs`): cajones, no horas. Y se **mide** el tiempo
  real, porque *un campo que nadie puede desmentir se rellena a ojo y muere*.

### 3.2 Quién está vivo — el latido

| pieza | fichero |
|---|---|
| emisor | `scripts/sessions/latir.cjs` |
| lector | `scripts/sessions/latidos.cjs` |
| tabla | `worktree_sessions` |

Corre **dentro de otros comandos** (cada llamada al CLI del backlog, cada `pre-push`, cada
revisión de la cola): trabajar *es* la señal, nadie tiene que acordarse de renovar nada.

### 3.3 Identidad de sesión — UNA sola resolución

`lib/sessions/sid.cjs` · orden: `--sid` > fichero `.session-id` del worktree > variable de
entorno. **El fichero gana** porque es del worktree y describe dónde estás trabajando.

> Había **seis copias** de esta función con **dos reglas distintas**, y una sesión llegaba a verse
> a sí misma como ajena. Todo el andamiaje cuelga de este identificador: si dos herramientas
> discrepan, el sistema **miente sin romperse**, que es la peor forma de fallar.

### 3.4 Solape de FICHEROS — lo que el claim no ve

`lib/sessions/solape.cjs` — cada sesión publica su huella (sucio + lo que va por delante de la
rama principal). Avisa al reclamar y en el mapa de sesiones. **Nunca bloquea.**

La calibración es lo que lo hace creíble: se excluyen los ficheros que **todas** las sesiones
tocan por diseño. Sin eso, el aviso salta siempre y se deja de leer.

### 3.5 Índice de git — una sesión por directorio

`lib/sessions/indiceCompartido.cjs` + `scripts/check-indice-compartido.cjs` (en `pre-commit`).

**`git add` escribe en el índice del REPOSITORIO.** Con dos sesiones en el mismo directorio, el
`add` de una y el `commit` de la otra son la misma cola, y git no puede saber quién puso qué —
**el dato de «quién» no existe**, así que ningún guardarraíl sobre el contenido lo arregla.

Este **sí bloquea**: se satisface con un comando (crear un worktree) y la alternativa corrompe
trabajo ajeno de forma irreversible. Una sola sesión en el directorio principal no dispara nada.

### 3.6 Push — no empujar trabajo de otro

`lib/backlog/pushGuard.cjs` + `scripts/backlog-push-guard.cjs` (en `pre-push`). Bloquea el push
que menciona una tarea viva que no tienes. **No** bloquea: lease vencido ajeno, tarea que tú
pausaste, ni un push que solo toca el fichero de fichas.

### 3.7 Deploy — árbol propio y estado consultable

| pieza | fichero |
|---|---|
| árbol efímero | `scripts/lib/deploy-worktree.sh` |
| estado | `scripts/deploy-estado.cjs` · `lib/deploy/estado.cjs` |
| marcador | `scripts/deploy-marcar.cjs` · tabla `deploy_runs` |

El deploy construye la rama principal en un **worktree efímero**, no en el árbol de nadie. Y el
lock (`flock`) ya serializaba, pero **era invisible hasta que lo intentabas**: ahora se puede
preguntar sin competir por él, cruzando tabla + proceso vivo + sondeo no bloqueante.

### 3.8 Colas de trabajo externo (feedback, impugnaciones)

`lib/impugnaciones/reserva.cjs` — la reserva **no caduca por reloj**: caduca cuando muere su
sesión, con un suelo por debajo del cual no se toca. La decisión va **dentro del `UPDATE`**
atómico (hay versión SQL además de la JS, con paridad testeada), porque decidirla en el lenguaje
y escribir sin condición es un TOCTOU: dos sesiones leen «libre» y la segunda pisa a la primera.

### 3.9 Recuperar lo que dejó una sesión que MURIÓ

`backlog_tasks.last_claimed_by` — al retomar una tarea, se enseña el worktree de su dueña
anterior, sus ficheros sin commitear y **sus commits sin pushear**.

> Una sesión que se apaga de golpe (RAM, corte de luz, la cierran) **no llega a despedirse**: el
> hueco de «qué hice / qué falta» solo lo llena quien tiene la oportunidad, y justo esas no la
> tienen. Pero su worktree conserva el trabajo, y **los mensajes de sus commits sin pushear son la
> mejor nota que existe**: se escribieron con todo el contexto y **no costaron disciplina**.
>
> **Se descartó pedir notas periódicas.** Habrían decaído como decae todo lo que depende de
> acordarse. Lo que no es derivable —el razonamiento que no llegó a ningún commit, las hipótesis
> descartadas— se pierde igual; la mitigación real es **commitear pronto y a menudo**.

### 3.10 Vigilancia del propio andamiaje

`lib/observability/friccionSesiones.cjs` + `npm run sesiones:friccion` → tabla `observable_events`.

Mide el **ratio de escape** por guardarraíl: <25% sano · 25-66% erosión · ≥66% **muerto**.

---

## 4. Tablas

| tabla | para qué | columnas clave |
|---|---|---|
| `backlog_tasks` | tareas + reparto | `claimed_by`, `lease_until`, `last_claimed_by`, `snooze_until`, `wake_on_deploy_sha`, `due_at`, `effort`, `worked_seconds`, `first_claimed_at` |
| `worktree_sessions` | quién está vivo y qué toca | `sid`, `worktree_path`, `last_signal_at`, `touched_files` |
| `deploy_runs` | despliegues | `surface`, `sha`, `pid`, `started_at`, `finished_at` |
| `observable_events` | bus de señales | `event_type='sesion_friccion'` |

---

## 5. Los ganchos

| gancho | qué corre |
|---|---|
| `pre-commit` | sintaxis de lo staged · **índice compartido** |
| `pre-push` | latido · **guard del backlog** · robustez · typecheck |
| deploy | marcar inicio/fin · árbol efímero · despertar tareas pausadas |
| CLI del backlog | latido en cada invocación |

---

## 6. Escapes, y por qué están nombrados

`BACKLOG_GUARD_SKIP=1` · `INDICE_COMPARTIDO_OK=1` · `ROBUSTEZ_GUARD_SKIP=1` ·
`PRECOMMIT_TESTS_SKIP=1`

Cada uno **se imprime al usarse** y **se cuenta**. Un escape con nombre es infinitamente mejor
que `--no-verify`, que apaga todo a la vez y no deja rastro. Y contarlos es lo que permite saber
si un guardarraíl sigue vivo (§3.9).

---

## 7. Modos de fallo aprendidos

Cada uno costó tiempo real. Si portas el sistema, **espera estos**:

| fallo | por qué es traicionero |
|---|---|
| Dos sesiones, el mismo bug, mitades distintas | el claim funcionaba: chocaban por ficheros, no por id |
| Reserva perdida mientras su dueño trabajaba | plazo fijo: corto traiciona al lento, largo bloquea si se apaga el ordenador |
| Un aviso que grita en falso | se aprende a ignorar, y el día que acierta tampoco se lee |
| Un bloqueo imposible de satisfacer | empuja al escape general, que apaga *todo* |
| Claims de sesiones muertas | el lease vencía, pero la fila seguía diciendo que alguien trabajaba |
| Commit que se lleva ficheros ajenos | el índice es del repositorio; no hay dato de «quién» |
| Resolver un conflicto con `--theirs` por comodidad | borra el trabajo del otro **en silencio** |
| Reescribir el mismo módulo N veces | sin registro de herramientas, cada sesión reconstruye |
| Un `git log -S` por elemento | barato con 30 elementos, dos minutos con 180 |
| Una sesión muere sin despedirse | su `--hecho/--falta` nunca se escribe: hay que **derivar** el rastro, no pedirlo |
| **Crear el worktree ≠ entrar en él** | la sesión que ejecuta el script se queda donde estaba: worktrees perfectos y VACÍOS |
| `git reset --soft` + índice compartido | deja **borrados staged** de ficheros que sí están en la rama: el siguiente commit los borra |

---

## 8. Portarlo a otro proyecto

**Genérico (cópialo entero):** los nueve principios de §2 · el modelo de lease · la resolución
única de identidad · el latido como efecto secundario de trabajar · la huella observada · el
guardarraíl de índice compartido · el ratio de escape.

**Hay que adaptar:** los nombres de tabla y el motor (aquí PostgreSQL; sirve cualquiera con
`UPDATE … WHERE` condicional — la atomicidad es el único requisito) · los ganchos (aquí husky) ·
el formato de las fichas · lo específico del deploy.

**Dependencias mínimas:** una base de datos con escrituras condicionales atómicas, git con
soporte de worktrees, y un sitio donde emitir eventos.

**Orden sugerido para construirlo:** (1) identidad única — todo lo demás cuelga de ahí; (2)
latido; (3) claim con lease + reap; (4) guardarraíl de índice compartido, que es el que evita el
daño irreversible; (5) huella y solape; (6) árbol de deploy propio; (7) el ratio de escape; (8) la recuperación de sesiones muertas.

> **Y el consejo que más ahorra:** empieza por el punto 4. Es el único fallo de esta lista que
> **destruye trabajo sin dejar rastro**; todos los demás cuestan tiempo, pero se recuperan.

---

## 9. Runbooks de operación

- **Tareas y reparto:** [`tareas-pendientes.md`](./tareas-pendientes.md)
- **Push y despliegue:** [`pusheo-revision-despliegue.md`](./pusheo-revision-despliegue.md)
- **Colas de usuarios:** [`../maintenance/impugnaciones-claude-code.md`](../maintenance/impugnaciones-claude-code.md)
- **Catálogo de herramientas:** `npm run tools:buscar -- <palabra>`
