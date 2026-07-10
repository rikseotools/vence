#!/usr/bin/env node
/**
 * verify-topic-scope.cjs — Herramienta del sistema de verificación de topic_scope
 * contra el epígrafe (ver docs/runbooks/verificar-epigrafes-scope.md).
 *
 * Parte DETERMINISTA del pipeline. La parte LLM (los 2 agentes independientes)
 * la corre Claude siguiendo el runbook, entre `dump` y `record`.
 *
 * Subcomandos:
 *   dump   <position_type>            → escribe el input de los agentes (epígrafe + scope + títulos + counts)
 *   record <position_type> <json>     → registra veredictos de consenso vía record_topic_verification()
 *   status <position_type>            → resumen del estado de verificación de una oposición
 *   audit  [--json]                   → cobertura global: temas que necesitan verificación (alimenta badge/guardarraíl)
 *
 * Conexión: DATABASE_URL (RDS). Carga .env.local automáticamente.
 */
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

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
      `SELECT l.id law_id, l.short_name, l.scope, ts.article_numbers, ts.include_full_title
       FROM topic_scope ts JOIN laws l ON l.id=ts.law_id WHERE ts.topic_id=$1 ORDER BY l.short_name`,
      [t.id]
    )).rows
    const laws = []
    for (const s of scope) {
      const nums = s.article_numbers || []
      let arts = []
      if (nums.length) {
        const r = (await c.query(
          `SELECT article_number, title FROM articles WHERE law_id=$1 AND article_number = ANY($2)`,
          [s.law_id, nums]
        )).rows
        r.sort((a, b) => {
          const x = parseInt(a.article_number), y = parseInt(b.article_number)
          if (isNaN(x) && isNaN(y)) return 0
          if (isNaN(x)) return 1
          if (isNaN(y)) return -1
          return x - y
        })
        arts = r.map(a => `${a.article_number}: ${a.title || '(sin título)'}`)
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
      laws.push({ ley: s.short_name, ambito: s.scope, rango, preguntas_activas: Number(qn), articulos: arts })
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

async function main() {
  const [cmd, ...args] = process.argv.slice(2)
  try {
    if (cmd === 'dump') await cmdDump(args[0])
    else if (cmd === 'record') await cmdRecord(args[0], args[1], args[2])
    else if (cmd === 'status') await cmdStatus(args[0])
    else if (cmd === 'audit') await cmdAudit(args.includes('--json'))
    else if (cmd === 'gate') await cmdGate()
    else {
      console.log('Uso: node scripts/verify-topic-scope.cjs <dump|record|status|audit|gate> ...')
      process.exit(1)
    }
  } catch (e) {
    console.error('❌', e.message)
    process.exit(1)
  }
}
main()
