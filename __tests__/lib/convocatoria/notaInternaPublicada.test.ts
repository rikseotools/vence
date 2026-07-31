/**
 * @jest-environment node
 */
// Detector de notas internas publicadas en la landing [T-435].
//
// Todas las cadenas de este fichero son REALES, sacadas del banco el 31/07/2026: las que tienen que
// saltar y —más importante— las que NO. La calibración es el 90 % del valor de este detector: la
// referencia LARGA con cita literal es la convención de la casa (mediana 210 caracteres sobre 119
// landings activas, p90 599), así que marcarla daría ~60-90 hallazgos y el badge se dejaría de leer.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  clasificarValor, clasificarFila, clasificarLote, partirNota, CAMPOS_PUBLICADOS,
} = require('@/lib/convocatoria/notaInternaPublicada.cjs') as {
  clasificarValor: (v: unknown) => { esNota: boolean; tipo: string | null }
  clasificarFila: (f: Fila) => Hallazgo[]
  clasificarLote: (fs: Fila[]) => { todos: Hallazgo[]; publicadas: Hallazgo[]; catalogadas: Hallazgo[] }
  partirNota: (v: string) => { limpio: string | null; nota: string | null }
  CAMPOS_PUBLICADOS: string[]
}

type Fila = { slug: string; isActive: boolean; campos: Record<string, string | null> }
type Hallazgo = {
  slug: string; campo: string; tipo: string; severity: string
  publicada: boolean; limpio: string | null; nota: string | null; extracto: string
}

// ── Cadenas REALES que se estaban sirviendo (31/07/2026) ───────────────────────────────────────
const CELADOR = '⚠️ SIN VERIFICAR: la fila afirma 688 plazas (52 discapacidad) citando "BOCM núm. 158/2025". Comprobado el sumario de ese boletín (BOCM nº 158, 04/07/2025): la palabra "Celador" NO aparece NI UNA VEZ en sus 20 entradas.'
const CANTABRIA = '⚠️ NO VERIFICABLE CON ESTE DOCUMENTO. Decreto 51/2025 (BOC nº 161, 22/08/2025, CVE-2025-7125, idAnuBlob 423829), OEP 2025 de Cantabria — CLONADO. Pero solo desglosa por SUBGRUPO, no por cuerpo.'
const CLM = '⚠️ SIN VERIFICAR: la fila afirma 327 plazas citando el DOCM nº 240 de 12/12/2025 (Acuerdo 09/12/2025, OEP 2025 JCCM), pero ese decreto dice literalmente: "en el anexo I se prevén 140 plazas".'
const COMPETIDOR = 'Catalogada 04/07/2026 via Capa 3 competidores (oposiciones.es). Convocatoria detectada: ~59 plz (sin verificar - fuente competidor). Boletin oficial: BOPB'
const SITEMAP = 'Catalogada 04/07/2026 via sitemap-coverage de competidores (opositas/gokoan). Gap real verificado (0 filas en catalogo).'

// ── Cadenas REALES LEGÍTIMAS, que NO pueden saltar ────────────────────────────────────────────
const REF_CORTA = 'BOE-A-2026-6897'
const REF_CORTA2 = 'BOPV-2026-1804'
const CITA_LARGA_GALICIA = 'RESOLUCIÓN de 19/11/2025 (DOG nº 228, 25/11/2025, AnuncioG0597-191125-0004): "El objeto del proceso selectivo será cubrir ochenta y tres (83) plazas del cuerpo auxiliar de la Administración general de la Comunidad Autónoma de Galicia, subgrupo C2, por el turno de acceso libre".'
const CITA_LARGA_CYL = 'RESOLUCIÓN de 7/01/2026 de la Viceconsejería de Administraciones Públicas (BOCYL nº 7, 13/01/2026, BOCYL-D-13012026-7-5), base Segunda 2.1, cuadro "CUERPO ADMINISTRATIVO — Turno general | Cupo de personas con discapacidad | Total".'
const PROSA_PENDIENTE = 'Decreto 54/2026, de 27 de mayo, del Consejo de Gobierno (BOCM nº 125, 28/05/2026): OEP 2026 aprobada, convocatoria pendiente de publicar.'

describe('clasificarValor — lo que SÍ es una nota interna', () => {
  it('caza la duda publicada del Celador, que es el caso de origen', () => {
    expect(clasificarValor(CELADOR)).toEqual({ esNota: true, tipo: 'duda_publicada' })
  })

  it('caza «NO VERIFICABLE», que es la misma duda con otras palabras', () => {
    expect(clasificarValor(CANTABRIA).tipo).toBe('duda_publicada')
    expect(clasificarValor(CLM).tipo).toBe('duda_publicada')
  })

  it('caza el rastro de la herramienta, que además NOMBRA a un competidor en nuestra landing', () => {
    expect(clasificarValor(COMPETIDOR).esNota).toBe(true)
    expect(clasificarValor(SITEMAP).tipo).toBe('rastro_herramienta')
  })

  it('caza las marcas de trabajo pendiente escritas donde no van', () => {
    expect(clasificarValor('TODO: confirmar con el BOP').tipo).toBe('nota_tecnica')
    expect(clasificarValor('Proceso selectivo (cuerpo pendiente de identificar)').tipo).toBe('nota_tecnica')
  })

  it('caza el aviso visual esté donde esté', () => {
    expect(clasificarValor('⚠️ revisar esto').esNota).toBe(true)
    // Y también en mitad del texto: es la forma REAL del defecto (cita + ⚠️ nota), y anclarlo al
    // principio dejaba escapar auxiliar-administrativo-cantabria. Cero falsos positivos en 2.658.
    expect(clasificarValor('BOE-A-2026-6897 ⚠️ el cupo no cuadra, revisar').esNota).toBe(true)
  })
})

describe('clasificarValor — la CALIBRACIÓN: lo que no puede saltar', () => {
  it('la referencia corta y canónica está bien', () => {
    expect(clasificarValor(REF_CORTA).esNota).toBe(false)
    expect(clasificarValor(REF_CORTA2).esNota).toBe(false)
  })

  it('la cita LITERAL larga del boletín NO es una nota interna', () => {
    // Es la convención de la casa: mediana de 210 caracteres en las activas. Si esto saltara, el
    // detector emitiría decenas de hallazgos sanos y moriría por ruido — como ya ha pasado aquí
    // con otros avisos que se encendían todos los días.
    expect(clasificarValor(CITA_LARGA_GALICIA).esNota).toBe(false)
    expect(clasificarValor(CITA_LARGA_CYL).esNota).toBe(false)
  })

  it('«convocatoria pendiente de publicar» es INFORMACIÓN para el opositor, no un desliz', () => {
    // La frontera fina: «pendiente de publicar» describe la realidad del proceso; «pendiente de
    // verificar» confiesa que no hemos comprobado lo que afirmamos. Solo la segunda es defecto.
    expect(clasificarValor(PROSA_PENDIENTE).esNota).toBe(false)
    expect(clasificarValor('OEP 2026, pendiente de convocatoria').esNota).toBe(false)
    expect(clasificarValor('Plazas pendientes de verificar').esNota).toBe(true)
  })

  it('vacío, nulo y no-cadena no son hallazgos', () => {
    expect(clasificarValor(null).esNota).toBe(false)
    expect(clasificarValor('').esNota).toBe(false)
    expect(clasificarValor('   ').esNota).toBe(false)
    expect(clasificarValor(42).esNota).toBe(false)
  })
})

describe('partirNota — se PARTE, no se adivina', () => {
  it('conserva la cita legítima y separa la nota que va detrás', () => {
    // Ésta es la forma real del defecto en 3 de los 6 casos publicados: cita del boletín + ⚠️.
    const { limpio, nota } = partirNota(CITA_LARGA_CYL + ' ⚠️ plazas_promocion_interna=35 NO está verificada.')
    expect(limpio).toBe(CITA_LARGA_CYL)
    expect(nota).toContain('NO está verificada')
  })

  it('si el valor EMPIEZA por el marcador no hay nada publicable que rescatar', () => {
    // El caso Celador: la referencia la tiene que poner una persona que abra el boletín.
    const { limpio, nota } = partirNota(CELADOR)
    expect(limpio).toBeNull()
    expect(nota).toContain('SIN VERIFICAR')
  })

  it('NO propone una referencia sacada del texto — la heurística proponía la EQUIVOCADA', () => {
    // Extraer el localizador del propio texto devolvía «BOCM-20250704-16» para el Celador, que es
    // justo la entrada que la nota cita para decir que NO es la buena (la correcta es la -15).
    // Escribir eso en producción sería peor que dejar la nota.
    expect(partirNota(CELADOR).limpio).toBeNull()
  })

  it('sin marcador de corte tampoco recorta a ciegas', () => {
    const { limpio, nota } = partirNota(SITEMAP)
    expect(limpio).toBeNull()
    expect(nota).toBe(SITEMAP)
  })

  it('tolera vacío y no-cadena', () => {
    expect(partirNota('')).toEqual({ limpio: null, nota: null })
    // @ts-expect-error — entrada inválida a propósito
    expect(partirNota(null)).toEqual({ limpio: null, nota: null })
  })
})

describe('clasificarFila / clasificarLote — publicada pesa distinto que catalogada', () => {
  const publicada: Fila = { slug: 'celador-sermas-madrid', isActive: true, campos: { boe_reference: CELADOR } }
  const catalogada: Fila = { slug: 'administrativo-amb', isActive: false, campos: { boe_reference: COMPETIDOR } }

  it('en una oposición PUBLICADA es error: lo está leyendo gente ahora', () => {
    const [h] = clasificarFila(publicada)
    expect(h.severity).toBe('error')
    expect(h.campo).toBe('boe_reference')
    expect(h.limpio).toBeNull()          // empieza por ⚠️: no hay parte publicable
    expect(h.nota).toContain('SIN VERIFICAR')
  })

  it('en una catalogada es warn: el texto existe pero no se sirve', () => {
    expect(clasificarFila(catalogada)[0].severity).toBe('warn')
  })

  it('revisa TODOS los campos publicables, no solo boe_reference', () => {
    const f: Fila = {
      slug: 'x', isActive: true,
      campos: { boe_reference: REF_CORTA, diario_referencia: 'TODO: pedir el enlace', oep_decreto: CELADOR },
    }
    expect(clasificarFila(f).map((h) => h.campo).sort()).toEqual(['diario_referencia', 'oep_decreto'])
    expect(CAMPOS_PUBLICADOS).toContain('boe_reference')
  })

  it('separa el lote para que lo publicado no quede tapado por lo catalogado', () => {
    const r = clasificarLote([publicada, catalogada, { slug: 'sana', isActive: true, campos: { boe_reference: CITA_LARGA_CYL } }])
    expect(r.publicadas).toHaveLength(1)
    expect(r.catalogadas).toHaveLength(1)
    expect(r.todos).toHaveLength(2)
  })

  it('exige slug y tolera la lista vacía', () => {
    expect(() => clasificarFila({ slug: '', isActive: true, campos: {} })).toThrow(TypeError)
    expect(clasificarLote([]).todos).toEqual([])
    // @ts-expect-error — el llamador puede no tener nada
    expect(clasificarLote(undefined).todos).toEqual([])
  })
})
