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
10. **La regla tiene que llegar en el MOMENTO DE LA VERDAD, no al arrancar.** Un documento que se
    lee una vez al principio queda sepultado cuando llega el momento de aplicarlo. La misma frase,
    impresa al empezar la tarea, sí se lee. Y si además llega **contextual** —con el comando ya
    escrito para ese caso— deja de ser papel pintado.
11. **Un proceso de fondo tiene que MORIR con quien lo lanzó.** Si sobrevive, no falla: sigue
    trabajando y contándoselo a nadie, que es peor — se comporta como si vigilara.
12. **Un cambio ESTRUCTURAL sin ficha no existe para las demás sesiones — y las paraliza.** Con
    2-10 trabajando a la vez, lo que no se puede distinguir de un accidente bloquea a todo el
    mundo: nadie se atreve a seguir ni a revertirlo. Si tocas la forma del repositorio, regístralo
    ANTES de tocarlo.

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

#### Y la identidad también se ESCRIBE en un solo sitio — `sidCorto()` (T-538)

Un sid entero no cabe en una tabla, así que **once sitios lo recortaban a mano**, unos a 8
caracteres y otros a 12. Ahí estaba el fallo: la forma canónica es `<nombre>-<máquina>-<azar>`, con
**lo distintivo al principio y lo prescindible al final**, de modo que cortar por longitud fija
corta justo por donde no es.

Medido el 04/08 con cinco sesiones abiertas el mismo día — `imp-04ago-b`, `-c`, `-d`, `-e`, `-g` —:
a 8 caracteres **las cinco se escriben `imp-04ag`**. La cola marcaba con un candado seis reservas
ajenas y, al lado del candado, el nombre que quien miraba reconocía como suyo. El icono distinguía;
el texto, que es lo que se lee, decía lo contrario. **Ocho filas ajenas leídas como propias en una
sola sesión**, y tres viajes a la base de datos para deshacer el equívoco. Lo que dio la señal no
fue la pantalla, fue que `cola.cjs mine` decía «no tienes claims» mientras `list` mostraba seis con
ese prefijo: **sin dos comandos que se contradijeran, no había aviso**.

Las dos reglas que salen de ahí:

1. **Se abrevia por SEGMENTO, nunca por longitud.** `sidCorto()` tira máquina y azar —que no
   identifican nada para un humano— y conserva el nombre entero, que es el del worktree y por tanto
   lo que la persona ve en su terminal. Si el sid no tiene esa forma (uno antiguo, un UUID de
   `CLAUDE_CODE_SESSION_ID`), **no se toca**: más vale una línea larga que una abreviatura que
   colisiona.
2. **Se dice la RELACIÓN, no solo el identificador.** `🙋 TUYA` / `🔒 otra sesión (imp-04ago-b)`.
   Quien lee la cola no necesita un id, necesita saber si puede cogerlo.

Guardarraíl: `__tests__/guardrails/sidSinTruncarAMano.guardrail.test.ts` recorre los módulos que
enseñan un sid y falla si alguno vuelve a recortarlo por su cuenta; distingue un sid del id de un
usuario, porque un guardarraíl que marca lo correcto se aprende a ignorar.

### 3.3.bis La MÁQUINA es la otra mitad de la identidad (T-484)

Con sesiones fuera del portátil (servidores, contenedores) la pregunta deja de ser «quién soy» y
pasa a ser **«quién soy Y DÓNDE»**. El mismo módulo resuelve las dos: `maquina()` —
`VENCE_SESSION_HOST` > `os.hostname()`, normalizado a nombre corto — y `mismaMaquina()`, que tiene
**tres estados**: sí, no, y **«no lo sé»**.

Los dos hechos que cambian de significado al cruzar de máquina, y son opuestos:

| Hecho | Dentro de una máquina | Entre máquinas |
|---|---|---|
| **misma ruta** (`/app/vence`) | mismo índice de git: se pisan | discos distintos: **no se pisan** |
| **mismo sid** | es la misma sesión | **dos sesiones con una identidad**: comparten claim y lease |

- **El guard del índice** (§3.5) descarta a quien se pueda AFIRMAR que está en otra máquina; con
  el dato en blanco sigue contando. Sin esto bloqueaba el commit de una flota entera de
  contenedores clonados y empujaba a usar el escape a diario, que es como muere un guardarraíl.
- **El sid compartido lo canta el propio latido**, que es el único que puede verlo: la PK de
  `worktree_sessions` es el sid, así que las dos máquinas escriben sobre la **misma fila** y el
  mapa enseña UNA sesión donde hay dos. Si el host cambia, avisa por stderr y deja
  `sesion_friccion / identidad_compartida` (severidad `warn`).
- **El sid se acuña al arrancar** (`nuevoSid`, que estampa la máquina), **nunca se hornea en una
  imagen ni se copia con el worktree**. Lo usa `crear-worktree.sh` y lo tiene que usar el arranque
  de cualquier trabajador remoto: una segunda forma de acuñar identidad es el error de T-407 otra vez.
- **El disco y `/proc` son solo de esta máquina.** El mapa de sesiones no le pregunta al disco local
  por el worktree de una sesión remota: eso no daría un «no», daría una respuesta falsa.

```bash
npm run sim:identidad-maquina    # lo comprueba EJECUTÁNDOLO, contra la BD real, con un sid desechable
```

> Esa simulación no es adorno: los 84 unitarios estaban en verde mientras `latir.cjs` **no podía ni
> arrancar** (unas comillas invertidas dentro de un comentario SQL cerraban la plantilla de JS). Un
> guardarraíl de TEXTO no es una comprobación de EJECUCIÓN.

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

### 3.6.bis Push — no borrar la documentación de otro

`lib/backlog/perdidaDeContexto.cjs` + `scripts/contexto-push-guard.cjs` (en `pre-push`). Cierra el
modo de fallo *«resolver un conflicto con `--theirs`»* de §7, que hasta el 31/07 estaba **listado y
sin cubrir**. Bloquea el push que borra el cuerpo de una ficha VIVA que ya está publicada.

Tres decisiones que son la tarea entera:

- **Compara contra `origin/main`, no contra el padre de tus commits.** La pregunta no es «¿qué
  cambiaron mis commits?» sino «¿qué se pierde de lo publicado cuando esto entre?». Solo la segunda
  ve el MERGE: si resuelves el conflicto tirando el bloque ajeno, tus commits nunca borraron nada
  respecto de su propio padre — el contenido jamás estuvo en tu rama.
- **Si no puede atribuir la pérdida, NO opina** (HEAD que no contiene `origin/main`). Un guardarraíl
  que acusa cuando no sabe se acaba apagando entero, y entonces deja de proteger también donde sí sabía.
- **El umbral lo fijó la historia, no una intuición**: `sim-perdida-contexto.cjs` pasó los 1.063
  commits del fichero. Dispara en el **0,9%**, y en el **91%** de las fichas que señala alguien tuvo
  que restaurarlas a mano después — que es el discriminador honesto entre borrado accidental e
  intencionado (si volvió, es que hacía falta).

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

### 3.8.bis Enterarse de que TE HAN QUITADO lo que tenías (T-516)

`lib/sessions/reservaPerdida.cjs` (núcleo puro) + `scripts/sessions/reserva-perdida.cjs`, colgado
del hook `UserPromptSubmit` que ya existía para el recordatorio de método (§3.10). En **cada
turno** compara lo que esta sesión tenía reservado con lo que tiene ahora, y si algo cambió de
manos lo dice, con el nombre de quien lo lleva.

**Por qué hacía falta.** El reparto (§3.8) decide bien cuándo una reserva vuelve al pool, pero
solo tenía ida y no vuelta: **al que la pierde nadie se lo dice**. Sigue con todo el contexto en
la cabeza, redacta una respuesta y la manda. Dicho por Manuel el 04/08: *«me voy a dormir y por la
mañana dos sesiones me hablan de lo mismo»*. Es el principio 5 (avisar ≠ bloquear) aplicado al
único punto donde faltaba.

**No es un lease más largo, a propósito.** Alargarlo empeora justo ese escenario nocturno: la cola
amanece congelada por sesiones que ya no existen. Lo que se arregla es el aviso, no el plazo.

**Y detecta la causa raíz de las pérdidas FALSAS: la identidad partida.** Si reclamas con un sid
que no está latiendo, el reparto te da por muerta y suelta tus reservas aunque estés trabajando.
Pasó el 04/08: una sesión reclamó el feedback `8b788ee0` con el `.session-id` de su worktree
mientras latía desde el checkout principal con otro id; a las pocas horas otra sesión se lo llevó
y las dos acabaron hablando del mismo caso. Es la mitad que [T-407] dejó abierta: unificó quién
LEE el id, pero nadie comprobaba que **lates con el mismo con el que reclamas**.

**Cómo no estorba** (un hook que bloquea el prompt se desactiva el primer día): throttle de 90 s,
timeout duro de 2,5 s contra la BD y fail-open absoluto — ante cualquier problema, ni una palabra.
No añade escritores: no exige que `cola.cjs` ni los dossieres registren nada, solo lee y guarda su
propia foto en `/tmp`. Si la foto se pierde, se avisa de menos, nunca de más.

**Guardarraíl:** `avisoReservaPerdidaCableado.test.ts`. Su modo de fallo es enmudecer en silencio,
así que se comprueba que el hook sigue declarado, que llama al consultor, y que el aviso NO cae
dentro del contador de N mensajes (ahí llegaría hasta 15 turnos tarde, cuando ya has escrito).

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

### 3.9.bis Trabajo HUÉRFANO — lo que queda cuando nadie retoma la tarea

`lib/sessions/trabajoHuerfano.cjs` (criterio puro) · `scripts/sessions/huerfanos.cjs`
(`npm run sesiones:huerfanos`) · simulación `npm run sim:huerfanos`

§3.9 rescata el trabajo de una sesión muerta **cuando alguien retoma su tarea**. Si nadie la
retoma —o si lo perdido son documentos que no cuelgan de ninguna ficha, que fue el caso— sigue
invisible. Esto es el barrido: qué worktrees guardan algo que **no existe en ningún otro sitio**.

**Toda la dificultad está en no gritar en falso.** Medido el 31/07 sobre los cinco worktrees que
había, de 3 a 9 días de antigüedad:

| worktree | lo que se veía | lo que había de verdad |
|---|---|---|
| `vence-clean` | 47 commits sin pushear | los 47 ya en la principal **por contenido** |
| `pagos-planes` | 7 ficheros | idénticos byte a byte |
| `umu-golive` | 2 ficheros | versión **desfasada** de algo ya subido |
| `scrape-opositatest-tai` | 14 ficheros | restos de una limpieza a medias |
| **`sesion-28jul-d`** | 3 ficheros | ⚠️ **43 líneas que nunca se subieron** |

Cuatro de cinco son ruido. Un detector que cuente commits o ficheros da los cinco, y con esa
proporción muere ignorado — llevándose el quinto. La pregunta correcta no es *«¿cuánto hay
aquí?»* sino **«¿qué se PERDERÍA si lo borro?»**: `origin/main...HEAD` (tres puntos, o lo que a
ti te FALTA de la principal cuenta como tuyo) **∩** lo que difiere hoy de la principal (mata los
47 commits) **∪** lo que ni siquiera está commiteado.

**Y el mismo criterio recalibra el guard del borrado**, que es donde la pérdida es irreversible.
`borrar-worktree.sh` ya bloqueaba… contando commits: con `vence-clean` eran 47 de nada, y la
salida documentada era `--force`, que **en el mismo paso descarta los cambios sin commitear**.
Ruido 4 de cada 5 veces enseñando a teclear el gesto que destruye.

> **No entra en el barrido nocturno**, que es lo primero que uno piensa: los worktrees viven en la
> máquina de quien trabaja y el sweep de salud corre en Fargate. Un cron en la nube no puede ver
> un directorio que no existe ahí.

**Nace en silencio** (hoy hay 0 huérfanos), así que la única prueba de que sabe encontrar algo es
`npm run sim:huerfanos`: reconstruye los cinco casos sobre repos de git de verdad y falla si
alguno se clasifica mal — en cualquiera de las dos direcciones.

### 3.10 Que la regla llegue cuando se empieza a trabajar

`backlog.cjs claim` imprime, además de la ficha, **cuatro líneas con el orden que evita rehacer
trabajo**: ¿ya existe? (con el comando de búsqueda ya escrito con las palabras de esa tarea) →
¿dónde encaja, para no crear un silo? → capas → el simulador que ya está montado.

> Estaba todo escrito en el documento que se carga al arrancar… y aun así había que repetirlo a
> mano cada poco. No era desidia: cuando media hora después se coge una tarea, esas líneas están
> sepultadas. Y los guardarraíles que sí existían actuaban **al pushear**, con el trabajo ya
> hecho — ninguno devuelve las horas de construir algo que ya existía.

### 3.11 Procesos de fondo: morir con su sesión

Un vigía lanzado por una sesión escribe sus avisos **en la salida de esa sesión**. Si la sesión
muere, el proceso NO muere —Linux lo entrega a `init`— y sigue consultando, detectando y
**contándoselo a nadie**. Peor: si recuerda lo ya avisado, puede marcar como visto algo que nadie
llegó a ver. **No falla: finge funcionar.**

Se detecta guardando el `ppid` al arrancar y comparándolo en cada vuelta: si el padre muere, el
sistema reasigna el proceso y el ppid **cambia**. Sin depender de señales — `nohup` las ignora a
propósito, así que varios de estos procesos estaban *diseñados* para sobrevivir.

### 3.12 Vigilancia del propio andamiaje

`lib/observability/friccionSesiones.cjs` + `npm run sesiones:friccion` → tabla `observable_events`.

Mide el **ratio de escape** por guardarraíl: <25% sano · 25-66% erosión · ≥66% **muerto**.
También recoge el trabajo huérfano (§3.9.bis) como clase propia: es fricción de la que solo se
ve el rastro, porque la sesión que la causó ya no está para contarlo.

### 3.12-bis Cerrar una sesión sin dejar cabos

**`/clear` NO es cerrar la sesión.** Borra la memoria de la conversación; el worktree sigue ahí y
**las tareas siguen reclamadas**. Si solo vas a hacer `/clear`, con dejar las fichas al día basta:
no se pierde nada.

**Borrar el worktree es otra cosa: lo que no esté subido se pierde para siempre.** El rescate de
§3.9 —que enseña a la siguiente sesión lo que dejó la anterior— **solo funciona si ese worktree
sigue existiendo**.

Por eso el cierre **no depende de que alguien se acuerde**: el script de borrado ABORTA ante las
cuatro formas de perder algo.

| se pierde | qué lo impide |
|---|---|
| commits que no llegaron a la rama principal | aborta y los lista |
| cambios sin commitear | aborta y los lista |
| reservas de la cola de trabajo | las suelta él |
| **el «dónde dejé la tarea»** | aborta si tienes tareas cogidas, y te enseña las dos salidas: cerrarla con su resultado, o **pausarla diciendo qué falta** |

> Las tareas **no se sueltan solas** a propósito: soltar sin decir dónde se dejó una tarea es
> **indistinguible de un abandono**, y la siguiente sesión empieza de cero. Esa elección la tiene
> que hacer quien cierra, que es el único que lo sabe.

### 3.13 El repo principal: NO lo pongas en `bare`

Es tentador: un repo `bare` no admite trabajo, así que haría **imposible** el índice compartido
(§3.5). Se intentó el 31/07 y hubo que revertirlo. **Los tres motivos, por si vuelve la idea:**

1. **Ya está resuelto, y mejor.** El guardarraíl de `pre-commit` impide trabajar en el principal
   **sin romper nada**; el `bare` rompe `git status`, el IDE y todo script que asuma un árbol ahí.
   Con dos soluciones al mismo problema, gana la que no rompe lo de al lado.
2. **No se puede terminar sin rediseñar algo primero.** Un `bare` de verdad no tiene ficheros,
   pero el principal guarda dos cosas **que no están en el historial**: la configuración local
   (gitignored) y `node_modules` — y de ahí las copia/enlaza el creador de worktrees en CADA uno
   nuevo. Vaciarlo deja a las sesiones nuevas sin configuración y sin dependencias.
3. **A medias es lo peor de los dos mundos:** un repositorio lleno de ficheros marcado como vacío.
   Ni `bare` ni normal. Ambiguo.

> **Y el daño no fue técnico, fue de coordinación.** Se hizo sin ficha, así que ninguna sesión
> podía distinguir «intencionado» de «accidente» — y ante la duda nadie sigue ni revierte. Paralizó
> un deploy con 21 commits esperando. Revertir fue **una línea**; decidir si podía revertirse costó
> una conversación entera.

**Si alguien lo retoma**, lo que hay que resolver ANTES es de dónde saca cada worktree nuevo su
configuración local y sus dependencias.

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
| `pre-push` | latido · **guard del backlog** · **pérdida de contexto** · robustez · typecheck |
| deploy | marcar inicio/fin · árbol efímero · despertar tareas pausadas |
| CLI del backlog | latido en cada invocación |

---

## 6. Escapes, y por qué están nombrados

`BACKLOG_GUARD_SKIP="motivo"` · `INDICE_COMPARTIDO_OK="motivo"` · `ROBUSTEZ_GUARD_SKIP=1` ·
`PRECOMMIT_TESTS_SKIP=1` · `CONTEXTO_GUARD_SKIP=1`

Cada guardarraíl tiene el **suyo**, a propósito: si compartieran uno, apagar el que estorba hoy
apagaría de paso el que protege de otra cosa.

**Y un escape que se puede satisfacer con un «1» se convierte en PREFIJO.** Medido el 02/08 sobre
7 días: de los 10 escapes de `indice-compartido`, **6 no respondían a ningún bloqueo de esa
sesión** — dos sesiones escaparon dos veces cada una sin que el guard las hubiera parado jamás.
El ratio lo pintaba como «guardarraíl muerto», y la lectura correcta era la contraria: el guard
acertaba y la llave se había quedado puesta. Por eso `INDICE_COMPARTIDO_OK` y `BACKLOG_GUARD_SKIP` piden ahora un
**motivo** (como `claim --force --motivo` o `snooze --motivo`), que no se arrastra sin darse
cuenta y además queda escrito. **No añade ningún bloqueo nuevo**: un valor que no vale se ignora y
el guard se limita a evaluarse. El desglose vive en `escapesSinBloqueo()` y sale en `npm run
parte`, pegado al ratio, para que nadie vuelva a leer un 67% como «esto estorba» (T-496).

Cada uno **se imprime al usarse** y **se cuenta**. Un escape con nombre es infinitamente mejor
que `--no-verify`, que apaga todo a la vez y no deja rastro. Y contarlos es lo que permite saber
si un guardarraíl sigue vivo (§3.9).

### 6.ter. Fail-open es para PERSONAS: un trabajador autónomo tiene que fallar cerrado (T-539, 04/08)

Todo el andamiaje de este documento hace **fail-open** cuando no puede hablar con la BD: el latido
no escribe y calla, el push-guard avisa y deja pasar, el guard del índice salía 0 sin decir nada.
Está bien razonado — **la avería de un sistema de observación no puede parar el trabajo de quien
está delante y puede juzgar**, y es la regla que evita que un guardarraíl se acabe apagando entero.

Pero el mismo camino, en un **trabajador autónomo**, significa *«trabaja sin supervisión y sin que
nadie te vea»*. Medido el 04/08 en un clon sin `.env.local` —que es la condición **normal** de un
worktree de agente, porque el fichero está en `.gitignore` y no viaja—: la sesión no aparecía en
`worktree_sessions` (invisible para las demás **y ellas para ella**), los guardarraíles que
dependen de la BD no comprobaban nada, y por fuera no se distinguía de una sesión sana.

**Misma observación, distinta consecuencia.** El rol se declara en `VENCE_SESSION_ROLE`
(`persona` por defecto — un valor que se olvida no puede cambiar el comportamiento) y **lo pone el
entorno que ARRANCA al trabajador**, no el trabajador: si se lo pudiera poner él, no sería una
garantía. Vive en `lib/sessions/sid.cjs` porque es identidad, junto a «quién soy» y «dónde».

```
npm run sesion:preflight                                   # persona: avisa
VENCE_SESSION_ROLE=trabajador npm run sesion:preflight      # trabajador: exit 1 si no está listo

# Y al ARRANCAR un trabajador, las dos variables juntas — las declara el lanzador, no él:
VENCE_SESSION_ROLE=trabajador VENCE_SESSION_HOME=/ruta/a/su/worktree  <arranque del trabajador>
```

#### `VENCE_SESSION_HOME`: el ancla que sobrevive al cambio de directorio

La identidad de este sistema la manda el **sitio** (§3.3: el `.session-id` del directorio gana). Es
lo correcto para una persona, y tiene una consecuencia que solo se ve con procesos autónomos: **si
un trabajador acaba en el árbol de otra sesión, adopta su identidad y se vuelve indistinguible de
ella**. El sid, el latido y la huella se derivan todos del directorio, así que al mudarse cambian
con él y **todo vuelve a cuadrar**. No hay nada dentro del repositorio con lo que notarlo.

Lo reportó el trabajador en la primera vuelta del piloto: *«hice `cd` a mi worktree y la llamada
siguiente ya estaba de vuelta en el otro… un comando que yo creía ejecutando en mi worktree se
habría ejecutado en el directorio de otra sesión»*. Tuvo que prefijar unas veinte llamadas con `cd`.
Es [T-415] por otra puerta, y esa ya costó un commit con el trabajo de otra sesión dentro.

Por eso el hogar lo declara **quien arranca al trabajador**: es el único dato que no se mueve con
el directorio. Con él puesto, el `pre-commit` **para** a un trabajador que va a commitear fuera de
su árbol y le dice a dónde volver. Sin él, no opina — una persona se cambia de árbol a propósito
continuamente, y pararla sería el falso positivo que acaba con un guardarraíl.

Tres cosas que hacen que esto no sea un informe más:

1. **El criterio de cómo fallar vive en UN sitio** (`lib/sessions/preflight.cjs` → `cegueraBloquea`)
   y lo importan el push-guard y el guard del índice. Dos reglas sobre lo mismo acabarían
   divergiendo — es como nacieron los cinco escritores de `seguimiento_url` (§ herramientas).
2. **El preflight NO escribe el latido**: se lo pide a `latir.cjs`, el escritor único, y luego
   **mira en la BD** si la fila está. Se observa, no se declara.
3. **«No lo sé» cuenta como falta, no como aprobado.** Una comprobación que no se pudo hacer no
   puede sumar al verde: es el mismo principio del guard del índice.

> **Lo que descubrió la simulación y no los tests:** arreglado el camino de «no hay URL», quedaba
> **otro `catch { return 0 }` mudo** detrás, para la BD caída. Los agujeros sobreviven así — se
> tapa la puerta que se mira y la de al lado sigue abierta. Por eso `sim:preflight-trabajador`
> ejecuta los binarios de verdad y mira **códigos de salida**, que es lo que git obedece, y provoca
> la ceguera con una URL inalcanzable en vez de escondiendo ficheros.

### 6.quater. Dar de alta un TRABAJADOR: el rol de coordinación (T-539, 04/08)

Un trabajador necesita hablar con la BD para reclamar, latir y preguntar. **No se le da el
`.env.local`**: esa es la credencial de la aplicación y abre `user_profiles`, `questions`,
`test_sessions` y todo lo demás. N trabajadores serían N copias de un secreto de negocio en
máquinas que no lo necesitan, sin forma de rotarlas ni de saber cuál se usó.

Se le da un rol propio: **`vence_coordinacion`**, con alcance medido — 4 tablas, ninguna de
negocio, ningún `DELETE`, y `observable_events` **solo escritura** (tiene cientos de miles de filas
con `user_id`; el andamiaje nunca la lee).

**Los cuatro pasos. El 1 y el 2 los tiene que hacer Manuel: hacen falta accesos que una sesión no
tiene.**

```bash
# 1) Crear el rol y sus permisos (idempotente; NO lleva contraseña dentro)
psql "$DATABASE_URL" -f supabase/migrations/20260804_rol_coordinacion_flota.sql

# 2) Generar la contraseña, guardarla en SSM y ponérsela al rol.
#    Se genera y se guarda ANTES de usarla: así nunca existe solo en el historial de una terminal.
PASS="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
aws --profile vence --region eu-west-2 ssm put-parameter \
  --name /vence-flota/COORDINACION_DB_PASSWORD --type SecureString --value "$PASS" --overwrite
psql "$DATABASE_URL" -c "ALTER ROLE vence_coordinacion PASSWORD '$PASS';"
unset PASS

# 3) Componer la URL del trabajador (mismo host y base que la app, distinto usuario)
#    y comprobar que el permiso es EL QUE SE CREE que es:
export VENCE_COORDINACION_URL="postgres://vence_coordinacion:<pass>@<host-rds>:5432/<base>"
npm run canary:rol-coordinacion

# 4) El trabajador arranca con ESA url y declarándose trabajador:
DATABASE_URL="$VENCE_COORDINACION_URL" VENCE_SESSION_ROLE=trabajador npm run sesion:preflight
```

**El paso 3 no es opcional.** Un `GRANT` es una afirmación sobre producción y **la mitad que
importa no se puede leer en el `.sql`**: que el rol NO pueda leer negocio. Los privilegios se
acumulan por vías que no están en ese fichero. El canario lo intenta de verdad y exige que el motor
lo rechace — y sin credencial dice *«no puedo mirar»* en vez de darse un verde (§3.9).

> **Si algún día los trabajadores corren en AWS**, lo mejor es **IAM database authentication**: el
> token lo emite IAM, dura 15 minutos y no hay contraseña que rotar ni que guardar. El rol de arriba
> vale igual (`GRANT rds_iam TO vence_coordinacion`). Con la contraseña en SSM se empieza porque no
> exige que el trabajador esté dentro de AWS, que es justo lo que aún no está decidido ([T-486]).

**Límite conocido y aceptado en el piloto:** el permiso es por TABLA, así que un trabajador puede
escribir en `backlog_tasks` filas que no son suyas (p.ej. tocar el claim de otra sesión). Acotarlo
más exigiría RLS o permisos por columna, y para 2 trabajadores con auditoría no compensa. Si la
flota crece, esto es lo siguiente que hay que apretar.

### 6.bis. El escape que sobra: leer los MOTIVOS y contemplar el caso (T-486, 04/08)

Pedir motivo (§6) no era el final del trabajo, era **el instrumento**: convierte cada escape en una
frase que se puede leer. Al leerlas, de los 3 escapes de `indice-compartido` posteriores a T-496
**2 decían lo mismo** — *«ya estaba en el índice cuando otra sesión empezó a latir aquí; commiteo
con rutas explícitas»*. Es decir: el guardarraíl estaba **parando a quien ya estaba haciendo lo
correcto**, y lo obligaba a apagarlo para poder hacerlo.

Así que el arreglo no fue relajar el criterio ni subir el techo, sino **contemplar el caso**: un
commit parcial (`git commit -m "…" -- <rutas>`) recibe de git un índice temporal propio y no puede
arrastrar lo que otra sesión dejó preparado. Ya no hay nada que escapar.

Tres cosas que generalizan a cualquier guardarraíl de este sistema:

1. **El ratio dice que algo pasa; los motivos dicen QUÉ.** Sin ellos, un 65 % se lee como «esto
   estorba» y se acaba relajando lo que no era.
2. **La regla cómoda suele ser el agujero.** Aquí era «índice distinto del normal → deja pasar»:
   `git commit -a` también trae índice distinto (`index.lock`) y **sí** se lleva lo ajeno (medido).
   El corte tuvo que ser el nombre exacto del índice temporal.
3. **Una exención se verifica contra el comportamiento REAL, no contra lo que dice la
   documentación de la herramienta.** `npm run sim:indice-parcial` monta repos git de verdad,
   reproduce el choque de dos sesiones y compara el veredicto del detector con lo que git acaba
   metiendo en el commit. Si una versión futura de git cambia, se pone rojo el día que pase.

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
| Resolver un conflicto con `--theirs` por comodidad | borra el trabajo del otro **en silencio** — el id sigue existiendo, así que el CI sigue verde (cubierto desde 31/07 por §3.6.bis) |
| Reescribir el mismo módulo N veces | sin registro de herramientas, cada sesión reconstruye |
| Un `git log -S` por elemento | barato con 30 elementos, dos minutos con 180 |
| Una sesión muere sin despedirse | su `--hecho/--falta` nunca se escribe: hay que **derivar** el rastro, no pedirlo |
| **Un proceso de fondo que sobrevive a su sesión** | sigue trabajando y avisando a nadie; si recuerda lo avisado, lo marca como visto |
| Cerrar la sesión sin soltar sus tareas | la reserva caduca sola, pero el «dónde lo dejé» se pierde |
| **Cambio estructural del repo sin ficha** | nadie distingue intencionado de accidente → todos se paran |
| La regla escrita solo al arrancar la sesión | queda sepultada justo cuando toca aplicarla |
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
daño irreversible; (5) huella y solape; (6) árbol de deploy propio; (7) el ratio de escape; (8) la recuperación de sesiones muertas; (9) que los procesos de fondo mueran con su sesión y que la regla se imprima al empezar la tarea.

> **Y el consejo que más ahorra:** empieza por el punto 4. Es el único fallo de esta lista que
> **destruye trabajo sin dejar rastro**; todos los demás cuestan tiempo, pero se recuperan.

---

## 9. Runbooks de operación

- **Tareas y reparto:** [`tareas-pendientes.md`](./tareas-pendientes.md)
- **Push y despliegue:** [`pusheo-revision-despliegue.md`](./pusheo-revision-despliegue.md)
- **Colas de usuarios:** [`../maintenance/impugnaciones-claude-code.md`](../maintenance/impugnaciones-claude-code.md)
- **Catálogo de herramientas:** `npm run tools:buscar -- <palabra>`
