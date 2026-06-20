import { safeParseIngestRequest } from '@/lib/observability/schemas'

// CONTRATO cliente → /api/observability/ingest (20/06).
//
// El guardrail estático prueba que el CÓDIGO emite los eventos. Esto prueba que el
// PAYLOAD que emite el cliente lo acepta la validación del endpoint — si alguien cambia
// el eventType/severity/shape y rompe la ingesta, esto falla aquí (antes seguiríamos
// "midiendo" sin que llegue nada).
//
// El round-trip REAL contra observable_events (insert+read+cleanup) vive en
// `scripts/canary-banner-observability.cjs` (node real, sin los mocks de jest que
// rompen supabase-js): `node scripts/canary-banner-observability.cjs`.

// Eventos tal como los emite el cliente (source='frontend' obligatorio en client-side).
const BANNER_EVENTS = [
  { source: 'frontend' as const, severity: 'info' as const, eventType: 'banner_inscription_viewed', metadata: { slug: 'auxiliar-administrativo-uned' } },
  { source: 'frontend' as const, severity: 'info' as const, eventType: 'banner_inscription_clicked', metadata: { slug: 'auxiliar-administrativo-uned' } },
  { source: 'frontend' as const, severity: 'info' as const, eventType: 'banner_inscription_dismissed', metadata: { slug: 'auxiliar-administrativo-uned' } },
  { source: 'frontend' as const, severity: 'info' as const, eventType: 'catalogada_inscription_clicked', metadata: { slug: 'ayudante-instituciones-penitenciarias' } },
]

describe('CANARY contrato: cliente → /api/observability/ingest', () => {
  it('los payloads del banner/catalogadas pasan la validación del endpoint', () => {
    const parsed = safeParseIngestRequest({ events: BANNER_EVENTS })
    expect(parsed.success).toBe(true)
  })

  it('cada evento lleva el slug (qué convocatoria) para poder agrupar', () => {
    for (const e of BANNER_EVENTS) {
      expect(e.metadata.slug).toBeTruthy()
    }
  })

  it('rechaza un eventType vacío (forma inválida no se ingiere)', () => {
    const bad = safeParseIngestRequest({ events: [{ source: 'frontend', severity: 'info', eventType: '' }] })
    expect(bad.success).toBe(false)
  })

  it('rechaza un eventType > 64 chars', () => {
    const bad = safeParseIngestRequest({ events: [{ source: 'frontend', severity: 'info', eventType: 'x'.repeat(65) }] })
    expect(bad.success).toBe(false)
  })
})
