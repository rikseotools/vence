import { readFileSync } from 'fs'
import { join } from 'path'

// GUARDRAIL (20/06): el banner global "Inscripción abierta" era CIEGO (no medía nada) y
// MARTILLEABA (al cerrar mostraba la siguiente al instante). Este test falla si se
// revierte cualquiera de los dos arreglos:
//   - Observabilidad: debe emitir view/click/dismiss por convocatoria.
//   - Cooldown: la ✕ debe silenciar un rato (isBannerSnoozed), no rotar al instante.
//   - El endpoint debe exponer lastDismissedAt (ancla del cooldown account-level).

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('GUARDRAIL: banner inscripción — observable + cooldown anti-martilleo', () => {
  const banner = read('components/OpenInscriptionBanner.tsx')

  it('emite los 3 eventos de observabilidad por convocatoria', () => {
    expect(banner).toMatch(/banner_inscription_viewed/)
    expect(banner).toMatch(/banner_inscription_clicked/)
    expect(banner).toMatch(/banner_inscription_dismissed/)
    // siempre con el slug (qué convocatoria)
    expect(banner).toMatch(/metadata:\s*\{\s*slug/)
  })

  it('aplica cooldown (no muestra la siguiente al instante tras cerrar)', () => {
    expect(banner).toMatch(/isBannerSnoozed/)
  })

  it('los 3 eventType están declarados en el tipo ClientEventType', () => {
    const client = read('lib/observability/client.ts')
    expect(client).toMatch(/'banner_inscription_viewed'/)
    expect(client).toMatch(/'banner_inscription_clicked'/)
    expect(client).toMatch(/'banner_inscription_dismissed'/)
  })

  it('el endpoint expone lastDismissedAt (ancla del cooldown cross-device)', () => {
    const route = read('app/api/v2/banner/open-inscriptions/route.ts')
    expect(route).toMatch(/lastDismissedAt/)
    expect(route).toMatch(/dismissed_at/)
  })
})
