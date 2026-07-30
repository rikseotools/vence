// Drift sweep de shuffle_safety (barajar-opciones verificación robusta, Paso 3).
// Versión de PRODUCCIÓN recurrente del canary: caza cualquier pregunta marcada
// shuffle_safety='safe' cuya explicación HOY cita letras/posición según el detector
// REAL (regresión, miss del detector, o edición que el trigger no invalidó). También
// comprueba la INTEGRIDAD del trigger: safe cuyo hash guardado != hash del contenido
// actual (debería estar stale y no lo está).
//
// Y desde T-262, la NARRATIVA de las explicaciones ESTRUCTURADAS: `intro`/`outro` se emiten
// verbatim en cualquier orden, así que una letra escrita ahí queda clavada aunque las razones
// estén impecables. Se cuenta aparte porque el remedio es otro (podar, no reescribir).
//
// Usa la función REAL de producción (no una copia). Emite JSON con --json para que
// health-sweep.cjs lo pliegue en content_health_findings (kinds 'shuffle_safe_regressed' y
// 'shuffle_narrativa_letra_clavada'). Sin escribir a la tabla (la dueña del TRUNCATE es el sweep).
//
// Uso: DATABASE_URL=.. NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/sweep-shuffle-safety-drift.ts [--json]
import { Client } from 'pg'
import { explanationReferencesLetters, optionsReferenceOtherOptions } from '@/lib/shuffle/classifyShuffleMode'
import { structuredNarrativeStaleLetters } from '@/lib/shuffle/structuredExplanation'

const JSON_OUT = process.argv.includes('--json')

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL!.replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // 1) Regresión: safe activas cuya explicación cita letras/posición (el detector las
  //    debería haber dejado fuera; si aparecen es un miss/regresión).
  //    PREFILTRO SQL de alto recall: solo las que contienen un token de letra/número/
  //    ordinal PUEDEN disparar el detector; las limpias no. Reduce ~70k → ~9k (el sweep
  //    nocturno no escanea las 60k inequívocamente limpias). El prefiltro es superset de
  //    lo que marca el detector (0 FN del prefiltro).
  const safe = (
    await c.query(
      `SELECT id, explanation, option_a, option_b, option_c, option_d, option_e FROM public.questions
        WHERE is_active = true AND shuffle_safety = 'safe' AND explanation IS NOT NULL
          -- Las transcritas a explanation_data quedan FUERA: son safe por construcción (las
          -- razones van keadas a cada opción y la letra la pone el render), y su texto legacy
          -- —que sigue citando letras y ya no se sirve— las haría salir aquí como regresión.
          -- Sin esta guarda, la Fase 2 de T-080 metía 4.732 falsos positivos en el barrido
          -- nocturno: una bandeja que grita todas las noches se deja de mirar.
          AND explanation_data IS NULL
          AND (option_a ~* '[a-e]\\)' OR option_b ~* '[a-e]\\)' OR option_c ~* '[a-e]\\)' OR option_d ~* '[a-e]\\)'
               OR explanation ~ '\\y[A-Ea-e]\\y'
               OR explanation ~ '\\y[0-9]\\y'
               OR explanation ~* '(primer|segund|tercer|cuart|quint|[uú]ltim|anterior|siguiente|opci|respuesta|apartado|letra|alternativa|afirmaci)')`,
    )
  ).rows as Array<{ id: string; explanation: string; option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null; option_e: string | null }>
  // Dos ejes, no uno: la explicación Y las opciones. Una opción que cita a otra por su letra
  // («La respuesta b) es correcta y además…») rompe igual al barajar, y el sweep no la miraba
  // (T-201): 7 preguntas estaban marcadas `safe` así, una desde mayo.
  const regressed = safe.filter(
    (r: any) =>
      explanationReferencesLetters(r.explanation) ||
      optionsReferenceOtherOptions([r.option_a, r.option_b, r.option_c, r.option_d, r.option_e]),
  )

  // 1-bis) NARRATIVA estructurada con la letra clavada (T-262). La consulta de arriba deja fuera
  //   a propósito las transcritas (`explanation_data IS NOT NULL`) porque su TEXTO legacy ya no
  //   se sirve. Pero "tiene estructura" nunca significó "todo su contenido es seguro": las
  //   RAZONES viajan keadas a su opción, y el `intro`/`outro` se emiten VERBATIM en cualquier
  //   orden. Medido el 29/07: 1.211 activas `safe` cuyo intro dice «La respuesta correcta es la
  //   **C**.» mientras la cabecera calcula otra letra dos líneas después. Sin esto, el hueco solo
  //   se vería el día que se reencienda el barajado — y en la cara del opositor.
  const estructuradas = (
    await c.query(
      `SELECT id, explanation_data FROM public.questions
        WHERE is_active = true AND shuffle_safety = 'safe' AND explanation_data IS NOT NULL`,
    )
  ).rows as Array<{ id: string; explanation_data: unknown }>
  const narrativaSucia = estructuradas
    .map((r) => ({ id: r.id, campos: structuredNarrativeStaleLetters(r.explanation_data as any) }))
    .filter((r) => r.campos.length > 0)

  // 2) Integridad del trigger: safe cuyo hash guardado != hash del contenido actual.
  //    (El trigger debería haberlas puesto 'stale'. Si no, el trigger está roto.)
  const hashMismatch = (
    await c.query(
      `SELECT count(*)::int AS n FROM public.questions
        WHERE is_active = true AND shuffle_safety = 'safe'
          -- Con los 8 argumentos: para una pregunta ya transcrita a explanation_data, omitir el
          -- octavo daría un hash distinto del que calcula el trigger y la marcaría stale sin
          -- que nada haya cambiado.
          AND shuffle_safety_hash IS DISTINCT FROM public.compute_shuffle_safety_hash(
            explanation, option_a, option_b, option_c, option_d, option_e, shuffle_mode, explanation_data::text)`,
    )
  ).rows[0].n as number

  // 3) DRIFT DE CRITERIO (T-316): veredictos que el detector de HOY contradice.
  //
  //    Los dos checks de arriba miran si el CONTENIDO se ha ido de su veredicto. Este mira lo
  //    contrario: si el VEREDICTO se ha quedado atrás porque mejoró el detector. El trigger no lo
  //    puede ver —invalida por hash del contenido, y aquí el contenido no ha cambiado—, así que un
  //    arreglo del detector se queda inerte y nadie se entera. Pasó dos veces: el endurecimiento
  //    de las tildes (28/07) dejó 21 preguntas mal marcadas ocho días, y el de los grados
  //    centígrados (T-301) otras 91 hasta que una sesión tropezó con ellas (T-306).
  //
  //    Solo se cuentan los veredictos que firmó el backfill determinista: los de `llm_audit_v1`
  //    son de otra capa y no se recalculan con una regex. Se arregla con
  //    `backfill-shuffle-safety.ts --recriterio --apply`, que aplica exactamente este criterio.
  const propios = (
    await c.query(
      `SELECT id, explanation, shuffle_mode, shuffle_safety FROM public.questions
        WHERE is_active = true AND shuffle_safety IN ('safe','unsafe')
          AND shuffle_safety_verified_by = 'backfill_deterministic_v3'`,
    )
  ).rows as Array<{ id: string; explanation: string | null; shuffle_mode: string | null; shuffle_safety: string }>
  const criterioViejo = propios.filter((r) => {
    const hoy = r.shuffle_mode !== 'full' || explanationReferencesLetters(r.explanation) ? 'unsafe' : 'safe'
    return hoy !== r.shuffle_safety
  })

  await c.end()

  const result = {
    regressions: regressed.length,
    hash_mismatch: hashMismatch,
    // Ni regresión ni narrativa: veredicto correcto EN SU DÍA que el detector de hoy contradice.
    criterio_viejo: criterioViejo.length,
    criterio_sample: criterioViejo.slice(0, 8).map((r) => ({ id: r.id, de: r.shuffle_safety, a: r.shuffle_safety === 'safe' ? 'unsafe' : 'safe' })),
    sample: regressed.slice(0, 8).map((r) => ({ id: r.id, explanation: r.explanation.replace(/\s+/g, ' ').slice(0, 120) })),
    // Cuenta aparte, no sumada a `regressions`: el remedio es distinto (la razón se REESCRIBE; la
    // narrativa se PODA porque el render ya anuncia la letra), y mezclarlas daría a quien lo
    // atienda la instrucción equivocada.
    narrative_stale_letters: narrativaSucia.length,
    narrative_sample: narrativaSucia.slice(0, 8).map((r) => ({ id: r.id, campos: r.campos })),
  }

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(result))
  } else {
    console.log(`safe activas: ${safe.length}`)
    console.log(`REGRESIONES (safe que citan letras/posición): ${result.regressions}`)
    console.log(`NARRATIVA con letra clavada (intro/outro de estructuradas): ${result.narrative_stale_letters}`)
    console.log(`hash mismatch (trigger no invalidó): ${result.hash_mismatch}`)
    console.log(`CRITERIO VIEJO (el detector de hoy los contradice): ${result.criterio_viejo}`)
    for (const s of result.sample) console.log(`  - ${s.id}: "${s.explanation}"`)
    for (const s of result.narrative_sample) console.log(`  - ${s.id}: letra clavada en ${s.campos.join(', ')}`)
    for (const s of result.criterio_sample) console.log(`  - ${s.id}: ${s.de} → ${s.a} con el criterio de hoy`)
    if (result.criterio_viejo > 0)
      console.log('   ↳ se arregla con: npx tsx scripts/backfill-shuffle-safety.ts --recriterio [--apply]')
    if (result.regressions === 0 && result.hash_mismatch === 0 && result.narrative_stale_letters === 0 && result.criterio_viejo === 0)
      console.log('✅ sin drift: el conjunto safe es coherente.')
  }
}
main().catch((e) => {
  if (JSON_OUT) process.stdout.write(JSON.stringify({ regressions: 0, hash_mismatch: 0, sample: [], narrative_stale_letters: 0, narrative_sample: [], criterio_viejo: 0, criterio_sample: [], error: String(e).slice(0, 200) }))
  else console.error(e)
  process.exit(JSON_OUT ? 0 : 1) // en modo json no romper el sweep
})
