#!/usr/bin/env node
/**
 * check-indice-compartido.cjs — puente del guardarraíl «una sesión por índice». (T-415)
 *
 * Lo invoca `.husky/pre-commit`. Reúne los inputs reales (mi sid, mi worktree, las sesiones con
 * latido) y llama a la lógica PURA de `lib/sessions/indiceCompartido.cjs`. Ver ese fichero para
 * el porqué.
 *
 * Filosofía de fallo, la de siempre en este repo:
 *   · FAIL-CLOSED solo en lo que existe para cazar: dos sesiones vivas en el mismo directorio.
 *   · FAIL-OPEN ante cualquier problema de infra (sin BD, sin red, sin sid): avisa y deja pasar.
 *     Bloquear commits porque la telemetría no responde sería peor que el fallo que evita.
 *   · Escape con nombre Y CON MOTIVO (T-496): INDICE_COMPARTIDO_OK="por qué", que queda impreso
 *     y registrado. El `=1` dejó de valer porque se había vuelto un prefijo que se copiaba.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.resolve(__dirname, '..')
const { evaluarIndice, mensajeBloqueo, evaluarEscape, esCommitParcial } = require(path.join(REPO, 'lib', 'sessions', 'indiceCompartido.cjs'))
const { resolverSid } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))

/** Registrar el roce sin bloquear NUNCA (T-423). */
function friccion(clase, guard, detalle) {
  try {
    const a = ['--clase', clase, '--guard', guard]
    if (detalle) a.push('--detalle', String(detalle).slice(0, 200))
    require('child_process').spawn(process.execPath, [path.join(REPO, 'scripts', 'friccion-emitir.cjs'), ...a],
      { detached: true, stdio: 'ignore' }).unref()
  } catch { /* la telemetría nunca estorba a un commit */ }
}

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

async function main() {
  // ── EL ESCAPE CUESTA UN MOTIVO (T-496) ────────────────────────────────────────────────────
  // Medido: 6 de 10 escapes NUNCA fueron precedidos de un bloqueo — el `=1` se había vuelto un
  // prefijo que se copia de un comando a otro. Un motivo no se arrastra sin darse cuenta, y queda
  // escrito. Si el valor no vale, NO se bloquea nada: simplemente se evalúa el guard, que en el
  // caso preventivo (nadie más en el directorio) deja pasar igual.
  const esc = evaluarEscape(process.env.INDICE_COMPARTIDO_OK)
  if (esc.usa && esc.permitido) {
    console.log(`⏭️  guardarraíl de índice compartido saltado: ${esc.motivo}`)
    friccion('guard_escape', 'indice-compartido', esc.motivo)
    return 0
  }
  if (esc.usa && !esc.permitido) {
    console.log(`⚠️  INDICE_COMPARTIDO_OK ignorado — ${esc.problema}`)
    console.log('    INDICE_COMPARTIDO_OK="commiteo solo docs; la otra sesión está en otro fichero" git commit …')
    console.log('    (no se bloquea nada por esto: se comprueba el directorio como siempre)')
  }
  // El host viene del MISMO resolvedor que el sid (T-484): dos sesiones en la misma ruta de
  // máquinas distintas no comparten índice, y sin este dato el guard las bloqueaba en falso.
  const { sid, host } = resolverSid({ repo: REPO })
  if (!sid) return 0                                   // sin identidad no se puede afirmar nada

  let worktreePath = null
  try {
    worktreePath = execFileSync('git', ['rev-parse', '--show-toplevel'],
      { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  } catch { return 0 }

  const u = url()
  if (!u) return 0
  let sesiones = []
  try {
    const postgres = require('postgres')
    const s = postgres(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8, idle_timeout: 2 })
    try {
      sesiones = await s`SELECT sid, worktree_path, host, last_signal_at FROM public.worktree_sessions`
    } finally { try { await s.end({ timeout: 3 }) } catch {} }
  } catch { return 0 }                                  // BD caída → no bloquea

  // `GIT_INDEX_FILE` lo exporta git al hook y dice sobre QUÉ índice se está commiteando (T-486).
  // Un commit parcial (`git commit -- <rutas>`) trae su propio índice temporal, así que lo que la
  // otra sesión tenga preparado no puede colarse. Ojo: `git commit -a` TAMBIÉN trae un índice
  // distinto (`index.lock`) y sí arrastra lo ajeno — el núcleo distingue los dos casos.
  const commitParcial = esCommitParcial(process.env.GIT_INDEX_FILE)
  const v = evaluarIndice({ sesiones, sid, worktreePath, host, commitParcial })
  if (v.exento === 'commit_parcial') {
    // La SITUACIÓN se registra igual (dos sesiones aquí sigue siendo fricción y hay que poder
    // verla subir), pero no es un bloqueo ni un rodeo: contarlo como cualquiera de los dos
    // envenenaría el ratio de escape, que es el termómetro de si este guard sigue vivo.
    console.log(`✅ commit parcial (rutas explícitas): el índice compartido no te afecta — ${v.companeras.length} sesión(es) más aquí.`)
    friccion('indice_compartido', 'indice-compartido', `${host || '?'}:${worktreePath} (commit parcial)`)
    return 0
  }
  if (v.permitido) return 0
  friccion('guard_bloqueo', 'indice-compartido', `${v.companeras.length} compañera(s)`)
  friccion('indice_compartido', 'indice-compartido', `${host || '?'}:${worktreePath}`)
  console.error(mensajeBloqueo({ ...v, worktreePath, host }))
  return 1
}

main().then((c) => process.exit(c)).catch((e) => {
  console.log(`⚠️  check-indice-compartido: ${String(e.message || e).slice(0, 120)} — commit permitido (fail-open).`)
  process.exit(0)
})
