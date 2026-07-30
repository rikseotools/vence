// lib/observability/llmCallSites.ts — REGISTRO de todo sitio del repo que habla con un LLM.
//
// Contesta una sola pregunta, y la contesta ANTES de mirar una factura: **¿qué parte de nuestro
// gasto en LLM es invisible?**
//
// ## Por qué existe (26/07/2026)
//
// `lib/observability/llm.ts` instrumenta los clientes compartidos (`getAnthropic`/`getOpenAI`) y
// emite `llm_call` con modelo, tokens y coste estimado — pero **solo pasa por ahí quien usa el
// cliente compartido**. Medido al montar este registro: de **27 call-sites**, **15 hablaban con
// el proveedor en crudo** (`new OpenAI()`, `fetch('https://api.anthropic.com'…)`, OpenRouter), o
// sea que más de la mitad del gasto no aparecía en ningún sitio. Los ~31,7 USD/30 días que
// enseñaban los eventos eran un SUELO, no el total, y nadie podía saberlo.
//
// El problema no es que falte instrumentación: es que **nada obliga a instrumentar**. Un call-site
// nuevo escrito con el SDK crudo entra sin hacer ruido. Esto lo convierte en un contrato.
//
// ## Cómo se hace cumplir (no depende de que nadie lea esto)
//
// `__tests__/guardrails/llmInstrumentation.guardrail.test.ts` (CI, sin red ni BD) escanea el repo:
//   · todo call-site que hable con un proveedor DEBE estar en este registro;
//   · los `crudo` DEBEN declarar por qué lo son;
//   · **trinquete**: el número de crudos no puede crecer. Bajar sí, subir no.
//
// Mismo patrón que `toolRegistry` (columna→herramienta), `runbookRegistry` (kind→guía) y
// `landingSurfaces` (superficie→detector). En este repo, un registro sin test es documentación
// que caduca.
//
// ## Relación con el guardarraíl que YA existía
//
// `__tests__/guardrails/llmClientsInstrumented.test.ts` comprueba que todo `new Anthropic(`/
// `new OpenAI(` de `app|lib` vaya envuelto por el instrumentador. Cubre el caso del SDK en el
// frontend, y bien; lo que no ve —y por eso existe este registro— es el `fetch` directo a la API,
// OpenRouter, el backend NestJS y los scripts, que es donde estaban 15 de los 15 crudos. Los dos
// se complementan: aquel vigila la FORMA de crear el cliente, este la COBERTURA del inventario.

export type EstadoInstrumentacion =
  /** Pasa por el cliente compartido instrumentado → emite `llm_call`. El gasto se ve. */
  | 'instrumentado'
  /** Habla con el proveedor en crudo → su gasto NO aparece en ningún sitio. */
  | 'crudo'

export interface LlmCallSite {
  /** Ruta relativa al repo. El guardarraíl comprueba que existe. */
  ruta: string
  estado: EstadoInstrumentacion
  /** Qué consume, para poder atribuir el gasto cuando se instrumente. */
  feature: string
  /** Obligatorio si `crudo`: por qué sigue sin instrumentar y qué haría falta. */
  motivo?: string
}

export const LLM_CALL_SITES: LlmCallSite[] = [
  // ── Instrumentados: pasan por getAnthropic()/getOpenAI() y emiten `llm_call` ───────────────
  { ruta: 'lib/chat/shared/anthropic.ts', estado: 'instrumentado', feature: 'chat' },
  { ruta: 'lib/chat/shared/openai.ts', estado: 'instrumentado', feature: 'chat' },
  { ruta: 'backend/src/anthropic/anthropic.service.ts', estado: 'instrumentado', feature: 'detect_notas/oep_signals' },
  { ruta: 'scripts/detect-wrong-articles.cjs', estado: 'instrumentado', feature: 'mantenimiento' },
  { ruta: 'scripts/fix-article-explanations.cjs', estado: 'instrumentado', feature: 'mantenimiento' },
  { ruta: 'scripts/fix-wrong-articles.cjs', estado: 'instrumentado', feature: 'mantenimiento' },
  { ruta: 'scripts/generate-embeddings.cjs', estado: 'instrumentado', feature: 'embeddings' },
  { ruta: 'scripts/generate-knowledge-embeddings.cjs', estado: 'instrumentado', feature: 'embeddings' },
  { ruta: 'scripts/improve-auxilio-judicial-explanations.cjs', estado: 'instrumentado', feature: 'mantenimiento' },
  { ruta: 'scripts/improve-tramitacion-procesal.cjs', estado: 'instrumentado', feature: 'mantenimiento' },
  { ruta: 'scripts/oposiciones/analizar-preguntas-sin-ley.cjs', estado: 'instrumentado', feature: 'mantenimiento' },
  { ruta: 'scripts/oposiciones/validar-programa-completo.cjs', estado: 'instrumentado', feature: 'mantenimiento' },

  { ruta: 'scripts/observabilidad/ab-modelo-notas.cjs', estado: 'instrumentado', feature: 'ab_notas' },
  { ruta: 'scripts/observabilidad/ab-modelo-vinculo-vecino.cjs', estado: 'instrumentado', feature: 'ab_vinculo_vecino' },
  { ruta: 'scripts/observabilidad/ab-modelo-transformacion.cjs', estado: 'instrumentado', feature: 'ab_transformacion' },

  // ── Crudos: gasto INVISIBLE. Cada uno con lo que hace falta para cerrarlo ──────────────────
  {
    ruta: 'app/api/generate-explanation/route.ts',
    estado: 'crudo',
    feature: 'generar_explicacion',
    motivo: 'crea su propio `new OpenAI()` en vez de `getOpenAI()`. Cambio de una línea; es endpoint de app (gasto recurrente), así que es el primero a cerrar.',
  },
  {
    ruta: 'app/api/verify-articles/ai-verify/route.ts',
    estado: 'crudo',
    feature: 'verificar_articulos',
    motivo: 'endpoint admin que llama al proveedor directo. Mismo arreglo: cliente compartido.',
  },
  {
    ruta: 'lib/api/verify-articles/ai-helpers.ts',
    estado: 'crudo',
    feature: 'verificar_articulos',
    motivo: '`fetch` directo a la API de OpenAI. Necesita el wrapper de fetch instrumentado, no solo el SDK.',
  },
  {
    ruta: 'app/api/topic-review/verify/route.js',
    estado: 'crudo',
    feature: 'revision_temas',
    motivo: 'endpoint en JS antiguo; hay que migrarlo al cliente compartido.',
  },
  {
    ruta: 'app/api/admin/ai-config/test/route.ts',
    estado: 'crudo',
    feature: 'admin_test_config',
    motivo: 'prueba de configuración disparada a mano desde el panel: gasto puntual y mínimo, pero conviene que aparezca para no tener puntos ciegos por comodidad.',
  },
  {
    ruta: 'app/api/ai/balance/route.js',
    estado: 'crudo',
    feature: 'consulta_saldo',
    motivo: 'consulta el saldo del proveedor; no genera tokens de modelo. Candidato a quedar exento de forma explícita.',
  },
  {
    ruta: 'backend/src/canary-ai-model/canary-ai-model.service.ts',
    estado: 'crudo',
    feature: 'canary_modelo',
    motivo: '`fetch` directo a la API de Anthropic. Corre en bucle como canario: poco por llamada, pero constante — justo lo que conviene ver medido.',
  },
  {
    ruta: 'scripts/audit-shuffle-safety-llm.ts',
    estado: 'crudo',
    feature: 'auditoria_shuffle',
    motivo: 'usa OpenRouter, que hoy no tiene cliente compartido. Cerrarlo exige añadir OpenRouter como proveedor al núcleo (`LlmProvider`) con su tabla de precios.',
  },
  {
    ruta: 'scripts/improve-explanations-claude.cjs',
    estado: 'crudo',
    feature: 'mantenimiento',
    motivo: 'script de mantenimiento con cliente propio; se corre a mano en campañas de contenido, que es cuando más se gasta.',
  },
  {
    ruta: 'scripts/fix-excel-questions.cjs',
    estado: 'crudo',
    feature: 'mantenimiento',
    motivo: 'ídem: cliente propio en un script de campaña.',
  },
  {
    ruta: 'scripts/show-example-fix.cjs',
    estado: 'crudo',
    feature: 'mantenimiento',
    motivo: 'utilidad de inspección; gasto anecdótico, pero registrado para que el inventario sea completo.',
  },
  {
    ruta: 'scripts/regenerate-article-embeddings.mjs',
    estado: 'crudo',
    feature: 'embeddings',
    motivo: 'regenera embeddings en lote: barato por unidad y MUY voluminoso, así que es de los que más distorsionan el total sin verse.',
  },
  {
    ruta: 'scripts/regenerate-stale-embeddings.cjs',
    estado: 'crudo',
    feature: 'embeddings',
    motivo: 'ídem, en su variante incremental.',
  },
  {
    ruta: 'scripts/sim-notas-pipeline.cjs',
    estado: 'crudo',
    feature: 'simulacion',
    motivo: 'simulación del pipeline de notas: gasta de verdad aunque no escriba en BD. Verlo separado evita confundir una simulación cara con producción.',
  },
  {
    ruta: 'scripts/sim-seguimiento-ciego.cjs',
    estado: 'crudo',
    feature: 'simulacion',
    motivo: 'ídem para el sensor de seguimiento.',
  },
]

/** Call-sites cuyo gasto NO se ve hoy. */
export function crudos(): LlmCallSite[] {
  return LLM_CALL_SITES.filter((s) => s.estado === 'crudo')
}

/**
 * TRINQUETE: el número de call-sites crudos no puede crecer. Es el número medido el 26/07/2026,
 * cuando se montó el registro. Bajarlo al instrumentar uno es el objetivo; subirlo significa que
 * alguien ha abierto una puerta nueva al proveedor sin observabilidad.
 */
export const TECHO_CRUDOS = 15
