// Unit del detector REAL de citas basura (scripts/audit-convocatoria-completitud.cjs), no una copia.
// Los casos salen del primer uso real: la verificación de SERMAS se registró apoyada en el MEMBRETE
// del boletín, no en una cláusula. Un guardarraíl que no distingue evidencia de decoración no sirve.
const { citaEsBasura } = require('../../scripts/audit-convocatoria-completitud.cjs')

describe('citaEsBasura — una cita debe PROBAR algo', () => {
  test('REGRESIÓN: el membrete del BOCM no prueba nada (caso real SERMAS)', () => {
    expect(citaEsBasura('VIERNES 4 DE JULIO DE 2025B.O.C.M. Núm. 158Pág. 171')).toBe(true)
    expect(citaEsBasura('BOLETÍN OFICIAL DE LA COMUNIDAD DE MADRID')).toBe(true)
  })

  test('una cláusula de verdad SÍ vale', () => {
    expect(citaEsBasura('Las plazas convocadas se proveerán por el sistema de turno libre, y se dividen en dos cupos: — Plazas del cupo general: 867.')).toBe(false)
    expect(citaEsBasura('La celebración del primer ejercicio se realizará en mayo de 2027.')).toBe(false)
    expect(citaEsBasura('El plazo de presentación de solicitudes será de veinte días hábiles.')).toBe(false)
  })

  test('vacía o demasiado corta para decir nada', () => {
    expect(citaEsBasura(null)).toBe(true)
    expect(citaEsBasura('')).toBe(true)
    expect(citaEsBasura('867 plazas')).toBe(true)
  })

  test('REGRESIÓN: la cita de Marta NO es basura (mi 1ª regla la rechazaba)', () => {
    // La lista blanca de verbos no incluía "realizará" → tumbaba LA cita del caso que originó el
    // sistema entero. Por eso el criterio mide prosa, no diccionario.
    expect(citaEsBasura('La celebración del primer ejercicio se realizará en mayo de 2027.')).toBe(false)
  })

  test('membrete CON cláusula pegada sí vale (no se descarta por llevar el nombre del boletín)', () => {
    expect(citaEsBasura('B.O.C.M. Núm. 158 — El plazo de presentación de solicitudes será de un mes.')).toBe(false)
  })
})
