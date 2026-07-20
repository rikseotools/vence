#!/usr/bin/env node
/**
 * Generación IA — Título V (Gobernanza) de la Ley 1/2026 Universitaria para Andalucía,
 * que es lo que pide el T10 de Aux. Admin. UAL (T-044).
 *
 * Este lote existe porque el GATE DE PUBLICACIÓN destapó que el T10 servía 18 preguntas de
 * títulos que su epígrafe NO pide, y cero del Título V, que ni estaba importado. Tras acotar
 * el scope a los arts. 88-100 el tema se quedó a 0 → sin este banco no se puede publicar.
 *
 * Sigue `generar-preguntas-con-ia.md` v2.5. El check de longitud ABORTA.
 * Núcleo examinable: composiciones, mandatos y porcentajes (Claustro 100-300 y 51%,
 * Consejo de Gobierno 30-50, rector 6 años y 3 sexenios/3 quinquenios).
 *
 * Uso: node scripts/oposiciones/gen-t10-lua-titulo-v-batch1.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const LEY = 'Ley 1/2026 LUA'
const PROV = 'claude_code_gen_t10_lua'

const Q = [
  { art: '88', pos: 0,
    q: 'Según el artículo 88 de la Ley 1/2026, Universitaria para Andalucía, el Claustro Universitario se define como:',
    o: ['El máximo órgano de representación y participación de la comunidad universitaria',
        'El máximo órgano de gobierno y de dirección ordinaria de la universidad pública',
        'El órgano de participación y representación de la sociedad en la universidad',
        'El órgano colegiado de control económico y presupuestario de la universidad'],
    cita: 'El Claustro Universitario es el máximo órgano de representación y participación de la comunidad universitaria.' },

  { art: '88', pos: 1,
    q: 'Conforme al artículo 88 de la Ley 1/2026, Universitaria para Andalucía, el Claustro Universitario estará compuesto por:',
    o: ['Entre 50 y 200 miembros, siendo natos el rector o rectora, el secretario o secretaria general y el gerente o la gerenta',
        'Entre 100 y 300 miembros, siendo natos el rector o rectora, que lo presidirá, el secretario o secretaria general y el gerente o la gerenta',
        'Entre 30 y 50 miembros, siendo natos el rector o rectora, que lo presidirá, y la persona titular de la gerencia de la universidad',
        'Entre 150 y 400 miembros, siendo natos el rector o rectora y los decanos o decanas de cada una de las facultades'],
    cita: 'El Claustro Universitario estará compuesto entre 100 y 300 miembros con la siguiente distribución: a) Serán natos el rector o rectora, que lo presidirá, el secretario o secretaria general y el gerente o la gerenta.' },

  { art: '89', pos: 2,
    q: 'De acuerdo con el artículo 89 de la Ley 1/2026, Universitaria para Andalucía, el Consejo de Gobierno de la universidad es:',
    o: ['El máximo órgano de representación de la comunidad',
        'El órgano de enlace con la sociedad andaluza',
        'El máximo órgano de gobierno de la universidad',
        'El órgano de evaluación del sistema andaluz'],
    cita: 'El Consejo de Gobierno es el máximo órgano de gobierno de la universidad.' },

  { art: '89', pos: 3,
    q: 'Según el artículo 89 de la Ley 1/2026, Universitaria para Andalucía, el Consejo de Gobierno estará formado por un número de miembros comprendido entre:',
    o: ['20 y 40 miembros, a los que se añadirán quienes tengan la condición de miembro nato de dicho órgano',
        '100 y 300 miembros, a los que se añadirán quienes tengan la condición de miembro nato de dicho órgano',
        '40 y 60 miembros, a los que se añadirán quienes tengan la condición de miembro nato de dicho órgano',
        '30 y 50 miembros, a los que se añadirán quienes tengan la condición de miembro nato de dicho órgano'],
    cita: 'El Consejo de Gobierno estará formado por un número entre 30 y 50 miembros, a los que se añadirán quienes tengan la condición de miembro nato.' },

  { art: '90', pos: 0,
    q: 'Conforme al artículo 90 de la Ley 1/2026, Universitaria para Andalucía, el rector o la rectora se define como:',
    o: ['La persona responsable de la dirección, gobierno y gestión de la universidad, que ostentará la representación de esta',
        'La persona que preside el Consejo Social y ejerce la representación institucional de la universidad ante la sociedad',
        'La persona titular de la gerencia responsable de la gestión económica y administrativa ordinaria de la universidad',
        'La persona designada por la Consejería competente para dirigir y coordinar la actividad académica de la universidad'],
    cita: 'El rector o la rectora es la persona responsable de la dirección, gobierno y gestión de la universidad y ostentará la representación de esta.' },

  { art: '91', pos: 1,
    q: 'Según el artículo 91 de la Ley 1/2026, Universitaria para Andalucía, el rector o rectora será elegido:',
    o: ['Para un mandato de cuatro años renovable una sola vez, mediante elección directa por sufragio universal ponderado',
        'Para un único mandato de seis años, mediante elección directa por sufragio universal ponderado',
        'Para un único mandato de cinco años, mediante elección indirecta por el Claustro Universitario',
        'Para un mandato de seis años renovable una sola vez, mediante elección directa por el Consejo de Gobierno'],
    cita: 'El rector o rectora será elegido para un único mandato de seis años, mediante elección directa por sufragio universal ponderado, por quienes tengan la condición de miembro de la comunidad universitaria.' },

  { art: '91', pos: 2,
    q: 'De acuerdo con el artículo 91 de la Ley 1/2026, Universitaria para Andalucía, en la ponderación del sufragio los estatutos deben asegurar que la representatividad del personal de los cuerpos docentes universitarios funcionarios y del profesorado permanente laboral:',
    o: ['No sea inferior al cuarenta por ciento, según los porcentajes que fijen los estatutos de la universidad',
        'No sea superior al sesenta por ciento, según los porcentajes que fijen los estatutos de la universidad',
        'No sea inferior al cincuenta y uno por ciento, según los porcentajes que fijen los estatutos de la universidad',
        'Sea equivalente a la de los demás sectores, según los porcentajes que fijen los estatutos de la universidad'],
    cita: 'Los estatutos de la universidad fijarán los porcentajes y el procedimiento de ponderación de cada sector de la comunidad universitaria, asegurando que, en todo caso, la representatividad del personal de los cuerpos docentes universitarios funcionarios y del profesorado permanente laboral de la universidad no sea inferior al cincuenta y uno por ciento.' },

  { art: '92', pos: 3,
    q: 'Según el artículo 92 de la Ley 1/2026, Universitaria para Andalucía, todas las universidades públicas andaluzas contarán con un Consejo Social, salvo la Universidad Internacional de Andalucía, que contará con:',
    o: ['Una Junta de Gobierno, en lugar de Consejo Social',
        'Un Consejo Rector, en lugar de Consejo Social',
        'Una Comisión Mixta, en lugar de Consejo Social',
        'Un Patronato, en lugar de Consejo Social'],
    cita: 'Todas las universidades públicas andaluzas contarán con un Consejo Social, a excepción de la Universidad Internacional de Andalucía, que contará con un Patronato.' },

  { art: '92', pos: 0,
    q: 'Conforme al artículo 92 de la Ley 1/2026, Universitaria para Andalucía, el Consejo Social se define como:',
    o: ['El órgano de participación y representación de la sociedad en la universidad pública, que ejerce como elemento de interrelación entre la sociedad y la universidad',
        'El órgano de representación del profesorado y del estudiantado en la universidad pública, que ejerce como elemento de enlace entre los centros y el rectorado',
        'El máximo órgano de gobierno de la universidad pública, que ejerce como elemento de dirección estratégica entre la gerencia y los centros universitarios',
        'El órgano colegiado interadministrativo de evaluación de las universidades públicas, que ejerce como elemento de coordinación entre la Junta y la universidad'],
    cita: 'El Consejo Social es el órgano de participación y representación de la sociedad en la universidad pública y ejerce como elemento de interrelación entre la sociedad y la universidad.' },

  { art: '94', pos: 1,
    q: 'Según el artículo 94 de la Ley 1/2026, Universitaria para Andalucía, la presidencia del Consejo Social:',
    o: ['Será elegida por el Claustro Universitario, oído el Consejo de Gobierno, entre profesionales de reconocido prestigio del sector',
        'Será propuesta por el Consejo de Gobierno de la Junta de Andalucía, oído el rector o rectora, entre profesionales de reconocido prestigio',
        'Será designada por el rector o rectora de la universidad, oído el Consejo Social, entre profesionales de reconocido prestigio del ámbito',
        'Será propuesta por el Consejo de Gobierno de la universidad, oída la Consejería competente, entre profesionales de reconocido prestigio'],
    cita: 'La presidencia, que será propuesta por el Consejo de Gobierno de la Junta de Andalucía, oído el rector o rectora, entre profesionales de reconocido prestigio en su ámbito de actuación.' },

  { art: '95', pos: 2,
    q: 'De acuerdo con el artículo 95 de la Ley 1/2026, Universitaria para Andalucía, respecto del incumplimiento reiterado de los deberes inherentes al cargo de miembro del Consejo Social, se incluye en ese supuesto:',
    o: ['La ausencia injustificada a tres plenos consecutivos',
        'La ausencia injustificada a la mitad de los plenos',
        'La ausencia injustificada a dos plenos consecutivos',
        'La ausencia injustificada a un pleno extraordinario'],
    cita: 'Incumplimiento reiterado de los deberes inherentes a su cargo. En este supuesto, se incluye la ausencia injustificada a dos plenos consecutivos.' },

  { art: '100', pos: 3,
    q: 'Según el artículo 100 de la Ley 1/2026, Universitaria para Andalucía, el Consejo Andaluz de Consejos Sociales Universitarios se adscribe orgánicamente:',
    o: ['Al Consejo de Gobierno de cada una de las universidades públicas andaluzas que lo integran',
        'Al Parlamento de Andalucía, a través de la comisión competente en materia de universidades',
        'A la Agencia Andaluza del Conocimiento, con autonomía funcional y presupuesto propio',
        'A la Consejería competente en materia de universidades de la Junta de Andalucía'],
    cita: 'El Consejo Andaluz de los Consejos Sociales se adscribe orgánicamente a la Consejería competente en materia de universidades de la Junta de Andalucía.' },
]

const L = ['A', 'B', 'C', 'D']

function explicacion(item) {
  const letra = L[item.pos]
  const otras = [0, 1, 2, 3].filter((i) => i !== item.pos)
    .map((i) => `- Por qué ${L[i]} no: no se corresponde con lo que establece el artículo ${item.art} de la Ley 1/2026; altera el contenido del precepto.`)
    .join('\n')
  return `> ${item.cita}\n\nPor qué ${letra} es correcta: reproduce lo dispuesto en el artículo ${item.art} de la Ley 1/2026, de 20 de febrero, Universitaria para Andalucía (Título V, Gobernanza de las Universidades Públicas).\n\nPor qué las demás no:\n${otras}`
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const dist = [0, 0, 0, 0]
  Q.forEach((x) => dist[x.pos]++)
  console.log(`posición de la correcta → A:${dist[0]} B:${dist[1]} C:${dist[2]} D:${dist[3]}`)
  let malos = 0
  Q.forEach((x, i) => {
    // §2.2-bis SIMÉTRICO. El check original solo miraba "la correcta es la más LARGA" y dejaba
    // pasar el tell inverso: en el art. 91 la correcta era la MÁS CORTA (7 palabras frente a 14-16)
    // y se acertaba igual sin saber la ley. Lo cazó el auditor ciego, no el guardarraíl.
    const lc = x.o[x.pos].length
    const otras = x.o.filter((_, j) => j !== x.pos).map((o) => o.length)
    const min = Math.min(...otras), max = Math.max(...otras)
    if (lc / min > 1.4) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): correcta DEMASIADO LARGA — ratio ${(lc / min).toFixed(2)} (${lc} vs ${min})`); malos++ }
    else if (max / lc > 1.4) { console.log(`  ⚠️ Q${i + 1} (art ${x.art}): correcta DEMASIADO CORTA — ratio ${(max / lc).toFixed(2)} (${lc} vs ${max})`); malos++ }
    // TELL DE FORMATO (el ratio numérico NO lo ve): si los 3 distractores comparten un final
    // que la correcta no tiene —o al revés—, se acierta por la forma. Caso real: los distractores
    // acababan en "de dicho órgano" y la correcta iba pelada.
    // Medición también en PALABRAS: el ratio en caracteres deja pasar casos que un lector
    // (y el auditor) sí percibe. art. 89 pasaba en caracteres y daba 1,60 en palabras.
    const pal = x.o.map((o) => o.trim().split(/\s+/).length)
    const pc = pal[x.pos], po = pal.filter((_, j) => j !== x.pos)
    if (Math.max(pc / Math.min(...po), Math.max(...po) / pc) > 1.35) {
      console.log(`  ⚠️ Q${i + 1} (art ${x.art}): desequilibrio en PALABRAS — ${pc} vs [${po.join(', ')}]`); malos++
    }
    const fin = (o) => o.trim().split(/\s+/).slice(-3).join(' ').toLowerCase()
    const finales = x.o.map(fin)
    const finCorrecta = finales[x.pos]
    const finesOtros = finales.filter((_, j) => j !== x.pos)
    if (new Set(finesOtros).size === 1 && finesOtros[0] !== finCorrecta) {
      console.log(`  ⚠️ Q${i + 1} (art ${x.art}): TELL DE FORMATO — los 3 distractores acaban en "${finesOtros[0]}" y la correcta no`); malos++
    }
  })
  if (malos) throw new Error(`${malos} incumplen §2.2-bis`)
  console.log('✅ equilibrio de longitud OK')

  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    const arts = new Map()
    for (const r of (await c.query(
      `SELECT a.id, a.article_number n FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name=$1`, [LEY])).rows) arts.set(r.n, r.id)
    let n = 0
    for (const item of Q) {
      const aid = arts.get(item.art)
      if (!aid) throw new Error(`no encuentro el art. ${item.art}`)
      if ((await c.query('SELECT id FROM questions WHERE question_text=$1', [item.q])).rows.length) continue
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option,
                                explanation, difficulty, primary_article_id, lifecycle_state, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium',$8,'draft',$9)`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.pos, explicacion(item), aid,
         ['lua', 'gobernanza', 'ual', 'ia-generada', PROV]])
      n++
    }
    console.log(`\n${n} pregunta(s) insertadas como draft`)
    if (DRY) { await c.query('ROLLBACK'); console.log('--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('✅ COMMIT') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
