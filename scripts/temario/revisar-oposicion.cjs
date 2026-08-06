#!/usr/bin/env node
/**
 * revisar-oposicion.cjs — «¿está el temario de ESTA oposición en condiciones de responder una
 * queja de programa?» Corre la Regla previa OBLIGATORIA de `verificar-epigrafes-scope.md` §2 y
 * da un veredicto con código de salida.
 *
 *   node scripts/temario/revisar-oposicion.cjs <position_type> [--pregunta <question_id>] [--json]
 *   npm run epigrafe:revision -- <position_type> [--pregunta <question_id>]
 *
 * Con `--pregunta` acota el veredicto a los temas que SIRVEN esa pregunta, que es lo que hace la
 * puerta cumplible: se exige poner en orden uno o dos temas, no los veintiuno. Sin ella, informa
 * de la oposición entera pero no bloquea nada (no hay caso concreto que proteger).
 *
 * El juicio vive en el núcleo puro `lib/temario/revisionEpigrafe.cjs` (con tests). Aquí solo se
 * reúnen los hechos de RDS.
 *
 * Salida: 0 = se puede responder · 1 = hay bloqueos · 2 = error de conexión (fail-open: quien lo
 * llama decide, y la puerta de `cerrar.ts` no bloquea sin poder comprobar).
 */
const path = require('path')
const { Client } = require('pg')
const { pgConfig } = require(path.join(__dirname, '..', '..', 'lib', 'db', 'pgSsl.cjs'))
const { evaluarRevisionTemario } = require(path.join(__dirname, '..', '..', 'lib', 'temario', 'revisionEpigrafe.cjs'))

/**
 * Los temas que SIRVEN una pregunta: aquellos cuyo `topic_scope` incluye su artículo principal.
 * Es la misma regla que usa el serve (`article_numbers IS NULL` = la ley entera), y por eso se
 * copia aquí en vez de aproximarla: un tema que sirve la pregunta por el comodín NULL cuenta
 * igual que uno que la sirve por número.
 */
const SQL_TEMAS_QUE_SIRVEN = `
  SELECT t.topic_number tema, t.title titulo,
         (ts.article_numbers = '{}'::text[]) fila_rota
    FROM questions q
    JOIN articles a  ON a.id = q.primary_article_id
    JOIN topic_scope ts ON ts.law_id = a.law_id
    JOIN topics t    ON t.id = ts.topic_id AND t.position_type = $2 AND t.is_active
   WHERE q.id = $1::uuid
     AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
   GROUP BY 1,2,3 ORDER BY 1`

async function reunirHechos(c, positionType, questionId) {
  const estados = new Map()
  const filas = (await c.query(`
    SELECT t.topic_number tema, t.title titulo,
           ev.state epigrafe_state,
           sv.state scope_state, sv.verified_by, sv.agent_run_id
      FROM topics t
      LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id = t.id
      LEFT JOIN topic_scope_verification   sv ON sv.topic_id = t.id
     WHERE t.position_type = $1 AND t.is_active
     ORDER BY t.topic_number`, [positionType])).rows
  for (const f of filas) estados.set(String(f.tema), f)

  const rotas = new Set(
    (await c.query(`
      SELECT DISTINCT t.topic_number tema FROM topic_scope ts
        JOIN topics t ON t.id = ts.topic_id
       WHERE t.position_type = $1 AND ts.article_numbers = '{}'::text[]`, [positionType])).rows.map((r) => String(r.tema)),
  )

  let afectados = []
  if (questionId) {
    const r = await c.query(SQL_TEMAS_QUE_SIRVEN, [questionId, positionType])
    afectados = r.rows.map((x) => String(x.tema))
  }

  const monta = (n) => {
    const f = estados.get(n) || {}
    return {
      tema: n,
      titulo: f.titulo,
      epigrafeState: f.epigrafe_state,
      scopeState: f.scope_state,
      scopeVerifiedBy: f.verified_by,
      scopeRunId: f.agent_run_id,
      filaRota: rotas.has(n),
    }
  }

  const todos = [...estados.keys()].map(monta)
  return {
    todos,
    temasAfectados: afectados.map(monta),
    oposicion: {
      positionType,
      temasTotales: todos.length,
      sinPaso1: todos.filter((t) => t.epigrafeState !== 'verified_literal').length,
      filasRotas: rotas.size,
      selladoSinPipeline: todos.filter(
        (t) => t.scopeState === 'verified_correct' && (t.scopeVerifiedBy === 'claude_direct' || !t.scopeRunId || String(t.scopeRunId).startsWith('--')),
      ).length,
    },
  }
}

function imprimir(hechos, veredicto, positionType) {
  const o = hechos.oposicion
  console.log(`\n=== REVISIÓN DE TEMARIO — ${positionType} ===`)
  console.log(`   temas: ${o.temasTotales} · Paso 1 pendiente: ${o.sinPaso1} · filas rotas: ${o.filasRotas} · Paso 2 sellado fuera del pipeline: ${o.selladoSinPipeline}`)
  if (hechos.temasAfectados.length) {
    console.log(`\n   temas que SIRVEN la pregunta: ${hechos.temasAfectados.map((t) => 'T' + t.tema).join(', ')}`)
  }
  for (const b of veredicto.bloqueos) {
    console.log(`\n   🛑 [${b.code}] ${b.detalle}`)
    if (b.comando) console.log(`      → ${b.comando.replace('<position_type>', positionType)}`)
  }
  for (const a of veredicto.avisos) console.log(`   ⚠️  [${a.code}] ${a.detalle}`)
  console.log(
    veredicto.verde
      ? '\n✅ se puede responder: lo que sirve esta pregunta está en orden'
      : `\n🛑 NO respondas todavía: ${veredicto.bloqueos.length} bloqueo(s) arriba, con su comando`,
  )
  console.log('   manual: docs/runbooks/verificar-epigrafes-scope.md\n')
}

async function main() {
  const args = process.argv.slice(2)
  const positionType = args.find((a) => !a.startsWith('--'))
  const i = args.indexOf('--pregunta')
  const questionId = i >= 0 ? args[i + 1] : null
  if (!positionType) {
    console.error('uso: revisar-oposicion.cjs <position_type> [--pregunta <question_id>] [--json]')
    process.exit(2)
  }
  // Solo lectura (SELECT sobre topics/topic_scope/questions/articles): un trabajador de la flota
  // tiene esas tablas detrás de VENCE_LECTOR_URL (vence_lector), NO de DATABASE_URL
  // (vence_coordinacion, solo 4 tablas de coordinación — T-539). Sin esto, la puerta que exige
  // el manual (§ QUEJA DE TEMARIO) muere con "permission denied for table topics" antes de dar
  // veredicto, mismo patrón que T-581 en revisar-impugnacion.cjs. Con `.env.local` completo
  // (una persona) no cambia nada: VENCE_LECTOR_URL no existe ahí y se usa DATABASE_URL igual.
  const c = new Client(pgConfig(process.env.VENCE_LECTOR_URL || process.env.DATABASE_URL))
  await c.connect()
  try {
    const hechos = await reunirHechos(c, positionType, questionId)
    const veredicto = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: hechos.temasAfectados,
      oposicion: hechos.oposicion,
    })
    if (args.includes('--json')) console.log(JSON.stringify({ hechos, veredicto }, null, 1))
    else imprimir(hechos, veredicto, positionType)
    process.exit(veredicto.verde ? 0 : 1)
  } finally {
    await c.end()
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('⚠️  no se ha podido comprobar el temario:', e.message)
    process.exit(2) // fail-open: sin BD no se afirma nada
  })
}

module.exports = { reunirHechos }
