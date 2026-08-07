// lib/admin/suiteRegistry.ts — INVENTARIO de las suites del job «Integration / perf / security»,
// cada una declarando QUÉ TIPO DE VERDAD comprueba.
//
// Responde a una pregunta que hasta hoy no tenía respuesta en ningún sitio:
// **cuando ese job se pone rojo, ¿ha roto algo el commit, o hay un hallazgo de contenido?**
//
// ## Por qué existe (T-384, 31/07/2026)
//
// El job mezcla dos cosas con semánticas de fallo OPUESTAS:
//   · un test de código en rojo significa «tú acabas de romper esto» → debe BLOQUEAR;
//   · una vigilancia de datos en rojo significa «hay un hallazgo en producción», casi siempre
//     por algo que pasó semanas antes y que el commit de hoy no ha causado → NO puede bloquear.
//
// Mezclarlas obliga a poner `continue-on-error: true` para que la segunda no bloquee a la
// primera. Y ese flag tuvo una consecuencia que nadie buscó: con él, el fallo del job **no hace
// `failure()`**, así que el job que manda los avisos nunca corría y el rojo era MUDO. Encadenado:
//   1. se pierde el secret de BD → el job deja de verificar nada (≥5 días),
//   2. nadie se entera, porque el rojo no avisa ([T-370], ya arreglado),
//   3. mientras tanto una vigilancia SÍ cazaba algo real —7.134 preguntas de enfermería sobre
//      contenedores vacíos ([T-379])— gritando por un canal cortado.
//
// La chapuza de fondo no era el secret que faltaba: era la mezcla. Este registro la deshace.
//
// ## Qué se declara y qué se DERIVA (para que no sea papeleo)
//
// Solo se declara lo que exige JUICIO: las suites que hablan con la base de datos. Las que no la
// tocan son deterministas por construcción (dependen del repo y de nada más) y el guardarraíl las
// clasifica solo — no hay 58 entradas de relleno que nadie mantendría.
//
// ## Cómo se hace cumplir (no depende de que nadie lea esto)
//
// `__tests__/guardrails/suiteRegistry.guardrail.test.ts` (sin BD ni red):
//   · toda suite del job que toque la BD está declarada, y toda entrada apunta a un fichero real;
//   · una suite declarada `codigo` que toca la BD debe declarar `fixturePropio` — o sea, que crea
//     lo que lee. Es el check que impide que «código» se convierta en una etiqueta cómoda;
//   · una `vigilancia` cita un `kind` que EXISTE en `runbookRegistry`, o declara `hueco` con
//     motivo. Así, mover una vigilancia al barrido no la deja sin dueño ni sin runbook;
//   · una suite que no toca la BD no puede declararse aquí (sería ruido).
//
// Mismo patrón que `landingSurfaces` (superficie→detector), `runbookRegistry` (kind→guía) y
// `toolRegistry` (recurso→herramienta). En este repo, un registro sin test es documentación que
// caduca.

/** Qué clase de verdad comprueba una suite. */
export type TipoSuite =
  /**
   * Comprueba CÓDIGO y es determinista: o no toca la BD, o crea dentro de la prueba los datos
   * que lee. Su rojo culpa al commit. Destino: base de datos efímera en CI y gate BLOQUEANTE.
   */
  | 'codigo'
  /**
   * Comprueba CÓDIGO pero toma prestadas filas de producción como fixture. Es la categoría que
   * más daño hace, porque su veredicto depende de datos que nadie controla: [T-336] fueron 20
   * rojos de aquí —«coge tres usuarios cualesquiera»— que parecían fallos de producción y no lo
   * eran. Son las que hay que MIGRAR a fixtures propios (F2), no las que hay que mover al barrido.
   */
  | 'codigo_datos_prestados'
  /**
   * No es un test: es un MONITOR de los datos de producción. Su rojo es un hallazgo con dueño.
   * Destino: el barrido de salud (`content_health_findings` / `@Cron`), con su frase-gatillo.
   */
  | 'vigilancia'

export interface EntradaSuite {
  /** Ruta relativa al repo del fichero de test. */
  ruta: string
  tipo: TipoSuite
  /** Qué comprueba, en una línea. */
  que: string
  /**
   * Solo `codigo`/`codigo_datos_prestados` que tocan BD: ¿crea ella misma lo que lee?
   * Obligatorio en `codigo` con BD — es lo que distingue determinista de «funciona hoy».
   */
  fixturePropio?: boolean
  /**
   * Solo `fixturePropio`: la suite ESCRIBE, así que debe estar detrás de
   * `INTEGRATION_DB_WRITABLE=1` (convención ya existente en el repo, ver el runbook de pusheo).
   * No es papeleo: es lo que impide que una suite escriba en producción el día que CI reciba una
   * credencial con permiso de escritura. El guardarraíl comprueba que la declaración COINCIDE con
   * lo que hace el fichero — declararlo sin gatearlo se pone rojo.
   */
  gateEscritura?: boolean
  /** Solo `vigilancia`: kind de `runbookRegistry` que le corresponde al mudarse al barrido. */
  kind?: string
  /** Solo `vigilancia` sin kind: por qué todavía no lo tiene. El silencio no vale. */
  hueco?: string
}

export const SUITE_REGISTRY: EntradaSuite[] = [
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // CÓDIGO con fixture propio — ya deterministas. Van tal cual a la BD efímera.
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    ruta: '__tests__/integration/referrals-queries.test.ts',
    tipo: 'codigo', fixturePropio: true, gateEscritura: true,
    que: 'Circuito de referidos por función (atribuir, calificar, hold, promover). Migrada a usuarios efímeros en T-336.',
  },
  {
    ruta: '__tests__/integration/referrals-simulation.test.ts',
    tipo: 'codigo', fixturePropio: true, gateEscritura: true,
    que: 'El circuito de referidos entero encadenado, incluido el clawback por reembolso.',
  },
  {
    ruta: '__tests__/integration/deleteUserData.integration.test.ts',
    tipo: 'codigo', fixturePropio: true, gateEscritura: true,
    que: 'Borrado real de cuenta contra RDS: SSOT + cascada. Crea el usuario que borra.',
  },
  {
    ruta: '__tests__/integration/testPositionTypePersistence.integration.test.ts',
    tipo: 'codigo', fixturePropio: true, gateEscritura: true,
    que: 'tests.position_type se persiste de verdad (INSERT real).',
  },
  {
    ruta: '__tests__/integration/convocatoriaCiclo.test.ts',
    tipo: 'codigo', fixturePropio: true, gateEscritura: true,
    que: 'Invariantes del ciclo de convocatoria sobre filas que crea la propia prueba.',
  },
  {
    ruta: '__tests__/integration/convocatoriaVerification.test.ts',
    tipo: 'codigo', fixturePropio: true, gateEscritura: true,
    que: 'Registro de verificación de convocatoria sobre filas propias.',
  },
  {
    ruta: '__tests__/integration/topicScopeVerification.test.ts',
    tipo: 'codigo', fixturePropio: true, gateEscritura: true,
    que: 'Máquina de estados de topic_scope_verification (trigger de invalidación por hash).',
  },
  {
    ruta: '__tests__/integration/topicEpigrafeVerification.test.ts',
    tipo: 'codigo', fixturePropio: true, gateEscritura: true,
    que: 'Máquina de estados de la verificación de epígrafes.',
  },
  {
    ruta: '__tests__/integration/topicScopeAudit.integration.test.ts',
    tipo: 'codigo', fixturePropio: true, gateEscritura: true,
    que: 'Auditoría de topic_scope sobre filas creadas por la prueba.',
  },
  // (`crossUserIsolationC3` y `fraudReportAuth` NO están aquí a propósito: mockean `@/db/client`
  //  entero, así que son deterministas y el guardarraíl las clasifica solo. Declararlas sería
  //  ruido — y el propio guardarraíl lo rechaza.)
  {
    ruta: '__tests__/integration/deleteUserIndexCoverage.integration.test.ts',
    tipo: 'codigo', fixturePropio: false,
    que: 'El borrado de cuenta tiene índices que lo cubren: mira el CATÁLOGO de índices, no datos de negocio.',
  },
  {
    ruta: '__tests__/integration/schemaColumnDrift.integration.test.ts',
    tipo: 'codigo', fixturePropio: false,
    que: 'Trinquete de drift de COLUMNAS entre RDS y db/schema.ts. Compara ESQUEMA, no contenido — por eso es código, y es justo el que hace falta para poder levantar una BD efímera fiel (F2).',
  },
  {
    ruta: '__tests__/integration/emailEventsTiposAceptados.test.ts',
    tipo: 'codigo', fixturePropio: false,
    que: 'Trinquete del CHECK de email_events contra EMAIL_TYPES: caza el tipo que la app envía y la BD rechaza EN SILENCIO (el insert va en try/catch). Lee el catálogo de constraints, no filas de negocio — mismo caso que schemaColumnDrift (T-456).',
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // CÓDIGO con DATOS PRESTADOS — prueban comportamiento, pero leyendo lo que haya en producción.
  // Son las que hay que migrar a fixtures propios: su rojo NO es un hallazgo de contenido.
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    ruta: '__tests__/integration/checkAvailableQuestionsNullScope.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'checkAvailableQuestions honra article_numbers NULL (= toda la ley).',
  },
  {
    ruta: '__tests__/integration/reviewOwnership.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'El repaso de un test solo lo sirve su DUEÑO (T-482): con la identidad de otro no sale ni una pregunta. Toma prestados un test completado real y otro usuario real; SOLO LEE (un test de aislamiento que escribiera en producción sería peor que el agujero que vigila).',
  },
  {
    ruta: '__tests__/integration/essentialArticlesAvailability.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'checkQuestionAvailability honra focusEssentialArticles (caso Pilar).',
  },
  {
    ruta: '__tests__/integration/failedQuestionsLawScope.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'El repaso de fallos respeta scope=law.',
  },
  {
    ruta: '__tests__/integration/lawTestScopeServed.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'El test de ley del temario respeta el scope (serving y parser reales).',
  },
  {
    ruta: '__tests__/integration/porLeyesScopeToPosition.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'scopeToPosition en el flujo «por leyes» (escenario Ana).',
  },
  {
    ruta: '__tests__/integration/articlesDuplicateLawScope.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'getArticlesForLaw: las leyes con short_name duplicado no salen en gris.',
  },
  {
    ruta: '__tests__/integration/lawArticlesOrden.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'El orden del listado de artículos de una ley (T-327). SOLO LEE. Fija el defecto que motivó el test: al quitarle las letras a «DA1» queda «1», así que con un ORDER BY ingenuo las disposiciones se colaban entre el art. 1 y el 2 (medido en la CE: 0 · 1 · DA1 · DT1 · 2 …) y quien busca el artículo 2 no lo encontraba donde debe estar. No puede ser unitario: con datos inventados nadie escribe un «DA1». Toma prestada la CE, así que su rojo puede venir de los datos y no del commit.',
  },
  {
    ruta: '__tests__/integration/examPositionQueryIntegration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'El filtro exam_position en la query real.',
  },
  {
    ruta: '__tests__/integration/examCaseExclusion.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Exclusión de exam_case_id en tests aislados.',
  },
  {
    ruta: '__tests__/integration/teoriaCatalogSearch.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Buscador del catálogo de teoría.',
  },
  {
    ruta: '__tests__/integration/teoriaContentSearch.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Buscador dentro del contenido de teoría.',
  },
  {
    ruta: '__tests__/integration/unbuiltOposicionDegrade.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Una oposición sin construir degrada con gracia (incidente Alfonso).',
  },
  {
    ruta: '__tests__/integration/themeStatsModel.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Modelo de estadísticas por tema.',
  },
  {
    ruta: '__tests__/api/user-stats/userStatsSummary.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'La tabla user_stats_summary y su agregación.',
  },
  {
    ruta: '__tests__/integration/topicScopeNullCoverage.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Cobertura de scope con NULL (= toda la ley).',
  },
  {
    ruta: '__tests__/integration/stripeSubscriptionSync.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Sincronización de suscripciones de Stripe.',
  },
  {
    ruta: '__tests__/integration/renewalReminderCoverage.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Cobertura de los recordatorios de renovación.',
  },

  // ─── Paridades de dos implementaciones (JS ↔ SQL). Prueban CÓDIGO, pero se apoyan en filas
  //     reales para comparar. Migran a fixtures: la paridad se demuestra igual con datos propios.
  {
    ruta: '__tests__/integration/docKeyParity.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'boletin_doc_key: la implementación JS y la SQL dan lo mismo.',
  },
  {
    ruta: '__tests__/integration/temarioComunicadoParity.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Comunicados del temario: paridad JS ↔ SQL sobre el hub.',
  },
  {
    ruta: '__tests__/integration/lawCompletenessConsistency.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'law_verification_effective (SQL) ↔ classifyLawCompleteness (TS) coinciden.',
  },
  {
    ruta: '__tests__/integration/agnosticismoQueries.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'Paridad de las queries migradas al cliente agnóstico.',
  },
  {
    ruta: '__tests__/integration/auditNoteSweepBudget.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'El detector de notas de auditoría: presupuesto y equivalencia contra Postgres.',
  },
  {
    ruta: '__tests__/integration/seguimientoFuentesCiegas.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'El DETECTOR de fuentes ciegas (su lógica), no el estado de las fuentes.',
  },
  {
    ruta: '__tests__/integration/articleTestCount.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'El CTA de test por artículo: el conteo del SSOT coincide con lo servido.',
  },
  {
    ruta: '__tests__/integration/topicCountVsServed.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que:
      'El contador del TEMA: lo que la tarjeta anuncia es lo que getFilteredQuestions entrega ' +
      '[T-507]. Hermano de articleTestCount para la otra superficie. Exige que la diferencia ' +
      'anunciado−servido sea EXACTAMENTE la del filtro de tag (deuda declarada, [T-513]): si ' +
      'aparece un residuo, es una causa nueva que nadie ha visto.',
  },
  {
    ruta: '__tests__/integration/repasoBarajadoCoherente.integration.test.ts',
    tipo: 'codigo_datos_prestados',
    que: 'El CONTRATO del que depende el repaso de un test barajado (T-472): las opciones guardadas van en el orden mostrado y las letras en coordenadas de la BD.',
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // VIGILANCIAS — monitores del contenido de producción. Destino: el barrido de salud.
  // Su rojo NO culpa al commit; culpa a un dato. Cada una debe acabar con su frase-gatillo.
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    ruta: '__tests__/integration/placeholderTemarioGuard.test.ts',
    tipo: 'vigilancia', kind: 'article_no_coverage',
    que: 'Trinquete: preguntas activas colgando de artículos virtuales VACÍOS. Es el que cazó las 7.134 de enfermería ([T-379]) sin que nadie lo oyera.',
  },
  {
    ruta: '__tests__/integration/articleContentPlaceholders.test.ts',
    tipo: 'vigilancia', kind: 'article_no_coverage',
    que: 'Artículos servidos cuyo contenido es un placeholder.',
  },
  {
    ruta: '__tests__/integration/topicScopeIntegrity.test.ts',
    tipo: 'vigilancia', kind: 'scope_phantom_article',
    que: 'Invariantes de topic_scope: artículos duplicados y números sin artículo activo.',
  },
  {
    ruta: '__tests__/integration/temarioEpigrafeIntegrity.test.ts',
    tipo: 'vigilancia', kind: 'scope_sin_verificar',
    que: 'Coherencia entre el epígrafe del tema y lo que declara su temario.',
  },
  {
    ruta: '__tests__/integration/temarioVersions.integration.test.ts',
    tipo: 'vigilancia', kind: 'temario_revision_pendiente',
    que: 'Convocatoria vigente de oposición activa que no apunta a una versión de temario.',
  },
  {
    ruta: '__tests__/integration/temarioDataQuality.test.ts',
    tipo: 'vigilancia', kind: 'empty_topic',
    que: 'Calidad del temario: topics activos sin descripción, bloques sin topics, títulos que contradicen su epígrafe.',
  },
  {
    ruta: '__tests__/integration/oposicionDataCompleteness.test.ts',
    tipo: 'vigilancia', kind: 'landing_incompleta',
    que: 'Datos de la oposición incompletos.',
  },
  {
    ruta: '__tests__/integration/oepEntidadIntegrity.integration.test.ts',
    tipo: 'vigilancia', kind: 'convocatoria_oep_sin_enlace',
    que: 'Integridad de la entidad OEP y su puente con convocatorias.',
  },
  {
    ruta: '__tests__/integration/provenanceLinkNotNota.integration.test.ts',
    tipo: 'vigilancia', kind: 'convocatoria_docs_incompletos',
    que: 'Ningún consumidor enlaza a una nota de monitoreo en vez de al documento real.',
  },
  {
    ruta: '__tests__/integration/configDbIntegrity.test.ts',
    tipo: 'vigilancia', kind: 'temas_card',
    que: 'La config declara temas que la BD no tiene. YA lo vigila `temas_card`, que estaba CIEGO: contaba topics sin filtrar `is_active`, así que 120 prometidos con 20 activos cuadraban con 100 filas fantasma. Arreglado en los dos barridos (T-384).',
  },
  {
    ruta: '__tests__/integration/positionTypeIntegrity.test.ts',
    tipo: 'vigilancia',
    hueco: 'NO se puede mudar al barrido tal cual, y el motivo es arquitectónico, no de pereza: necesita `lib/config/oposiciones.ts` (SLUG_TO_POSITION_TYPE) y el writer real es el @Cron del backend, un build NestJS aparte que no puede importar el lib/ del frontend. Para vigilarlo de noche habría que EXPORTAR esa config a datos (tabla o artefacto de build). Mientras tanto vive aquí. Caso vivo: auxiliar_archivos_bibliotecas_museos_madrid, 50 temas y 7 usuarios, sin mapeo.',
    que: 'position_type presente en BD sin configuración que lo respalde.',
  },
  {
    ruta: '__tests__/integration/familiaSchemaContract.test.ts',
    tipo: 'codigo',
    fixturePropio: false,
    que: 'Contrato de esquema de familia: la vista la expone, el CHECK rechaza valores fuera de la taxonomía, y nada persistido incumple esa taxonomía. NO depende del CONTENIDO de ninguna fila concreta — el test del CHECK toma prestada una fila arbitraria solo como vehículo (no le importa CUÁL), a diferencia del patrón que rompió [T-336].',
  },
  {
    ruta: '__tests__/integration/familiaClassification.test.ts',
    tipo: 'vigilancia', kind: 'familia_desincronizada',
    que: 'La MITAD de vigilancia de familia (separada del contrato de esquema, T-384): ¿el clasificador sigue de acuerdo con lo persistido? (kind familia_desincronizada) y ¿hay cobertura ≥80%? (kind familia_cobertura_baja, hermano — mismo fichero, dos kinds). YA lo cubre `health-sweep.cjs`, CLI-only.',
  },
  {
    ruta: '__tests__/integration/psychometricDataQuality.test.ts',
    tipo: 'vigilancia', kind: 'psicotecnico_integridad',
    que: 'Calidad de las preguntas psicotécnicas. El hueco que destapó este inventario: ya tiene detector en el barrido (T-384).',
  },
  {
    ruta: '__tests__/integration/psychometricSectionIntegrity.test.ts',
    tipo: 'vigilancia', kind: 'psicotecnico_integridad',
    que: 'Integridad de las secciones psicotécnicas. Sus tres invariantes son los que emite ahora el barrido.',
  },
]
