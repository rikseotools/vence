// lib/convocatoria/seguimientoUrlSalud.cjs — lógica PURA del detector de `seguimiento_url`
// que vigilan el ciclo equivocado. Sin BD, sin red.
//
// ## El fallo que motiva esto (20/07/2026)
//
// El drenaje de timelines encontró 5 oposiciones cuya `seguimiento_url` apuntaba a una
// convocatoria de OTRO año, ya cerrada. El monitor las vigilaba fielmente... y vigilaba lo que
// no era. No daba error (la página responde 200), no salía en ningún panel en rojo: parecía
// que había seguimiento y no lo había. Es el peor tipo de fallo — un falso NEGATIVO permanente
// y silencioso: el día que salga la convocatoria nueva, nadie se entera.
//
// ## Por qué es graduado, no booleano
//
// No hay una señal determinista única que los cace sin ruido (medido sobre las 118 activas):
//   · URL a documento de boletín de año viejo → precisión ~100%, cobertura baja.
//   · Año viejo en el path                    → RUIDOSA: "ope-2023-2024-2025" es un nombre
//                                                legítimo de OPE plurianual, no un desfase.
//   · URL genérica de índice                  → RUIDOSA: para una diputación pequeña, el
//                                                índice de empleo público puede ser lo único.
//
// Marcar todo lo que dispara CUALQUIER señal reproduce el error de `hash_change`: una bandeja
// ruidosa se aprende a ignorar. Por eso cada señal se clasifica por su confianza real: solo la
// limpia es accionable (`error`); las ruidosas son cola de revisión (`warn`). La corrección
// nunca es automática — elegir la URL buena exige leer la fuente oficial y razonar. Gotcha del
// `hash=NULL` al repuntar: `docs/maintenance/oeps-convocatorias-seguimiento.md`.
//
// JS plano (no .ts) a propósito: `scripts/health-sweep.cjs` lo requiere con `node` pelado y el
// wrapper `seguimientoUrlSalud.ts` lo reexporta → una sola fuente de verdad (misma lección que
// lib/backlog/pushGuard.cjs).

// Referencia a un DOCUMENTO de boletín (inmutable) con su año: BOE-A-2024-…, BOCYL-D-2025-…
// Un boletín publicado no se actualiza jamás; si su año < convocatoria vigente, ese seguimiento
// está muerto por definición. Señal LIMPIA.
const REF_DOC_BOLETIN =
  /\b(?:BOE|BOCYL|BOJA|DOGV|DOCV|DOG|BOPV|BORM|BOA|BOPA|BOCM|BOIB|BON|DOE|BOR|BOC)[-_ ]?[A-Z]?[-_ ]?(20\d\d)\b/i

const ANIO_SUELTO = /\b(20\d\d)\b/g

// PÁGINA ÍNDICE del portal de empleo, sin apuntar a una convocatoria concreta. Señal débil.
const URL_GENERICA =
  /\/(?:empleo-?p[uú]blico|emprego|oferta-?de-?empleo(?:-p[uú]blico)?(?:-\d{4}(?:-\d{4})?)?|procesos-?selectivos|convocatorias|recursos-?humanos|tabl[oó]n(?:-oficial)?)\/?$/i

/**
 * Diagnostica una `seguimiento_url` contra el año de la convocatoria vigente.
 * @param {string|null|undefined} url          la `oposiciones.seguimiento_url`
 * @param {number|null|undefined} anioVigente  el `convocatorias.año` de la fila is_current
 * @param {{procesoEnJuego?:boolean}} [opts]   `procesoEnJuego`=oposición activa con convocatoria
 *   VIVA (la vendemos y hay proceso en marcha) → una URL genérica pasa de warn a error (ceguera).
 * @returns {{nivel:string, severidad:'error'|'warn'|'ok', motivo:string}}
 */
function diagnosticarSeguimientoUrl(url, anioVigente, opts) {
  if (!url) return { nivel: 'ok', severidad: 'ok', motivo: 'sin seguimiento_url' }
  const vig =
    typeof anioVigente === 'number' && Number.isFinite(anioVigente) ? anioVigente : null

  // 1) Señal LIMPIA: documento de boletín inmutable de un año anterior al vigente.
  const doc = url.match(REF_DOC_BOLETIN)
  if (doc && vig && Number(doc[1]) < vig) {
    return {
      nivel: 'stale_boletin',
      severidad: 'error',
      motivo: `apunta al documento de boletín ${doc[0]} (${doc[1]}), anterior a la convocatoria vigente (${vig}); un boletín es inmutable y nunca reflejará la nueva`,
    }
  }

  // 2) Señal MEDIA (ruidosa → warn): años en el path, todos < vigente y sin el vigente.
  const anios = [...String(url).matchAll(ANIO_SUELTO)].map((m) => Number(m[1]))
  if (vig && anios.length > 0 && !anios.includes(vig) && Math.max(...anios) < vig) {
    return {
      nivel: 'posible_ciclo_viejo',
      severidad: 'warn',
      motivo: `la URL menciona ${[...new Set(anios)].join(', ')} pero no ${vig} (convocatoria vigente); revisar si sigue el ciclo correcto`,
    }
  }

  // 3) Página índice genérica, sin convocatoria concreta. Normalmente warn (para una diputación
  //    pequeña el índice puede ser lo único que hay). PERO si el proceso está VIVO en una
  //    oposición que vendemos (procesoEnJuego), un índice genérico nos deja CIEGOS a su
  //    convocatoria —y a si hay VARIAS de la misma OEP (caso Murcia)— → error accionable que
  //    reaparece en cada sweep hasta apuntar la URL a la ficha concreta. Así una señal correcta
  //    no se puede descartar como si fuera ruido de hash_change.
  if (URL_GENERICA.test(url)) {
    const enJuego = !!(opts && opts.procesoEnJuego)
    return {
      nivel: 'url_generica',
      severidad: enJuego ? 'error' : 'warn',
      motivo: enJuego
        ? 'la URL es una página índice del portal de empleo, no la ficha de la convocatoria; con el proceso VIVO esto nos deja CIEGOS a sus cambios y a si hay varias convocatorias de la misma OEP — apúntala a la convocatoria concreta'
        : 'la URL es una página índice del portal de empleo, no una convocatoria concreta; un cambio ahí rara vez significa algo de esta oposición',
    }
  }

  return { nivel: 'ok', severidad: 'ok', motivo: 'sin señales de desfase' }
}

module.exports = { diagnosticarSeguimientoUrl }
