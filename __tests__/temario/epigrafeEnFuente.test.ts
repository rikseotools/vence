/**
 * epigrafeEnFuente.test.ts — el núcleo del triaje epígrafe↔fuente. (T-552)
 *
 * Los casos NO son inventados: son los que aparecieron clonando `administrativo_asturias` el
 * 04/08, que es la única oposición de la que se conoce el temario ANTES y DESPUÉS de pasarlo a
 * literal. Cada uno se dejó como test porque su ausencia produce un número creíble y falso.
 */
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(__filename)
const ROOT = path.join(__dirname, '..', '..')
const { medirOposicion, estadoEpigrafe, aplanar, limpiarRuidoDePagina, pareceTemario, ordenarCola, MIN_FUENTE } = req(
  path.join(ROOT, 'lib/temario/epigrafeEnFuente.cjs'),
)

/**
 * Un documento que PARECE un temario: largo y con su lista de temas numerada.
 *
 * Los dos rasgos hacen falta y los dos se ganaron a pulso: sin longitud, `medirOposicion` lo trata
 * como cascarón (`sin_fuente`); sin la lista numerada, como documento que no es un programa
 * (`fuente_no_es_temario`). Un relleno «bonito» pero sin temas dejaba en rojo cuatro tests que
 * medían otra cosa — el detector tenía razón y el fixture no.
 */
// Las líneas van a la LONGITUD REAL de un temario (~113 caracteres en el BOPA de Asturias): por
// debajo del tope de mobiliario, catorce líneas que solo cambian en su número comparten clave al
// enmascarar los dígitos y el limpiador se las lleva. El fixture tiene que parecerse al original.
const listaDeTemas = Array.from({ length: 14 }, (_, i) =>
  `   ${i + 1}.—Materia número ${i + 1} del programa oficial, con su enunciado largo y su delimitación por títulos y capítulos.`).join('\n')
const relleno = (n = MIN_FUENTE + 500) =>
  `${listaDeTemas}\n${'texto de relleno del boletín oficial. '.repeat(Math.ceil(n / 38))}`

describe('aplanar — sobrevive a lo que hace un PDF con el texto', () => {
  it('une la palabra que el PDF cortó con guion al final de línea', () => {
    // Real: «los procedi-\nmientos con negociación» del BOPA de Asturias.
    expect(aplanar('procedi-\nmientos')).toBe('procedimientos')
  })

  it('iguala dos textos que solo difieren en espacios y saltos', () => {
    expect(aplanar('La Ley 39/2015,  de 1\n de octubre')).toBe(aplanar('La Ley 39/2015, de 1 de octubre'))
  })

  it('conserva los acentos: quitarlos aflojaría la comparación sin necesidad', () => {
    expect(aplanar('Administración')).not.toBe(aplanar('Administracion'))
  })
})

describe('limpiarRuidoDePagina — el mobiliario del boletín no es temario', () => {
  it('quita la cabecera que se repite en cada página', () => {
    const doc = ['BOLETÍN OFICIAL DEL PRINCIPADO', 'tema uno', 'BOLETÍN OFICIAL DEL PRINCIPADO', 'tema dos', 'BOLETÍN OFICIAL DEL PRINCIPADO', 'tema tres'].join('\n')
    expect(limpiarRuidoDePagina(doc)).not.toContain('BOLETÍN')
    expect(limpiarRuidoDePagina(doc)).toContain('tema uno')
  })

  it('quita el pie aunque CAMBIE la paginación — el caso que rompía la medida', () => {
    // «núm. 248 de 24-xii-2024   15/18» es distinto en cada página, así que contado literalmente
    // aparece UNA vez y sobrevivía al filtro. Enmascarando los dígitos, se delata.
    const doc = ['núm. 248 de 24-xii-2024   15/18', 'a', 'núm. 248 de 24-xii-2024   16/18', 'b', 'núm. 248 de 24-xii-2024   17/18', 'c'].join('\n')
    expect(limpiarRuidoDePagina(doc)).not.toContain('núm. 248')
  })

  it('quita URLs sueltas y números de página', () => {
    const doc = ['https://sede.asturias.es/bopa', 'materia importante', '15/18'].join('\n')
    const l = limpiarRuidoDePagina(doc)
    expect(l).toContain('materia importante')
    expect(l).not.toContain('sede.asturias')
    expect(l).not.toContain('15/18')
  })

  it('NO se lleva por delante una línea de temario que aparece una o dos veces', () => {
    const doc = ['La Constitución Española de 1978 (I)', 'otra cosa', 'La Constitución Española de 1978 (I)'].join('\n')
    expect(limpiarRuidoDePagina(doc)).toContain('La Constitución Española de 1978 (I)')
  })
})

describe('pareceTemario — distinguir un programa de un documento cualquiera', () => {
  it('una lista de temas se reconoce por su racha de enteros consecutivos', () => {
    const prog = Array.from({ length: 16 }, (_, i) => `   ${i + 1}.—La materia número ${i + 1} del programa.`).join('\n')
    expect(pareceTemario(prog).pareceTemario).toBe(true)
    expect(pareceTemario(prog).rachaMax).toBeGreaterThanOrEqual(10)
  })

  it('también con el formato «Tema N»', () => {
    const prog = Array.from({ length: 12 }, (_, i) => `Tema ${i + 1}: materia.`).join('\n')
    expect(pareceTemario(prog).pareceTemario).toBe(true)
  })

  it('un DECRETO no lo parece — el caso que puso un enlace roto en cabeza de la cola', () => {
    // `administrativo-estado` tenía como programa_url el RD 387/2026 de la OEP: cero temas
    // dentro, y sin embargo salía el primero con «45 de 45 fuera de su fuente».
    const decreto = ['Artículo 1. Objeto.', 'Artículo 2. Ámbito.', 'Disposición final primera.',
      'Se aprueba la oferta de empleo público para 2026 con un total de 1.450 plazas.'].join('\n')
    expect(pareceTemario(decreto).pareceTemario).toBe(false)
  })

  it('apartados numerados SUELTOS de una norma no forman serie', () => {
    // Un texto legal está lleno de «1.», «2.», «3.» dentro de artículos distintos; lo que
    // distingue a un temario es la racha LARGA, no el total de números.
    const norma = ['1. Primer apartado del artículo tercero.', '2. Segundo apartado.', 'Artículo 4.',
      '1. Primer apartado del artículo cuarto.', '2. Segundo apartado.'].join('\n')
    expect(pareceTemario(norma).pareceTemario).toBe(false)
  })
})

describe('medirOposicion', () => {
  const LARGO = 'La Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas: Disposiciones Generales (Título Preliminar)'

  it('un epígrafe LITERAL aparece en el documento', () => {
    const r = medirOposicion({ epigrafes: [{ tema: 203, epigrafe: LARGO }], texto: relleno() + LARGO + relleno() })
    expect(r.veredicto).toBe('literal')
    expect(r.contenidos).toBe(1)
  })

  it('una PARÁFRASIS no aparece — que es todo el punto', () => {
    const parafrasis = 'La Ley 39/2015, del Procedimiento Administrativo Común (Títulos Preliminar a V).'
    const r = medirOposicion({ epigrafes: [{ tema: 203, epigrafe: parafrasis }], texto: relleno() + LARGO + relleno() })
    expect(r.veredicto).toBe('parafraseado')
    expect(r.ausentes).toBe(1)
  })

  it('lo encuentra aunque el documento le meta la cabecera del boletín EN MEDIO', () => {
    // El tema que cruza salto de página. Sin limpiar el mobiliario, un epígrafe impecable
    // se declara ausente — 1 de cada 38 en Asturias.
    const mitad = Math.floor(LARGO.length / 2)
    const partido = [
      relleno(),
      LARGO.slice(0, mitad),
      'https://sede.asturias.es/bopa',
      'BOLETÍN OFICIAL DEL PRINCIPADO DE ASTURIAS',
      'núm. 248 de 24-xii-2024   15/18',
      LARGO.slice(mitad),
      'BOLETÍN OFICIAL DEL PRINCIPADO DE ASTURIAS',
      'núm. 248 de 24-xii-2024   16/18',
      'BOLETÍN OFICIAL DEL PRINCIPADO DE ASTURIAS',
      'núm. 248 de 24-xii-2024   17/18',
    ].join('\n')
    expect(medirOposicion({ epigrafes: [{ tema: 206, epigrafe: LARGO }], texto: partido }).veredicto).toBe('literal')
  })

  it('si la fuente NO es un temario, no se juzgan los epígrafes', () => {
    const decreto = 'Artículo 1. Objeto. '.repeat(200)
    const r = medirOposicion({ epigrafes: [{ tema: 1, epigrafe: LARGO }], texto: decreto })
    expect(r.veredicto).toBe('fuente_no_es_temario')
    expect(r.ausentes).toBe(0)   // lo importante: NO se cuenta como drift
  })

  describe('«no medible» NUNCA se cuenta como drift', () => {
    it('sin texto: la oposición queda en su propio cubo', () => {
      const r = medirOposicion({ epigrafes: [{ tema: 1, epigrafe: LARGO }], texto: null, motivoSinFuente: 'download_error' })
      expect(r.veredicto).toBe('sin_fuente')
      expect(r.ausentes).toBe(0)
      expect(r.motivo).toContain('download_error')
    })

    it('el cascarón de una SPA no es un temario', () => {
      const r = medirOposicion({ epigrafes: [{ tema: 1, epigrafe: LARGO }], texto: '<html><body>Cargando…</body></html>' })
      expect(r.veredicto).toBe('sin_fuente')
      expect(r.ausentes).toBe(0)
    })

    it('un epígrafe CORTO no se juzga: encontrarlo podría ser casualidad', () => {
      const r = medirOposicion({ epigrafes: [{ tema: 1, epigrafe: 'La Corona.' }], texto: relleno() })
      expect(r.noMedibles).toBe(1)
      expect(r.ausentes).toBe(0)
      expect(estadoEpigrafe('La Corona.', 'x')).toBe('no_medible')
    })
  })

  it('mezcla → parcial, con el ratio sobre lo MEDIBLE (no sobre el total)', () => {
    const r = medirOposicion({
      epigrafes: [
        { tema: 1, epigrafe: LARGO },
        { tema: 2, epigrafe: 'Una paráfrasis larguísima que desde luego no está en el documento oficial de ninguna manera' },
        { tema: 3, epigrafe: 'corto' },
      ],
      texto: relleno() + LARGO + relleno(),
    })
    expect(r.veredicto).toBe('parcial')
    expect(r.medibles).toBe(2)
    expect(r.noMedibles).toBe(1)
    expect(r.ratio).toBe(0.5)
  })
})

describe('ordenarCola', () => {
  const f = (slug: string, veredicto: string, ratio: number | null, medibles: number) => ({ slug, veredicto, ratio, medibles })

  it('primero lo que más se aleja de su fuente y más temas pone en juego', () => {
    const orden = ordenarCola([
      f('poco', 'parcial', 0.9, 10),
      f('mucho', 'parafraseado', 0, 40),
      f('limpia', 'literal', 1, 30),
    ]).map((x: { slug: string }) => x.slug)
    expect(orden[0]).toBe('mucho')
    expect(orden[orden.length - 1]).toBe('limpia')
  })

  it('las SIN FUENTE van al final: es deuda de enlace, no de temario', () => {
    // Si compartieran cubo, enterrarían lo accionable debajo de lo que nadie ha podido mirar.
    const orden = ordenarCola([f('sinfuente', 'sin_fuente', null, 0), f('drift', 'parcial', 0.5, 4)])
    expect(orden[0].slug).toBe('drift')
    expect(orden[1].slug).toBe('sinfuente')
  })

  it('y las de FUENTE QUE NO ES TEMARIO tampoco encabezan la cola', () => {
    const orden = ordenarCola([f('enlaceroto', 'fuente_no_es_temario', null, 0), f('drift', 'parcial', 0.9, 10)])
    expect(orden[0].slug).toBe('drift')
  })
})
