/**
 * @jest-environment node
 */
// Texto del índice del backlog que NINGUNA ficha produce — o sea, lo que se perdería. (T-721)
//
// Lo que se prueba es el núcleo puro. La ejecución del guard (que sí lee git y el disco) se
// comprobó reproduciendo el fallo real: inyectando en el índice el cuerpo de una ficha, como hace
// el merge de una rama anterior a [T-532], y viendo que lo caza y dice de qué ficha es.
//
// POR QUÉ ESTE CRITERIO Y NO OTRO — las dos mediciones que lo descartaron todo lo demás:
//   · «la rama no contiene main» salta en el 99% de las 129 ramas vivas: inservible.
//   · «main tocó sus ficheros tras el veredicto» salta en el 86%… y los 6 casos eran EL MISMO
//     fichero, el índice. El fenómeno no era genérico: era éste.
// Por eso no se avisa de una situación sospechosa, se detecta la PÉRDIDA concreta.
const { lineasHuerfanas, fichasAfectadas } = require('@/lib/backlog/indiceHuerfano.cjs')

describe('lineasHuerfanas — lo que el índice trae y ninguna ficha genera', () => {
  it('índice igual al generado: nada que rescatar', () => {
    const t = '## Abiertas\n\n### [T-1] algo\n- cuerpo\n'
    expect(lineasHuerfanas(t, t)).toEqual({ alDia: true, huerfanas: [], total: 0 })
  })

  it('EL CASO REAL: un merge mete el cuerpo de una ficha en el índice', () => {
    const generado = '## Abiertas\n\n### [T-2] la buena\n- cuerpo bueno\n'
    const comiteado = '## Abiertas\n\n### [T-196] inyectada por el merge\n- se perdería\n\n### [T-2] la buena\n- cuerpo bueno\n'
    const r = lineasHuerfanas(comiteado, generado)
    expect(r.alDia).toBe(false)
    expect(r.total).toBe(2)
    expect(r.huerfanas[0]).toContain('T-196')
  })

  it('las líneas VACÍAS no cuentan: un merge cambia el espaciado y eso no es pérdida', () => {
    const generado = '### [T-3] x\n- cuerpo\n'
    const comiteado = '\n\n### [T-3] x\n\n\n- cuerpo\n\n'
    expect(lineasHuerfanas(comiteado, generado).alDia).toBe(true)
  })

  it('el espacio al FINAL de línea tampoco: es ruido de edición, no contenido', () => {
    expect(lineasHuerfanas('### [T-4] x   \n- cuerpo  \n', '### [T-4] x\n- cuerpo\n').alDia).toBe(true)
  })

  it('que el índice tenga MENOS que el generado no es pérdida (eso lo arregla regenerar)', () => {
    // Solo se acusa en la dirección peligrosa: texto que existe y desaparecería.
    const r = lineasHuerfanas('### [T-5] x\n', '### [T-5] x\n- cuerpo nuevo desde la ficha\n')
    expect(r.alDia).toBe(true)
  })

  it('entradas vacías o nulas no revientan', () => {
    expect(lineasHuerfanas('', '').alDia).toBe(true)
    expect(lineasHuerfanas(null, undefined).alDia).toBe(true)
  })
})

describe('fichasAfectadas — a quién hay que llevar el texto rescatado', () => {
  it('saca el id de la CABECERA, que es la pista fuerte', () => {
    expect(fichasAfectadas(['### [T-196] 🟡 [ABIERTO] algo', '- cuerpo'])).toEqual(['T-196'])
  })

  it('si no hay cabecera, sirve cualquier id citado', () => {
    expect(fichasAfectadas(['- viene de [T-634] y toca [T-699]'])).toEqual(['T-634', 'T-699'])
  })

  it('la cabecera MANDA sobre los ids del cuerpo de esa misma línea', () => {
    // Una línea de cabecera puede citar otras tareas; la ficha es la de la cabecera.
    expect(fichasAfectadas(['### [T-1] relacionada con T-999'])).toEqual(['T-1'])
  })

  it('sin ids devuelve vacío, y el guard lo dice en vez de inventarse una ficha', () => {
    expect(fichasAfectadas(['- una línea suelta sin id'])).toEqual([])
    expect(fichasAfectadas([])).toEqual([])
  })

  it('ordena y no repite', () => {
    expect(fichasAfectadas(['T-10 y T-2', 'otra vez T-10'])).toEqual(['T-10', 'T-2'])
  })
})
