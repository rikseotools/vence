#!/usr/bin/env node
/**
 * verify-topic-scope.cjs — Herramienta del sistema de verificación de topic_scope
 * contra el epígrafe (ver docs/runbooks/verificar-epigrafes-scope.md).
 *
 * Parte DETERMINISTA del pipeline. La parte LLM (los 2 agentes independientes)
 * la corre Claude siguiendo el runbook, entre `dump` y `record`.
 *
 * Subcomandos:
 *   dump   <position_type>            → escribe el input de los agentes (epígrafe + scope + artículos con sus subsecciones + counts)
 *   record <position_type> <json>     → registra veredictos de consenso vía record_topic_verification()
 *   status <position_type>            → resumen del estado de verificación de una oposición
 *   audit  [--json]                   → cobertura global: temas que necesitan verificación (alimenta badge/guardarraíl)
 *
 * Conexión: DATABASE_URL (RDS). Carga .env.local automáticamente.
 */
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
const { classifyChange, temaVerdict, DEFAULT_IMPACT_THRESHOLD } = require('./lib/scope-classifier.cjs')

// ── Subsecciones del artículo (para el dump) ──────────────────────────────────
// El dump exponía SOLO títulos de artículo, y eso hace fallar a los agentes: marcan
// "falta el concepto X del epígrafe" porque ningún TÍTULO lo nombra, cuando el CONTENIDO
// sí lo cubre. Caso real (16/07/2026, T603/T107/T34 AGE): 4 agentes dieron ISSUES por
// "falta Operaciones de búsqueda"; el contenido la cubría en el art.2 (Ctrl+E/F3) y en el
// art.4 (sección «Búsqueda» con filtros tipo:/tamaño:/fecha:), y «Este equipo»/«Acceso
// rápido» estaban definidos en el art.3. Es exactamente el word-matching que el runbook
// prohíbe, inducido por el propio input.
//
// Se exponen los ENCABEZADOS del markdown (##/###/####): es el índice de lo que el artículo
// cubre, mucho más informativo que el título y sin inflar el dump (algunos contenedores
// pasan de 100k caracteres, volcarlos enteros no es viable).
const MAX_ARTS_DUMP = 60          // techo por ley: evita dumps inmanejables en leyes largas
const MAX_SUBSECCIONES = 12       // techo por artículo

function subsecciones(content) {
  if (!content) return ''
  const heads = []
  for (const line of String(content).split('\n')) {
    // Dos convenciones conviven en el banco editorial y hay que cazar las dos:
    //   a) encabezado markdown:  "## Restaurar sistema"
    //   b) línea entera en negrita como epígrafe:  "**Navegación:**"  (así son los arts
    //      2/3/4 del Explorador; con solo (a) salían SIN subsecciones y el agente volvía
    //      a concluir "falta búsqueda" — el mismo falso ISSUES que motiva esta función).
    const m = /^\s{0,3}#{2,4}\s+(.+?)\s*$/.exec(line)
      || /^\s{0,3}\*\*(.{2,60}?):?\*\*\s*:?\s*$/.exec(line)
    if (!m) continue
    const h = m[1].replace(/[*_`#]/g, '').replace(/\s*:$/, '').trim()
    if (h && !heads.includes(h)) heads.push(h)
    if (heads.length >= MAX_SUBSECCIONES) break
  }
  return heads.length ? ` [cubre: ${heads.join(' · ')}]` : ''
}

// ── carga .env.local ──
try {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch {}

function db() {
  const url = (process.env.DATABASE_URL || '').split('?')[0]
  if (!url) throw new Error('DATABASE_URL no configurada')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

const DUMP_DIR = process.env.VERIFY_SCOPE_DIR || '/tmp'
const dumpPath = (pt) => path.join(DUMP_DIR, `verify_scope_${pt}.json`)

// ── ordena números de artículo de forma segura (no numéricos al final) ──
function sortArtNums(nums) {
  return [...nums].sort((a, b) => {
    const x = parseInt(a), y = parseInt(b)
    if (isNaN(x) && isNaN(y)) return String(a).localeCompare(String(b))
    if (isNaN(x)) return 1
    if (isNaN(y)) return -1
    return x - y
  })
}

async function buildDump(c, pt) {
  const topics = (await c.query(
    `SELECT id, topic_number, title, epigrafe FROM topics WHERE position_type=$1 AND is_active ORDER BY topic_number`,
    [pt]
  )).rows
  if (!topics.length) throw new Error(`Sin temas activos para position_type=${pt}`)
  const out = []
  for (const t of topics) {
    const scope = (await c.query(
      `SELECT l.id law_id, l.short_name, l.name, l.scope, ts.article_numbers, ts.include_full_title
       FROM topic_scope ts JOIN laws l ON l.id=ts.law_id WHERE ts.topic_id=$1 ORDER BY l.short_name`,
      [t.id]
    )).rows
    const laws = []
    for (const s of scope) {
      const nums = s.article_numbers || []
      let arts = []
      {
        // Se exponen los artículos escopados; si el scope es NULL ("toda la ley") también,
        // porque si no el agente no ve NADA que auditar de esa ley.
        const r = (await c.query(
          nums.length
            ? `SELECT article_number, title, content FROM articles WHERE law_id=$1 AND article_number = ANY($2)`
            : `SELECT article_number, title, content FROM articles WHERE law_id=$1`,
          nums.length ? [s.law_id, nums] : [s.law_id]
        )).rows
        r.sort((a, b) => {
          const x = parseInt(a.article_number), y = parseInt(b.article_number)
          if (isNaN(x) && isNaN(y)) return 0
          if (isNaN(x)) return 1
          if (isNaN(y)) return -1
          return x - y
        })
        arts = r.slice(0, MAX_ARTS_DUMP).map(a =>
          `${a.article_number}: ${a.title || '(sin título)'}${subsecciones(a.content)}`
        )
        if (r.length > MAX_ARTS_DUMP) arts.push(`… y ${r.length - MAX_ARTS_DUMP} artículos más (truncado)`)
      }
      const qn = (await c.query(
        `SELECT count(*) n FROM questions q JOIN articles a ON a.id=q.primary_article_id
         WHERE a.law_id=$1 AND q.is_active AND ($2::text[] IS NULL OR a.article_number = ANY($2))`,
        [s.law_id, nums.length ? nums : null]
      )).rows[0].n
      const ni = nums.map(Number).filter(x => !isNaN(x)).sort((a, b) => a - b)
      const rango = nums.length
        ? (ni.length ? `${ni[0]}–${ni[ni.length - 1]} (${nums.length} arts)` : `${nums.length} arts (no num)`)
        : (s.include_full_title ? 'toda la ley' : 'NULL')
      laws.push({ ley: s.short_name, ley_nombre: s.name, ambito: s.scope, rango, arts: sortArtNums(nums.map(String)), preguntas_activas: Number(qn), articulos: arts })
    }
    out.push({ tema: t.topic_number, titulo: t.title, epigrafe: t.epigrafe, scope: laws })
  }
  return out
}

async function cmdDump(pt) {
  const c = db(); await c.connect()
  try {
    const dump = await buildDump(c, pt)
    const p = dumpPath(pt)
    fs.writeFileSync(p, JSON.stringify(dump, null, 1))
    console.log(`✅ dump: ${dump.length} temas → ${p} (${(JSON.stringify(dump).length / 1024).toFixed(0)} KB)`)
  } finally { await c.end() }
}

async function cmdRecord(pt, jsonPath, runId) {
  // consenso.json: { "<tema_number>": { "verdict": "correct"|"issues", "note": "...", "findings": {...} } }
  const consensus = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const run = runId || `verify_${pt}_${new Date().toISOString().slice(0, 10)}`
  const c = db(); await c.connect()
  try {
    const topics = (await c.query(
      `SELECT id, topic_number FROM topics WHERE position_type=$1 AND is_active`, [pt]
    )).rows
    const byN = {}; topics.forEach(t => byN[t.topic_number] = t.id)
    let ok = 0, skipped = []
    for (const [n, v] of Object.entries(consensus)) {
      const tid = byN[n]
      if (!tid) { skipped.push(n); continue }
      if (!['correct', 'issues', 'needs_human'].includes(v.verdict)) { skipped.push(`${n}(verdict inválido)`); continue }
      const findings = JSON.stringify(v.findings || { note: v.note || null })
      await c.query(`SELECT record_topic_verification($1,$2,$3::jsonb,$4,$5)`,
        [tid, v.verdict, findings, run, v.verified_by || 'multi_agent'])
      ok++
    }
    console.log(`✅ registrados ${ok} temas (run=${run})${skipped.length ? ` | saltados: ${skipped.join(', ')}` : ''}`)
    await printStatus(c, pt)
  } finally { await c.end() }
}

async function printStatus(c, pt) {
  const st = (await c.query(
    `SELECT coalesce(v.state,'never_verified') state, count(*) n
     FROM topics t LEFT JOIN topic_scope_verification v ON v.topic_id=t.id
     WHERE t.position_type=$1 AND t.is_active GROUP BY 1 ORDER BY 1`, [pt]
  )).rows
  console.log(`\n=== estado ${pt} ===`)
  st.forEach(r => console.log(`  ${r.state}: ${r.n}`))
}

async function cmdStatus(pt) {
  const c = db(); await c.connect()
  try {
    await printStatus(c, pt)
    const issues = (await c.query(
      `SELECT t.topic_number, v.state, v.findings->>'note' note
       FROM topics t JOIN topic_scope_verification v ON v.topic_id=t.id
       WHERE t.position_type=$1 AND v.state IN ('verified_issues','needs_human','stale')
       ORDER BY (v.state='needs_human') DESC, t.topic_number`, [pt]
    )).rows
    if (issues.length) {
      console.log(`\n  temas a revisar (⚠️ needs_human = DUDA, decide un humano):`)
      issues.forEach(r => console.log(`    T${r.topic_number} [${r.state}] ${r.note || ''}`))
    }
  } finally { await c.end() }
}

async function cmdAudit(asJson) {
  const c = db(); await c.connect()
  try {
    const rows = (await c.query(`
      SELECT t.position_type,
        count(*) FILTER (WHERE v.state='verified_correct') AS ok,
        count(*) FILTER (WHERE v.state='verified_issues') AS issues,
        count(*) FILTER (WHERE v.state='needs_human') AS needs_human,
        count(*) FILTER (WHERE v.state='stale') AS stale,
        count(*) FILTER (WHERE v.state IS NULL OR v.state='never_verified') AS never,
        count(*) total
      FROM topics t LEFT JOIN topic_scope_verification v ON v.topic_id=t.id
      WHERE t.is_active GROUP BY t.position_type`)).rows
    const needing = rows.map(r => ({
      position_type: r.position_type,
      ok: +r.ok, issues: +r.issues, needs_human: +r.needs_human, stale: +r.stale, never: +r.never, total: +r.total,
      pendientes: +r.issues + +r.needs_human + +r.stale + +r.never,
    })).sort((a, b) => (b.needs_human - a.needs_human) || (b.pendientes - a.pendientes))
    const totalPend = needing.reduce((a, r) => a + r.pendientes, 0)
    if (asJson) {
      console.log(JSON.stringify({ total_pendientes: totalPend, oposiciones: needing }, null, 1))
    } else {
      console.log(`=== cobertura de verificación (badge = ${totalPend} temas pendientes) ===`)
      for (const r of needing) {
        if (r.pendientes === 0) continue
        console.log(`  ${r.position_type}: ✅${r.ok}${r.needs_human ? ` 🚨needs_human:${r.needs_human}` : ''} ⚠️issues:${r.issues} 🟡stale:${r.stale} ⬜never:${r.never} / ${r.total}`)
      }
      console.log(`\n  oposiciones 100% verified_correct: ${needing.filter(r => r.pendientes === 0).length}/${needing.length}`)
    }
  } finally { await c.end() }
}

// GUARDARRAÍL (gate CI): detecta incoherencias que sólo pueden existir si un
// trigger de invalidación NO disparó — un tema marcado verificado cuyo hash actual
// ya no coincide con el verificado (debería estar 'stale'). Exit 1 si hay alguna.
async function cmdGate() {
  const c = db(); await c.connect()
  try {
    const s1 = (await c.query(`
      SELECT count(*)::int n FROM topic_scope_verification v
      WHERE v.state IN ('verified_correct','verified_issues')
        AND v.verified_scope_hash IS DISTINCT FROM compute_topic_scope_hash(v.topic_id)`)).rows[0].n
    const s2 = (await c.query(`
      SELECT count(*)::int n FROM topic_epigrafe_verification v JOIN topics t ON t.id=v.topic_id
      WHERE v.state IN ('verified_literal','drift_detected','provisional_anterior')
        AND v.verified_epigrafe_hash IS DISTINCT FROM md5(coalesce(t.epigrafe,''))`)).rows[0].n
    if (s1 === 0 && s2 === 0) {
      console.log('✅ GATE OK — sin incoherencias (todos los verificados cuadran con su hash actual)')
    } else {
      console.error(`❌ GATE FALLÓ — S1 incoherentes: ${s1}, S2 incoherentes: ${s2} (el trigger de invalidación no disparó — deberían estar 'stale')`)
      process.exit(1)
    }
  } finally { await c.end() }
}

// ───────────────────────────────────────────────────────────────────────────
// PIPELINE semi-autónomo (13/07): plan → apply. La parte LLM (2 agentes+juez) la
// corre Claude con el workflow `verify-scope-oposicion` entre `dump` y `plan`.
//
//   plan  <pt> <propuestas.json> [--impact-threshold N]
//         enriquece cada cambio (valida delta contra el scope real, mide impacto
//         en preguntas) + clasifica (auto_safe vs judgment_gate, clasificador PURO
//         testeado) → escribe verify_scope_plan_<pt>.json + tabla legible.
//   apply <pt> [plan.json] [--dry-run] [--include-gate]
//         aplica los auto_safe (o +gate con --include-gate) en TRANSACCIÓN +
//         recache (MV + purga rutas + revalidate-temario) + record — todo horneado,
//         imposible olvidar un paso. --dry-run enseña el antes/después sin tocar.

const planPath = (pt) => path.join(DUMP_DIR, `verify_scope_plan_${pt}.json`)

// normaliza la salida del workflow (array de {tema,title,veredicto:[{ley,quitar,anadir,razon}]}
// o {result:{detalle:[...]}}) a: cambios planos + lista de todos los temas vistos.
function flattenProposals(proposals) {
  const arr = Array.isArray(proposals)
    ? proposals
    : (proposals.detalle || (proposals.result && proposals.result.detalle) || [])
  const changes = []
  const temas = new Set()
  for (const d of arr) {
    temas.add(d.tema)
    for (const l of (d.veredicto || [])) {
      const quitar = (l.quitar || []).map(String)
      const anadir = (l.anadir || []).map(String)
      if (!quitar.length && !anadir.length) continue
      changes.push({ tema: d.tema, title: d.title || '', ley: l.ley, quitar, anadir, razon: l.razon || '' })
    }
  }
  return { changes, temas: [...temas] }
}

async function enrichChange(c, pt, ch) {
  const tRow = (await c.query(
    `SELECT t.id, t.epigrafe, (SELECT count(*) FROM topic_scope ts WHERE ts.topic_id=t.id) laws
     FROM topics t WHERE t.position_type=$1 AND t.topic_number=$2 AND t.is_active`, [pt, ch.tema])).rows[0]
  if (!tRow) return { ...ch, error: 'tema no encontrado' }
  const sRow = (await c.query(
    `SELECT l.id law_id, l.name ley_nombre, ts.id scope_id, ts.article_numbers arts
     FROM topic_scope ts JOIN laws l ON l.id=ts.law_id WHERE ts.topic_id=$1 AND l.short_name=$2`,
    [tRow.id, ch.ley])).rows[0]
  if (!sRow) return { ...ch, error: `ley "${ch.ley}" no está en el scope del tema ${ch.tema}` }
  const cur = (sRow.arts || []).map(String)
  const curSet = new Set(cur)
  const quitarPresent = ch.quitar.filter((a) => curSet.has(a)).length
  const anadirAbsent = ch.anadir.filter((a) => !curSet.has(a)).length
  const deltaValid = quitarPresent === ch.quitar.length && anadirAbsent === ch.anadir.length
  const remaining = cur.filter((a) => !ch.quitar.includes(a))
  const emptiesLaw = cur.length > 0 && remaining.length === 0
  let impacto = 0
  if (ch.quitar.length) {
    impacto = Number((await c.query(
      `SELECT count(DISTINCT q.id) n FROM questions q JOIN articles a ON a.id=q.primary_article_id
       WHERE a.law_id=$1 AND a.article_number = ANY($2) AND q.is_active`, [sRow.law_id, ch.quitar])).rows[0].n)
  }
  return {
    ...ch, topic_id: tRow.id, epigrafe: tRow.epigrafe, lawsInTema: Number(tRow.laws),
    leyNombre: sRow.ley_nombre, scope_id: sRow.scope_id, currentCount: cur.length,
    quitarPresent, anadirAbsent, deltaValid, emptiesLaw, impacto, _current: cur,
  }
}

async function cmdPlan(pt, jsonPath, threshold) {
  const proposals = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const { changes, temas } = flattenProposals(proposals)
  const c = db(); await c.connect()
  try {
    const results = []
    for (const ch of changes) {
      const e = await enrichChange(c, pt, ch)
      const cls = e.error ? { category: 'judgment_gate', flags: ['error:' + e.error] }
        : classifyChange(e, { impactThreshold: threshold })
      results.push({ ...e, category: cls.category, flags: cls.flags })
    }
    // veredicto por tema: un tema es 'correct' solo si NINGÚN cambio suyo va a la puerta
    const byTema = {}
    results.forEach((r) => { (byTema[r.tema] = byTema[r.tema] || []).push(r) })
    const temaVerdicts = {}
    for (const t of temas) {
      temaVerdicts[t] = byTema[t] ? temaVerdict(byTema[t]) : 'correct' // sin cambios = correct
    }
    const plan = { pt, threshold: threshold != null ? threshold : DEFAULT_IMPACT_THRESHOLD, generatedAt: null, changes: results, temaVerdicts, temas }
    fs.writeFileSync(planPath(pt), JSON.stringify(plan, null, 1))
    // tabla legible
    const auto = results.filter((r) => r.category === 'auto_safe')
    const gate = results.filter((r) => r.category === 'judgment_gate')
    console.log(`\n=== PLAN scope ${pt} (umbral impacto=${plan.threshold}) ===`)
    console.log(`temas: ${temas.length} | cambios: ${results.length} → ✅ auto_safe ${auto.length} · 🚪 puerta ${gate.length}\n`)
    const line = (r) => `  T${r.tema} [${r.ley}] q${r.quitar.length}/a${r.anadir.length} · ${r.impacto} preg · ${r.flags.join(',') || 'limpio'}${r.deltaValid === false ? ' ⚠️DELTA-INVÁLIDO' : ''}`
    if (auto.length) { console.log('✅ AUTO-SEGURO (se aplican con apply):'); auto.forEach((r) => console.log(line(r))) }
    if (gate.length) { console.log('\n🚪 PUERTA DE JUICIO (NO se aplican sin --include-gate + criterio humano):'); gate.forEach((r) => console.log(line(r))) }
    console.log(`\n→ plan: ${planPath(pt)}`)
    console.log(`→ aplica auto-seguros:  node scripts/verify-topic-scope.cjs apply ${pt} --dry-run   (y sin --dry-run)`)
  } finally { await c.end() }
}

async function recache(pt, temas) {
  const results = { mv: false, purged: 0, temario: false }
  const c = db(); await c.connect()
  try {
    await c.query('REFRESH MATERIALIZED VIEW CONCURRENTLY topic_law_question_summary')
    results.mv = true
  } catch (e) {
    try { await c.query('REFRESH MATERIALIZED VIEW topic_law_question_summary'); results.mv = true }
    catch (e2) { console.error('   ⚠️ MV refresh falló:', e2.message) }
  } finally { await c.end() }
  const slug = pt.replace(/_/g, '-')
  const cron = process.env.CRON_SECRET
  if (cron && typeof fetch === 'function') {
    for (const t of temas) {
      try {
        const r = await fetch('https://www.vence.es/api/purge-cache', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': cron },
          body: JSON.stringify({ path: `/${slug}/temario/tema-${t}` }),
        })
        if (r.ok) results.purged++
      } catch {}
    }
  }
  // revalidate-temario (tag amplio) — best effort con token admin
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient } = require('@supabase/supabase-js')
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'manueltrader@gmail.com' })
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      const { data: v } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
      const r = await fetch('https://www.vence.es/api/admin/revalidate-temario', { method: 'POST', headers: { Authorization: 'Bearer ' + v.session.access_token } })
      results.temario = r.ok
    }
  } catch (e) { console.error('   ⚠️ revalidate-temario falló (no crítico):', e.message) }
  return results
}

async function cmdApply(pt, jsonPath, opts) {
  const plan = JSON.parse(fs.readFileSync(jsonPath || planPath(pt), 'utf8'))
  const toApply = plan.changes.filter((ch) => ch.category === 'auto_safe' || (opts.includeGate && ch.category === 'judgment_gate'))
  const bad = toApply.filter((ch) => ch.error || ch.deltaValid === false)
  if (bad.length) throw new Error(`abort: ${bad.length} cambio(s) con delta inválido/error — revisa: ${bad.map((b) => `T${b.tema}/${b.ley}`).join(', ')}`)
  if (!toApply.length) { console.log('nada que aplicar'); return }

  // computar antes/después
  const compute = (ch) => {
    let next = ch._current.filter((a) => !ch.quitar.includes(String(a)))
    for (const a of ch.anadir) if (!next.includes(String(a))) next.push(String(a))
    return sortArtNums(next)
  }
  console.log(`\n=== APPLY scope ${pt} ${opts.dryRun ? '(DRY-RUN)' : ''} — ${toApply.length} cambios${opts.includeGate ? ' (incluye PUERTA)' : ' (solo auto_safe)'} ===`)
  toApply.forEach((ch) => console.log(`  T${ch.tema} [${ch.ley}] ${ch._current.length} → ${compute(ch).length} arts (q${ch.quitar.length}/a${ch.anadir.length}, ${ch.impacto} preg)`))
  if (opts.dryRun) { console.log('\n(dry-run: nada escrito)'); return }

  const c = db(); await c.connect()
  try {
    await c.query('BEGIN')
    for (const ch of toApply) await c.query('UPDATE topic_scope SET article_numbers=$1 WHERE id=$2', [compute(ch), ch.scope_id])
    await c.query('COMMIT')
    console.log('✅ COMMIT topic_scope')
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); await c.end(); throw e }
  await c.end()

  const temas = [...new Set(toApply.map((ch) => ch.tema))]
  console.log('→ recache…')
  const rc = await recache(pt, temas)
  console.log(`   MV:${rc.mv ? '✅' : '❌'} · rutas purgadas:${rc.purged}/${temas.length} · revalidate-temario:${rc.temario ? '✅' : '—'}`)

  // record: cada tema tocado con su veredicto (correct si todos sus cambios se aplicaron; issues si queda puerta pendiente)
  const c2 = db(); await c2.connect()
  try {
    const run = `verify_${pt}_${new Date().toISOString().slice(0, 10)}`
    const topics = (await c2.query(`SELECT id, topic_number FROM topics WHERE position_type=$1 AND is_active`, [pt])).rows
    const byN = {}; topics.forEach((t) => byN[t.topic_number] = t.id)
    let rec = 0
    for (const t of temas) {
      const tid = byN[t]; if (!tid) continue
      // si aplicamos solo auto_safe y el tema tenía puerta, queda 'issues'
      const verdict = opts.includeGate ? 'correct' : plan.temaVerdicts[String(t)] || plan.temaVerdicts[t] || 'correct'
      const note = `pipeline verify:scope apply ${new Date().toISOString().slice(0, 10)}`
      await c2.query(`SELECT record_topic_verification($1,$2,$3::jsonb,$4,$5)`, [tid, verdict, JSON.stringify({ note }), run, 'pipeline'])
      rec++
    }
    console.log(`✅ record: ${rec} temas`)
    await printStatus(c2, pt)
  } finally { await c2.end() }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2)
  const flag = (name) => args.includes(name)
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const positional = args.filter((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--impact-threshold')
  try {
    if (cmd === 'dump') await cmdDump(args[0])
    else if (cmd === 'record') await cmdRecord(args[0], args[1], args[2])
    else if (cmd === 'status') await cmdStatus(args[0])
    else if (cmd === 'audit') await cmdAudit(args.includes('--json'))
    else if (cmd === 'gate') await cmdGate()
    else if (cmd === 'plan') {
      const th = opt('--impact-threshold')
      await cmdPlan(positional[0], positional[1], th != null ? Number(th) : undefined)
    } else if (cmd === 'apply') {
      await cmdApply(positional[0], positional[1], { dryRun: flag('--dry-run'), includeGate: flag('--include-gate') })
    } else {
      console.log('Uso: node scripts/verify-topic-scope.cjs <dump|plan|apply|record|status|audit|gate> ...')
      process.exit(1)
    }
  } catch (e) {
    console.error('❌', e.message)
    process.exit(1)
  }
}

// Requerido como módulo (tests) → exporta los helpers puros y NO ejecuta el CLI.
if (require.main !== module) {
  module.exports = { subsecciones, MAX_ARTS_DUMP, MAX_SUBSECCIONES }
} else {
  main()
}
