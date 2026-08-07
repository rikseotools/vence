// lib/temario/pdf/canaryNoRender.cjs — el criterio del canario "la ruta pública ya no renderiza" (T-159/T-270 Fase 2)
'use strict'
//
// ── QUÉ VIGILA, Y POR QUÉ EN DOS PARTES ──────────────────────────────────────────────────────
// El 29/07/2026 la ruta pública `/api/temario/[oposicion]/[topic]/pdf` renderizaba EN LÍNEA con
// @react-pdf/renderer + pdf-lib cuando el PDF no estaba en caché, y eso bloqueó el event-loop del
// contenedor que sirve tráfico 215 s, tumbando `answer-and-save` para TODOS los usuarios durante
// 18 minutos (ver `docs/ARCHITECTURE_ROADMAP.md` → «Incidente 2026-07-29»). El 06/08/2026 se
// decidió (Manuel) y desplegó la Fase 2: la ruta ya NO renderiza nada — sirve de caché S3 o
// encola el tema para `vence-temario-pdf-worker` (proceso aparte, fuera del ALB) y responde 503.
//
// Dos averías DISTINTAS que un mismo canario puede vigilar para siempre, sin credenciales de
// usuario premium (que un trabajador de la flota nunca tiene): un miss real solo se puede
// provocar con una sesión premium real, así que este canario no la simula — LEE lo que el
// tráfico real ya deja en `observable_events`/`temario_pdf_jobs`.
//
//   (1) REGRESIÓN — ¿volvió a renderizar? El código viejo emitía `served:'generated'` cada vez
//       que renderizaba en línea; el código nuevo NO PUEDE emitir ese valor (solo tiene
//       's3'|'encolado'|'too_large', ver `route.ts`). Un solo evento con `served='generated'`
//       después de la Fase 2 significa que el código viejo volvió a estar en producción — por
//       rollback, por un fork de la ruta, por lo que sea. Esto SÍ es un fallo binario: 0 tolerado.
//
//   (2) CICLO DE AUTOCURACIÓN — cuando SÍ hay un miss real (`served='encolado'`), ¿el worker lo
//       recoge y lo completa? Se cruza contra `temario_pdf_jobs` por `content_hash`. Cero misses
//       en la ventana NO es un fallo (igual que `canary-served-rollup.cjs`: puede que sencillamente
//       no haya habido tráfico que provoque un miss) — es "sin evidencia todavía", no "verde".

/** Único valor que el código de la ruta pública, tras la Fase 2, YA NO PUEDE producir. */
const SERVED_REGRESION = 'generated'

/**
 * ¿Hay evidencia de que la ruta volvió a renderizar en línea?
 * @param {Array<{served?: string}>} eventosServed  filas de `temario_pdf_served` en la ventana
 * @returns {Array} los eventos que SÍ son evidencia de regresión (vacío = ninguna)
 */
function detectaRegresion(eventosServed) {
  return (eventosServed || []).filter((e) => e && e.served === SERVED_REGRESION)
}

/**
 * Cruza cada "miss" real (`served='encolado'`) contra el estado de su job en `temario_pdf_jobs`,
 * y clasifica si el ciclo de autocuración (miss → encola → worker → done) se completó, sigue en
 * curso dentro de lo esperable, o se atascó/falló.
 *
 * @param {Array<{hash: string, ts: string|Date}>} encolados   misses reales de la ventana
 * @param {Array<{content_hash: string, status: string, last_error?: string|null}>} jobs
 * @param {number} cadenciaMinutos  cada cuánto corre el worker (default 30, la cadencia real)
 * @param {Date} ahora
 * @returns {Array<{hash:string, ts:string|Date, estado:string, detalle?:string}>}
 */
function clasificaCicloAutocuracion(encolados, jobs, cadenciaMinutos, ahora) {
  const porHash = new Map((jobs || []).filter((j) => j && j.content_hash).map((j) => [j.content_hash, j]))
  return (encolados || []).map((e) => {
    const job = porHash.get(e.hash)
    if (!job) {
      return { ...e, estado: 'sin_job', detalle: 'encolado en temario_pdf_served pero sin fila en temario_pdf_jobs' }
    }
    if (job.status === 'error') {
      return { ...e, estado: 'error', detalle: job.last_error || 'sin detalle de error' }
    }
    if (job.status === 'done') {
      return { ...e, estado: 'completado' }
    }
    const minutosDesde = (new Date(ahora).getTime() - new Date(e.ts).getTime()) / 60000
    // Dos vueltas de cadencia de margen antes de llamarlo "atascado": el worker no despierta al
    // instante, y una sola vuelta perdida (deploy en marcha, etc.) no debería gritar todavía.
    if (minutosDesde > cadenciaMinutos * 2) {
      return { ...e, estado: 'atascado', detalle: `${Math.round(minutosDesde)} min sin resolver (cadencia esperada: ${cadenciaMinutos} min)` }
    }
    return { ...e, estado: 'en_curso' }
  })
}

/**
 * Veredicto final del canario a partir de las dos clasificaciones.
 * @returns {{ok: boolean, motivo: string}}
 */
function veredicto(regresiones, ciclo) {
  if (regresiones.length > 0) {
    return { ok: false, motivo: `${regresiones.length} evento(s) served='generated' — la ruta volvió a renderizar en línea` }
  }
  const atascados = ciclo.filter((c) => c.estado === 'atascado' || c.estado === 'error' || c.estado === 'sin_job')
  if (atascados.length > 0) {
    return { ok: false, motivo: `${atascados.length} miss(es) sin completar el ciclo de autocuración` }
  }
  if (ciclo.length === 0) {
    return { ok: true, motivo: 'sin misses en la ventana — no hay nada que decir, no es un fallo (ver canary-served-rollup.cjs)' }
  }
  return { ok: true, motivo: `${ciclo.length} miss(es), todos completados o en curso dentro de plazo` }
}

module.exports = { SERVED_REGRESION, detectaRegresion, clasificaCicloAutocuracion, veredicto }
