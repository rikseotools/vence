/**
 * ¿Debe un re-clonado reemplazar el texto que ya hay en el corpus?
 *
 * Las dos direcciones de fallo son caras y opuestas:
 *  - reemplazar de más → un re-clonado que capturó el menú del portal destruye el documento bueno
 *    (pasó: el chrome del DOGC, 4 KB de «Sortir ràpid»; el sumario del BOJA, 32 KB de menús);
 *  - reemplazar de menos → el documento queda congelado con una extracción pobre y re-clonarlo no
 *    hace nada, que es como el 561 de policia-municipal-madrid acabó "PROBADO" sin prueba.
 */
const { decidirRefresco } = require('@/lib/convocatoria/refrescoDocumento.cjs') as {
  decidirRefresco: (
    a: string | null | undefined,
    n: string | null | undefined,
    o?: { forzar?: boolean },
  ) => { accion: 'insertar' | 'reemplazar' | 'conservar'; motivo: string }
}

const accion = (a: string | null | undefined, n: string | null | undefined, o?: { forzar?: boolean }) =>
  decidirRefresco(a, n, o).accion

describe('decidirRefresco', () => {
  it('inserta cuando no había nada', () => {
    expect(accion(null, 'el documento')).toBe('insertar')
    expect(accion('', 'el documento')).toBe('insertar')
    expect(accion('   ', 'el documento')).toBe('insertar')
  })

  it('conserva si la extracción nueva vino vacía (no se destruye por un fetch fallido)', () => {
    expect(accion('texto bueno', '')).toBe('conservar')
    expect(accion('texto bueno', null)).toBe('conservar')
    expect(accion(null, null)).toBe('conservar')
  })

  it('conserva si el texto es idéntico (re-clonar sin cambios no toca nada)', () => {
    expect(accion('mismo texto', 'mismo texto')).toBe('conservar')
    expect(accion('  mismo texto  ', 'mismo texto')).toBe('conservar')
  })

  it('EL CASO RAÍZ: el texto nuevo contiene al viejo y lo amplía ⇒ reemplaza', () => {
    // El cuerpo del anuncio del BOE (1.864 chars) frente a la página entera, que además trae la
    // ficha de análisis con «Turno libre: … 561 plazas» (3.056 chars).
    const cuerpo = 'II. AUTORIDADES Y PERSONAL. Ciento trece plazas … Cuatrocientas cuarenta y ocho plazas …'
    const conFicha = `${cuerpo} Turno libre: Policía del Cuerpo de Policía Municipal 561 plazas.`
    const d = decidirRefresco(cuerpo, conFicha)
    expect(d.accion).toBe('reemplazar')
    expect(d.motivo).toMatch(/contiene al anterior/)
  })

  it('reemplaza si el nuevo es sustancialmente más completo aunque no lo contenga literal', () => {
    expect(accion('a'.repeat(1000), 'b'.repeat(2000))).toBe('reemplazar')
  })

  it('CONSERVA si el nuevo es más corto: es la firma del menú del portal', () => {
    const documento = 'x'.repeat(20000)
    const menuDelPortal = 'Sortir ràpid Contactar Mapa web Avís legal'
    const d = decidirRefresco(documento, menuDelPortal)
    expect(d.accion).toBe('conservar')
    expect(d.motivo).toMatch(/menú del portal|--refrescar-texto/)
  })

  it('conserva ante una mejora marginal (ruido de extracción, no documento nuevo)', () => {
    expect(accion('x'.repeat(1000), 'y'.repeat(1050))).toBe('conservar')
  })

  it('--refrescar-texto manda: reemplaza aunque el nuevo sea más corto', () => {
    const d = decidirRefresco('x'.repeat(20000), 'texto corto pero correcto', { forzar: true })
    expect(d.accion).toBe('reemplazar')
    expect(d.motivo).toMatch(/forzado/)
  })

  it('ni --forzar reemplaza con una extracción vacía', () => {
    expect(accion('texto bueno', '', { forzar: true })).toBe('conservar')
  })

  it('siempre explica el porqué (el motivo se imprime al operador)', () => {
    for (const [a, n] of [[null, 'x'], ['a', 'a'], ['x'.repeat(9), 'y'], ['a', 'a b c d e f g h i j']] as const) {
      expect(decidirRefresco(a, n).motivo.length).toBeGreaterThan(10)
    }
  })
})
