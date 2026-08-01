/**
 * Repartir los artículos de una ley en sus títulos. (T-327)
 *
 * El caso que de verdad protege este fichero es el 3.º: las DISPOSICIONES no caen en ningún
 * rango numérico, y agrupando sin cuidado **desaparecen de la pantalla**. El usuario no vería un
 * error: vería una ley sin sus disposiciones y no podría meterlas en su temario.
 */
import {
  agruparPorTitulo,
  articulosDe,
  numeroDe,
  type SeccionEntrada,
} from '@/lib/laws/agruparPorTitulo'

const art = (n: string, q = 1) => ({ articleNumber: n, questionCount: q })

const TITULOS: SeccionEntrada[] = [
  { id: 's1', sectionNumber: 'Preliminar', title: 'Título Preliminar', from: 1, to: 9 },
  { id: 's2', sectionNumber: 'I', title: 'Título I. Derechos', from: 10, to: 55 },
  { id: 's3', sectionNumber: 'II', title: 'Título II. La Corona', from: 56, to: 65 },
]

describe('el número de artículo', () => {
  it('reconoce solo los números puros', () => {
    expect(numeroDe('14')).toBe(14)
    expect(numeroDe(' 7 ')).toBe(7)
    expect(numeroDe('DA1')).toBeNull()
    expect(numeroDe('55 bis')).toBeNull()
    expect(numeroDe('preámbulo')).toBeNull()
  })
})

describe('leyes SIN títulos — que son la mayoría', () => {
  it('devuelve un único grupo con toda la lista (no se pierde nada)', () => {
    // De 1.036 leyes en temas vivos, 744 no tienen secciones. Si esto fallara, la pantalla se
    // quedaría vacía para la mayor parte del catálogo.
    const g = agruparPorTitulo([art('1'), art('2')], [])
    expect(g).toHaveLength(1)
    expect(g[0].titulo).toBeNull()
    expect(articulosDe(g[0])).toEqual(['1', '2'])
  })

  it('secciones con rangos inválidos se tratan como si no hubiera', () => {
    const g = agruparPorTitulo(
      [art('1')],
      [{ id: 'x', sectionNumber: 'I', title: 'T', from: null, to: null }],
    )
    expect(g).toHaveLength(1)
    expect(g[0].titulo).toBeNull()
  })

  it('sin artículos no inventa grupos vacíos', () => {
    expect(agruparPorTitulo([], TITULOS)).toEqual([])
  })
})

describe('leyes CON títulos', () => {
  it('mete cada artículo en su título', () => {
    const g = agruparPorTitulo([art('1'), art('14'), art('60')], TITULOS)
    expect(g.map((x) => x.titulo)).toEqual([
      'Título Preliminar',
      'Título I. Derechos',
      'Título II. La Corona',
    ])
    expect(articulosDe(g[1])).toEqual(['14'])
  })

  it('un título sin artículos servibles NO se pinta (sería una cabecera que no se abre)', () => {
    const g = agruparPorTitulo([art('14')], TITULOS)
    expect(g.map((x) => x.titulo)).toEqual(['Título I. Derechos'])
  })

  it('respeta el orden en que llegan los artículos', () => {
    const g = agruparPorTitulo([art('20'), art('10'), art('55')], TITULOS)
    expect(articulosDe(g[0])).toEqual(['20', '10', '55'])
  })

  it('los límites del rango son INCLUSIVOS', () => {
    const g = agruparPorTitulo([art('10'), art('55')], TITULOS)
    expect(articulosDe(g[0])).toEqual(['10', '55'])
  })
})

describe('LAS DISPOSICIONES NO PUEDEN DESAPARECER', () => {
  it('lo que no cae en ningún título va a un grupo propio, visible', () => {
    const g = agruparPorTitulo([art('14'), art('DA1'), art('DT3'), art('preámbulo')], TITULOS)
    const otros = g.find((x) => x.seccionId === null)
    expect(otros).toBeDefined()
    expect(articulosDe(otros!)).toEqual(['DA1', 'DT3', 'preámbulo'])
  })

  it('ese grupo va al FINAL, no mezclado entre los títulos', () => {
    const g = agruparPorTitulo([art('DA1'), art('14')], TITULOS)
    expect(g[g.length - 1].seccionId).toBeNull()
  })

  it('un artículo fuera de TODOS los rangos tampoco se pierde', () => {
    // Art. 200 en una ley cuyos títulos llegan al 65: pasa cuando las secciones están a medio
    // poblar. Antes que esconderlo, se enseña.
    const g = agruparPorTitulo([art('200')], TITULOS)
    expect(articulosDe(g[g.length - 1])).toEqual(['200'])
  })

  it('si NO hay sueltos, no se añade un grupo vacío', () => {
    const g = agruparPorTitulo([art('14')], TITULOS)
    expect(g.every((x) => x.articulos.length > 0)).toBe(true)
    expect(g.some((x) => x.titulo === 'Disposiciones y otros')).toBe(false)
  })
})

describe('rangos que se solapan (leyes mal pobladas)', () => {
  it('gana el título MÁS ESTRECHO, que es el más informativo', () => {
    const solapados: SeccionEntrada[] = [
      { id: 'ancho', sectionNumber: 'I', title: 'Título I (1-100)', from: 1, to: 100 },
      { id: 'estrecho', sectionNumber: 'II', title: 'Título II (10-20)', from: 10, to: 20 },
    ]
    const g = agruparPorTitulo([art('15')], solapados)
    expect(g).toHaveLength(1)
    expect(g[0].titulo).toBe('Título II (10-20)')
  })
})
