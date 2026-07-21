export const meta = {
  name: 'verify-scope-oposicion',
  description: 'Doble verificación scope↔epígrafe de los temas de una oposición (analista+escéptico anclados a BOE, juez si discrepan). Devuelve propuestas quitar/añadir por ley para el pipeline verify:scope plan/apply.',
  whenToUse: 'Tras `verify:scope dump <pt>`. Pasa el dump como args. La salida va a `verify:scope plan`.',
  phases: [
    { title: 'Verificar', detail: '2 verificadores independientes por tema' },
    { title: 'Juez', detail: 'resuelve discrepancias' },
  ],
}

// args = salida de `verify:scope dump` (array de temas) o {temas:[...]}. Puede
// llegar como string JSON (gotcha conocido) → parse defensivo.
const RAW = typeof args === 'string' ? JSON.parse(args) : args
const TEMAS = (Array.isArray(RAW) ? RAW : (RAW && RAW.temas) || []).map((t) => ({
  tema: t.tema,
  title: t.titulo || t.title || '',
  epigrafe: t.epigrafe || '',
  leyes: (t.scope || t.leyes || []).map((s) => ({
    ley: s.ley,
    arts: (s.arts || []).map(String),
    sobre_inclusion: s.sobre_inclusion || null, // pre-filtro determinista del dump (scopeOverInclusion)
  })),
}))

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    porLey: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ley: { type: 'string' },
          quitar: { type: 'array', items: { type: 'integer' }, description: 'arts en el scope pero FUERA de los títulos/capítulos del epígrafe (sobre-inclusión)' },
          anadir: { type: 'array', items: { type: 'integer' }, description: 'arts que el epígrafe pide pero NO están en el scope (sub-inclusión)' },
          razon: { type: 'string', description: 'mapeo capítulo→artículos usado + fuente BOE' },
        },
        required: ['ley', 'quitar', 'anadir', 'razon'],
      },
    },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja', 'na_editorial'] },
  },
  required: ['porLey', 'confianza'],
}

function fmtLeyes(t) {
  return t.leyes.map((l) => `- ${l.ley}: [${l.arts.join(',')}]${l.sobre_inclusion
    ? ` ⚠️ PRE-FILTRO DETERMINISTA: POSIBLE SOBRE-INCLUSIÓN [${l.sobre_inclusion.band}] — ${l.sobre_inclusion.motivo}. DEBES mapear el epígrafe a títulos/capítulos y poner en 'quitar' los arts de títulos que el epígrafe NO nombra; NO concluyas "cabe toda la ley" sin ese mapeo.`
    : ''}`).join('\n')
}

function verifyPrompt(t, lens) {
  return `Eres un verificador de temario de oposiciones españolas. Rol: ${lens}. Verifica si el SCOPE (artículos cargados en la plataforma) de este tema coincide EXACTAMENTE con lo que pide su EPÍGRAFE oficial.

TEMA ${t.tema}: ${t.title}
EPÍGRAFE OFICIAL: ${t.epigrafe}

SCOPE ACTUAL (por ley):
${fmtLeyes(t)}

Para CADA ley del scope:
1. Identifica qué Títulos/Capítulos/Secciones nombra el epígrafe para ESA ley concreta.
2. Determina el conjunto EXACTO de artículos de esos Títulos/Capítulos según el texto CONSOLIDADO VIGENTE del BOE. Si tienes CUALQUIER duda sobre los límites de un capítulo/título, VERIFÍCALO con WebSearch ("<ley> BOE consolidado índice") o WebFetch a boe.es. NO uses rangos aproximados.
3. Compara: quitar = arts del scope FUERA de lo que nombra el epígrafe; anadir = arts que el epígrafe SÍ pide pero NO están.
4. CONSERVADOR: solo pon un artículo en 'quitar' si estás SEGURO de que está fuera. Ante duda, no lo quites y baja la confianza.

IMPORTANTE — leyes EDITORIALES de informática/ofimática (Windows, Word, Excel, Outlook, Microsoft 365, Teams, Explorador, Informática Básica): NO son leyes del BOE. Para esas devuelve quitar/anadir vacíos y confianza 'na_editorial'.

El artículo 0 suele ser preámbulo: no lo toques salvo evidencia clara.

Devuelve por ley: quitar[], anadir[], razon (mapeo Capítulo→artículos + fuente).`
}

phase('Verificar')

const results = await pipeline(
  TEMAS,
  (t) => parallel([
    () => agent(verifyPrompt(t, 'ANALISTA riguroso'), { label: `T${t.tema}:analista`, phase: 'Verificar', schema: SCHEMA }),
    () => agent(verifyPrompt(t, 'ESCEPTICO que busca errores del analista y sobre-inclusiones ocultas'), { label: `T${t.tema}:esceptico`, phase: 'Verificar', schema: SCHEMA }),
  ]).then(([a, b]) => ({ t, a, b })),
  async ({ t, a, b }) => {
    const norm = (v) => JSON.stringify(
      (v?.porLey || [])
        .map((l) => ({ ley: l.ley, q: [...(l.quitar || [])].sort((x, y) => x - y), n: [...(l.anadir || [])].sort((x, y) => x - y) }))
        .sort((x, y) => (x.ley < y.ley ? -1 : 1)),
    )
    if (!a || !b) return { tema: t.tema, title: t.title, status: 'error_agente', veredicto: (a || b || {}).porLey || [] }
    if (norm(a) === norm(b)) return { tema: t.tema, title: t.title, status: 'consenso', confianza: a.confianza, veredicto: a.porLey }
    const judge = await agent(
      `Dos verificadores DISCREPAN sobre el scope de un tema. Decide el veredicto CORRECTO por ley (quitar/anadir), anclado al BOE consolidado (verifica con WebSearch/WebFetch si hace falta). CONSERVADOR: ante duda no quitar.

TEMA ${t.tema}: ${t.title}
EPÍGRAFE: ${t.epigrafe}
SCOPE:
${fmtLeyes(t)}

VERIFICADOR A (analista): ${JSON.stringify(a)}
VERIFICADOR B (escéptico): ${JSON.stringify(b)}`,
      { label: `T${t.tema}:juez`, phase: 'Juez', schema: SCHEMA },
    )
    return { tema: t.tema, title: t.title, status: 'juez', confianza: judge?.confianza, veredicto: judge?.porLey || [], discrepancia: { a: a.porLey, b: b.porLey } }
  },
)

const finales = results.filter(Boolean)
const conCambios = finales.filter((r) => (r.veredicto || []).some((l) => (l.quitar || []).length || (l.anadir || []).length))
return { total: finales.length, conCambios: conCambios.length, detalle: finales }
