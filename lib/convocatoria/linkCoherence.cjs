// lib/convocatoria/linkCoherence.cjs
// GUARDARRAÍL de coherencia de los ENLACES de una convocatoria contra lo que MUESTRA.
//
// Incidente que lo motiva (25/07): la caja "Ver OEP en BOE" de una landing muestra
// "BOE-A-2026-9946 (RD 387/2026, OEP 2026)" pero el enlace (programa_url) apunta a
// BOE-A-2025-26262 (la convocatoria de 2025). El usuario pincha y no corresponde.
// Medido: 5 oposiciones vigentes con el enlace apuntando a otro documento. También el
// seguimiento_url apunta a un año anterior al de la convocatoria vigente.
//
// Núcleo PURO (sin red/DB): extrae los identificadores/años de los textos y compara.
// Lo consume el sweep de salud (kind `convocatoria_link_mismatch`).

const { boletinDeUrl } = require('./canonicalizeBoletinUrl.cjs')
const { procesoConFichaViva } = require('./seguimientoUrlSalud.cjs')
const { enlaceOficialEfectivo, esOepSinConvocatoria } = require('./enlaceOficial.cjs')

/** Extrae el primer identificador BOE-X-YYYY-NNNNN de un texto (o null). */
function extraerIdBoe(texto) {
  if (!texto) return null
  const m = String(texto).match(/BOE-[A-Z]-\d{4}-\d+/)
  return m ? m[0] : null
}

/** Extrae el primer año 20xx de un texto/URL (o null). */
function extraerAño(texto) {
  if (!texto) return null
  const m = String(texto).match(/\b(20\d{2})\b/)
  return m ? parseInt(m[1], 10) : null
}

/**
 * Comprueba la coherencia de los enlaces de una convocatoria.
 * @param {{boeReference?:string|null, programaUrl?:string|null, seguimientoUrl?:string|null,
 *          año?:number|null, diarioOficial?:string|null, estadoProceso?:string|null,
 *          enlaceOep?:string|null}} c
 *
 * `enlaceOep` = documento de la OEP vigente ya clonado. NO es opcional por comodidad: la landing
 * enlaza ESE documento cuando aún no hay convocatoria (F4/T-108), así que juzgar `programaUrl` a
 * pelo marca URLs que el opositor no ve. Medido el 28/07: 5 de los 13 hallazgos eran de ese tipo,
 * entre ellos `administrativo-andalucia`, señalado por el temario del IAAP cuando la página enseña
 * su BOJA correcto. Si el llamador no lo pasa, se comporta como antes (no puede empeorar).
 * @returns {Array<{tipo:string, severidad:'error'|'warn', detalle:string}>}
 */
function checkConvocatoriaLinks(c) {
  const issues = []
  if (!c) return issues

  // (1) El enlace del BOE (programa_url) debe apuntar al MISMO documento que la referencia
  //     que se muestra (boe_reference). Si ambos citan un BOE-… y difieren → el usuario
  //     pincha "Ver … en BOE" y aterriza en otro documento. Es un ERROR (rompe la confianza).
  const idRef = extraerIdBoe(c.boeReference)
  const idUrl = extraerIdBoe(c.programaUrl)
  if (idRef && idUrl && idRef !== idUrl) {
    issues.push({
      tipo: 'ref_url_mismatch',
      severidad: 'error',
      detalle: `muestra ${idRef} pero el enlace va a ${idUrl}`,
    })
  }

  // (2) El seguimiento del proceso no debe apuntar a un año ANTERIOR al de la convocatoria
  //     vigente (parece que vigilas el ciclo viejo). Señal a revisar (WARN: la URL puede
  //     no llevar año, o el ciclo anterior seguir vivo legítimamente).
  const añoSeg = extraerAño(c.seguimientoUrl)
  if (c.año && añoSeg && añoSeg < c.año) {
    issues.push({
      tipo: 'seguimiento_year_stale',
      severidad: 'warn',
      detalle: `el seguimiento apunta a ${añoSeg} y la convocatoria vigente es ${c.año}`,
    })
  }

  // (3) La ETIQUETA del botón ("Ver convocatoria en {diario_oficial}") debe nombrar el MISMO
  //     boletín al que apunta el enlace. La landing compone el texto con `diario_oficial` y la
  //     URL con `programa_url`: si no casan, el botón promete un boletín y lleva a otro.
  //     Incidente que lo motiva (25/07): Aux. Admin. UAL quedó con diario_oficial='BOJA'
  //     (el plazo cuenta desde el BOJA) y programa_url al BOE → "Ver convocatoria en BOJA"
  //     enlazando a boe.es. El check (1) NO lo ve: referencia y enlace eran el mismo BOE.
  //     DEFENSIVO: solo dispara cuando el boletín de la URL se RECONOCE (PATTERNS de
  //     canonicalizeBoletinUrl). Un dominio de la cola larga (BOP provinciales, sedes
  //     electrónicas) devuelve 'unknown' → no se inventa un hallazgo. Añadir un boletín al
  //     registro compartido activa esta comprobación para él, sin tocar este fichero.
  const etiqueta = normalizarEtiquetaBoletin(c.diarioOficial)
  // El enlace que la landing enseña DE VERDAD (núcleo compartido con la página): cuando aún no hay
  // convocatoria y la OEP tiene documento clonado, el botón lleva a ESE documento, no a
  // `programa_url`. Juzgar el campo de BD a pelo es juzgar algo que el opositor no ve.
  const urlEfectiva = enlaceOficialEfectivo({
    estadoProceso: c.estadoProceso, enlaceOep: c.enlaceOep, programaUrl: c.programaUrl,
  })
  if (etiqueta && urlEfectiva) {
    const { boletin } = boletinDeUrl(urlEfectiva)
    if (boletin && boletin !== etiqueta) {
      issues.push({
        tipo: 'etiqueta_boletin_mismatch',
        severidad: 'error',
        detalle: `la etiqueta dice "${etiqueta}" pero el enlace apunta al ${boletin}`,
      })
    }

    // (4) El botón promete un boletín ("Ver convocatoria en BOE") y el enlace NO ES DE NINGÚN
    //     boletín. Punto ciego de (3), que solo veía el caso "es OTRO boletín": si la URL era de
    //     un portal institucional, `boletinDeUrl` devuelve null y los tres checks se callaban.
    //     Caso raíz (26/07): `policia-nacional`, con plazo ABIERTO, prometía el BOE y llevaba a
    //     `policia.es/portalaspirantes/en/web/…` — ni BOE, ni convocatoria, ni español. Medido
    //     ese día: 56 de 123 landings activas caían en esta zona ciega.
    //
    //     Calibrado para NO marcar la cola larga legítima: que la entidad publique las bases en
    //     su sede (un PDF, una ficha con id) es normal y NO se emite. Solo se emite cuando la
    //     URL ni siquiera es un documento (portada/sección de portal, o página en otro idioma),
    //     o cuando el enlace es un TEMARIO —que es correcto como `programa_url` y engañoso bajo
    //     el rótulo "Ver convocatoria": la señal de que un mismo campo sirve a dos contratos.
    else if (!boletin) {
      const s = señalesDeUrl(urlEfectiva)
      const razones = []
      if (s.portadaOSeccion) razones.push('no es un documento, es una portada/sección de portal')
      if (s.idiomaExtranjero) razones.push('la página está en otro idioma')
      if (razones.length) {
        // Con convocatoria PUBLICADA existe un documento oficial que enlazar → el hueco es
        // indefendible (error). Sin ella (OEP aprobada, sin OEP, proceso ya cerrado) la página
        // institucional puede ser lo mejor disponible: queda en cola de revisión (warn), donde
        // lo que hay que arreglar suele ser la ETIQUETA, no el enlace. Mismo criterio de
        // "proceso en juego" que `seguimientoUrlSalud` — se reutiliza su función, no se copia.
        issues.push({
          tipo: 'enlace_no_es_boletin',
          severidad: procesoConFichaViva(c.estadoProceso) ? 'error' : 'warn',
          detalle: `el botón promete "${etiqueta}" pero el enlace ${razones.join('; además ')}`,
        })
      } else if (s.pareceTemario && !esOepSinConvocatoria(c.estadoProceso)) {
        // Solo molesta si el botón PROMETE la convocatoria. Sin convocatoria publicada el rótulo
        // es "Ver OEP en {diario}" (ver `rotuloEnlaceOficial`), que no promete un documento de
        // convocatoria: marcar ahí sería pedir que se arregle algo que la página no afirma.
        issues.push({
          tipo: 'enlace_no_es_boletin',
          severidad: 'warn',
          detalle: `el botón promete la convocatoria en "${etiqueta}" y el enlace es un TEMARIO`,
        })
      }
    }
  }

  return issues
}

// Extensiones de fichero que SÍ son un documento descargable (las bases en PDF de una sede
// institucional son legítimas: no se marcan).
const EXT_DOCUMENTO = /\.(pdf|docx?|odt|rtf)(\?|$)/i
// Página índice de un portal: nunca es la convocatoria.
const PAGINA_INDICE = /\/(index|inicio|home|portada)\.(html?|jsp|php|aspx)$/i
// Segmento de idioma NO español en la ruta. Las coficiales (ca/eu/gl/va) quedan fuera a
// propósito: sirven el MISMO documento oficial y marcarlas sería ruido político, no un defecto.
const IDIOMA_EXTRANJERO = /\/(en|fr|de|it|pt)(\/|$)/i
// "Temario"/"programa de materias" en la ruta (incluye `temari`, valenciano/catalán).
const RUTA_TEMARIO = /temario|temari|programa[-_ ]?(?:de[-_ ]?)?(?:materias|oficial)/i
const AÑO_SUELTO = /\b(?:19|20)\d{2}\b/g

/**
 * Señales PURAS sobre la URL del botón oficial. No dice si el documento es el correcto
 * (eso exige red y criterio) — solo si la URL puede siquiera ser un documento.
 * @param {string} raw
 */
function señalesDeUrl(raw) {
  const url = String(raw || '')
  const sinEsquema = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const corte = sinEsquema.search(/[/?]/)
  let ruta = corte >= 0 ? sinEsquema.slice(corte) : ''
  try { ruta = decodeURIComponent(ruta) } catch { /* ruta con % suelto: se usa tal cual */ }
  const soloRuta = ruta.split('?')[0]
  const esDocumento = EXT_DOCUMENTO.test(soloRuta)
  // Un identificador de documento es un número de 3+ cifras que NO sea un año suelto
  // (`…/empleo/auxiliares-c2-2026` es una sección, no un documento; `…/tramites/1014761` sí).
  const tieneId = /\d{3,}/.test(ruta.replace(AÑO_SUELTO, ''))
  return {
    idiomaExtranjero: IDIOMA_EXTRANJERO.test(soloRuta),
    portadaOSeccion: PAGINA_INDICE.test(soloRuta) || (!esDocumento && !tieneId),
    pareceTemario: RUTA_TEMARIO.test(soloRuta),
  }
}

/**
 * Normaliza la etiqueta de `diario_oficial` al código de boletín comparable.
 * Acepta "BOE", "boe", "B.O.E." y devuelve null para etiquetas compuestas de la cola larga
 * ("BOP Córdoba", "Sede electrónica"), que NO son comparables con el registro de PATTERNS.
 */
function normalizarEtiquetaBoletin(raw) {
  if (!raw) return null
  const limpio = String(raw).trim().toUpperCase().replace(/\./g, '')
  return /^[A-Z]{3,5}$/.test(limpio) ? limpio : null
}

module.exports = { extraerIdBoe, extraerAño, checkConvocatoriaLinks, normalizarEtiquetaBoletin, señalesDeUrl }
