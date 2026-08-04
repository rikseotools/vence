#!/usr/bin/env node
/**
 * sim-puerta-temario.cjs — comprueba contra RDS REAL que la puerta de temario distingue las tres
 * situaciones que la hacen útil. No escribe nada.
 *
 *   npm run sim:puerta-temario
 *
 * Por qué contra datos vivos y no solo con los tests del núcleo: los tests fijan el JUICIO, pero
 * el fallo del 04/08 no estuvo en el juicio — estuvo en que nadie reunía los hechos. Un núcleo
 * impecable alimentado por una consulta que no encuentra el tema es una puerta que siempre dice
 * que sí. Esto ejercita la consulta.
 *
 * Los tres casos se eligen SOLOS del banco (no hay ids clavados que envejezcan):
 *   1. pregunta servida por un tema con Paso 1 hecho y sellado del pipeline  → verde
 *   2. pregunta servida por un tema sin Paso 1                               → rojo, con su comando
 *   3. pregunta que no sirve ningún tema de esa oposición                    → fail-open con aviso
 */
const path = require('path')
const { Client } = require('pg')
const { pgConfig } = require(path.join(__dirname, '..', '..', 'lib', 'db', 'pgSsl.cjs'))
const { reunirHechos } = require(path.join(__dirname, '..', 'temario', 'revisar-oposicion.cjs'))
const { evaluarRevisionTemario } = require(path.join(__dirname, '..', '..', 'lib', 'temario', 'revisionEpigrafe.cjs'))

const evalua = (hechos) =>
  evaluarRevisionTemario({ esQuejaDeScope: true, temasAfectados: hechos.temasAfectados, oposicion: hechos.oposicion })

/** Una pregunta activa servida por ESE tema (por número de artículo o por comodín NULL). */
const SQL_PREGUNTA_DEL_TEMA = `
  SELECT q.id FROM topics t
    JOIN topic_scope ts ON ts.topic_id = t.id
    JOIN articles a ON a.law_id = ts.law_id
                   AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN questions q ON q.primary_article_id = a.id AND q.is_active
   WHERE t.position_type = $1 AND t.topic_number = $2 AND t.is_active
   LIMIT 1`

async function main() {
  const c = new Client(pgConfig())
  await c.connect()
  const fallos = []
  const di = (ok, txt) => { console.log(`${ok ? '  ✅' : '  ❌'} ${txt}`); if (!ok) fallos.push(txt) }
  try {
    // Se busca una oposición que tenga a la vez temas con Paso 1 y temas sin él: es donde la
    // puerta tiene que discriminar. Si no existe ninguna, se dice — no se finge un verde.
    const candidatas = (await c.query(`
      SELECT t.position_type,
             count(*) FILTER (WHERE ev.state = 'verified_literal') con,
             count(*) FILTER (WHERE ev.state IS DISTINCT FROM 'verified_literal') sin
        FROM topics t LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id = t.id
       WHERE t.is_active
       GROUP BY 1 HAVING count(*) FILTER (WHERE ev.state = 'verified_literal') > 0
                    AND count(*) FILTER (WHERE ev.state IS DISTINCT FROM 'verified_literal') > 0
       ORDER BY 2 DESC LIMIT 15`)).rows
    if (!candidatas.length) {
      console.log('⚠️  ninguna oposición mezcla temas con y sin Paso 1: no hay caso que simular')
      process.exit(0)
    }
    // Los temas se eligen entre los que SIRVEN alguna pregunta: un tema vacío no ejercita la
    // consulta de temas afectados, y elegirlo daría un fallo que no es de la puerta. Se recorren
    // varias oposiciones porque la primera candidata puede tener sus temas sin Paso 1 vacíos.
    let pt = null, base = null, conPaso1 = null, sinPaso1 = null
    for (const cand of candidatas) {
      const h = await reunirHechos(c, cand.position_type, null)
      const conPreguntas = new Set(
        (await c.query(`
          SELECT DISTINCT t.topic_number tema FROM topics t
            JOIN topic_scope ts ON ts.topic_id = t.id
            JOIN articles a ON a.law_id = ts.law_id
                           AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
            JOIN questions q ON q.primary_article_id = a.id AND q.is_active
           WHERE t.position_type = $1 AND t.is_active`, [cand.position_type])).rows.map((r) => String(r.tema)),
      )
      const a = h.todos.find((t) => t.epigrafeState === 'verified_literal' && conPreguntas.has(String(t.tema)))
      const b = h.todos.find((t) => t.epigrafeState !== 'verified_literal' && conPreguntas.has(String(t.tema)))
      if (a && b) { pt = cand; base = h; conPaso1 = a; sinPaso1 = b; break }
    }
    if (!pt) {
      console.log(`⚠️  ninguna de las ${candidatas.length} candidatas tiene a la vez un tema CON y otro SIN Paso 1 que sirvan preguntas: no concluyente`)
      process.exit(0)
    }
    console.log(`\n=== sim puerta de temario — ${pt.position_type} (${pt.con} con Paso 1 · ${pt.sin} sin) ===\n`)

    // ── caso 1: tema en orden ─────────────────────────────────────────────────────────────
    const [q1] = (await c.query(SQL_PREGUNTA_DEL_TEMA, [pt.position_type, conPaso1.tema])).rows
    if (q1) {
      const v = evalua(await reunirHechos(c, pt.position_type, q1.id))
      di(v.verde, `T${conPaso1.tema} (Paso 1 hecho) → deja responder${v.verde ? '' : ' — BLOQUEA: ' + v.bloqueos.map((b) => b.code)}`)
    } else di(false, `no se encontró pregunta servida por T${conPaso1.tema}: la consulta de temas afectados no localiza nada`)

    // ── caso 2: tema sin Paso 1 ───────────────────────────────────────────────────────────
    const [q2] = (await c.query(SQL_PREGUNTA_DEL_TEMA, [pt.position_type, sinPaso1.tema])).rows
    if (q2) {
      const v = evalua(await reunirHechos(c, pt.position_type, q2.id))
      di(!v.verde && v.bloqueos.some((b) => b.code === 'paso1_pendiente'),
        `T${sinPaso1.tema} (sin Paso 1) → bloquea con paso1_pendiente [${v.bloqueos.map((b) => b.code).join(',') || 'ninguno'}]`)
      di(v.bloqueos.every((b) => b.comando), 'todo bloqueo trae el comando que lo satisface')
    } else di(false, `no se encontró pregunta servida por T${sinPaso1.tema}`)

    // ── caso 3: pregunta ajena a la oposición ─────────────────────────────────────────────
    const [q3] = (await c.query(`
      SELECT q.id FROM questions q
       WHERE q.is_active AND q.primary_article_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM articles a JOIN topic_scope ts ON ts.law_id = a.law_id
             JOIN topics t ON t.id = ts.topic_id AND t.position_type = $1 AND t.is_active
            WHERE a.id = q.primary_article_id
              AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers)))
       LIMIT 1`, [pt.position_type])).rows
    if (q3) {
      const v = evalua(await reunirHechos(c, pt.position_type, q3.id))
      di(v.verde && v.avisos.some((a) => a.code === 'tema_no_localizado'),
        'pregunta que no sirve ningún tema → fail-open con aviso, no bloqueo mudo')
    }

    console.log(fallos.length ? `\n❌ ${fallos.length} comprobación(es) fallida(s)\n` : '\n✅ la puerta discrimina los tres casos\n')
    process.exit(fallos.length ? 1 : 0)
  } finally {
    await c.end()
  }
}

main().catch((e) => { console.error('⚠️  sim no concluyente:', e.message); process.exit(2) })
