#!/usr/bin/env node
/**
 * flota.cjs — gobernar la flota desde el portátil, sin entrar en ningún servidor. (T-486)
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
 * Los trabajadores ya se sincronizan solos con las sesiones locales (claim, latido, embudo,
 * entregas viven en RDS). Lo que faltaba era lo de arriba: **arrancarlos, darles trabajo y saber
 * cómo van sin abrir una terminal por máquina**. Sin esto, «tengo una flota» significa en la
 * práctica «tengo que entrar por SSH a cada sitio», que es exactamente lo que se quería evitar.
 *
 * Se apoya en lo que ya hay y no duplica nada:
 *   · quién está vivo  → `worktree_sessions` (lo escribe el latido, escritor único)
 *   · qué hace cada uno → `backlog_tasks` (el claim)
 *   · qué te pregunta   → `session_questions` (el embudo de T-493)
 *   · qué te entrega    → la quinta espera de T-539
 * Lo único propio es el cruce con lo ESPERADO (`lib/flota/maquinas.cjs`), que es lo que permite
 * decir «falta w2» en vez de enseñar solo lo que hay.
 *
 * Uso:
 *   npm run flota                       # estado: quién vive, qué hace, qué falta
 *   npm run flota -- encargar w1        # le manda su encargo (elige tarea apta si no se dice)
 *   npm run flota -- encargar w1 --tarea T-451
 *   npm run flota -- arrancar w2        # levantar uno parado
 *   npm run flota -- parar w2
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.resolve(__dirname, '..', '..')
const MAQ = require(path.join(REPO, 'lib', 'flota', 'maquinas.cjs'))
const ENC = require(path.join(REPO, 'lib', 'flota', 'encargo.cjs'))
const { sidCorto } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))
const AUT = require(path.join(REPO, 'lib', 'flota', 'autenticacion.cjs'))

const cmd = process.argv[2] || 'estado'
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

/** Ejecuta algo en la máquina de un trabajador. Sin secretos en la línea de órdenes. */
function enMaquina(trabajador, orden, { entrada = null } = {}) {
  const m = MAQ.maquinaDe(trabajador)
  if (!m) throw new Error(`el trabajador "${trabajador}" no está declarado en ninguna máquina (lib/flota/maquinas.cjs)`)
  return execFileSync('ssh', ['-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=10',
    '-i', m.llave, `${m.usuario}@${m.host}`, orden],
    { encoding: 'utf8', input: entrada || undefined, timeout: 120_000 })
}

async function main() {
  const u = url()
  if (!u) { console.error('❌ sin DATABASE_URL'); return 1 }
  const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 15 })

  try {
    if (cmd === 'estado') {
      const sesiones = await sql`
        SELECT sid, slug, host, rol, last_signal_at FROM public.worktree_sessions
         WHERE rol = 'trabajador'`
      const tareas = await sql`
        SELECT id, title, claimed_by FROM public.backlog_tasks
         WHERE status = 'in_progress' AND claimed_by IS NOT NULL`
      const entregas = await sql`
        SELECT id, title, review_requested_by FROM public.backlog_tasks
         WHERE review_requested_at IS NOT NULL AND status <> 'done'`
      const preguntas = await sql`
        SELECT id, sid, question FROM public.session_questions WHERE status = 'open'`.catch(() => [])

      const filas = MAQ.comparar(sesiones)
      const porSid = new Map(sesiones.map((s) => [s.slug, s.sid]))
      const tareaDe = (slug) => tareas.find((t) => t.claimed_by === porSid.get(slug))

      console.log('\nFLOTA')
      console.log('='.repeat(60))
      for (const f of filas) {
        const icono = f.estado === 'vivo' ? '🟢' : f.estado === 'callado' ? '🟠' : '🔴'
        const t = tareaDe(f.trabajador)
        const cuando = f.antiguedadMin == null ? 'sin señal nunca'
          : f.antiguedadMin < 1 ? 'ahora mismo' : `hace ${f.antiguedadMin} min`
        console.log(`  ${icono} ${f.trabajador.padEnd(4)} ${f.maquina.padEnd(9)} ${cuando}`)
        console.log(`       ${t ? `${t.id} — ${String(t.title).slice(0, 60)}` : 'SIN TAREA (dale una: flota -- encargar ' + f.trabajador + ')'}`)
      }

      // Lo que espera a Manuel va SIEMPRE, aunque la flota esté perfecta: es lo único cuyo coste
      // corre mientras nadie lo lee.
      if (entregas.length) {
        console.log(`\n🙋 ${entregas.length} ENTREGADA(S) esperando que las revises:`)
        for (const e of entregas) console.log(`   ${e.id}  ${String(e.title).slice(0, 62)}`)
      }
      if (preguntas.length) {
        console.log(`\n❓ ${preguntas.length} PREGUNTA(S):`)
        for (const p of preguntas) console.log(`   ${sidCorto(p.sid)}: ${String(p.question).slice(0, 90)}`)
      }
      // ── ¿PUEDEN DE VERDAD TRABAJAR? (T-486) ────────────────────────────────────────
      // El latido dice que la máquina vive; no dice nada de Claude Code. Sin esta sonda, un
      // trabajador atascado en la pantalla de login sale 🟢 y ocupa sitio en el reparto sin
      // poder hacer nada — pasó en el primer arranque real, con los dos a la vez.
      // Cuesta cuota, así que va solo con --probar… salvo que alguno esté SIN TAREA, que es
      // justo el síntoma con el que se manifiesta.
      const sospechosos = filas.filter((f) => f.estado === 'vivo' && !tareaDe(f.trabajador))
      const probar = process.argv.includes('--probar') || sospechosos.length > 0
      const malAutenticados = []
      if (probar) {
        for (const f of (process.argv.includes('--probar') ? filas.filter((x) => x.estado === 'vivo') : sospechosos)) {
          let salida = ''
          try {
            salida = enMaquina(f.trabajador,
              `set -a; . /etc/vence-flota/${f.trabajador}.env; set +a; timeout 90 claude -p ${JSON.stringify(AUT.SONDA)} 2>&1 || true`)
          } catch (e) { salida = String(e.message || e) }
          const v = AUT.clasificar(salida, /\bok\b/i.test(salida) ? 0 : 1)
          if (!AUT.puedeTrabajar(v)) {
            malAutenticados.push({ trabajador: f.trabajador, v })
            // Al bus, para que la serie exista y se pueda ver si esto mejora o empeora.
            await sql`
              INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
              VALUES ('fargate', ${AUT.severidad(v)}, 'flota_autenticacion', 'flota', ${v.detalle},
                      ${sql.json({ trabajador: f.trabajador, maquina: f.maquina, estado: v.estado })})`
              .catch(() => {})
          }
        }
      }
      if (malAutenticados.length) {
        console.log(`\n🔑 ${malAutenticados.length} trabajador(es) NO pueden trabajar aunque estén latiendo:`)
        for (const m of malAutenticados) console.log(`   ${AUT.diagnostico(m.trabajador, m.v)}`)
      }

      // El resumen NO puede meter en el mismo saco «no da señal» y «da señal pero no puede
      // trabajar»: se arreglan en sitios distintos (la máquina vs. la credencial), y un resumen
      // que los confunde manda a mirar donde no es.
      const sinSenal = filas.filter((f) => f.estado !== 'vivo')
      const partes = []
      if (sinSenal.length) partes.push(`${sinSenal.length} sin señal`)
      if (malAutenticados.length) partes.push(`${malAutenticados.length} sin poder trabajar`)
      console.log(partes.length ? `\n⚠️  ${partes.join(' · ')}` : '\n✅ toda la flota viva y trabajando')
      return partes.length ? 3 : 0
    }

    if (cmd === 'encargar') {
      const w = process.argv[3]
      if (!w) { console.error('Uso: flota.cjs encargar <trabajador> [--tarea T-nnn]'); return 2 }
      let tarea = null
      const pedida = arg('--tarea')
      if (pedida) {
        const [t] = await sql`SELECT id, title FROM public.backlog_tasks WHERE id = ${pedida}`
        if (!t) { console.error(`❌ ${pedida} no existe`); return 1 }
        const v = ENC.esApta(t)
        if (!v.apta) console.log(`⚠️  ${t.id} no parece apta para un trabajador (${v.motivo}) — se manda igual porque lo has pedido.`)
        tarea = t
      } else {
        // Candidatas: libres, sin espera, ordenadas como las ordena el backlog.
        const libres = await sql`
          SELECT id, title FROM public.backlog_tasks
           WHERE status = 'open' AND claimed_by IS NULL
             AND (snooze_until IS NULL OR snooze_until <= now())
             AND wake_on_deploy_sha IS NULL AND review_requested_at IS NULL
           ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, id
           LIMIT 40`
        const { tarea: elegida, descartadas } = ENC.elegir(libres)
        if (!elegida) { console.error('❌ ninguna tarea libre resultó apta'); return 1 }
        tarea = elegida
        if (descartadas.length) {
          console.log(`   (descartadas ${descartadas.length} por delante: ${descartadas.slice(0, 3).map((d) => `${d.id} — ${d.motivo}`).join(' · ')})`)
        }
      }

      const texto = ENC.encargo({ trabajador: w, tarea })
      // Se manda por tmux: es la sesión interactiva que ya está corriendo. El texto va por stdin
      // (`load-buffer -`) y no como argumento, para que no aparezca en `ps` ni se rompa por comillas.
      enMaquina(w, `tmux load-buffer - && tmux paste-buffer -t ${w} && tmux send-keys -t ${w} Enter`, { entrada: texto })
      console.log(`✅ encargo enviado a ${w}: ${tarea.id} — ${String(tarea.title).slice(0, 60)}`)
      console.log(`   míralo con:  npm run flota    (o tmux attach -t ${w} en la máquina)`)
      return 0
    }

    if (cmd === 'arrancar' || cmd === 'parar') {
      const w = process.argv[3]
      if (!w) { console.error(`Uso: flota.cjs ${cmd} <trabajador>`); return 2 }
      const accion = cmd === 'arrancar' ? 'start' : 'stop'
      enMaquina(w, `systemctl ${accion} vence-flota@${w} && systemctl is-active vence-flota@${w}`)
      console.log(`✅ ${w}: ${cmd === 'arrancar' ? 'arrancado' : 'parado'}`)
      return 0
    }

    console.error('Uso: flota.cjs [estado] | encargar <w> [--tarea T-nnn] | arrancar <w> | parar <w>')
    return 2
  } finally {
    try { await sql.end({ timeout: 5 }) } catch {}
  }
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌ flota:', e.message); process.exit(1) })
