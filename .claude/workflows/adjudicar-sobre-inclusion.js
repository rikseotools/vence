export const meta = {
  name: 'adjudicar-sobre-inclusion',
  description: 'Stage-2 de la detección de sobre-inclusión de scope: por cada sospechoso, mapea el epígrafe a la estructura oficial de la ley (BOE/BORM), lista los títulos escopados que el epígrafe NO nombra, y verifica adversarialmente antes de confirmar. Salida lista para `scope-over-inclusion.cjs --record`.',
  whenToUse: 'Tras `node scripts/scope-over-inclusion.cjs --suspects [--only-new]`. Pasa el JSON como args.',
  phases: [
    { title: 'Adjudicar', detail: 'mapea epígrafe→estructura oficial, lista títulos excluidos' },
    { title: 'Verificar', detail: 'refuta adversarialmente cada over_inclusion' },
  ],
}

// args = salida de `--suspects` (array). Puede llegar como string JSON (gotcha conocido).
const RAW = typeof args === 'string' ? JSON.parse(args) : args
const SUS = (Array.isArray(RAW) ? RAW : (RAW && RAW.suspects) || [])

const ADJ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['over_inclusion', 'ok', 'unverifiable'] },
    titulos_excluidos: {
      type: 'array',
      description: 'títulos/capítulos de la ley con artículos ESCOPADOS que el epígrafe NO nombra',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          titulo: { type: 'string' }, arts: { type: 'string' }, materia: { type: 'string' },
        },
        required: ['titulo', 'arts', 'materia'],
      },
    },
    arts_correctos: { type: 'string', description: 'rango de artículos que el epígrafe SÍ pide (si over_inclusion); vacío si ok' },
    razon: { type: 'string', description: 'mapeo epígrafe→título usado + fuente oficial consultada' },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
  },
  required: ['verdict', 'titulos_excluidos', 'arts_correctos', 'razon', 'confianza'],
}

const VER_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    confirmado: { type: 'boolean', description: 'true solo si la sobre-inclusión se sostiene tras intentar refutarla' },
    razon: { type: 'string' },
  },
  required: ['confirmado', 'razon'],
}

function adjudicaPrompt(s) {
  return `Eres adjudicador de temario de oposiciones españolas. Un pre-filtro determinista marcó este (tema, ley) como POSIBLE SOBRE-INCLUSIÓN: el epígrafe enumera sub-materias concretas pero el scope mete casi la ley entera. Tu trabajo: verificarlo contra la ESTRUCTURA OFICIAL de la ley y decidir.

TEMA ${s.topic_number}: ${s.title} (${s.position_type})
EPÍGRAFE OFICIAL: ${s.epigrafe}
LEY: ${s.ley_nombre || s.law}
FUENTE OFICIAL: ${s.boe_url || '(sin boe_url — BÚSCALA con WebSearch: "<ley> BOE/BORM consolidado índice")'}
SCOPE ACTUAL: artículos ${s.scoped_range} (${s.scoped_count} de ${s.law_total} de la ley) — banda ${s.band}
Señal determinista: ${(s.reasons || []).join('; ')}

METODOLOGÍA OBLIGATORIA (es la que evita el falso verde):
1. Obtén la estructura oficial de la ley (índice de TÍTULOS/CAPÍTULOS con su rango de artículos) con WebFetch a la fuente. Si no hay URL o no carga, WebSearch del índice consolidado. Si NO puedes verificar la estructura con fuente, verdict='unverifiable'.
2. Mapea CADA materia que NOMBRA el epígrafe a su(s) título(s)/capítulo(s) y rango de artículos.
3. Lista los títulos/capítulos que tienen artículos ESCOPADOS pero que el epígrafe NO nombra → 'titulos_excluidos'.
4. verdict='over_inclusion' si hay títulos escopados fuera del epígrafe (con arts_correctos = el rango que el epígrafe SÍ pide); 'ok' si el epígrafe realmente abarca (casi) toda la ley; 'unverifiable' si no pudiste comprobar la estructura.

NO uses word-matching (el epígrafe describe MATERIAS, un artículo puede regularlas sin repetir la palabra). NO concluyas "abarca toda la ley" sin haber mapeado los títulos. Ante duda genuina sobre un título, NO lo pongas en excluidos (conservador).`
}

function verificaPrompt(s, adj) {
  return `Verificación ADVERSARIAL. Otro agente afirma que este tema tiene SOBRE-INCLUSIÓN de scope. Tu trabajo es intentar REFUTARLO. Por defecto confirmado=false salvo que la sobre-inclusión se sostenga con claridad.

TEMA ${s.topic_number}: ${s.title}
EPÍGRAFE: ${s.epigrafe}
LEY: ${s.ley_nombre || s.law} — fuente: ${s.boe_url || '(buscar con WebSearch)'}
Afirmación a refutar: el scope incluye estos títulos que el epígrafe NO nombra → ${JSON.stringify(adj.titulos_excluidos)}. Rango correcto propuesto: ${adj.arts_correctos}.

Comprueba contra la estructura oficial (WebFetch/WebSearch): ¿de verdad esos títulos quedan FUERA de lo que el epígrafe pide? Considera que el epígrafe describe MATERIAS (una materia puede abarcar un título entero aunque no lo nombre literalmente). Si alguna de las "exclusiones" en realidad SÍ la pide el epígrafe (por materia), la sobre-inclusión NO se sostiene → confirmado=false. Solo confirmado=true si los títulos excluidos son clara e inequívocamente ajenos al epígrafe.`
}

const results = await pipeline(
  SUS,
  (s) => agent(adjudicaPrompt(s), { label: `adj:${s.position_type}·T${s.topic_number}`, phase: 'Adjudicar', model: 'sonnet', schema: ADJ_SCHEMA })
    .then((v) => ({ s, v })),
  ({ s, v }) => {
    if (!v) return { s, v: null }
    if (v.verdict !== 'over_inclusion') return { s, v, ver: null } // ok / unverifiable no necesitan refutación
    return agent(verificaPrompt(s, v), { label: `ver:${s.position_type}·T${s.topic_number}`, phase: 'Verificar', model: 'sonnet', schema: VER_SCHEMA })
      .then((w) => ({ s, v, ver: w }))
  }
)

// Salida en el formato exacto de `scope-over-inclusion.cjs --record`.
const salida = results.filter(Boolean).filter((r) => r.v).map((r) => ({
  topic_id: r.s.topic_id,
  law_id: r.s.law_id,
  content_hash: r.s.content_hash,
  band: r.s.band,
  verdict: r.v.verdict,
  titulos_excluidos: r.v.titulos_excluidos,
  arts_correctos: r.v.arts_correctos,
  razon: r.v.razon,
  verificado: r.v.verdict === 'over_inclusion' ? !!(r.ver && r.ver.confirmado) : false,
}))

const conf = salida.filter((x) => x.verdict === 'over_inclusion' && x.verificado)
const oks = salida.filter((x) => x.verdict === 'ok')
const unv = salida.filter((x) => x.verdict === 'unverifiable')
const noConf = salida.filter((x) => x.verdict === 'over_inclusion' && !x.verificado)
log(`Adjudicados ${salida.length}/${SUS.length}: ${conf.length} sobre-inclusión CONFIRMADA · ${noConf.length} over pero NO confirmada · ${oks.length} ok · ${unv.length} unverifiable`)

return { total: SUS.length, adjudicados: salida.length, confirmadas: conf.length, ok: oks.length, unverifiable: unv.length, resultados: salida }
