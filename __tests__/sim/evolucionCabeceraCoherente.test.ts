/**
 * El invariante que caza el bug de MariSol (28/07/2026, feedback 108cc2a8): la cabecera del panel
 * de evolución no puede afirmar lo contrario del intento que el usuario acaba de hacer.
 *
 * Los dos casos de fallo son REALES, transcritos de sus capturas y contrastados contra la BD:
 *  · respondió A (acierto, `is_correct=true` en `test_questions`) → «Sigues fallando esta pregunta (0/2)»
 *  · respondió B (fallo,   `is_correct=false`)                    → «¡Progreso! Antes fallaste, ahora acertaste»
 */
import { evolutionHeaderMatchesLastAttempt } from '@/lib/sim/invariants'

describe('la cabecera de evolución no puede contradecir al último intento', () => {
  it('CAZA el caso real: dice que sigue fallando una pregunta que acertó', () => {
    const r = evolutionHeaderMatchesLastAttempt({
      headerText: 'Sigues fallando esta pregunta (0/2)',
      lastAttemptCorrect: true,
    })
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/ACIERTO/)
  })

  it('CAZA el caso real inverso: dice que acertó una pregunta que falló', () => {
    const r = evolutionHeaderMatchesLastAttempt({
      headerText: '¡Progreso! Antes fallaste, ahora acertaste',
      lastAttemptCorrect: false,
    })
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/FALLO/)
  })

  it('deja pasar las cabeceras coherentes', () => {
    expect(evolutionHeaderMatchesLastAttempt({ headerText: 'Siempre aciertas esta pregunta (3/3)', lastAttemptCorrect: true }).ok).toBe(true)
    expect(evolutionHeaderMatchesLastAttempt({ headerText: 'Sigues fallando esta pregunta (1/6)', lastAttemptCorrect: false }).ok).toBe(true)
    expect(evolutionHeaderMatchesLastAttempt({ headerText: '¡Progreso! Antes fallaste, ahora acertaste', lastAttemptCorrect: true }).ok).toBe(true)
  })

  it('no inventa fallos con mensajes que no afirman acierto ni fallo', () => {
    // "Primera vez", blanco, retroceso… no afirman nada sobre el resultado actual en esos términos.
    expect(evolutionHeaderMatchesLastAttempt({ headerText: 'Primera vez que ves esta pregunta', lastAttemptCorrect: false }).ok).toBe(true)
    expect(evolutionHeaderMatchesLastAttempt({ headerText: 'Sigues sin saberla (0/3 aciertos)', lastAttemptCorrect: false }).ok).toBe(true)
    expect(evolutionHeaderMatchesLastAttempt({ headerText: '', lastAttemptCorrect: true }).ok).toBe(true)
  })
})
