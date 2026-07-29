// lib/api/v2/dispute/shuffleReadiness.ts — la puerta que impide CERRAR una impugnación aceptada
// dejando la pregunta sin adaptar al formato barajable.
//
// ## Por qué esto es una PUERTA y no otro aviso
//
// El manual de impugnaciones manda, al coger una impugnación, evaluar SIEMPRE si la explicación es
// mejorable y dejarla en formato estructurado (§5.1 + Fase 2 de T-080). Hasta el 29/07/2026 eso
// dependía por completo de que quien la trabajase se acordara, porque las tres piezas del flujo solo
// AVISAN:
//
//   · el dossier IMPRIME «(a) ¿la explicación tiene formato §5.1? → 🔴 NO» entre otras diez líneas;
//   · `validar-explicacion.cjs` dice literalmente «AVISO (no bloquea)» — y además solo entiende el
//     formato de TEXTO antiguo, así que ante una explicación ya estructurada devuelve ❌ y confunde;
//   · `/api/v2/dispute/resolve` no miraba nada: se podía cerrar dejando la pregunta sin barajar.
//
// Es el mismo razonamiento que llevó al backlog a que el reloj IMPIDA coger en vez de avisar
// (runbook de tareas, 29/07): un aviso impreso entre otras diez líneas no es una condición.
//
// ## Qué exige, y qué NO
//
// Exige lo MÍNIMO comprobable: que la pregunta tenga `explanation_data`, es decir, que la explicación
// esté en la estructura desde la que produccón renderiza. NO exige que `shuffle_safety` sea `safe`:
// hay preguntas legítimamente no barajables (opciones que se citan entre sí, «todas las anteriores»),
// y confundir «no adaptada» con «no barajable» convertiría la puerta en un estorbo que todo el mundo
// saltaría — que es justo como mueren los guardarraíles.
//
// Solo se aplica a:
//   · impugnaciones LEGISLATIVAS (las psicotécnicas no tienen explicación estructurada), y
//   · cierres en `resolved` (aceptamos que había algo que arreglar). Un `rejected` no toca la
//     pregunta, así que no hay nada que adaptar.
//
// ## El escape, con rastro
//
// Como el `BACKLOG_GUARD_SKIP=1` del pre-push: hay salida legítima (`skipShuffleCheck` con motivo),
// y queda registrada. Un guardarraíl sin escape se acaba desactivando entero.

export type PreparacionBarajado =
  | { ok: true; saltado: false }
  | { ok: true; saltado: true; motivo: string }
  | { ok: false; error: string }

export function evaluarPreparacionBarajado(params: {
  questionType: string
  status: string
  /** `explanation_data` de la pregunta (null = nunca se transcribió al formato estructurado). */
  explanationData: unknown
  /** Motivo declarado para saltarse la puerta. Vacío/ausente = no se salta. */
  skipReason?: string | null
}): PreparacionBarajado {
  const { questionType, status, explanationData, skipReason } = params

  // Fuera de alcance: no es una impugnación de pregunta legislativa aceptada.
  if (questionType !== 'legislative' || status !== 'resolved') return { ok: true, saltado: false }

  const tieneEstructura =
    explanationData !== null &&
    explanationData !== undefined &&
    typeof explanationData === 'object' &&
    Object.keys(explanationData as Record<string, unknown>).length > 0

  if (tieneEstructura) return { ok: true, saltado: false }

  const motivo = String(skipReason ?? '').trim()
  if (motivo.length >= 10) return { ok: true, saltado: true, motivo }

  return {
    ok: false,
    error:
      'No se puede cerrar como resuelta: la pregunta sigue SIN explicación estructurada, así que no ' +
      'podrá barajar sus opciones. El manual pide evaluar SIEMPRE la explicación al trabajar una ' +
      'impugnación y dejarla en formato barajable. Escríbela con ' +
      '`npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts <question_id> <fichero.json> --apply` ' +
      'y vuelve a cerrar. Si de verdad no procede tocarla, repite la llamada con ' +
      '`skipShuffleReason` explicando por qué (queda registrado).',
  }
}
