// lib/deploy/estado.cjs — ¿hay un deploy en curso ahora mismo? (T-404, 31/07/2026)
//
// ── EL HUECO ─────────────────────────────────────────────────────────────────────────────────
// La cola de deploys ya existe y funciona: `flock` sobre /tmp/vence-deploy.lock serializa a todas
// las sesiones (T-386), y `deploy-cuando-verde.sh` incluso DEDUPLICA (si el commit que persigues
// ya está dentro, sale sin competir). Lo que no existe es poder PREGUNTARLO: hoy la única forma
// de saber que otra sesión despliega es lanzar el deploy y quedarte bloqueado hasta 45 minutos.
// Por eso varias sesiones proponen desplegar a la vez — ninguna puede ver que otra ya va.
//
// ── DOS FUENTES, PORQUE NINGUNA BASTA SOLA ───────────────────────────────────────────────────
//   · La TABLA (`deploy_runs`) dice lo que alguien DECLARÓ al empezar. Es consultable desde
//     cualquier sesión y guarda historial… pero si un deploy muere de golpe, su fila se queda
//     abierta para siempre. Es el mismo fallo que los claims zombi que hubo que segar con
//     `backlog.cjs reap`: un marcador rancio que se lee como «ocupado» es PEOR que no tenerlo,
//     porque manda a esperar a alguien que no existe.
//   · El PROCESO dice la verdad, pero solo si estás en la misma máquina.
//
// Así que se cruzan, y cuando discrepan **se dice**, en vez de elegir una y callar. Esa es toda
// la gracia de este módulo: distinguir «ocupado» de «parece ocupado y a lo mejor no».

/** Un frontend medido tardó >30 min el 28/07; el propio lock espera 45. Por debajo de eso, normal. */
const MINUTOS_SOSPECHOSO = 45

/**
 * ¿El proceso que lanzó el deploy sigue vivo? Solo se puede afirmar en el MISMO host.
 * Devuelve true/false si se sabe, y `null` si no se puede saber — que no es lo mismo.
 */
function procesoVivo({ pid, host, hostActual, matar = null }) {
  if (!pid || !host || !hostActual || host !== hostActual) return null
  const probar = matar || ((p) => process.kill(p, 0))
  try { probar(Number(pid)); return true } catch (e) { return e && e.code === 'EPERM' ? true : false }
}

/**
 * Clasifica un deploy sin terminar.
 *
 * @returns {estado, minutos, motivo}
 *   · `en_curso`   — hay un proceso vivo detrás, o es lo bastante reciente como para creerlo.
 *   · `sospechoso` — sigue abierto pero pasó de largo lo que dura un deploy: pudo morir.
 *   · `muerto`     — se puede AFIRMAR que su proceso ya no está (mismo host, pid ausente).
 */
function clasificarRun(run, { ahora = new Date(), hostActual = null, matar = null, minutosSospechoso = MINUTOS_SOSPECHOSO } = {}) {
  const minutos = Math.max(0, Math.round((new Date(ahora).getTime() - new Date(run.started_at).getTime()) / 60_000))
  const vivo = procesoVivo({ pid: run.pid, host: run.host, hostActual, matar })
  if (vivo === false) {
    return { estado: 'muerto', minutos, motivo: `su proceso (pid ${run.pid}) ya no está en esta máquina` }
  }
  if (vivo === true) {
    return { estado: 'en_curso', minutos, motivo: `proceso vivo (pid ${run.pid})` }
  }
  // No se puede comprobar el proceso: solo queda la edad, y la edad no prueba nada.
  if (minutos > minutosSospechoso) {
    return { estado: 'sospechoso', minutos, motivo: `lleva ${minutos} min y no se puede comprobar su proceso` }
  }
  return { estado: 'en_curso', minutos, motivo: 'reciente (no se puede comprobar el proceso)' }
}

/**
 * El veredicto que necesita quien va a desplegar: ¿espero, o adelante?
 *
 * Nunca dice «adelante» a la ligera: si hay una ejecución abierta que no se puede descartar,
 * sale `dudoso`. Prefiere mandarte a mirar antes que darte un verde que no puede sostener —
 * y de todas formas el `flock` sigue siendo quien impide de verdad el solape, así que un
 * `dudoso` no bloquea a nadie: solo evita que dos sesiones se pisen sin saberlo.
 */
function veredicto(runsAbiertos, opts = {}) {
  const clasificados = (runsAbiertos || []).map((r) => ({ run: r, ...clasificarRun(r, opts) }))
  const enCurso = clasificados.filter((c) => c.estado === 'en_curso')
  const sospechosos = clasificados.filter((c) => c.estado === 'sospechoso')
  const muertos = clasificados.filter((c) => c.estado === 'muerto')
  if (enCurso.length) {
    return { estado: 'ocupado', enCurso, sospechosos, muertos,
      resumen: `${enCurso.length} deploy(s) EN CURSO: ${enCurso.map((c) => `${c.run.surface} (${c.minutos} min)`).join(', ')}` }
  }
  if (sospechosos.length) {
    return { estado: 'dudoso', enCurso, sospechosos, muertos,
      resumen: `${sospechosos.length} deploy(s) abiertos pero sin poder confirmar: ${sospechosos.map((c) => `${c.run.surface} (${c.minutos} min)`).join(', ')}` }
  }
  return { estado: 'libre', enCurso, sospechosos, muertos,
    resumen: muertos.length ? `libre (${muertos.length} fila(s) huérfanas de deploys que murieron)` : 'libre' }
}

module.exports = { clasificarRun, veredicto, procesoVivo, MINUTOS_SOSPECHOSO }
