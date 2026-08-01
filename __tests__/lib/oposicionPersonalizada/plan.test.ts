/**
 * De lo que el usuario armó a lo que se escribe en la base de datos. (T-327)
 *
 * Todo lo que se prueba aquí falla EN SILENCIO si está mal: Postgres acepta un scope inflado, un
 * tema vacío o un `position_type` colisionado sin rechistar. El usuario no ve un error: ve un
 * temario distinto del que construyó, o el de otra persona mezclado con el suyo.
 */
import {
  construirPlan,
  positionTypeDe,
  esPersonalizada,
} from '@/lib/api/oposicionPersonalizada/plan'

const ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const LEY_39 = 'ley-39'
const CE = 'ce'

describe('el position_type se deriva del ID, nunca del nombre', () => {
  it('dos oposiciones con el MISMO nombre no colisionan', () => {
    // Pasa de verdad: la etiqueta «Subalterno» que creó un usuario se la han llevado 25
    // personas. Un slug por nombre mezclaría sus temarios en el mismo topic_scope.
    const a = positionTypeDe('11111111-1111-1111-1111-111111111111')
    const b = positionTypeDe('22222222-2222-2222-2222-222222222222')
    expect(a).not.toBe(b)
  })

  it('se reconoce como personalizada (para no tratarla como del catálogo)', () => {
    expect(esPersonalizada(positionTypeDe(ID))).toBe(true)
    expect(esPersonalizada('auxiliar_administrativo_estado')).toBe(false)
    expect(esPersonalizada(null)).toBe(false)
  })

  it('no lleva guiones: es un identificador, no un uuid pegado', () => {
    expect(positionTypeDe(ID)).not.toMatch(/-/)
  })
})

describe('qué se descarta y por qué', () => {
  it('los temas SIN artículos no se guardan', () => {
    // Se guardarían y al entrar no habría nada que estudiar: es justo el problema que esta
    // función viene a resolver.
    const { plan } = construirPlan(
      {
        nombre: 'Agente de Hacienda',
        temas: [
          { titulo: 'Tema 1', articulos: [{ lawId: CE, articleNumber: '1' }] },
          { titulo: 'Tema 2', articulos: [] },
        ],
      },
      ID,
    )
    expect(plan!.temas).toHaveLength(1)
  })

  it('tras descartar los vacíos, los temas se RENUMERAN sin huecos', () => {
    const { plan } = construirPlan(
      {
        nombre: 'Agente de Hacienda',
        temas: [
          { titulo: 'A', articulos: [] },
          { titulo: 'B', articulos: [{ lawId: CE, articleNumber: '1' }] },
          { titulo: 'C', articulos: [{ lawId: CE, articleNumber: '2' }] },
        ],
      },
      ID,
    )
    expect(plan!.temas.map((t) => t.topicNumber)).toEqual([1, 2])
    expect(plan!.temas.map((t) => t.titulo)).toEqual(['B', 'C'])
  })

  it('un tema sin título recibe uno, nunca se queda en blanco', () => {
    const { plan } = construirPlan(
      { nombre: 'Agente de Hacienda', temas: [{ titulo: '   ', articulos: [{ lawId: CE, articleNumber: '1' }] }] },
      ID,
    )
    expect(plan!.temas[0].titulo).toBe('Tema 1')
  })
})

describe('el scope tiene la forma exacta de topic_scope', () => {
  it('agrupa por ley y deduplica los artículos repetidos', () => {
    // Un repetido no da error en Postgres: infla el scope y el usuario ve la misma pregunta
    // dos veces sin saber por qué.
    const { plan } = construirPlan(
      {
        nombre: 'Agente de Hacienda',
        temas: [
          {
            titulo: 'T1',
            articulos: [
              { lawId: LEY_39, articleNumber: '24' },
              { lawId: CE, articleNumber: '103' },
              { lawId: LEY_39, articleNumber: '24' },
              { lawId: LEY_39, articleNumber: '25' },
            ],
          },
        ],
      },
      ID,
    )
    expect(plan!.temas[0].scope).toEqual([
      { lawId: LEY_39, articleNumbers: ['24', '25'] },
      { lawId: CE, articleNumbers: ['103'] },
    ])
  })

  it('«toda la ley» viaja como NULL, no como lista', () => {
    const { plan } = construirPlan(
      {
        nombre: 'Agente de Hacienda',
        temas: [{ titulo: 'T1', articulos: [{ lawId: LEY_39, articleNumber: null }] }],
      },
      ID,
    )
    expect(plan!.temas[0].scope).toEqual([{ lawId: LEY_39, articleNumbers: null }])
  })

  it('la ley entera MANDA sobre los artículos sueltos de esa misma ley', () => {
    // Guardar las dos formas haría que el temario se contradiga consigo mismo.
    const { plan } = construirPlan(
      {
        nombre: 'Agente de Hacienda',
        temas: [
          {
            titulo: 'T1',
            articulos: [
              { lawId: LEY_39, articleNumber: '24' },
              { lawId: LEY_39, articleNumber: null },
              { lawId: LEY_39, articleNumber: '25' },
            ],
          },
        ],
      },
      ID,
    )
    expect(plan!.temas[0].scope).toEqual([{ lawId: LEY_39, articleNumbers: null }])
  })

  it('…y solo sobre ESA ley', () => {
    const { plan } = construirPlan(
      {
        nombre: 'Agente de Hacienda',
        temas: [
          {
            titulo: 'T1',
            articulos: [
              { lawId: CE, articleNumber: '103' },
              { lawId: LEY_39, articleNumber: null },
            ],
          },
        ],
      },
      ID,
    )
    expect(plan!.temas[0].scope).toEqual([
      { lawId: CE, articleNumbers: ['103'] },
      { lawId: LEY_39, articleNumbers: null },
    ])
  })

  it('una entrada sin lawId se ignora en vez de escribir basura', () => {
    const { plan } = construirPlan(
      {
        nombre: 'Agente de Hacienda',
        temas: [
          {
            titulo: 'T1',
            articulos: [
              { lawId: '', articleNumber: '1' } as never,
              { lawId: CE, articleNumber: '103' },
            ],
          },
        ],
      },
      ID,
    )
    expect(plan!.temas[0].scope).toEqual([{ lawId: CE, articleNumbers: ['103'] }])
  })
})

describe('lo que NO se puede guardar', () => {
  it('sin nombre válido → error explicado, no excepción', () => {
    const { plan, errores } = construirPlan({ nombre: 'X', temas: [] }, ID)
    expect(plan).toBeNull()
    expect(errores.some((e) => e.campo === 'nombre')).toBe(true)
    expect(errores.every((e) => e.mensaje.length > 0)).toBe(true)
  })

  it('sin ningún tema con contenido → error explicado', () => {
    const { plan, errores } = construirPlan(
      { nombre: 'Agente de Hacienda', temas: [{ titulo: 'T1', articulos: [] }] },
      ID,
    )
    expect(plan).toBeNull()
    expect(errores.some((e) => e.campo === 'temas')).toBe(true)
  })

  it('una entrada basura no revienta', () => {
    expect(() => construirPlan({} as never, ID)).not.toThrow()
    expect(construirPlan({} as never, ID).plan).toBeNull()
  })
})

describe('el nombre se limpia', () => {
  it('quita espacios sobrantes y colapsa los de dentro', () => {
    const { plan } = construirPlan(
      {
        nombre: '  Agente   de    Hacienda  ',
        temas: [{ titulo: 'T1', articulos: [{ lawId: CE, articleNumber: '1' }] }],
      },
      ID,
    )
    expect(plan!.nombre).toBe('Agente de Hacienda')
  })
})
