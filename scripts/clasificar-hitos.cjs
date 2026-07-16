#!/usr/bin/env node
/**
 * clasificar-hitos.cjs — deriva `tipo` y `origen` de cada convocatoria_hito desde su texto.
 *
 * Diseño: docs/roadmap/verificacion-convocatorias-documentos-proceso.md
 * Uso:  node scripts/clasificar-hitos.cjs            (DRY-RUN: mide, no escribe)
 *       node scripts/clasificar-hitos.cjs --apply     (escribe en 1 UPDATE)
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
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const APPLY = process.argv.includes('--apply')

// Orden = prioridad: la primera regla que casa, gana.
const TIPO = [
  ['nombramientos',         /nombramiento|toma de posesi|adjudicaci.n de (destino|plaza)/i],
  ['reconocimiento_medico', /reconocimiento m.dico|revisi.n m.dica|prueba m.dica/i],
  ['tribunal_constituido',  /tribunal(es)? (designad|calificador|coordinador|nombrad)|constituci.n.*tribunal|composici.n.*(tribunal|comisi.n)/i],
  ['plantilla_respuestas',  /plantilla|cuestionario|alegacion|impugnaci/i],
  ['modificacion_plazas',   /ampliaci.n.*(plaza|convocatoria|proceso)|modificaci.n.*plaza|correcci.n de errores/i],
  ['oep_aprobada',          /oferta (de )?(empleo|p.blica)|\boep\b|\bope\b/i],   // ANTES que resultados (ver cabecera)
  ['resultados',            /resultados?\b|calificaci|lista de aprobad|aprobados del|nota del|puntuaci|superan la fase|relaci.n de aspirantes|resuelta|aspirantes admitidos/i],
  ['lista_definitiva',      /(lista|relaci.n|llista).*definitiv|definitiv.*(admitid|admesos)/i],
  ['lista_provisional',     /(lista|relaci.n|llista).*provisional|provisional.*(admitid|admesos)|lista de personas admitidas|admitid.*\(pendiente\)/i],
  ['ejercicio_2',           /segundo ejercicio|2.. ejercicio|ejercicio 2|segunda prueba/i],
  ['ejercicio_1',           /primer ejercicio|1.. ejercicio|ejercicio .nico|ejercicio 1|examen|ejercicios? (del|de la|pendientes)|fase de oposici|inicio de la oposici|instrucciones del ejercicio|convocatoria (a examen|del examen|de (las )?pruebas)/i],
  ['plazo_fin',             /(cierre|tancament|fin(al)?\b|^fi\b|\bfi )\s*(del?\s*)?(plazo|solicitud|instancia|inscripci|termini|sol.licitud)/i],
  ['plazo_inicio',          /(apertura|inici(o)?|comienzo)\s*(del?\s*)?(plazo|solicitud|instancia|inscripci|termini|sol.licitud)|plazo de (presentaci.n de )?(solicitud|inscripci)/i],
  ['programa_publicado',    /programa|temario/i],
  ['bases_publicadas',      /bases/i],
  ['convocatoria_publicada',/convocat.ria|convocatoria|extracto|anuncio|resumen publicado|publicaci.n en (el )?(boe|bocm|dogv|dogc|bop|dog|boc|bocyl|borm|doe|boib|bon|bopv|boja|bor|bocce|bouc|boa)/i],
]

// origen: registro (el documento lo dice) | inferencia (derivado de una REGLA) | estimacion (criterio propio)
const NO_REGISTRO = /previsi|previsible|estimad|pendiente|sin fijar|por confirmar|por determinar|pr.xima|propera|orientativ|prevista?\b|previst/i
const CITA_REGLA  = /no podr. (comenzar|celebrarse)|transcurrid|seg.n (las )?bases|base \d|conforme a|establece que|m.nimo de \d|plazo de \d+ (meses|d.as|h.biles)|dos meses|se determinar. con|con un m.nimo/i
const REF_BOLETIN = /(BOE|BOCM|BORM|BOP|DOGV|DOGC|DOG|BOC|BOCYL|BOIB|BON|BOPV|BOJA|BOR|BOCCE|BOUC|BOA|DOE|BOPA)[\s\wº#-]{0,12}?(\d|A-\d)|(Orden|Decreto|Resoluci.n|RD)\s*[\wº/]*\d{1,4}\/\d{4}/i

function clasificar(h) {
  const tipo = (TIPO.find(([, rx]) => rx.test(h.titulo)) || ['otro'])[0]
  let origen = 'registro'
  if (NO_REGISTRO.test(`${h.titulo} ${h.descripcion || ''}`)) {
    if (REF_BOLETIN.test(h.titulo) || h.url) origen = 'registro'
    else origen = CITA_REGLA.test(h.descripcion || '') ? 'inferencia' : 'estimacion'
  }
  return { tipo, origen }
}

module.exports = { clasificar, TIPO }

if (require.main === module) {
  ;(async () => {
    const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await c.connect()
    const rows = (await c.query(`SELECT id, titulo, coalesce(descripcion,'') descripcion, url FROM convocatoria_hitos`)).rows
    const vals = rows.map(r => ({ id: r.id, ...clasificar(r) }))
    const cnt = f => vals.reduce((a, r) => (a[f(r)] = (a[f(r)] || 0) + 1, a), {})

    console.log(APPLY ? '=== APLICANDO' : '=== DRY-RUN (no escribe; usa --apply)')
    console.log(`hitos: ${vals.length} · tipados: ${vals.filter(v => v.tipo !== 'otro').length}`)
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
