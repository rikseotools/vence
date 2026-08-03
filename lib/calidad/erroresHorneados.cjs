/**
 * erroresHorneados.cjs — una página cacheada NO puede hornear su pantalla de error. PURO.
 * (T-506, 03/08/2026)
 *
 * ── EL FALLO QUE LO MOTIVA (medido, no hipotético) ───────────────────────────────────────────
 * `components/test/TestHubPage.tsx` atrapaba el error de la consulta de temas y, en su lugar,
 * devolvía una pantalla roja: «Error cargando temas». Es un gesto que parece defensivo y en un
 * componente normal lo sería. Pero esa página declara `export const revalidate = false`, así que
 * su HTML se genera UNA vez y se sirve tal cual: un tropiezo de milisegundos en la base de datos
 * quedó **congelado como si fuera la página buena**, con `s-maxage` de un año por delante.
 *
 * Resultado real (03/08/2026): `/administrativo-estado/test` sirvió esa pantalla desde el deploy
 * de las 04:37 hasta las 22:07, con los 45 temas intactos en la base de datos todo el rato. Lo
 * descubrió un usuario premium escribiendo «No carga la página de test» (feedback `ddaa31dd`),
 * después de hora y media entrando y saliendo. Barrido de las 126 oposiciones activas: **1 rota**.
 *
 * ── POR QUÉ ES UN GUARDARRAÍL Y NO UN CONSEJO ────────────────────────────────────────────────
 * Los dos ingredientes son inocentes por separado —cachear una página es lo correcto, y capturar
 * un error también— y el daño solo aparece al juntarlos. Nadie lo va a recordar al escribir el
 * siguiente componente: por eso lo comprueba el CI y no la memoria de quien edita.
 *
 * ── QUÉ HACER EN VEZ DE CAPTURAR ─────────────────────────────────────────────────────────────
 * Dejar que reviente. En una página cacheada eso es ESTRICTAMENTE mejor en los dos momentos:
 *   · al construir la imagen → el deploy falla y nadie llega a ver una página rota;
 *   · al regenerar en caliente → Next conserva la última versión BUENA en vez de sustituirla.
 * Capturar solo gana cuando el resultado NO se cachea, que es justo cuando esto no dispara.
 *
 * La degradación SILENCIOSA cuenta igual: quedarse con la lista vacía y pintar «0 preguntas» no
 * enseña un error, enseña un dato falso — y se hornea con la misma permanencia.
 */

/**
 * ── LA EXCEPCIÓN, QUE TIENE QUE EXISTIR Y TIENE QUE ESTAR FIRMADA ────────────────────────────
 * No todo `catch` que pinta es un defecto. Cuando lo que degrada es un FRAGMENTO decorativo de
 * una página que por lo demás funciona (la cajita de estadísticas de `/leyes/[law]`), dejarlo
 * reventar tumbaría una página de mucho tráfico por un recuadro. Ahí capturar es lo correcto.
 *
 * Se admite, pero **escrita**: un comentario `erroresHorneados: excepcion — <por qué>` junto al
 * `catch`. Así la decisión queda al lado del código que la toma y se puede revisar. Un
 * guardarraíl sin salida legítima se acaba apagando entero, que es peor.
 */
const EXCEPCION = /erroresHorneados:\s*excepcion/

/** `export const revalidate = false` (o un número): la salida de esta página se cachea. */
const REVALIDATE_CACHEADO = /export\s+const\s+revalidate\s*=\s*(false|\d+)/

/** `export const dynamic = 'force-static'` — la otra forma de decir lo mismo. */
const FORCE_STATIC = /export\s+const\s+dynamic\s*=\s*['"]force-static['"]/

/**
 * Un `catch` que devuelve JSX. Solo interesa el que PINTA algo: un `catch` que registra y
 * relanza no hornea nada.
 */
const CATCH = /catch\s*(\([^)]*\))?\s*\{/g

/** ¿Este trozo de código devuelve JSX? `return (<div…` o `return <div…`. */
function devuelveJsx(cuerpo) {
  return /return\s*\(?\s*</.test(cuerpo)
}

/** Extrae el cuerpo del bloque que empieza en `desde` (índice de su `{`), con llaves balanceadas. */
function cuerpoDelBloque(codigo, desde) {
  let nivel = 0
  for (let i = desde; i < codigo.length; i++) {
    if (codigo[i] === '{') nivel++
    else if (codigo[i] === '}') {
      nivel--
      if (nivel === 0) return codigo.slice(desde, i + 1)
    }
  }
  return codigo.slice(desde) // sin cerrar: se analiza lo que hay
}

/** Nº de línea (1-indexado) del índice dado. Para que el hallazgo se pueda abrir de un clic. */
function lineaDe(codigo, indice) {
  return codigo.slice(0, indice).split('\n').length
}

/** Cuántas líneas por encima del `catch` se admite la firma de la excepción. */
const VENTANA_FIRMA = 10

/** Las `n` líneas anteriores al índice dado (incluida la suya). */
function lineasAntes(codigo, indice, n) {
  const hasta = codigo.slice(0, indice).split('\n')
  return hasta.slice(Math.max(0, hasta.length - n)).join('\n')
}

/**
 * ¿Esta fuente hornea una pantalla de error en una página cacheada?
 *
 * @param {string} ruta   ruta del fichero (solo para el informe)
 * @param {string} codigo contenido del fichero
 * @returns {{hallazgos: Array<{ruta:string, linea:number, patron:string, detalle:string}>,
 *            excepciones: Array<{ruta:string, linea:number}>}}
 */
function analizarFuente(ruta, codigo) {
  const cacheada = REVALIDATE_CACHEADO.test(codigo) || FORCE_STATIC.test(codigo)
  if (!cacheada) return { hallazgos: [], excepciones: [] }

  const hallazgos = []
  const excepciones = []
  CATCH.lastIndex = 0
  let m
  while ((m = CATCH.exec(codigo)) !== null) {
    const abre = codigo.indexOf('{', m.index)
    if (abre < 0) continue
    const cuerpo = cuerpoDelBloque(codigo, abre)
    if (!devuelveJsx(cuerpo)) continue
    // La firma vale dentro del catch o en las LÍNEAS justo anteriores (donde se explica el
    // porqué), pero NUNCA en cualquier punto del fichero: una excepción firmada arriba del todo
    // cubriría catches que nadie ha mirado. Se cuenta por líneas y no por caracteres para que el
    // margen no dependa de lo larga que sea la explicación.
    const contexto = lineasAntes(codigo, m.index, VENTANA_FIRMA) + cuerpo
    if (EXCEPCION.test(contexto)) {
      excepciones.push({ ruta, linea: lineaDe(codigo, m.index) })
      continue
    }
    hallazgos.push({
      ruta,
      linea: lineaDe(codigo, m.index),
      patron: 'catch_pinta_en_pagina_cacheada',
      detalle:
        'la salida de esta página se cachea (revalidate/force-static) y este catch devuelve JSX: ' +
        'un fallo pasajero se hornea como si fuera la página buena. Deja que reviente.',
    })
  }
  return { hallazgos, excepciones }
}

module.exports = { analizarFuente, REVALIDATE_CACHEADO, FORCE_STATIC, EXCEPCION }
