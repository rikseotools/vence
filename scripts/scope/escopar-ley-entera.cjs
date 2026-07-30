#!/usr/bin/env node
/**
 * escopar-ley-entera.cjs — engancha una ley COMPLETA al `topic_scope` de un tema. (T-055)
 *
 * El caso que resuelve: un contenedor de contenido (ley real o virtual) con preguntas activas que
 * **ningún tema sirve**, y un epígrafe que lo pide por su nombre. Recuperarlas es re-escopar, no
 * generar — pero hacerlo a mano con un `INSERT` suelto es como se llegó aquí: en el repo hay una
 * docena de `scripts/_xxx.cjs` de un solo uso que hacen esto sin ninguna guarda.
 *
 * ## Guardas (todas, y por un motivo medido)
 *
 * 1. **El epígrafe TIENE que nombrar la ley.** Es la doctrina del proyecto: se añade lo que el
 *    programa pide, no lo que parece encajar. Sin coincidencia, se niega; para los casos en que el
 *    epígrafe la nombra con otras palabras hay `--motivo "<qué dice el epígrafe y dónde>"`, que
 *    queda escrito en el evento — obligar a explicarlo por escrito es la guarda, no el flag.
 * 2. **Idempotente**: si la fila ya existe no duplica (y lo dice).
 * 3. **Sin lista de artículos**: «toda la ley» se expresa por AUSENCIA de `article_numbers`, que es
 *    como ya se escopó el contenedor de Inglés PN. Además evita añadir un escritor más a esa
 *    columna, que tiene trinquete por ser el temario servido.
 * 4. **Cuenta antes y después**, y avisa de que el contador de la API cachea 60 s: verificar por el
 *    HTML no vale (se renderiza en cliente y es idéntico para un tema lleno y uno vacío).
 * 5. **Dry-run por defecto**: sin `--apply` no escribe.
 *
 * Uso:
 *   node scripts/scope/escopar-ley-entera.cjs --pt <position_type> --tema <N> --ley "<short_name>" [--motivo "…"] [--apply]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i >= 0 && v && !v.startsWith('--') ? v : null }
const PT = arg('--pt'), TEMA = arg('--tema'), LEY = arg('--ley'), MOTIVO = arg('--motivo')
const APPLY = process.argv.includes('--apply')
if (!PT || !TEMA || !LEY) {
  console.error('Uso: escopar-ley-entera.cjs --pt <position_type> --tema <N> --ley "<short_name>" [--motivo "…"] [--apply]')
  process.exit(2)
}

// El criterio de «el epígrafe la nombra» vive en el NÚCLEO, compartido con el detector del barrido
// (`normaDelEpigrafeSinEscopar`). Aquí tenía su propia copia y habrían divergido en cuanto alguien
// afinara una: la herramienta que ESCRIBE y el vigilante que MIRA tienen que usar la misma regla.
const { epigrafeNombraLey } = require('../../lib/health/normaDelEpigrafeSinEscopar.cjs')

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    const t = (await c.query(
      `SELECT id, topic_number, title, epigrafe FROM topics WHERE position_type=$1 AND topic_number=$2 AND is_active`,
      [PT, Number(TEMA)])).rows[0]
    if (!t) throw new Error(`no hay tema activo ${PT} T${TEMA}`)
    const l = (await c.query(`SELECT id, short_name, name, is_active FROM laws WHERE short_name=$1`, [LEY])).rows[0]
    if (!l) throw new Error(`no existe la ley «${LEY}»`)
    if (!l.is_active) throw new Error(`la ley «${LEY}» está INACTIVA: no se escopa contenido retirado`)

    const nq = (await c.query(
      `SELECT count(*)::int n FROM questions q JOIN articles a ON a.id=q.primary_article_id
        WHERE a.law_id=$1 AND q.is_active`, [l.id])).rows[0].n
    if (!nq) throw new Error(`«${LEY}» no tiene preguntas activas: escoparla no sirve a nadie`)

    const ya = (await c.query(`SELECT id, article_numbers FROM topic_scope WHERE topic_id=$1 AND law_id=$2`, [t.id, l.id])).rows[0]
    const enc = epigrafeNombraLey(t.epigrafe, l.short_name, l.name)

    console.log(`\n${PT} T${t.topic_number} — ${t.title}`)
    console.log(`  ley:        ${l.short_name}  («${String(l.name).slice(0, 80)}»)`)
    console.log(`  preguntas:  ${nq} activas que hoy no sirve ningún tema`)
    console.log(`  epígrafe:   ${enc.nombra ? `✅ la nombra («${enc.por}»)` : '❌ NO la nombra'}`)
    if (ya) { console.log(`  ⚠️ ya estaba escopada${ya.article_numbers ? ` con ${ya.article_numbers.length} artículos` : ' (ley entera)'} — nada que hacer`); return }
    if (!enc.nombra && !MOTIVO) {
      console.error('\n❌ El epígrafe no nombra la ley y no hay --motivo. Se añade lo que el programa PIDE.')
      console.error('   Si el epígrafe la pide con otras palabras, dilo por escrito:  --motivo "…"')
      process.exit(3)
    }
    if (MOTIVO) console.log(`  motivo:     ${MOTIVO}`)
    if (!APPLY) { console.log('\n(dry-run — repite con --apply)\n'); return }

    // Sin `article_numbers`: «toda la ley» es la AUSENCIA de lista (ver guarda 3).
    await c.query(`INSERT INTO topic_scope (topic_id, law_id) VALUES ($1, $2)`, [t.id, l.id])
    try {
      await c.query(
        `INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
         VALUES (gen_random_uuid(), NOW(), 'script:escopar-ley-entera', 'info', 'topic_scope_ley_entera_anadida', $1::jsonb, NOW())`,
        [JSON.stringify({ position_type: PT, topic_number: t.topic_number, ley: l.short_name, preguntas: nq, epigrafe_la_nombra: !!enc.nombra, motivo: MOTIVO })])
    } catch (e) { console.error(`⚠️ evento no registrado: ${String(e.message).slice(0, 120)}`) }

    console.log(`\n✅ «${l.short_name}» enganchada a ${PT} T${t.topic_number}: ${nq} preguntas pasan a servirse.`)
    console.log('   Verifica con el CONTADOR, no con el HTML (se renderiza en cliente y engaña):')
    console.log(`     GET /api/questions/filtered?action=count&topicNumber=${t.topic_number}&positionType=${PT}`)
    console.log('   Cachea 60 s: espera el TTL o invalida antes de creerte el número.')
  } finally {
    await c.end()
  }
}
main().catch((e) => { console.error('❌', e.message); process.exit(1) })
