// lib/admin/runbookRegistry.ts
//
// FUENTE ÚNICA que mapea cada `kind` de content_health_findings (lo que detecta el
// sweep nocturno, scripts/health-sweep.cjs) → el RUNBOOK que lo arregla + la
// FRASE-GATILLO exacta que el operador (Manuel) le dice a Claude Code para que lo
// siga. Resuelve la "confluencia": el panel de salud acumula muchos kinds, cada uno
// con su remediación distinta.
//
// Lo consume:
//   - /admin/salud-sistema (y /admin/contenido): un chip "→ dile a Claude: «…»" por
//     finding + la "Guía de runbooks" completa. Data-driven → añadir un kind = 1 fila.
//   - El guardarraíl __tests__/lib/admin/runbookRegistry.test.ts: verifica que NO hay
//     kind huérfano (todo finding tiene guía), que cada runbook existe como fichero, y
//     que cada frase-gatillo está registrada en CLAUDE.md (donde Claude la lee).
//
// Client-safe: sin imports de servidor.

export interface RunbookEntry {
  /** título humano del tipo de hallazgo */
  title: string
  /** frase EXACTA a decirle a Claude Code para que siga el runbook */
  triggerPhrase: string
  /** ruta del runbook en el repo (null = sin runbook dedicado, ad-hoc) */
  runbook: string | null
  /** qué hace Claude al seguir el runbook (resumen para la guía) */
  claudeHace: string
}

// Varias señales de FALLO de app comparten un único runbook y frase (health-check).
const HEALTH_CHECK: Omit<RunbookEntry, 'title'> = {
  triggerPhrase: 'busca errores',
  runbook: 'docs/runbooks/health-check.md',
  claudeHace: 'sigue el runbook de salud: mira 5xx, drift, latencia y endpoints caídos, y propone el arreglo.',
}

// Mapa kind → entrada. Cubre TODOS los kinds que emite el sweep (ver migración
// 20260710_content_health_findings.sql + scripts/health-sweep.cjs).
export const RUNBOOK_BY_KIND: Record<string, RunbookEntry> = {
  // ── APP (fallos: usuario topa con error) → runbook health-check ──
  http_down: { title: 'Página caída (HTTP≠200)', ...HEALTH_CHECK },
  http_5xx: { title: 'Errores 5xx', ...HEALTH_CHECK },
  server_render_error: { title: 'Error de render en servidor', ...HEALTH_CHECK },
  render_error: { title: 'Error de render', ...HEALTH_CHECK },
  webhook_unhealthy: { title: 'Webhook roto', ...HEALTH_CHECK },
  // ── CONVOCATORIAS: el proceso fiel al documento oficial (docs/runbooks/verificar-convocatorias.md) ──
  convocatoria_timeline_incoherente: {
    title: 'Timeline de convocatoria incoherente',
    triggerPhrase: 'revisa el timeline de convocatorias',
    runbook: 'docs/runbooks/verificar-convocatorias.md',
    claudeHace: 'arregla los hitos que se contradicen entre sí (orden imposible, dos fechas de examen para el mismo ciclo) contra la fuente oficial.',
  },
  convocatoria_timeline_caducado: {
    title: 'Previsión caducada o estado que contradice su fecha',
    triggerPhrase: 'revisa el timeline de convocatorias',
    runbook: 'docs/runbooks/verificar-convocatorias.md',
    claudeHace: 'asciende la previsión a registro si ya hay documento que la fije, o la re-estima dejando claro que es previsión. Una previsión es una afirmación con fecha de caducidad.',
  },
  empty_topic: {
    title: 'Tema publicado sin preguntas',
    triggerPhrase: 'revisa los temas vacíos',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'localiza el/los temas disponibles con 0 preguntas y decide despublicar o generar preguntas.',
  },

  // ── CONTENIDO (calidad: dato mal, app funciona) ──
  plaza_card: {
    title: 'Tarjeta de plazas incoherente',
    triggerPhrase: 'revisa la coherencia de las tarjetas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'cruza las tarjetas de landing con la convocatoria vigente y corrige el número que no cuadra (verificando contra el boletín).',
  },
  temas_card: {
    title: 'Tarjeta/contador de temas incoherente',
    triggerPhrase: 'revisa la coherencia de las tarjetas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'cuadra temas_count y las tarjetas de "temas" con los topics reales de la oposición.',
  },
  dual_write: {
    title: 'Dual-write de convocatoria incompleto',
    triggerPhrase: 'revisa el dual-write de convocatorias',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'completa los campos de convocatoria que faltan (boe, programa, faqs, estadísticas…) desde la fuente oficial.',
  },
  no_hitos: {
    title: 'Inscripción abierta sin hitos (timeline vacío)',
    triggerPhrase: 'revisa los hitos de convocatoria',
    runbook: 'docs/runbooks/rollover-oposiciones.md',
    claudeHace: 'reconstruye el timeline de hitos de la convocatoria vigente contra la fuente oficial.',
  },
  seguimiento_url_stale: {
    title: 'seguimiento_url que vigila un ciclo ya cerrado',
    triggerPhrase: 'revisa las urls de seguimiento',
    runbook: 'docs/maintenance/oeps-convocatorias-seguimiento.md',
    claudeHace: 'para cada oposición señalada, verifica contra fuente oficial si la `seguimiento_url` apunta a la convocatoria VIGENTE o a un ciclo ya cerrado. Si está desfasada, repúntala a la página de la convocatoria viva Y pon `seguimiento_last_hash=NULL` (si no, la siguiente pasada del cron da un `changed` falso garantizado). `stale_boletin` (apunta a un documento de boletín inmutable de año viejo) es casi seguro; `posible_ciclo_viejo`/`url_generica` son cola de revisión: pueden ser legítimas (OPE plurianual, portal sin página propia). NUNCA repuntar sin confirmar la URL nueva contra fuente oficial.',
  },
  texto_examen_pasado: {
    title: 'Textos de la landing anuncian un examen ya pasado como vigente',
    triggerPhrase: 'revisa los textos de examen pasado',
    runbook: 'docs/runbooks/rollover-oposiciones.md',
    claudeHace: 'para cada oposición marcada, mira sus `landing_faqs`/`landing_description` (nivel convocatoria vigente y oposición): un texto tipo "¿Cuándo es el examen? El 18 de abril de 2026" con fecha pasada engaña al opositor. Verifica el estado real contra fuente oficial (¿pivotó la oposición a un ciclo nuevo? ¿cuál es el dato correcto?) y reescribe el texto pivotando hacia delante (el examen se celebró / la próxima convocatoria está pendiente), NUNCA inventando fecha nueva. Es el punto ciego del badge de rollover, que solo mira `exam_date`. GOTCHA: al reescribir `landing_faqs` (jsonb) usar `sql.json(x)`, no `JSON.stringify(x)::jsonb` (lo guarda doble-codificado y rompe el render).',
  },
  hito_vencido_abierto: {
    title: 'Hitos "próximos" con la fecha ya pasada',
    triggerPhrase: 'revisa los hitos vencidos',
    runbook: 'docs/runbooks/rollover-oposiciones.md',
    claudeHace: 'mira `convocatoria_hitos` con status=upcoming y fecha < hoy, y distingue por `origen`: si es `registro`, la fecha era REAL y el evento ya ocurrió (cerrarlo a `completed`; si era el examen, probablemente toque rollover). Si es `estimacion`, la fecha nos la inventamos como marcador y encima venció: NO se publica (el render la oculta desde el 20/07) pero hay que revisarla contra fuente oficial o quitarla. NUNCA convertir una estimación en fecha oficial sin cita literal de boletín.',
  },
  low_coverage: {
    title: 'Tema con cobertura fina (<6 preguntas)',
    triggerPhrase: 'revisa la cobertura de temas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'lista los temas con pocas preguntas y decide importar/generar más para esa oposición.',
  },
  article_no_coverage: {
    title: 'Artículos del temario sin ninguna pregunta',
    triggerPhrase: 'revisa los artículos sin preguntas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'localiza los artículos que están en el topic_scope y tienen contenido real pero 0 preguntas activas (al usuario nunca le salen en los tests aunque el tema en conjunto sí tenga preguntas), y genera preguntas ancladas al texto del artículo con doble auditoría ciega antes de activarlas. Excluye derogados.',
  },
  flattened_table: {
    title: 'Tabla aplanada (import PDF sin rejilla)',
    triggerPhrase: 'revisa las tablas de artículos',
    runbook: 'docs/runbooks/tablas-articulos.md',
    claudeHace: 'reconstruye la tabla Markdown a partir de las celdas existentes (2 vs 3 columnas según cabecera), con verificación humana de las cifras, y la escribe en el content.',
  },
  stale_dated_law: {
    title: 'Ley anual caducada en el temario',
    triggerPhrase: 'revisa las leyes anuales caducadas',
    runbook: 'docs/runbooks/leyes-anuales-caducadas.md',
    claudeHace: 'localiza la ley "para el año XXXX" ya pasado que sigue escopada, la actualiza a la versión vigente (importándola si falta) y genera las preguntas que falten — NUNCA la quita si el epígrafe la pide.',
  },
  audit_note_explanation: {
    title: 'Explicación = nota de auditoría (defecto de pipeline)',
    triggerPhrase: 'revisa las explicaciones rotas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'localiza las preguntas visibles cuya "explicación" es en realidad la crítica de un pase IA anterior ("La explicación debería…", "posible errata", "Nota técnica:", "Esta pregunta debería anularse"), verifica la clave contra la ley/fuente y reescribe la explicación (o la manda a needs_human si hay defecto de fondo) con el flujo de `docs/maintenance/revisar-preguntas-con-agente.md`.',
  },
  law_unverified_source: {
    title: 'Ley sin verificar contra su fuente (falso verde / importada a medias)',
    triggerPhrase: 'revisa la completitud de las leyes',
    runbook: 'docs/runbooks/completitud-leyes.md',
    claudeHace: 'localiza las leyes que sirven en temas vivos sin verificar contra su fuente oficial (`false_green` = marcada "actualizada" sin evidencia, `no_source` = sin URL de fuente, `never_verified`, `incomplete` = faltan artículos), registra la fuente que falte, compara artículo por artículo contra el boletín oficial e importa lo que falte (verbatim, doble auditoría) — NUNCA marca verificada sin evidencia.',
  },
  article_annulled_unmarked: {
    title: 'Inciso anulado por el TC (o disposición derogada) servido sin nota de vigencia',
    triggerPhrase: 'revisa los incisos anulados',
    runbook: 'docs/runbooks/incisos-anulados-tc.md',
    claudeHace: 'corre `scripts/audit-annulled-provisions.cjs` (cruza el análisis del BOE datosabiertos — referencias posteriores "SE DECLARA … inconstitucional/nulidad … art. N" — con nuestros artículos) y para cada hallazgo (artículo que servimos SIN nota de vigencia pese a estar anulado por una STC) verifica el inciso concreto contra la sentencia, añade la nota de vigencia al artículo y REVISA la clave de las preguntas de ese artículo (que no den por válido el inciso anulado). NUNCA auto-corrige la clave: revisión humana como en el caso art. 126.2 LBRL / STC 103/2013.',
  },
  scope_titulo_huerfano: {
    title: 'Título con preguntas huérfanas (hueco interno del temario)',
    triggerPhrase: 'revisa los huecos del temario',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    claudeHace: 'para cada oposición señalada corre el pipeline verify:scope (dump → 2 agentes epígrafe↔scope → consenso): el detector marca un título de una ley que la oposición usa, con preguntas activas y flanqueado a ambos lados por artículos escopados, pero con 0 artículos suyos en el scope. Decide contra el epígrafe oficial si el hueco es REAL (el epígrafe nombra ese título → añade su rango de artículos al topic_scope del tema que corresponde, reusando las preguntas ya en BD) o LEGÍTIMO (el programa no lo incluye → dejarlo). NUNCA añade un título que el epígrafe no pida ni quita contenido que sí pida.',
  },
  answer_in_annulled_fragment: {
    title: 'Pregunta activa cuya clave reproduce un inciso ANULADO por el TC',
    triggerPhrase: 'revisa los incisos anulados',
    runbook: 'docs/runbooks/incisos-anulados-tc.md',
    claudeHace: 'para cada artículo señalado verifica la clave de la pregunta contra la sentencia del TC: el gate (≥60 car. de la clave dentro del inciso anulado) es un CANDIDATO, no un bug confirmado — hay falsos positivos cuando la clave y el inciso comparten la cláusula inicial pero difieren en el fondo. Si la clave reproduce de verdad el texto anulado, corrige (nota de vigencia en el artículo + revisar la pregunta); NUNCA auto-flip de clave.',
  },
  convocatoria_docs_incompletos: {
    title: 'Provenance de convocatoria incompleta (documento referenciado sin clonar/enlazar)',
    triggerPhrase: 'revisa la provenance de convocatorias',
    runbook: 'docs/runbooks/provenance-convocatorias.md',
    claudeHace: 'para cada oposición señalada lee la vista convocatoria_docs_coverage: primero enlaza lo ya clonado sin fetch (scripts/backfill-hito-source-documento.cjs --apply), luego clona los documentos referenciados que falten desde su URL oficial (backend/scripts/clonar-documento.ts, con content_hash + snapshot, tipo real no "nota") y enlaza source_documento_id, y resuelve las citas sin fuente. NUNCA clona sin verificar la URL oficial ni fabrica cita/hash; si la URL da 403/está caída deja el hueco anotado. Los hitos huérfanos (convocatoria_id NULL) se asignan primero a su convocatoria mirando la fecha del hito.',
  },
}

/** Todos los kinds conocidos (para el guardarraíl anti-huérfano). */
export const KNOWN_KINDS = Object.keys(RUNBOOK_BY_KIND)

/** Entrada para un kind, o undefined si es un kind nuevo sin registrar (bug a cerrar). */
export function runbookForKind(kind: string | null | undefined): RunbookEntry | undefined {
  return kind ? RUNBOOK_BY_KIND[kind] : undefined
}

/** Filas únicas por frase-gatillo, para la "Guía de runbooks" (agrupa health-check). */
export function runbookGuideRows(): Array<RunbookEntry & { kinds: string[] }> {
  const byPhrase = new Map<string, RunbookEntry & { kinds: string[] }>()
  for (const [kind, entry] of Object.entries(RUNBOOK_BY_KIND)) {
    const existing = byPhrase.get(entry.triggerPhrase)
    if (existing) existing.kinds.push(kind)
    else byPhrase.set(entry.triggerPhrase, { ...entry, kinds: [kind] })
  }
  return [...byPhrase.values()]
}
