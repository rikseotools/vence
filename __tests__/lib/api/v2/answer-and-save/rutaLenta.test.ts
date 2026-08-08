/**
 * @jest-environment node
 */
// Unitarios de la decisión PURA que dice si una petición de answer-and-save merece el desglose
// de RUTA (auth + antifraude + guardado completo) y qué fase se llevó el tiempo (T-312, 06/08).
//
// El caso de origen: `answer_save_lento` (el desglose interno de `validateAndSaveAnswer`, ya
// desplegado desde el 30/07) lleva CERO disparos en 7 días de producción mientras
// `request_completed` sigue viendo el mismo ~1,3% de peticiones >2s de siempre — la prueba de que
// el tiempo se va ANTES de que el reloj interno arranque (auth/antifraude), no dentro de él. Este
// módulo mide desde más arriba para poder verlo.

import { construirEventoRutaLenta } from '@/lib/api/v2/answer-and-save/rutaLenta'

describe('construirEventoRutaLenta — cuándo merece el desglose de ruta', () => {
  it('una petición rápida no genera evento', () => {
    const evento = construirEventoRutaLenta(
      { authMs: 3, antifraudeMs: 120, guardarTotalMs: 80, totalMs: 210 },
      {},
    )
    expect(evento).toBeNull()
  })

  it('caso real sospechado: antifraude domina y SÍ genera evento', () => {
    // Réplica del comentario del propio código: "las 3 RPCs antifraude paralelas pueden tardar
    // 10-20s bajo carga BD" — esto es justo lo que el desglose interno (validar/guardar/score)
    // no puede ver porque arranca su reloj después de que esto ya haya terminado.
    const evento = construirEventoRutaLenta(
      { authMs: 4, antifraudeMs: 18_500, guardarTotalMs: 210, totalMs: 18_714 },
      { questionId: 'q-1', instanceId: 'inst-1' },
    )
    expect(evento).not.toBeNull()
    expect(evento?.eventType).toBe('answer_save_ruta_lenta')
    expect(evento?.metadata?.dominante).toBe('antifraude')
    expect(evento?.durationMs).toBe(18_714)
  })

  it('cuando domina el guardado, señala guardarTotal (y el desglose interno explica el resto)', () => {
    const evento = construirEventoRutaLenta(
      { authMs: 3, antifraudeMs: 100, guardarTotalMs: 9_000, totalMs: 9_103 },
      {},
    )
    expect(evento?.metadata?.dominante).toBe('guardarTotal')
  })

  it('fuera_de_fases cuando el tiempo no cae en ninguna fase medida (event-loop, GC, entorno)', () => {
    const evento = construirEventoRutaLenta(
      { authMs: 10, antifraudeMs: 20, guardarTotalMs: 30, totalMs: 5_000 },
      {},
    )
    expect(evento?.metadata?.dominante).toBe('fuera_de_fases')
    expect(evento?.metadata?.noExplicadoMs).toBe(4_940)
  })

  it('justo en el umbral (2000ms) ya genera evento', () => {
    const evento = construirEventoRutaLenta(
      { authMs: 1, antifraudeMs: 1, guardarTotalMs: 1, totalMs: 2_000 },
      {},
    )
    expect(evento).not.toBeNull()
  })

  it('lleva questionId/instanceId cuando se pasan, null cuando no', () => {
    const conCtx = construirEventoRutaLenta(
      { authMs: 0, antifraudeMs: 0, guardarTotalMs: 3_000, totalMs: 3_000 },
      { questionId: 'abc', instanceId: 'inst-x' },
    )
    expect(conCtx?.metadata?.questionId).toBe('abc')
    expect(conCtx?.metadata?.instanceId).toBe('inst-x')

    const sinCtx = construirEventoRutaLenta(
      { authMs: 0, antifraudeMs: 0, guardarTotalMs: 3_000, totalMs: 3_000 },
      {},
    )
    expect(sinCtx?.metadata?.questionId).toBeNull()
    expect(sinCtx?.metadata?.instanceId).toBeNull()
  })

  it('endpoint y source fijos — no dependen de quien llama', () => {
    const evento = construirEventoRutaLenta(
      { authMs: 0, antifraudeMs: 0, guardarTotalMs: 3_000, totalMs: 3_000 },
      {},
    )
    expect(evento?.endpoint).toBe('/api/v2/answer-and-save')
    expect(evento?.source).toBe('vercel')
    expect(evento?.severity).toBe('warn')
  })
})
