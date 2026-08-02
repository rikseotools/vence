#!/usr/bin/env node
/**
 * latidos.cjs — lee las señales de vida de las sesiones. (T-296, 30/07/2026)
 *
 * Contesta la pregunta operativa: **«¿puedo borrar este worktree?»**. Solo LEE.
 *
 * Salidas:
 *   (sin flags)          informe legible, ordenado por señal más reciente
 *   --tsv                `slug<TAB>estado<TAB>antigüedad<TAB>borrable` (lo consume el listado en bash)
 *   --slug <slug>        solo ese, y el EXIT CODE contesta: 0 = nadie la usa · 3 = está en uso
 *   --json               crudo, por si hace falta encadenarlo
 *
 * El exit code de `--slug` es lo que permite que `borrar-worktree.sh` se niegue a borrar una sesión
 * viva sin que el humano tenga que acordarse de mirar.
 */
const fs = require('fs')
const path = require('path')
const { clasificarSenal, formatearAntiguedad, etiquetaEstado, nombresCasiIdenticos } = require('../../lib/sessions/latido.js')

const REPO = path.resolve(__dirname, '../..')
const TSV = process.argv.includes('--tsv')
const JSON_OUT = process.argv.includes('--json')
const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i >= 0 && v && !v.startsWith('--') ? v : null }
const SLUG = arg('--slug')

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const m = fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)
  return m && m[1].trim()
}

/**
 * Procesos con el `cwd` dentro del worktree. Es la OTRA señal, local y sin BD, y la que no se puede
 * falsear: si hay un proceso ahí dentro, alguien está trabajando ahora mismo. No sustituye al
 * latido (una sesión entre mensajes no tiene procesos), lo complementa.
 */
function procesosDentro(dir) {
  let n = 0
  try {
    for (const pid of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(pid)) continue
      try { if (fs.readlinkSync(`/proc/${pid}/cwd`).startsWith(dir)) n++ } catch {}
    }
  } catch { return null } // no es Linux: se calla en vez de mentir
  return n
}

async function main() {
  const s = require('postgres')(url(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
  let filas
  try {
    filas = await s`
      SELECT sid, slug, worktree_path, branch, host, last_signal_at, last_command, signals, first_signal_at,
             touched_files, touched_at
        FROM worktree_sessions ${SLUG ? s`WHERE slug = ${SLUG}` : s``}
       ORDER BY last_signal_at DESC`
  } finally {
    try { await s.end({ timeout: 5 }) } catch {}
  }

  const ahora = new Date()
  // El disco y `/proc` son de ESTA máquina (T-484): preguntarles por el worktree de una sesión
  // remota no da un «no» — da una respuesta falsa. Un `/app/vence` que aquí no existe se pintaría
  // como «el directorio ya no existe» de una sesión que está trabajando tan ricamente, y los
  // procesos contados serían los míos. Sobre lo ajeno se dice «no lo sé» (null), no «no».
  const { maquina } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))
  const AQUI = maquina()
  const datos = filas.map((r) => {
    const c = clasificarSenal(r.last_signal_at, ahora)
    const local = !r.host || !AQUI || r.host === AQUI
    const existe = local && r.worktree_path ? fs.existsSync(r.worktree_path) : null
    const procs = existe ? procesosDentro(r.worktree_path) : null
    return {
      ...r,
      estado: c.estado,
      minutos: c.minutos,
      antiguedad: formatearAntiguedad(c.minutos),
      procesos: procs,
      // Un proceso dentro MANDA sobre la antigüedad de la señal: la señal puede ser vieja y estar
      // alguien compilando ahí ahora mismo.
      borrable: c.borrable && !procs,
      existe,
      // Una sesión de OTRA máquina no la puedo borrar yo: el directorio no está aquí.
      remota: !local,
    }
  })

  if (JSON_OUT) { console.log(JSON.stringify(datos, null, 1)); return }
  if (TSV) {
    for (const d of datos) console.log([d.slug, d.estado, d.antiguedad, d.borrable ? 'borrable' : 'en-uso', d.procesos ?? ''].join('\t'))
    return
  }

  if (SLUG) {
    const d = datos[0]
    if (!d) { console.log(`⚪ ${SLUG}: sin ninguna señal registrada (nunca ha latido)`); process.exit(0) }
    console.log(`${etiquetaEstado(d.estado)}  ${d.slug}  ·  última señal ${d.antiguedad}${d.procesos ? `  ·  ${d.procesos} proceso(s) dentro` : ''}`)
    console.log(`   sid: ${d.sid} · rama: ${d.branch || '?'} · máquina: ${d.host || '?'}${d.remota ? ' (REMOTA: su worktree no está aquí)' : ''} · ${d.signals} señales desde ${String(d.first_signal_at).slice(0, 16)}`)
    if (!d.borrable) console.log('   ⛔ EN USO — no la borres')
    process.exit(d.borrable ? 0 : 3)
  }

  console.log(`\nSESIONES CON SEÑAL (${datos.length}):\n`)
  for (const d of datos) {
    const marca = d.remota ? `  (en ${d.host})` : d.existe === false ? '  (el directorio ya no existe)' : ''
    console.log(`  ${etiquetaEstado(d.estado).padEnd(16)} ${String(d.slug).padEnd(26)} ${d.antiguedad.padEnd(16)} ${d.procesos ? `${d.procesos} proc` : ''}${marca}`)
  }
  // ── Solape entre sesiones VIVAS (T-400) ───────────────────────────────────────────────────
  // El claim protege el id de la tarea; las sesiones chocan por los FICHEROS. Esto es el mapa:
  // qué ficheros están tocando a la vez dos sesiones que siguen dando señal. Informa, no corta.
  const { calcularSolapes, checkoutsCompartidos, sesionesSinHuella } = require(path.join(REPO, 'lib', 'sessions', 'solape.cjs'))

  // Primero lo PEOR: varias sesiones en el MISMO directorio. Ahí no hay conflicto de git que
  // avise — se sobrescriben en vivo. Es el acoplamiento de T-385.
  const compartidos = checkoutsCompartidos(datos, ahora)
  if (compartidos.length) {
    console.log('\n🚨 VARIAS SESIONES EN EL MISMO CHECKOUT (se pisan en vivo, git no media):')
    for (const g of compartidos) {
      console.log(`     ${g.sids.length} sesiones en  ${g.host ? `${g.host}:` : ''}${g.worktree_path}`)
      for (const x of g.sids) console.log(`         sid ${String(x).slice(0, 12)}…`)
    }
    console.log('     Lo sano es un worktree por sesión:  scripts/worktrees/crear-worktree.sh <slug>')
  }

  const mismoPath = new Map(datos.map((d) => [d.sid, d.worktree_path]))
  const vivas = datos.filter((d) => Array.isArray(d.touched_files) && d.touched_files.length)
  const choques = []
  const yaVisto = new Set()
  for (const a of vivas) {
    for (const c of calcularSolapes({ misFicheros: a.touched_files, sesiones: datos, sid: a.sid, ahora })) {
      // El mismo checkout ya se ha reportado arriba, y con más gravedad: no duplicar.
      if (c.worktree_path && mismoPath.get(a.sid) === c.worktree_path) continue
      const clave = [a.sid, c.sid].sort().join('|')
      if (yaVisto.has(clave)) continue
      yaVisto.add(clave)
      choques.push({ a: a.slug, b: c.slug, ficheros: c.ficheros })
    }
  }
  if (choques.length) {
    console.log('\n⚠️  SESIONES TOCANDO LOS MISMOS FICHEROS (el claim no cubre esto):')
    for (const c of choques) {
      console.log(`     ${c.a}  ↔  ${c.b}   (${c.ficheros.length} fichero(s))`)
      for (const f of c.ficheros.slice(0, 5)) console.log(`         ${f}`)
      if (c.ficheros.length > 5) console.log(`         …y ${c.ficheros.length - 5} más`)
    }
    console.log('     Aviso, no bloqueo: coordinad o repartíos el terreno.')
  } else if (vivas.length >= 2) {
    console.log('\n✅ ninguna sesión viva pisa los ficheros de otra.')
  }
  const ciegas = sesionesSinHuella(datos, null, ahora)
  if (ciegas.length) {
    // Un "todo limpio" que no puede ver a media plantilla es un verde falso.
    console.log(`ℹ️  ${ciegas.length} sesión(es) viva(s) sin huella publicada (latido viejo): no se puede descartar solape con ellas.`)
  }

  const pares = nombresCasiIdenticos(datos.map((d) => d.slug).filter(Boolean))
  if (pares.length) {
    console.log('\n⚠️  nombres casi idénticos (equivocarse al cerrar borra el trabajo de la otra):')
    for (const [a, b] of pares) console.log(`     ${a}  ↔  ${b}`)
  }
  // ── Trabajo HUÉRFANO (T-431) ──────────────────────────────────────────────────────────────
  // Hasta hoy este listado terminaba diciendo «MIRA SI TIENEN TRABAJO SIN PUSHEAR» y remitía a
  // ejecutar `git status` y `git log origin/main..` a mano, worktree por worktree. Eso es pedirle
  // al lector que haga de detector — y justo las sesiones que mueren no dejan a nadie que se
  // acuerde. Ahora la pregunta viene contestada, y con el criterio bueno: lo que se PERDERÍA, no
  // cuántos commits hay (de 5 worktrees medidos el 31/07, 4 tenían commits y nada que perder).
  const borrables = datos.filter((d) => d.borrable && d.existe)
  console.log(`\nSin señales y sin procesos (candidatas a cerrar): ${borrables.length}`)
  let huerfanos = []
  try {
    const { datosDeWorktree, listarWorktrees } = require(path.join(REPO, 'scripts', 'sessions', 'huerfanos.cjs'))
    const { clasificarWorktree } = require(path.join(REPO, 'lib', 'sessions', 'trabajoHuerfano.cjs'))
    const ramaDe = new Map(listarWorktrees().map((w) => [w.ruta, w.rama]))
    for (const d of borrables) {
      if (!ramaDe.has(d.worktree_path)) continue
      const c = clasificarWorktree({
        slug: d.slug,
        ...datosDeWorktree(d.worktree_path, ramaDe.get(d.worktree_path)),
        minSinSenal: d.minutos, procesos: d.procesos,
      })
      if (c.veredicto === 'contenido_unico') huerfanos.push({ ...c, ruta: d.worktree_path })
    }
  } catch { /* informar no puede romper el mapa */ }

  for (const d of borrables) {
    const h = huerfanos.find((x) => x.slug === d.slug)
    console.log(h
      ? `     ⚠️  ${d.slug} — ${h.motivo}: NO la borres todavía`
      : `     scripts/worktrees/borrar-worktree.sh ${d.slug}`)
  }
  if (huerfanos.length) {
    console.log(`\n⚠️  ${huerfanos.length} worktree(s) guardan trabajo que no existe en ningún otro sitio:`)
    for (const h of huerfanos) {
      for (const f of h.ficherosUnicos.slice(0, 6)) console.log(`        ${h.slug}: ${f}`)
      if (h.ficherosUnicos.length > 6) console.log(`        ${h.slug}: …y ${h.ficherosUnicos.length - 6} más`)
      console.log(`        → git -C ${h.ruta} diff origin/main`)
    }
  }
  console.log('\n(«sin señales» = 24 h de silencio. Una sesión que solo lee código y no toca el backlog no late.)')
  console.log('  Barrido completo, también de las vivas:  npm run sesiones:huerfanos\n')
}

main().catch((e) => { console.error('❌', String(e.message || e).slice(0, 200)); process.exit(1) })
