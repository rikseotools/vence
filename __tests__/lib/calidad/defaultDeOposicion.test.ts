/**
 * Un valor POR DEFECTO que es una oposición REAL. [T-541]
 *
 * El núcleo es puro para poder fijar aquí los casos que separan el defecto de lo legítimo: la
 * diferencia entre las dos cosas es lo único que hace usable al guardarraíl, porque un detector
 * que marca lo normal se deja de mirar.
 */
const { defaultsDeOposicion } = require('@/lib/calidad/defaultDeOposicion.cjs')

const IDS = new Set(['tcae-aragon', 'auxiliar-enfermeria-osakidetza', 'administrativo-estado', 'auxiliar_administrativo_estado'])

describe('caza el default que apunta a otra oposición', () => {
  it('el caso Alicia: un clon de TCAE Aragón con Osakidetza por defecto', () => {
    const src = `export default function TopicContentView({ content, oposicion = 'auxiliar-enfermeria-osakidetza' }) {}`
    expect(defaultsDeOposicion(src, IDS, 'tcae-aragon')).toEqual([
      { prop: 'oposicion', valor: 'auxiliar-enfermeria-osakidetza', linea: 1 },
    ])
  })

  it('el caso de T-541: el componente compartido con una oposición real por defecto', () => {
    const src = `const TestConfigurator = ({ positionType = 'auxiliar_administrativo_estado' }) => {}`
    expect(defaultsDeOposicion(src, IDS, null)).toHaveLength(1)
  })
})

describe('NO marca lo que es legítimo', () => {
  it('el clon que tiene por defecto SU PROPIA oposición', () => {
    const src = `function View({ oposicion = 'tcae-aragon' }) {}`
    expect(defaultsDeOposicion(src, IDS, 'tcae-aragon')).toEqual([])
  })

  it('…tanto con guiones como con guiones bajos (el mismo id se escribe de las dos formas)', () => {
    const src = `function View({ positionType = 'auxiliar_administrativo_estado' }) {}`
    expect(defaultsDeOposicion(src, IDS, 'auxiliar-administrativo-estado')).toEqual([])
  })

  it('un valor que no es ninguna oposición del catálogo', () => {
    const src = `function View({ modo = 'test-personalizado', color = 'blue-600' }) {}`
    expect(defaultsDeOposicion(src, IDS, null)).toEqual([])
  })

  it('una MENCIÓN en un comentario, que no construye ningún enlace', () => {
    // Justo el texto que uno escribe para avisar del problema: si lo marcara, documentarlo
    // rompería el CI y la gente dejaría de documentarlo.
    const src = [
      `// El default era oposicion = 'auxiliar-enfermeria-osakidetza' y mandaba al usuario a otra.`,
      ` * ver positionType = 'auxiliar_administrativo_estado' en la cabecera`,
      `function View({ oposicion = 'tcae-aragon' }) {}`,
    ].join('\n')
    expect(defaultsDeOposicion(src, IDS, 'tcae-aragon')).toEqual([])
  })

  it('una asignación que no es un default de parámetro pero cita la oposición', () => {
    // No se puede distinguir sin parsear; se acepta el falso positivo SOLO si el valor es una
    // oposición ajena, que es justo lo que hay que mirar a mano.
    const src = `const slug = 'administrativo-estado'`
    expect(defaultsDeOposicion(src, IDS, 'tcae-aragon')).toHaveLength(1)
  })
})

describe('detalles de medida', () => {
  it('da la línea, para no obligar a buscar a ciegas', () => {
    const src = `linea uno\nfunction View({ oposicion = 'administrativo-estado' }) {}`
    expect(defaultsDeOposicion(src, IDS, 'tcae-aragon')[0].linea).toBe(2)
  })

  it('sin contenido no inventa nada', () => {
    expect(defaultsDeOposicion('', IDS, null)).toEqual([])
    expect(defaultsDeOposicion(null, IDS, null)).toEqual([])
  })
})
