// lib/convocatoria/notasSinVigilancia.cjs — lógica PURA del detector de oposiciones cuyo
// sensor de notas (`detect-notas-convocatoria`) parece vigilar y no vigila. Sin BD, sin red.
//
// ## El hueco que esto cierra (T-311, 06/08/2026)
//
// La ficha original solo pedía "corpus > 0 y notas = 0" como consulta de una vez. Medido contra
// RDS: esa consulta encuentra 14 oposiciones, pero se le escapan las que el sensor SÍ llegó a
// vigilar alguna vez y luego se quedó mudo — ahí `notas` no es 0, es una fila STALE que nadie
// vuelve a tocar. Caso real: `celador-sermas-madrid`/`tcae-sermas-madrid`/`auxiliar-administrativo-
// sermas` tenían 1 nota cada una con `last_seen` del 26/07 — 11+ días congelada — y la consulta de
// "notas=0" las daba por sanas. Con las dos condiciones juntas la lista sube de 14 a **21**.
//
// ## Por qué el umbral es 4 días, no un número inventado
//
// Medido sobre las 111 oposiciones activas con al menos una nota (06/08/2026): **103 (93%) con
// menos de 2 días desde su último `last_seen`**, 1 en la banda 2-4 días, y **7 agrupadas en la cola
// de 7 a 21.6 días** — sin ningún caso intermedio. El cron corre a diario, así que un sensor sano
// se ve en ~1 día; 4 días da margen para un fallo puntual (red, mantenimiento del boletín) sin
// tragarse el caso real.
//
// ## Causa raíz DEMOSTRADA para una parte de estos 21 (no para todos)
//
// Para las oposiciones de `comunidad.madrid` (www. y sede.) se REPRODUJO: la MISMA URL, con TODO
// igual salvo la cabecera User-Agent, da 404 con la UA propia del sensor y 200 con una UA de
// navegador — un WAF bloquea UAs autodeclaradas-bot que no reconoce. Arreglado en
// `oep-signals-llm.service.ts` (reintento con UA de navegador tras el primer fallo). Para el
// RESTO de las 21 (Extremadura, Rioja, Ávila, Sevilla, Huelva, Salamanca, Marbella, cultura.gob.es,
// Dival, Zaragoza, Córdoba, Barcelona…) NO se ha demostrado la misma causa — algunas responden 200
// con las dos UAs, así que el fallo está en otro punto de la tubería (extracción de enlaces,
// `fetchPdfText`, o el propio documento). Este detector los hace VISIBLES; no los diagnostica.
//
// JS plano (no .ts) a propósito, mismo patrón que `seguimientoUrlSalud.cjs`: lo requiere
// `scripts/health-sweep.cjs` con `node` pelado. El backend NestJS lleva un mirror INLINE
// (`content-health-sweep.service.ts`, "MANTENER EN SYNC") — mismo patrón que ese hermano.

/** Días desde el último `last_seen` a partir de los cuales una nota se considera CONGELADA. */
const UMBRAL_DIAS_STALE = 4

/**
 * Clasifica una oposición según si su sensor de notas parece vigilarla de verdad.
 * @param {object} row
 * @param {number} row.docsCorpus       documentos ya clonados en `convocatoria_documentos`
 * @param {number} row.notasCount       filas en `convocatoria_notas` para esta oposición
 * @param {number|null} row.diasSinVer  días desde el `last_seen` más reciente (null = nunca hubo)
 * @returns {{ severidad: 'ok'|'error', motivo: string|null }}
 */
function clasificarNotasVigilancia({ docsCorpus, notasCount, diasSinVer }) {
  if (docsCorpus <= 0) {
    // Sin documentos en el hub no hay nada que el sensor pudiera haber leído — el hueco (si lo
    // hay) es de OTRO detector (`convocatoria_docs_incompletos`), no de este.
    return { severidad: 'ok', motivo: null }
  }
  if (notasCount === 0) {
    return {
      severidad: 'error',
      motivo: `${docsCorpus} documento(s) en el corpus y 0 notas — el sensor nunca ha dejado nada aquí`,
    }
  }
  if (diasSinVer !== null && diasSinVer >= UMBRAL_DIAS_STALE) {
    return {
      severidad: 'error',
      motivo: `la última nota vista hace ${Math.round(diasSinVer)} días (cron diario) — el sensor lo vigiló alguna vez y dejó de hacerlo`,
    }
  }
  return { severidad: 'ok', motivo: null }
}

module.exports = { clasificarNotasVigilancia, UMBRAL_DIAS_STALE }
