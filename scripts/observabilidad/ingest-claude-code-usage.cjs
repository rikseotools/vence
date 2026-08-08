#!/usr/bin/env node
// scripts/observabilidad/ingest-claude-code-usage.cjs
//
// Mete el consumo de CLAUDE CODE en el MISMO stream de observabilidad que el resto del gasto LLM
// (`observable_events`, `event_type='llm_call'`), para que haya **un solo sitio** donde mirar
// cuánto consume el sistema, venga de la API que facturamos o de la suscripción que no.
//
//   npm run llm:ingest-claude-code            # los últimos 7 días (idempotente)
//   npm run llm:ingest-claude-code -- --dias 30
//   npm run llm:ingest-claude-code -- --dry
//
// ## Por qué existe (26/07/2026)
//
// Claude Code corre con **suscripción Max**: no hay factura por token, así que su consumo no
// aparece en ninguna factura… y tampoco aparecía en ninguna parte nuestra. Con 2-10 sesiones en
// paralelo, eso es el grueso del consumo real del sistema y era invisible: medido el 26/07,
// **~4.476 M de tokens procesados en un día** (11,6 M de output y 4.423 M de caché leída).
//
// Que no se facture no quiere decir que no importe: la suscripción tiene **límites de uso**, y
// toparlos para una sesión. Ver qué sesión se come la cuota es exactamente lo que esto permite.
//
// ## De dónde salen los datos
//
// De los transcripts que Claude Code deja en `~/.claude/projects/**/*.jsonl`: cada respuesta del
// modelo trae su bloque `usage` (input, output, caché escrita y leída). Es local, no necesita
// ninguna clave ni llamar a Anthropic.
//
// ## Idempotencia
//
// Se agrega por (día, sesión) y se emite UN evento por par, con `dedupeKey` determinista. Antes
// de insertar se borran los eventos de esa misma clave: correrlo dos veces deja lo mismo, y
// re-correr un día ya ingerido lo actualiza en vez de duplicarlo.

require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const os = require('os')
const path = require('path')
const postgres = require('postgres')
const CS = require('../../lib/observability/cuentaDeSesion.cjs')
const CUENTAS = require('../../lib/flota/cuentas.cjs')

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const iDias = argv.indexOf('--dias')
const DIAS = iDias >= 0 ? Math.max(1, parseInt(argv[iDias + 1] || '7', 10)) : 7
const RAIZ_TRANSCRIPTS = process.env.CLAUDE_TRANSCRIPTS_DIR || path.join(os.homedir(), '.claude', 'projects')

function conectar() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurado (RDS)')
    process.exit(2)
  }
  return postgres(process.env.DATABASE_URL, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
}

function* ficheros(dir) {
  let entradas
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entradas) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* ficheros(p)
    else if (e.name.endsWith('.jsonl')) yield p
  }
}

/**
 * Agrega el uso por (día, sesión, modelo) leyendo los transcripts.
 * @returns {Map<string, {dia:string, sesion:string, modelo:string, proyecto:string, input:number, output:number, cacheW:number, cacheR:number, respuestas:number}>}
 */
function agregar(desdeIso) {
  const acc = new Map()
  for (const f of ficheros(RAIZ_TRANSCRIPTS)) {
    const sesion = path.basename(f, '.jsonl')
    const proyecto = path.basename(path.dirname(f))
    let contenido
    try {
      contenido = fs.readFileSync(f, 'utf8')
    } catch {
      continue
    }
    for (const linea of contenido.split('\n')) {
      // Filtro barato antes de parsear: los transcripts son de cientos de MB.
      if (!linea || linea.indexOf('"usage"') === -1) continue
      let d
      try {
        d = JSON.parse(linea)
      } catch {
        continue
      }
      const ts = d.timestamp || ''
      if (!ts || ts.slice(0, 10) < desdeIso) continue
      const msg = d.message || {}
      const u = msg.usage
      if (!u) continue
      const dia = ts.slice(0, 10)
      const modelo = msg.model || 'desconocido'
      const clave = `${dia}|${sesion}|${modelo}`
      const e = acc.get(clave) || { dia, sesion, modelo, proyecto, input: 0, output: 0, cacheW: 0, cacheR: 0, respuestas: 0 }
      e.input += u.input_tokens || 0
      e.output += u.output_tokens || 0
      e.cacheW += u.cache_creation_input_tokens || 0
      e.cacheR += u.cache_read_input_tokens || 0
      e.respuestas += 1
      acc.set(clave, e)
    }
  }
  return acc
}

async function main() {
  // La cuenta de ESTA máquina en ESTE momento. Los transcripts que se van a ingerir se
  // atribuyen a ella: es cierto para lo que se acaba de generar, que es el caso normal (el
  // ingest corre a menudo). Si se ingiere un histórico largo tras haber rotado, la atribución
  // de la parte vieja será la de ahora — por eso `cuentaVia` queda registrado, para poder
  // distinguir después una atribución fuerte (`flota`, `env`) de una por defecto (`global`).
  const { cuenta: cuentaActual, via: cuentaVia } = CS.cuentaDeSesion({
    trabajador: process.env.VENCE_TRABAJADOR || null,
    env: process.env,
    global: CS.cuentaGlobal(),
    resolverFlota: (n) => CUENTAS.cuentaDe(n, CUENTAS.cuentasDisponibles(process.env)),
  })
  console.log(`   cuenta atribuida a lo que se ingiera ahora: ${cuentaActual} (vía ${cuentaVia})`)

  const desde = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10)
  console.log(`→ leyendo transcripts de Claude Code desde ${desde} (${RAIZ_TRANSCRIPTS})`)
  const acc = agregar(desde)
  if (!acc.size) {
    console.log('   (sin datos en ese rango)')
    return
  }

  const filas = [...acc.values()].sort((a, b) => (a.dia < b.dia ? 1 : -1))
  const totales = filas.reduce(
    (t, f) => ({
      input: t.input + f.input,
      output: t.output + f.output,
      cacheW: t.cacheW + f.cacheW,
      cacheR: t.cacheR + f.cacheR,
      respuestas: t.respuestas + f.respuestas,
    }),
    { input: 0, output: 0, cacheW: 0, cacheR: 0, respuestas: 0 },
  )
  const M = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}K`)
  console.log(
    `   ${filas.length} (día × sesión × modelo) · ${totales.respuestas} respuestas · ` +
      `output ${M(totales.output)} · caché leída ${M(totales.cacheR)}`,
  )

  if (DRY) {
    console.log('\n🔍 DRY-RUN: no se escribe nada. Muestra:')
    filas.slice(0, 8).forEach((f) =>
      console.log(`   ${f.dia} · ${f.sesion.slice(0, 8)} · ${f.modelo} · out ${M(f.output)} · cache_r ${M(f.cacheR)}`),
    )
    return
  }

  const sql = conectar()
  let escritos = 0
  for (const f of filas) {
    const dedupeKey = `claude-code:${f.dia}:${f.sesion}:${f.modelo}`
    await sql.begin(async (tx) => {
      // Idempotente: la clave determinista manda. Re-ingerir un día lo ACTUALIZA, no lo duplica.
      await tx`DELETE FROM observable_events WHERE event_type = 'llm_call' AND metadata->>'dedupeKey' = ${dedupeKey}`
      await tx`
        INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
        VALUES (gen_random_uuid(), ${f.dia + 'T12:00:00Z'}, 'claude-code', 'info', 'llm_call',
                ${sql.json({
                  ok: true,
                  provider: 'claude-code',
                  model: f.modelo,
                  feature: 'claude_code',
                  // La suscripción NO factura por token: el coste es 0 a propósito, y `billing`
                  // lo dice para que nadie sume peras con manzanas al agregar el gasto.
                  billing: 'suscripcion',
                  estimatedCostUsd: 0,
                  inputTokens: f.input,
                  outputTokens: f.output,
                  cacheWriteTokens: f.cacheW,
                  cacheReadTokens: f.cacheR,
                  totalTokens: f.input + f.output + f.cacheW + f.cacheR,
                  respuestas: f.respuestas,
                  sessionId: f.sesion,
                  proyecto: f.proyecto,
                  // [T-709] DE QUÉ CUENTA salió. Se sella AQUÍ y no se deduce después porque
                  // los transcripts NO la guardan (medido: 0 de 355), así que este es el único
                  // momento en que se sabe. Lo anterior a esto se queda sin atribuir para
                  // siempre — y se marca como tal en vez de suponer la cuenta actual, que es lo
                  // que invalidaría la medida el día que se rote.
                  cuenta: cuentaActual,
                  cuentaVia: cuentaVia,
                  dedupeKey,
                })}, NOW())`
    })
    escritos++
  }
  await sql.end()
  console.log(`\n✅ ${escritos} evento(s) 'llm_call' de Claude Code al stream compartido (idempotente).`)
  console.log('   Consulta todo el gasto junto:  npm run llm:gasto')
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
