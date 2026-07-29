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
