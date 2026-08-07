/**
 * [T-655] El corpus de una convocatoria tiene que salir del MISMO sitio que su fuente oficial.
 *
 * Nace del caso REAL de [T-654]: `auxiliar-administrativo-diputacion-cadiz` tenía 8 documentos
 * clonados de la carpeta `admto_a` (el proceso de Administrativo C1, otro cuerpo) mientras su
 * `programa_url` apuntaba a `aux_administrativo`. La landing publicaba una cifra de plazas con el
 * respaldo documental de otra oposición, a 171 usuarios.
 */
import {
  corpusSaleDeSuSitio, carpetaDe, segmentoUtil,
} from '@/lib/convocatoria/corpusAjeno.cjs'

const BASE = 'https://www.dipucadiz.es/export/sites/default/funcion_publica_y_recursos_humanos/.galeria_de_ficheros/documentos/ope/procesosentramite'
const OFICIAL = `${BASE}/aux_administrativo/01.-Convocatoria-de-plazas-y-bases-especificas.pdf`
const VECINO = `${BASE}/admto_a/01.-Convocatoria-de-plazas-y-bases-especificas.pdf`

describe('[T-655] corpusSaleDeSuSitio — el caso real de Cádiz', () => {
  it('caza el corpus del proceso VECINO: mismo portal, misma clase de documento, otra carpeta', () => {
    // Es el caso literal: los 8 documentos venían de `admto_a` y la fuente oficial de
    // `aux_administrativo`. Nótese que el TÍTULO del documento es idéntico en los dos procesos
    // («01. Convocatoria de plazas y bases específicas»), así que por título era indistinguible.
    const r = corpusSaleDeSuSitio({ programaUrl: OFICIAL, documentos: Array.from({ length: 8 }, () => ({ url: VECINO })) })
    expect(r.veredicto).toBe('ajeno')
    expect(r.carpetaOficial).toBe('aux_administrativo')
    expect(r.carpetasDocumentos).toEqual(['admto_a'])
    expect(r.documentosJuzgados).toBe(8)
  })

  it('con UN solo documento de su carpeta ya es coherente: no se exige pureza', () => {
    // Un corpus real mezcla: bases del proceso, boletines, y a veces material transversal del
    // portal. Exigir que TODOS compartan carpeta convertiría lo normal en hallazgo.
    const r = corpusSaleDeSuSitio({ programaUrl: OFICIAL, documentos: [{ url: VECINO }, { url: OFICIAL }] })
    expect(r.veredicto).toBe('coherente')
  })
})

describe('[T-655] lo que hace que no grite: los segmentos genéricos', () => {
  it('una carpeta genérica a CUALQUIERA de los dos lados hace la comparación no juzgable', () => {
    // Sin este filtro salían 12 hallazgos de 117 y la mitad comparaban «pdf» con «files», que no
    // significan nada. Con él quedan 42 juzgables de 163 y 4 hallazgos.
    expect(corpusSaleDeSuSitio({ programaUrl: 'https://x.es/a/pdf/doc.pdf', documentos: [{ url: 'https://x.es/b/otra/d.pdf' }] }).veredicto).toBe('no_juzgable')
    expect(corpusSaleDeSuSitio({ programaUrl: OFICIAL, documentos: [{ url: 'https://x.es/a/files/d.pdf' }] }).veredicto).toBe('no_juzgable')
  })

  it('descarta ids numéricos y nombres de fichero como carpeta', () => {
    expect(segmentoUtil('12345')).toBe(false)
    expect(segmentoUtil('2024-05')).toBe(false)
    expect(segmentoUtil('ENFERMERIA+OPE+2026.pdf')).toBe(false)
    expect(segmentoUtil('aux_administrativo')).toBe(true)
    expect(segmentoUtil('admto_a')).toBe(true)
  })

  it('«no juzgable» NO es «coherente»: no poder opinar se dice, no se da por bueno', () => {
    // Es la diferencia entre un detector honesto y uno que presume de verde. Sobre 121 de las 163
    // convocatorias con fuente oficial no puede opinar, y eso tiene que constar.
    const r = corpusSaleDeSuSitio({ programaUrl: OFICIAL, documentos: [] })
    expect(r.veredicto).toBe('no_juzgable')
    expect(r.motivo).toMatch(/carpeta con significado/)
  })
})

describe('[T-655] carpetaDe — el penúltimo segmento, no la URL entera', () => {
  it('saca la carpeta que agrupa el proceso', () => {
    expect(carpetaDe(OFICIAL)).toBe('aux_administrativo')
    expect(carpetaDe(VECINO)).toBe('admto_a')
  })

  it('tolera lo que un portal escupe: URL rota, sin carpeta, vacía', () => {
    // El hub tiene URLs de todo tipo; una malformada no puede tumbar un barrido.
    expect(carpetaDe('no-es-una-url')).toBeNull()
    expect(carpetaDe('https://x.es/solo.pdf')).toBeNull()
    expect(carpetaDe(null)).toBeNull()
  })
})
