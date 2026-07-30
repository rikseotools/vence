/**
 * @jest-environment node
 */
// Contención de renders de PDF EN LA RUTA REAL, con concurrencia (T-270 Fase 1).
//
// ## Por qué este test y no un canario contra producción
//
// El semáforo tiene sus unitarios (`renderSemaphore.test.ts`) y el cableado se puede leer en el
// SHA desplegado. Lo que faltaba era la capa de en medio: que la RUTA, con varias peticiones a la
// vez, serialice y suelte carga de verdad.
//
// Se intentó verificarlo en producción y **la medición del 30/07 lo desaconsejó**: los 8 renders
// frescos medidos cayeron en **8 tareas distintas**. El semáforo es POR TAREA y el balanceador
// reparte, así que un canario de 3 —o de 8— peticiones no lo ejercitaría siquiera; para forzar un
// descarte harían falta ~10 renders en UNA misma tarea, es decir, decenas de peticiones
// simultáneas: justo el incidente que esto previene. Verificarlo allí costaba provocarlo.
//
// Aquí hay una sola "instancia" por definición, así que la concurrencia colisiona siempre y las
// dos conductas quedan fijadas sin tocar producción.

const mockEventos: Array<Record<string, unknown>> = []
let mockRenderMs = 50

jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (e: Record<string, unknown>) => { mockEventos.push(e) },
}))
jest.mock('@/lib/observability/instanceId', () => ({ INSTANCE_ID: 'test-task' }))

// El render real es @react-pdf: JS puro y CPU pura. Aquí solo importa que TARDE, para poder
// observar si dos se solapan o hacen cola.
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: () => new Promise((res) => setTimeout(() => res(Buffer.from('%PDF-1.4 fake')), mockRenderMs)),
}))

import { getRenderSemaphore, maxConcurrentFromEnv, waitMsFromEnv } from '@/lib/temario/pdf/renderSemaphore'
import { renderToBuffer } from '@react-pdf/renderer'

/**
 * Reproduce el bloque de contención de la ruta VERBATIM (`route.ts` §2.bis): adquirir slot →
 * si no hay, emitir `temario_pdf_render_shed` y devolver 503 → si hay, renderizar y soltar.
 *
 * No se importa el handler entero a propósito: arrastra S3, la BD, la autenticación y el modelo
 * del PDF, y montar todo eso mockeado probaría sobre todo mis mocks. Lo que aquí se verifica es
 * la SECUENCIA de contención, que es lo que no tenía cobertura.
 */
async function pedirPdf(): Promise<{ status: number; renderizo: boolean }> {
  const sem = getRenderSemaphore()
  const slot = await sem.acquire(waitMsFromEnv())
  if (!slot) {
    const { emitFireAndForget } = jest.requireMock('@/lib/observability/emit') as {
      emitFireAndForget: (e: Record<string, unknown>) => void
    }
    emitFireAndForget({
      source: 'fargate', severity: 'warn', eventType: 'temario_pdf_render_shed',
      endpoint: '/api/temario/[oposicion]/[topic]/pdf',
      metadata: { enVuelo: sem.inFlight(), techo: sem.max() },
    })
    return { status: 503, renderizo: false }
  }
  try {
    await renderToBuffer({} as never)
    return { status: 200, renderizo: true }
  } finally {
    slot.release()
  }
}

describe('contención de renders de PDF en la ruta', () => {
  beforeEach(() => { mockEventos.length = 0; mockRenderMs = 50; delete process.env.PDF_RENDER_WAIT_MS })

  it('el techo por defecto es 1: dos renders NO van en paralelo', () => {
    expect(maxConcurrentFromEnv({} as NodeJS.ProcessEnv)).toBe(1)
  })

  it('🎯 tres peticiones a la vez SE SERIALIZAN, no se entrelazan', async () => {
    mockRenderMs = 120
    const t0 = Date.now()
    const r = await Promise.all([pedirPdf(), pedirPdf(), pedirPdf()])
    const total = Date.now() - t0

    expect(r.every(x => x.status === 200)).toBe(true)
    // Si se entrelazaran, el total rondaría UN render (~120 ms). Serializados, ronda la SUMA.
    // El margen es generoso a propósito: lo que se fija es el orden de magnitud, no el reloj.
    expect(total).toBeGreaterThanOrEqual(300)
    expect(mockEventos).toHaveLength(0) // nadie descartado: la espera absorbe la ráfaga
  })

  it('🎯 pasada la espera SUELTA CARGA con 503, en vez de tumbar a los demás', async () => {
    // Es lo que NO pasó el 29/07: sin válvula, 36 renders bloquearon el bucle de eventos 215 s y
    // se llevaron por delante el guardado de respuestas de todo el mundo.
    process.env.PDF_RENDER_WAIT_MS = '30'
    mockRenderMs = 400
    const r = await Promise.all([pedirPdf(), pedirPdf(), pedirPdf()])

    expect(r.filter(x => x.status === 200)).toHaveLength(1) // solo el primero entra
    expect(r.filter(x => x.status === 503)).toHaveLength(2) // los otros se sueltan
    expect(mockEventos).toHaveLength(2)
    expect(mockEventos[0].eventType).toBe('temario_pdf_render_shed')
    // El evento dice CUÁNTO había en vuelo y cuál era el techo: sin eso, un 503 no se distingue
    // de una caída.
    expect((mockEventos[0].metadata as Record<string, unknown>).techo).toBe(1)
  })

  it('el slot se devuelve aunque el render REVIENTE (si no, la task queda muerta para siempre)', async () => {
    const sem = getRenderSemaphore()
    const slot = await sem.acquire(waitMsFromEnv())
    expect(slot).not.toBeNull()
    try { throw new Error('render explotó') } catch { /* como en la ruta */ } finally { slot!.release() }
    expect(sem.inFlight()).toBe(0)
    // Y la siguiente petición sigue pasando.
    await expect(pedirPdf()).resolves.toMatchObject({ status: 200 })
  })
})
