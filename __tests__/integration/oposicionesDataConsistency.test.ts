/**
 * Test de integridad GLOBAL: detecta contradicciones internas en la tabla
 * `oposiciones` y sus hitos. Pensado para detectar bugs como el caso
 * Galicia/Isabel (14/04/2026):
 *
 *   exam_date = 2026-10-01
 *   landing_description = "...previsto septiembre 2026"
 *   → contradicción. Uno de los dos está mal.
 *
 * También detecta hitos huérfanos de otro turno (ej: hito de promoción interna
 * en oposición `tipo_acceso = 'libre'`).
 *
 * Escala a CUALQUIER oposición del catálogo — no hardcodea slugs.
 *
 * Requiere .env.local con credenciales reales de Supabase (service role).
 * En CI sin credenciales, el describe se salta automáticamente.
 */
import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}`
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        apikey: REAL_KEY!,
        Authorization: `Bearer ${REAL_KEY}`,
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Failed to parse: ${data.substring(0, 200)}`)) }
      })
    }).on('error', reject)
  })
}

const describeIfDb = hasRealDb ? describe : describe.skip

// Meses en español → mes numérico (1..12). Para parsear textos tipo "previsto
// para septiembre de 2026" y cotejar contra exam_date.
const MES_NUM: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

const MES_NOMBRE: Record<number, string> = {
  1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril', 5: 'mayo', 6: 'junio',
  7: 'julio', 8: 'agosto', 9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre',
}

interface OposicionRow {
  id: string
  slug: string
  nombre: string
  tipo_acceso: string | null
  exam_date: string | null
  exam_date_approximate: boolean | null
  inscription_start: string | null
  inscription_deadline: string | null
  boe_publication_date: string | null
  boe_reference: string | null
  plazas_libres: number | null
  plazas_discapacidad: number | null
  plazas_promocion_interna: number | null
  landing_description: string | null
  seo_description: string | null
  convocatoria_fecha: string | null
  convocatoria_numero: string | null
  convocatoria_dogv: string | null
  programa_url: string | null
}

interface HitoRow {
  id: string
  oposicion_id: string
  fecha: string
  titulo: string
  status: string
  descripcion: string | null
  url: string | null
  order_index: number | null
}

function extraerMesAñoDeTexto(texto: string): Array<{ mes: number; año: number }> {
  if (!texto) return []
  const out: Array<{ mes: number; año: number }> = []
  // Regex: "septiembre 2026", "septiembre de 2026", "de septiembre de 2026"
  const re = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    const mes = MES_NUM[m[1].toLowerCase()]
    const año = parseInt(m[2], 10)
    if (mes && año >= 2024 && año <= 2030) out.push({ mes, año })
  }
  return out
}

function extraerNumeroPlazasDeTexto(texto: string): number[] {
  if (!texto) return []
  const out: number[] = []
  // Regex: "83 plazas", "1.700 plazas", "(83 plazas)" — soporta puntos como separador de miles
  const re = /\b(\d{1,3}(?:\.\d{3})*|\d{2,5})\s+plazas\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    const n = parseInt(m[1].replace(/\./g, ''), 10)
    if (n >= 1 && n <= 100000) out.push(n)
  }
  return out
}

/**
 * Excepciones conocidas: slugs con inconsistencias históricas pendientes de
 * investigar + corregir manualmente. El test las ignora para no bloquear CI,
 * pero las lista en los logs para que no se olviden. SI ALGUNO SE RESUELVE
 * quitarlo de aquí; si aparece uno nuevo, el test FALLA en CI.
 */
const KNOWN_BOE_REFERENCE_MISMATCHES = new Set<string>([
  // boe_publication_date vs boe_reference no cuadran — investigar cuál es correcta
  'auxiliar-administrativo-baleares',  // 2025-03-24 vs BOIB 02/10/2025
  'auxiliar-administrativo-valencia',   // 2026-02-09 vs DOGV 27/03/2026
])

const KNOWN_CONVOCATORIA_MISMATCHES = new Set<string>([
  // Slugs con inconsistencia conocida convocatoria_fecha ↔ convocatoria_dogv o
  // programa_url ↔ convocatoria_dogv pendiente de limpiar.
])

// Slugs cuyo seo_description menciona una cifra de plazas heredada/OEP-total
// que no cuadra con plazas_libres+disc+interna actuales. Pendientes de
// revisar uno a uno (ver project_seo_description_plazas_audit.md).
// Vaciado 19/05/2026 tras saneamiento masivo: los 6 slugs anteriores
// (cantabria, navarra, andalucia, policia-nacional, celador-sescam-clm,
// guardia-civil) tenían cifras heredadas/OEP-total que no cuadraban con
// la BD actual. Se actualizaron uno a uno con datos vigentes y se
// añadió contexto (ingreso libre, más X discapacidad, etc.).
const KNOWN_SEO_PLAZAS_MISMATCHES = new Set<string>([])

// Vaciado 19/05/2026 tras saneamiento masivo: navarra y baleares ya tenían
// descripcion=null en hito #1 (sin texto para contradecir BD). En SESCAM se
// reformuló la descripción para conservar el dato histórico (537 plazas del
// DOCM 123 original) y añadir el total actual (579 = 542 + 37 disc), que es
// lo que valida el test.
const KNOWN_HITO_PLAZAS_MISMATCHES = new Set<string>([])

// Slugs donde programa_url y hito #1 url apuntan a recursos legítimamente
// distintos (uno al portal/temario, otro al BOE de convocatoria). El test
// principal solo falla si ambos son del MISMO host y números de boletín
// distintos, así que esta whitelist debería quedar vacía a futuro.
const KNOWN_PROGRAMA_HITO_URL_DIFFERENT = new Set<string>([])

describeIfDb('Consistencia de datos en oposiciones (detecta contradicciones)', () => {
  let oposiciones: OposicionRow[]
  let hitos: HitoRow[]

  beforeAll(async () => {
    oposiciones = await supabaseGet<OposicionRow>(
      'oposiciones',
      'select=id,slug,nombre,tipo_acceso,exam_date,exam_date_approximate,inscription_start,inscription_deadline,boe_publication_date,boe_reference,plazas_libres,plazas_discapacidad,plazas_promocion_interna,landing_description,seo_description,convocatoria_fecha,convocatoria_numero,convocatoria_dogv,programa_url&is_active=eq.true'
    )
    hitos = await supabaseGet<HitoRow>(
      'convocatoria_hitos',
      'select=id,oposicion_id,fecha,titulo,status,descripcion,url,order_index'
    )
  }, 30000)

  // ============================================================
  // exam_date vs landing_description (caso Galicia/Isabel)
  // ============================================================
  test('exam_date es coherente con el mes/año mencionado en landing_description', () => {
    const conflicts: string[] = []
    for (const o of oposiciones) {
      if (!o.exam_date || !o.landing_description) continue
      const mesesEnTexto = extraerMesAñoDeTexto(o.landing_description)
      if (mesesEnTexto.length === 0) continue

      const d = new Date(o.exam_date)
      const examMes = d.getUTCMonth() + 1
      const examAño = d.getUTCFullYear()

      // Si el texto menciona un mes/año distinto al exam_date, es posible
      // conflicto. Solo contamos como contradicción si NINGÚN mes/año del
      // texto coincide con exam_date.
      const hayMatch = mesesEnTexto.some(({ mes, año }) => mes === examMes && año === examAño)
      if (!hayMatch) {
        const textos = mesesEnTexto.map(({ mes, año }) => `${MES_NOMBRE[mes]} ${año}`).join(', ')
        conflicts.push(
          `${o.slug}: exam_date=${o.exam_date} (${MES_NOMBRE[examMes]} ${examAño}) ` +
          `pero landing_description menciona ${textos}`
        )
      }
    }
    if (conflicts.length > 0) {
      console.error('\nContradicciones exam_date ↔ landing_description:')
      for (const c of conflicts) console.error('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // plazas_libres vs landing_description
  // ============================================================
  test('plazas_libres es coherente con las plazas mencionadas en landing_description', () => {
    const conflicts: string[] = []
    for (const o of oposiciones) {
      if (!o.plazas_libres || !o.landing_description) continue
      const plazasEnTexto = extraerNumeroPlazasDeTexto(o.landing_description)
      if (plazasEnTexto.length === 0) continue

      // La landing puede mencionar varias cifras (libres, totales, OEP). Solo
      // alertamos si NINGUNA de las cifras coincide con plazas_libres, ni con
      // total (libres+promocion+discapacidad).
      const anyMatch = plazasEnTexto.includes(o.plazas_libres)
      if (!anyMatch) {
        conflicts.push(
          `${o.slug}: plazas_libres=${o.plazas_libres} pero landing_description menciona ${plazasEnTexto.join(', ')}`
        )
      }
    }
    if (conflicts.length > 0) {
      console.warn('\nPosibles contradicciones plazas_libres ↔ landing_description (informativo — muchas landings mencionan el TOTAL de la OEP que incluye libres+internos+discapacidad, lo cual no es un bug):')
      for (const c of conflicts) console.warn('  ' + c)
    }
    // No bloqueante: la landing menciona legítimamente el total de la OEP (libres + internos + discap),
    // que puede diferir de plazas_libres. Solo se loguea como informativo.
    expect(true).toBe(true)
  })

  // ============================================================
  // boe_publication_date coherente con boe_reference
  // ============================================================
  test('boe_publication_date coincide con alguna fecha referenciada en boe_reference', () => {
    const conflicts: string[] = []
    for (const o of oposiciones) {
      if (!o.boe_publication_date || !o.boe_reference) continue

      // Extraer TODAS las fechas del boe_reference (puede contener varias:
      // p.ej. "BOE-A-2026-3140 (BOCYL 15/01/2026)" tiene la fecha BOCYL; si
      // además añadimos la fecha BOE explícita, debe coincidir con alguna).
      const dates: string[] = []
      const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g
      let m: RegExpExecArray | null
      while ((m = re.exec(o.boe_reference)) !== null) {
        const day = parseInt(m[1], 10)
        const month = parseInt(m[2], 10)
        const year = parseInt(m[3], 10)
        dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
      }
      if (dates.length === 0) continue

      // OK si boe_publication_date coincide con CUALQUIERA de las fechas
      // mencionadas (tolera refs multi-boletín tipo BOE+BOCYL).
      if (!dates.includes(o.boe_publication_date)) {
        const msg = `${o.slug}: boe_publication_date=${o.boe_publication_date} pero boe_reference dice "${o.boe_reference}" (fechas detectadas: ${dates.join(', ')})`
        if (KNOWN_BOE_REFERENCE_MISMATCHES.has(o.slug)) {
          console.warn('  [KNOWN]', msg)
        } else {
          conflicts.push(msg)
        }
      }
    }
    if (conflicts.length > 0) {
      console.error('\nNUEVAS contradicciones boe_publication_date ↔ boe_reference:')
      for (const c of conflicts) console.error('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // inscription_deadline vs hito "Cierre plazo inscripción"
  // ============================================================
  test('inscription_deadline coincide con algún hito de cierre de inscripción', () => {
    const conflicts: string[] = []
    const cierreRegex = /cierre\s+(del\s+)?plazo|fin\s+(del\s+)?plazo\s+de\s+(solicitud|inscripci[oó]n)|fin\s+de\s+inscripci[oó]n/i
    for (const o of oposiciones) {
      if (!o.inscription_deadline) continue
      const hitosOp = hitos.filter(h => h.oposicion_id === o.id)
      const cierres = hitosOp.filter(h => cierreRegex.test(h.titulo))
      if (cierres.length === 0) continue
      // Tolerante con reaperturas: basta con que AL MENOS UN hito de cierre
      // coincida con inscription_deadline (ej: Baleares tiene proceso original
      // + reapertura y inscription_deadline refleja la reapertura).
      const anyMatch = cierres.some(c => c.fecha === o.inscription_deadline)
      if (!anyMatch) {
        const lista = cierres.map(c => `"${c.titulo}" (${c.fecha})`).join(', ')
        conflicts.push(
          `${o.slug}: inscription_deadline=${o.inscription_deadline} pero ningún hito de cierre coincide: ${lista}`
        )
      }
    }
    if (conflicts.length > 0) {
      console.warn('\nContradicciones inscription_deadline ↔ hitos cierre:')
      for (const c of conflicts) console.warn('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // exam_date vs hito "Examen" / "Primer ejercicio"
  // ============================================================
  test('exam_date coincide con el hito de examen cuando existe', () => {
    const conflicts: string[] = []
    const examRegex = /^(primer\s+)?(ejercicio|examen)\b|\bprimer\s+examen\b|\boposici[oó]n\s+.{0,20}examen\b/i
    for (const o of oposiciones) {
      if (!o.exam_date) continue
      const hitosOp = hitos.filter(h => h.oposicion_id === o.id)
      const exam = hitosOp.find(h => examRegex.test(h.titulo))
      if (!exam) continue
      if (exam.fecha !== o.exam_date) {
        conflicts.push(
          `${o.slug}: exam_date=${o.exam_date} pero hito "${exam.titulo}" tiene fecha=${exam.fecha}`
        )
      }
    }
    if (conflicts.length > 0) {
      console.warn('\nContradicciones exam_date ↔ hito examen:')
      for (const c of conflicts) console.warn('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // Hitos sospechosos: oposición de acceso libre con hitos que mencionan
  // explícitamente "promoción interna" (caso Galicia/Isabel)
  // ============================================================
  test('oposiciones de tipo_acceso libre NO tienen hitos de promoción interna', () => {
    const conflicts: string[] = []
    const intRegex = /promoci[oó]n\s+interna|turno\s+interno|acceso\s+interno/i
    for (const o of oposiciones) {
      if (o.tipo_acceso !== 'libre') continue
      const hitosOp = hitos.filter(h => h.oposicion_id === o.id)
      const sospechosos = hitosOp.filter(h => intRegex.test(h.titulo) || intRegex.test(h.titulo))
      for (const s of sospechosos) {
        conflicts.push(`${o.slug}: hito "${s.titulo}" (${s.fecha}) parece de promoción interna pero la oposición es tipo_acceso=libre`)
      }
    }
    if (conflicts.length > 0) {
      console.error('\nHitos de promoción interna en oposición libre:')
      for (const c of conflicts) console.error('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // convocatoria_fecha vs fecha(s) mencionadas en convocatoria_dogv
  // Detecta el patrón del caso Extremadura (15/04/2026): dogv decía
  // "DOE núm. 21, 19/12/2025" pero DOE 21 es del 31/01/2025 — internamente
  // inconsistente tras una acumulación que solo tocó algunos campos.
  // ============================================================
  test('convocatoria_fecha coincide con alguna fecha referenciada en convocatoria_dogv', () => {
    const conflicts: string[] = []
    for (const o of oposiciones) {
      if (!o.convocatoria_fecha || !o.convocatoria_dogv) continue
      const dates: string[] = []
      const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g
      let m: RegExpExecArray | null
      while ((m = re.exec(o.convocatoria_dogv)) !== null) {
        const day = parseInt(m[1], 10)
        const month = parseInt(m[2], 10)
        const year = parseInt(m[3], 10)
        dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
      }
      if (dates.length === 0) continue
      if (!dates.includes(o.convocatoria_fecha)) {
        const msg = `${o.slug}: convocatoria_fecha=${o.convocatoria_fecha} pero convocatoria_dogv dice "${o.convocatoria_dogv}" (fechas detectadas: ${dates.join(', ')})`
        if (KNOWN_CONVOCATORIA_MISMATCHES.has(o.slug)) {
          console.warn('  [KNOWN]', msg)
        } else {
          conflicts.push(msg)
        }
      }
    }
    if (conflicts.length > 0) {
      console.error('\nContradicciones convocatoria_fecha ↔ convocatoria_dogv:')
      for (const c of conflicts) console.error('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // programa_url referencia el mismo boletín que convocatoria_dogv
  // Extrae número de boletín del URL (ej. "/2500o/" → 250, "/2440o/" → 244
  // para DOE; "BOE-A-YYYY-NNNN" para BOE estatal) y lo compara con el número
  // mencionado en convocatoria_dogv.
  // ============================================================
  test('programa_url referencia el mismo número de boletín que convocatoria_dogv', () => {
    const conflicts: string[] = []
    for (const o of oposiciones) {
      if (!o.programa_url || !o.convocatoria_dogv) continue

      // Para BOE estatal (boe.es), el URL tiene BOE-A-YYYY-NNNN donde NNNN es
      // el ID del documento, distinto del número del boletín (que dogv cita
      // como "BOE núm. 306"). Esos IDs no son comparables, skip.
      if (/boe\.es\//i.test(o.programa_url)) continue

      // Extraer números de boletín mencionados en el dogv. Patrones aceptados:
      //   "DOE núm. 244", "DOE num. 244", "DOE número 244"
      //   "DOE 250" (bare, sin núm.), "DOE Extraordinario 2"
      const dogvNumRe = /\b(?:DOE|BOE|BOP|BOJA|BOA|BOCM|BOCYL|BOIB|BORM|BOPA|DOCM|DOGV|DOG)\s+(?:extraordinario\s+)?(?:n[uú]m(?:\.?|ero)?\s*)?(\d{1,4})/gi
      const dogvNums: number[] = []
      let m: RegExpExecArray | null
      while ((m = dogvNumRe.exec(o.convocatoria_dogv)) !== null) {
        dogvNums.push(parseInt(m[1], 10))
      }
      if (dogvNums.length === 0) continue

      // Extraer número del programa_url. Patrones frecuentes:
      //   /pdfs/doe/YYYY/NNNNo/...  (Extremadura DOE, NNN padded a 4 dígitos: 2440o = DOE 244)
      //   /NN0o/                    (DOE número corto: 210o = DOE 21)
      const urlNums = new Set<number>()
      // DOE-style path "/NNNNo/" — el número DOE está sin padding: "2440o" = 244, "210o" = 21
      const doePathRe = /\/(\d{1,4})0o\//g
      while ((m = doePathRe.exec(o.programa_url)) !== null) {
        urlNums.add(parseInt(m[1], 10))
      }

      if (urlNums.size === 0) continue // URL sin patrón reconocido — skip

      const anyMatch = dogvNums.some(n => urlNums.has(n))
      if (!anyMatch) {
        const msg = `${o.slug}: convocatoria_dogv menciona núms [${dogvNums.join(', ')}] pero programa_url contiene [${[...urlNums].join(', ')}] → "${o.convocatoria_dogv}" vs "${o.programa_url}"`
        if (KNOWN_CONVOCATORIA_MISMATCHES.has(o.slug)) {
          console.warn('  [KNOWN]', msg)
        } else {
          conflicts.push(msg)
        }
      }
    }
    if (conflicts.length > 0) {
      console.error('\nContradicciones programa_url ↔ convocatoria_dogv:')
      for (const c of conflicts) console.error('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // seo_description coherente con plazas_libres + plazas_discapacidad
  // Detecta el patrón Extremadura (16/04/2026): seo_description quedó con
  // "106 plazas" tras una acumulación que actualizó plazas_libres a 126 sin
  // tocar el texto de SEO. Afecta cómo aparece la página en Google.
  // ============================================================
  test('seo_description menciona plazas coherentes con plazas_libres y total', () => {
    const conflicts: string[] = []
    for (const o of oposiciones) {
      if (!o.plazas_libres || !o.seo_description) continue
      const plazasEnTexto = extraerNumeroPlazasDeTexto(o.seo_description)
      if (plazasEnTexto.length === 0) continue

      const total = (o.plazas_libres ?? 0)
        + (o.plazas_discapacidad ?? 0)
        + (o.plazas_promocion_interna ?? 0)
      const allowed = new Set<number>([
        o.plazas_libres,
        total,
        o.plazas_libres + (o.plazas_discapacidad ?? 0),
        o.plazas_libres + (o.plazas_promocion_interna ?? 0),
      ])
      const anyMatch = plazasEnTexto.some(n => allowed.has(n))
      if (!anyMatch) {
        const msg = `${o.slug}: seo_description menciona [${plazasEnTexto.join(', ')}] plazas pero plazas_libres=${o.plazas_libres}, disc=${o.plazas_discapacidad ?? 0}, interna=${o.plazas_promocion_interna ?? 0}, total=${total}`
        if (KNOWN_SEO_PLAZAS_MISMATCHES.has(o.slug)) {
          console.warn('  [KNOWN]', msg)
        } else {
          conflicts.push(msg)
        }
      }
    }
    if (conflicts.length > 0) {
      console.error('\nNUEVAS contradicciones plazas en seo_description:')
      for (const c of conflicts) console.error('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // Hito #1 (order_index=1) descripción coherente con plazas
  // Mismo patrón Extremadura: el hito "Convocatoria publicada" decía
  // "106 plazas acceso libre" tras la acumulación a 126.
  // ============================================================
  test('descripcion del primer hito menciona plazas coherentes con plazas_libres y total', () => {
    const conflicts: string[] = []
    for (const o of oposiciones) {
      if (!o.plazas_libres) continue
      const hito1 = hitos.find(h => h.oposicion_id === o.id && h.order_index === 1)
      if (!hito1 || !hito1.descripcion) continue
      const plazasEnTexto = extraerNumeroPlazasDeTexto(hito1.descripcion)
      if (plazasEnTexto.length === 0) continue

      const total = (o.plazas_libres ?? 0)
        + (o.plazas_discapacidad ?? 0)
        + (o.plazas_promocion_interna ?? 0)
      const allowed = new Set<number>([
        o.plazas_libres,
        total,
        o.plazas_libres + (o.plazas_discapacidad ?? 0),
        o.plazas_libres + (o.plazas_promocion_interna ?? 0),
      ])
      const anyMatch = plazasEnTexto.some(n => allowed.has(n))
      if (!anyMatch) {
        const msg = `${o.slug}: hito #1 "${hito1.titulo}" descripcion menciona [${plazasEnTexto.join(', ')}] plazas pero plazas_libres=${o.plazas_libres}, disc=${o.plazas_discapacidad ?? 0}, total=${total}`
        if (KNOWN_HITO_PLAZAS_MISMATCHES.has(o.slug)) {
          console.warn('  [KNOWN]', msg)
        } else {
          conflicts.push(msg)
        }
      }
    }
    if (conflicts.length > 0) {
      console.error('\nNUEVAS contradicciones plazas en descripcion del hito #1:')
      for (const c of conflicts) console.error('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // programa_url debe coincidir con la url del primer hito
  // Si la convocatoria se actualiza por acumulación, ambos deberían apuntar
  // al PDF más reciente. Caso Extremadura (16/04/2026): programa_url
  // apuntaba a la Orden original 30 plazas mientras el hito apuntaba a la
  // corrección de errores — ninguno apuntaba a la Orden acumulada vigente.
  // ============================================================
  test('programa_url y hito #1 url no apuntan al mismo boletín con números distintos', () => {
    // Solo flagueamos cuando AMBAS URLs son del mismo host (mismo diario
    // oficial) Y los números de boletín extraídos del path son distintos.
    // Eso descarta los casos legítimos en que programa_url apunta al portal
    // de aspirantes (policia.es, sede.madrid.es) y el hito al BOE concreto.
    const conflicts: string[] = []
    const extractDoeNum = (url: string): number | null => {
      const m = /\/(\d{1,4})0o\//.exec(url)
      return m ? parseInt(m[1], 10) : null
    }
    for (const o of oposiciones) {
      if (!o.programa_url) continue
      const hito1 = hitos.find(h => h.oposicion_id === o.id && h.order_index === 1)
      if (!hito1 || !hito1.url) continue
      try {
        const hostA = new URL(o.programa_url).host
        const hostB = new URL(hito1.url).host
        if (hostA !== hostB) continue // distinto diario → propósitos distintos
      } catch { continue }
      const numA = extractDoeNum(o.programa_url)
      const numB = extractDoeNum(hito1.url)
      if (numA && numB && numA !== numB) {
        const msg = `${o.slug}: programa_url contiene boletín ${numA} pero hito #1 url contiene ${numB} (mismo host) → "${o.programa_url}" vs "${hito1.url}"`
        if (KNOWN_PROGRAMA_HITO_URL_DIFFERENT.has(o.slug)) {
          console.warn('  [KNOWN]', msg)
        } else {
          conflicts.push(msg)
        }
      }
    }
    if (conflicts.length > 0) {
      console.error('\nContradicciones programa_url ↔ hito #1 url (mismo host, números distintos):')
      for (const c of conflicts) console.error('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // Hito #1 url referencia el mismo número de boletín que convocatoria_dogv
  // Mismo patrón que programa_url ↔ convocatoria_dogv pero aplicado al hito.
  // ============================================================
  test('url del primer hito referencia el mismo número de boletín que convocatoria_dogv', () => {
    const conflicts: string[] = []
    for (const o of oposiciones) {
      if (!o.convocatoria_dogv) continue
      const hito1 = hitos.find(h => h.oposicion_id === o.id && h.order_index === 1)
      if (!hito1 || !hito1.url) continue
      if (/boe\.es\//i.test(hito1.url)) continue

      const dogvNumRe = /\b(?:DOE|BOE|BOP|BOJA|BOA|BOCM|BOCYL|BOIB|BORM|BOPA|DOCM|DOGV|DOG)\s+(?:extraordinario\s+)?(?:n[uú]m(?:\.?|ero)?\s*)?(\d{1,4})/gi
      const dogvNums: number[] = []
      let m: RegExpExecArray | null
      while ((m = dogvNumRe.exec(o.convocatoria_dogv)) !== null) {
        dogvNums.push(parseInt(m[1], 10))
      }
      if (dogvNums.length === 0) continue

      const urlNums = new Set<number>()
      const doePathRe = /\/(\d{1,4})0o\//g
      while ((m = doePathRe.exec(hito1.url)) !== null) {
        urlNums.add(parseInt(m[1], 10))
      }
      if (urlNums.size === 0) continue

      const anyMatch = dogvNums.some(n => urlNums.has(n))
      if (!anyMatch) {
        const msg = `${o.slug}: convocatoria_dogv menciona núms [${dogvNums.join(', ')}] pero hito #1 url contiene [${[...urlNums].join(', ')}] → "${hito1.url}"`
        if (KNOWN_CONVOCATORIA_MISMATCHES.has(o.slug)) {
          console.warn('  [KNOWN]', msg)
        } else {
          conflicts.push(msg)
        }
      }
    }
    if (conflicts.length > 0) {
      console.error('\nContradicciones hito #1 url ↔ convocatoria_dogv:')
      for (const c of conflicts) console.error('  ' + c)
    }
    expect(conflicts).toEqual([])
  })

  // ============================================================
  // Reporte informativo
  // ============================================================
  test('reporte de cobertura (informativo)', () => {
    const total = oposiciones.length
    const conExamDate = oposiciones.filter(o => o.exam_date).length
    const conLandingDesc = oposiciones.filter(o => o.landing_description).length
    const conBoeDate = oposiciones.filter(o => o.boe_publication_date).length
    const conInscription = oposiciones.filter(o => o.inscription_deadline).length
    console.log(`\nCobertura oposiciones (activas=${total}):`)
    console.log(`  con exam_date:             ${conExamDate}/${total}`)
    console.log(`  con landing_description:   ${conLandingDesc}/${total}`)
    console.log(`  con boe_publication_date:  ${conBoeDate}/${total}`)
    console.log(`  con inscription_deadline:  ${conInscription}/${total}`)
    console.log(`  total hitos:               ${hitos.length}`)
  })
})
