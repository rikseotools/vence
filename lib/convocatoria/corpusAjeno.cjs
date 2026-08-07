// lib/convocatoria/corpusAjeno.cjs
//
// ¿Los documentos que respaldan una convocatoria salen del MISMO sitio que su fuente oficial?
// Núcleo PURO (sin red ni BD).
//
// ## POR QUÉ EXISTE (T-655, del caso T-654 medido el 07/08/2026)
//
// `auxiliar-administrativo-diputacion-cadiz` (Auxiliar, C2) tenía **8 documentos clonados de la
// carpeta `admto_a`** del portal —el proceso de **Administrativo (C1)**, otro cuerpo— mientras su
// `programa_url` apuntaba a `aux_administrativo`. Resultado: la landing publicaba una cifra de
// plazas cuyo respaldo documental era de OTRA oposición, a 171 usuarios.
//
// **El punto ciego que cubre.** Dos detectores miraban esas plazas y los dos avisaron con razón
// (`plazas_afirmadas_sin_documento`: la cifra no está en ningún documento; `plazas_reserva_sin_
// declarar`: el cupo no está declarado). **Ninguno pregunta de QUIÉN son los documentos**, así que
// señalaban el síntoma y la causa no la miraba nadie.
//
// ## ⚠️ EL PRIMER DISEÑO SE DESCARTÓ POR LA MEDICIÓN, y queda escrito para que no se reintente
//
// La idea obvia era comparar el TEXTO: ¿los documentos nombran el cuerpo de esta oposición?
// Implementado y medido sobre las **125 activas**: **70 daban «ajeno», el 56 %**. Un detector que
// grita. Y la causa no era el umbral sino la premisa: **nuestro `nombre` es comercial y el boletín
// usa la denominación oficial**. Nuestro «Auxiliar Administrativo del Estado» es, en el BOE,
// «Cuerpo General **Auxiliar** de la Administración del Estado» — 422 apariciones de «auxiliar» y
// CERO de la frase buscada. Comparar textos contra un nombre de catálogo no puede funcionar, y
// subir el umbral solo habría escondido el problema.
//
// Lo que SÍ delató a Cádiz no fue el texto: fue **la ruta** (`admto_a` contra `aux_administrativo`).
// Eso es lo que mide este núcleo.
//
// ## LAS TRES DECISIONES, todas medidas
//
// 1. **Se compara el SEGMENTO DE CARPETA, no la URL entera.** Un portal sirve el mismo proceso
//    desde varias URLs (visor, descarga directa, versión imprimible); lo estable es la carpeta que
//    lo agrupa. Se toma el penúltimo segmento: en `.../procesosentramite/aux_administrativo/
//    01.-Convocatoria.pdf` es `aux_administrativo`.
//
// 2. **Los segmentos GENÉRICOS no dicen nada y se descartan a los DOS lados.** `pdf`, `html`,
//    `files`, `ficheros`, `diario_boe`, ids numéricos… Sin este filtro salían **12 hallazgos de
//    117** y la mitad eran comparaciones entre `pdf` y `files`, que no significan nada. Con él, de
//    las **163 convocatorias con fuente oficial** quedan **42 JUZGABLES** — y decir cuántas se pudieron juzgar importa tanto como
//    el hallazgo: sobre las otras 121 este detector **no opina**, que no es lo mismo que darlas por
//    buenas.
//
// 3. **NO enciende el badge: vive BAJO DEMANDA.** Medido sobre las 42 juzgables: **4 hallazgos**,
//    de los cuales **2 ciertos** (`auxiliar-enfermeria-geriatria-diputacion-cadiz`, con la MISMA
//    contaminación de `admto_a` que destapó todo esto, y `auxiliar-administrativo-ayuntamiento-
//    valladolid`, con documentos de «técnico de administración general» y «trabajador social») y
//    **2 de ruido de portal** (`celador-sas`, `auxiliar-administrativo-clm`: ambas carpetas son
//    secciones del mismo sitio). **Precisión ≈50 %** → misma decisión que `vinculoArticuloVecino`
//    e `instrumentoDerivado`, que viven bajo demanda por lo mismo: con una persona leyendo la
//    salida son útiles; en un badge son ruido que enseña a ignorar el badge.
//
// Consumidor: `scripts/convocatoria/audit-corpus-ajeno.cjs` → `npm run audit:corpus-ajeno`.

'use strict'

/**
 * Segmentos de ruta que NO identifican un proceso: son la fontanería del portal. Descartarlos es
 * lo que separa 12 hallazgos ruidosos de 4 con sentido.
 */
const GENERICO = /^(pdf|pdfs|html|htm|files|file|ficheros|fichero|documentos|documento|docs|doc|download|descargas|descarga|adjuntos|anexos|media|galeria|diario_boe|boletin|boletines|portada|index|sites|default|export|www|[0-9]+|[0-9]{4}-[0-9]{2})$/i

/** ¿Este segmento identifica algo, o es fontanería del portal (incluido «algo.pdf»)? */
function segmentoUtil(s) {
  if (!s) return false
  let limpio = String(s)
  try { limpio = decodeURIComponent(limpio) } catch { /* URL mal codificada: se juzga tal cual */ }
  if (/\.(pdf|html?|docx?|zip)$/i.test(limpio)) return false
  return !GENERICO.test(limpio)
}

/**
 * La CARPETA que agrupa un documento dentro del portal: el penúltimo segmento de la ruta.
 * `null` si la URL no es válida o no tiene carpeta.
 */
function carpetaDe(url) {
  try {
    const partes = new URL(String(url)).pathname.split('/').filter(Boolean)
    if (partes.length < 2) return null
    return partes[partes.length - 2] || null
  } catch { return null }
}

/**
 * ¿El corpus de esta convocatoria sale del mismo sitio que su fuente oficial?
 *
 * @param {{programaUrl:string, documentos:Array<{url?:string, titulo?:string}>}} p
 * @returns {{veredicto, carpetaOficial, carpetasDocumentos, documentosJuzgados, motivo}}
 *   · `ajeno`       — NINGÚN documento comparte carpeta con la fuente oficial → HALLAZGO
 *   · `coherente`   — al menos uno la comparte
 *   · `no_juzgable` — las carpetas son genéricas o no hay documentos con URL. **NO es un
 *                     hallazgo**: es no poder opinar, y decirlo.
 */
function corpusSaleDeSuSitio({ programaUrl, documentos = [] } = {}) {
  const oficial = carpetaDe(programaUrl)
  if (!segmentoUtil(oficial)) {
    return {
      veredicto: 'no_juzgable', carpetaOficial: oficial, carpetasDocumentos: [], documentosJuzgados: 0,
      motivo: oficial
        ? `la carpeta de la fuente oficial («${oficial}») es genérica del portal: no identifica un proceso`
        : 'la convocatoria no tiene fuente oficial con una ruta de la que sacar carpeta',
    }
  }
  const carpetas = (documentos || []).map((d) => carpetaDe(d && d.url)).filter((s) => segmentoUtil(s))
  if (!carpetas.length) {
    return {
      veredicto: 'no_juzgable', carpetaOficial: oficial, carpetasDocumentos: [], documentosJuzgados: 0,
      motivo: `ninguno de sus ${(documentos || []).length} documento(s) tiene una carpeta con significado`,
    }
  }
  const unicas = [...new Set(carpetas)]
  if (carpetas.includes(oficial)) {
    return {
      veredicto: 'coherente', carpetaOficial: oficial, carpetasDocumentos: unicas, documentosJuzgados: carpetas.length,
      motivo: `${carpetas.filter((s) => s === oficial).length} de ${carpetas.length} documento(s) salen de «${oficial}», la misma carpeta que la fuente oficial`,
    }
  }
  return {
    veredicto: 'ajeno', carpetaOficial: oficial, carpetasDocumentos: unicas, documentosJuzgados: carpetas.length,
    motivo: `sus ${carpetas.length} documento(s) salen de «${unicas.slice(0, 3).join('», «')}» y su fuente oficial de «${oficial}»: ninguno viene del sitio que la convocatoria dice ser el suyo`,
  }
}

module.exports = { corpusSaleDeSuSitio, carpetaDe, segmentoUtil, GENERICO }
