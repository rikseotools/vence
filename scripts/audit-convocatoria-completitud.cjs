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

/**
 * ¿Miente esta tarjeta de la landing? Devuelve [] si no hay contradicción DEMOSTRABLE.
 *
 * `row`: fila de oposiciones_ssot (l, p, d, total, exam_date). `t`: entry {numero, texto}.
 * Pura y exportada a propósito: la regla 5b (examen inventado) solo tenía UN caso real en toda la BD
 * —celador-sescam-clm— y al arreglarlo se quedó sin nadie a quien disparar. Una regla que nunca se
 * ha visto disparar no es un guardarraíl, es una esperanza: se prueba aquí sin BD.
 */
function revisarTarjeta(row, t) {
  const out = []
  const numero = typeof t?.numero === 'string' ? t.numero.trim() : ''
  const texto = typeof t?.texto === 'string' ? t.texto : ''
  if (!numero || numero.includes('{')) return out   // {plazasTotal} y compañía no pueden mentir

  // 5a. Cifra de plazas que no cuadra con NINGUNA lectura razonable de las columnas
  //
  // "537+" y "~537" siguen afirmando 537; y no todo el mundo escribe "plazas" (vacantes, puestos).
  // Falsos negativos reales encontrados por la auditoría adversarial del 16/07.
  const num = numero.replace(/[~+≈]/g, '').trim()
  if (/^[\d.]+$/.test(num) && /plaza|vacante|puesto/i.test(texto) && row.total != null) {
    const n = parseInt(num.replace(/\./g, ''), 10)
    // "..." pasa el regex de [\d.] y da NaN → acusaría a una tarjeta que no afirma ninguna cifra.
    if (!Number.isFinite(n)) return out
    // Number(): `plazas_total` sale de un sum() sobre jsonb → BIGINT, y node-pg entrega los bigint
    // como STRING. Sin coerción, [264,264,51,"585"].includes(585) es false y el auditor acusa de
    // mentir a las tarjetas HONESTAS (7 de 11 en la 1ª pasada: Navarra, La Rioja, Canarias…). Un
    // guardarraíl que grita en falso se acaba apagando, y entonces no guarda nada.
    const lecturas = [row.l, row.p, row.d, row.total, (row.l ?? 0) + (row.d ?? 0)]
      .filter((x) => x != null).map(Number)
    if (!lecturas.includes(n)) {
      out.push({ kind: 'tarjeta_contradice_columnas',
        msg: `la tarjeta anuncia "${numero} ${texto}" pero la BD dice L=${row.l} P=${row.p} D=${row.d} → total=${row.total}. Usar {plazasTotal}/{plazasLibres}, no teclear`,
        detail: { tarjeta: numero, texto, plazas_total: row.total, libres: row.l } })
    }
  }

  // 5b. Examen anunciado con una fecha que la BD no tiene
  //
  // ⚠️ La 1ª versión solo entendía "18/04" y "2026", y tcae-aragon —que anuncia «[7 jun] Fecha
  // examen 2026» con exam_date NULL y estado 'examen_realizado'— se le escapó. La gente escribe las
  // fechas como le da la gana; el mes abreviado es tan fecha como la barra. La auditoría adversarial
  // añadió "18-04-2026" y "abril 2026" a la lista de lo que se colaba. Es whack-a-mole, sí: por eso
  // se acepta CUALQUIER forma reconocible en vez de perseguir la de ayer.
  const MESES = 'ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic'
  const pareceFecha = /^\d{1,2}[/\-.]\d{1,2}([/\-.]\d{2,4})?$/.test(numero)
    || /^(19|20)\d{2}$/.test(numero)
    || new RegExp(`^\\d{1,2}\\s*(de\\s*)?(${MESES})`, 'i').test(numero)
    || new RegExp(`^(${MESES})[a-záé]*\\s*(de\\s*)?(19|20)?\\d{2}`, 'i').test(numero)
  // «Último examen oficial: 2025» NO anuncia el examen de esta convocatoria: describe el pasado. Sin
  // esto, el auditor grita a una tarjeta honesta — y el ruido apaga los guardarraíles.
  const esHistorico = /últim|ultim|anterior|pasad|históric|historic|previo/i.test(texto)
  if (pareceFecha && /examen/i.test(`${texto} ${numero}`) && !esHistorico && !row.exam_date) {
    out.push({ kind: 'tarjeta_examen_sin_fecha_en_bd',
      msg: `la tarjeta anuncia "${numero} ${texto}" pero exam_date está NULL — o se aplica la fecha con su cita, o la tarjeta no puede afirmarla`,
      detail: { tarjeta: numero, texto } })
  }
  return out
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

  // ── 5. La TARJETA de la landing afirma una cifra que la BD desmiente
  //
  //    CASO REAL (16/07): la landing de `celador-sescam-clm` anunciaba «537 plazas totales» y
  //    «Examen 2026: 18/04». El DOCM nº 240 (NID 2025/9540, corpus DOCM-240-2025-9540) dice
  //    115 libres + 4 promoción + 9 discapacidad = 128, y el 537 no aparece en el documento. La
  //    fecha de examen era pura invención: `exam_date` NULL y `estado_proceso='oep_aprobada'` (solo
  //    está aprobada la OEP; sin convocatoria no puede haber examen). Nuestras COLUMNAS eran
  //    correctas: mentía solo la tarjeta, porque `landing_estadisticas` es texto libre donde alguien
  //    teclea un número que luego no se entera de nada cuando el dato cambia.
  //
  //    El arreglo estructural es `{plazasTotal}` / `{plazasLibres}` (se resuelven contra la vista al
  //    renderizar → no pueden driftar). Esta regla caza a los que aún tecleen.
  //
  //    ⚠️ SOLO CONTRADICCIONES, no ausencias: si la BD no tiene ninguna cifra (plazas_total NULL) no
  //    se puede afirmar que la tarjeta mienta, y un guardarraíl que grita sin pruebas se apaga. Se
  //    acepta cualquier lectura razonable del número (libres, promoción, discapacidad, total, o
  //    libres+discapacidad): se denuncia el que no cuadra con NINGUNA.
  const cards = (await c.query(`
    SELECT slug, plazas_libres l, plazas_promocion_interna p, plazas_discapacidad d,
           plazas_total total, exam_date, landing_estadisticas le
      FROM oposiciones_ssot
     WHERE is_active AND jsonb_typeof(landing_estadisticas) = 'array'`)).rows
  for (const row of cards) {
    for (const t of row.le || []) {
      for (const f of revisarTarjeta(row, t)) add(row.slug, f.kind, f.msg, f.detail)
    }
  }

  // ── 6. Afirmar plazas sin documento que las pruebe (ni declararse previsión)
  //
  //    REGLA (Manuel, 16/07): «cada OEP y cada convocatoria deben tener todos sus documentos
  //    completos, todo trackeable y verificable — es la única forma de que todo cuadre». Y: «debe
  //    indicarse si es previsión o son datos reales; las previsiones son previsiones».
  //
  //    Una cifra de plazas solo puede ser una de dos cosas: un HECHO (y entonces tiene su documento y
  //    su cita) o una PREVISIÓN (y entonces se declara con `plazas_prevision` + motivo). Lo que no
  //    puede ser es una cifra huérfana presentada como hecho: así es como auxiliar-administrativo-estado
  //    acabó con el 1.450 de la OEP 2026 dentro de una fila de 2025 con el 720 de la convocatoria de
  //    2025 — un total (2.170) que no existía en ningún documento del mundo.
  const huerfanas = (await c.query(`
    SELECT o.slug, cv.plazas_libres, cv.boe_reference, cv."año"
      FROM convocatorias cv JOIN oposiciones o ON o.id = cv.oposicion_id
     WHERE cv.is_current AND o.is_active
       AND cv.plazas_libres IS NOT NULL
       AND NOT cv.plazas_prevision
       AND NOT EXISTS (SELECT 1 FROM convocatoria_documentos d WHERE d.convocatoria_id = cv.id)
     ORDER BY cv.plazas_libres DESC NULLS LAST`)).rows
  for (const h of huerfanas) {
    add(h.slug, 'plazas_afirmadas_sin_documento',
      `afirma ${h.plazas_libres} plazas (ciclo ${h.año}) y NO hay documento en el corpus que lo pruebe. O se clona su fuente, o se marca plazas_prevision con motivo`,
      { plazas: h.plazas_libres, referencia: h.boe_reference, año: h.año })
  }

  // ── 6-bis. La tarjeta enseña un TOTAL que mezcla lo probado con lo que no
  //
  //    HALLAZGO (16/07, barriendo el cabo de las plazas sin documento): las convocatorias que clono
  //    suelen ser del TURNO LIBRE («por el sistema de acceso libre»), así que prueban plazas_libres
  //    pero NO plazas_promocion_interna. Al marcarlas verificadas quedaba un total medio probado
  //    (auxiliar-administrativo-galicia: 83 probadas + 65 que no aparecen en su resolución = 148).
  //
  //    ⚠️ Medido antes de alarmarse: de 40 landings con variable, **28 enseñan {plazasLibres}** (la
  //    cifra probada) y solo 12 el total — así que Galicia NO está enseñando nada sin probar. El
  //    riesgo es real solo cuando la tarjeta muestra el TOTAL. Esta regla mira justo eso, en vez de
  //    depender de que alguien se acuerde.
  //
  //    Convención: un `boe_reference` que empieza por ⚠️ es un dato que YO he marcado como no
  //    verificado. Si la tarjeta enseña el total de una fila así, el número que ve el opositor
  //    arrastra ese hueco.
  const totales = (await c.query(`
    SELECT slug, plazas_libres, plazas_promocion_interna, plazas_total, boe_reference,
           (SELECT cv3.plazas_prevision FROM convocatorias cv3
             WHERE cv3.oposicion_id = oposiciones_ssot.id AND cv3.is_current) plazas_prevision,
           (SELECT count(*)::int FROM convocatoria_documentos d
              JOIN convocatorias cv2 ON cv2.id = d.convocatoria_id
             WHERE cv2.oposicion_id = oposiciones_ssot.id) docs
      FROM oposiciones_ssot
     WHERE is_active AND landing_estadisticas::text LIKE '%plazasTotal%'`)).rows
  for (const t of totales) {
    // Una PREVISIÓN declarada no tiene documento POR DEFINICIÓN (la convocatoria aún no existe): eso
    // no es un hueco, es el caso que `plazas_prevision` existe para representar. Exigirle prueba sería
    // ruido — y el ruido apaga los guardarraíles. Lo que sí exige el CHECK es su motivo.
    if (t.plazas_prevision) continue
    if (t.docs === 0) {
      add(t.slug, 'tarjeta_total_sin_prueba',
        `la tarjeta enseña {plazasTotal} = ${t.plazas_total} y NO hay ningún documento en el corpus que lo respalde`,
        { total: t.plazas_total })
    } else if ((t.boe_reference || '').includes('⚠️')) {
      add(t.slug, 'tarjeta_total_mezcla_verificado_y_no',
        `la tarjeta enseña {plazasTotal} = ${t.plazas_total} pero su boe_reference está marcado ⚠️ (dato sin verificar): el número que ve el opositor arrastra ese hueco`,
        { total: t.plazas_total, libres: t.plazas_libres, promocion: t.plazas_promocion_interna })
    }
  }

  // ── 7. Landing publicada SIN tarjetas (el hero se queda mudo)
  //
  //    CASO REAL (16/07, me lo hice yo): un script leyó `convocatorias.landing_estadisticas` para
  //    reescribir las tarjetas, pero en esas dos filas la tarjeta vivía en la copia LEGACY de
  //    `oposiciones` (la vista hace COALESCE y cae al fallback) → leyó NULL, hizo `(le || [])` y
  //    escribió `[]` en LAS DOS tablas. Landing sin plazas, sin temas y sin título requerido.
  //    Se recuperaron de la caché de la web y del ciclo archivado, de milagro.
  //
  //    Ninguna regla anterior lo veía: una tarjeta vacía no CONTRADICE ninguna columna — simplemente
  //    no está. Los guardarraíles que comparan valores son ciegos a la ausencia.
  const mudas = (await c.query(`
    SELECT slug, jsonb_array_length(landing_estadisticas) n
      FROM oposiciones_ssot
     WHERE is_active AND jsonb_typeof(landing_estadisticas) = 'array'
       AND jsonb_array_length(landing_estadisticas) = 0`)).rows
  for (const m of mudas) {
    add(m.slug, 'tarjeta_vacia',
      'la landing está publicada y su hero no tiene NINGUNA tarjeta (landing_estadisticas = []). ¿Se borró al reescribirla?',
      {})
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

module.exports = { citaEsBasura, revisarTarjeta }
if (require.main === module) main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
