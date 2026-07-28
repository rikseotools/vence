#!/usr/bin/env node
// scripts/reparar-demas-incorrecta.cjs — T-219, defecto B
//
// En preguntas de «señale la INCORRECTA», el bloque de las otras opciones dice «Por qué las demás
// son INCORRECTAS» y debajo lista viñetas que empiezan por «Es cierto…». Si la pregunta pide la
// falsa, las demás son CORRECTAS: el encabezado se contradice con sus propias viñetas.
//
// Es un defecto DISTINTO del encabezado de la clave (script reparar-marco-incorrecta.cjs) y se
// solapa solo en parte: 254 preguntas tienen la clave bien rotulada y este bloque mal.
//
// Solo actúa si las viñetas AFIRMAN que las demás son ciertas. Sin esa prueba no se toca: podría
// ser una explicación donde de verdad se argumente que las demás también fallan (pregunta mal
// construida), y eso es revisión humana, no un reemplazo de texto.
//
// UNIVERSO AMPLIADO (28/07): el patrón de la ficha («señale … incorrecta») se quedaba corto.
// Medido: «cuál … NO» aporta 1.025 sospechosas, «excepto/salvo» 199 y «no corresponde» 273 — más
// que el patrón original. Un cubo medido con una red estrecha parece terminado cuando no lo está.
//
// ⚠️ EL «NO» VA EN MAYÚSCULAS Y ES CASE-SENSITIVE A PROPÓSITO. Con `~*` (insensible), el patrón
// «cuál … no» casaba con cualquier negación suelta del enunciado y metía preguntas de marco
// POSITIVO cuya explicación estaba PERFECTA. Caso real cazado en el muestreo del 28/07: «¿Qué
// nombre recibe el grupo que se toma como modelo de socialización aunque NO pertenezcamos a él?»
// —marco positivo, explicación correcta— que esta herramienta habría reescrito, rompiendo una
// pregunta sana. El marco negativo se marca con NO/EXCEPTO en mayúsculas: ese es el discriminante.
//
// DRY-RUN por defecto. Escribe con --commit.

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const COMMIT = process.argv.includes('--commit')
const RE_HEAD = /(\*\*)?Por qué las demás( opciones)?( son)? incorrectas(:)?/i

;(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 3 })
  try {
    const filas = await sql`
      select id, explanation from questions
      where is_active = true
        and (question_text ~* '(señale|indique|cuál de las siguientes).{0,40}(incorrecta|falsa|no es (cierta|correcta|verdadera))'
          or question_text ~ '\\yNO\\y'
          or question_text ~ '\\y(EXCEPTO|SALVO)\\y'
          or question_text ~* 'todas.{0,30}(menos|salvo|excepto)'
          or question_text ~* 'no es (cierto|correcto|verdad)')
        and explanation ~* 'Por qué las demás( opciones)?( son)? incorrectas'
      order by id`

    const aplicar = [], sinPrueba = []
    for (const q of filas) {
      const m = q.explanation.match(RE_HEAD)
      if (!m) continue
      // Prueba: tras el encabezado, las viñetas dicen que las otras SÍ son ciertas.
      const tras = q.explanation.slice(q.explanation.indexOf(m[0]) + m[0].length, q.explanation.indexOf(m[0]) + m[0].length + 900)
      const dicenCiertas = /(es cierto|es correcta|es correcto|sí (es|son)|es verdadera|coincide con|reproduce (el|la)|se ajusta a)/i.test(tras)
      if (!dicenCiertas) { sinPrueba.push(q.id); continue }
      aplicar.push({ id: q.id, out: q.explanation.replace(RE_HEAD, (x) => x.replace(/incorrectas/i, 'correctas')) })
    }

    console.log(`${COMMIT ? '🚀 APLICANDO' : '🔍 DRY-RUN'} — ${filas.length} con el encabezado «las demás son incorrectas»\n`)
    console.log(`  ✅ con prueba en las viñetas (se reparan): ${aplicar.length}`)
    console.log(`  🔍 sin prueba (no se tocan, quedan para revisión): ${sinPrueba.length}`)
    if (aplicar[0]) {
      const antes = filas.find(f => f.id === aplicar[0].id).explanation.match(RE_HEAD)[0]
      console.log(`\nejemplo: «${antes}» → «${antes.replace(/incorrectas/i, 'correctas')}»`)
    }
    if (!COMMIT) { console.log('\n(dry-run: no se ha escrito nada)'); return }
    let n = 0
    for (const r of aplicar) { await sql`update questions set explanation = ${r.out} where id = ${r.id}`; n++ }
    console.log(`\n✅ ${n} explicación(es) reparada(s).`)
  } finally { await sql.end() }
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
