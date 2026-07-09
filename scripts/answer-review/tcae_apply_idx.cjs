// Apply mecánico de una tanda del barrido TCAE por ÍNDICES.
// Uso: node scripts/answer-review/tcae_apply_idx.cjs <ruta_output_workflow.json>
// Resuelve idx→id desde tcae_clinical_ranked.json. Misma política que tcae_apply.cjs.
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' })
const { createClient } = require('/home/manuel/Documentos/github/vence/node_modules/@supabase/supabase-js')
const fs = require('fs')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ADMIN = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'
const BASE = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/61c02061-b6d4-4b33-90e2-403f855d4c26/scratchpad'
const RANKED = require(BASE + '/tcae_clinical_ranked.json')
const QUEUE = BASE + '/tcae_clavemala_queue.json'
const LET = ['A', 'B', 'C', 'D', 'E']

async function q(fn) { for (let i = 0; i < 6; i++) { try { const r = await fn(); if (r && r.error) throw new Error(r.error.message); return r } catch (e) { if (i === 5) throw e; await new Promise(x => setTimeout(x, 1500)) } } }
function citaOk(e, letra) {
  return e.includes('**' + letra) ||
    new RegExp('correcta:?\\s*(es\\s*)?(la\\s*)?\\*?\\*?' + letra + '\\b', 'i').test(e) ||
    new RegExp('\\b' + letra + '\\s*[\\)\\(]').test(e)
}

;(async () => {
  const file = process.argv[2]
  const j = JSON.parse(fs.readFileSync(file, 'utf8'))
  const res = ((j.result && j.result.resultados) || []).filter(r => r && typeof r.idx === 'number' && RANKED[r.idx])
  const withId = res.map(r => ({ ...r, id: RANKED[r.idx] }))

  // 1) Explicaciones (clave OK)
  const rw = withId.filter(r => r.clave_ok && !r.explicacion_didactica && r.nueva_explicacion && r.nueva_explicacion.length > 60)
  const ids = rw.map(r => r.id); const map = {}
  for (let i = 0; i < ids.length; i += 100) { const { data } = await q(() => s.from('questions').select('id,correct_option').in('id', ids.slice(i, i + 100))); (data || []).forEach(x => map[x.id] = x) }
  let applied = 0, skip = 0
  for (const r of rw) {
    const cur = map[r.id]; if (!cur) { skip++; continue }
    const letra = LET[cur.correct_option]; const e = r.nueva_explicacion
    if (!(e.includes('**') && e.length >= 150 && citaOk(e, letra))) { skip++; continue }
    const { error } = await q(() => s.from('questions').update({ explanation: e }).eq('id', r.id))
    if (!error) applied++; else skip++
  }

  // 2) Clave-mala confirmada → needs_human + cola
  const cm = withId.filter(r => !r.clave_ok && r.confirm && r.confirm.confirmado_clave_mala === true)
  let deact = 0
  const queue = fs.existsSync(QUEUE) ? JSON.parse(fs.readFileSync(QUEUE, 'utf8')) : []
  for (const r of cm) {
    const { data: qd } = await q(() => s.from('questions').select('lifecycle_state,is_active').eq('id', r.id).single())
    if (!qd || !qd.is_active) continue
    try {
      const { error } = await q(() => s.rpc('transition_question_state', { p_question_id: r.id, p_expected_state: qd.lifecycle_state, p_new_state: 'needs_human', p_reason_code: 'ambiguous', p_changed_by: ADMIN, p_ai_verification_id: null, p_notes: 'Auditoria TCAE barrido: clave-mala confirmada doble pasada (propuesta ' + r.confirm.opcion_correcta + '/' + r.confirm.confianza + '). Revisar/flip manual o reformular.' }))
      if (!error) { deact++; queue.push({ id: r.id, idx: r.idx, propuesta: r.confirm.opcion_correcta, conf: r.confirm.confianza, expl: r.nueva_explicacion || '' }) }
    } catch (e) { /* ilegal, ignorar */ }
  }
  fs.writeFileSync(QUEUE, JSON.stringify(queue))

  const artNo = withId.filter(r => !r.articulo_soporta).length
  await q(() => fetch('https://www.vence.es/api/admin/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET }, body: JSON.stringify({ tag: 'questions' }) }))
  console.log(JSON.stringify({ file: file.split('/').pop(), total: withId.length, expl_aplicadas: applied, expl_saltadas: skip, clavemala_desactivadas: deact, articulo_no_soporta: artNo, cola_total: queue.length }))
})()
