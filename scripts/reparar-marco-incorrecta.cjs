#!/usr/bin/env node
// scripts/reparar-marco-incorrecta.cjs — T-219
//
// Repara el MARCO de las explicaciones en preguntas de «señale la INCORRECTA»: el encabezado dice
// «Por qué A es correcta» cuando A es justo la falsa que pedía el enunciado, y el bloque siguiente
// dice «Por qué las demás son incorrectas» sobre viñetas que empiezan por «Es cierto».
//
// NO toca la clave, ni el enunciado, ni las opciones, ni el argumento. Solo los dos encabezados,
// y SOLO cuando el argumento de la clave sostiene que esa opción es FALSA. Si sostiene que es
// verdadera, el defecto es la CLAVE y eso NO se auto-arregla: sale por la lista de revisión.
// (Manual reparar-preguntas.md, Error 2: la explicación no puede contradecir a la clave.)
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
// DRY-RUN por defecto. Escribe solo con --commit.

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const COMMIT = process.argv.includes('--commit')
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : null })()
const L = ['A', 'B', 'C', 'D']

// ¿El argumento bajo el encabezado de la clave sostiene que esa opción es FALSA?
// Se mira solo el arranque del bloque: es donde va la tesis.
function argumentaQueEsFalsa(texto) {
  const t = texto.toLowerCase().slice(0, 400)
  const falsa = /(es|son|sería|resulta)\s+(incorrect|fals|erróne|inexact)|no es (cierto|correcto|verdad)|es la (respuesta )?(incorrecta|falsa)|no se ajusta|no aparece|no contempla|no permite|no exige|no corresponde|contradice/
  return falsa.test(t)
}

function reparar(exp, letra) {
  let out = exp
  const cambios = []
  // Solo el encabezado PELADO. Si ya trae un paréntesis que aclara el marco —«Por qué C) es
  // correcta (la proposición INCORRECTA):»— la explicación YA es coherente y tocarla sería
  // romper lo que está bien: 254 de las 390 candidatas están en ese caso (medido 28/07).
  const rePelado = new RegExp(`(\\*\\*)?Por qué ${letra}(\\))? es correcta:?(\\*\\*)?`, 'i')
  const m = out.match(rePelado)
  if (m && !/^\s*\(/.test(out.slice(out.indexOf(m[0]) + m[0].length))) {
    const negrita = m[0].includes('**')
    const cuerpo = `Por qué ${letra}) es la incorrecta (correcta como respuesta):`
    out = out.replace(rePelado, negrita ? `**${cuerpo}**` : cuerpo)
    cambios.push('encabezado de la clave')
  }
  // El bloque de las demás dice «son incorrectas» sobre viñetas que empiezan por «Es cierto».
  const reDemas = /(\*\*)?Por qué las demás( opciones)?( son)? incorrectas(:)?/i
  if (reDemas.test(out)) {
    out = out.replace(reDemas, (x) => x.replace(/incorrectas/i, 'correctas'))
    cambios.push('encabezado de las demás')
  }
  return { out, cambios }
}

;(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 3 })
  try {
    const filas = await sql`
      select id, correct_option, question_text, explanation from questions
      where is_active = true
        and (question_text ~* '(señale|indique|cuál de las siguientes).{0,40}(incorrecta|falsa|no es (cierta|correcta|verdadera))'
          or question_text ~ '\\yNO\\y'
          or question_text ~ '\\y(EXCEPTO|SALVO)\\y'
          or question_text ~* 'todas.{0,30}(menos|salvo|excepto)'
          or question_text ~* 'no es (cierto|correcto|verdad)')
        and explanation ~* 'Por qué [A-D]\\)? es correcta'
      order by id ${LIMIT ? sql`limit ${LIMIT}` : sql``}`

    const reparables = [], revision = [], sinCambio = []
    for (const q of filas) {
      const letra = L[q.correct_option]
      const m = q.explanation.match(new RegExp(`Por qué ${letra}\\)? es correcta([^\\n]{0,80})`, 'i'))
      if (!m) { sinCambio.push(q); continue }
      // Ya aclarado con paréntesis → coherente, no es el defecto
      if (/\((?=[^)]*(incorrect|fals|no es cierta|buscada|pide el enunciado))/i.test(m[1])) { sinCambio.push(q); continue }
      const tras = q.explanation.slice(q.explanation.indexOf(m[0]) + m[0].length)
      if (!argumentaQueEsFalsa(tras)) { revision.push({ q, letra, arg: tras.trim().slice(0, 160) }); continue }
      const { out, cambios } = reparar(q.explanation, letra)
      if (out === q.explanation) { sinCambio.push(q); continue }
      reparables.push({ q, letra, out, cambios })
    }

    console.log(`${COMMIT ? '🚀 APLICANDO' : '🔍 DRY-RUN'} — ${filas.length} candidatas\n`)
    console.log(`  ✅ reparables (el argumento dice que la clave es FALSA): ${reparables.length}`)
    console.log(`  🔍 a revisión HUMANA (el argumento NO dice que sea falsa → sospecha de clave): ${revision.length}`)
    console.log(`  ⏭️  sin cambio aplicable: ${sinCambio.length}`)

    if (reparables[0]) {
      const e = reparables[0]
      console.log(`\n─── ejemplo (${e.q.id.slice(0, 8)}, clave ${e.letra}) ───`)
      console.log('ANTES: ' + (e.q.explanation.match(/Por qué[^\n]*/g) || []).join(' | ').slice(0, 200))
      console.log('DESPUÉS: ' + (e.out.match(/Por qué[^\n]*/g) || []).join(' | ').slice(0, 200))
    }
    if (revision.length) {
      console.log('\n─── a revisión (primeras 3) ───')
      revision.slice(0, 3).forEach(r => console.log(`  ${r.q.id.slice(0, 8)} [${r.letra}] ${r.arg.replace(/\s+/g, ' ').slice(0, 130)}`))
      require('fs').writeFileSync('revision-t219.json', JSON.stringify(revision.map(r => ({ id: r.q.id, letra: r.letra, arg: r.arg })), null, 1))
      console.log('  → lista completa en revision-t219.json')
    }

    if (!COMMIT) { console.log('\n(dry-run: no se ha escrito nada)'); return }
    let n = 0
    for (const r of reparables) {
      await sql`update questions set explanation = ${r.out} where id = ${r.q.id}`
      n++
    }
    console.log(`\n✅ ${n} explicación(es) reparada(s).`)
  } finally { await sql.end() }
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
