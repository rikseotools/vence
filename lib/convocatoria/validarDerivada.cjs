/**
 * ¿Es admisible una firma `cifra_derivada`, o está tapando una cifra mal?
 *
 * NÚCLEO PURO. La válvula `cifra_derivada` permite publicar una cifra que NO está escrita en el
 * boletín cuando se obtiene de literales del mismo documento. Es necesaria (a veces el número correcto
 * no lo escribe nadie) y es, por construcción, **la puerta por la que se cuela un dato inventado**: dice
 * «la cuenta la hago yo» y hasta ahora solo dependía de la buena fe de quien firmaba.
 *
 * Se cerró el 27/07/2026 después de que yo mismo la usara mal. `administrativo-aragon` publicaba 139
 * plazas; el BOA convoca **144** y desglosa entre paréntesis 3+1+1 reservadas. Firmé que 139 = 144 − 5,
 * y es falso: las plazas reservadas a colectivos son plazas del turno libre CON reserva, no descontadas
 * (así lo cuenta el propio anexo, y así se cuenta en Madrid: cupo 100 + reserva 11 = `plazas_libres` 111).
 * La landing anunciaba 5 plazas MENOS de las convocadas. El guardarraíl que había —`cita_no_prueba_nada`—
 * no me paró porque yo SÍ aporté cita: una cita literal y correcta… que probaba el 144, no el 139.
 * Comprobaba que hubiera prueba, no que la prueba probara lo firmado.
 *
 * ── La regla, calibrada contra las firmas REALES (no inventada) ────────────────────────────────────
 *
 *   firma                                   cifra   ¿suma de números del snippet?
 *   auxiliar-administrativo-extremadura      126    103 + 23            ✓
 *   auxiliar-administrativo-baleares         128    110 + 11 + 6 + 1    ✓
 *   ayuntamiento-madrid                      111    100 + 11           ✓
 *   administrativo-aragon (mi firma mala)    139    — nada suma 139     ✗
 *
 * Las tres legítimas **suman partes** que el documento enumera pero no totaliza. La mala **restaba de
 * un total** que el documento sí declara. Y ahí está la diferencia de fondo, no solo aritmética: sumar
 * partes explícitas es leer; restar de un total explícito es decidir que parte de lo que el documento
 * cuenta no cuenta — eso es una interpretación, y una interpretación no se firma como hecho.
 *
 * Y ojo a la asimetría: si la cita CONTIENE la cifra, se admite (la cita la respalda directamente).
 * Rechazar eso tumbaría el caso del Ayuntamiento de Madrid, donde la cifra está impresa en el BOCM
 * pero el CMap roto impide extraerla — el problema es del extractor, no del dato.
 *
 * Ojo a lo que NO sirve como regla (medido: habría tumbado las 3 buenas): «rechazar si el snippet
 * menciona otra cifra de plazas». Las tres legítimas mencionan otras (146 en Extremadura, 100 en
 * Madrid, 110 en Baleares). Casi escribo eso.
 */

/** Números plausibles como plazas. Descarta códigos de convocatoria, años, artículos sueltos. */
function numerosDelTexto(texto) {
  return (String(texto || '').match(/\b\d{1,4}\b/g) || []).map(Number).filter((n) => n > 0)
}

/**
 * ¿Existe un subconjunto de `numeros` (de 2 o más) que sume exactamente `objetivo`?
 * @returns {number[]|null} los sumandos, o null.
 */
function sumaDeSubconjunto(objetivo, numeros) {
  if (!objetivo || objetivo <= 0) return null
  // Solo candidatos que quepan, sin repetir, y acotados: esto se ejecuta en un sweep, no en un solver.
  const cand = [...new Set(numeros)].filter((n) => n <= objetivo).sort((a, b) => b - a).slice(0, 18)
  const busca = (i, resto, usados) => {
    if (resto === 0 && usados.length >= 2) return usados
    if (i >= cand.length || resto < 0) return null
    return busca(i + 1, resto - cand[i], [...usados, cand[i]]) || busca(i + 1, resto, usados)
  }
  return busca(0, objetivo, [])
}

/**
 * @param {{plazas:number|null|undefined, snippet:string|null|undefined}} firma
 * @returns {{ok:boolean, codigo:string, motivo:string, sumandos?:number[]}}
 */
function validarFirmaDerivada(firma) {
  const plazas = firma && firma.plazas
  const snippet = (firma && firma.snippet) || ''

  if (plazas == null) {
    return { ok: false, codigo: 'sin_cifra', motivo: 'no hay cifra que derivar' }
  }
  if (!snippet.trim()) {
    // Ya lo vigila `cita_no_prueba_nada`; aquí se repite porque sin cita no hay nada que validar.
    return { ok: false, codigo: 'sin_cita', motivo: 'la firma no aporta source_snippet: no hay nada que comprobar' }
  }

  const numeros = numerosDelTexto(snippet)

  if (numeros.includes(Number(plazas))) {
    // La cita respalda la cifra DIRECTAMENTE. Se admite, y no es un caso raro: la válvula se usa para
    // dos cosas distintas y las dos son honestas.
    //   (1) «la cifra no está escrita en ninguna parte, la deduzco sumando partes» — Extremadura, Baleares.
    //   (2) «la cifra SÍ está impresa, pero nuestro extractor no la recupera» — Ayuntamiento de Madrid:
    //       el PDF del BOCM lleva el CMap roto y ni pdftotext, ni -layout, ni ghostscript sacan esa
    //       tabla; el snippet es la transcripción de lo que se lee en el PDF renderizado (cupo 100 +
    //       reserva 11 = Total 111). Ahí el problema es de extracción, no de aritmética.
    // Rechazar (2) sería un FALSO POSITIVO caro: mandaría a «corregir» una cifra que es correcta.
    return {
      ok: true,
      codigo: 'cifra_en_cita',
      motivo: `la cita respalda ${plazas} directamente (la cifra aparece en ella; típico del documento que el extractor no puede leer)`,
    }
  }

  const sumandos = sumaDeSubconjunto(Number(plazas), numeros)
  if (!sumandos) {
    return {
      ok: false,
      codigo: 'no_es_suma',
      motivo:
        `${plazas} no es la suma de ningún grupo de cifras de la cita (hay: ${[...new Set(numeros)].slice(0, 8).join(', ')}). ` +
        'Sumar partes que el documento enumera es leer; restar de un total que el documento declara es interpretar. ' +
        'Si la cifra publicada no cuadra con el boletín, lo que toca es CORREGIRLA, no derivarla',
    }
  }

  return {
    ok: true,
    codigo: 'suma_verificable',
    motivo: `${plazas} = ${sumandos.join(' + ')}, todos literales de la cita`,
    sumandos,
  }
}

module.exports = { validarFirmaDerivada, sumaDeSubconjunto, numerosDelTexto }
