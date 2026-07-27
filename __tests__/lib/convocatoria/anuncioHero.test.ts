// __tests__/lib/convocatoria/anuncioHero.test.ts — núcleo PURO del anuncio del hero.
//
// Cierra el hueco `hero_badge` declarado en lib/admin/landingSurfaces.ts (T-134): el hero
// anunciaba "CONVOCATORIA PUBLICADA" con solo tener referencia de boletín, aunque el proceso
// estuviera en `oep_aprobada` (plazas aprobadas, convocatoria sin publicar).

import { anuncioHero, esOepSinConvocatoria, ESTADOS_SIN_CONVOCATORIA } from '@/lib/convocatoria/anuncioHero'

describe('esOepSinConvocatoria', () => {
  it.each(ESTADOS_SIN_CONVOCATORIA)('%s ⇒ todavía NO hay convocatoria', (estado) => {
    expect(esOepSinConvocatoria(estado)).toBe(true)
  })

  it.each(['convocada', 'convocatoria_publicada', 'inscripcion_abierta', 'inscripcion_cerrada',
    'lista_admitidos', 'pendiente_examen', 'examen_realizado', 'resultados', 'nombramientos'])(
    '%s ⇒ hay convocatoria', (estado) => {
      expect(esOepSinConvocatoria(estado)).toBe(false)
    })

  it('sin estado (null/undefined) se comporta como `sin_oep`', () => {
    expect(esOepSinConvocatoria(null)).toBe(true)
    expect(esOepSinConvocatoria(undefined)).toBe(true)
  })

  it('un estado NUEVO desconocido se trata como "hay convocatoria" (permisivo, como antes)', () => {
    // Decisión consciente: una lista blanca dejaría landings mudas al añadir un estado.
    expect(esOepSinConvocatoria('fase_lunar_inventada')).toBe(false)
  })
})

describe('anuncioHero — el caso REAL que lo motivó (APSP CARM, soporte 27/07)', () => {
  // Su ciclo vigente: OEP 2025 aprobada (50 plazas), convocatoria SIN publicar, pero con
  // boe_reference del Decreto 233/2025. El hero le decía que la convocatoria estaba publicada
  // y el usuario escribió "¿la instancia está cerrada? No termino de encontrar información".
  const apsp = {
    estadoProceso: 'oep_aprobada',
    boeReference: 'Decreto n.º 233/2025, de 11 de diciembre',
    boeFechaCorta: '19/12/2025',
  }

  it('NO afirma que haya convocatoria publicada', () => {
    const a = anuncioHero(apsp)
    expect(a.hayConvocatoria).toBe(false)
    expect(a.badge).not.toContain('CONVOCATORIA')
    expect(a.titulo).not.toMatch(/convocatoria oficial publicada/i)
  })

  it('dice lo que el opositor necesita saber: plazas aprobadas y convocatoria pendiente', () => {
    const a = anuncioHero(apsp)
    expect(a.badge).toBe('PLAZAS APROBADAS 19/12/2025')
    expect(a.titulo).toBe('Plazas aprobadas, convocatoria pendiente de publicarse')
  })

  it('tener referencia de boletín NO basta para afirmar convocatoria', () => {
    // Ese era exactamente el bug: `boeRef ? 'Convocatoria oficial publicada' : …`
    expect(anuncioHero({ ...apsp, boeReference: 'cualquier referencia' }).hayConvocatoria).toBe(false)
  })
})

describe('anuncioHero — con convocatoria de verdad no cambia nada (no romper lo que ya iba bien)', () => {
  it('mantiene el texto histórico, con fecha', () => {
    const a = anuncioHero({
      estadoProceso: 'inscripcion_abierta',
      boeReference: 'BOE-A-2026-1234',
      boeFechaCorta: '12/03/2026',
    })
    expect(a).toEqual({
      badge: 'CONVOCATORIA PUBLICADA 12/03/2026',
      titulo: 'Convocatoria oficial publicada',
      hayConvocatoria: true,
    })
  })

  it('sin fecha de publicación, el badge no inventa una', () => {
    const a = anuncioHero({ estadoProceso: 'resultados', boeReference: 'BOE-A-2025-1', boeFechaCorta: null })
    expect(a.badge).toBe('CONVOCATORIA PUBLICADA')
    expect(a.hayConvocatoria).toBe(true)
  })

  it('con convocatoria pero sin referencia, cae al texto neutro de siempre', () => {
    expect(anuncioHero({ estadoProceso: 'convocada', boeReference: null }).titulo).toBe('Preparación disponible')
  })
})

describe('anuncioHero — sin oferta ni convocatoria', () => {
  it('sin_oep ⇒ preparación disponible', () => {
    expect(anuncioHero({ estadoProceso: 'sin_oep' })).toEqual({
      badge: 'PREPARACIÓN', titulo: 'Preparación disponible', hayConvocatoria: false,
    })
  })

  it('sin datos de estado tampoco afirma nada', () => {
    const a = anuncioHero({ estadoProceso: null })
    expect(a.hayConvocatoria).toBe(false)
    expect(a.badge).toBe('PREPARACIÓN')
  })

  it('oep_aprobada SIN fecha: anuncia las plazas sin inventar cuándo', () => {
    expect(anuncioHero({ estadoProceso: 'oep_aprobada', boeFechaCorta: null }).badge).toBe('PLAZAS APROBADAS')
  })
})
