// lib/convocatoria/tipoDocumento.cjs
//
// ¿QUÉ es este documento del hub de provenance? Núcleo PURO (sin red ni BD) que deduce el
// `tipo` de `convocatoria_documentos` a partir de su cabecera, su título y su URL.
//
// POR QUÉ (T-147): 6.476 de los 6.689 documentos del hub están clonados como `nota` —el tipo
// por defecto del productor automático— y **sin tipo no se puede saber qué respalda cada
// papel**. Por eso `landing_cifra_sin_respaldo` (el detector que contrasta lo que la landing
// AFIRMA contra el documento oficial) no puede subir al barrido nocturno: contrastaría contra
// el documento equivocado. Esto es el suelo de esa familia entera de verificación.
//
// ## Tres decisiones de diseño, todas medidas sobre el corpus real (27/07/2026)
//
// 1. **Se lee la CABECERA, no el documento entero.** Buscar los patrones en todo el texto daba
//    67 falsos "lista de admitidos" porque la expresión aparecía en cualquier párrafo de un
//    PDF de 40 KB, o dentro del boilerplate de firma electrónica. La identidad de un documento
//    administrativo está en su encabezado: se limpia el ruido de portal (sellos CSV, "Versión
//    imprimible", numeración de página, cabecera repetida del boletín) y se mira lo primero.
//
// 2. **La fuente REFUERZA, no decide.** Solo 61 de los 496 documentos sin tipar de landings
//    vivas vienen de un boletín reconocido; los otros 435 son portales institucionales
//    (`sede.inap.gob.es`, `iaap.asturias.es`, `empleopublico.cantabria.es`…) que publican
//    documentos perfectamente reales del proceso —listas, plantillas, fechas— mezclados con
//    manuales y cartas de servicio. Partir por dominio habría tirado documentos buenos y
//    aceptado basura de boletín.
//
// 3. **Ante la duda, `nota`.** El 70% del corpus no tiene ninguna señal (material del portal:
//    certificados ENS, guías de tutoría, catálogos de metodologías). Tipar por parecido llena
//    el hub de etiquetas falsas, que es PEOR que el `nota` de hoy: un `nota` se ignora, un
//    `convocatoria` falso se usa como fuente de verdad. Misma lección que las bandejas ruidosas
//    que hubo que retirar (T-047/T-050).
//
// Taxonomía = la del constraint `convocatoria_documentos_tipo_check`. Consumidores previstos:
// el reclasificador (`scripts/convocatoria/sim-tipo-documento.cjs` → `--apply`) y el productor
// `detect-notas-convocatoria` del backend, para que deje de clonar todo como `nota`.

/** Tipos válidos en BD. `nota`/`otro` son los genéricos: aquí solo se emite `nota`. */
const TIPOS = ['oep_decreto', 'bases', 'convocatoria', 'temario', 'correccion_errores',
  'lista_admitidos', 'resolucion_tribunal', 'anuncio_fecha', 'nota', 'otro']

/** Cuántos caracteres de cabecera se miran una vez limpiada. */
const VENTANA = 900

// Ruido que los portales y los boletines meten ANTES del documento y que desplaza la cabecera
// fuera de la ventana. Todos vistos en el corpus real.
const RUIDO = [
  /versi[óo]n imprimible del documento[^.]{0,200}\./gi,
  /la integridad de este documento puede comprobarse[^.]{0,200}\./gi,
  /c[óo]digo seguro de verificaci[óo]n \(?csv\)?:?\s*[\w\s-]{8,60}/gi,
  /csv\s*:?\s*[A-Za-z0-9_+/=-]{8,60}\.?/gi,
  /url de validaci[óo]n\s*:?\s*\S+/gi,
  /firmante\s*nif\/?cif\s*fecha y hora/gi,
  /p[áa]gina \d+ de \d+/gi,
  /this document is a copy|documento es una copia electr[óo]nica[^.]{0,120}\./gi,
  /fima autom[áa]tica/gi,
  /boletín oficial de la provincia\s*/gi,
  /powered by tcpdf[^\n]*/gi,
]

const plano = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')

/** Cabecera del documento: texto sin el ruido de portal/boletín, recortado a la ventana. */
function cabecera(texto, { ventana = VENTANA } = {}) {
  let t = String(texto || '')
  for (const rx of RUIDO) t = t.replace(rx, ' ')
  return plano(t).trim().slice(0, ventana)
}

// ── Reglas, ORDENADAS POR ESPECIFICIDAD (la primera que casa gana) ────────────────────────
//
// Cada una exige la señal en la CABECERA. `refuerzo` sube la confianza cuando además la URL
// o el título lo confirman; nunca clasifica por sí solo.
// El ORDEN es el 90% de la precisión, y la primera pasada (27/07) lo demostró: con los
// genéricos delante, `oep_decreto` salió con precisión ~0 (4 de 4 de la muestra eran
// convocatorias o cronogramas que citaban la OEP de pasada) y `bases` se tragaba los extractos
// del BOE de administración local, que SIEMPRE dicen "se han publicado las bases que han de
// regir la convocatoria" sin ser las bases. Ahora van primero los documentos con rúbrica
// inconfundible y al final los genéricos, cada uno con su exclusión medida.
const REGLAS = [
  {
    tipo: 'correccion_errores',
    // Una corrección de errores DE una convocatoria reproduce la convocatoria entera: si no va
    // primera, se clasifica como `convocatoria`. Pero la rúbrica es la CABECERA del anuncio
    // ("4852 CORRECCIÓN DE ERRORES…"), así que se mira solo el encabezado y se descarta cuando
    // el documento se identifica como convocatoria: las dos convocatorias de la Universidad de
    // León citaban «…y su corrección de errores» al enumerar antecedentes y caían aquí.
    ventana: 350,
    re: /correccion de errores|correccion de error material|rectificacion de errores/,
    excluir: /por (la|el) que se convoca/,
  },
  {
    tipo: 'lista_admitidos',
    // Rúbrica administrativa fija: "relación/lista provisional o definitiva de aspirantes
    // admitidos y excluidos". Medido: 6 de 6 correctos en la primera muestra.
    re: /(lista|listado|relacion)[^.]{0,60}(provisional|definitiva)[^.]{0,60}(admitid|excluid|aspirantes)|(lista|listado|relacion)[^.]{0,40}(de )?(personas )?(aspirantes )?(admitid|excluid)/,
  },
  {
    tipo: 'anuncio_fecha',
    // Delante de `convocatoria`: un cronograma o un llamamiento hablan del proceso selectivo
    // con las mismas palabras. Casos reales que se colaban como convocatoria: "CRONOGRAMA
    // libre-EXTRAORD" del INAP y "distribución de opositores por aulas" de Aragón.
    re: /cronograma|(fecha|fechas|celebracion|llamamiento)[^.]{0,60}(ejercicio|prueba|examen|proceso selectivo)|distribucion de (los )?(opositores|aspirantes)[^.]{0,30}aulas|previsiones de fecha/,
  },
  {
    tipo: 'resolucion_tribunal',
    re: /(nombramiento|designacion|composicion|constitucion|modificacion)[^.]{0,60}(tribunal|comision permanente de seleccion|organo de seleccion)|tribunal calificador[^.]{0,40}(queda|se constituye|acuerda)/,
  },
  {
    tipo: 'bases',
    // El EXTRACTO del BOE de administración local dice literalmente "se han publicado las bases
    // que han de regir la convocatoria" y NO es las bases: es el anuncio que abre el plazo.
    // Por eso la exclusión, y por eso `bases` exige que el documento apruebe o contenga bases.
    re: /bases (generales|especificas|reguladoras)|(aprobar|aprueba|aprobacion)[^.]{0,60}bases|bases (que han de regir|por las que se rige|de la convocatoria)/,
    excluir: /se han publicado las bases|referente a la convocatoria para proveer/,
  },
  {
    tipo: 'temario',
    // El temario se reconoce por su ESTRUCTURA, no por la palabra: una convocatoria "incluye el
    // temario del Anexo I" sin ser un temario.
    re: /programa de materias|anexo [iv]+\.? ?(-|:)? ?(temario|programa)|temario (para|de) (la|el) (provision|ingreso|acceso)/,
    extra: (cab, doc) => (String(doc.texto || '').match(/\btema \d+/gi) || []).length >= 5,
  },
  {
    tipo: 'convocatoria',
    // La más genérica, al final y con el verbo en su forma resolutiva. Se quitó el patrón
    // "convocatoria (para|de) …", que atrapaba instrucciones de subsanación y manuales.
    re: /por (la|el) que se convocan?|se convocan?[^.]{0,80}(plazas|pruebas selectivas|proceso selectivo)|referente a la convocatoria para proveer/,
    excluir: /instrucciones para|manual de|guia (de|para)|carta de servicios/,
  },
  {
    tipo: 'oep_decreto',
    // LA ÚLTIMA, y con ventana corta, por una razón medida: **casi toda convocatoria cita el
    // decreto de la OEP en su primer párrafo** ("en cumplimiento de lo dispuesto en el Real
    // Decreto 651/2025, de 15 de julio, por el que se aprueba la oferta de empleo público…").
    // Con la regla delante, 4 de 4 de la muestra eran convocatorias del BOE mal tipadas. Ahora:
    // (a) si el documento se identifica como convocatoria, gana convocatoria — un decreto de OEP
    // nunca dice "por la que se convoca proceso selectivo"; (b) la rúbrica tiene que estar en el
    // ENCABEZADO (300 chars), no en mitad del cuerpo; (c) y no valer si viene introducida por un
    // conector de cita.
    ventana: 300,
    re: /((real )?decreto|acuerdo|orden)[^.]{0,80}por (el|la) que se aprueba[^.]{0,40}(la )?oferta de empleo publico|se aprueba la oferta de empleo publico/,
    excluir: /(en cumplimiento de|de conformidad con|en desarrollo de|al amparo de|previsto en|dispuesto en|conforme a)[^.]{0,120}oferta de empleo publico/,
  },
]

/**
 * ¿Qué tipo de documento es? Puro: no toca red ni BD.
 *
 * @param {{titulo?:string, url?:string, texto?:string, boletin?:string}} doc
 * @returns {{tipo:string, confianza:'alta'|'media'|null, motivo:string}}
 *          `tipo:'nota'` = no hay señal suficiente; el llamador NO debe escribir nada.
 */
function clasificarTipoDocumento(doc = {}) {
  const cab = cabecera(doc.texto)
  const titulo = plano(doc.titulo)
  const url = plano(doc.url)

  if (!cab && !titulo) return { tipo: 'nota', confianza: null, motivo: 'sin texto ni título' }

  for (const r of REGLAS) {
    // Algunas reglas miran solo el ENCABEZADO: hay rúbricas que, más abajo, aparecen como cita.
    const ambito = r.ventana ? cab.slice(0, r.ventana) : cab
    if (!r.re.test(ambito)) continue
    if (r.excluir && r.excluir.test(ambito)) continue
    if (r.extra && !r.extra(ambito, doc)) continue
    // La URL o el título que repiten la señal la confirman; el boletín, por sí solo, no dice
    // QUÉ documento es (un BOE puede ser cualquiera de los ocho tipos).
    const refuerzo = r.re.test(titulo) || r.re.test(url)
    return {
      tipo: r.tipo,
      confianza: refuerzo ? 'alta' : 'media',
      motivo: `cabecera casa ${r.tipo}${refuerzo ? ' + título/URL lo confirma' : ''}`,
    }
  }
  return { tipo: 'nota', confianza: null, motivo: 'ninguna señal en la cabecera' }
}

module.exports = { clasificarTipoDocumento, cabecera, plano, TIPOS, REGLAS, VENTANA }
