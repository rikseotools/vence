/**
 * Tests para el feedback de ritmo del simulacro y el pill flotante.
 *
 * Feature (16/05/2026): computeTimePace + pill flotante minimizable
 * en OfficialExamLayout (condicional a config.testType === 'simulacro'
 * con durationMinutes > 0).
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

// ============================================
// HELPER: computeTimePace
// ============================================
describe('computeTimePace — helper de feedback de ritmo', () => {
  const src = read('components/OfficialExamLayout.tsx')

  it('helper exportable a nivel de módulo (function declaration)', () => {
    expect(src).toContain('function computeTimePace(')
  })

  it('retorna PaceFeedback (interface con status, emoji, message, etc.)', () => {
    expect(src).toContain('interface PaceFeedback')
    expect(src).toContain("status: PaceStatus")
    expect(src).toContain('emoji: string')
    expect(src).toContain('message: string')
  })

  it('mapea los 6 estados (ahead/onTime/tight/late/critical/idle)', () => {
    expect(src).toMatch(/PACE_FEEDBACK[\s\S]{0,2000}ahead[\s\S]{0,2000}onTime[\s\S]{0,2000}tight[\s\S]{0,2000}late[\s\S]{0,2000}critical[\s\S]{0,2000}idle/)
  })

  it('idle cuando elapsedSeconds < 60 (sin datos suficientes)', () => {
    expect(src).toMatch(/elapsedSeconds\s*<\s*60[\s\S]{0,150}PACE_FEEDBACK\.idle/)
  })

  it('critical cuando remaining <= 60 (último minuto, antes que cualquier otro check)', () => {
    expect(src).toMatch(/remaining\s*<=\s*60[\s\S]{0,150}PACE_FEEDBACK\.critical/)
  })

  it('usa delta = actualProgress - expectedProgress', () => {
    expect(src).toContain('actualProgress - expectedProgress')
  })

  it('thresholds: ahead >= +10%, onTime >= -5%, tight >= -15%, else late', () => {
    expect(src).toMatch(/delta\s*>=\s*0\.10[\s\S]{0,80}PACE_FEEDBACK\.ahead/)
    expect(src).toMatch(/delta\s*>=\s*-0\.05[\s\S]{0,80}PACE_FEEDBACK\.onTime/)
    expect(src).toMatch(/delta\s*>=\s*-0\.15[\s\S]{0,80}PACE_FEEDBACK\.tight/)
    expect(src).toMatch(/PACE_FEEDBACK\.late/)
  })

  it('colores Tailwind estáticos (no construidos dinámicamente — evita purge bug)', () => {
    // Cada estado tiene clases concretas: bg-emerald-50, bg-blue-50, bg-amber-50, bg-red-50
    expect(src).toContain('bg-emerald-50')
    expect(src).toContain('bg-blue-50')
    expect(src).toContain('bg-amber-50')
    expect(src).toContain('bg-red-50')
    expect(src).toContain('bg-red-100') // critical
  })
})

// ============================================
// PILL FLOTANTE
// ============================================
describe('Pill flotante — 3 estados controlables', () => {
  const src = read('components/OfficialExamLayout.tsx')

  it('define TimerDisplay como "expanded" | "minimized" | "hidden"', () => {
    expect(src).toContain("type TimerDisplay = 'expanded' | 'minimized' | 'hidden'")
  })

  it('persiste preferencia en localStorage con key "simulacro-timer-display"', () => {
    expect(src).toContain("'simulacro-timer-display'")
    expect(src).toContain("localStorage.setItem('simulacro-timer-display'")
    expect(src).toContain("localStorage.getItem('simulacro-timer-display')")
  })

  it('pill solo se renderiza si isCountdown && !isSubmitted && !headerTimerVisible', () => {
    expect(src).toContain('isCountdown && !isSubmitted && !headerTimerVisible')
  })

  it('estado HIDDEN: icono fantasma con opacidad reducida', () => {
    expect(src).toMatch(/timerDisplay === 'hidden'[\s\S]{0,600}aria-label="Mostrar cronómetro"/)
  })

  it('estado MINIMIZED: círculo con color del ritmo', () => {
    expect(src).toMatch(/timerDisplay === 'minimized'[\s\S]{0,800}aria-label/)
  })

  it('estado EXPANDED: pill completo con tiempo + mensaje + botones', () => {
    expect(src).toMatch(/role="status"[\s\S]{0,200}aria-live="polite"/)
    expect(src).toContain('aria-label="Minimizar cronómetro"')
    expect(src).toContain('aria-label="Ocultar cronómetro"')
  })

  it('botones minimizar/ocultar NO se muestran en critical (evita accidente <1min)', () => {
    expect(src).toMatch(/!isCritical[\s\S]{0,800}aria-label="Minimizar/)
  })
})

// ============================================
// FAILSAFE
// ============================================
describe('Failsafe <5 minutos — auto-expand', () => {
  const src = read('components/OfficialExamLayout.tsx')

  it('useEffect que dispara cuando remainingSeconds <= 300 y > 0', () => {
    expect(src).toMatch(/remainingSeconds\s*>\s*300[\s\S]{0,200}timerDisplay === 'expanded'/)
  })

  it('usa ref failsafeTriggeredRef para no disparar dos veces', () => {
    expect(src).toContain('failsafeTriggeredRef')
  })

  it('fuerza setTimerDisplay("expanded") (no respeta preferencia en este caso)', () => {
    expect(src).toMatch(/failsafeTriggeredRef\.current = true[\s\S]{0,200}setTimerDisplay\('expanded'\)/)
  })
})

// ============================================
// INTERSECTION OBSERVER
// ============================================
describe('IntersectionObserver — visibilidad header cronómetro', () => {
  const src = read('components/OfficialExamLayout.tsx')

  it('crea IntersectionObserver sobre headerTimerRef', () => {
    expect(src).toContain('new IntersectionObserver')
    expect(src).toContain('headerTimerRef')
  })

  it('actualiza headerTimerVisible con entry.isIntersecting', () => {
    expect(src).toMatch(/setHeaderTimerVisible\(entry\.isIntersecting\)/)
  })

  it('threshold 0.1 (sensible — basta con 10% visible)', () => {
    expect(src).toContain('threshold: 0.1')
  })

  it('solo se ejecuta cuando isCountdown=true (no afecta exámenes oficiales)', () => {
    expect(src).toMatch(/IntersectionObserver[\s\S]{0,500}\[isCountdown\]/)
  })
})

// ============================================
// COMPATIBILIDAD CON EXAMEN OFICIAL
// ============================================
describe('Examen oficial NO afectado — solo simulacro tiene pacing', () => {
  const src = read('components/OfficialExamLayout.tsx')

  it('header timer: rama legacy cuando !isCountdown (purple, sin pacing)', () => {
    // El bloque del header timer tiene `if (!isCountdown) { return (<div ... bg-purple-50 ...`
    // antes de la rama de simulacro con pace.
    expect(src).toMatch(/if \(!isCountdown\) \{[\s\S]{0,800}bg-purple-50[\s\S]{0,400}formatElapsedTime/)
  })

  it('pill flotante NO se monta cuando !isCountdown (sin durationMinutes)', () => {
    // El condicional padre es `isCountdown && !isSubmitted && !headerTimerVisible`
    // → si isCountdown=false, el pill nunca aparece para examen oficial
    expect(src).toContain('isCountdown && !isSubmitted && !headerTimerVisible')
  })
})

// ============================================
// RESPONSIVE
// ============================================
describe('Responsive móvil + desktop', () => {
  const src = read('components/OfficialExamLayout.tsx')

  it('posición usa bottom-4 right-4 con breakpoint sm:', () => {
    expect(src).toMatch(/bottom-4 right-4[\s\S]{0,40}sm:bottom-6 sm:right-6/)
  })

  it('z-index 40 (debajo de modales típicos z-50)', () => {
    expect(src).toMatch(/fixed[\s\S]{0,80}z-40/)
  })

  it('touch targets accesibles en móvil (estado minimized 44px en mobile)', () => {
    // Estado minimized: w-11 h-11 (44px) en mobile, w-10 h-10 (40px) en sm+
    expect(src).toContain('w-11 h-11 sm:w-10 sm:h-10')
  })
})
