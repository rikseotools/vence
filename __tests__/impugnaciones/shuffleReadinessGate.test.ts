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

  // ⚠️ CAMBIO DE CRITERIO (31/07/2026). Este test decía lo contrario —«si no aceptamos la queja,
  // no hemos tocado la pregunta»— y ese razonamiento resultó ser justo el punto ciego.
  //
  // Lo destapó una impugnación real: una usuaria protestó por una pregunta de negación («señale
  // la incorrecta») del art. 9 de la Ley 39/2015. La clave era correcta, así que se RECHAZÓ… y
  // nada obligó a mirar la explicación, que decía «La opción B es incorrecta». Esa frase era a la
  // vez la CAUSA de su confusión —la leyó como «tu respuesta está mal»— y una cita por LETRA que
  // dejaba la pregunta sin poder barajarse.
  //
  // La lección: que rechacemos la queja no significa que no haya nada que arreglar. Un rechazo
  // suele significar que la persona no entendió la pregunta, y la primera sospechosa de eso es
  // NUESTRA explicación. Si de verdad no procede tocarla, está `skipShuffleReason`.
  it('SÍ se mete en un rechazo: que la queja no prospere no significa que la explicación esté bien', () => {
    const v = evaluarPreparacionBarajado({ questionType: 'legislative', status: 'rejected', explanationData: null })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.error).toMatch(/rechazada/)
  })

  it('un rechazo con la explicación ya estructurada pasa sin fricción', () => {
    const v = evaluarPreparacionBarajado({ questionType: 'legislative', status: 'rejected', explanationData: ESTRUCTURA })
    expect(v).toEqual({ ok: true, saltado: false })
  })

  it('y en un rechazo también vale el escape, con su motivo', () => {
    const v = evaluarPreparacionBarajado({
      questionType: 'legislative', status: 'rejected', explanationData: null,
      skipReason: 'La pregunta es de examen oficial y su explicacion se revisa en la campana aparte',
    })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.saltado).toBe(true)
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
