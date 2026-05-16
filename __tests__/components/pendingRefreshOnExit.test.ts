/**
 * Tests para el refresco del icono "examen pendiente" del header cuando el
 * usuario abandona un examen a medias.
 *
 * Bug (16/05/2026): si el usuario hacía 2 preguntas y salía sin terminar,
 * el icono amarillo no aparecía en el header hasta recargar la página.
 * Causa: el Header solo escuchaba "exam-completed" (que se dispara al
 * COMPLETAR), nunca al abandonar.
 *
 * Fix:
 *  A) OfficialExamLayout dispara "exam-completed" en cleanup (unmount) y
 *     en visibilitychange→hidden, siempre que haya respuestas guardadas y
 *     el examen NO esté ya submitted.
 *  B) Header se resuscribe también a visibilitychange y focus, con
 *     throttle de 3s para no spamear el endpoint al alternar pestañas.
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

// ============================================
// A) OfficialExamLayout — dispatch al salir a medias
// ============================================
describe('OfficialExamLayout — exam-completed al abandonar', () => {
  const layout = read('components/OfficialExamLayout.tsx')

  it('mantiene refs vivos de userAnswers y isSubmitted', () => {
    expect(layout).toContain('userAnswersRef')
    expect(layout).toContain('isSubmittedRef')
    expect(layout).toMatch(/userAnswersRef\.current\s*=\s*userAnswers/)
    expect(layout).toMatch(/isSubmittedRef\.current\s*=\s*isSubmitted/)
  })

  it('define notifyIfPending: requiere testId + respuestas + NO submitted', () => {
    // Las tres guardas son necesarias para no spamear el evento.
    expect(layout).toMatch(/function notifyIfPending[\s\S]{0,600}isSubmittedRef\.current[\s\S]{0,400}currentTestSessionRef\.current\?\.id[\s\S]{0,400}Object\.keys\(userAnswersRef\.current\)\.length\s*===\s*0/)
  })

  it('despacha exam-completed (no examCompleted en camelCase)', () => {
    // El header escucha ambos pero canonizamos en kebab-case.
    expect(layout).toMatch(/window\.dispatchEvent\(new Event\('exam-completed'\)\)/)
  })

  it('escucha visibilitychange y dispara al pasar a hidden', () => {
    expect(layout).toMatch(/visibilityState\s*===\s*'hidden'[\s\S]{0,80}notifyIfPending\(\)/)
    expect(layout).toMatch(/document\.addEventListener\('visibilitychange'/)
    expect(layout).toMatch(/document\.removeEventListener\('visibilitychange'/)
  })

  it('también dispara en el cleanup del effect (return ()=>)', () => {
    // El cleanup del useEffect dedicado a notifyIfPending debe invocarla
    // para cubrir el caso de unmount (cliente-router navigation).
    expect(layout).toMatch(/return \(\) => \{[\s\S]{0,300}notifyIfPending\(\)/)
  })

  it('el effect de aviso NO depende de userAnswers/isSubmitted (deps [])', () => {
    // Si tuviera deps, se suscribiría/desuscribiría a cada respuesta del
    // usuario. Usamos refs precisamente para evitarlo.
    // El effect debe cerrarse con `}, [])` (deps vacías). Pattern: cualquier
    // forma de cierre con ≥1 llave seguida de `, [])`.
    expect(layout).toMatch(/visibilitychange[\s\S]{0,500}notifyIfPending\(\)[\s\S]{0,40}\}\s*,\s*\[\]\)/)
  })
})

// ============================================
// B) Header — refresh en visibilitychange/focus con throttle
// ============================================
describe('Header — refresh de pendientes en visibilidad', () => {
  const header = read('app/Header.tsx')

  it('loadPendingExams acepta un flag force y aplica throttle de 3s', () => {
    expect(header).toMatch(/loadPendingExams\(force\s*=\s*false\)/)
    expect(header).toMatch(/THROTTLE_MS\s*=\s*3000/)
    expect(header).toMatch(/!force\s*&&\s*now\s*-\s*lastLoadAt\s*<\s*THROTTLE_MS/)
  })

  it('la carga inicial al montar se hace en modo force=true', () => {
    expect(header).toMatch(/!authLoading\s*&&\s*user[\s\S]{0,80}loadPendingExams\(true\)/)
  })

  it('exam-completed/examCompleted también van con force=true (anti-throttle)', () => {
    expect(header).toMatch(/handleExamCompleted[\s\S]{0,200}loadPendingExams\(true\)/)
  })

  it('suscribe visibilitychange y refresca al pasar a visible', () => {
    expect(header).toMatch(/visibilityState\s*===\s*'visible'[\s\S]{0,80}loadPendingExams\(\)/)
    expect(header).toContain("document.addEventListener('visibilitychange'")
    expect(header).toContain("document.removeEventListener('visibilitychange'")
  })

  it('suscribe focus de la ventana y refresca', () => {
    expect(header).toMatch(/handleFocus\s*=\s*\(\)\s*=>\s*loadPendingExams\(\)/)
    expect(header).toContain("window.addEventListener('focus'")
    expect(header).toContain("window.removeEventListener('focus'")
  })

  it('mantiene la suscripción legacy a examCompleted (camelCase de ExamLayout.tsx)', () => {
    expect(header).toContain("window.addEventListener('examCompleted'")
    expect(header).toContain("window.removeEventListener('examCompleted'")
  })
})
