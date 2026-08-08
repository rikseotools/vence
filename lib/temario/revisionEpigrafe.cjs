'use strict'
/**
 * revisionEpigrafe.cjs — ¿se puede responder YA a una queja de temario, o hay que poner antes en
 * orden la BD de esa oposición?
 *
 * ## Qué añade a lo que ya había
 *
 * `scope-enforcement.cjs` (24/07) detecta que la queja va de temario e imprime un 🛑 cuando el
 * Paso 1 está `never_sourced`. Es un AVISO, mira la oposición ENTERA, y solo mira el Paso 1. Los
 * tres límites se pagaron el 04/08/2026 resolviendo la impugnación `0b9d9f56`:
 *
 * 1. **Avisar no basta.** El 🛑 salió, se leyó, y se siguió adelante igual. El manual lleva desde
 *    julio diciendo «Paso 1 bloqueante» y el estado medido dice otra cosa.
 * 2. **Bloquear la oposición entera es un bloqueo imposible** (principio 5 del runbook de sesiones
 *    paralelas). El aviso pedía clonar los epígrafes de los 21 temas para poder contestar a una
 *    persona que preguntaba por UN artículo. Un bloqueo que no se puede satisfacer en el momento
 *    es un bloqueo que se aprende a rodear. Aquí se exige **solo el tema o temas que sirven la
 *    pregunta impugnada**: uno o dos, y se clonan en minutos.
 * 3. **`verified_correct` puede ser mentira, y era el dato en el que uno se apoyaba.** El Paso 2
 *    de esa oposición estaba verde en sus 21 temas… sellado en un mismo segundo por
 *    `verified_by='claude_direct'` con `agent_run_id='--run'` (el id era el propio flag, mal
 *    pasado) y la misma nota copiada tema a tema. Es decir: el pipeline de dos agentes que exige
 *    el runbook no llegó a correr. Medido ese día en todo el banco: **711 temas en 45 oposiciones**
 *    sellados así, **550 de ellos sin el Paso 1**. Un verde de esa procedencia no es un verde.
 *
 * ## Lo que NO hace
 *
 * No juzga si el scope es correcto —eso es el pipeline de dos agentes— sino si el estado que la BD
 * AFIRMA es de fiar. Distinción que importa: aquí se caza el falso verde, no el error de scope.
 *
 * Puro (sin BD, sin IO): los hechos los reúne `scripts/temario/revisar-oposicion.cjs`.
 */

/**
 * Un sellado de Paso 2 solo vale si vino del pipeline. Estos son los rastros de que NO vino:
 * el escritor manual, o un `agent_run_id` que no identifica ninguna corrida.
 *
 * `--run` no es un ejemplo inventado: es lo que quedó grabado en 711 filas cuando alguien pasó el
 * nombre del flag donde iba su valor. Un id que no distingue una corrida de otra no es un id.
 */
const ESCRITORES_SIN_PIPELINE = new Set(['claude_direct'])

function selladoFiable(verifiedBy, runId) {
  if (ESCRITORES_SIN_PIPELINE.has(String(verifiedBy || ''))) return false
  const r = String(runId == null ? '' : runId).trim()
  if (!r) return false
  if (r.startsWith('--')) return false
  return true
}

/** Estados del Paso 2 que son deuda declarada: no mienten, pero tampoco respaldan nada. */
const SCOPE_SIN_RESPALDO = new Set(['never_verified', 'stale'])

/**
 * @param {object} h
 * @param {boolean} h.esQuejaDeScope   ¿la queja va de temario/epígrafe/scope? (scope-enforcement)
 * @param {Array<{tema:number|string, titulo?:string, epigrafeState?:string, scopeState?:string,
 *                scopeVerifiedBy?:string, scopeRunId?:string, filaRota?:boolean}>} h.temasAfectados
 *        Los temas que SIRVEN la pregunta impugnada. Vacío = no se ha podido localizar.
 * @param {{positionType?:string, temasTotales?:number, sinPaso1?:number, filasRotas?:number,
 *          selladoSinPipeline?:number}} [h.oposicion]  deuda del resto, para el aviso
 * @param {string} [h.igualmente]  motivo declarado para saltarse la puerta
 * @returns {{verde:boolean, aplica:boolean, bloqueos:Array, avisos:Array, clase:string}}
 */
function evaluarRevisionTemario(h) {
  const o = h || {}
  const oposicion = o.oposicion || {}
  const bloqueos = []
  const avisos = []

  if (!o.esQuejaDeScope) {
    return { verde: true, aplica: false, bloqueos, avisos, clase: 'no_aplica' }
  }

  // ── EL ESCAPE NO PUEDE SALTARSE LA MEDICIÓN, SOLO EL BLOQUEO (T-702, 08/08) ────────────────
  // Aquí había un `return` seco: con el escape puesto, la puerta no llegaba a evaluar nada, así
  // que `bloqueos` se quedaba vacío SIEMPRE y el bus de fricción no recibía ni un `guard_bloqueo`
  // en toda la vida de esta puerta. Como el panel deduce los escapes preventivos RESTANDO
  // (`escapes - bloqueos`), eso daba **rodeado el 100%** por aritmética, dijera lo que dijera la
  // realidad — y el panel prescribe «arregla el criterio o quítalo» a un 100%. O sea que la
  // medición estaba mandando borrar la puerta con un número que no podía dar otro valor.
  //
  // El arreglo NO cambia el comportamiento: el escape sigue dejando pasar, y `bloqueos` sigue
  // saliendo vacío para que nada aguas abajo empiece a bloquear. Lo que se añade es la respuesta
  // a la única pregunta que hace falta para saber si la puerta estorba: **¿habría bloqueado?**
  // Medirlo directamente en vez de restarlo, que es la diferencia entre un dato y una suposición.
  const igualmente = typeof o.igualmente === 'string' ? o.igualmente.trim() : ''
  if (igualmente) {
    const comoSiNoHubieraEscape = evaluarRevisionTemario({ ...o, igualmente: undefined })
    return {
      verde: true,
      aplica: true,
      bloqueos,
      avisos,
      clase: 'escape',
      motivo: igualmente,
      // true = el escape sirvió para algo · false = se puso de prefijo, sin nada que rodear
      evitoBloqueo: comoSiNoHubieraEscape.clase === 'bloqueo',
      bloqueosEvitados: comoSiNoHubieraEscape.bloqueos.map((b) => b.code),
    }
  }

  const temas = Array.isArray(o.temasAfectados) ? o.temasAfectados : []

  // Fail-open (principio 4): sin saber qué tema sirve la pregunta no se puede exigir nada
  // concreto. Se dice en voz alta —el silencio es lo que convirtió esto en un problema— pero no
  // se bloquea: exigir «arregla algo, no sé qué» es la peor versión de un guardarraíl.
  if (!temas.length) {
    avisos.push({
      code: 'tema_no_localizado',
      detalle:
        'no se ha podido determinar qué tema sirve la pregunta impugnada, así que la puerta no opina. ' +
        'Compruébalo a mano contra el epígrafe oficial antes de responder.',
    })
    return { verde: true, aplica: true, bloqueos, avisos, clase: 'no_localizado' }
  }

  for (const t of temas) {
    const etiqueta = `T${t.tema}${t.titulo ? ` (${t.titulo})` : ''}`

    if (t.filaRota) {
      bloqueos.push({
        code: 'fila_rota',
        tema: t.tema,
        detalle: `${etiqueta}: tiene una ley enganchada con \`article_numbers = '{}'\` — sirve 0 preguntas de esa ley aunque haya banco.`,
        comando: 'ver docs/runbooks/verificar-epigrafes-scope.md §Regla previa punto 2 (poblar el array)',
      })
    }

    if (t.epigrafeState !== 'verified_literal') {
      bloqueos.push({
        code: 'paso1_pendiente',
        tema: t.tema,
        detalle:
          `${etiqueta}: su epígrafe está en \`${t.epigrafeState || 'never_sourced'}\`, o sea que el texto de la BD ` +
          'no consta que sea el LITERAL del programa oficial. Juzgar el scope contra una paráfrasis es el falso verde del caso Sara.',
        comando: 'node scripts/verify-epigrafe-literality.cjs dump <position_type>  → luego `apply` con el literal del boletín',
      })
    }

    if (t.scopeState === 'verified_correct' && !selladoFiable(t.scopeVerifiedBy, t.scopeRunId)) {
      bloqueos.push({
        code: 'verde_sin_pipeline',
        tema: t.tema,
        detalle:
          `${etiqueta}: figura \`verified_correct\`, pero lo selló \`${t.scopeVerifiedBy || '?'}\` con run \`${t.scopeRunId || '(vacío)'}\` — ` +
          'no viene del pipeline de dos agentes que exige el runbook. Ese verde no respalda nada.',
        comando: 'node scripts/verify-topic-scope.cjs dump <position_type>  → 2 agentes → record',
      })
    }

    if (SCOPE_SIN_RESPALDO.has(String(t.scopeState || 'never_verified'))) {
      avisos.push({
        code: 'paso2_pendiente',
        tema: t.tema,
        detalle: `${etiqueta}: Paso 2 en \`${t.scopeState || 'never_verified'}\` — deuda declarada, no falso verde.`,
      })
    }
  }

  // Deuda del RESTO de la oposición: informa, nunca bloquea. Bloquear por temas que no sirven
  // esta pregunta es exactamente el bloqueo imposible que se quiere evitar.
  if (oposicion.sinPaso1 > 0) {
    avisos.push({
      code: 'deuda_oposicion',
      detalle: `${oposicion.sinPaso1} de ${oposicion.temasTotales || '?'} temas de la oposición siguen sin Paso 1 (no bloquea esta respuesta).`,
    })
  }
  if (oposicion.selladoSinPipeline > 0) {
    avisos.push({
      code: 'deuda_sellado',
      detalle: `${oposicion.selladoSinPipeline} temas con el Paso 2 sellado fuera del pipeline (no bloquea esta respuesta).`,
    })
  }

  return {
    verde: bloqueos.length === 0,
    aplica: true,
    bloqueos,
    avisos,
    clase: bloqueos.length ? 'bloqueo' : 'verde',
  }
}

module.exports = { evaluarRevisionTemario, selladoFiable, ESCRITORES_SIN_PIPELINE }
