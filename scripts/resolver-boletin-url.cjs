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
  if (b.includes('BORM')) {
    const m = ref.match(/anuncio\s*n?[ºo.]?\s*(\d{3,5})/i)
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

module.exports = { resolverUrl, fecha }

if (require.main === module) {
  const casos = [
    ['BORM', 'BORM núm. 291, 18/12/2025 (anuncio 6133)'],
    ['BOCM', 'BOCM núm. 181, 31/07/2025 (Resolución 17/07/2025, entrada 18)'],
    ['BOJA', 'BOJA núm. 250, 30/12/2025 (Decreto 211/2025)'],
  ]
  for (const [b, r] of casos) console.log(`${b.padEnd(5)} → ${resolverUrl(b, r) || '(sin patrón: hace falta headless o el nº de disposición)'}`)
}
