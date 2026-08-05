/**
 * @jest-environment node
 */
// Núcleo puro de T-443: detecta que un push suprime código de la infraestructura de
// coordinación (scripts/*.cjs, lib/backlog/**, lib/sessions/**, lib/calidad/**, .husky/*) que ya
// está en `origin/main`. Ver lib/backlog/codigoSuprimido.cjs para el porqué completo.
import { findCodigoSuprimido, esBloqueante, lineasSignificativas, MIN_LINEAS_SUPRIMIDAS } from '../../lib/backlog/codigoSuprimido.cjs'

describe('lineasSignificativas', () => {
  it('ignora líneas vacías y de puro relleno decorativo', () => {
    const m = lineasSignificativas('\n// ──────────────\nconst x = 1\n\n===\n')
    expect([...m.keys()]).toEqual(['const x = 1'])
  })

  it('cuenta repeticiones (multiconjunto, no conjunto)', () => {
    const m = lineasSignificativas('return null\nreturn null\nreturn null')
    expect(m.get('return null')).toBe(3)
  })

  it('recorta espacio en los extremos antes de comparar (tolera reindentado)', () => {
    const m = lineasSignificativas('    const x = 1')
    expect(m.has('const x = 1')).toBe(true)
  })
})

describe('findCodigoSuprimido', () => {
  it('no marca nada si el fichero no cambia', () => {
    const texto = 'function foo() {\n  return 1\n}\n'
    expect(findCodigoSuprimido(texto, texto).total).toBe(0)
  })

  it('no marca nada si solo se AÑADE código', () => {
    const antes = 'function foo() {\n  return 1\n}\n'
    const despues = antes + '\nfunction bar() {\n  return 2\n}\n'
    expect(findCodigoSuprimido(antes, despues).total).toBe(0)
  })

  it('no penaliza reordenar líneas que siguen todas presentes', () => {
    const antes = 'const a = 1\nconst b = 2\nconst c = 3\n'
    const despues = 'const c = 3\nconst a = 1\nconst b = 2\n'
    expect(findCodigoSuprimido(antes, despues).total).toBe(0)
  })

  it('detecta líneas que existían y ya no están', () => {
    const antes = 'const gitFichas = require("./gitFichas.cjs")\nconst x = gitFichas.hechosDeOrigin()\n'
    const despues = ''
    const r = findCodigoSuprimido(antes, despues)
    expect(r.total).toBe(2)
    expect(r.suprimidas.map((s) => s.linea)).toEqual(expect.arrayContaining([
      'const gitFichas = require("./gitFichas.cjs")',
      'const x = gitFichas.hechosDeOrigin()',
    ]))
  })

  it('una línea repetida solo cuenta lo que falta respecto al lado nuevo, no cada aparición', () => {
    // 3 apariciones antes, 2 después → falta 1, no 3.
    const antes = 'return null\nreturn null\nreturn null\n'
    const despues = 'return null\nreturn null\n'
    expect(findCodigoSuprimido(antes, despues).total).toBe(1)
  })

  it('REPRODUCE el incidente T-441: una copia rancia pierde el cableado de T-427', () => {
    // Fragmento real reconstruido del diff de 6f3e26261: el CLI dejó de requerir el módulo y de
    // llamar a sus funciones exportadas, que seguían existiendo (arreglo vivo pero inerte).
    const publicado = [
      'const {',
      '  hechosDeOrigin,',
      '  clasificarHuerfanas,',
      '  refrescarOrigin,',
      "} = require(path.join(__dirname, '..', 'lib', 'backlog', 'gitFichas.cjs'))",
      '',
      'function sync() {',
      '  refrescarOrigin()',
      '  const origen = hechosDeOrigin()',
      '  const resultado = clasificarHuerfanas({ origen, esMia: claimedByMe })',
      '  return resultado',
      '}',
    ].join('\n')
    // La copia rancia: mismo `sync` pero sin ninguna referencia al módulo.
    const rancio = [
      'function sync() {',
      '  const resultado = { huerfanas: [] }',
      '  return resultado',
      '}',
    ].join('\n')

    const r = findCodigoSuprimido(publicado, rancio)
    expect(esBloqueante(r)).toBe(false) // por debajo del suelo en este fragmento corto a propósito
    expect(r.total).toBeGreaterThan(0)
    expect(r.suprimidas.some((s) => s.linea.includes('gitFichas.cjs'))).toBe(true)
  })
})

describe('esBloqueante', () => {
  it('por debajo del suelo, no bloquea', () => {
    expect(esBloqueante({ total: MIN_LINEAS_SUPRIMIDAS - 1 })).toBe(false)
  })

  it('en el suelo o por encima, bloquea', () => {
    expect(esBloqueante({ total: MIN_LINEAS_SUPRIMIDAS })).toBe(true)
  })

  it('admite un umbral distinto', () => {
    expect(esBloqueante({ total: 5 }, { minLineas: 5 })).toBe(true)
    expect(esBloqueante({ total: 4 }, { minLineas: 5 })).toBe(false)
  })
})
