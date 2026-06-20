// Cierra los 5 temas "En elaboración" de administrativo_asturias repartiendo
// leyes que YA están en BD con preguntas (sin IA), fiel al epígrafe.
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const POS = 'administrativo_asturias'
const DL = 'b2ec3b4e-0188-43bd-acc7-bb76ed9f1b1a' // DL 2/1998 régimen económico
const D70 = '0ec18c70' // se resuelve abajo (control interno)
const LAW = {
  L39: '218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40: '95680d57-feb1-41c0-bb27-236024815feb',
  D70: '0ec18c70-...', // resolver
  R05: '3848d7b4-...', // resolver
}

// Reparto del DL 2/1998 por nº de artículo (base numérica) → tema destino.
function temaForArt(n) {
  if (n >= 1 && n <= 21) return 401   // Hacienda + presupuesto concepto
  if (n >= 22 && n <= 40) return 402  // presupuesto: créditos y modificaciones
  if (n >= 41 && n <= 44) return 403  // ejecución / pagos / cierre
  if (n >= 45 && n <= 53) return 404  // gastos: tesorería, endeudamiento, deuda, avales
  if (n >= 54 && n <= 58) return 405  // Intervención (control interno)
  if (n >= 59 && n <= 65) return 403  // contabilidad / cuenta general / liquidación
  if (n === 66) return 405            // responsabilidad ante la Hacienda
  if (n === 67) return 207            // subvenciones y ayudas públicas → T207
  if (n >= 68 && n <= 71) return 405  // infracciones / sanciones
  return null
}
const baseNum = (s) => parseInt(String(s).replace(/[^0-9].*$/, ''), 10) || 0

;(async () => {
  // resolver ids de decretos contables
  const { data: d70 } = await s.from('laws').select('id').eq('short_name', 'D 70/2004 Asturias Control Interno').single()
  const { data: r05 } = await s.from('laws').select('id').eq('short_name', 'R 16/05/2005 Asturias Sist. Contable').single()
  LAW.D70 = d70.id; LAW.R05 = r05.id

  // topics de la oposición
  const { data: topics } = await s.from('topics').select('id,topic_number').eq('position_type', POS)
  const tid = {}; for (const t of topics) tid[t.topic_number] = t.id

  // artículos del DL 2/1998
  const { data: arts } = await s.from('articles').select('article_number').eq('law_id', DL)
  const byTema = {} // tema -> [article_number]
  for (const a of arts) {
    const t = temaForArt(baseNum(a.article_number))
    if (!t) continue
    ;(byTema[t] = byTema[t] || []).push(a.article_number)
  }

  // 1) limpiar el scope del DL 2/1998 + D70 + R05 en TODO el Bloque IV (T401-405)
  //    y de T207 (por si reejecuto), para reinsertar limpio.
  for (const tn of [401, 402, 403, 404, 405, 207]) {
    await s.from('topic_scope').delete().eq('topic_id', tid[tn]).in('law_id', [DL, LAW.D70, LAW.R05])
  }

  // 2) reinsertar el reparto del DL 2/1998
  const rows = []
  for (const tn of Object.keys(byTema)) {
    rows.push({ topic_id: tid[tn], law_id: DL, article_numbers: byTema[tn] })
  }
  // decretos contables a su tema
  rows.push({ topic_id: tid[403], law_id: LAW.R05, article_numbers: null })  // Sist. Contable → T403
  rows.push({ topic_id: tid[405], law_id: LAW.D70, article_numbers: null })  // Control Interno → T405
  // T401 conserva además D70/R05? No: ya los movimos. T401 = DL 1-21 + (mantiene lo que tenía? lo dejamos solo con DL 1-21)

  // 3) T211 documentación: añadir Ley 39/2015 + Ley 40/2015 (artículos de documentación, con preguntas)
  await s.from('topic_scope').delete().eq('topic_id', tid[211]).in('law_id', [LAW.L39, LAW.L40])
  rows.push({ topic_id: tid[211], law_id: LAW.L39, article_numbers: ['16', '17', '26', '27', '28', '31'] })
  rows.push({ topic_id: tid[211], law_id: LAW.L40, article_numbers: ['46'] })

  const { error } = await s.from('topic_scope').insert(rows)
  if (error) throw error
  console.log(`✅ ${rows.length} filas de topic_scope insertadas (reparto DL 2/1998 + docs T211)`)
  for (const tn of [401, 402, 403, 404, 405]) console.log(`   T${tn}: DL 2/1998 arts ${(byTema[tn] || []).length}`)
  console.log(`   T207: + subvenciones DL 2/1998 arts ${(byTema[207] || []).length}`)

  // 4) disponible=true para los 5 temas
  await s.from('topics').update({ disponible: true }).eq('position_type', POS).in('topic_number', [211, 402, 403, 404, 405])
  console.log('✅ disponible=true en T211, T402, T403, T404, T405')
})().catch((e) => { console.error('❌', e.message || e); process.exit(1) })
