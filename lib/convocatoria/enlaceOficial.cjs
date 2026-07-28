// lib/convocatoria/enlaceOficial.cjs — QUÉ enlace oficial enseña de verdad la landing.
// PURO (sin BD, sin red) → testeable en aislamiento y consumible desde TS y desde CJS.
//
// ## Por qué existe (28/07/2026, T-134)
//
// La landing NO enseña siempre `programa_url`. Desde F4/T-108, cuando la vigente es una OEP sin
// convocatoria y esa OEP tiene su documento clonado, el botón enlaza ESE documento y se rotula
// "Ver OEP en {diario}" en vez de "Ver convocatoria en {diario}". Esa regla vivía en UN TERNARIO
// SUELTO dentro de `app/[oposicion]/page.tsx`, así que nadie más la conocía.
//
// Consecuencia medida el 28/07: el detector `convocatoria_enlace_no_boletin` juzgaba
// `programa_url` a pelo y marcaba **5 falsos positivos** — entre ellos `administrativo-andalucia`,
// señalado por el temario del IAAP cuando la landing enseña su BOJA correcto. Estábamos mandando
// a revisar URLs que ningún opositor ve.
//
// Es el mismo modo de fallo que ya arregló el canario (juzgar el HTML servido con el MISMO núcleo
// en vez de con su propia copia): cuando la regla vive en una superficie y no en un núcleo, los
// vigilantes se quedan atrás en cuanto la página evoluciona.
//
// El predicado del estado vive AQUÍ (y `anuncioHero.ts` lo reexporta) para que exista UNA sola
// definición de "esta oposición aún no tiene convocatoria" en todo el sistema.

/** Estados en los que la oposición NO tiene convocatoria publicada (solo oferta, o ni eso). */
const ESTADOS_SIN_CONVOCATORIA = ['sin_oep', 'oep_aprobada'];

/**
 * ¿La oposición está en fase PREVIA a la convocatoria?
 * Lista NEGRA a propósito: un estado nuevo y desconocido se trata como "hay convocatoria"
 * (permisivo), que es como se comportaba el sistema antes de existir este criterio.
 */
function esOepSinConvocatoria(estadoProceso) {
  return ESTADOS_SIN_CONVOCATORIA.includes(estadoProceso ?? 'sin_oep');
}

/**
 * El enlace que la landing enseña REALMENTE en el botón oficial.
 * Réplica exacta de `app/[oposicion]/page.tsx`: OEP sin convocatoria + documento clonado → ese
 * documento; en cualquier otro caso, `programa_url`. Devuelve null si no hay ninguno.
 */
function enlaceOficialEfectivo({ estadoProceso, enlaceOep, programaUrl }) {
  return (esOepSinConvocatoria(estadoProceso) && enlaceOep) ? enlaceOep : (programaUrl ?? null);
}

/**
 * Lo que el botón dice literalmente. Importa para juzgar el enlace: "Ver OEP en BOJA" NO promete
 * la convocatoria, así que enlazar el decreto de la OEP es correcto y no debe marcarse.
 */
function rotuloEnlaceOficial({ estadoProceso, diarioOficial }) {
  const diario = diarioOficial || 'BOE';
  return esOepSinConvocatoria(estadoProceso) ? `Ver OEP en ${diario}` : `Ver convocatoria en ${diario}`;
}

module.exports = { ESTADOS_SIN_CONVOCATORIA, esOepSinConvocatoria, enlaceOficialEfectivo, rotuloEnlaceOficial };
