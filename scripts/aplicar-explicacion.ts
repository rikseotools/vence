#!/usr/bin/env npx tsx
/**
 * aplicar-explicacion.ts — escribe una explicación NUEVA en el formato estructurado y deja
 * coherentes las dos columnas. **Dry-run por defecto.**
 *
 * ## Por qué esto y no "escribe el texto y luego derívalo"
 *
 * Durante la Fase 2 de T-080 el flujo era: escribir el texto de siempre y **parsearlo** después
 * para obtener la estructura. Manuel señaló el defecto y tenía razón: **parsear es heurístico y
 * falla** (medido el 27/07: solo el 43,7% del formato de generación y el 15,3% del de
 * impugnaciones se transcriben), y encima depende de que alguien se acuerde de correr el comando.
 *
 * La dirección correcta es la contraria:
 *   · histórico:  texto → estructura  = PARSE   (heurístico, con guarda de no-regresión)
 *   · nuevo:      estructura → texto  = RENDER  (determinista: no puede fallar)
 *
 * Así que aquí se escribe la ESTRUCTURA y el texto se genera desde ella con el mismo render que
 * usa el serve. Resultado: las dos columnas coherentes por construcción, la pregunta nace
 * barajable, y producción —donde el render nuevo aún no está desplegado— sigue sirviendo
 * `explanation` sin enterarse de nada.
 *
 * ## Formato de entrada (JSON)
 *
 *   {
 *     "cita":   { "ref": "Art. 103 CE", "texto": "…literal…" },   // opcional
 *     "intro":  "Párrafo de contexto.",                            // opcional
 *     "options": {                                                 // OBLIGATORIO: una por opción
 *       "0": "Razón de la opción A, referida a SU CONTENIDO, nunca a su letra.",
 *       "1": "…", "2": "…", "3": "…"
 *     },
 *     "outro":  "**Clave:** …",                                    // opcional
 *     "estilo": "boletin" | "impugnacion"                          // opcional (default boletin)
 *   }
 *
 * ⚠️ Las razones se escriben referidas al CONTENIDO de la opción («No corresponde al órgano de
 * administración electrónica»), NUNCA a su letra ni a su posición («la primera», «la anterior»):
 * esas no sobreviven al barajado ni con estructura.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts <question_id> <fichero.json>
 *   npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts <question_id> <fichero.json> --apply
 *
 * Relacionado: `lib/shuffle/structuredExplanation.ts`, T-080 Fase 2,
 * `docs/maintenance/impugnaciones-claude-code.md`, `scripts/backfill-explanation-data.ts` (el
 * camino inverso, para el histórico).
 */
import { readFileSync, readdirSync } from 'fs'
import { basename, join } from 'path'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  isStructuredExplanation,
  renderStructuredExplanation,
  structuredNarrativeStaleLetters,
  type StructuredExplanation,
} from '@/lib/shuffle/structuredExplanation'
import { optionsReferenceOtherOptions } from '@/lib/shuffle/classifyShuffleMode'

/**
 * Reparte los argumentos entre las dos formas de uso. Es función pura y exportada porque el
 * reparto ya se rompió una vez: sin `--lote`, `indexOf` devuelve -1 y `iLote + 1` vale 0, que
 * es justo la posición del question_id — se lo comía y el modo suelto dejaba de funcionar.
 * Un `if` de una línea que solo se ve fallando; por eso tiene test.
 */
export function repartirArgumentos(argv: string[]) {
  const iLote = argv.indexOf('--lote')
  const lote = iLote >= 0 ? argv[iLote + 1] ?? null : null
  const posicionales = argv.filter((a, i) => !a.startsWith('--') && !(iLote >= 0 && i === iLote + 1))
  return { apply: argv.includes('--apply'), lote, qid: posicionales[0], fichero: posicionales[1] }
}

const { apply: APPLY, lote: LOTE, qid, fichero } = repartirArgumentos(process.argv.slice(2))

/** Un rechazo de una explicación concreta. En modo lote NO tumba el resto: se anota y se sigue. */
class ExplicacionRechazada extends Error {
  constructor(msg: string, readonly code = 1) { super(msg) }
}

async function aplicarUna(db: ReturnType<typeof getDb>, qid: string, fichero: string, resumido = false) {
  const [q]: any = await db.execute(sql`
    SELECT id, question_text, correct_option, option_a, option_b, option_c, option_d, option_e,
           explanation, explanation_data
      FROM questions WHERE id = ${qid}::uuid`)
  if (!q) throw new ExplicacionRechazada(`Pregunta no encontrada: ${qid}`, 2)

  const opciones = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(
    (v: string | null) => v != null && v !== '',
  )
  // `unknown` a propósito: es entrada externa y quien la valida es el type guard de abajo. Si se
  // declara ya como StructuredExplanation, TypeScript estrecha la rama de error a `never` y no
  // deja ni leer el objeto para explicar qué falta.
  const data: unknown = JSON.parse(readFileSync(fichero, 'utf8'))
  if (data && typeof data === 'object' && !(data as { v?: number }).v) (data as { v: number }).v = 1

  // 1) La estructura tiene que cubrir TODAS las opciones presentes. Sin esto, al barajar habría
  //    una opción sin razón y la explicación quedaría coja justo donde el opositor mira.
  if (!isStructuredExplanation(data, opciones.length)) {
    const recibidas = Object.keys((data as { options?: Record<string, string> })?.options ?? {})
    throw new ExplicacionRechazada(
      `Estructura inválida: hacen falta ${opciones.length} razones (una por opción presente), keadas "0".."${opciones.length - 1}". ` +
      `Recibidas: ${recibidas.join(', ') || '(ninguna)'}`)
  }
  const estructura: StructuredExplanation = data

  // 2) Guarda anti-letra: una razón que nombre la letra o la posición vuelve a clavar el orden,
  //    que es justo lo que este formato viene a eliminar.
  //
  //    ⚠️ Excepción: en Derecho los apartados SE CITAN por letra («la letra e) del artículo 9.1»,
  //    «el apartado b) del 4.1»), y eso NO es una referencia a la opción E ni a la B: al barajar
  //    sigue siendo verdad, porque nombra la ley, no la pantalla. Sin esta salvedad el guardarraíl
  //    rechazaba explicaciones impecables y obligaba a redactar peor para esquivarlo — pasó el
  //    28/07 con el art. 9.1 LPRL, cuyas funciones de la Inspección se enumeran por letras.
  const CITA_DE_LA_NORMA = /\b(letra|apartado|p[áa]rrafo|inciso|ep[íi]grafe|regla)\s+[a-e]\)?\s*(?:de[l]?\s+)?(?:art|ap|n[úu]m|\d)/i
  // La LETRA de una opción se escribe en MAYÚSCULA («la opción B», «la C es correcta»); los
  // apartados de un precepto van en minúscula («la letra d) no pide acreditar, sino poseer»). Sin
  // esa distinción el guard frena explicaciones que citan el articulado por sus letras, que es
  // lenguaje jurídico corriente — pasó el 28/07 con el art. 29.2 del Decreto 7/2013 CyL, cuyos
  // cuatro requisitos van por letras y cuyos distractores cambian justo el verbo de cada una.
  // Por eso esta primera va SIN el flag `i`: la mayúscula es la señal.
  //
  // ⚠️ Y detrás de la letra NO puede venir otra letra —tilde incluida—, que es lo que expresa el
  // lookahead. Con el `\b` de antes, **«la Cámara» se leía como «la opción C»**: `\b` se define en
  // JavaScript sobre `[A-Za-z0-9_]`, así que entre la «C» y la «á» hay frontera de palabra. En
  // derecho parlamentario «la Cámara» sale en casi toda explicación, y todas quedaban rechazadas
  // (medido el 30/07/2026 en la campaña de T-291: 5 razones impecables de 2 preguntas del
  // Reglamento del Congreso). Mismo agujero de las tildes que ya documenta `classifyShuffleMode`.
  const REFERENCIA_A_OPCION_LETRA = /\b(?:[Ll]a|[Oo]pci[óo]n|[Rr]espuesta|[Ll]etra)\s+[A-E](?![\p{L}\p{M}])/u
  const REFERENCIA_A_OPCION =
    /\b(primera|segunda|tercera|cuarta|[úu]ltima|anterior|siguiente)\s+(opci[óo]n|respuesta)\b|\b(opci[óo]n|respuesta|alternativa)\s+(anterior|previa|siguiente)\b/i
  const sospechosas = Object.entries(estructura.options).filter(([, r]) => {
    const limpia = r.replace(new RegExp(CITA_DE_LA_NORMA.source, 'gi'), ' ')
    return REFERENCIA_A_OPCION_LETRA.test(limpia) || REFERENCIA_A_OPCION.test(limpia)
  })
  if (sospechosas.length) {
    throw new ExplicacionRechazada(
      'Hay razones que se refieren a la LETRA o a la POSICIÓN de una opción ' +
      `(${sospechosas.map(([k]) => `opción ${k}`).join(', ')}): ` +
      sospechosas.map(([k, r]) => `[${k}] "${r.slice(0, 90)}…"`).join(' · ') +
      '. Reescríbelas referidas al CONTENIDO: al barajar, esas frases dejan de ser ciertas.')
  }

  // 2-bis) La apertura la pone el RENDER, no quien escribe: si viniera en el `intro` con su letra,
  //         esa letra quedaría clavada y al barajar diría una mentira — justo lo que este formato
  //         viene a evitar. (En el histórico transcrito sí vive en el intro, y el render la respeta
  //         para no duplicarla; pero eso es herencia, no el modo de escribir.)
  if (/^la respuesta correcta es/i.test((estructura.intro ?? '').trim())) {
    throw new ExplicacionRechazada(
      'El `intro` no debe empezar con "La respuesta correcta es …": esa frase la genera el render ' +
      'con la letra que corresponda tras barajar. Quítala del intro.')
  }
  // 2-quater) …y CUALQUIER otra letra en la narrativa, no solo esa apertura (T-262, 29/07). El
  //   `intro` y el `outro` se emiten VERBATIM en cualquier orden, así que una letra escrita ahí
  //   («como se ve en la B», un "**Clave:** la C es…") queda clavada y contradice a la cabecera
  //   que calcula el render. La regla de arriba solo cubría la apertura canónica; el histórico
  //   transcrito trajo 891 casos justo por ahí. Mismo detector que usan el serve y el sweep.
  // La salvedad de las citas por letra del articulado la aplica ya el propio detector (vive en el
  // núcleo desde el 29/07), así que aquí basta con preguntarle.
  const narrativaSucia = structuredNarrativeStaleLetters(estructura)
  if (narrativaSucia.length) {
    throw new ExplicacionRechazada(
      `La narrativa cita una opción por su letra o su posición en: ${narrativaSucia.join(', ')}. ` +
      'El `intro` y el `outro` se emiten igual en cualquier orden, así que esa letra miente al ' +
      'barajar. Escríbelos referidos al CONTENIDO — la letra ya la pone el render.')
  }

  // 2-ter) El `frame` decide las etiquetas de los veredictos (T-212). Dos comprobaciones:
  //   · un valor desconocido (un typo como "select_incorect") se renderizaría COMO SI fuera
  //     `select_correct`, en silencio y al revés de lo que se quería → se rechaza.
  //   · un enunciado que pide señalar la FALSA sin `frame` produce «CORRECTA — Afirmación falsa…»
  //     → se avisa, porque es el olvido que destapó la impugnación afe7c8bb (art. 33 CE).
  const frameRecibido = (data as { frame?: string }).frame
  if (frameRecibido && frameRecibido !== 'select_correct' && frameRecibido !== 'select_incorrect') {
    throw new ExplicacionRechazada(`frame desconocido: "${frameRecibido}". Solo "select_correct" o "select_incorrect".`)
  }
  const pideLaFalsa = /\b(incorrecta|falsa|no es (?:cierto|correcta|correcto|verdadera?))\b/i.test(q.question_text || '')
  if (pideLaFalsa && frameRecibido !== 'select_incorrect') {
    console.log('\n⚠️  El enunciado parece pedir la opción INCORRECTA/FALSA y no has puesto')
    console.log('    "frame": "select_incorrect". Sin él, la opción a señalar saldrá etiquetada')
    console.log('    CORRECTA junto a una razón que dice que es falsa. Míralo en el texto de abajo.')
  }

  // 3) El texto legacy se GENERA desde la estructura (render determinista, el mismo del serve).
  const texto = renderStructuredExplanation(estructura, {
    correctOption: q.correct_option,
    optionOrder: null,
    nOptions: opciones.length,
  })

  // En modo lote el render completo de 16 preguntas es ruido que tapa lo que importa (qué se
  // rechazó y por qué); en modo suelto es justo lo que se va a leer antes de aplicar.
  if (resumido) {
    console.log(`── ${qid} · ${opciones.length} opciones · ${String(q.explanation ?? '').length} → ${texto.length} caracteres`)
  } else {
    console.log(`\n── ${qid}`)
    console.log(`  estilo   : ${estructura.estilo ?? 'boletin'} · ${opciones.length} opciones`)
    console.log(`  explicación que se servirá (render en orden natural):\n`)
    console.log(texto.split('\n').map((l) => `    ${l}`).join('\n'))
    if (q.explanation) {
      console.log(`\n  (sustituye a un texto de ${String(q.explanation).length} caracteres)`)
    }
  }

  if (!APPLY) { if (!resumido) console.log('\n(dry-run — repite con --apply)\n'); return }

  // Las dos columnas en la MISMA transacción y en este orden: primero el contenido y después el
  // veredicto, porque `record_shuffle_safety` recalcula el hash leyendo la fila.
  await db.execute(sql`
    UPDATE questions
       SET explanation = ${texto},
           explanation_data = ${JSON.stringify(estructura)}::jsonb,
           updated_at = NOW()
     WHERE id = ${qid}::uuid`)
  // La explicación estructurada hace la EXPLICACIÓN barajable, pero no arregla unas OPCIONES que
  // se citen entre sí («La respuesta b) es correcta y además…»): esa pregunta sigue sin poder
  // barajarse. Marcar `safe` a ciegas dejaba que el sweep fuese detrás recogiendo lo que este
  // script acababa de romper (T-204), y con 47k pendientes de backfill eso no escala.
  const cruzadas = optionsReferenceOtherOptions(opciones)
  const estado = cruzadas ? 'unsafe' : 'safe'
  const razon = cruzadas ? 'options_crossref' : 'structured_explanation'
  await db.execute(sql`
    SELECT record_shuffle_safety(${qid}::uuid, ${estado}, ${razon}, 'aplicar-explicacion')`)
  if (cruzadas) {
    console.log('\n⚠️  Alguna OPCIÓN cita a otra por su letra → la pregunta queda `unsafe`:')
    console.log('   la explicación ya es barajable, pero las opciones no lo permiten.')
  }

  try {
    await db.execute(sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:aplicar-explicacion', 'info', 'explicacion_estructurada_aplicada',
              ${JSON.stringify({ question_id: qid, estilo: estructura.estilo ?? 'boletin', opciones: opciones.length })}::jsonb, NOW())`)
  } catch (e) {
    console.error(`⚠️  no se pudo registrar el evento: ${(e as Error).message}`)
  }
  if (!resumido) console.log('\n✅ aplicada: estructura + texto coherentes, y la pregunta nace BARAJABLE.\n')
}

async function main() {
  const db = getDb()

  // Modo LOTE: un directorio con un fichero `<question_id>.json` por pregunta. Existe porque
  // arrancar tsx una vez por pregunta cuesta más que escribir la explicación, y porque un fallo
  // en la número 7 no puede dejar el lote a medias sin decir cuáles quedaron: aquí cada rechazo
  // se anota, se sigue con el resto, y al final se listan todos.
  if (LOTE) {
    const ficheros = readdirSync(LOTE).filter((f) => f.endsWith('.json')).sort()
    if (!ficheros.length) { console.error(`No hay ficheros .json en ${LOTE}`); process.exit(2) }
    const fallos: Array<[string, string]> = []
    let ok = 0
    for (const f of ficheros) {
      const id = basename(f, '.json')
      try { await aplicarUna(db, id, join(LOTE, f), true); ok++ }
      catch (e) { fallos.push([id, (e as Error).message]); console.log(`❌ ${id}: ${(e as Error).message}`) }
    }
    console.log(`\n── lote ${LOTE}: ${ok}/${ficheros.length} ${APPLY ? 'aplicadas' : 'validadas (dry-run)'}`)
    if (fallos.length) {
      console.log(`   ${fallos.length} rechazada(s):`)
      for (const [id, m] of fallos) console.log(`   · ${id}: ${m}`)
      process.exit(1)
    }
    return
  }

  if (!qid || !fichero) {
    console.error('Uso: aplicar-explicacion.ts <question_id> <fichero.json> [--apply]')
    console.error('     aplicar-explicacion.ts --lote <dir con <question_id>.json> [--apply]')
    process.exit(2)
  }
  try {
    await aplicarUna(db, qid, fichero)
  } catch (e) {
    console.error(`❌ ${(e as Error).message}`)
    process.exit(e instanceof ExplicacionRechazada ? e.code : 1)
  }
}

// Solo se ejecuta si se invoca el script; importarlo (p. ej. desde el test de reparto de
// argumentos) no debe abrir conexión a la base de datos ni tocar nada.
if (require.main === module) {
  main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
}
