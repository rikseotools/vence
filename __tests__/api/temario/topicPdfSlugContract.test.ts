/**
 * @jest-environment node
 */
// Test de CONTRATO botón ↔ ruta del PDF del temario.
//
// El bug (20/07/2026): el botón <TopicPrintButton> deriva el identificador de la oposición del
// `oposicion=` del loginHref, que es el POSITION_TYPE (underscores: `auxiliar_administrativo_estado`),
// y hace fetch a `/api/temario/<eso>/<tema>/pdf`. La ruta indexaba por SLUG (guiones) → 404
// "Oposición no encontrada" en TODAS las oposiciones desde T-039.
//
// Por qué no se cazó antes: el test unitario del botón MOCKEA fetch (devuelve 200 para cualquier
// URL) y encima asserta la URL con underscores como "esperada" → consagró el bug. El 404 real de
// la ruta nunca se ejecutaba en ningún test. Este test cierra ese hueco: invoca el HANDLER REAL
// con el valor que manda el botón (underscores) y exige que PASE el gate de oposición.
//
// Antes del fix (ruta sin normalizar) este test FALLA (da "Oposición no encontrada").
// Con el fix (la ruta normaliza `_`→`-`) PASA (pasa el gate; el 404 que queda es de tema, no de
// oposición, porque mockeamos getTopicContent a null).

// withErrorLogging → passthrough, para invocar el handler crudo.
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))
// El motor de PDF no interviene (getTopicContent devuelve null antes de renderizar), pero hay
// que evitar que su import arrastre @react-pdf en el entorno de test.
jest.mock('@react-pdf/renderer', () => ({ renderToBuffer: jest.fn(), Document: {}, Page: {}, Text: {}, View: {}, StyleSheet: { create: (s: unknown) => s }, Font: { register: jest.fn() } }), { virtual: true })
jest.mock('@/lib/temario/pdf/TopicPdfDocument', () => ({ TopicPdfDocument: () => null }))
jest.mock('@/lib/premium/isPremiumPlan', () => ({ isPremiumPlan: () => true }))

const mockGetTopicContent = jest.fn()
jest.mock('@/lib/api/temario/queries', () => ({
  getTopicContent: (...a: unknown[]) => mockGetTopicContent(...a),
}))

import { GET } from '@/app/api/temario/[oposicion]/[topic]/pdf/route'

function call(oposicion: string, topic = '1') {
  const req = {} as never
  const ctx = { params: Promise.resolve({ oposicion, topic }) }
  return GET(req, ctx as never) as Promise<Response>
}

describe('Contrato PDF temario — el valor que manda el botón (position_type) resuelve en la ruta', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTopicContent.mockResolvedValue(null) // pasa el gate de oposición → 404 de TEMA, no de oposición
  })

  it('con POSITION_TYPE (underscores) — lo que envía el botón — NO da "Oposición no encontrada"', async () => {
    const res = await call('auxiliar_administrativo_estado', '1')
    const body = await res.json().catch(() => ({}))
    // La clave: NO puede ser el 404 del gate de oposición. Que pase el gate es lo que el bug rompía.
    expect(body.error).not.toBe('Oposición no encontrada')
    // Y debe haber llegado a resolver el contenido del tema con la oposición ya normalizada.
    expect(mockGetTopicContent).toHaveBeenCalled()
  })

  it('con SLUG (guiones) también resuelve (idempotente)', async () => {
    const res = await call('auxiliar-administrativo-estado', '1')
    const body = await res.json().catch(() => ({}))
    expect(body.error).not.toBe('Oposición no encontrada')
    expect(mockGetTopicContent).toHaveBeenCalled()
  })

  it('control negativo: una oposición inexistente SÍ da "Oposición no encontrada" (404)', async () => {
    const res = await call('no_existe_esta_oposicion_xyz', '1')
    const body = await res.json().catch(() => ({}))
    expect(res.status).toBe(404)
    expect(body.error).toBe('Oposición no encontrada')
    expect(mockGetTopicContent).not.toHaveBeenCalled()
  })
})
