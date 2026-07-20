// Fija las dos piezas que hacen fiable al verificador cruft-aware
// (scripts/verify-law-literal.cjs), nacido del hallazgo de las 56 leyes con falso-verde
// de abril: separar leyes genuinamente rotas de FALSOS POSITIVOS.
const { stripCruft, containment } = require('../../scripts/verify-law-literal.cjs')

describe('stripCruft — quitar anotaciones editoriales de la fuente', () => {
  test('elimina notas de reforma, referencias y pies de página, conserva el articulado', () => {
    const src = [
      'Artículo 68',
      '1. Las sesiones se celebrarán entre el martes y el viernes.',
      '2. Podrán celebrarse en días diferentes por decisión de la Mesa.',
      'Este artículo fue modificado por la reforma del Reglamento aprobada por el Pleno.',
      'Ver el artículo 103.3 del Estatuto de Autonomía para Andalucía.',
      'Servicio de Publicaciones del Parlamento de Andalucía Pág. 31',
    ].join('\n')
    const out = stripCruft(src)
    expect(out).toContain('Las sesiones se celebrarán')
    expect(out).toContain('días diferentes')
    expect(out).not.toMatch(/fue modificado por la reforma/)
    expect(out).not.toMatch(/Ver el art/)
    expect(out).not.toMatch(/Servicio de Publicaciones|Pág\. 31/)
  })
})

describe('containment — ¿está la fuente (cruft-free) dentro de la BD?', () => {
  const src = 'sobre el escrito recibido se estampará el sello de registro con la fecha del día y el número de registro de la serie'
  test('BD completa (mismo texto) → contención alta', () => {
    expect(containment(src, 'Sobre el escrito recibido se estampará el sello de registro con la fecha del día y el número de registro de la serie.')).toBeGreaterThan(0.9)
  })
  test('BD parafraseada/truncada (resumen) → contención baja', () => {
    // el resumen real de la BD del Decreto 204/1995 art 15 (caso que destapó el cluster BOJA)
    expect(containment(src, 'Las operaciones de registro requieren la estampación de sello con fecha y número correlativo.')).toBeLessThan(0.35)
  })
})
