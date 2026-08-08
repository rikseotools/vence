'use strict'
// lib/backlog/dividirFichas.cjs — descompone `tareas-pendientes.md` en bloques, SIN PERDER NADA. [T-532]
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
//
// Es el primer paso de «una ficha = un fichero»: antes de escribir 603 ficheros nuevos hace falta
// una función PURA que sepa partir el monolito en piezas, y que se pueda demostrar —con un test,
// no de vista— que la SUMA de esas piezas reproduce el original BYTE A BYTE. Sin esa garantía, la
// migración es exactamente el mismo riesgo que esta tarea existe para eliminar: perder contenido
// en silencio.
//
// ── LOS CUATRO TIPOS DE BLOQUE, MEDIDOS CONTRA EL FICHERO REAL (07/08) ──────────────────────────
//
//   · preambulo        — todo lo que hay ANTES del primer `###`/`##`. Instrucciones de uso, fijo.
//   · ficha             — un bloque `### [T-nnn] …` hasta el siguiente `###`/`##`. 603 en el
//                          fichero real, todos con id ÚNICO (comprobado con la MISMA regex que usa
//                          `insertarFicha.cjs`, no con un grep ingenuo — un grep con `.*` codicioso
//                          da 8 «duplicados» falsos porque los títulos citan otras tareas).
//   · marcador_seccion  — una línea EXACTA `## Abiertas` o `## Hechas`, sin cuerpo propio. Hay
//                          CUATRO en el fichero real (1 Abiertas + 3 Hechas — el fichero ha
//                          acumulado varias secciones "## Hechas" con los años). Se DESCARTAN a
//                          propósito: la sección deja de ser una posición física y pasa a
//                          derivarse del ✅ de la cabecera, así que el marcador no tiene trabajo
//                          que hacer.
//   · suelto            — cualquier otro `##` (encabezado real de nivel 2, no `###`) con cuerpo
//                          propio, que NO es un marcador de sección. Hay SEIS en el fichero real
//                          (p.ej. «## Importar contenido para cerrar residuo CE-relink») — texto
//                          real, escrito por una sesión, que nunca tuvo un id `T-nnn`. Perderlo
//                          sería repetir exactamente el daño que esta tarea ataca. Se preservan
//                          aparte, con su propio fichero de cuarentena para que alguien los
//                          convierta en ficha o decida que ya no hacen falta — NUNCA se adivina.
//
// ── LA GARANTÍA ──────────────────────────────────────────────────────────────────────────────
//
// `dividirEnBloques(md).map(b => b.texto).join('')` === `md`. Byte a byte, SIN excepción — ni
// siquiera para los marcadores de sección: se descartan en la REGENERACIÓN (`generarIndice.cjs`),
// no aquí. Esta función no decide qué se guarda; solo describe con precisión lo que hay. Lo
// verifica su propio test, y lo vuelve a verificar el script de migración antes de escribir un
// solo fichero.

/** Cabecera de ficha: `### [T-042] …`. MISMA regex que `insertarFicha.cjs` (lazy: coge el
 *  PRIMER id, no el último — los títulos citan otras tareas con normalidad). */
const RE_FICHA = /^###\s+.*?\[(T-\d+)\]/

/** Encabezado de nivel 2 real (no un `###`/`####`…). */
function esNivel2(linea) {
  return /^##\s/.test(linea) && !/^###/.test(linea)
}

/** ¿Es EXACTAMENTE uno de los dos marcadores de sección que el sistema entiende? Coincidencia de
 *  línea completa (sin espacios de sobra), igual que `insertarFicha.cjs`. */
function esMarcadorSeccion(linea) {
  const t = linea.trim()
  return t === '## Abiertas' || t === '## Hechas'
}

/**
 * Parte `md` en bloques ORDENADOS tal y como aparecen en el fichero. No reordena, no descarta,
 * no interpreta — eso es trabajo de quien consuma esta salida.
 *
 * @param {string} md
 * @returns {Array<{tipo: 'preambulo'|'ficha'|'marcador_seccion'|'suelto', id?: string, texto: string}>}
 */
function dividirEnBloques(md) {
  const texto = String(md ?? '')
  // split con capturing group conserva el separador (\n) en el array — reconstruir con join('')
  // (no join('\n')) es lo que mantiene la garantía byte a byte.
  const lineas = texto.split(/(\n)/)

  // Reagrupar en «líneas lógicas» (contenido + su salto de línea, si lo tenía).
  const filas = []
  for (let i = 0; i < lineas.length; i += 2) {
    filas.push(lineas[i] + (lineas[i + 1] ?? ''))
  }

  const inicios = [] // índices de fila donde arranca un bloque (ficha o nivel2)
  for (let i = 0; i < filas.length; i++) {
    const contenido = filas[i].replace(/\n$/, '')
    if (RE_FICHA.test(contenido) || esNivel2(contenido)) inicios.push(i)
  }

  const bloques = []
  if (inicios.length === 0) {
    // Fichero sin ninguna cabecera reconocible: todo es preámbulo. Caso límite, no el real, pero
    // que no reviente si algún día se prueba contra un fichero vacío o distinto.
    if (filas.length) bloques.push({ tipo: 'preambulo', texto: filas.join('') })
    return bloques
  }

  if (inicios[0] > 0) {
    bloques.push({ tipo: 'preambulo', texto: filas.slice(0, inicios[0]).join('') })
  }

  for (let k = 0; k < inicios.length; k++) {
    const desde = inicios[k]
    const hasta = k + 1 < inicios.length ? inicios[k + 1] : filas.length
    const cuerpo = filas.slice(desde, hasta).join('')
    const primeraLinea = filas[desde].replace(/\n$/, '')

    const mFicha = RE_FICHA.exec(primeraLinea)
    if (mFicha) {
      bloques.push({ tipo: 'ficha', id: mFicha[1], texto: cuerpo })
    } else if (esMarcadorSeccion(primeraLinea)) {
      bloques.push({ tipo: 'marcador_seccion', texto: cuerpo })
    } else {
      bloques.push({ tipo: 'suelto', texto: cuerpo })
    }
  }

  return bloques
}

/** Reconstruye el markdown original a partir de los bloques. La prueba de que no se perdió nada. */
function reconstruir(bloques) {
  return (bloques || []).map((b) => b.texto).join('')
}

/** Ids de ficha encontrados, en orden de aparición. Lanza si hay un id repetido: eso es un dato
 *  real del fichero (ver cabecera) y hay que verlo ANTES de escribir ficheros, no después. */
function idsFicha(bloques) {
  const out = []
  const vistos = new Set()
  for (const b of bloques || []) {
    if (b.tipo !== 'ficha') continue
    if (vistos.has(b.id)) throw new Error(`id duplicado en el fichero: ${b.id} — la migración no puede decidir por su cuenta cuál es la buena`)
    vistos.add(b.id)
    out.push(b.id)
  }
  return out
}

module.exports = { dividirEnBloques, reconstruir, idsFicha, RE_FICHA, esNivel2, esMarcadorSeccion }
