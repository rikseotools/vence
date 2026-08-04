// Trinquete de la SEMÁNTICA de conteo del gate de cierre de lotes
// (`scripts/verificar-batch-servido.cjs`, `npm run batch:servido`).
//
// Por qué existe: el 04/08/2026 el gate quedó en ROJO PERMANENTE. Recomputaba el
// conteo del tema excluyendo solo `exam_case_id IS NOT NULL`, y producción había
// empezado a restar además las preguntas OFICIALES DE OTRA OPOSICIÓN (T-507). La
// comparación no podía cuadrar nunca: acusaba «falta propagar (MV → Redis → tags)»
// con las tres cachés bien invalidadas, y mandaba a re-purgar en vano.
//
// Medido entonces, cerrando el lote `gen_estatut_cv_2026-08-04_lote1`:
//   subalterno_gva T3                            → recomputaba 52, servía 35
//   auxiliar_administrativo_diputacion_alicante T2 → 51 vs 35
//   administrativo_gva T6                         → 65 vs 45
// Los 35 del primero eran las 22 previas más las 13 del lote: la propagación había
// funcionado a la primera. Es el modo de fallo que el propio comentario del script
// ya documentaba («una auditoría que reimplementa la lógica de producción, deriva»),
// y en el que volvió a caer — un falso positivo con diagnóstico SEGURO, que es peor
// que no comprobar, porque acaba enseñando a ignorar el gate que impide servir un
// lote sin re-verificar.
//
// Lo que este test fija, y es lo único que evita que vuelva a divergir: que el gate
// decida con el MISMO helper que la API (`getValidExamPositions`, cuyo dueño es
// `lib/config/exam-positions.ts`) y no con una copia del mapa.

const fs = require('fs')
const path = require('path')

const GATE = path.join(__dirname, '..', '..', 'scripts', 'verificar-batch-servido.cjs')
const src = fs.readFileSync(GATE, 'utf8')

describe('batch:servido — cuenta con la misma semántica que sirve la app', () => {
  it('importa getValidExamPositions en vez de reimplementar el criterio', () => {
    expect(src).toMatch(/require\([^)]*exam-positions/)
    expect(src).toMatch(/getValidExamPositions/)
  })

  it('NO lleva una copia del mapa de exam_position', () => {
    // Un literal con nombres de oposición dentro del gate sería la segunda copia
    // del criterio: es exactamente así como nacieron los cinco escritores de T-130.
    expect(src).not.toMatch(/EXAM_POSITION_MAP\s*=/)
    expect(src).not.toMatch(/auxiliar administrativo del estado/)
  })

  it('excluye las dos cosas que la app no sirve: supuestos prácticos y oficiales ajenas', () => {
    expect(src).toMatch(/exam_case_id IS NULL/)
    expect(src).toMatch(/is_official_exam/)
    expect(src).toMatch(/exam_position = ANY/)
  })

  it('corre bajo tsx, que es lo que le permite importar el helper', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'))
    expect(pkg.scripts['batch:servido']).toMatch(/tsx/)
  })
})

describe('la regla de T-507, sobre el helper con dueño', () => {
  const { getValidExamPositions } = require('@/lib/config/exam-positions')

  it('una oposición SIN oficiales propias registradas no se queda ninguna', () => {
    // Es el caso que destapó todo: subalterno_gva no tiene posiciones registradas,
    // así que TODAS sus oficiales son ajenas y producción las resta enteras (52 → 35).
    expect(getValidExamPositions('subalterno_gva')).toEqual([])
  })

  it('una oposición con oficiales propias sí las conserva', () => {
    expect(getValidExamPositions('auxiliar_administrativo_estado').length).toBeGreaterThan(0)
  })

  it('normaliza guiones a guiones bajos (el gate recibe el slug y el position_type)', () => {
    expect(getValidExamPositions('auxiliar-administrativo-estado'))
      .toEqual(getValidExamPositions('auxiliar_administrativo_estado'))
  })
})
