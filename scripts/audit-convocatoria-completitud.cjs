#!/usr/bin/env node
/**
 * audit-convocatoria-completitud.cjs — ¿se completó el trabajo, o se olvidaron campos?
 *
 * POR QUÉ EXISTE (16/07/2026): las capas 2-4 del sistema de convocatorias las hace Claude con
 * criterio (ver `docs/runbooks/verificar-convocatorias.md`), y **un humano olvida cosas**. En el
 * primer uso real (SERMAS, señal OEP) se quedaron sin aplicar `inscription_start`/`inscription_deadline`
 * y `sistema_selectivo` — datos que el documento YA daba y que el LLM YA había extraído — y la cita
 * registrada como prueba resultó ser el MEMBRETE de la página ("VIERNES 4 DE JULIO DE 2025 B.O.C.M.
 * Núm. 158 Pág. 171"), no una cláusula.
 *
 * IDEA CLAVE: no se puede comprobar que Claude "siguió el manual". Sí se puede comprobar el RASTRO
 * que seguirlo deja. Si una señal está `applied` pero no hay documento curado ni verificación, se
 * saltaron pasos. Si el `llm_extraction` del documento trae un dato y la convocatoria lo tiene NULL,
 * se olvidó aplicarlo. La propia extracción es la lista de comprobación.
 *
 * Uso:  node scripts/audit-convocatoria-completitud.cjs            (informe)
 *       node scripts/audit-convocatoria-completitud.cjs --json     (para el sweep / CI)
 *       node scripts/audit-convocatoria-completitud.cjs --gate     (exit 1 si hay fallos → CI)
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const JSON_OUT = process.argv.includes('--json')
const GATE = process.argv.includes('--gate')

/**
 * Una cita debe ser una CLÁUSULA, no el membrete del boletín. Detecta la basura típica de PDF:
 * cabeceras de página, numeración y nombres de boletín sin texto normativo alrededor.
 * Exportado para poder testearlo sin BD.
 */
function citaEsBasura(cita) {
  if (!cita || cita.trim().length < 25) return true
  const t = cita.trim()
  // Criterio: ¿tiene PROSA? Un membrete ("VIERNES 4 DE JULIO DE 2025 B.O.C.M. Núm. 158 Pág. 171")
  // es casi todo mayúsculas, cifras y abreviaturas: no llega a 5 palabras en minúscula. Una cláusula
  // real sí.
  //
  // ⚠️ La 1ª versión pedía una LISTA BLANCA de verbos normativos (ser/disponer/establecer/convocar…)
  // y su propio test la tumbó: rechazaba "La celebración del primer ejercicio se realizará en mayo de
  // 2027" —LA cita del caso Marta— porque "realizará" no estaba en mi lista. Adivinar el vocabulario
  // del BOE es el mismo error que adivinar el de los hitos. Se mide la forma, no el diccionario.
  const palabrasEnProsa = (t.match(/\b[a-záéíóúñü]{3,}\b/g) || []).length
  return palabrasEnProsa < 5
}

// Qué campo de `convocatorias` alimenta cada tipo de hito extraído. Si el documento lo dice y la
// convocatoria lo tiene NULL, es un olvido — no una decisión.
const HITO_A_CAMPO = {
  plazo_inicio: 'inscription_start',
  plazo_fin: 'inscription_deadline',
  ejercicio_1: 'exam_date',
}

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const F = []
  const add = (slug, kind, msg, detail) => F.push({ slug, kind, msg, detail })

  // ── 1. El documento dice un dato y la convocatoria lo tiene VACÍO (olvido al aplicar)
  const docs = (await c.query(`
    SELECT d.id, d.referencia, d.llm_extraction, d.convocatoria_id, o.slug,
           cv.inscription_start, cv.inscription_deadline, cv.exam_date, cv.plazas_libres, cv.sistema_selectivo
      FROM convocatoria_documentos d
      JOIN convocatorias cv ON cv.id = d.convocatoria_id
      JOIN oposiciones o ON o.id = cv.oposicion_id
     WHERE d.curado = true AND d.llm_extraction IS NOT NULL`)).rows

  for (const d of docs) {
    const ext = d.llm_extraction || {}
    for (const h of ext.hitos || []) {
      const campo = HITO_A_CAMPO[h.tipo]
      if (campo && d[campo] === null) {
        add(d.slug, 'campo_extraido_sin_aplicar',
          `el documento ${d.referencia} da ${h.tipo}=${h.fecha} pero convocatorias.${campo} está NULL`,
          { campo, valor: h.fecha, cita: h.cita_literal, documento: d.referencia })
      }
    }
    if (ext.plazas_libres != null && d.plazas_libres === null) {
      add(d.slug, 'campo_extraido_sin_aplicar', `el documento da plazas_libres=${ext.plazas_libres} y está NULL`, { campo: 'plazas_libres' })
    }
    // ── 2. Hito extraído del documento que no existe en el timeline (se perdió por el camino)
    for (const h of ext.hitos || []) {
      const hay = (await c.query(
        `SELECT 1 FROM convocatoria_hitos WHERE convocatoria_id=$1 AND tipo=$2 LIMIT 1`, [d.convocatoria_id, h.tipo])).rowCount
      if (!hay) {
        add(d.slug, 'hito_extraido_sin_guardar',
          `${h.tipo} (${h.fecha}) sale del documento con cita y NO está en convocatoria_hitos`,
          { tipo: h.tipo, fecha: h.fecha, cita: h.cita_literal })
      }
    }
  }

  // ── 3. Citas basura: el membrete del boletín no prueba nada
  const vers = (await c.query(`
    SELECT o.slug, v.source_snippet, v.state FROM convocatoria_verification v
      JOIN convocatorias cv ON cv.id = v.convocatoria_id
      JOIN oposiciones o ON o.id = cv.oposicion_id
     WHERE v.state LIKE 'verified%'`)).rows
  for (const v of vers) {
    if (citaEsBasura(v.source_snippet)) {
      add(v.slug, 'cita_no_prueba_nada',
        `la verificación se apoya en algo que no es una cláusula: "${(v.source_snippet || '').slice(0, 60)}"`, {})
    }
  }

  // ── 4. Señal aplicada SIN rastro de haber seguido el manual (ni documento curado, ni verificación)
  //    ⚠️ SOLO desde que la doctrina existe (16/07/2026). Juzgar el trabajo pasado con una regla que
  //    no existía es injusto Y ruidoso: la primera versión escupía 82 hallazgos de sesiones previas,
  //    todos falsos. Un guardarraíl que grita por trabajo que nadie pudo hacer mal se apaga solo.
  const sig = (await c.query(`
    SELECT o.slug, count(*)::int n FROM oep_detection_signals s
      JOIN oposiciones o ON o.id = s.oposicion_id
     WHERE s.status='applied' AND s.reviewed_at > '2026-07-16'::date
       AND NOT EXISTS (SELECT 1 FROM convocatorias cv JOIN convocatoria_documentos d ON d.convocatoria_id=cv.id
                        WHERE cv.oposicion_id=o.id AND d.curado=true)
     GROUP BY o.slug`)).rows
  for (const s of sig) {
    add(s.slug, 'senal_aplicada_sin_documento',
      `${s.n} señal(es) aplicadas esta semana sin NINGÚN documento curado: ¿se verificó contra la fuente?`, {})
  }

  // ── 5. La señal está enganchada a un cuerpo DISTINTO del que detectó (bug del matcher del radar)
  //
  //    Caso real que lo motiva (16/07): una señal de "Administrativo/a por Promoción Interna" (C1,
  //    OEP 2022-2023) colgaba de `auxiliar-administrativo-ayuntamiento-valladolid` (C2, OEP 2026).
  //    Aplicarla habría destrozado la fila. Y NO era hipotético: `auxiliar-administrativo-universidad-
  //    rovira-virgili` (C2) YA tenía aplicada una señal de "Administratiu/va - Escala Administrativa,
  //    subgrup C1" (25/06) — se le cambió el estado desde datos de OTRO cuerpo.
  //
  //    ⚠️ REGLA DELIBERADAMENTE ESTRECHA: solo el par Auxiliar(C2) vs Administrativo(C1), que son
  //    cuerpos distintos sin discusión (temario y oposición distintos). Una regla amplia de
  //    "parecido de nombres" sería una máquina de falsos positivos, y un guardarraíl ruidoso se apaga.
  const mism = (await c.query(`
    SELECT o.slug, s.status, s.confidence_score conf,
           s.raw_extraction->'extraction'->>'cuerpoDetectado' cuerpo
      FROM oep_detection_signals s JOIN oposiciones o ON o.id = s.oposicion_id
     WHERE s.status IN ('pending','applied')
       AND s.raw_extraction->'extraction'->>'cuerpoDetectado' IS NOT NULL
       AND o.slug LIKE 'auxiliar-%'
       AND s.raw_extraction->'extraction'->>'cuerpoDetectado' !~* 'auxiliar'`)).rows
  for (const m of mism) {
    add(m.slug, 'senal_cuerpo_no_cuadra',
      `${m.status}: la fila es Auxiliar (C2) y la señal detectó "${m.cuerpo}" — ¿otro cuerpo? NO aplicar: catalogar fila nueva`,
      { cuerpo_detectado: m.cuerpo, status: m.status, confianza: m.conf })
  }

  await c.end()

  if (JSON_OUT) { console.log(JSON.stringify(F, null, 1)); }
  else {
    console.log(`\n═══ COMPLETITUD DE CONVOCATORIAS — ${F.length} hallazgo(s)\n`)
    const porKind = F.reduce((a, f) => ((a[f.kind] = a[f.kind] || []).push(f), a), {})
    for (const [kind, fs] of Object.entries(porKind)) {
      console.log(`── ${kind} (${fs.length})`)
      for (const f of fs) console.log(`   · ${f.slug}: ${f.msg}`)
      console.log()
    }
    if (!F.length) console.log('  ✅ nada olvidado\n')
  }
  if (GATE && F.length) process.exit(1)
}

module.exports = { citaEsBasura }
if (require.main === module) main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
