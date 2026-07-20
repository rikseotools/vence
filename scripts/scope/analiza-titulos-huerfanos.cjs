#!/usr/bin/env node
/**
 * ANÁLISIS a fondo del backlog `scope_titulo_huerfano` (tarea #3 del backlog).
 *
 * Reproduce el prefiltro determinista de scripts/health-sweep.cjs (mismo criterio,
 * ver §"TÍTULOS HUÉRFANOS") y lo ENRIQUECE para poder priorizar el drenaje:
 *   · demanda real de la oposición (usuarios + premium con ese target)
 *   · si la oposición está publicada/vendible (is_active)
 *   · clustering por (ley, título) → detecta huecos SISTÉMICOS (misma ley+título
 *     huérfano en N oposiciones = un solo criterio a decidir, no N)
 *   · tamaño del hueco (preguntas huérfanas) y % sobre el banco de la ley
 *
 * Criterio (idéntico al sweep): título de una ley con >= SCOPE_GAP_MIN_Q preguntas
 * activas, CERO artículos suyos escopados en esa oposición, y flanqueado a ambos
 * lados por artículos escopados de la misma ley (hueco INTERNO, no recorte de borde).
 *
 * Es un UPPER BOUND: hay falsos positivos legítimos (títulos que el programa no
 * pide). La adjudicación final es del pipeline verify:scope (epígrafe↔scope).
 *
 * Uso: node scripts/scope/analiza-titulos-huerfanos.cjs [--json <salida>]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const fs = require('fs')

const MIN_Q = Number(process.env.SCOPE_GAP_MIN_Q || 8)
const jsonIdx = process.argv.indexOf('--json')
const JSON_OUT = jsonIdx > -1 ? process.argv[jsonIdx + 1] : null

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const c = newClient()
  await c.connect()
  try {
    console.log('→ cargando secciones, scope, banco y demanda…')

    const titSecs = (await c.query(`
      SELECT ls.law_id, l.short_name, ls.section_number, ls.title AS sec_title,
             ls.article_range_start lo, ls.article_range_end hi
      FROM law_sections ls JOIN laws l ON l.id = ls.law_id
      WHERE ls.section_type='titulo' AND ls.article_range_start IS NOT NULL
        AND ls.article_range_end IS NOT NULL`)).rows

    const scopeAll = (await c.query(`
      SELECT t.position_type pt, ts.law_id, ts.article_numbers
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
      WHERE ts.article_numbers IS NOT NULL AND t.is_active`)).rows

    const qAll = (await c.query(`
      SELECT a.law_id, a.article_number an, count(DISTINCT q.id)::int n
      FROM questions q JOIN articles a ON a.id = q.primary_article_id
      WHERE q.is_active AND a.article_number ~ '^[0-9]+$'
      GROUP BY a.law_id, a.article_number`)).rows

    // demanda por oposición
    const demand = new Map()
    for (const r of (await c.query(`
      SELECT target_oposicion pt, count(*)::int n,
             count(*) FILTER (WHERE plan_type='premium')::int prem
      FROM user_profiles WHERE target_oposicion IS NOT NULL GROUP BY 1`)).rows) {
      demand.set(r.pt, { users: r.n, prem: r.prem })
    }

    // oposiciones publicadas
    const live = new Map()
    for (const r of (await c.query(`SELECT slug, is_active FROM oposiciones`)).rows) {
      live.set(r.slug.replace(/-/g, '_'), r.is_active)
    }

    // ── mismo algoritmo que el sweep ──
    const scopedByPtLaw = new Map()
    for (const r of scopeAll) {
      const k = r.pt + '|' + r.law_id
      let set = scopedByPtLaw.get(k); if (!set) scopedByPtLaw.set(k, set = new Set())
      for (const a of (r.article_numbers || [])) { const n = parseInt(a); if (!isNaN(n) && n > 0) set.add(n) }
    }
    const qByLawArt = new Map()
    for (const r of qAll) qByLawArt.set(r.law_id + '|' + parseInt(r.an), r.n)
    const qByLaw = new Map()
    for (const r of qAll) qByLaw.set(r.law_id, (qByLaw.get(r.law_id) || 0) + r.n)
    const secsByLaw = new Map()
    for (const sc of titSecs) { let a = secsByLaw.get(sc.law_id); if (!a) secsByLaw.set(sc.law_id, a = []); a.push(sc) }

    const gaps = []
    for (const [k, scoped] of scopedByPtLaw) {
      if (!scoped.size) continue
      const bar = k.lastIndexOf('|'); const pt = k.slice(0, bar); const lawId = k.slice(bar + 1)
      const secs = secsByLaw.get(lawId); if (!secs) continue
      const smin = Math.min(...scoped), smax = Math.max(...scoped)
      for (const sc of secs) {
        let q = 0, anyScoped = false
        for (let i = sc.lo; i <= sc.hi; i++) {
          q += (qByLawArt.get(lawId + '|' + i) || 0)
          if (scoped.has(i)) anyScoped = true
        }
        if (q >= MIN_Q && !anyScoped && smin < sc.lo && smax > sc.hi) {
          const d = demand.get(pt) || { users: 0, prem: 0 }
          gaps.push({
            pt, ley: sc.short_name, law_id: lawId,
            titulo: sc.section_number, sec_title: sc.sec_title,
            rango: `${sc.lo}-${sc.hi}`, preguntas: q,
            banco_ley: qByLaw.get(lawId) || 0,
            users: d.users, prem: d.prem,
            publicada: live.get(pt) !== false,
          })
        }
      }
    }
    gaps.sort((a, b) => b.preguntas - a.preguntas)

    const nOpos = new Set(gaps.map(g => g.pt)).size
    console.log(`\n========== ${gaps.length} títulos huérfanos en ${nOpos} oposiciones (min ${MIN_Q} preg) ==========`)

    // ── 1. Impacto: preguntas huérfanas totales y por demanda ──
    const totalQ = gaps.reduce((s, g) => s + g.preguntas, 0)
    const conDemanda = gaps.filter(g => g.users > 0)
    console.log(`\nPreguntas huérfanas (suma, con duplicidad entre oposiciones): ${totalQ}`)
    console.log(`Títulos en oposiciones CON usuarios: ${conDemanda.length}/${gaps.length}`)
    console.log(`Títulos en oposiciones SIN usuarios: ${gaps.length - conDemanda.length} (drenar al final)`)

    // ── 2. Clusters sistémicos: misma (ley,título) en N oposiciones ──
    const byLawTit = new Map()
    for (const g of gaps) {
      const k = `${g.ley} § Tít. ${g.titulo} (${g.rango})`
      let e = byLawTit.get(k)
      if (!e) byLawTit.set(k, e = { k, sec_title: g.sec_title, opos: [], preguntas: g.preguntas, users: 0, prem: 0 })
      e.opos.push(g.pt); e.users += g.users; e.prem += g.prem
    }
    const clusters = [...byLawTit.values()].sort((a, b) =>
      (b.opos.length * b.preguntas) - (a.opos.length * a.preguntas))
    console.log(`\n---------- CLUSTERS (misma ley+título huérfano en N oposiciones) ----------`)
    console.log(`${clusters.length} criterios únicos a decidir (vs ${gaps.length} filas) → ${(gaps.length / clusters.length).toFixed(1)}x de apalancamiento\n`)
    clusters.slice(0, 25).forEach((cl, i) => {
      console.log(`${String(i + 1).padStart(2)}. ${cl.k}`)
      console.log(`    "${(cl.sec_title || '').slice(0, 80)}"`)
      console.log(`    ${cl.preguntas} preg × ${cl.opos.length} oposición(es) · ${cl.users} usuarios · ${cl.prem} premium`)
    })

    // ── 3. Top por demanda (usuarios afectados) ──
    console.log(`\n---------- TOP 25 por DEMANDA (usuarios que lo sufren) ----------`)
    const byDemand = [...gaps].sort((a, b) => (b.users - a.users) || (b.preguntas - a.preguntas))
    byDemand.slice(0, 25).forEach((g, i) => {
      console.log(`${String(i + 1).padStart(2)}. ${g.pt} · ${g.ley} Tít.${g.titulo} (${g.rango}) · ${g.preguntas} preg · ${g.users} usr/${g.prem} prem${g.publicada ? '' : ' [NO publicada]'}`)
    })

    // ── 4. Oposiciones con más títulos huérfanos ──
    const byPt = new Map()
    for (const g of gaps) {
      let e = byPt.get(g.pt)
      if (!e) byPt.set(g.pt, e = { pt: g.pt, n: 0, preguntas: 0, users: g.users, prem: g.prem })
      e.n++; e.preguntas += g.preguntas
    }
    const opos = [...byPt.values()].sort((a, b) => (b.users - a.users) || (b.preguntas - a.preguntas))
    console.log(`\n---------- OPOSICIONES por demanda (candidatas a pasada verify:scope) ----------`)
    opos.slice(0, 25).forEach((o, i) => {
      console.log(`${String(i + 1).padStart(2)}. ${o.pt.padEnd(46)} ${String(o.n).padStart(3)} títulos · ${String(o.preguntas).padStart(5)} preg · ${String(o.users).padStart(4)} usr / ${o.prem} prem`)
    })
    console.log(`\nOposiciones SIN usuarios con huérfanos: ${opos.filter(o => !o.users).length}`)

    if (JSON_OUT) {
      fs.writeFileSync(JSON_OUT, JSON.stringify({ gaps, clusters, opos }, null, 1))
      console.log(`\n✅ JSON → ${JSON_OUT}`)
    }
  } finally { await c.end() }
}
main().catch(e => { console.error('❌', e.message); process.exitCode = 1 })
