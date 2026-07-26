// lib/admin/toolRegistry.ts — REGISTRO de herramientas y capacidades operativas.
//
// Responde a una sola pregunta, y la responde ANTES de que alguien construya: **¿esto ya existe?**
//
// ## Por qué existe (T-130, 26/07/2026)
//
// Dos casos medidos el mismo día, los dos en una sola sesión:
//   · Se escribió `scripts/seguimiento/repuntar-url.cjs` para escribir `seguimiento_url` sin ver
//     que ya había otros escritores de esa columna. Dos puertas al mismo dato con criterios
//     distintos = el guardarraíl del bueno no protege nada, porque basta usar el otro.
//   · T-125 apuntaba "construir el headless-fetcher, requiere decidir si se delega por-fuente con
//     una columna tipo `seguimiento_fetch_mode`" cuando `oposiciones.fetcher_type` YA EXISTE, con
//     67 filas en `headless`, y los tres sensores vivos ya la respetan.
//
// Es el mismo patrón que el claim del backlog vino a arreglar, una capa más abajo: allí se
// duplicaba el TRABAJO, aquí se duplica la HERRAMIENTA.
//
// ## Cómo se hace cumplir (no depende de que nadie lea esto)
//
// `__tests__/guardrails/toolRegistry.guardrail.test.ts` escanea el repo con
// `lib/admin/toolWriters.ts` y pone el CI en rojo si aparece un escritor no registrado, si una
// herramienta viva escribe un recurso SIN pasar por su guardarraíl compartido, si crece el número
// de escritores de un recurso con trinquete, o si una entrada apunta a una ruta/runbook inexistente.
//
// Mismo patrón que `runbookRegistry` (kind→guía, con guardarraíl que exige la frase en CLAUDE.md),
// `content-sweep-parity` (CLI ↔ @Cron) y `backlogRegistry` (toda tarea con id). En este repo, un
// registro sin test es documentación que caduca.
//
// ## Búsqueda rápida
//
//   npm run tools:buscar <palabra>
//
// ANTES de construir cualquier herramienta operativa. Cinco segundos.

/** Estado de una herramienta. Determina si el guardarraíl la cuenta como puerta abierta. */
export type EstadoHerramienta =
  /** En uso. Si escribe un recurso `guardarrail_compartido`, DEBE pasar por su módulo guardarraíl. */
  | 'vivo'
  /** Se corrió una vez para una migración/construcción concreta. No reutilizar a ciegas. */
  | 'historico'
  /** Sustituida. Se conserva por trazabilidad; usar la de `reemplazadaPor`. */
  | 'deprecado'

export interface Herramienta {
  /** Qué resuelve, en una línea y en cristiano (esto es lo que se busca con tools:buscar). */
  titulo: string
  /** Ruta al script o módulo, relativa a la raíz del repo. El guardarraíl comprueba que existe. */
  ruta: string
  estado: EstadoHerramienta
  /** Recursos sensibles que ESCRIBE (columnas de `RECURSOS_SENSIBLES`). */
  escribe?: string[]
  /** Runbook donde se explica su uso. El guardarraíl comprueba que el fichero existe. */
  runbook?: string
  /** Solo si `deprecado`: clave de la herramienta que la sustituye. */
  reemplazadaPor?: string
  /** Contexto que evita reconstruirla: qué hace, qué NO hace, gotchas. */
  notas: string
}

export const TOOL_REGISTRY: Record<string, Herramienta> = {
  // ── programa_url (el enlace del botón oficial de la landing) ───────────────────────────────
  repuntar_enlace_convocatoria: {
    titulo: 'Cambiar el enlace del botón "Ver convocatoria en {diario}" de una landing (programa_url)',
    ruta: 'scripts/convocatoria/repuntar-enlace-convocatoria.cjs',
    estado: 'vivo',
    escribe: ['programa_url'],
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      'Dry-run por defecto. Comprueba con el registro compartido (`canonicalizeBoletinUrl`) que la ' +
      'URL es del boletín que promete la etiqueta —o exige `--etiqueta` para cambiarla a la vez—, ' +
      'descarga el documento (los PDF los lee con `pdftotext`, así que BOCM/BORM/BOPA también se ' +
      'verifican) y con `--anclas` obliga a que el texto mencione ESTE proceso. Hace DUAL-WRITE ' +
      '(`oposiciones` + convocatoria vigente: la landing lee la SSOT) y vuelve a leer la vista para ' +
      'confirmar que el hallazgo se apagó. Resetea `programa_last_hash` (el documento es otro; si no, ' +
      'la verificación de literalidad de epígrafe cantaría un `outdated_convocatoria` falso) y exige ' +
      '`--acepto-perder-temario` si la URL actual era el temario. Traza en `observable_events` ' +
      '(`convocatoria_enlace_repuntado`). NO purga la caché: eso va aparte y es per-instancia. ' +
      'Hermano de `repuntar_seguimiento_url`.',
  },
  auditar_landing_completa: {
    titulo: 'Auditar UNA landing entera (datos, enlaces y cifras) con un comando',
    ruta: 'scripts/convocatoria/audit-landing.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      'npm run audit:landing -- <slug>. No escribe nada. Recorre el inventario de superficies ' +
      '(lib/admin/landingSurfaces.ts), junta los hallazgos que el sweep ya calculó con los núcleos ' +
      'puros sobre datos vivos, y añade lo que nadie cubría: enlaces del HTML SERVIDO, cifras ' +
      'afirmadas contra el documento de convocatoria clonado y superficies que se contradicen. ' +
      'Exit code 1 si hay errores → por eso `send-promo-inscripcion.cjs` lo usa como PUERTA antes ' +
      'de enviar (escape: --saltar-auditoria). Las cifras solo se contrastan si hay documento de ' +
      'tipo convocatoria/bases: el 96% del hub está clonado como `nota` y contrastar contra el ' +
      'documento equivocado produce avisos falsos en masa (medido: 168).',
  },
  simular_auditoria_landings: {
    titulo: 'Simular audit:landing sobre TODAS las landings activas (cuántas están mal y por qué)',
    ruta: 'scripts/convocatoria/sim-audit-landings.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      'npm run sim:audit-landings [-- --con-red N]. No escribe nada. Corre la auditoría sobre las ' +
      '123 activas y agrega por veredicto y por detector; `--con-red N` añade comprobación de ' +
      'ENLACES a las N más expuestas (plazo abierto + más usuarios), porque son ~70 peticiones por ' +
      'landing. Es la medida de precisión de la puerta: correr la auditoría sobre UNA landing no ' +
      'dice nada de si acierta, sobre las 123 sí. Así se cazaron dos falsos positivos propios (las ' +
      'tarjetas de Navarra) y se decidió qué bloquea un envío y qué no.',
  },
  simular_enlace_boletin: {
    titulo: 'Simular el detector del botón oficial sobre TODAS las landings activas',
    ruta: 'scripts/convocatoria/sim-enlace-boletin.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      'npm run sim:enlace-boletin. No escribe nada. Enseña, banda por banda, qué marcaría el ' +
      'detector de "Ver convocatoria en {diario}" y por qué. Correrlo ANTES de tocar la ' +
      'calibración es lo que evitó encender un kind con 56 hallazgos sin mirar.',
  },
  sprint_g_migrate_convocatorias: {
    titulo: 'Migración Sprint G: volcar los campos de convocatoria de `oposiciones` a `convocatorias`',
    ruta: 'scripts/sprint-g-migrate-data.cjs',
    estado: 'historico',
    escribe: ['programa_url'],
    notas:
      'Migración de datos que creó la SSOT de convocatorias (copia legacy → tabla `convocatorias`). ' +
      'Corrió una vez; se conserva por trazabilidad de aquella migración.',
  },

  // ── estructura de leyes (law_sections) ─────────────────────────────────────────────────────
  poblar_law_sections_boe: {
    titulo: 'Poblar los títulos/capítulos de una ley (law_sections) desde la estructura oficial del BOE',
    ruta: 'scripts/poblar-law-sections-boe.cjs',
    estado: 'vivo',
    notas:
      'Dry-run por defecto; `--sweep` procesa un lote y `--law "X"` una sola. Sin estructura, ' +
      '/leyes/<slug> cae a lista plana de artículos. Cruza cada rango con los artículos REALES en BD ' +
      'y NO inserta la ley si un rango queda vacío o hay solape: nunca mete basura. **SALTA las leyes ' +
      'ya pobladas**, así que para arreglar filas viejas hace falta `reparar_rubricas_law_sections`. ' +
      'GOTCHAS: (1) el nº de artículo sale del LABEL del bloque, nunca del id (el BOE desambigua ids ' +
      'repetidos con sufijo: `a1-2` es el artículo 10); (2) las leyes ANTIGUAS numeran en LETRA en el ' +
      'id Y en el label (`aprimero` → "Artículo primero"), y hasta T-140 eso dejaba fuera la ley ' +
      'entera como `sin_secciones` — 27 leyes se desbloquearon al arreglarlo; (3) el nivel LIBRO NO ' +
      'se modela (Código Civil, CP, LECrim, LOPJ): sus títulos reinician por libro y se rechazan a ' +
      'propósito, es la tarea T-104.',
  },
  reparar_rubricas_law_sections: {
    titulo: 'Limpiar rúbricas de secciones de ley contaminadas con notas del BOE o con la redacción derogada',
    ruta: 'scripts/reparar-rubricas-law-sections.cjs',
    estado: 'vivo',
    notas:
      'Dry-run por defecto; `--apply` escribe, `--ley "X"` acota, `--todas` revisa también las que no ' +
      'parecen sucias. Solo toca `title`: no borra filas, no toca `slug` (los enlaces no cambian) ni ' +
      'los rangos. Existe porque el poblador saca la rúbrica y luego salta las leyes ya pobladas, así ' +
      'que las filas viejas no se reparan solas. Repara DOS defectos: la nota editorial pegada ' +
      '("…constitucional Ténganse en cuenta los artículos 53.2") y —el grave— la rúbrica DEROGADA ' +
      '(LOTC Título VI decía "Del control previo de inconstitucionalidad" en vez de la vigente). ' +
      'DOS GUARDAS, ambas nacidas de un fallo real del dry-run: no toca leyes con números de sección ' +
      'duplicados (nivel LIBRO: el mapeo por número asignaría la rúbrica de otro libro, lo enseñó la ' +
      'LOPJ) y exige que la rúbrica del BOE esté YA CONTENIDA en el título guardado, de modo que la ' +
      'reparación solo pueda acortar o seleccionar lo que había, nunca reemplazarlo. Criterio en el ' +
      'núcleo puro `lib/laws/rubricaSeccion.js`, con tests.',
  },

  // ── seguimiento_url ────────────────────────────────────────────────────────────────────────
  repuntar_seguimiento_url: {
    titulo: 'Cambiar la seguimiento_url de una oposición (con guardarraíl de vigilabilidad)',
    ruta: 'scripts/seguimiento/repuntar-url.cjs',
    estado: 'vivo',
    escribe: ['seguimiento_url'],
    runbook: 'docs/maintenance/oeps-convocatorias-seguimiento.md',
    notas:
      'Dry-run por defecto. Descarga la candidata con las cabeceras EXACTAS del cron, la pasa por ' +
      '`decidirEscritura` y RECHAZA una URL que no sirva contenido; `--anclas` exige además que la ' +
      'página mencione el proceso. Resetea `seguimiento_last_hash` en `oposiciones` (la tabla que usa ' +
      'el cron; existe también en `convocatorias` y resetear esa NO hace nada). Traza en ' +
      '`observable_events` (`seguimiento_url_repuntada`).',
  },
  asignar_seguimiento_url_catalogadas: {
    titulo: 'Asignar seguimiento_url a oposiciones CATALOGADAS que no tienen ninguna',
    ruta: 'scripts/assign-seguimiento-urls.cjs',
    estado: 'vivo',
    escribe: ['seguimiento_url'],
    runbook: 'docs/maintenance/oeps-convocatorias-seguimiento.md',
    notas:
      'Idempotente, pensado para correr tras cada tanda de "catalogar descubrimientos". Rellena ' +
      'SOLO donde la columna está vacía — no repunta las que ya tienen (para eso, ' +
      '`repuntar_seguimiento_url`). Estrategia histórica: dominio raíz del organismo, porque el ' +
      'sensor LLM NAVEGA desde ahí y los paths concretos daban 404 masivos.',
  },
  backfill_seguimiento_urls_sprint_c: {
    titulo: 'Backfill masivo de seguimiento_url (Sprints C.1–C.6, junio 2026)',
    ruta: 'scripts/fill-seguimiento-urls-resto.cjs',
    estado: 'historico',
    escribe: ['seguimiento_url'],
    notas:
      'Una sola vez, junio 2026, junto a `fill-seguimiento-urls-diputaciones.cjs` y ' +
      '`fill-seguimiento-urls-c6.cjs`. NO reutilizar: escriben sin comprobar que la página sirva ' +
      'contenido. Se conservan porque documentan la decisión de usar dominio raíz (estable) en vez ' +
      'de paths concretos (404 masivos) — contexto que hace falta para no "arreglar" a ciegas una ' +
      'URL raíz que es deliberada.',
  },

  backfill_seguimiento_urls_diputaciones: {
    titulo: 'Backfill de seguimiento_url para Diputaciones provinciales (Sprint C.1, junio 2026)',
    ruta: 'scripts/fill-seguimiento-urls-diputaciones.cjs',
    estado: 'historico',
    escribe: ['seguimiento_url'],
    notas:
      'Una sola vez. Documenta POR QUÉ se usa el dominio raíz y no el path concreto: los paths ' +
      'cambian y dieron 404 masivos. Contexto necesario para no "arreglar" una URL raíz deliberada.',
  },
  backfill_seguimiento_urls_c6: {
    titulo: 'Backfill de las 19 seguimiento_url restantes (Sprint C.6, junio 2026)',
    ruta: 'scripts/fill-seguimiento-urls-c6.cjs',
    estado: 'historico',
    escribe: ['seguimiento_url'],
    notas: 'Una sola vez: retry de timeouts de C.1/C.2 + correcciones puntuales. No reutilizar.',
  },
  build_cuidador_cordoba_fase2: {
    titulo: 'Construcción de Cuidador/a Diputación de Córdoba — fase 2 (datos de convocatoria)',
    ruta: 'scripts/_cuidador_cordoba_fase2.cjs',
    estado: 'historico',
    escribe: ['seguimiento_url', 'programa_url'],
    notas:
      'Script de construcción de UNA oposición concreta; escribe su seguimiento_url junto al resto ' +
      'de datos de convocatoria. No es una herramienta reutilizable.',
  },
  build_ordenanza_cordoba_fase2: {
    titulo: 'Construcción de Ordenanza Ayto. de Córdoba — fase 2 (datos de convocatoria)',
    ruta: 'scripts/_ordenanza_cordoba_fase2.cjs',
    estado: 'historico',
    escribe: ['seguimiento_url', 'programa_url'],
    notas: 'Ídem: construcción de una oposición concreta, no herramienta reutilizable.',
  },

  // ── fetcher_type ──────────────────────────────────────────────────────────────────────────
  fetcher_headless_por_fuente: {
    titulo: 'Descargar una fuente con navegador real (headless) en vez de HTTP',
    ruta: 'backend/src/detect-oep-llm/detect-oep-llm.service.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-radar.md',
    notas:
      'CAPACIDAD YA CONSTRUIDA, no la reconstruyas: la columna `oposiciones.fetcher_type` ' +
      '(`http`|`headless`|`pdf`|`rss`|`boe_api`) la respetan `detect-oep-llm`, ' +
      '`detect-notas-convocatoria` y `detect-generic-sources`. Medido 26/07: 67 fuentes ya en ' +
      '`headless`. Para una fuente cuyo contenido monta JS, marcarla `headless` en vez de escribir ' +
      'un fetcher nuevo. GOTCHA: el headless NO cura un bloqueo por WAF/IP (un 403 seguirá siendo 403).',
  },

  // ── diagnóstico / auditoría (no escriben) ─────────────────────────────────────────────────
  simular_fuentes_ciegas: {
    titulo: '¿Qué seguimiento_url responden 200 pero no sirven nada? (simulación, no escribe)',
    ruta: 'scripts/seguimiento/sim-fuentes-ciegas.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/oeps-convocatorias-seguimiento.md',
    notas:
      'Corre el clasificador puro sobre el último check atribuible de cada fuente. `--todos` añade ' +
      'la banda de revisión. Es el gate que se pasa ANTES de que un detector nuevo toque el badge.',
  },
  ajustar_fetcher_type: {
    titulo: 'Revertir a `http` las fuentes marcadas `headless` en las que el headless no aporta',
    ruta: 'scripts/seguimiento/ajustar-fetcher-type.cjs',
    estado: 'vivo',
    escribe: ['fetcher_type'],
    runbook: 'docs/runbooks/salud-radar.md',
    notas:
      'Dry-run por defecto. MIDE en el momento (curl vs Lambda, texto útil) y solo escribe el caso ' +
      'inequívoco `no_aporta` estando en `headless`; NO toca `ambos_ciegos` (el problema es la URL y ' +
      'cambiar el fetcher lo enmascara) ni `rechaza_bot` (exige criterio humano). Comparte núcleo con ' +
      '`sim-headless-aporta.cjs` (`veredictoHeadless`/`decidirFetcherType`, testeados). Traza en ' +
      '`observable_events` (`fetcher_type_ajustado`) con la medición que justificó cada cambio. ' +
      'Medido 26/07: de 67 marcadas, 12 aportan y 55 no → 55 invocaciones diarias de Lambda tiradas.',
  },
  medir_aporte_headless: {
    titulo: '¿Qué aporta de verdad el fetcher headless frente a curl, fuente por fuente?',
    ruta: 'scripts/seguimiento/sim-headless-aporta.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-radar.md',
    notas:
      'CÓRRELO ANTES de marcar una fuente `fetcher_type=headless`. Compara el TEXTO ÚTIL por `curl` ' +
      'contra el de la Lambda y clasifica: aporta / no_aporta / rechaza_bot (la web dice que no ' +
      'soporta el navegador) / ambos_ciegos. No escribe nada. Motivo: el runbook lleva desde el ' +
      '16/07 avisando de que "marcar headless no es un arreglo, hay que COMPROBAR que devuelve ' +
      'contenido" y aun así había 67 fuentes marcadas sin medir. GOTCHA: el `ok` de la Lambda da ' +
      'por bueno cualquier 3xx, así que un 304 con armazón cacheado se reporta como éxito — mira el TEXTO.',
  },
  diagnosticar_ruido_hash: {
    titulo: 'Por qué cambia el hash de una página entre dos descargas seguidas',
    ruta: 'scripts/diag-seguimiento-ruido.cjs',
    estado: 'historico',
    notas:
      'Diagnóstico de T-047 (julio 2026): descarga dos veces la misma URL y diffea lo que el ' +
      'normalizador no captura. Llevó a retirar el sensor `hash_change` (4% de acierto). Útil si ' +
      'algún día se reabre esa vía.',
  },

  // ── dual-write legacy `oposiciones` ↔ convocatoria SSOT ───────────────────────────────────
  adjudicar_dual_write: {
    titulo: 'Resolver una divergencia entre la fila legacy `oposiciones` y su convocatoria vigente',
    ruta: 'scripts/dual-write-adjudicar.cjs',
    estado: 'vivo',
    escribe: ['estado_proceso', 'plazas_libres', 'plazas_promocion_interna', 'plazas_discapacidad', 'inscription_deadline', 'exam_date'],
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      'Dry-run por defecto; aplica un plan JSON. NO decide nada a propósito: exige `gana` y `porQue` ' +
      'escritos fila a fila, porque la divergencia es BIDIRECCIONAL — en la tanda de `estado_proceso` ' +
      'del 26/07 salió 7-7, así que copiar en bloque en cualquier sentido regresa la mitad. Lista ' +
      'blanca de campos (no es una puerta genérica para escribir en esas tablas), escribe el SSOT ' +
      'antes que la legacy (misma convención que el puente radar→SSOT de `lib/api/oep-signals/queries.ts`: ' +
      'los lectores van por la vista) y verifica DENTRO de la transacción que dejaron de divergir. ' +
      'El detector que las lista es `npm run audit:coherencia`; para las de plazas, ese detector ya ' +
      'trae la explicación de `lib/convocatoria/divergenciaPlazas.js`.',
  },

  // ── contenido invisible: artículo escopado pero inactivo ──────────────────────────────────
  reanclar_preguntas: {
    titulo: 'Mover preguntas a otro artículo sin dejarlas huérfanas (contenido invisible)',
    ruta: 'scripts/reanclar-preguntas.cjs',
    estado: 'vivo',
    escribe: ['primary_article_id', 'article_numbers'],
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'Dry-run por defecto; aplica un plan JSON. Remedia el finding `scope_phantom_article` (artículo ' +
      'escopado pero inactivo: no se sirve aunque tenga preguntas activas). El riesgo que cierra es ' +
      'SILENCIOSO: una pregunta se sirve donde está escopado SU artículo, así que mover el ancla a ' +
      'otro escopado en temas distintos no la rescata, la cambia de sitio — y como el artículo viejo ' +
      'se queda sin preguntas, el detector se apaga y el informe canta victoria. Guardas puras en ' +
      '`lib/contenido/reanclarGuardas.js` (13 tests): bloquea destino inactivo, destino sin ningún ' +
      'scope, y pérdida de temas no declarada (declararla obliga a escribir el motivo). Es el 32.º ' +
      'escritor de `article_numbers` y el trinquete se subió a conciencia (ver `toolWriters.ts`): ' +
      'solo QUITA números enumerados en el plan y en la misma transacción que re-ancla.',
  },
  reactivar_articulo_boe: {
    titulo: 'Reactivar un artículo apagado comparándolo antes con el BOE consolidado',
    ruta: 'scripts/reactivar-articulo-boe.cjs',
    estado: 'vivo',
    escribe: ['content', 'is_active'],
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'Dry-run por defecto. Para cuando NO hay artículo activo al que re-anclar (hermano de ' +
      '`reanclar_preguntas`). Compara contra el bloque VIGENTE (`bloqueVigente`), nunca contra el ' +
      'crudo: el crudo trae todas las versiones y las notas, y comparar longitudes contra él hace ' +
      'que un artículo COMPLETO parezca truncado (pasó con el art. 28 del Reglamento de Armas). El ' +
      'veredicto lo da `lib/laws/compararArticuloOficial.js` (14 tests) en cinco clases que piden ' +
      'remedios OPUESTOS: identico / erratas / reordenado / incompleto / contaminado. BLOQUEA el ' +
      '`contaminado` (párrafos que el BOE no tiene: puede ser otra norma o una versión derogada) y ' +
      'bloquea reactivar un artículo que no esté en ningún scope. Verifica lo escrito dentro de la ' +
      'transacción y refresca la MV.',
  },
}

/** Herramientas `vivo` que escriben un recurso dado. */
export function escritoresVivos(recurso: string): string[] {
  return Object.entries(TOOL_REGISTRY)
    .filter(([, h]) => h.estado === 'vivo' && (h.escribe || []).includes(recurso))
    .map(([k]) => k)
}

/** Rutas registradas (para que el guardarraíl sepa qué escritor está declarado). */
export function rutasRegistradas(): string[] {
  return Object.values(TOOL_REGISTRY).map((h) => h.ruta)
}
