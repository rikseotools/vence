/**
 * Núcleo del creador de temario propio. (T-327)
 *
 * Se prueba aquí y no en la pantalla porque estas reglas deciden **qué acaba en la base de
 * datos**: cada tema se convierte en filas de `topic_scope`, y un fallo aquí no da error — sirve
 * un temario distinto del que el usuario construyó, que es peor que romperse.
 */
import {
  anadirArticulo,
  anadirArticulos,
  quitarArticulo,
  renombrarTema,
  quitarTema,
  agruparPorLey,
  problemasParaGuardar,
  puedeGuardar,
  totalArticulos,
  nombrePublico,
  temaVacio,
  type Temario,
} from '@/components/miOposicion/temario'

const LEY_39 = { lawId: 'ley-39', shortName: 'Ley 39/2015' }
const CE = { lawId: 'ce', shortName: 'CE' }

const base = (): Temario => ({ nombre: 'Agente de Hacienda', temas: [temaVacio('t1', 1)] })

describe('añadir artículos a un tema', () => {
  it('añade el artículo al tema indicado', () => {
    const r = anadirArticulo(base(), 't1', { ...LEY_39, articleNumber: '24' })
    expect(r.temas[0].articulos).toEqual([{ ...LEY_39, articleNumber: '24' }])
  })

  it('añadir DOS VECES el mismo artículo no lo duplica', () => {
    // No es cosmético: al guardar, un duplicado infla el `topic_scope` sin dar error y el
    // usuario ve la misma pregunta repetida en sus tests sin saber por qué.
    let r = anadirArticulo(base(), 't1', { ...LEY_39, articleNumber: '24' })
    r = anadirArticulo(r, 't1', { ...LEY_39, articleNumber: '24' })
    expect(r.temas[0].articulos).toHaveLength(1)
  })

  it('el MISMO número de artículo en leyes DISTINTAS son cosas distintas', () => {
    let r = anadirArticulo(base(), 't1', { ...LEY_39, articleNumber: '24' })
    r = anadirArticulo(r, 't1', { ...CE, articleNumber: '24' })
    expect(r.temas[0].articulos).toHaveLength(2)
  })

  it('el mismo artículo SÍ puede estar en dos temas (es legítimo, pasa en los oficiales)', () => {
    let t: Temario = { nombre: 'X', temas: [temaVacio('t1', 1), temaVacio('t2', 2)] }
    t = anadirArticulo(t, 't1', { ...CE, articleNumber: '14' })
    t = anadirArticulo(t, 't2', { ...CE, articleNumber: '14' })
    expect(t.temas[0].articulos).toHaveLength(1)
    expect(t.temas[1].articulos).toHaveLength(1)
  })

  it('añadir en lote (una ley entera) respeta el anti-duplicado', () => {
    let r = anadirArticulo(base(), 't1', { ...LEY_39, articleNumber: '24' })
    r = anadirArticulos(r, 't1', [
      { ...LEY_39, articleNumber: '24' },
      { ...LEY_39, articleNumber: '25' },
    ])
    expect(r.temas[0].articulos.map((a) => a.articleNumber)).toEqual(['24', '25'])
  })

  it('añadir a un tema que no existe no revienta ni inventa temas', () => {
    const r = anadirArticulo(base(), 'no-existe', { ...LEY_39, articleNumber: '24' })
    expect(r.temas).toHaveLength(1)
    expect(r.temas[0].articulos).toHaveLength(0)
  })
})

describe('quitar y renombrar', () => {
  it('quitar saca solo ese artículo', () => {
    let r = anadirArticulos(base(), 't1', [
      { ...LEY_39, articleNumber: '24' },
      { ...LEY_39, articleNumber: '25' },
    ])
    r = quitarArticulo(r, 't1', { lawId: 'ley-39', articleNumber: '24' })
    expect(r.temas[0].articulos.map((a) => a.articleNumber)).toEqual(['25'])
  })

  it('renombrar el tema no toca sus artículos', () => {
    let r = anadirArticulo(base(), 't1', { ...LEY_39, articleNumber: '24' })
    r = renombrarTema(r, 't1', 'El procedimiento administrativo')
    expect(r.temas[0].titulo).toBe('El procedimiento administrativo')
    expect(r.temas[0].articulos).toHaveLength(1)
  })

  it('quitar un tema no toca los demás', () => {
    let t: Temario = { nombre: 'X', temas: [temaVacio('t1', 1), temaVacio('t2', 2)] }
    t = anadirArticulo(t, 't2', { ...CE, articleNumber: '1' })
    const r = quitarTema(t, 't1')
    expect(r.temas.map((x) => x.id)).toEqual(['t2'])
    expect(r.temas[0].articulos).toHaveLength(1)
  })
})

describe('agrupar por ley — es la forma EXACTA de topic_scope', () => {
  it('junta los artículos de la misma ley en una sola entrada', () => {
    const t = anadirArticulos(base(), 't1', [
      { ...LEY_39, articleNumber: '24' },
      { ...CE, articleNumber: '103' },
      { ...LEY_39, articleNumber: '25' },
    ])
    expect(agruparPorLey(t.temas[0])).toEqual([
      { lawId: 'ley-39', shortName: 'Ley 39/2015', articleNumbers: ['24', '25'] },
      { lawId: 'ce', shortName: 'CE', articleNumbers: ['103'] },
    ])
  })

  it('conserva el orden en que el usuario fue construyendo', () => {
    const t = anadirArticulos(base(), 't1', [
      { ...CE, articleNumber: '103' },
      { ...LEY_39, articleNumber: '24' },
    ])
    expect(agruparPorLey(t.temas[0]).map((g) => g.lawId)).toEqual(['ce', 'ley-39'])
  })

  it('un tema vacío agrupa a nada (no a una entrada vacía)', () => {
    expect(agruparPorLey(temaVacio('t1', 1))).toEqual([])
  })
})

describe('qué impide guardar y qué solo avisa', () => {
  it('sin nombre no se guarda', () => {
    const t = anadirArticulo({ nombre: '  ', temas: [temaVacio('t1', 1)] }, 't1', {
      ...CE,
      articleNumber: '1',
    })
    expect(puedeGuardar(t)).toBe(false)
    expect(problemasParaGuardar(t).some((p) => p.campo === 'nombre')).toBe(true)
  })

  it('sin NINGÚN artículo no se guarda: serviría 0 preguntas', () => {
    expect(puedeGuardar(base())).toBe(false)
  })

  it('con nombre y un artículo, se guarda', () => {
    const t = anadirArticulo(base(), 't1', { ...CE, articleNumber: '1' })
    expect(puedeGuardar(t)).toBe(true)
  })

  it('un tema vacío entre otros AVISA pero no bloquea', () => {
    let t: Temario = { nombre: 'Agente de Hacienda', temas: [temaVacio('t1', 1), temaVacio('t2', 2)] }
    t = anadirArticulo(t, 't1', { ...CE, articleNumber: '1' })
    expect(puedeGuardar(t)).toBe(true)
    expect(problemasParaGuardar(t).some((p) => p.temaId === 't2')).toBe(true)
  })

  it('un nombre de una letra tampoco vale (lo cazó este propio test)', () => {
    // Salió escribiendo la prueba de arriba con `nombre: 'X'`: el guardado se bloqueaba y
    // parecía un fallo del código. Era la regla haciendo su trabajo, así que se fija aquí —
    // una regla que solo existe en la implementación es una regla que alguien quitará.
    const t = anadirArticulo({ nombre: 'X', temas: [temaVacio('t1', 1)] }, 't1', {
      ...CE,
      articleNumber: '1',
    })
    expect(puedeGuardar(t)).toBe(false)
    expect(problemasParaGuardar(t).find((p) => p.campo === 'nombre')?.mensaje).toMatch(/corto/i)
  })

  it('los problemas EXPLICAN, no son un booleano (si no, el botón gris no dice qué falta)', () => {
    const p = problemasParaGuardar({ nombre: '', temas: [] })
    expect(p.every((x) => x.mensaje.length > 0)).toBe(true)
  })

  it('cuenta el total de artículos', () => {
    let t: Temario = { nombre: 'X', temas: [temaVacio('t1', 1), temaVacio('t2', 2)] }
    t = anadirArticulos(t, 't1', [
      { ...CE, articleNumber: '1' },
      { ...CE, articleNumber: '2' },
    ])
    t = anadirArticulo(t, 't2', { ...LEY_39, articleNumber: '24' })
    expect(totalArticulos(t)).toBe(3)
  })
})

describe('el nombre público «X by Nombre I.»', () => {
  it('nombre de pila + iniciales del resto', () => {
    expect(nombrePublico('Agente de Hacienda', 'Sergio Pérez Castro')).toBe(
      'Agente de Hacienda by Sergio P.C.',
    )
  })

  it('con un solo nombre, no inventa iniciales', () => {
    expect(nombrePublico('Subalterno', 'Sergio')).toBe('Subalterno by Sergio')
  })

  it('sin autor conocido devuelve el nombre a secas (nunca «by undefined»)', () => {
    expect(nombrePublico('Subalterno', null)).toBe('Subalterno')
    expect(nombrePublico('Subalterno', '   ')).toBe('Subalterno')
  })

  it('no filtra el apellido completo ni el email: solo la inicial', () => {
    const r = nombrePublico('X', 'Marta Benito Padilla')
    expect(r).toBe('X by Marta B.P.')
    expect(r).not.toMatch(/Benito|Padilla|@/)
  })
})
