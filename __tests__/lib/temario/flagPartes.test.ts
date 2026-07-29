/**
 * @jest-environment node
 */
// Unitarios del flag del piloto de PDFs por partes (T-273).
//
// Lo que fija este test es la propiedad que hace seguro el piloto: **por defecto está APAGADO**, y
// mientras lo esté el comportamiento es exactamente el de hoy. El troceado solo entra donde el
// usuario ya recibía un 413, así que ninguna descarga que funciona puede empeorar.

import { isPdfPartesEnabled, isPdfPartesEnabledFor } from '@/lib/temario/pdf/flagPartes'

const guardar = { ...process.env }
afterEach(() => { process.env = { ...guardar } })

describe('flag del piloto — apagado por defecto', () => {
  it('sin variables, NO se trocea nada', () => {
    delete process.env.FEATURE_TEMARIO_PDF_PARTES
    delete process.env.FEATURE_TEMARIO_PDF_PARTES_SCOPE
    expect(isPdfPartesEnabled()).toBe(false)
    expect(isPdfPartesEnabledFor('auxiliar_administrativo_estado')).toBe(false)
  })

  it('solo `true` enciende: cualquier otro valor deja el flag apagado', () => {
    for (const v of ['1', 'yes', 'True', 'on', '']) {
      process.env.FEATURE_TEMARIO_PDF_PARTES = v
      expect(isPdfPartesEnabled()).toBe(false)
    }
  })

  it('el scope NO enciende por sí solo (sin el flag global no hay piloto)', () => {
    delete process.env.FEATURE_TEMARIO_PDF_PARTES
    process.env.FEATURE_TEMARIO_PDF_PARTES_SCOPE = 'auxiliar_administrativo_estado'
    expect(isPdfPartesEnabledFor('auxiliar_administrativo_estado')).toBe(false)
  })
})

describe('flag del piloto — rollout por oposición', () => {
  beforeEach(() => { process.env.FEATURE_TEMARIO_PDF_PARTES = 'true' })

  it('con scope de una oposición, solo esa entra en el piloto', () => {
    process.env.FEATURE_TEMARIO_PDF_PARTES_SCOPE = 'auxiliar_administrativo_estado'
    expect(isPdfPartesEnabledFor('auxiliar_administrativo_estado')).toBe(true)
    expect(isPdfPartesEnabledFor('celador_sas')).toBe(false)
  })

  it('acepta el SLUG además del position_type', () => {
    // La ruta pública recibe el slug (con guiones) y el flag se configura pensando en la
    // oposición: exigir una sola de las dos formas sería una trampa para quien lo encienda.
    process.env.FEATURE_TEMARIO_PDF_PARTES_SCOPE = 'auxiliar_administrativo_estado'
    expect(isPdfPartesEnabledFor('auxiliar-administrativo-estado')).toBe(true)
    process.env.FEATURE_TEMARIO_PDF_PARTES_SCOPE = 'auxiliar-administrativo-estado'
    expect(isPdfPartesEnabledFor('auxiliar_administrativo_estado')).toBe(true)
  })

  it('vacío o `all` aplica a todas (ampliación tras validar el piloto)', () => {
    for (const v of ['', 'all', 'ALL']) {
      process.env.FEATURE_TEMARIO_PDF_PARTES_SCOPE = v
      expect(isPdfPartesEnabledFor('cualquiera')).toBe(true)
    }
  })

  it('con scope activo y oposición desconocida, NO entra', () => {
    process.env.FEATURE_TEMARIO_PDF_PARTES_SCOPE = 'auxiliar_administrativo_estado'
    expect(isPdfPartesEnabledFor(null)).toBe(false)
    expect(isPdfPartesEnabledFor(undefined)).toBe(false)
  })

  it('la lista CSV admite espacios sin romperse', () => {
    process.env.FEATURE_TEMARIO_PDF_PARTES_SCOPE = ' celador_sas , auxiliar_administrativo_estado '
    expect(isPdfPartesEnabledFor('celador_sas')).toBe(true)
    expect(isPdfPartesEnabledFor('auxiliar_administrativo_estado')).toBe(true)
  })
})
