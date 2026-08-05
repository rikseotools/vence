// lib/impugnaciones/borradorAbierto.cjs — «este caso ya tiene borrador esperando OK». (T-588)
//
// ── EL HUECO QUE CIERRA ──────────────────────────────────────────────────────────────────────
// `cola.cjs next` reparte la impugnación más antigua LIBRE, pero libre solo mira `claimed_by`.
// El ciclo normal del manual es: coge → analiza → escribe borrador → LIBERA la fila (nunca se
// cierra sin OK de Manuel) → la fila vuelve a estar "libre" y sigue siendo la más antigua → la
// siguiente sesión que pide trabajo se la lleva otra vez, sin saber que ya hay un borrador
// esperando aprobación en el embudo (`session_questions`).
//
// MEDIDO el 05/08/2026 sobre la impugnación 2477d39d (Outlook, Ctrl+Mayús+K vs Ctrl+T): CUATRO
// sesiones distintas la analizaron de forma independiente en 2h26min, cada una con su propia
// verificación WebFetch contra la misma fuente oficial, y dejaron TRES borradores simultáneos
// (`#21`, `#39`, `#72`) con el mismo veredicto. Ficha [T-588].
//
// ── DECISIÓN ────────────────────────────────────────────────────────────────────────────────
// **Avisa, no bloquea** (coherente con el resto del sistema: "avisar ≠ bloquear", igual que
// `fichasQueCitan.cjs`/[T-517]). La sesión decide si el borrador ya cubre el caso o si aporta algo
// nuevo (una hermana no vista, un matiz). El `draft_target` es texto libre (no hay columna
// estructurada `dispute_id`), así que se busca por substring del id — igual de frágil que
// `fichasQueCitan.cjs`, y por eso exige el mismo mínimo de longitud para no casar con cualquier cosa.

/** Escapa lo que vaya a ir dentro de una expresión regular. */
function escapar(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Filtra, de una lista de filas `session_questions` (kind='borrador'), las que citan este
 * dispute id — por el uuid entero o por su prefijo corto (8 caracteres), con frontera para no
 * casar dentro de otro hash.
 *
 * @param {Array<{id, sid, status, draft_target, asked_at}>} filas  ya filtradas por kind='borrador'
 * @param {string} disputeId  uuid completo de la impugnación
 * @returns {Array<{id, sid, status, draft_target, asked_at}>}
 */
function borradoresQueCitan(filas, disputeId) {
  const idCorto = String(disputeId || '').slice(0, 8)
  const buscables = [...new Set([disputeId, idCorto].filter((x) => x && String(x).length >= 8))]
  if (!buscables.length) return []
  const re = new RegExp(`(?<![0-9a-zA-Z-])(${buscables.map(escapar).join('|')})(?![0-9a-zA-Z-])`, 'i')
  return (filas || []).filter((f) => f.status === 'open' && re.test(String(f.draft_target || '')))
}

/**
 * El bloque que se imprime en el dossier / al repartir. Corto: es un aviso, no un informe.
 */
function lineasBorradorAbierto(borradores = []) {
  if (!borradores.length) return []
  const plural = borradores.length > 1
  const l = [
    `─── 📝 YA HAY ${borradores.length} BORRADOR${plural ? 'ES' : ''} ABIERTO${plural ? 'S' : ''} EN EL EMBUDO PARA ESTE CASO ───`,
  ]
  for (const b of borradores) {
    l.push(`   #${b.id} (sesión ${String(b.sid).slice(0, 12)}…, hace ${horasDesde(b.asked_at)}h)`)
  }
  l.push('   Léelo antes de rediagnosticar: si ya cubre el caso, NO escribas otro — libera la fila.')
  if (plural) l.push('   Son duplicados del mismo trabajo (ficha [T-588]): no añadas un cuarto.')
  return l
}

function horasDesde(t) {
  if (!t) return '?'
  const ms = Date.now() - new Date(t).getTime()
  return Math.max(0, Math.round(ms / 3600000))
}

module.exports = { borradoresQueCitan, lineasBorradorAbierto }
