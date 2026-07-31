// lib/observability/friccionSesiones.cjs — medir lo que cuesta trabajar en paralelo. (T-423)
//
// ── LO QUE NO SE VEÍA ────────────────────────────────────────────────────────────────────────
// El 31/07 se construyeron seis piezas para que 2-10 sesiones no se pisen (claim, latido, huella,
// reserva de la cola, árbol de deploy propio, índice no compartido). Todas contestan la pregunta
// «¿qué pasa AHORA?». **Ninguna deja serie temporal**, así que no se puede contestar:
//
//   · ¿la fricción entre sesiones sube o baja esta semana?
//   · ¿cuánto se pierde esperando el lock de deploy?
//   · ¿con qué frecuencia una sesión le roba la tarea a otra por lease vencido?
//   · y sobre todo: **¿cuántas veces se está RODEANDO un guardarraíl?**
//
// ── LA SEÑAL QUE MÁS IMPORTA ES EL ESCAPE, NO EL BLOQUEO ─────────────────────────────────────
// Un guardarraíl que se salta de forma sistemática **está muerto y nadie se ha enterado**: sigue
// dando la lata, ya no protege, y encima da la falsa sensación de que el hueco está cubierto. El
// 31/07 murieron tres exactamente así — el aviso que gritaba en falso hasta que se ignoró, el
// bloqueo imposible de satisfacer que enseñaba a apagar el guard entero, y el escape general que
// se volvió rutina. Los tres se descubrieron por casualidad, no por un dato.
//
// El ratio de escape es un **indicador ADELANTADO**: se ve subir antes de que el guardarraíl deje
// de servir. Por eso lo caro no es contar bloqueos —eso solo dice que el guard trabaja— sino
// contar cuántos de esos bloqueos acabaron rodeados.
//
// Emitir es SIEMPRE best-effort: esto vive dentro de hooks de git. Una avería del bus de
// observabilidad no puede impedirle a nadie commitear ni pushear.

const EVENT_TYPE = 'sesion_friccion'

/** Lo que se mide. Cerrado a propósito: un catálogo abierto acaba siendo texto libre sin agregar. */
const CLASES = {
  guard_bloqueo: 'un guardarraíl paró a una sesión',
  guard_escape: 'una sesión rodeó un guardarraíl con su escape',
  lease_robado: 'una sesión se llevó una tarea cuyo lease había vencido',
  deploy_espera: 'una sesión esperó al lock de deploy',
  indice_compartido: 'dos o más sesiones trabajando en el mismo directorio',
  // T-431. Es fricción del mismo tipo, pero de la que solo se ve DESPUÉS: la sesión ya no está
  // para contarlo y su trabajo sigue ahí. Va en este catálogo y no en un evento propio porque la
  // pregunta que contesta es la misma —¿cuánto nos cuesta trabajar en paralelo?— y porque el
  // ratio de escape necesita que bloqueos y rodeos vivan juntos.
  trabajo_huerfano: 'un worktree abandonado guarda trabajo que no existe en ningún otro sitio',
}

const esClase = (c) => Object.prototype.hasOwnProperty.call(CLASES, c)

/**
 * Ratio de escape por guardarraíl: de las veces que paró, ¿cuántas se rodearon?
 *
 * @param eventos  [{ clase, guard }]
 * @returns Array<{ guard, bloqueos, escapes, ratio, veredicto }> ordenado por ratio desc.
 *
 * Bandas, y el corte no es arbitrario:
 *  · `sano`      — se rodea menos de 1 de cada 4. El escape hace de válvula, que es su función.
 *  · `erosion`   — entre 1/4 y 2/3. El guardarraíl estorba más de lo que protege: hay que mirar
 *                  QUÉ caso lo dispara, porque casi seguro hay uno legítimo sin contemplar.
 *  · `muerto`    — se rodea 2 de cada 3 veces o más. Ya no protege: es un peaje. O se arregla el
 *                  criterio o se quita, pero dejarlo así es lo peor de los dos mundos.
 *
 * Con pocos datos NO opina (`sin_datos`): declarar muerto un guardarraíl por 1 escape de 1
 * bloqueo sería el mismo error que este módulo existe para cazar.
 */
function ratioEscape(eventos, { minimo = 4 } = {}) {
  const por = new Map()
  for (const e of eventos || []) {
    if (!e || !e.guard) continue
    if (e.clase !== 'guard_bloqueo' && e.clase !== 'guard_escape') continue
    if (!por.has(e.guard)) por.set(e.guard, { guard: e.guard, bloqueos: 0, escapes: 0 })
    por.get(e.guard)[e.clase === 'guard_escape' ? 'escapes' : 'bloqueos']++
  }
  return [...por.values()]
    .map((g) => {
      const total = g.bloqueos + g.escapes
      const ratio = total ? g.escapes / total : 0
      const veredicto = total < minimo ? 'sin_datos'
        : ratio >= 2 / 3 ? 'muerto'
        : ratio >= 0.25 ? 'erosion'
        : 'sano'
      return { ...g, total, ratio: Math.round(ratio * 100) / 100, veredicto }
    })
    .sort((a, b) => b.ratio - a.ratio || b.total - a.total)
}

/** Frase para el informe: dice qué hacer, no solo qué pasa. */
function diagnostico(g) {
  const pct = Math.round(g.ratio * 100)
  switch (g.veredicto) {
    case 'muerto': return `🔴 ${g.guard}: rodeado el ${pct}% (${g.escapes}/${g.total}). YA NO PROTEGE — arregla el criterio o quítalo.`
    case 'erosion': return `🟠 ${g.guard}: rodeado el ${pct}% (${g.escapes}/${g.total}). Mira QUÉ caso legítimo no contempla.`
    case 'sano': return `🟢 ${g.guard}: rodeado el ${pct}% (${g.escapes}/${g.total}). El escape hace de válvula.`
    default: return `⚪ ${g.guard}: solo ${g.total} evento(s), aún no dice nada.`
  }
}

/** Segundos perdidos esperando el lock de deploy, que es tiempo de sesión tirado. */
function esperaDeploy(eventos) {
  const esperas = (eventos || []).filter((e) => e && e.clase === 'deploy_espera' && Number(e.segundos) > 0)
  const total = esperas.reduce((a, e) => a + Number(e.segundos), 0)
  return { veces: esperas.length, segundos: total, minutos: Math.round(total / 60) }
}

module.exports = { EVENT_TYPE, CLASES, esClase, ratioEscape, diagnostico, esperaDeploy }
