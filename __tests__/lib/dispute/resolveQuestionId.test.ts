import { resolveDisputeQuestionId } from '@/lib/api/dispute/resolveQuestionId'

// UUIDs reales del incidente del 21/07 (caso María José).
const ACERCA_DE = 'dcc3a220-8b99-4071-92f8-38c7686f7f4e' // la que quería impugnar
const WIN_L = '3bfcfd34-4444-4444-4444-444444444444'     // la stale de localStorage (Win+L)

describe('resolveDisputeQuestionId — solo fuentes explícitas y vivas', () => {
  it('prop explícita gana sobre todo (botón inline del test)', () => {
    expect(
      resolveDisputeQuestionId({
        propQuestionId: ACERCA_DE,
        urlPath: '/pregunta/' + WIN_L,
        contextQuestionId: WIN_L,
      }),
    ).toBe(ACERCA_DE)
  })

  it('resuelve desde la URL de una página de pregunta', () => {
    expect(
      resolveDisputeQuestionId({ urlPath: `/pregunta/${ACERCA_DE}`, contextQuestionId: null }),
    ).toBe(ACERCA_DE)
  })

  it('resuelve desde el QuestionContext vivo cuando no hay prop ni URL', () => {
    expect(
      resolveDisputeQuestionId({ urlPath: '/auxiliar-administrativo-madrid/test', contextQuestionId: ACERCA_DE }),
    ).toBe(ACERCA_DE)
  })

  it('prioridad prop > url > contexto', () => {
    expect(
      resolveDisputeQuestionId({ urlPath: `/pregunta/${WIN_L}`, contextQuestionId: ACERCA_DE }),
    ).toBe(WIN_L) // URL gana al contexto
  })

  it('devuelve null si no hay ninguna fuente (caso /soporte sin test montado)', () => {
    expect(resolveDisputeQuestionId({ urlPath: '/soporte', contextQuestionId: null })).toBeNull()
    expect(resolveDisputeQuestionId({})).toBeNull()
  })

  it('ignora ids con forma inválida (no cuelga de basura)', () => {
    expect(resolveDisputeQuestionId({ propQuestionId: 'no-es-uuid' })).toBeNull()
    expect(resolveDisputeQuestionId({ propQuestionId: '   ' })).toBeNull()
    expect(resolveDisputeQuestionId({ contextQuestionId: '123' })).toBeNull()
  })

  // ── SIMULACIÓN del incidente real del 21/07 ────────────────────────────────
  // En /soporte no hay prop ni URL de pregunta ni contexto vivo (el test se desmontó).
  // El viejo código caía a localStorage.currentQuestionId (Win+L, stale). El resolver NO mira
  // localStorage → no hay forma de que devuelva la pregunta equivocada: devuelve null y el
  // modal guía al botón inline.
  it('SIMULACIÓN caso María José: /soporte sin contexto → null (nunca la stale Win+L)', () => {
    // El estado ambiente (lo que había en localStorage) NO es una entrada de la función:
    // la firma solo admite prop/url/contexto. Aunque existiera, es inalcanzable.
    const resolved = resolveDisputeQuestionId({
      propQuestionId: null,
      urlPath: '/soporte',
      contextQuestionId: null, // el test ya no está montado
    })
    expect(resolved).toBeNull()
    expect(resolved).not.toBe(WIN_L)
  })
})
