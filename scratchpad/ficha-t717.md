### [T-717] 🟡 [ABIERTO 08/08] La cola no dice a QUIÉN pertenece un claim de forma legible, así que se adivina por el nombre de la ventana

**Medido el 08/08, y no es un despiste de nadie: pasó DOS VECES el mismo día, en sesiones
independientes y con minutos de diferencia.** `movil2` y `movil4` escribieron por separado a
`movil3` para preguntarle si soltaba tres feedbacks de la cola (`94a1d41f`, `0fa244c2`,
`069b17be`). No eran suyos: los tenía la sesión `136e28c4-…`, y desde `movil3` salían como «otra
sesión» exactamente igual que desde ellas.

**La causa la contó la propia sesión que se equivocó**, y es lo que hace útil el hallazgo:

> *«Deduje el destinatario de que tu ventana se llamaba `impug:` en vez de leer el `claimed_by`
> completo, que es el dato que manda.»*

O sea: el dato correcto **estaba impreso**, pero es un UUID crudo (`136e28c4-573b-411a-b4a0-…`)
que no se parece a nada reconocible. Así que la pista que se usa es la que sí tiene forma humana
—el nombre del tmux, el worktree, lo que se recuerde de quién iba de qué— y esa pista miente.

**Por qué importa y no es cosmético.** Lo que estaba en juego era pedirle a la sesión equivocada
que soltara un claim VIVO (latido a 0 minutos). Si alguna de las dos hubiese forzado, le habría
quitado el trabajo a quien lo estaba haciendo. Y el coste menor pero seguro ya se pagó: dos
sesiones gastaron un turno preguntando, y una tercera gastó otro comprobando y contestando —tres
turnos para un dato que la herramienta ya tenía.

**Qué hacer** (pequeño, y el patrón ya existe en el repo):
1. Que `cola.cjs list` imprima junto al UUID algo RECONOCIBLE — el worktree de esa sesión, que es
   lo que ya hace el backlog al retomar una tarea (`last_claimed_by` enseña el worktree de su
   dueña, ver `docs/runbooks/tareas-pendientes.md`). La fuente está en `worktree_sessions`.
2. Y que diga **en claro cuándo el claim es TUYO**, en vez de dejar que cada uno compare dos
   UUIDs a ojo. Hoy imprime «🔒 otra sesión (…)» para lo ajeno pero no distingue lo propio de un
   vistazo.
3. La identidad de la sesión sale de `lib/sessions/sid.cjs`, que ya es fuente única ([T-407]) —
   esto NO abre otra puerta, solo usa la que hay.

**Lo que NO hay que hacer:** poner el nombre del tmux como identidad. Es justo la pista que
falló, y además una sesión puede cambiar de ventana; la identidad la manda el SITIO (el
worktree), que es la lección de `VENCE_SESSION_HOME`.

**Relacionadas:** [T-407] (una sola identidad de sesión), [T-431] (worktrees huérfanos: el mismo
problema de no poder atribuir algo a una sesión), el runbook `sistema-sesiones-paralelas.md`
(principio «se observa, no se declara»).
