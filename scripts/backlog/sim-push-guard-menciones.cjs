#!/usr/bin/env node
// scripts/backlog/sim-push-guard-menciones.cjs — simulación + GATE de la regla «cita ≠ trabajo»
// del guardarraíl de push del backlog (T-403).
//
// QUÉ MIDE. Desde el 31/07 el guard no exige claim para un `T-NNN` que solo aparece en el CUERPO
// de un commit cuyo ASUNTO ya declara otra tarea (ver lib/backlog/pushGuard.cjs). Eso es una
// RELAJACIÓN, y una relajación sin medida es una esperanza. Esta simulación recorre el historial
// real, clasifica cada commit con la función REAL —no una copia— y estima cuántas de esas citas
// eran en realidad TRABAJO de la tarea citada (los «falsos permisos» que la regla abriría).
//
// CÓMO ESTIMA «era trabajo». No se puede saber con certeza a posteriori, así que se usa la mejor
// evidencia disponible: que el commit toque un fichero DISTINTIVO de esa tarea, entendiendo por
// distintivo el que solo declaran <=MAX_TAREAS tareas distintas. Sin ese filtro, ficheros como
// `scripts/backlog.cjs` o `backend/src/alerts/alert-rules.ts` —que toca medio repo— hacen
// culpable a cualquiera: el solape crudo daba 158 casos y con el filtro quedan 69.
//
// POR QUÉ ES UN GATE Y NO UN INFORME. La regla se apoya en cómo escribe los commits este repo
// (el asunto declara, el cuerpo es prosa). Si esa costumbre cambia —o si alguien empieza a
// declarar trabajo solo en el cuerpo— la relajación deja de ser segura y nadie se enteraría.
// Este script se pone rojo cuando eso pasa. Medido el 31/07 en la banda relajada: 2,8 %.
//
//   node scripts/backlog/sim-push-guard-menciones.cjs [--max-tareas 2] [--techo 6] [--json] [--ejemplos]
//
// Solo lectura: git log y nada más. Ni BD ni red.

const { execFileSync } = require('child_process')
const path = require('path')
const { clasificarMenciones, extractTaskIds } = require('../../lib/backlog/pushGuard.cjs')

const REPO = path.join(__dirname, '..', '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i === -1 ? d : process.argv[i + 1]
}
const MAX_TAREAS = Number(arg('--max-tareas', 2))
// Techo del gate, en % de citas con evidencia de trabajo real dentro de la banda relajada.
// 6 % sobre el 2,8 % medido: margen para el ruido del propio estimador (las 6 revisadas a mano
// el 31/07 eran contexto o tarea vecina que comparte fichero), no para una deriva de verdad.
const TECHO = Number(arg('--techo', 6))
const MIN_MUESTRA = 50   // por debajo de esto la tasa no dice nada y el gate se calla

// Ficheros que no son evidencia de nada: los toca todo el mundo, en toda tarea.
const RUIDO = new Set(['docs/roadmap/tareas-pendientes.md', 'CLAUDE.md'])

const RS = '\x1e'
const FS = '\x1f'

function leerHistorial() {
  const raw = execFileSync('git', ['log', `--format=${RS}%H${FS}%s${FS}%b${FS}`, '--name-only'], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 512,
  })
  const out = []
  for (const rec of raw.split(RS)) {
    if (!rec.trim()) continue
    const [hash, subject, body, filesBlob] = rec.split(FS)
    out.push({
      hash,
      subject: subject || '',
      body: body || '',
      files: (filesBlob || '').split('\n').map((l) => l.trim()).filter(Boolean).filter((f) => !RUIDO.has(f)),
    })
  }
  return out
}

/** Huella de cada tarea (ficheros de los commits que la DECLARAN en el asunto) + reparto por fichero. */
function huellas(commits) {
  const porTarea = new Map()
  const tareasPorFichero = new Map()
  for (const c of commits) {
    for (const id of extractTaskIds(c.subject)) {
      if (!porTarea.has(id)) porTarea.set(id, new Set())
      for (const f of c.files) {
        porTarea.get(id).add(f)
        if (!tareasPorFichero.has(f)) tareasPorFichero.set(f, new Set())
        tareasPorFichero.get(f).add(id)
      }
    }
  }
  return { porTarea, tareasPorFichero }
}

function main() {
  const commits = leerHistorial()
  const { porTarea, tareasPorFichero } = huellas(commits)
  const distintivo = (f) => (tareasPorFichero.get(f)?.size || 0) <= MAX_TAREAS

  // Dos bandas, y solo la primera se relaja. La segunda es el CONTROL: si el gate se pusiera
  // verde relajándola también, estaríamos soltando el 17 % que la medida encontró.
  const bandas = {
    relajada: { commits: new Set(), citas: 0, evidencia: [] },   // el asunto declara algo
    bloqueada: { commits: new Set(), citas: 0, evidencia: [] },  // el asunto no declara nada
  }

  for (const c of commits) {
    const enAsunto = extractTaskIds(c.subject)
    const { mencionSolo } = clasificarMenciones({ commits: [{ subject: c.subject, body: c.body }] })
    const enCuerpoExtra = extractTaskIds(c.body).filter((id) => !enAsunto.includes(id))
    if (!enCuerpoExtra.length) continue

    // `clasificarMenciones` solo devuelve citas cuando el asunto declara: eso separa las bandas.
    const banda = mencionSolo.length ? 'relajada' : 'bloqueada'
    const b = bandas[banda]
    b.commits.add(c.hash)
    for (const id of enCuerpoExtra) {
      b.citas++
      const h = porTarea.get(id)
      const d = h ? c.files.filter((f) => h.has(f) && distintivo(f)) : []
      if (d.length) b.evidencia.push({ hash: c.hash.slice(0, 9), id, subject: c.subject.slice(0, 78), ficheros: d })
    }
  }

  const tasa = (b) => (b.citas ? (b.evidencia.length / b.citas) * 100 : 0)
  const resultado = {
    commits_analizados: commits.length,
    max_tareas_para_distintivo: MAX_TAREAS,
    techo_pct: TECHO,
    relajada: {
      commits: bandas.relajada.commits.size,
      citas: bandas.relajada.citas,
      con_evidencia: bandas.relajada.evidencia.length,
      pct: Number(tasa(bandas.relajada).toFixed(1)),
    },
    bloqueada: {
      commits: bandas.bloqueada.commits.size,
      menciones: bandas.bloqueada.citas,
      con_evidencia: bandas.bloqueada.evidencia.length,
      pct: Number(tasa(bandas.bloqueada).toFixed(1)),
    },
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(resultado, null, 2))
  } else {
    console.log('═══ SIM — «cita ≠ trabajo» del push-guard del backlog (T-403) ═══')
    console.log(`historial: ${resultado.commits_analizados} commits · fichero distintivo = declarado por <=${MAX_TAREAS} tareas\n`)
    console.log('BANDA RELAJADA — el asunto YA declara una tarea, el cuerpo cita otras:')
    console.log(`  ${resultado.relajada.commits} commits · ${resultado.relajada.citas} citas`)
    console.log(`  con evidencia de trabajo real: ${resultado.relajada.con_evidencia} (${resultado.relajada.pct} %)  ← lo que el gate vigila\n`)
    console.log('BANDA QUE SIGUE BLOQUEANDO — el asunto no declara ninguna tarea (control):')
    console.log(`  ${resultado.bloqueada.commits} commits · ${resultado.bloqueada.menciones} menciones`)
    console.log(`  con evidencia de trabajo real: ${resultado.bloqueada.con_evidencia} (${resultado.bloqueada.pct} %)  ← el hueco que NO se abre`)
    if (process.argv.includes('--ejemplos')) {
      console.log('\n── citas de la banda relajada con evidencia (revisar a mano si crecen) ──')
      for (const e of bandas.relajada.evidencia) {
        console.log(`  ${e.hash} [${e.id}] ${e.subject}\n      ${e.ficheros.slice(0, 3).join(', ')}`)
      }
    }
  }

  if (resultado.relajada.citas < MIN_MUESTRA) {
    console.log(`\n⚪ SIN VEREDICTO: solo ${resultado.relajada.citas} citas (<${MIN_MUESTRA}). Muestra insuficiente, no se afirma nada.`)
    return 0
  }
  if (resultado.relajada.pct > TECHO) {
    console.error(`\n🔴 GATE ROJO: ${resultado.relajada.pct} % de las citas relajadas parecen TRABAJO (techo ${TECHO} %).`)
    console.error('   La costumbre de commit del repo ha cambiado: ya se declara trabajo solo en el cuerpo.')
    console.error('   Revisa con --ejemplos y reconsidera la regla en lib/backlog/pushGuard.cjs (T-403).')
    return 1
  }
  console.log(`\n🟢 VERDE: ${resultado.relajada.pct} % ≤ techo ${TECHO} %. La relajación sigue respaldada por el historial.`)
  return 0
}

process.exit(main())
