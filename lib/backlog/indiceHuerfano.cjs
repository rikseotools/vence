// lib/backlog/indiceHuerfano.cjs — ¿el índice comiteado trae texto que NINGUNA ficha produce? (T-721)
//
// ── EL FALLO, MEDIDO ────────────────────────────────────────────────────────────────────────
// Desde [T-532] las fichas viven en `docs/roadmap/tareas/T-nnn.md` y
// `docs/roadmap/tareas-pendientes.md` es un ÍNDICE GENERADO. Pero **100 de las 129 ramas vivas
// con contenido propio son anteriores a ese cambio** (medido el 08/08) y editan el índice, no su
// ficha. Al mergearlas, su texto entra en un fichero generado y **la siguiente regeneración lo
// borra sin ruido**.
//
// El runbook ya avisa de los dos casos y el traicionero es el segundo: si git NO da conflicto y
// auto-fusiona, no hay nada que mirar. Pasó en 2 de las 3 ramas mergeadas el 08/08.
//
// ── POR QUÉ ESTE CRITERIO Y NO OTRO (dos mediciones descartadas) ────────────────────────────
// La ficha de [T-721] proponía avisar cuando una rama no contiene `main`. **Salta en el 99%**:
// inservible. La segunda idea —«main tocó sus ficheros después del veredicto»— salta en el 86%…
// y los 6 casos eran EL MISMO fichero, el índice. O sea que el fenómeno no era genérico: era
// éste. Un aviso que salta casi siempre no se lee (es la lección del gate de la cabecera de
// explicaciones, que fallaba en el 100% de los lotes buenos).
//
// Así que no se avisa de una SITUACIÓN sospechosa: se detecta la PÉRDIDA concreta, que solo
// existe cuando el índice trae líneas que ninguna ficha genera. Eso no salta casi nunca — y
// cuando salta, hay algo que rescatar de verdad.

/** Líneas con contenido (sin vacías) — comparar por línea, no por bloque: un merge mezcla. */
function lineasUtiles(texto) {
  return String(texto || '').split('\n').map((l) => l.trimEnd()).filter((l) => l.trim())
}

/**
 * Texto del índice comiteado que la regeneración NO reproduce, o sea, lo que se perdería.
 *
 * @param {string} indiceComiteado  `docs/roadmap/tareas-pendientes.md` tal como está en disco
 * @param {string} indiceGenerado   lo que `generarIndice()` produce hoy desde las fichas
 * @returns {{alDia:boolean, huerfanas:string[], total:number}}
 *   `huerfanas` = líneas presentes en el comiteado y ausentes del generado.
 */
function lineasHuerfanas(indiceComiteado, indiceGenerado) {
  const generadas = new Set(lineasUtiles(indiceGenerado))
  const huerfanas = lineasUtiles(indiceComiteado).filter((l) => !generadas.has(l))
  return { alDia: huerfanas.length === 0, huerfanas, total: huerfanas.length }
}

/**
 * ¿Qué fichas nombra ese texto huérfano? Es lo que necesita quien lo va a rescatar: no «hay 40
 * líneas sueltas» sino «esas 40 líneas son de T-196 y T-634, llévalas a su fichero».
 */
function fichasAfectadas(huerfanas) {
  const ids = new Set()
  for (const l of huerfanas || []) {
    // La cabecera de una ficha es la pista fuerte; si no la hay, cualquier id citado sirve de guía.
    const cab = /^###\s*\[(T-\d{1,4})\]/.exec(l)
    if (cab) { ids.add(cab[1]); continue }
    for (const m of l.matchAll(/\b(T-\d{1,4})\b/g)) ids.add(m[1])
  }
  return [...ids].sort()
}

module.exports = { lineasHuerfanas, fichasAfectadas, lineasUtiles }
