/**
 * lib/impugnaciones/verificarEnlaces.cjs — NO se manda un enlace que no se ha abierto.
 *
 * ## Por qué existe
 *
 * La regla («abre el enlace antes de mandarlo y comprueba que dice lo que dices») estaba
 * escrita en el manual de impugnaciones, y aun así se cumplía a medias. El 02/08/2026, en
 * la impugnación `cbc88fff`, se comprobó el TEXTO del artículo y que el ancla `#a53`
 * EXISTÍA… pero no que llevara al artículo 53. Que exista no basta:
 *
 *   · **LO 3/2018** — el artículo 17 vive en `#a1-9`; `#a17` sencillamente NO EXISTE, y el
 *     enlace abre el documento por arriba dejando al usuario buscando a mano.
 *   · **Código Civil** — `#a3` SÍ existe… y lleva a «Artículo 301 a 324. (Derogados)».
 *     No da 404: el opositor pincha, lee algo que no tiene nada que ver, y la respuesta que
 *     pretendía convencerle demuestra lo contrario.
 *
 * Son tres convenciones distintas en tres normas, así que no hay patrón que memorizar: hay
 * que mirarlo. Y como mirarlo depende de acordarse, aquí se comprueba sola.
 *
 * PURO: no hace red. Recibe el HTML ya descargado y decide. Quien descarga es el script de
 * cierre, que es el punto por el que pasa todo mensaje antes de salir.
 */

/** URLs del BOE consolidado (`act.php?id=…`), con o sin ancla. */
function extraerEnlacesBoe(texto) {
  const encontrados = String(texto || '').match(/https?:\/\/www\.boe\.es\/buscar\/act\.php\?[^\s)»"]+/g) || []
  // El punto final de una frase no forma parte de la URL.
  return [...new Set(encontrados.map((u) => u.replace(/[.,;]+$/, '')))]
}

/** El ancla de una URL (`…#a53` → `a53`), o null si no lleva. */
function anclaDe(url) {
  const i = String(url).indexOf('#')
  return i === -1 ? null : String(url).slice(i + 1)
}

/**
 * El artículo que el MENSAJE dice estar citando («El artículo 53.2 dice: «…»»).
 * Devuelve el número base (53), que es lo que titula el bloque en el BOE.
 *
 * Se coge el ÚLTIMO mencionado ANTES de la cita, no el primero del mensaje: una respuesta
 * suele nombrar antes el artículo del que se discute. Con el primero, el mensaje a Pepe
 * (que empieza hablando del artículo 14 y luego cita el 53.2) daba un falso positivo —
 * cazado el 02/08 por el propio guardarraíl al estrenarlo.
 */
function articuloCitadoEnElTexto(texto) {
  const t = String(texto || '')
  const hastaLaCita = t.indexOf('«') > 0 ? t.slice(0, t.indexOf('«')) : t
  const previos = [...hastaLaCita.matchAll(/art[íi]culo\s+(\d+)(?:\.\d+)?/gi)]
  if (previos.length) return previos[previos.length - 1][1]
  const cualquiera = t.match(/art[íi]culo\s+(\d+)(?:\.\d+)?/i)
  return cualquiera ? cualquiera[1] : null
}

/** Fragmentos entrecomillados con «…», que es como se citan las leyes en esta casa. */
function extraerCitas(texto) {
  return (String(texto || '').match(/«([^»]{25,})»/g) || []).map((c) => c.slice(1, -1))
}

/** Quita etiquetas y comprime espacios: comparar HTML contra prosa exige normalizar. */
function aTextoPlano(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Igual que arriba pero para el texto del mensaje (para comparar manzanas con manzanas). */
function normalizar(t) {
  return String(t || '').replace(/\s+/g, ' ').replace(/[“”"]/g, '').trim()
}

/**
 * ¿El ancla lleva de verdad al artículo que decimos, y el documento contiene la cita?
 *
 * @param {string} html      HTML del documento consolidado, ya descargado.
 * @param {object} opts      { ancla, articulo, citas }
 * @returns {{ok: boolean, problemas: string[], tituloDelBloque: string|null}}
 */
function verificarDocumento(html, { ancla, articulo, citas = [] } = {}) {
  const problemas = []
  const plano = aTextoPlano(html)
  let tituloDelBloque = null

  if (ancla) {
    const i = String(html).indexOf(`id="${ancla}"`)
    if (i === -1) {
      problemas.push(`el ancla #${ancla} NO EXISTE en el documento (el enlace abrirá por arriba)`)
    } else {
      // El bloque empieza con su rúbrica: «[Bloque N: #ancla] … Artículo 53».
      const cabecera = aTextoPlano(String(html).slice(i, i + 1200))
      // Solo la DESIGNACIÓN del artículo, no la frase que le sigue: «Artículo 53»,
      // «Artículo 17 bis», «Artículo 301 a 324». Sin este corte, el título arrastraba
      // el primer apartado entero y el mensaje de error era ilegible.
      const m = cabecera.match(/Art[íi]culo\s+(\d+(?:\s+(?:bis|ter|quater|quinquies))?(?:\s+a\s+\d+)?)/i)
      tituloDelBloque = m ? `Artículo ${m[1].trim()}` : null
      if (articulo) {
        const casa = new RegExp(`Art[íi]culo\\s+${articulo}\\b`).test(cabecera)
        if (!casa) {
          problemas.push(
            `el ancla #${ancla} NO lleva al artículo ${articulo}` +
              (tituloDelBloque ? ` — lleva a «${tituloDelBloque}»` : ''),
          )
        }
      }
    }
  }

  for (const cita of citas) {
    // Sin distinguir mayúsculas: una cita que arranca a mitad de frase empieza en
    // minúscula y seguiría siendo literal. Lo que NO se normaliza son las tildes ni las
    // palabras: ahí es donde una cita deja de ser la del artículo.
    if (!plano.toLowerCase().includes(normalizar(cita).toLowerCase())) {
      problemas.push(`la cita «${normalizar(cita).slice(0, 60)}…» NO aparece literal en el documento`)
    }
  }

  return { ok: problemas.length === 0, problemas, tituloDelBloque }
}

module.exports = {
  extraerEnlacesBoe,
  anclaDe,
  articuloCitadoEnElTexto,
  extraerCitas,
  verificarDocumento,
  aTextoPlano,
}
