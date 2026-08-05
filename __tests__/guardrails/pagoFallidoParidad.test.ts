/**
 * T-594 — el criterio de «aviso de pago fallido a quien SÍ pagó» vive en DOS sitios:
 *
 *   · la regla de alerta del backend (`alert-rules.ts` → RULE_PAGO_FALLIDO_FALSA_ALARMA), que avisa
 *   · el medidor del frontend (`scripts/stripe/medir-pago-fallido-falsos.cjs`), que dice A QUIÉN
 *
 * Están espejados a propósito (mismo patrón que `benignSignals`: el backend no puede importar del
 * frontend). El riesgo es el de siempre con un espejo: que uno se toque y el otro no, y entonces la
 * alerta diga «cero» mientras el medidor encuentra casos — que es exactamente el modo de fallo que
 * T-594 vino a cerrar. Esto lo impide.
 *
 * Se comparan las TRES condiciones que definen el corte, no el SQL entero (el formato difiere).
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = join(__dirname, '..', '..')
const regla = readFileSync(join(raiz, 'backend/src/alerts/alert-rules.ts'), 'utf8')
const medidor = readFileSync(join(raiz, 'scripts/stripe/medir-pago-fallido-falsos.cjs'), 'utf8')

/** El bloque de la regla, para no medir contra otras reglas del mismo fichero. */
const bloqueRegla = (() => {
  const i = regla.indexOf('RULE_PAGO_FALLIDO_FALSA_ALARMA: AlertRule')
  expect(i).toBeGreaterThan(-1)
  return regla.slice(i, i + 2500)
})()

describe('paridad del criterio de falsa alarma de pago (T-594)', () => {
  it('los dos miran el mismo tipo de correo', () => {
    for (const texto of [bloqueRegla, medidor]) {
      expect(texto).toMatch(/email_type\s*=\s*'pago_fallido'/)
      expect(texto).toMatch(/event_type\s*=\s*'sent'/)
    }
  })

  it('los dos exigen que la suscripción esté ACTIVA (si no, el fallo era real)', () => {
    for (const texto of [bloqueRegla, medidor]) {
      expect(texto).toMatch(/status\s*=\s*'active'/i)
    }
  })

  it('los dos usan la MISMA ventana de 600 s alrededor del alta del periodo', () => {
    // La ventana es lo que decide si el correo cayó «en mitad de la compra». Si divergen, uno de
    // los dos estará contando otra cosa mientras dice contar lo mismo.
    const ventanaRegla = bloqueRegla.match(/current_period_start - e\.created_at\)\)\)\s*<\s*(\d+)/i)
    const ventanaMedidor = medidor.match(/VENTANA_S\s*=\s*(\d+)/)
    expect(ventanaRegla?.[1]).toBe('600')
    expect(ventanaMedidor?.[1]).toBe('600')
  })

  it('el medidor sigue existiendo y el aviso lo nombra (quien recibe la alerta no debe buscarlo)', () => {
    expect(bloqueRegla).toContain('stripe:pago-fallido-falsos')
  })
})
