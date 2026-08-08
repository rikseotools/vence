import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/__tests__/lib/generacion/citaBlockquote.test.js')
if not p.exists():
    cands = list(pathlib.Path('/home/manuel/vence-sessions/movil3/__tests__').rglob('*itaBlockquote*'))
    print('fichero no encontrado; candidatos:', cands)
    raise SystemExit(1)

s = p.read_text()
bloque = '''
describe('la elipsis entre PARÉNTESIS también trocea (T-278, 08/08/2026)', () => {
  // El manual sanciona las dos formas de marcar una omisión: «...» y «(...)». Troceando solo por
  // los puntos, el paréntesis se quedaba pegado al tramo —«…también especiales (»— y ningún tramo
  // era ya subcadena del artículo. Medido al insertar Mecánico-Conductor T10: 3 de 22 en rojo,
  // las 3 correctas, y una de ellas reparada ANTES precisamente para cumplir la convención.
  const CITA = '> "Para vehículos especiales y conjuntos de vehículos, también especiales (...): ' +
    '1.º Si carecen de señalización de frenado: 25 kilómetros por hora."'

  it('no deja el paréntesis pegado a ningún tramo', () => {
    const frags = fragmentosCitados(CITA)
    expect(frags).toEqual([
      'Para vehículos especiales y conjuntos de vehículos, también especiales',
      ': 1.º Si carecen de señalización de frenado: 25 kilómetros por hora.',
    ])
    for (const f of frags) {
      expect(f.startsWith(')')).toBe(false)
      expect(f.endsWith('(')).toBe(false)
    }
  })

  it('la cita con «(...)» se da por literal contra el artículo real', () => {
    const articulo = 'Para vehículos especiales y conjuntos de vehículos, también especiales, ' +
      'aunque sólo tenga tal naturaleza uno de los que integran el conjunto: ' +
      '1.º Si carecen de señalización de frenado: 25 kilómetros por hora.'
    expect(analizaCitaBlockquote(CITA, articulo).literal).toBe(true)
  })

  it('y un paréntesis de VERDAD no se parte (el arreglo no ciega el check)', () => {
    expect(fragmentosCitados('> "lo previsto en el artículo 19.1 (del texto articulado) será exigible."'))
      .toEqual(['lo previsto en el artículo 19.1 (del texto articulado) será exigible.'])
  })

  it('sigue cazando una cita FALSEADA aunque lleve elipsis entre paréntesis', () => {
    const articulo = 'Para vehículos especiales: 1.º Si carecen de señalización: 25 kilómetros por hora.'
    const falsa = '> "Para vehículos especiales (...): 1.º Si carecen de señalización: 40 kilómetros por hora."'
    expect(analizaCitaBlockquote(falsa, articulo).literal).toBe(false)
  })
})
'''
p.write_text(s.rstrip() + '\n' + bloque)
print('tests de elipsis añadidos a', p.name)
