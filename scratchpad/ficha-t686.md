### [T-686] 🟠 [ABIERTO 07/08] El latido de sesión no se escribe aunque se corran comandos de backlog: el reparto da por muertas sesiones VIVAS

**Qué se observó (07/08, sesión `movil3`).** El hook de `UserPromptSubmit` avisó **dos veces** en la
misma tarde: *«tu id `sesion-07ago-32351262e6ed-abf528` no da señales desde hace 41 min»* y luego
*«…desde hace 75 min»*. En ese intervalo la sesión había corrido `backlog.cjs` varias veces —
incluido un `heartbeat` explícito— y seguía trabajando sin parar (impugnaciones, deploys, merges).

**Por qué NO es cosmético.** Todo el reparto entre 2-10 sesiones cuelga de ese latido: el claim
caduca por **señal de vida**, no por reloj (`sistema-sesiones-paralelas.md`). Una sesión viva que no
late es exactamente el caso que el diseño quiere evitar — sus reservas se sueltan y otra sesión se
pone con lo mismo. Esa tarde no costó nada porque la sesión apenas tenía nada reservado, pero es
azar, no diseño.

**Lo que hace sospechar dónde está.** El latido lo escribe `lib/sessions/latir.cjs` como
**subproceso detached** desde `backlog.cjs`, a propósito para que no añada latencia ni pueda fallar
el comando. Ese mismo desacople es el que lo deja fallar **en silencio**: si el subproceso muere, el
comando principal sale con éxito igual. Y encima el aviso de riesgo lo emite otra pieza distinta
(el hook), que solo mira la antigüedad de `worktree_sessions.last_signal_at`.

**Dato que acota el diagnóstico:** la fila SÍ existía y se actualizó a las 15:21 con el `slug` y el
`worktree_path` correctos (`movil3`) tras renombrar el worktree — o sea que **el escritor funcionó
al menos una vez** y el problema no es de identidad mal resuelta ni de fila ausente. Es que dejó de
escribir después.

**Por dónde empezar (sin dar por hecha la causa):**
- Correr `backlog.cjs list` y mirar si `worktree_sessions.last_signal_at` avanza de verdad, no si el
  comando termina bien.
- Ver si el subproceso detached está muriendo (¿SIGHUP al terminar el comando padre? ¿el `setsid` se
  perdió?) y si su fallo deja rastro en algún sitio.
- **Y la pregunta de fondo, que es la que importa:** un latido que puede fallar en silencio no es un
  latido. Si el escritor no puede garantizar la escritura, que al menos el comando lo diga.

**Relacionada:** [T-407] (identidad única de sesión), [T-539] (el fail-open es para personas).
