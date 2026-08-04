// lib/backlog/fichasQueCitan.cjs — «esto ya lo está trabajando alguien». PURO. (T-517)
//
// ── EL HUECO QUE CIERRA ──────────────────────────────────────────────────────────────────────
// [T-516] hizo que la sesión que PIERDE una reserva se entere. Falta la otra mitad: **la que la
// coge no ve lo que ya está hecho**. El dossier vuelca la conversación, el journey y el historial
// del usuario, pero no mira el backlog — y ahí es donde vive el trabajo.
//
// Caso real (04/08): el feedback `8b788ee0` (Neus) tenía ficha viva [T-507] con el diagnóstico
// entero, el arreglo pusheado y un borrador esperando el OK de Manuel. Al soltarse la reserva,
// otra sesión lo cogió y su dossier no mencionaba nada de eso: iba a rediagnosticar desde cero
// y, peor, podía decirle a la usuaria «ya está arreglado» cuando el código no estaba desplegado.
//
// ── DECISIONES ──────────────────────────────────────────────────────────────────────────────
// · **Solo fichas VIVAS.** Una cerrada que cite el caso es historia, no contexto pendiente, y
//   llenaría el dossier de ruido — que es como se dejan de leer estos bloques.
// · **Quién está viva NO se decide aquí**: sale de `parseBacklogMarkdown`, que es la fuente única
//   del criterio (la marca ✅ manda, no la sección donde esté la ficha — [T-382]).
// · **El id corto ES la forma normal de citar** en las fichas (`8b788ee0`, no el uuid entero), así
//   que se busca por los dos, con frontera de palabra para no casar dentro de otro hash.

const { parseBacklogMarkdown } = require('./parseMarkdown.cjs')

/** Trocea el markdown en (cabecera, cuerpo) por cada `### …`. */
function bloques(md) {
  const lineas = String(md || '').split('\n')
  const out = []
  let actual = null
  for (const linea of lineas) {
    if (/^###\s+/.test(linea)) {
      if (actual) out.push(actual)
      actual = { headline: linea, cuerpo: [] }
    } else if (actual) {
      actual.cuerpo.push(linea)
    }
  }
  if (actual) out.push(actual)
  return out
}

/** Escapa lo que vaya a ir dentro de una expresión regular. */
function escapar(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Fichas VIVAS del backlog que mencionan alguno de estos identificadores.
 *
 * @param {string} md      contenido de docs/roadmap/tareas-pendientes.md
 * @param {string[]} ids   identificadores del caso (uuid entero y/o su prefijo corto)
 * @returns {Array<{id, title, headline, extracto}>}
 */
function fichasQueCitan(md, ids = []) {
  const buscables = [...new Set((ids || []).filter((x) => x && String(x).length >= 8))]
  if (!buscables.length) return []
  const re = new RegExp(`(?<![0-9a-zA-Z-])(${buscables.map(escapar).join('|')})(?![0-9a-zA-Z-])`, 'i')

  const out = []
  for (const b of bloques(md)) {
    const texto = [b.headline, ...b.cuerpo].join('\n')
    if (!re.test(texto)) continue

    // El estado (viva/cerrada) lo decide el parser compartido, no una regla propia.
    const [meta] = parseBacklogMarkdown(b.headline)
    if (!meta || !meta.declaredOpen) continue

    // Extracto: la primera línea del cuerpo que cita el caso, que es donde está el porqué.
    const cita = b.cuerpo.find((l) => re.test(l))
    out.push({
      id: meta.id,
      title: meta.title,
      headline: b.headline.replace(/^###\s+/, '').trim(),
      extracto: cita ? cita.trim().replace(/^[-*]\s*/, '').slice(0, 240) : null,
    })
  }
  return out
}

/**
 * El bloque que se imprime en el dossier. Corto: es un aviso, no un informe.
 */
function lineasDossier(fichas = []) {
  if (!fichas.length) return []
  const l = ['─── 🔗 ESTE CASO YA TIENE FICHA VIVA EN EL BACKLOG — léela ANTES de rediagnosticar ───']
  for (const f of fichas) {
    l.push(`   ${f.headline}`)
    if (f.extracto) l.push(`      ↳ ${f.extracto}`)
  }
  l.push('   Si el trabajo ya está hecho, NO lo repitas y NO prometas al usuario más de lo que diga la ficha')
  l.push('   (p. ej. «arreglado» cuando aún no se ha desplegado).')
  return l
}

module.exports = { fichasQueCitan, lineasDossier }
