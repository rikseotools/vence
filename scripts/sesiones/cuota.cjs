#!/usr/bin/env node
// scripts/sesiones/cuota.cjs — ¿a qué cuenta le queda cuota, y a quién hay que mover?
//
// ## Por qué existe ([T-709], 08/08/2026)
//
// Manuel: *«igual me quedo yo ahora sin poder terminar, y eso es un fallo»*. Hay DOS cuentas de
// Claude Code y hasta hoy: (a) el consumo se medía **por sesión, no por cuenta**, así que no se
// podía responder a cuál le queda; (b) el límite solo se detectaba **después** de topar, y solo
// para los trabajadores de la flota; (c) rotar un panel había que hacerlo a mano.
//
// Este comando responde las tres cosas y **rota sin que haya que escribir nada**.
//
// El criterio NO vive aquí: `lib/sessions/rotacionCuenta.cjs` (cuándo avisar, a dónde mover, qué
// orden lanzar) y `lib/observability/cuentaDeSesion.cjs` (de quién es cada consumo), los dos
// puros y con tests. Aquí solo se leen datos y se ejecuta.
//
// Uso:
//   npm run cuota                      # foto: cuánto lleva cada cuenta y quién está apurado
//   npm run cuota -- --rotar movil2    # SIMULA la rotación de ese panel (enseña la orden)
//   npm run cuota -- --rotar movil2 --aplicar
require('dotenv').config({ path: '.env.local' })
const { execFileSync } = require('child_process')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')
const ROT = require('../../lib/sessions/rotacionCuenta.cjs')
const CS = require('../../lib/observability/cuentaDeSesion.cjs')
const CUENTAS = require('../../lib/flota/cuentas.cjs')

const args = process.argv.slice(2)
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }
const ROTAR = val('--rotar')
const APLICAR = args.includes('--aplicar')

/** Paneles de tmux vivos, con su directorio (que es lo que identifica la sesión). */
function paneles() {
  try {
    const out = execFileSync('tmux',
      ['list-panes', '-a', '-F', '#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_path}'],
      { encoding: 'utf8' })
    return out.trim().split('\n').filter(Boolean).map((l) => {
      const [panel, cwd] = l.split('\t')
      return { panel, cwd, slug: (cwd || '').split('/').pop() }
    })
  } catch {
    return []  // sin tmux (o sin servidor) no es un error: simplemente no hay paneles que rotar
  }
}

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  // Consumo de la ventana semanal en curso, por sesión. La cuenta se resuelve fuera: los eventos
  // viejos NO la llevan (medido: de 355 transcripts, ninguno la guarda) y suponerla sería el
  // error que invalida la medida en cuanto se rote una vez.
  const { rows: consumo } = await c.query(`
    SELECT metadata->>'cuenta'    AS cuenta,
           metadata->>'sessionId' AS sesion,
           sum((metadata->>'outputTokens')::bigint
             + coalesce((metadata->>'cacheReadTokens')::bigint, 0))::bigint AS tokens
      FROM observable_events
     WHERE event_type = 'llm_call'
       AND metadata->>'billing' = 'suscripcion'
       AND ts > date_trunc('week', now())
     GROUP BY 1, 2`)

  const porCuenta = new Map()
  for (const r of consumo) {
    const cta = CS.estaAtribuido(r.cuenta) ? r.cuenta : CS.DESCONOCIDA
    porCuenta.set(cta, (porCuenta.get(cta) || 0) + Number(r.tokens || 0))
  }

  // La REFERENCIA es empírica: lo que esa cuenta llevaba consumido la última vez que topó. Sin
  // API de cuota es el único número real que tenemos, y se corrige solo cada vez que se topa.
  //
  // La marca la deja el supervisor de la flota en el evento que YA emite al toparse
  // (`flota_turno` con `fase='sin_cuota'`), enriquecido con la cuenta ([T-709]). Se reusa ese
  // evento en vez de estrenar uno: dos tipos para el mismo hecho acaban con una regla que
  // nadie mira. La referencia es el consumo de esa cuenta en la SEMANA en que se quedó seca.
  const { rows: topes } = await c.query(`
    WITH secas AS (
      SELECT metadata->>'cuenta' AS cuenta, date_trunc('week', ts) AS semana
        FROM observable_events
       WHERE event_type = 'flota_turno' AND metadata->>'fase' = 'sin_cuota'
         AND metadata->>'cuenta' IS NOT NULL
       GROUP BY 1, 2)
    SELECT s.cuenta,
           max(g.tokens) AS referencia
      FROM secas s
      JOIN LATERAL (
        SELECT sum((e.metadata->>'outputTokens')::bigint
                 + coalesce((e.metadata->>'cacheReadTokens')::bigint, 0))::bigint AS tokens
          FROM observable_events e
         WHERE e.event_type = 'llm_call' AND e.metadata->>'billing' = 'suscripcion'
           AND e.metadata->>'cuenta' = s.cuenta
           AND e.ts >= s.semana AND e.ts < s.semana + interval '1 week') g ON true
     GROUP BY 1`)
  const referencia = new Map(topes.map((t) => [t.cuenta, Number(t.referencia || 0)]))

  const disponibles = CUENTAS.cuentasDisponibles(process.env)
  console.log(`🔑 cuentas con credencial en este entorno: ${disponibles.join(', ') || '(ninguna)'}\n`)

  const estados = []
  for (const [cuenta, tokens] of [...porCuenta.entries()].sort((a, b) => b[1] - a[1])) {
    const v = ROT.estadoDeCuota({ consumido: tokens, referencia: referencia.get(cuenta) ?? null })
    estados.push({ cuenta, estado: v.estado })
    const M = (n) => `${(n / 1e6).toFixed(1)}M`
    const pct = v.fraccion === null ? 'sin referencia' : `${Math.round(v.fraccion * 100)}% de lo que gastó al topar`
    const icono = { holgado: '🟢', avisar: '🟠', rotar_ya: '🔴', desconocido: '⚪' }[v.estado]
    console.log(`   ${icono} ${cuenta} — ${M(tokens)} tokens esta semana · ${pct}`)
    if (v.sinReferencia) {
      console.log('      ℹ️ esta cuenta no ha topado nunca desde que se mide: no se puede avisar todavía')
    }
  }
  if (porCuenta.has(CS.DESCONOCIDA)) {
    console.log('\n   ⚠️ hay consumo SIN ATRIBUIR: es de antes de sellar la cuenta y no se puede repartir.')
  }

  if (!ROTAR) {
    console.log('\n   ▶ para mover un panel a la otra cuenta:  npm run cuota -- --rotar <slug> [--aplicar]')
    await c.end()
    return
  }

  // ── Rotación ────────────────────────────────────────────────────────────────────────────
  const panel = paneles().find((p) => p.slug === ROTAR || p.panel.startsWith(`${ROTAR}:`))
  if (!panel) {
    console.error(`\n❌ no encuentro ningún panel de tmux para «${ROTAR}». Vivos: ` +
      paneles().map((p) => p.slug).join(', '))
    process.exit(2)
  }

  const { rows: sesion } = await c.query(
    `SELECT sid FROM worktree_sessions WHERE worktree_path = $1 ORDER BY last_signal_at DESC LIMIT 1`,
    [panel.cwd])

  const actual = CS.cuentaDeSesion({ env: process.env, global: CS.cuentaGlobal() }).cuenta
  const destino = ROT.destinoDeRotacion({
    actual,
    candidatas: disponibles.map((d) => ({ cuenta: d, estado: estados.find((e) => e.cuenta === d)?.estado ?? 'desconocido' })),
  })
  if (!destino) {
    console.error(`\n❌ no hay ninguna cuenta sana a la que mover «${ROTAR}» (todas apuradas o sin credencial).`)
    process.exit(1)
  }

  const orden = ROT.ordenDeRotacion({
    panel: panel.panel,
    cwd: panel.cwd,
    envVar: CUENTAS.CUENTA_ENV[destino],
    sesionId: sesion[0]?.sid || null,
  })

  console.log(`\n↻ ${ROTAR} (${panel.panel}) → cuenta «${destino}»`)
  console.log(`   ${orden.argv.join(' ')}`)

  if (!APLICAR) {
    console.log('\n   ▶ SIMULACIÓN. Repite con --aplicar. OJO: relanzar MATA lo que corra en ese panel;')
    console.log('     el hilo se conserva con --resume, pero un comando a medias se pierde.')
    await c.end()
    return
  }

  execFileSync(orden.argv[0], orden.argv.slice(1), { stdio: 'inherit' })
  await c.query(`
    INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
    VALUES ('gha', 'info', 'sesion_cuenta_rotada', 'cuota', $1::jsonb)`,
    [JSON.stringify({ slug: ROTAR, panel: panel.panel, de: actual, a: destino, sesion: sesion[0]?.sid || null })])
  console.log(`\n✅ ${ROTAR} relanzado en «${destino}» con el hilo reanudado · evento emitido`)
  await c.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
