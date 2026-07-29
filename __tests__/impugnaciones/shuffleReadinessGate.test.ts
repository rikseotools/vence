/**
 * La PUERTA de barajado al cerrar una impugnación (`lib/api/v2/dispute/shuffleReadiness.ts`).
 *
 * Existe porque el manual pide evaluar SIEMPRE la explicación al trabajar una impugnación y dejarla
 * en formato barajable, y hasta el 29/07/2026 eso solo se AVISABA en tres sitios distintos (dossier,
 * validador y este endpoint), los tres sin bloquear. Estos tests fijan dónde corta y —más importante—
 * dónde NO corta: una puerta que estorba en los casos legítimos se acaba saltando siempre.
 */
import { evaluarPreparacionBarajado } from '@/lib/api/v2/dispute/shuffleReadiness'

const ESTRUCTURA = { intro: 'algo', options: { '0': 'razón A', '1': 'razón B' } }

describe('corta cuando toca', () => {
  it('impide cerrar como resuelta una legislativa sin explicación estructurada', () => {
    const v = evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: null })
    expect(v.ok).toBe(false)
    if (!v.ok) {
      // El mensaje tiene que decir QUÉ hacer, no solo que no. Un error sin salida se ignora.
      expect(v.error).toMatch(/aplicar-explicacion\.ts/)
      expect(v.error).toMatch(/skipShuffleReason/)
    }
  })

  it('trata el objeto vacío como "sin estructura" (una fila `{}` no es una explicación)', () => {
    expect(evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: {} }).ok).toBe(false)
  })

  it('no acepta un motivo de escape de dos palabras', () => {
    const v = evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: null, skipReason: 'no aplica' })
    expect(v.ok).toBe(false)
  })
})

describe('NO corta donde no debe', () => {
  it('deja pasar si la pregunta ya tiene explicación estructurada', () => {
    const v = evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: ESTRUCTURA })
    expect(v).toEqual({ ok: true, saltado: false })
  })

  it('no se mete en un RECHAZO: si no aceptamos la queja, no hemos tocado la pregunta', () => {
    const v = evaluarPreparacionBarajado({ questionType: 'legislative', status: 'rejected', explanationData: null })
    expect(v).toEqual({ ok: true, saltado: false })
  })

  it('no se mete en las PSICOTÉCNICAS, que no tienen explicación estructurada', () => {
    const v = evaluarPreparacionBarajado({ questionType: 'psychometric', status: 'resolved', explanationData: null })
    expect(v).toEqual({ ok: true, saltado: false })
  })

  it('deja pasar si la pregunta está RETIRADA: no se sirve a nadie', () => {
    // Primer falso positivo real de la puerta (30/07): una impugnación de `pregunta_repetida` cuya
    // resolución fue RETIRAR la pregunta impugnada como duplicada. La puerta la paró exigiéndole una
    // explicación barajable que no protege nada, porque esa pregunta ya no sale en ningún test.
    const v = evaluarPreparacionBarajado({
      questionType: 'legislative', status: 'resolved', explanationData: null, isActive: false,
    })
    expect(v).toEqual({ ok: true, saltado: false })
  })

  it('si NO se sabe si está activa, se trata como activa (lado prudente)', () => {
    expect(evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: null, isActive: null }).ok).toBe(false)
    expect(evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: null }).ok).toBe(false)
  })

  it('una pregunta ACTIVA sin estructura sigue parándose', () => {
    expect(evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: null, isActive: true }).ok).toBe(false)
  })

  it('NO exige que sea barajable: hay preguntas legítimamente no barajables', () => {
    // Esta es la distinción que mantiene la puerta usable. Exigir `shuffle_safety='safe'` bloquearía
    // las preguntas cuyas opciones se citan entre sí («todas las anteriores»), que NO son un defecto.
    // La puerta exige estar ADAPTADA (tener estructura), no poder barajarse.
    const v = evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: ESTRUCTURA })
    expect(v.ok).toBe(true)
  })
})

describe('el escape deja rastro', () => {
  it('con un motivo suficiente deja pasar y lo devuelve para registrarlo', () => {
    const motivo = 'la pregunta se jubila por irreparable, no procede reescribir su explicación'
    const v = evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: null, skipReason: motivo })
    expect(v).toEqual({ ok: true, saltado: true, motivo })
  })

  it('recorta espacios del motivo antes de medirlo', () => {
    const v = evaluarPreparacionBarajado({ questionType: 'legislative', status: 'resolved', explanationData: null, skipReason: '   corta   ' })
    expect(v.ok).toBe(false)
  })
})
