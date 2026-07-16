#!/usr/bin/env node
/**
 * resolver-boletin-url.cjs — deduce la URL del documento a partir de la referencia que ya tenemos.
 *
 * POR QUÉ (16/07/2026): 75 oposiciones publicadas afirman plazas sin documento, y citan boletines
 * AUTONÓMICOS (BOC 9, BORM 7, BOJA 4, BOCM 4…). Los 16 adapters de `ccaa-boletines.ts` NO sirven aquí:
 * están hechos para "el sumario de HOY" (el radar) — usan la portada o el último boletín, y solo el BOA
 * construye URL por fecha. Para un boletín PASADO y CONCRETO hace falta la estructura de URL de cada
 * uno. Comprobado: la portada del BOJA es una SPA de Drupal (136 KB de CSS/JS, 7.6k de texto, cero
 * contenido) → esa familia necesita headless, no fetch plano.
 *
 * LO QUE SÍ SE PUEDE: varios boletines tienen URL deducible, y **nuestra propia `boe_reference` ya trae
 * el dato que falta** («BORM núm. 291, 18/12/2025 (anuncio 6133)» → nº de anuncio; «BOCM núm. 181,
 * 31/07/2025 (… entrada 18)» → nº de entrada). Verificado contra la red: los dos devuelven PDF 200.
 *
 * Exporta `resolverUrl(boletin, referencia)` → url|null, para poder testearlo sin red.
 */

/** dd/mm/yyyy en cualquier parte de la referencia */
function fecha(ref) {
  const m = ref.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  return { d: m[1].padStart(2, '0'), m: m[2].padStart(2, '0'), y: m[3] }
}

/**
 * Resuelve la URL del documento. null = este boletín no tiene patrón deducible (o falta el dato):
 * NO se inventa una URL — una URL adivinada que devuelve 200 con otra cosa es peor que no tener nada
 * (lección del DOCM: `descargarArchivo.do` sin `/portaldocm` redirige a la web y clona los MENÚS).
 */
function resolverUrl(boletin, ref) {
  if (!boletin || !ref) return null
  const b = boletin.toUpperCase()
  const f = fecha(ref)

  // BORM: el nº de anuncio va en la referencia → endpoint estable de servicios.
  //
  // ⚠️ El MISMO número se escribe de tres formas y mi 1ª versión solo entendía una («anuncio 6133»),
  // así que daba "no deducible" a referencias que SÍ traían el dato: «disposición 5341» y el NPE
  // «A-121125-5341» (donde la cola del NPE ES el nº de anuncio). Mismo error que con las cifras en
  // letra: el dato estaba, el ciego era yo.
  if (b.includes('BORM')) {
    const m = ref.match(/(?:anuncio|disposici[óo]n)\s*n?[ºo.]?\s*(\d{3,5})/i)
      || ref.match(/NPE\s*[:\s]*A-\d{6}-(\d{3,5})/i)
    const y = f?.y || (ref.match(/\b(20\d{2})\b/) || [])[1]
    if (m && y) return `https://www.borm.es/services/anuncio/ano/${y}/numero/${m[1]}/pdf`
  }

  // BOCM: el nombre del PDF es BOCM-YYYYMMDD-<entrada>. La entrada suele venir como "entrada N".
  if (b.includes('BOCM')) {
    const m = ref.match(/entrada\s*(\d{1,3})/i)
    if (m && f) return `https://www.bocm.es/boletin/CM_Orden_BOCM/${f.y}/${f.m}/${f.d}/BOCM-${f.y}${f.m}${f.d}-${m[1]}.PDF`
  }

  // DOCM: ⚠️ SIEMPRE /portaldocm/. Sin ese segmento el servidor redirige (301) a la web y te clonas
  // el chrome del portal creyendo que tienes el decreto. Pasó el 16/07.
  if (b.includes('DOCM')) {
    const m = ref.match(/\b(\d{4})[_/](\d{3,5})\b/) || ref.match(/NID\s*(\d{4})\/(\d{3,5})/i)
    if (m && f) return `https://docm.jccm.es/portaldocm/descargarArchivo.do?ruta=${f.y}/${f.m}/${f.d}/pdf/${m[1]}_${m[2]}.pdf&tipo=rutaDocm`
  }

  // BOCYL: BOCYL-D-DDMMYYYY-<nº boletín>-<orden>
  if (b.includes('BOCYL') || b.includes('BOCyL')) {
    const m = ref.match(/BOCYL-D-(\d{8})-(\d+)-(\d+)/i)
    if (m && f) return `https://bocyl.jcyl.es/boletines/${f.y}/${f.m}/${f.d}/pdf/BOCYL-D-${m[1]}-${m[2]}-${m[3]}.pdf`
  }

  // BON: /es/anuncio/-/texto/AÑO/NUM/ORDEN
  if (b.includes('BON')) {
    const m = ref.match(/n[ºo.]?\s*(\d{1,3})/i)
    const y = f?.y || (ref.match(/\b(20\d{2})\b/) || [])[1]
    const o = ref.match(/anuncio\s*(\d{1,3})/i)
    if (m && y && o) return `https://bon.navarra.es/es/anuncio/-/texto/${y}/${m[1]}/${o[1]}`
  }

  return null
}

/**
 * BOA: no tiene URL deducible en UN paso, pero SÍ en DOS — y funciona (verificado 16/07 con el
 * DECRETO 12/2026 de tcae-aragon):
 *
 *   1. sumario del día (el mismo endpoint legacy que usa el adapter del radar, ya date-based):
 *      https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VERLST&BASE=BOLE&DOCS=1-200&SEC=SUMARIO&OUTPUTMODE=HTML&SEPARADOR=&&PUBL=YYYYMMDD
 *      ⚠️ viene en iso-8859-1, no utf-8.
 *   2. buscar el título en el HTML y coger el href `BRSCGI?CMD=VEROBJ&MLKOB=<id>` que le sigue →
 *      ese es el PDF. (El segundo MLKOB de cada entrada es la FIRMA: `application/sig`, no el PDF.)
 *
 * Este patrón —sumario por fecha + id interno— es probablemente el mismo de varios boletines que hoy
 * damos por "necesitan headless". Antes de tirar de Playwright para uno, prueba si su sumario del día
 * responde a fetch plano: el BOA parecía inviable (su portada es Angular) y no lo era.
 */
const BOA_SUMARIO = (ymd) =>
  `https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VERLST&BASE=BOLE&DOCS=1-200&SEC=SUMARIO&OUTPUTMODE=HTML&SEPARADOR=&&PUBL=${ymd}`
const BOA_DOC = (mlkob) => `https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VEROBJ&MLKOB=${mlkob}`

/**
 * BOC (Canarias): igual que el BOA, DOS pasos, y también funciona (verificado con la Resolución
 * 6/06/2025 del SCS, que prueba 3 oposiciones canarias de golpe):
 *   1. sumario por AÑO/NÚMERO (que es justo lo que trae nuestra referencia: «BOC nº 116, 13/06/2025»):
 *      https://www.gobiernodecanarias.org/boc/2025/116/  → HTML plano, ~15k de texto
 *   2. buscar la entrada y coger su id `BOC-A-YYYY-NNN-NNNN` → el PDF vive en la SEDE:
 *      https://sede.gobiernodecanarias.org/boc/boc-a-2025-116-2169.pdf   (1,4 MB, 375k chars)
 *
 * ⚠️ El título del sumario es GENÉRICO («convocan pruebas selectivas […] en plazas básicas vacantes»):
 * las categorías (TCAE, Auxiliar…) van en el ANEXO del PDF. Buscar «Cuidados Auxiliares» en el sumario
 * da CERO y estuve a punto de dar la referencia por mala. La convocatoria estaba donde decía.
 */
const BOC_SUMARIO = (anio, num) => `https://www.gobiernodecanarias.org/boc/${anio}/${num}/`
const BOC_DOC = (id) => `https://sede.gobiernodecanarias.org/boc/${String(id).toLowerCase()}.pdf`

/**
 * MAPA MEDIDO (16/07/2026) — qué boletín responde a fetch plano y cuál necesita headless.
 *
 * 🔑 LECCIÓN: **no juzgues un boletín por su PORTADA.** Di por inviables el BOA y el BOC porque sus
 * portadas son Angular/SPA… y sus SUMARIOS por fecha responden a `curl` sin más — que es justo como
 * los lee el radar. Probar el sumario ANTES de montar Playwright.
 *
 *   BOA   ✅ 2 pasos (sumario por fecha → MLKOB → PDF).  ⚠️ iso-8859-1
 *   BOC   ✅ 2 pasos (sumario año/nº → BOC-A-id → PDF en la sede)
 *   DOCM  ✅ directo (⚠️ SIEMPRE /portaldocm/, si no redirige a la web y clonas los menús)
 *   BORM  ✅ directo (nº de anuncio → /services/anuncio/ano/YYYY/numero/NNNN/pdf)
 *   BOCM  ✅ directo (nº de entrada → BOCM-YYYYMMDD-N.PDF)
 *   BOCYL ✅ directo (BOCYL-D-DDMMYYYY-NNN-NN.pdf)
 *   BOPV  ⚠️ el SUMARIO responde (/bopv2/datos/YYYY/MM/sYY_NNNN.pdf) pero las DISPOSICIONES son JS
 *           (la .shtml devuelve 1.3k de chrome, sin PDF) → headless para el documento
 *   BOJA  ❌ SPA de Drupal: 136 KB de CSS/JS y 7.6k de texto sin contenido → headless
 *   DOG   ❌ patrón no resuelto (las urls de hitos son /dog/Publicados/YYYY/YYYYMMDD/Anuncio…_es.html)
 */
module.exports = { resolverUrl, fecha, BOA_SUMARIO, BOA_DOC, BOC_SUMARIO, BOC_DOC }

if (require.main === module) {
  const casos = [
    ['BORM', 'BORM núm. 291, 18/12/2025 (anuncio 6133)'],
    ['BOCM', 'BOCM núm. 181, 31/07/2025 (Resolución 17/07/2025, entrada 18)'],
    ['BOJA', 'BOJA núm. 250, 30/12/2025 (Decreto 211/2025)'],
  ]
  for (const [b, r] of casos) console.log(`${b.padEnd(5)} → ${resolverUrl(b, r) || '(sin patrón: hace falta headless o el nº de disposición)'}`)
}
