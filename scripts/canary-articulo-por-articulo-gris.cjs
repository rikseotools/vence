#!/usr/bin/env node
// scripts/canary-articulo-por-articulo-gris.cjs
//
// CANARY del selector "test artículo por artículo" (bug Marta, 17/07): con leyes
// de short_name DUPLICADO (una fila poblada + una vacía), el endpoint resolvía el
// law_id por short_name y podía coger la fila VACÍA → TODOS los artículos del
// scope con question_count 0 → todos en gris, pese a haber preguntas. Fix: usar
// el law_id del topic_scope.
//
// Vigila lo que unit/integración NO ven: que en PROD (backend Fargate desplegado
// + caché Redis fresca) el selector devuelve artículos con preguntas para esas
// leyes. Un fallo = usuarios premium ven todo en gris y no pueden estudiar por
// artículo (soporte + churn-adjacent).
//
// Regla: para cada (oposición, tema, ley) de la lista, GET articles → al menos un
// artículo con question_count > 0 (idealmente TODOS). Todo en gris = FALLA.
//
// Uso:  node scripts/canary-articulo-por-articulo-gris.cjs [https://www.vence.es]
//       node scripts/canary-articulo-por-articulo-gris.cjs --selftest

const BASE = process.argv.find((a) => a.startsWith('http')) || 'https://www.vence.es'
const SELFTEST = process.argv.includes('--selftest')

// Muestra curada de (oposición, tema, ley) sobre leyes con short_name duplicado.
// Incluye el caso exacto reportado (Marta) + otras oposiciones y la 2ª ley
// duplicada con scope real (LO 2/2012). Si una fila deja de existir, sale 0
// artículos → se reporta como aviso, no como fallo (el scope pudo cambiar).
const CASES = [
  { positionType: 'auxiliar_administrativo_madrid', topicNumber: 13, law: 'LO 1/2004' }, // Marta
  { positionType: 'auxiliar_administrativo_estado', topicNumber: 16, law: 'LO 1/2004' },
  { positionType: 'administrativo_estado', topicNumber: 307, law: 'LO 1/2004' },
  { positionType: 'auxiliar_administrativo_andalucia', topicNumber: 8, law: 'LO 1/2004' },
  { positionType: 'auxilio_judicial', topicNumber: 2, law: 'LO 1/2004' },
]

// El detector puro que comparte la lógica: "todo en gris" = hay artículos pero
// ninguno tiene preguntas. Exportado de facto para el self-test.
function isAllGrey(articles) {
  if (!Array.isArray(articles) || articles.length === 0) return false // sin artículos ≠ gris
  return articles.every((a) => !(a.question_count > 0))
}

function selftest() {
  const cases = [
    { name: 'todo con preguntas → no gris', articles: [{ question_count: 3 }, { question_count: 1 }], exp: false },
    { name: 'todo en 0 → GRIS', articles: [{ question_count: 0 }, { question_count: 0 }], exp: true },
    { name: 'mezcla → no gris', articles: [{ question_count: 0 }, { question_count: 5 }], exp: false },
    { name: 'sin artículos → no gris (no aplica)', articles: [], exp: false },
  ]
  let ok = 0
  for (const c of cases) {
    const got = isAllGrey(c.articles)
    const pass = got === c.exp
    console.log(`  ${pass ? '✅' : '❌'} ${c.name}  got=${got} exp=${c.exp}`)
    if (pass) ok++
  }
  if (ok !== cases.length) {
    console.error(`\n❌ self-test FALLA (${ok}/${cases.length})`)
    process.exit(1)
  }
  console.log(`\n✅ self-test OK (${ok}/${cases.length})`)
}

async function main() {
  if (SELFTEST) return selftest()

  const fails = []
  const warns = []
  for (const c of CASES) {
    const qs = new URLSearchParams({
      lawShortName: c.law,
      topicNumber: String(c.topicNumber),
      positionType: c.positionType,
    })
    const url = `${BASE}/api/v2/test-config/articles?${qs}`
    let data
    try {
      const res = await fetch(url)
      data = await res.json()
    } catch (e) {
      fails.push(`${c.positionType} T${c.topicNumber} · ${c.law}: fetch/parse error (${e.message})`)
      continue
    }
    const arts = data.articles || []
    const conQ = arts.filter((a) => a.question_count > 0).length
    if (!data.success) {
      fails.push(`${c.positionType} T${c.topicNumber} · ${c.law}: success=false (${data.error || '?'})`)
    } else if (arts.length === 0) {
      warns.push(`${c.positionType} T${c.topicNumber} · ${c.law}: 0 artículos (¿scope cambiado?)`)
    } else if (isAllGrey(arts)) {
      fails.push(`${c.positionType} T${c.topicNumber} · ${c.law}: TODO EN GRIS (${arts.length} arts, 0 con preguntas)`)
    } else {
      console.log(`  ✅ ${c.positionType} T${c.topicNumber} · ${c.law} → ${conQ}/${arts.length} artículos con preguntas`)
    }
  }

  warns.forEach((w) => console.warn(`  ⚠️  ${w}`))

  if (fails.length) {
    console.error(`\n❌ CANARY artículo-por-artículo FALLA (${fails.length}) contra ${BASE}:`)
    fails.forEach((f) => console.error(`   - ${f}`))
    process.exit(1)
  }
  console.log(`\n✅ CANARY artículo-por-artículo OK contra ${BASE} (${CASES.length - warns.length} casos verdes)`)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
