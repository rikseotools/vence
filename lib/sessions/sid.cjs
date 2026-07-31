// lib/sessions/sid.cjs — quién soy: el session-id, resuelto de UNA sola forma. (T-407, 31/07/2026)
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
// Todo el reparto de trabajo entre sesiones cuelga de este identificador: el claim del backlog y
// su lease, la cola de impugnaciones, el guardarraíl de push, el latido y el mapa de solape. Si
// dos herramientas del MISMO worktree resuelven identidades distintas, ese andamiaje entero
// empieza a mentir sin romperse — que es la peor forma de fallar.
//
// Y estaba pasando. El 31/07 lo reportó una sesión: el dossier de una impugnación la avisaba de
// que la tarea la tenía «otra sesión» siendo **ella misma**. Al mirarlo había **SEIS copias** de
// esta función con **DOS reglas distintas**:
//
//   · fichero primero  → backlog.cjs · backlog-push-guard.cjs · cola.cjs · latir.cjs · deploy-marcar.cjs
//   · SOLO la variable → revisar-impugnacion.cjs · revisar-feedback.cjs
//
// Así que en un worktree con `.session-id` (los crea `crear-worktree.sh`, o sea TODOS los creados
// con el tooling), `cola.cjs` reclamaba con el id del fichero y `revisar-impugnacion.cjs`
// comparaba contra el de la variable de entorno: el mismo trabajo, dos identidades, y un aviso de
// colisión contra uno mismo. Cosmético en ese aviso concreto; **no** cosmético en lo demás — un
// claim tomado bajo una identidad no se puede soltar con la otra.
//
// ── EL ORDEN, Y POR QUÉ ES ESE ───────────────────────────────────────────────────────────────
//   1. `--sid <x>` en la línea de órdenes — lo explícito manda siempre.
//   2. `.session-id` del directorio actual, y si no, el del repo.
//   3. `CLAUDE_CODE_SESSION_ID`.
//
// El FICHERO gana a la variable a propósito: el fichero es del WORKTREE (lo escribe
// `crear-worktree.sh` al crear la sesión y describe dónde estás trabajando), mientras que la
// variable la pone el entorno del proceso y puede venir heredada de otra parte. Ante la duda, la
// identidad la manda el sitio donde está el trabajo.
//
// `.cjs` como el resto del andamiaje: lo requieren scripts de node pelado (incluido un hook de
// husky), así que no puede ser TypeScript ni tener una copia que se desincronice.

const fs = require('fs')
const path = require('path')

/**
 * Resuelve el session-id.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.argv]  argumentos donde buscar `--sid` (por defecto, los del proceso)
 * @param {string}   [opts.cwd]   directorio actual
 * @param {string}   [opts.repo]  raíz del repo (para el `.session-id` compartido)
 * @param {object}   [opts.env]   entorno
 * @returns {{ sid: string|null, origen: 'flag'|'fichero'|'entorno'|null, base: string }}
 *   `origen` no es adorno: cuando dos herramientas discrepan, saber de DÓNDE sacó cada una su
 *   identidad es la diferencia entre arreglarlo en un minuto y volver a dudar.
 */
function resolverSid(opts = {}) {
  const argv = opts.argv || process.argv
  const cwd = opts.cwd || process.cwd()
  const repo = opts.repo || path.resolve(__dirname, '../..')
  const env = opts.env || process.env
  const leer = opts.leerFichero || ((p) => fs.readFileSync(p, 'utf8'))

  const i = argv.indexOf('--sid')
  if (i >= 0 && argv[i + 1] && !String(argv[i + 1]).startsWith('--')) {
    return { sid: String(argv[i + 1]).trim(), origen: 'flag', base: cwd }
  }
  for (const base of [cwd, repo]) {
    try {
      const v = String(leer(path.join(base, '.session-id'))).trim()
      if (v) return { sid: v, origen: 'fichero', base }
    } catch { /* no hay fichero ahí */ }
  }
  const e = env.CLAUDE_CODE_SESSION_ID
  if (e && String(e).trim()) return { sid: String(e).trim(), origen: 'entorno', base: cwd }
  return { sid: null, origen: null, base: cwd }
}

/** Atajo para quien solo quiere el id. */
function sid(opts = {}) {
  return resolverSid(opts).sid
}

module.exports = { resolverSid, sid }
