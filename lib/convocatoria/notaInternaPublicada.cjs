'use strict'
/**
 * Una NOTA INTERNA nuestra colada en un campo que la landing PUBLICA. [T-435]
 *
 * ## El caso, medido el 31/07/2026
 *
 * `celador-sermas-madrid` servía esto en el hero de su landing, a la vista de cualquiera:
 *
 *   «📋 ⚠️ SIN VERIFICAR: la fila afirma 688 plazas (52 discapacidad) citando "BOCM núm. 158/2025".
 *    Comprobado el sumario de ese boletín: la palabra "Celador" NO aparece NI UNA VEZ…»
 *
 * Alguien usó `boe_reference` como bloc de notas de una auditoría. El campo se PINTA —en el hero y
 * en el subtítulo del botón «Ver convocatoria en …»—, así que el opositor leía que dudamos de
 * nuestra propia cifra. Barrido: **4 landings activas** en ese estado, más una docena de filas
 * catalogadas con rastro de la herramienta que las descubrió («Catalogada … via Capa 3 competidores
 * (oposiciones.es)»), que además nombra a un competidor en nuestra propia página.
 *
 * Y la nota del Celador era **falsa**: quien la escribió miró el SUMARIO del boletín y la entrada
 * contigua. El documento correcto (BOCM-20250704-15, que el propio `programa_url` ya enlazaba) es la
 * convocatoria del Grupo E del SERMAS, y su Anexo I dice «CELADOR/A · TOTAL 740 · CUPO GRAL. 688 ·
 * CUPO DISCAP. 52» — es decir, nuestros datos eran correctos. Se publicaba una duda inventada.
 *
 * ## Por qué esto NO marca la referencia larga, que es la tentación obvia
 *
 * Calibrado sobre las **119 landings activas** con referencia: la mediana son **210 caracteres** y
 * el p90 son **599**. Pegar la cita literal del boletín en `boe_reference` es la CONVENCIÓN de la
 * casa, no un descuido — marcarla daría ~60-90 hallazgos y el badge se dejaría de leer en una
 * semana, que es como han muerto aquí otros avisos. Este detector solo habla cuando hay una marca
 * inequívoca de que el texto **no estaba escrito para el usuario**.
 *
 * (Que el hero pinte un párrafo de 800 caracteres es un problema de PRODUCTO distinto, y se decide
 * aparte: cambiarlo toca 119 landings.)
 */

/**
 * Marcas de «esto no se escribió para el opositor». Cada familia sale de casos REALES del banco.
 * El orden importa: se devuelve la primera que coincide, de más grave a menos.
 */
const FAMILIAS = [
  {
    tipo: 'duda_publicada',
    // Lo más grave: le estamos diciendo al usuario que no nos fiamos de nuestro propio dato.
    //
    // Insensible a mayúsculas a propósito. La tentación es exigirlas («SIN VERIFICAR» gritado es
    // inequívocamente una nota), pero el mismo desliz aparece en minúsculas —«(sin verificar -
    // fuente competidor)»— y la frontera que de verdad importa no es el tono sino el VERBO:
    // «pendiente de PUBLICAR» describe el proceso y es información para el opositor; «pendiente de
    // VERIFICAR» confiesa que no hemos comprobado lo que estamos afirmando. Solo la segunda entra.
    re: /\bsin verificar\b|\bno verificable\b|\bno verificad[oa]\b|\bsin confirmar\b|\bpendientes? de verificar\b/i,
  },
  {
    tipo: 'rastro_herramienta',
    // Provenance de la máquina que lo descubrió. Incluye el nombre de competidores, que es lo
    // último que debería aparecer en nuestra landing.
    re: /\bvia Capa \d|\bsitemap-coverage\b|\bfuente competidor\b|\bcompetidores\b|\boposiciones\.es\b|\bopositatest\b|\bgokoan\b|\bopositas\b/i,
  },
  {
    tipo: 'nota_tecnica',
    // Marcas de trabajo pendiente escritas en el campo en vez de en su sitio.
    re: /\bTODO:|\bFIXME\b|\bREVISAR:|\bOJO:|\bXXX\b|pendiente de identificar|falta identificar|sin identificar|\bno\s+(?:está|estan|están)\s+verificad[oa]s?\b/i,
  },
  {
    tipo: 'aviso_visual',
    // El emoji de aviso EN CUALQUIER SITIO del valor.
    //
    // La primera versión solo lo miraba al principio, razonando que una cita del boletín podría
    // llevar un emoji suelto. Medido sobre el banco: falso. La forma REAL del defecto es «cita
    // legítima + ⚠️ nota interna pegada al final» —tres de los seis casos publicados— y anclarlo
    // al principio dejaba escapar `auxiliar-administrativo-cantabria`, cuyo ⚠️ abre la última
    // frase. Cero falsos positivos en 2.658 filas.
    re: /(⚠️?|🔴|❗|❌)/u,
  },
]

/** Los marcadores por los que se PARTE el valor: delante queda lo publicable, detrás la nota. */
const CORTES = /(⚠️?|🔴|❗|❌|\bTODO:|\bFIXME\b|\bREVISAR:|\bOJO:)/u

/** Campos que la landing PUBLICA y que son de REFERENCIA (no de prosa libre). */
const CAMPOS_PUBLICADOS = ['boe_reference', 'diario_referencia', 'convocatoria_numero', 'oep_decreto']

/**
 * ¿Este valor es una nota interna publicada?
 * @param {string|null|undefined} valor
 * @returns {{esNota: boolean, tipo: string|null}}
 */
function clasificarValor(valor) {
  if (typeof valor !== 'string' || !valor.trim()) return { esNota: false, tipo: null }
  for (const f of FAMILIAS) if (f.re.test(valor)) return { esNota: true, tipo: f.tipo }
  return { esNota: false, tipo: null }
}

/**
 * Parte el valor en lo que SE PUEDE PUBLICAR y la nota interna que hay detrás.
 *
 * ## Por qué se PARTE y no se ADIVINA (corregido tras medir)
 *
 * La primera versión intentaba **extraer** la referencia buscando un localizador dentro del texto.
 * Sobre el caso real del Celador devolvió **`BOCM-20250704-16`**, que es el documento EQUIVOCADO:
 * la nota cita esa entrada precisamente para decir que NO es la buena (la correcta es la `-15`).
 * O sea, la heurística proponía escribir en producción una referencia oficial errónea. Se quitó.
 *
 * Lo que sí es seguro es partir: medido sobre el banco, la forma del defecto es **cita legítima +
 * marcador + nota interna**, así que el texto ANTERIOR al marcador ya estaba escrito para el
 * usuario y se conserva tal cual. Si el valor **empieza** por el marcador no hay nada publicable
 * que rescatar, y entonces `limpio` es `null`: la referencia la pone una persona que haya abierto
 * el boletín. Adivinar un localizador oficial es justo lo que no se puede hacer aquí.
 *
 * @param {string} valor
 * @returns {{limpio: string|null, nota: string|null}}
 */
function partirNota(valor) {
  if (typeof valor !== 'string' || !valor.trim()) return { limpio: null, nota: null }
  const m = valor.match(CORTES)
  if (!m || m.index == null) {
    // Marcado por texto (p. ej. «sin verificar» sin emoji): no hay punto de corte fiable, así que
    // no se propone recorte automático — la revisa una persona.
    return { limpio: null, nota: valor.trim() }
  }
  const limpio = valor.slice(0, m.index).trim().replace(/[\s,;·—-]+$/, '')
  const nota = valor.slice(m.index).trim()
  return { limpio: limpio || null, nota: nota || null }
}

/**
 * Clasifica una fila servida. `error` solo si la oposición está PUBLICADA: en una catalogada el
 * texto existe pero no lo lee nadie, y mezclar las dos gasta el aviso.
 * @param {{slug: string, isActive: boolean, campos: Record<string,string|null>}} fila
 */
function clasificarFila(fila) {
  if (!fila || typeof fila.slug !== 'string' || !fila.slug) {
    throw new TypeError('clasificarFila: hace falta un slug')
  }
  const hallazgos = []
  for (const campo of CAMPOS_PUBLICADOS) {
    const valor = (fila.campos || {})[campo]
    const { esNota, tipo } = clasificarValor(valor)
    if (!esNota) continue
    hallazgos.push({
      slug: fila.slug,
      campo,
      tipo,
      severity: fila.isActive ? 'error' : 'warn',
      publicada: !!fila.isActive,
      // Lo publicable que se conserva y la nota que se muda; `limpio: null` = la pone una persona.
      ...partirNota(valor),
      extracto: String(valor).slice(0, 200),
    })
  }
  return hallazgos
}

/** @param {Array<{slug: string, isActive: boolean, campos: Record<string,string|null>}>} filas */
function clasificarLote(filas) {
  const todos = (filas || []).flatMap(clasificarFila)
  return {
    todos,
    publicadas: todos.filter((h) => h.publicada),
    catalogadas: todos.filter((h) => !h.publicada),
  }
}

module.exports = {
  clasificarValor,
  clasificarFila,
  clasificarLote,
  partirNota,
  CAMPOS_PUBLICADOS,
  FAMILIAS,
}
