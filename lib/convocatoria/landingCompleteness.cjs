'use strict';
//
// landingCompleteness — PURA, sin I/O. ¿Está una landing PUBLICADA en condiciones de
// recibir tráfico (SEO, newsletter, Ads), o está a medio hacer?
//
// INCIDENTE QUE LO MOTIVA (25/07/2026): Auxiliar Administrativo de la Universidad de
// Almería llevaba SEMANAS publicada (is_active) con el hero sin tarjetas, sin FAQs, sin
// descripción y sin SEO propio. Nadie lo vio: `audit:oposicion` lo cantaba, pero es
// on-demand y solo se corre al crear la oposición; el barrido nocturno no miraba esto.
// Salió a la luz porque se iba a mandar una newsletter a 1.334 personas a esa página.
//
// El fallo NO es que falte una herramienta: es que la detección no era AUTOMÁTICA. Este
// núcleo lo consumen a la vez el sweep nocturno (kind `landing_incompleta` → badge de
// /admin/contenido), el audit manual y el gate de CI, para que los tres digan lo mismo.
//
// Diseño: severidad por IMPACTO EN EL OPOSITOR, no por número de campos vacíos.
//   - error → la página se ve rota/vacía al entrar (hero sin tarjetas, cero FAQs).
//   - warn  → la página se ve bien pero pierde SEO o contexto (sin seo_title, sin
//             titulación, sin estructura de examen).
// Así el badge distingue "esto no se puede promocionar" de "esto se puede mejorar".

/** Mínimo de FAQs para considerar la landing servible (SEO FAQPage + dudas básicas). */
const MIN_FAQS = 3;
/** Mínimo de tarjetas del hero. El render cae a 4 genéricas si no hay, pero eso es el síntoma. */
const MIN_TARJETAS = 1;

const esArrayConDatos = (v, min) => Array.isArray(v) && v.length >= min;
const vacio = (v) => v == null || String(v).trim() === '';
const objetoVacio = (v) => v == null || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length === 0;

/**
 * Piezas evaluadas. Añadir una pieza = una fila aquí (y su caso en los tests).
 * `severidad` es la que aporta la pieza si falta.
 */
const PIEZAS = [
  {
    id: 'tarjetas_hero',
    severidad: 'error',
    etiqueta: 'tarjetas del hero (landing_estadisticas)',
    falta: (l) => !esArrayConDatos(l.landingEstadisticas, MIN_TARJETAS),
  },
  {
    id: 'faqs',
    severidad: 'error',
    etiqueta: `FAQs (mínimo ${MIN_FAQS})`,
    falta: (l) => !esArrayConDatos(l.landingFaqs, MIN_FAQS),
  },
  {
    id: 'descripcion',
    severidad: 'warn',
    etiqueta: 'landing_description',
    falta: (l) => vacio(l.landingDescription),
  },
  { id: 'seo_title', severidad: 'warn', etiqueta: 'seo_title', falta: (l) => vacio(l.seoTitle) },
  { id: 'seo_description', severidad: 'warn', etiqueta: 'seo_description', falta: (l) => vacio(l.seoDescription) },
  {
    id: 'titulo_requerido',
    severidad: 'warn',
    etiqueta: 'titulo_requerido',
    falta: (l) => vacio(l.tituloRequerido),
  },
  {
    id: 'examen_config',
    severidad: 'warn',
    etiqueta: 'examen_config',
    falta: (l) => objetoVacio(l.examenConfig),
  },
];

/**
 * Clasifica la completitud de una landing PUBLICADA.
 *
 * @param {{
 *   isActive?: boolean,
 *   landingEstadisticas?: unknown, landingFaqs?: unknown,
 *   landingDescription?: string|null, seoTitle?: string|null, seoDescription?: string|null,
 *   tituloRequerido?: string|null, examenConfig?: unknown
 * }} landing
 * @returns {{nivel:'ok'|'mejorable'|'incompleta', severidad:'error'|'warn'|null, faltan:string[], ids:string[]}}
 *   nivel      ok = nada que reprochar · mejorable = solo warns · incompleta = algún error
 *   severidad  la peor severidad encontrada (null si ok)
 *   faltan     etiquetas legibles de lo que falta, para el mensaje del hallazgo
 *   ids        identificadores estables de las piezas que faltan (para tests y métricas)
 */
function classifyLandingCompleteness(landing) {
  const l = landing || {};
  // Una landing NO publicada puede estar a medias legítimamente (se está construyendo).
  // Solo se juzga lo que el opositor puede ver.
  if (l.isActive === false) return { nivel: 'ok', severidad: null, faltan: [], ids: [] };

  const fallos = PIEZAS.filter((p) => p.falta(l));
  if (fallos.length === 0) return { nivel: 'ok', severidad: null, faltan: [], ids: [] };

  const hayError = fallos.some((f) => f.severidad === 'error');
  return {
    nivel: hayError ? 'incompleta' : 'mejorable',
    severidad: hayError ? 'error' : 'warn',
    faltan: fallos.map((f) => f.etiqueta),
    ids: fallos.map((f) => f.id),
  };
}

module.exports = { classifyLandingCompleteness, PIEZAS, MIN_FAQS, MIN_TARJETAS };
