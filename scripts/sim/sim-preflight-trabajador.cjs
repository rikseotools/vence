#!/usr/bin/env node
/**
 * sim-preflight-trabajador.cjs — la misma ceguera, dos consecuencias. (T-539)
 *
 * ── QUÉ PRUEBA, Y POR QUÉ NO BASTAN LOS UNIT ────────────────────────────────────────────────
 * Los tests unitarios comprueban la DECISIÓN (`evaluarPreflight`, `cegueraBloquea`) con
 * observaciones inventadas. Lo que no pueden comprobar es lo único que importa de verdad: que al
 * ejecutar los guardarraíles y el preflight DE VERDAD, sin BD, un trabajador se pare y una persona
 * no. Eso pasa por procesos, variables de entorno y códigos de salida — donde vivía el fallo que
 * originó esta ficha (un `return 0` mudo que nadie notó durante meses).
 *
 * Se ejecutan los binarios reales con el entorno manipulado, y se mira el EXIT CODE, que es lo que
 * git obedece. Nada de importar funciones y confiar en que el hook haga lo mismo.
 *
 * Los casos SIN BD no escriben nada. El caso CON BD usa un sid desechable y se limpia solo.
 *
 * Uso:  npm run sim:preflight-trabajador
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO = path.resolve(__dirname, '..', '..')
const SID = 'SIM-preflight-t539'

const casos = []
function afirmar(nombre, ok, detalle = '') {
  casos.push({ nombre, ok })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}${detalle ? `  → ${detalle}` : ''}`)
}

/** Corre un script del repo con el entorno que se le diga y devuelve {code, salida}. */
function correr(script, args, env) {
  const r = spawnSync(process.execPath, [path.join(REPO, script), ...args], {
    cwd: REPO, encoding: 'utf8', timeout: 60_000,
    // Entorno LIMPIO: sin esto, el DATABASE_URL del proceso padre se colaría y el caso «sin BD»
    // no probaría nada. Es el error clásico de este tipo de simulación.
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
  })
  return { code: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` }
}

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
  } catch { return null }
}

async function main() {
  console.log('\nSIMULACIÓN — un trabajador ciego no puede trabajar; una persona ciega sí (T-539)')
  console.log('='.repeat(74))

  // ── LA CEGUERA SE PROVOCA CON UNA URL QUE NO RESPONDE ───────────────────────────────────
  // Y NO quitando el `.env.local`: estos scripts lo leen del repo, así que «entorno limpio» no
  // basta — la primera versión de esta simulación se lo creyó, y además dejaba una sesión falsa
  // escrita antes de medir, con lo que el guard bloqueaba por culpa de la propia simulación.
  // Con una URL inalcanzable se ejercita el camino REAL de BD caída y no se escribe nada.
  const CIEGO = { DATABASE_URL: 'postgres://nadie:nadie@127.0.0.1:1/vence_no_existe' }

  console.log('\n▸ 1. preflight con la BD inalcanzable: persona vs trabajador')
  const p1 = correr('scripts/sessions/preflight.cjs', ['--sid', SID], CIEGO)
  const p2 = correr('scripts/sessions/preflight.cjs', ['--sid', SID], { ...CIEGO, VENCE_SESSION_ROLE: 'trabajador' })

  afirmar('la PERSONA puede trabajar, avisada de que no está en el reparto',
    p1.code === 0 && /SESIÓN INCOMPLETA/.test(p1.salida), `exit=${p1.code}`)
  afirmar('el TRABAJADOR no puede coger trabajo',
    p2.code === 1 && /TRABAJADOR INCOMPLETO/.test(p2.salida), `exit=${p2.code}`)

  // ── 2. GUARDARRAÍLES CIEGOS: el mismo comando, dos veredictos ────────────────────────────
  console.log('\n▸ 2. guardarraíl del índice con la BD caída: persona vs trabajador')
  const gPersona = correr('scripts/check-indice-compartido.cjs', [], CIEGO)
  const gTrabajador = correr('scripts/check-indice-compartido.cjs', [], { ...CIEGO, VENCE_SESSION_ROLE: 'trabajador' })

  afirmar('la PERSONA pasa (fail-open) y se le AVISA de que no ha comprobado',
    gPersona.code === 0 && /no lo sé/i.test(gPersona.salida), `exit=${gPersona.code}`)
  afirmar('el TRABAJADOR se PARA (fail-closed)',
    gTrabajador.code === 1, `exit=${gTrabajador.code}`)
  afirmar('y se le dice por qué, nombrando el guardarraíl',
    /check-indice-compartido/.test(gTrabajador.salida) && /TRABAJADOR AUT/i.test(gTrabajador.salida))

  console.log('\n▸ 3. push-guard con la BD caída')
  // Solo cobra peaje si los commits que se empujan DECLARAN un T-nnn. Si en este estado del repo
  // no hay peaje, la comprobación NO es evaluable — y decirlo es mejor que apuntarse un verde que
  // no ha probado nada (es justo el modo de fallo que esta ficha combate).
  const pgTrabajador = correr('scripts/backlog-push-guard.cjs', [], { ...CIEGO, VENCE_SESSION_ROLE: 'trabajador' })
  const huboPeaje = /no pude leer backlog_tasks|no puedo verificar el claim|TRABAJADOR AUT/i.test(pgTrabajador.salida)
  if (!huboPeaje) {
    console.log('   ⏭️  sin peaje en este estado del repo (ningún commit por empujar declara un T-nnn): no evaluable')
  } else {
    afirmar('el TRABAJADOR se para si no puede verificar el claim',
      pgTrabajador.code === 1, `exit=${pgTrabajador.code}`)
    const pgPersona = correr('scripts/backlog-push-guard.cjs', [], CIEGO)
    afirmar('la PERSONA pasa avisada', pgPersona.code === 0, `exit=${pgPersona.code}`)
  }

  // ── 3.bis. EL PROCESO EN EL ÁRBOL DE OTRA SESIÓN (T-539) ────────────────────────────────
  // El caso que reportó el trabajador del piloto: su `cwd` se reiniciaba entre comandos y acababa
  // ejecutando en el árbol de otra sesión. Ahí adopta su `.session-id`, así que el guard de índice
  // compartido ve «estás solo» y deja pasar — es [T-415] por una puerta que no se podía ver.
  console.log('\n▸ 3.bis. commitear desde el árbol de OTRA sesión')
  const FUERA = { VENCE_SESSION_HOME: '/home/manuel/vence-sessions/un-arbol-que-no-es-el-mio' }
  const aquiMismo = { VENCE_SESSION_HOME: REPO }

  const trabFuera = correr('scripts/check-indice-compartido.cjs', [], { ...FUERA, VENCE_SESSION_ROLE: 'trabajador' })
  afirmar('al TRABAJADOR se le para el commit', trabFuera.code === 1, `exit=${trabFuera.code}`)
  afirmar('y se le dicen los DOS árboles, para que sepa a dónde volver',
    /tu árbol/.test(trabFuera.salida) && /estás en/.test(trabFuera.salida))

  const trabCasa = correr('scripts/check-indice-compartido.cjs', [], { ...aquiMismo, VENCE_SESSION_ROLE: 'trabajador' })
  afirmar('en SU árbol no le estorba', trabCasa.code === 0, `exit=${trabCasa.code}`)

  // Una persona se cambia de árbol a propósito continuamente: pararla sería el falso positivo que
  // acaba con un guardarraíl.
  const personaFuera = correr('scripts/check-indice-compartido.cjs', [], FUERA)
  afirmar('a una PERSONA fuera de ese árbol no se la para', personaFuera.code === 0, `exit=${personaFuera.code}`)

  // Y sin hogar declarado, exactamente como antes de T-539: nadie dijo dónde debería estar.
  const sinHogar = correr('scripts/check-indice-compartido.cjs', [], { VENCE_SESSION_ROLE: 'trabajador' })
  afirmar('sin hogar declarado no se inventa el requisito', sinHogar.code === 0, `exit=${sinHogar.code}`)

  // ── 4. CON BD: la sesión queda VISIBLE y deja veredicto ──────────────────────────────────
  console.log('\n▸ 4. preflight CON BD: la sesión aparece en el reparto y deja rastro')
  const u = url()
  if (!u) {
    console.log('   ⏭️  sin DATABASE_URL en el entorno: no se puede probar el camino sano')
  } else {
    const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
    try {
      const ok = correr('scripts/sessions/preflight.cjs', ['--sid', SID], { DATABASE_URL: u })
      afirmar('sale 0 y se declara completa', ok.code === 0 && /sesión completa/i.test(ok.salida), `exit=${ok.code}`)

      const fila = await sql`SELECT sid FROM worktree_sessions WHERE sid = ${SID}`
      afirmar('la sesión es VISIBLE para las demás (fila en worktree_sessions)', fila.length === 1)

      const ev = await sql`
        SELECT severity, metadata->>'veredicto' AS veredicto FROM observable_events
         WHERE event_type = 'sesion_preflight' AND metadata->>'sid' = ${SID}
         ORDER BY created_at DESC LIMIT 1`
      afirmar('deja veredicto en el bus, no solo en la terminal de quien lo corrió',
        ev.length === 1 && ev[0].veredicto === 'completo', ev.length ? `${ev[0].severity}/${ev[0].veredicto}` : 'sin evento')
    } finally {
      const s1 = await sql`DELETE FROM worktree_sessions WHERE sid = ${SID} RETURNING sid`
      const s2 = await sql`DELETE FROM observable_events WHERE event_type = 'sesion_preflight'
                            AND metadata->>'sid' = ${SID} RETURNING id`
      console.log(`\n🧹 limpieza: ${s1.length} sesión(es) y ${s2.length} evento(s) desechables borrados`)
      try { await sql.end({ timeout: 5 }) } catch {}
    }
  }

  const fallos = casos.filter((c) => !c.ok)
  console.log(`\n${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} comprobaciones`)
  if (fallos.length) console.log('   ' + fallos.map((f) => f.nombre).join('\n   '))
  return fallos.length ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌', e); process.exit(1) })
