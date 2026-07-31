// lib/backlog/parseMarkdown.cjs — parseo PURO de las cabeceras de `docs/roadmap/tareas-pendientes.md`.
//
// FUENTE ÚNICA. Hasta el 31/07 este parseo estaba escrito DOS veces —`parseMd()` en
// scripts/backlog.cjs y `parseBacklogMarkdown()` en lib/backlog/claim.ts— con criterios que ya
// habían empezado a divergir (el default de prioridad, el tratamiento de ⬜). Dos lectores del
// mismo fichero que no coinciden en qué está abierto es exactamente el fallo que este subsistema
// existe para evitar. `.cjs` a propósito: lo requieren tanto `scripts/backlog.cjs` (node pelado,
// sin TS) como `lib/backlog/claim.ts`, así que no hay copia que se desincronice.
//
// ── QUÉ CUENTA COMO "ABIERTA" (cambio del 31/07, T-382) ─────────────────────────────────────
// Antes se deducía de la POSICIÓN: una ficha estaba abierta si caía entre `## Abiertas` y el
// siguiente `##`. Medido el 31/07 sobre el fichero real: **145 de las 177 tareas VIVAS quedaban
// fuera**, porque el markdown tiene tres secciones `## Hechas` y varias `##` sueltas, y las
// fichas se escriben donde cabe. Consecuencias, todas reales:
//
//   · `sync` daba por cerradas esas 145 y NO reconciliaba su título ni su prioridad (por eso
//     hubo que corregir a mano el título de T-067 en la BD).
//   · Peor: el guardarraíl anti-colisión de `sync` —el que impide pisarle la ficha a otra sesión,
//     nacido del incidente T-225— solo consultaba los ids "abiertos", o sea **32 de 177**. El
//     82% del backlog estaba fuera de la protección sin que nadie lo supiera.
//   · Y `findBacklogDrift()` no podía delatar una ficha desfasada, que es su único trabajo.
//
// Ahora lo declara la CABECERA, no el orden: `✅` = hecha. Es la convención que el fichero ya
// usaba (191 cabeceras la llevan) y es la que un humano escribe al cerrar. Medido contra la BD:
// de las 191 con ✅ solo UNA seguía viva, y de las 193 sin ✅ solo 17 estaban cerradas — y esas
// 18 discrepancias no son ruido del criterio, son **deriva real** que ahora sí se puede ver.
//
// Se descartó a propósito ampliar la marca a la primera etiqueta (`[HECHA …]`, `[CERRADA …]`):
// habría acertado 8 casos más pero fallado uno en la dirección PELIGROSA — la ficha viva
// «[HECHO 24/07 — quedan 3 follow-ups pequeños]» pasaría por cerrada, que es justo el daño que
// esta tarea repara. Una convención que se hace cumplir vale más que un heurístico que adivina;
// las 8 cabeceras que decían HECHA sin ✅ se corrigieron, y un guardarraíl impide que vuelvan.

const EMOJI_TO_PRIORITY = { '🔴': 'critica', '🟠': 'alta', '🟡': 'media', '🟢': 'baja' }

/** Palabras de cierre que NO valen como marca: si la cabecera dice esto, tiene que llevar ✅. */
const RE_CIERRE_SIN_TICK = /^\s*\[\s*(HECHA|HECHO|HECHAS|CERRADA|CERRADO|RESUELTA|RESUELTO|DESCARTADA|CANCELADA)\b/i

/**
 * Extrae las tareas de `tareas-pendientes.md`.
 * Formato de cabecera esperado: `### [T-042] 🔴 Título…`
 * (el emoji de prioridad puede ir antes o después del id; se acepta cualquiera de los dos).
 *
 * @returns Array<{ id, title, priority, declaredOpen, doneMarked, parked, headline }>
 */
function parseBacklogMarkdown(md) {
  const out = []
  for (const line of String(md || '').split('\n')) {
    const h3 = /^###\s+(.*)$/.exec(line)
    if (!h3) continue
    const rest = h3[1]
    const idM = /\[(T-\d+)\]/.exec(rest)
    if (!idM) continue                       // cabecera sin id → la caza el guardarraíl
    const emoji = Object.keys(EMOJI_TO_PRIORITY).find((e) => rest.includes(e))
    const title = rest
      .replace(/\[(T-\d+)\]/, '')
      .replace(/[🔴🟠🟡🟢✅⬜]/g, '')
      .replace(/^\s*\[[^\]]*\]\s*/, '')      // etiquetas tipo [ABIERTO 19/07]
      .trim()
    const doneMarked = rest.includes('✅')
    out.push({
      id: idM[1],
      title,
      priority: emoji ? EMOJI_TO_PRIORITY[emoji] : null,
      // La ficha se declara abierta salvo que su cabecera diga lo contrario. El ORDEN de las
      // secciones no participa: ver la cabecera de este fichero.
      declaredOpen: !doneMarked,
      doneMarked,
      parked: rest.includes('⬜'),
      headline: rest,
    })
  }
  return out
}

/**
 * Cabeceras que ANUNCIAN cierre en su etiqueta pero no llevan ✅ (o al revés).
 *
 * Es lo que sostiene el criterio de arriba: el parser mira una sola marca, así que la marca
 * tiene que ser fiable. Sin esto, escribir `[HECHA 31/07]` sin el ✅ deja la tarea contada como
 * abierta para siempre y en silencio — que es la deriva de la que nace T-382, solo que al revés.
 */
function findMarcaIncoherente(tasks) {
  const out = []
  for (const t of tasks || []) {
    const tag = String(t.headline || '').replace(/\[(T-\d+)\]/, '').replace(/[🔴🟠🟡🟢✅⬜]/g, '')
    const anunciaCierre = RE_CIERRE_SIN_TICK.test(tag)
    if (anunciaCierre && !t.doneMarked) {
      out.push({ id: t.id, motivo: 'la etiqueta anuncia cierre pero falta el ✅', headline: t.headline })
    }
  }
  return out
}

module.exports = { parseBacklogMarkdown, findMarcaIncoherente, EMOJI_TO_PRIORITY }
