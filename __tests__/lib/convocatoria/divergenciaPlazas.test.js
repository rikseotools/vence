/**
 * @jest-environment node
 */
// Por qué divergen las plazas entre la fila legacy y su convocatoria (T-105).
//
// Todos los casos son REALES, de las 20 oposiciones publicadas con `plazas_libres` divergente
// el 26/07/2026, y llevan su cita del boletín en el comentario. El núcleo solo afirma que
// gana la convocatoria cuando la ARITMÉTICA explica la diferencia — porque el atajo tentador
// («la legacy siempre está stale, cópiala») ya se demostró falso en esta misma tarea: en
// `estado_proceso` la adjudicación salió 7-7.

const { clasificarDivergenciaPlazas } = require('@/lib/convocatoria/divergenciaPlazas')

describe('divergenciaPlazas — la reserva va DENTRO', () => {
  it('universidad-alcalá: «cubrir cincuenta y cuatro plazas […] se reservan dos» → 54, no 52', () => {
    const r = clasificarDivergenciaPlazas({ legacy: 52, conv: 54, discapacidad: 2, incluidas: true })
    expect(r.patron).toBe('legacy_resta_reserva')
    expect(r.ganaConvocatoria).toBe(true)
    expect(r.explicacion).toMatch(/54 convocadas/)
  })

  it('universidad-huelva: «45 plazas […] se reservarán 7» → 45, no 38', () => {
    expect(clasificarDivergenciaPlazas({ legacy: 38, conv: 45, discapacidad: 7, incluidas: true }).ganaConvocatoria).toBe(true)
  })

  it('tcae-murcia: 273 libre con 19 de reserva dentro → 273, no 254', () => {
    expect(clasificarDivergenciaPlazas({ legacy: 254, conv: 273, discapacidad: 19, promocionInterna: 25, incluidas: true }).patron).toBe('legacy_resta_reserva')
  })
})

describe('divergenciaPlazas — la reserva va APARTE', () => {
  it('ayuntamiento de murcia: «Dieciocho […] turno libre. Dos […] turno reservado» → 18, no 20', () => {
    const r = clasificarDivergenciaPlazas({ legacy: 20, conv: 18, discapacidad: 2, incluidas: false })
    expect(r.patron).toBe('legacy_suma_reserva')
    expect(r.ganaConvocatoria).toBe(true)
  })

  it('diputación de león: 13 + 4 = 17 → turno libre 13', () => {
    expect(clasificarDivergenciaPlazas({ legacy: 17, conv: 13, discapacidad: 4, incluidas: false }).patron).toBe('legacy_suma_reserva')
  })

  it('auxiliar cyl: 317 + 45 = 362', () => {
    expect(clasificarDivergenciaPlazas({ legacy: 362, conv: 317, discapacidad: 45, incluidas: false }).ganaConvocatoria).toBe(true)
  })
})

describe('divergenciaPlazas — la legacy guarda el total del proceso', () => {
  it('enfermero-scs-canarias: «2216 80 135 2431» → libre 2.216', () => {
    const r = clasificarDivergenciaPlazas({ legacy: 2431, conv: 2216, discapacidad: 80, promocionInterna: 135, incluidas: false })
    expect(r.patron).toBe('legacy_es_total')
    expect(r.ganaConvocatoria).toBe(true)
  })
})

describe('divergenciaPlazas — lo que NO se puede resolver con aritmética', () => {
  // administrativo-asturias: legacy 31/0/5 frente a convocatoria 16/109/1. No cuadra por
  // ningún lado y su `boe_reference` no trae cifras: huele a dos procesos distintos.
  it('cifras que no cuadran → sin_patron, y NO da por ganadora a la convocatoria', () => {
    const r = clasificarDivergenciaPlazas({ legacy: 31, conv: 16, discapacidad: 1, promocionInterna: 109, incluidas: null })
    expect(r.patron).toBe('sin_patron')
    expect(r.ganaConvocatoria).toBe(false)
    expect(r.explicacion).toMatch(/cita del boletín/)
  })

  it('una diferencia de uno tampoco pasa por patrón (universidad de cádiz: 10 vs 11)', () => {
    expect(clasificarDivergenciaPlazas({ legacy: 10, conv: 11, discapacidad: 2, incluidas: true }).patron).toBe('sin_patron')
  })

  it('la semántica manda: con la reserva DENTRO, sumarla no vale como explicación', () => {
    // Si `incluidas=true`, que legacy sea conv+disc NO es el patrón esperado; sin la guarda
    // por `incluidas` este caso pasaría por bueno en el sentido contrario.
    expect(clasificarDivergenciaPlazas({ legacy: 56, conv: 54, discapacidad: 2, incluidas: true }).patron).toBe('sin_patron')
  })

  it('sin reserva no hay nada que explicar', () => {
    expect(clasificarDivergenciaPlazas({ legacy: 30, conv: 25, discapacidad: 0, incluidas: false }).patron).toBe('sin_patron')
  })

  it('valores iguales o ausentes no inventan patrón', () => {
    expect(clasificarDivergenciaPlazas({ legacy: 10, conv: 10 }).patron).toBe('iguales')
    expect(clasificarDivergenciaPlazas({ legacy: null, conv: 10 }).patron).toBe('sin_patron')
  })
})

describe('divergenciaPlazas — el total, con la reserva DENTRO', () => {
  // osakidetza: «turno libre 920 destinos (856 acceso general + 64 cupo de reserva)» y 7 de
  // promoción interna. La legacy guardaba 927 = 920 + 7: la reserva NO se vuelve a sumar
  // porque ya está dentro de los 920.
  it('osakidetza: 920 libre (64 dentro) + 7 promoción interna = 927', () => {
    const r = clasificarDivergenciaPlazas({ legacy: 927, conv: 920, discapacidad: 64, promocionInterna: 7, incluidas: true })
    expect(r.patron).toBe('legacy_es_total')
    expect(r.ganaConvocatoria).toBe(true)
    expect(r.explicacion).toMatch(/920 turno libre \+ 7 promoción interna/)
  })
})

describe('divergenciaPlazas — solo vale para plazas_libres', () => {
  // Lo destapó el cableado al detector: aplicado a `plazas_discapacidad` soltó
  // «la legacy guarda el turno general (88 convocadas − 88 reservadas = 0)», comparando el
  // campo de discapacidad consigo mismo. Un veredicto con pinta de seguro y sin sentido.
  it('rechaza plazas_discapacidad en vez de inventar un veredicto', () => {
    const r = clasificarDivergenciaPlazas({ campo: 'plazas_discapacidad', legacy: 0, conv: 88, discapacidad: 88, incluidas: true })
    expect(r.patron).toBe('sin_patron')
    expect(r.ganaConvocatoria).toBe(false)
    expect(r.explicacion).toMatch(/solo vale para plazas_libres/)
  })

  it('rechaza plazas_promocion_interna', () => {
    expect(clasificarDivergenciaPlazas({ campo: 'plazas_promocion_interna', legacy: 0, conv: 340, discapacidad: 340, incluidas: true }).ganaConvocatoria).toBe(false)
  })

  it('sin `campo` sigue funcionando (retrocompatible con los planes ya escritos)', () => {
    expect(clasificarDivergenciaPlazas({ legacy: 52, conv: 54, discapacidad: 2, incluidas: true }).patron).toBe('legacy_resta_reserva')
  })

  it('con `campo: plazas_libres` explícito, igual', () => {
    expect(clasificarDivergenciaPlazas({ campo: 'plazas_libres', legacy: 52, conv: 54, discapacidad: 2, incluidas: true }).patron).toBe('legacy_resta_reserva')
  })
})
