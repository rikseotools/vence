#!/usr/bin/env node
/**
 * clasificar-hitos.cjs — deriva `tipo` y `origen` de cada convocatoria_hito desde su texto.
 *
 * Diseño: docs/roadmap/verificacion-convocatorias-documentos-proceso.md
 * Uso:  node scripts/clasificar-hitos.cjs                       (DRY-RUN: mide, no escribe)
 *       node scripts/clasificar-hitos.cjs --apply                (escribe en 1 UPDATE)
 *       node scripts/clasificar-hitos.cjs --slug <slug> [--apply] (solo esa oposición)
 *
 * `--slug` existe porque la revisión de UNA landing (antes de una campaña, p.ej.) no debe
 * obligar a reescribir los ~1.000 hitos del catálogo entero: acotar el alcance es lo que
 * permite usar la regla compartida en vez de parchear a mano esa oposición — que es como
 * nacen los silos. Sin `--slug` el comportamiento es el de siempre (todo el catálogo).
 *
 * POR QUÉ REGLAS Y NO IA: es texto propio, cerrado y auditable. La regla se lee, se mide y se
 * corrige; un LLM aquí no aporta y no se puede auditar. La IA hace falta para leer el DOCUMENTO
 * OFICIAL (Fase 2), no para normalizar nuestro propio vocabulario.
 *
 * Cobertura medida sobre los 983 hitos reales (16/07/2026): 95% tipado (50 → 'otro').
 *
 * ⚠️ LECCIONES CARAS (no revertir sin medir):
 *  · `oep_aprobada` va ANTES que `resultados`: /aprobad/ como comodín se comía "OEP apro**bada**"
 *    → 42 hitos de OEP acabaron en `resultados` (que salía inflado 3,4×: 58 vs 17 reales).
 *  · Multiidioma NO es un extra: hay catalán en prod (`tancament`, `llista`, `termini`,
 *    `sol·licitud`, `inici`, `fi`). Sin ello, "Tancament del termini" cae a 'otro'.
 *  · `origen`: si el hito CITA un boletín con identificador (o trae url), es REGISTRO aunque su
 *    descripción diga "pendiente" — ese "pendiente" suele referirse a OTRO evento futuro que la
 *    descripción menciona. Sin esta regla, 24 registros oficiales se marcaban como estimación.
 *  · Verificar SIEMPRE con --dry-run y mirar el reparto antes de aplicar.
 *  · `--apply` sobrescribe TODOS los hitos que consulta (todo el catálogo, o los de --slug), no
 *    solo los que cambian. Los ids en `NO_TOCAR_TIPO` (más abajo) quedan fuera del UPDATE — es la
 *    única forma de proteger un hito adjudicado a mano de un re-cálculo mecánico posterior.
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const APPLY = process.argv.includes('--apply')

// Orden = prioridad: la primera regla que casa, gana.
//
// `tribunal_constituido` va ANTES que `nombramientos` (T-170, 08/08 — regresión encontrada en
// revisión): "Nombramiento del Tribunal Calificador" contiene la palabra "nombramiento", así que
// con el orden inverso ganaba `nombramientos` por prioridad de array, no por precisión — pese a
// que `tribunal_constituido` también casaba (su propio patrón incluye "tribunal...nombrad").
// Medido contra los 1.084 hitos reales: el reorden cambia SOLO 3 hitos, los 3 con "tribunal" en
// el título ("Nombramiento de tribunales calificadores" ×2, "Nombramiento del Tribunal
// Calificador" ×1) — cero riesgo de arrastrar nombramientos de PERSONAS (el patrón de
// `tribunal_constituido` exige "tribunal"/"comisión" cerca, así que "Nombramiento de
// funcionarios en prácticas" o "Toma de posesión" siguen cayendo en `nombramientos` sin tocar).
// Uno de los 3 (ddb30ace) ya estaba en BD como `tribunal_constituido` — tipado a mano
// correctamente, con `cita_literal` confirmando "se nombra el Tribunal Calificador" — y la regla
// vieja lo habría degradado a `nombramientos` si se aplicaba tal cual: es la prueba de que el
// reorden es la lectura correcta, no solo una excepción para ese caso.
const TIPO = [
  ['reconocimiento_medico', /reconocimiento m.dico|revisi.n m.dica|prueba m.dica/i],
  // `designaci.n.*tribunal` (T-170, 07/08): "Designación del Tribunal de selección" caía a
  // 'otro' porque la regla solo reconocía "tribunal designado" (verbo DESPUÉS del sustantivo),
  // no el orden inverso. Medido: único hito con "designación"+"tribunal" en 1.084, sin riesgo.
  ['tribunal_constituido',  /tribunal(es)? (designad|calificador|coordinador|nombrad)|constituci.n.*tribunal|composici.n.*(tribunal|comisi.n)|designaci.n.*tribunal/i],
  ['nombramientos',         /nombramiento|toma de posesi|adjudicaci.n de (destino|plaza)/i],
  ['plantilla_respuestas',  /plantilla|cuestionario|alegacion|impugnaci/i],
  // `acumulaci.n.*plaza` (T-170, 07/08): "Decreto de acumulación de plazas (9 → 17)" y
  // "Acumulación de plazas (11 plazas)" caían a 'otro' — acumular plazas de OEPs anteriores es
  // una modificación de plazas tan real como "ampliación", solo que con otra palabra. Medido
  // contra los 1.084 hitos reales: 2 aciertos, 0 casos que dejen de clasificar bien.
  ['modificacion_plazas',   /ampliaci.n.*(plaza|convocatoria|proceso)|modificaci.n.*plaza|correcci.n de errores|acumulaci.n.*plaza/i],
  ['oep_aprobada',          /oferta (de )?(empleo|p.blica)|\boep\b|\bope\b/i],   // ANTES que resultados (ver cabecera)
  // `relaci.n de aprobad` (T-170, 07/08): "Relación de aprobados (fase de oposición)" caía a
  // ejercicio_1 porque "fase de oposici" (más abajo) SÍ casaba y esta regla no — el título dice
  // "lista DE aprobados" o "aprobados DEL", no la forma real "RELACIÓN de aprobados". Acotado a
  // propósito (no "aprobad" a secas): un patrón suelto se come los ~40 hitos "OEP … aprobada"
  // (que van antes, a oep_aprobada, así que en la práctica no chocarían) y "Aprobados fase de
  // oposición"/"Aprobados del primer ejercicio", que son ejercicio_1/oep_aprobada por diseño y
  // NO empiezan por "relación de". Medido: 2 aciertos, 0 regresiones sobre los 1.084 reales.
  ['resultados',            /resultados?\b|calificaci|lista de aprobad|aprobados del|nota del|puntuaci|superan la fase|relaci.n de aspirantes|resuelta|aspirantes admitidos|relaci.n de aprobad/i],
  ['lista_definitiva',      /(lista|relaci.n|llista).*definitiv|definitiv.*(admitid|admesos)/i],
  ['lista_provisional',     /(lista|relaci.n|llista).*provisional|provisional.*(admitid|admesos)|lista de personas admitidas|admitid.*\(pendiente\)/i],
  ['ejercicio_2',           /segundo ejercicio|2.. ejercicio|ejercicio 2|segunda prueba/i],
  // `celebración de los ejercicios/pruebas` es como lo escriben las propias bases cuando aún
  // no hay fecha, y caía a 'otro' — con lo que el hito del EXAMEN quedaba sin tipo y fuera de
  // cualquier consulta por tipo (rollover, timeline, avisos). Medido 27/07: 2 hitos en prod.
  ['ejercicio_1',           /primer ejercicio|1.. ejercicio|ejercicio .nico|ejercicio 1|examen|ejercicios? (del|de la|pendientes)|celebraci.n de (los |las )?(ejercicios?|pruebas?)|fase de oposici|inicio de la oposici|instrucciones del ejercicio|convocatoria (a examen|del examen|de (las )?pruebas)/i],
  // Dos arreglos en la misma regla (T-170, 07/08), medidos contra los 1.084 hitos reales, 0
  // regresiones sobre lo que ya acertaba:
  //  · el conector `(del?\s*)?` solo dejaba pasar "del "/"el " entre el verbo y "plazo" — un
  //    adjetivo de por medio ("Cierre del NUEVO plazo de solicitudes") rompía el match y el
  //    hito caía al fallback genérico de plazo_inicio, invirtiendo el sentido.
  //  · "Plazo de inscripción CERRADO" / "…(fechas) cerrado" dice el cierre AL FINAL, no antes
  //    de "plazo" — sin la alternativa de orden inverso, "plazo de inscripción" solo case con
  //    el fallback genérico de plazo_inicio y el hito salía con el sentido contrario.
  ['plazo_fin',             /(cierre|tancament|fin(al)?\b|^fi\b|\bfi )\s*(del?\s+(nuevo\s+)?)?(plazo|solicitud|instancia|inscripci|termini|sol.licitud)|(plazo|solicitud|instancia|inscripci).{0,40}?(cerrad|finalizad)/i],
  // Mismo conector ensanchado para "Apertura de NUEVO plazo de solicitudes" — sin esto también
  // dependía en solitario del fallback genérico, que es el que hay que tocar con más cuidado
  // (varios hitos reales SOLO llevan "Plazo de presentación de solicitudes", sin "apertura" ni
  // "inicio", y dependen de él para clasificar bien: no se toca, solo se ensancha lo de arriba).
  ['plazo_inicio',          /(apertura|inici(o)?|comienzo)\s*(del?\s+(nuevo\s+)?|de\s+(nuevo\s+)?)?(plazo|solicitud|instancia|inscripci|termini|sol.licitud)|plazo de (presentaci.n de )?(solicitud|inscripci)/i],
  ['programa_publicado',    /programa|temario/i],
  ['bases_publicadas',      /bases/i],
  ['convocatoria_publicada',/convocat.ria|convocatoria|extracto|anuncio|resumen publicado|publicaci.n en (el )?(boe|bocm|dogv|dogc|bop|dog|boc|bocyl|borm|doe|boib|bon|bopv|boja|bor|bocce|bouc|boa)/i],
]

// origen: registro (el documento lo dice) | inferencia (derivado de una REGLA) | estimacion (criterio propio)
const NO_REGISTRO = /previsi|previsible|estimad|pendiente|sin fijar|por confirmar|por determinar|pr.xima|propera|orientativ|prevista?\b|previst/i
const CITA_REGLA  = /no podr. (comenzar|celebrarse)|transcurrid|seg.n (las )?bases|base \d|conforme a|establece que|m.nimo de \d|plazo de \d+ (meses|d.as|h.biles)|dos meses|se determinar. con|con un m.nimo/i
const REF_BOLETIN = /(BOE|BOCM|BORM|BOP|DOGV|DOGC|DOG|BOC|BOCYL|BOIB|BON|BOPV|BOJA|BOR|BOCCE|BOUC|BOA|DOE|BOPA)[\s\wº#-]{0,12}?(\d|A-\d)|(Orden|Decreto|Resoluci.n|RD)\s*[\wº/]*\d{1,4}\/\d{4}/i

// `tipo` se decide SOLO por `h.titulo`, nunca por `h.descripcion` — probado y descartado
// (T-170, 08/08), no por descuido. Medido contra los 1.084 hitos reales: buscar también en
// `descripcion` con la MISMA lista de reglas cambia 124 clasificaciones, y la inmensa mayoría son
// peores, no mejores — la descripción suele traer un dato de contexto (una fecha límite futura,
// un trámite relacionado) que dispara una regla de prioridad más alta y desplaza al hito de su
// categoría correcta. Ejemplo real: "Cierre del plazo de inscripción" (`plazo_fin`, correcto)
// pasa a `lista_provisional` solo porque su descripción dice "pendiente de lista de personas
// admitidas" — un evento FUTURO que el hito menciona, no lo que el hito ES. El título es la
// fuente fiable porque lo redacta quien tipa el hito para nombrar EL EVENTO; la descripción es
// prosa libre que puede citar cualquier cosa relacionada.
function clasificar(h) {
  const tipo = (TIPO.find(([, rx]) => rx.test(h.titulo)) || ['otro'])[0]
  let origen = 'registro'
  if (NO_REGISTRO.test(`${h.titulo} ${h.descripcion || ''}`)) {
    if (REF_BOLETIN.test(h.titulo) || h.url) origen = 'registro'
    else origen = CITA_REGLA.test(h.descripcion || '') ? 'inferencia' : 'estimacion'
  }
  return { tipo, origen }
}

// Hitos que la REGLA clasificaría distinto de lo que hay en BD, pero donde `--apply` NO debe
// tocar el `tipo` (T-170, 08/08) — adjudicados a mano leyendo título/descripción/cita_literal,
// no solo el veredicto de `clasificar()`. Cada uno es de una de estas dos clases:
//   · CONTRADICCIÓN: la propia `descripcion` del hito NIEGA lo que el nuevo `tipo` afirmaría
//     (p.ej. título "Convocatoria publicada" + descripción "Aún no publicada la convocatoria" —
//     problema de CONTENIDO del hito, no de la regla; aplicar escribiría algo que el propio dato
//     contradice).
//   · AMBIGÜEDAD SIN FUENTE: no hay `descripcion`/`cita_literal` que decante la duda y la `url`
//     no es un documento consultable (portal genérico) — ni el valor de BD ni el de la regla
//     tienen más respaldo que el otro.
// Sin esta lista, `--apply` (que sobrescribe TODOS los hitos que consulta, no solo los que
// cambian) los tocaría igual que a los 44 casos sí verificados. Revisar cada uno contra el
// boletín oficial antes de decidir — no adjudicar por mayoría de coincidencias de regex.
const NO_TOCAR_TIPO = new Map([
  ['ddb30ace-b100-43d6-ab3f-2f9dd43e0983', 'BD ya dice tribunal_constituido — CORRECTO, respaldado por cita_literal ("se nombra el Tribunal Calificador"). Arreglado en la regla (T-170, 08/08): ya no hace falta excluirlo aparte, pero se deja anotado como el caso que demostró el bug.'],
  ['66adf612-8ba1-4b72-a33a-7332afc38e27', 'BD dice nombramientos, bien fundado en la descripción ("proceso finalizado con propuesta de nombramiento"). La regla propone oep_aprobada solo porque el título contiene "OEP" — pérdida de precisión, no mejora.'],
  ['49c140f3-2baa-42eb-92cc-4211a216e4d5', 'AMBIGÜEDAD SIN FUENTE: "Corrección de bases (BOCYL)", sin descripción, cita_literal genérica, url a tablón-oficial sin documento consultable. BD dice modificacion_plazas; la regla propone bases_publicadas, que en el resto del banco significa publicación INICIAL, no corrección posterior.'],
  ['8f72b566-d931-424b-96d0-e5d7d53ae7c3', 'Mismo caso que 49c140f3: "Corrección de bases (BOPVA)", sin descripción ni documento consultable.'],
  ['8d17ab33-9bb8-4f70-967a-06bbc7a73c80', 'Mismo caso que 49c140f3: "Corrección de bases (BOPVA)", sin descripción ni documento consultable.'],
  ['053db338-9087-40d7-801d-ac417869da95', 'AMBIGÜEDAD: "Convocatoria y bases (BOCYL)" — cita_literal es texto de convocatoria puro ("CONVOCATORIA PARA LA SELECCIÓN..."), sin mención específica de "bases" como evento propio. BD dice convocatoria_publicada, bien respaldado por la cita; la regla propone bases_publicadas solo por el patrón /bases/ (sin condición), que gana por prioridad de array ante cualquier título que mencione la palabra.'],
  ['6625a7e3-dd39-4d6a-9339-24ef3fd9996e', 'Mismo patrón que 053db338 ("Convocatoria y bases (BOP)"), con aún menos evidencia (sin descripción ni cita_literal).'],
  ['d0294f39-4292-4e66-993d-d9f88aeef9e5', 'CONTRADICCIÓN: título "Convocatoria publicada (BOP Badajoz...)" pero descripción "Aún no publicada la convocatoria de los procesos selectivos" — problema de CONTENIDO del hito (ya señalado en el commit original de T-170 como fuera de alcance), no algo que resolver aplicando la regla a ciegas.'],
  ['ecf88a05-c271-4fb2-9a66-73e937734149', 'Ya documentado en la ficha como ambiguo (oposición tecnico-informatica): "Plazo de inscripción (23/12/2025 - 22/01/2026)" no dice cuál de las dos fechas es la relevante. BD dice plazo_fin, la regla propone plazo_inicio; sin url ni documento no hay fuente que consultar.'],
])

module.exports = { clasificar, TIPO, NO_TOCAR_TIPO }

if (require.main === module) {
  ;(async () => {
    // `sslmode=require` en la URL gana sobre la opción `ssl` y hace fallar la conexión a RDS
    // con "self-signed certificate in certificate chain". Se quita, como en el resto de
    // scripts del repo (`_gen_*.cjs`, `audit-notas-vigencia-tc.cjs`…).
    const c = new Client({
      connectionString: (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/, ''),
      ssl: { rejectUnauthorized: false },
    })
    await c.connect()
    const iSlug = process.argv.indexOf('--slug')
    const SLUG = iSlug >= 0 && process.argv[iSlug + 1] && !process.argv[iSlug + 1].startsWith('--') ? process.argv[iSlug + 1] : null
    if (iSlug >= 0 && !SLUG) { console.error('❌ --slug necesita un valor'); process.exit(2) }
    const rows = (await c.query(
      `SELECT h.id, h.titulo, coalesce(h.descripcion,'') descripcion, h.url
         FROM convocatoria_hitos h
         ${SLUG ? 'JOIN oposiciones o ON o.id = h.oposicion_id WHERE o.slug = $1' : ''}`,
      SLUG ? [SLUG] : [])).rows
    if (SLUG && !rows.length) { console.error(`❌ sin hitos para el slug "${SLUG}" (¿existe?)`); process.exit(2) }
    if (SLUG) console.log(`🔎 acotado a ${SLUG}: ${rows.length} hito(s)`)
    const excluidos = rows.filter(r => NO_TOCAR_TIPO.has(r.id))
    const incluidos = rows.filter(r => !NO_TOCAR_TIPO.has(r.id))
    const vals = incluidos.map(r => ({ id: r.id, ...clasificar(r) }))
    const cnt = f => vals.reduce((a, r) => (a[f(r)] = (a[f(r)] || 0) + 1, a), {})

    console.log(APPLY ? '=== APLICANDO' : '=== DRY-RUN (no escribe; usa --apply)')
    console.log(`hitos: ${vals.length} · tipados: ${vals.filter(v => v.tipo !== 'otro').length}`)
    if (excluidos.length) {
      console.log(`\n⛔ ${excluidos.length} hito(s) en NO_TOCAR_TIPO — NO se tocan (ambiguos/contradictorios, adjudicados a mano):`)
      excluidos.forEach(r => console.log(`   ${r.id}  "${r.titulo}"  — ${NO_TOCAR_TIPO.get(r.id)}`))
    }
    console.table(cnt(v => v.tipo)); console.table(cnt(v => v.origen))

    if (APPLY) {
      const res = await c.query(
        `UPDATE convocatoria_hitos h SET tipo=u.tipo, origen=u.origen
           FROM (SELECT unnest($1::uuid[]) id, unnest($2::text[]) tipo, unnest($3::text[]) origen) u
          WHERE h.id=u.id`,
        [vals.map(v => v.id), vals.map(v => v.tipo), vals.map(v => v.origen)]
      )
      console.log(`✅ ${res.rowCount} filas actualizadas`)
    }
    await c.end()
  })().catch(e => { console.error('ERR', e.message); process.exit(1) })
}
