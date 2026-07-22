#!/usr/bin/env node
/**
 * Clasificador de SALUD de topic_scope por oposición (complementa a
 * scope-over-inclusion.cjs).
 *
 * Motivación (campaña verify:scope 21-22/07, ~53 oposiciones a mano):
 *   Al verificar oposiciones enteras aparecieron 3 patrones recurrentes que
 *   ningún detector cazaba y que hacían la verificación manual lenta:
 *     1. DUPLICADO cross-tema: la MISMA ley/contenedor escopada ENTERA (o con
 *        solape grande) en ≥2 temas (p.ej. Estatuto de Canarias entero en 9
 *        temas; EBEP entero en T6+T20 de CLM; contenedores clínicos en TCAE).
 *        → las mismas preguntas salen en varios tests; hay que REPARTIR por
 *        materia. (over-inclusion mira 1 tema vs su epígrafe; esto mira ENTRE
 *        temas.)
 *     2. TEMAS VACÍOS: temas activos con 0 filas de topic_scope → la oposición
 *        está MEDIO CONSTRUIDA (baleares 8, policia_municipal_madrid 29). Eso
 *        NO es verify, es BUILD (crear-nueva-oposicion).
 *     3. CONTENEDOR clínico compartido: contenedores de contenido (Movilización,
 *        Higiene, Infecciones...) con article_numbers=NULL compartidos por temas
 *        hermanos → normalmente legítimos (no partibles por artículo), NO son
 *        defecto de ley.
 *
 * GOTCHA cazado: article_numbers=NULL = LEY/CONTENEDOR ENTERO. Un check de
 * solape por rango numérico da "limpio" en falso (NULL no tiene arts que
 * comparar). Aquí NULL-compartido cuenta como duplicado.
 *
 * Heurística ley-real vs contenedor: nombre que empieza por token normativo
 * (Ley|LO|RD|RDL|CE|Real|Decreto|Estatut(o)?|Llei|TR...|Convenio|Reglamento|
 * Constitución) = LEY REAL (dup = REPARTO). Si no, = contenedor de contenido
 * (dup = revisar, casi siempre legítimo).
 *
 * Buckets por oposición (prioridad de trabajo):
 *   BUILD      → tiene temas vacíos (construir contenido, no verificar)
 *   REPARTO    → ≥1 ley REAL duplicada entre temas (defecto real, repartir)
 *   CLINICO    → solo contenedores compartidos (revisar; suele ser legítimo)
 *   LIMPIA     → sin vacíos ni duplicados (verify directo o ya correcto)
 *
 * Uso:
 *   node scripts/scope-health-classify.cjs            # tabla humana, orden por usuarios
 *   node scripts/scope-health-classify.cjs --json     # JSON para pipelines
 *   node scripts/scope-health-classify.cjs --pending  # solo oposiciones con temas sin verificar
 *   node scripts/scope-health-classify.cjs --simulate  # casos sintéticos (ground truth, sin BD)
 *
 * Read-only. No escribe nada.
 */

// ── NÚCLEO PURO (testeable sin BD, SIN dependencias) ──────────────────────────
// Nombres de norma TÍTULO-CASE (case-insensitive: "Ley"/"ley", "Decreto"…).
const LEY_TITLE_RE = /^(Ley|Real|Decreto|Estatut|Llei|Convenio|Reglament|Constituci|Carta|Tratado)/i
// SIGLAS en MAYÚSCULAS (case-SENSITIVE): distingue "TR…"(TRLGSS)/"CE"(Constitución) de
// contenedores título-case como "Trabajo…"/"Celador…" que antes colaban por el flag /i.
const LEY_SIGLA_RE = /^(LO|RD|RDL|CE|TR|TRLGSS|LGS|LOSU|LOTC|LOREG|LECrim|LOGP|TUE|TFUE|RGPD)/

function isRealLaw(shortName) {
  const s = (shortName || '').trim()
  return LEY_TITLE_RE.test(s) || LEY_SIGLA_RE.test(s)
}

/** normaliza article_numbers a Set de enteros; nulish=true si NULL/vacío (=ley entera) */
function toArts(an) {
  const arr = Array.isArray(an) ? an : []
  const nums = arr.map((x) => parseInt(String(x).replace(/[^0-9]/g, ''), 10)).filter((n) => !isNaN(n))
  return { set: new Set(nums), nulish: arr.length === 0 }
}

/**
 * Clasifica una ley compartida por varios temas.
 * rows: [{ tn, an }]  →  { kind: 'nulldup'|'overlap'|'clean', detail }
 * OVERLAP_MIN: nº de arts compartidos a partir del cual se considera duplicado
 * (1-2 = artefacto de frontera / cross-cutting legítimo; >OVERLAP_MIN = dup real).
 */
function classifySharedLaw(rows, OVERLAP_MIN = 2) {
  const arrs = rows.map((r) => ({ tn: r.tn, ...toArts(r.an) }))
  const nulishCount = arrs.filter((a) => a.nulish).length
  if (nulishCount > 1) return { kind: 'nulldup', detail: arrs.filter((a) => a.nulish).map((a) => 'T' + a.tn) }
  const overlaps = []
  for (let i = 0; i < arrs.length; i++)
    for (let j = i + 1; j < arrs.length; j++) {
      let c = 0
      for (const n of arrs[i].set) if (arrs[j].set.has(n)) c++
      if (c > OVERLAP_MIN) overlaps.push('T' + arrs[i].tn + '∩T' + arrs[j].tn + '=' + c)
    }
  return overlaps.length ? { kind: 'overlap', detail: overlaps } : { kind: 'clean', detail: [] }
}

/** decide el bucket de una oposición a partir de sus señales */
function classifyOposicion({ emptyTopics, sharedLaws }) {
  if (emptyTopics > 0) return 'BUILD'
  const realDup = sharedLaws.filter((s) => s.isReal && s.kind !== 'clean')
  if (realDup.length) return 'REPARTO'
  const contDup = sharedLaws.filter((s) => !s.isReal && s.kind !== 'clean')
  if (contDup.length) return 'CLINICO'
  return 'LIMPIA'
}

// ── SIMULACIÓN (ground truth, sin BD) ─────────────────────────────────────────
function simulate() {
  const cases = [
    { name: 'Estatuto entero en 2 temas (NULL)', rows: [{ tn: 9, an: [] }, { tn: 10, an: [] }], real: true, expect: 'nulldup' },
    { name: 'EBEP solape grande', rows: [{ tn: 6, an: ['1', '2', '3', '4', '5'] }, { tn: 20, an: ['1', '2', '3', '4', '5'] }], real: true, expect: 'overlap' },
    { name: 'Ley 39/2015 split limpio', rows: [{ tn: 3, an: ['1', '2', '3'] }, { tn: 4, an: ['34', '35'] }], real: true, expect: 'clean' },
    { name: 'cross-cutting 1 art (legítimo)', rows: [{ tn: 1, an: ['13', '14'] }, { tn: 10, an: ['1', '13'] }], real: true, expect: 'clean' },
    { name: 'contenedor clínico NULL compartido', rows: [{ tn: 16, an: [] }, { tn: 18, an: [] }], real: false, expect: 'nulldup' },
  ]
  let pass = 0
  for (const c of cases) {
    const got = classifySharedLaw(c.rows).kind
    const ok = got === c.expect
    if (ok) pass++
    console.log(`  ${ok ? '✅' : '❌'} ${c.name}: ${got} (esperado ${c.expect})`)
  }
  console.log(`\n${pass}/${cases.length} casos ok`)
  // buckets
  const b = [
    { in: { emptyTopics: 3, sharedLaws: [] }, exp: 'BUILD' },
    { in: { emptyTopics: 0, sharedLaws: [{ isReal: true, kind: 'nulldup' }] }, exp: 'REPARTO' },
    { in: { emptyTopics: 0, sharedLaws: [{ isReal: false, kind: 'nulldup' }] }, exp: 'CLINICO' },
    { in: { emptyTopics: 0, sharedLaws: [{ isReal: true, kind: 'clean' }] }, exp: 'LIMPIA' },
  ]
  let bp = 0
  for (const t of b) { const g = classifyOposicion(t.in); if (g === t.exp) bp++; console.log(`  ${g === t.exp ? '✅' : '❌'} bucket ${g} (esperado ${t.exp})`) }
  console.log(`${bp}/${b.length} buckets ok`)
  process.exit(pass === cases.length && bp === b.length ? 0 : 1)
}

// ── SCAN contra RDS (read-only) ───────────────────────────────────────────────
async function scan({ json, pendingOnly }) {
  require('dotenv').config({ path: '.env.local' })
  const postgres = require('postgres')
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })
  try {
    const users = await sql`SELECT target_oposicion pt, count(*)::int u FROM user_profiles WHERE target_oposicion IS NOT NULL GROUP BY 1`
    const umap = {}; users.forEach((r) => (umap[r.pt] = r.u))

    const positions = await sql`SELECT DISTINCT position_type pt FROM topics WHERE is_active=true`
    const results = []
    for (const { pt } of positions) {
      const [{ total }] = await sql`SELECT count(*)::int total FROM topics WHERE position_type=${pt} AND is_active=true`
      const [{ ver }] = await sql`SELECT count(*)::int ver FROM topics t JOIN topic_scope_verification v ON v.topic_id=t.id WHERE t.position_type=${pt} AND t.is_active=true AND v.state IN ('verified_correct','verified_issues')`
      if (pendingOnly && ver >= total) continue
      const [{ empty }] = await sql`SELECT count(*)::int empty FROM topics t WHERE t.position_type=${pt} AND t.is_active=true AND NOT EXISTS (SELECT 1 FROM topic_scope ts WHERE ts.topic_id=t.id)`
      const shared = await sql`SELECT l.short_name nm, l.id FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id JOIN laws l ON l.id=ts.law_id WHERE t.position_type=${pt} AND t.is_active=true GROUP BY l.short_name,l.id HAVING count(DISTINCT t.topic_number)>1`
      const sharedLaws = []
      for (const s of shared) {
        const rows = await sql`SELECT t.topic_number tn, ts.article_numbers an FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id WHERE t.position_type=${pt} AND ts.law_id=${s.id} ORDER BY (t.topic_number)::int`
        const cls = classifySharedLaw(rows.map((r) => ({ tn: r.tn, an: r.an })))
        sharedLaws.push({ nm: s.nm, isReal: isRealLaw(s.nm), kind: cls.kind, detail: cls.detail })
      }
      const bucket = classifyOposicion({ emptyTopics: empty, sharedLaws })
      const realDups = sharedLaws.filter((s) => s.isReal && s.kind !== 'clean')
      results.push({ pt, users: umap[pt] || 0, total, ver, empty, bucket, realDups: realDups.map((s) => `${s.nm}(${s.kind})`), sharedLawCount: shared.length })
    }
    results.sort((a, b) => b.users - a.users || (b.total - b.ver) - (a.total - a.ver))

    if (json) { console.log(JSON.stringify(results, null, 2)); await sql.end(); return }

    const byBucket = {}; results.forEach((r) => { byBucket[r.bucket] = (byBucket[r.bucket] || 0) + 1 })
    console.log('=== SALUD DE topic_scope por oposición (orden: usuarios) ===\n')
    console.log('BUCKET    USR  VERIF/TOTAL  OPOSICIÓN                                  DETALLE')
    for (const r of results) {
      const detail = r.bucket === 'BUILD' ? `${r.empty} temas vacíos` : r.bucket === 'REPARTO' ? r.realDups.join(', ').slice(0, 60) : r.bucket === 'CLINICO' ? `${r.sharedLawCount} contenedores compartidos` : ''
      console.log(`${r.bucket.padEnd(9)} ${String(r.users).padStart(4)}  ${(r.ver + '/' + r.total).padEnd(11)}  ${r.pt.padEnd(42)} ${detail}`)
    }
    console.log('\nResumen buckets:', Object.entries(byBucket).map(([k, v]) => `${k}=${v}`).join('  '))
    console.log('(BUILD=construir contenido · REPARTO=defecto real, repartir por materia · CLINICO=contenedores, revisar · LIMPIA=verify directo)')
    await sql.end()
  } catch (e) { console.error('❌', e.message); await sql.end(); process.exit(1) }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.includes('--simulate')) simulate()
  else scan({ json: args.includes('--json'), pendingOnly: args.includes('--pending') })
}

module.exports = { isRealLaw, toArts, classifySharedLaw, classifyOposicion }
