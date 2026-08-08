// ¿Qué pasaría si la DETECCIÓN de siglas mirara también la explicación?
// Hoy la sigla solo se busca en enunciado + opciones; la explicación solo vale para darla por
// desarrollada. Ese es el segundo motivo por el que «CETIC» se coló en T-679. Antes de tocar el
// núcleo, se mide el coste sobre los lotes que hay a mano.
const fs = require('fs')
const path = require('path')
const { DESARROLLO, ALLOWLIST } = require('../lib/generacion/siglasSinDesarrollar.js')

const LOTES = [
  'scratchpad/t679/gen_gcivil_t17_rd1125_2026-08-07_borrador.json',
  'scratchpad/t680/gen_canarias_t7_ley3-2026_2026-08-07_borrador.json',
  'scratchpad/t681/gen_pn_t11_rex2024_2026-08-07_borrador.json',
  'scratchpad/t278-mecanico-conductor/gen_mecanico_conductor_estado_t10_2026-08-06_borrador.json',
]

function faltan(enunciado, explicacion, opciones, conExplicacion) {
  const enOpciones = (opciones || []).join(' ')
  const dondeAparece = String(enunciado || '') + ' ' + enOpciones +
    (conExplicacion ? ' ' + String(explicacion || '') : '')
  const visible = String(enunciado || '') + ' ' + enOpciones + ' ' + String(explicacion || '')
  const out = []
  for (const [sigla, re] of Object.entries(DESARROLLO)) {
    if (ALLOWLIST.has(sigla)) continue
    if (!new RegExp(`\\b${sigla}\\b`).test(dondeAparece)) continue
    if (re.test(visible)) continue
    out.push(sigla)
  }
  return out
}

let hoy = 0, conCambio = 0, total = 0
const nuevos = []
for (const f of LOTES) {
  const abs = path.join(__dirname, '..', f)
  if (!fs.existsSync(abs)) { console.log('(falta)', f); continue }
  const j = JSON.parse(fs.readFileSync(abs, 'utf8'))
  const qs = Array.isArray(j) ? j : j.questions || j.preguntas || []
  for (const q of qs) {
    total++
    const ops = q.options || [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean)
    const a = faltan(q.question_text, q.explanation, ops, false)
    const b = faltan(q.question_text, q.explanation, ops, true)
    if (a.length) hoy++
    if (b.length) conCambio++
    if (!a.length && b.length) nuevos.push(`${path.basename(f).slice(0, 22)} · ${b.join(',')} · ${String(q.question_text).slice(0, 60)}`)
  }
}
console.log(`preguntas medidas: ${total}`)
console.log(`marcadas HOY (solo enunciado+opciones): ${hoy}`)
console.log(`marcadas SI se mirara también la explicación: ${conCambio}`)
if (nuevos.length) { console.log('\nlas que aparecerían:'); nuevos.forEach((n) => console.log(' ·', n)) }
