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
  // ── Leer una plantilla oficial de examen sin pdftotext/pdftoppm/magick ────────────────────
  extraer_pdf_examen_oficial: {
    titulo: 'Extraer texto + respuesta marcada en color de una plantilla oficial de examen (PDF), sin pdftotext (T-368)',
    ruta: 'scripts/examenes-oficiales/extraer-pdf-con-respuestas.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/importar-examen-oficial-completo.md',
    notas:
      'node scripts/examenes-oficiales/extraer-pdf-con-respuestas.cjs <archivo.pdf> [salida.txt]. ' +
      'SOLO LEE el PDF, no escribe nada de negocio — es la FASE 1-2 del manual de importación ' +
      '(localizar+extraer), no el import en sí. ' +
      'NACE porque este entorno (worker de la flota) no tiene `pdftotext`/`pdftoppm`/`magick` ' +
      'instalados (comprobado: los tres sin resultado en el PATH), que es lo que asume el manual. ' +
      '`pdfjs-dist` (ya dependencia) da el texto plano bien, pero PIERDE el color — y el Gobierno ' +
      'de Canarias marca la respuesta correcta en ROJO sobre el texto (verificado en el examen del ' +
      '08/07/2024: el rojo cae en una única opción por pregunta y varía de posición, no es "la ' +
      'primera siempre"). Este script interpreta el content stream a mano (vía `pdf-lib`) para no ' +
      'perder `rg`/`Tf`, decodificando cada fuente por su propio `/ToUnicode`. ' +
      '⚠️ GOTCHA que costó una transcripción rota (07/08/2026, cazado por contraste contra una ' +
      'extracción de referencia — sin ese contraste se habría publicado mal): el `codespacerange` ' +
      'del `/ToUnicode` NO dice cuántos bytes ocupa un carácter en el content stream — eso lo dice ' +
      'el `Subtype` de la fuente. Una fuente SIMPLE (`/TrueType`, `/Type1`) usa SIEMPRE 1 byte, ' +
      'aunque su ToUnicode declare `<0000><FFFF>` (habitual, no significa 2 bytes). Solo una ' +
      'compuesta (`/Type0`) usa el ancho real de su CMap. Al confiar en el codespacerange para una ' +
      'fuente simple, cada carácter se partía en dos y se perdía la mitad del texto ("CUERPO ' +
      'AUXILIAR" → "UEO AUXIAR") — el bug ya está arreglado (mira el `Subtype` primero), pero es la ' +
      'razón de NO confiar nunca en la salida de este script sin contrastarla contra otra fuente ' +
      '(pdfjs plano, o el propio ojo) antes de dar un examen por verbatim. ' +
      '⚠️ LÍMITE CONOCIDO: solo detecta la marca de RESPUESTA CORRECTA cuando es color de TEXTO ' +
      '(rojo). Al menos una institución (Gobierno de Canarias, examen del 14/03/2026) marca con ' +
      'FONDO amarillo detrás de la línea en vez de texto en color — eso este script NO lo lee (haría ' +
      'falta correlacionar rectángulos `re f` amarillos con la posición Y del texto, prototipado ' +
      'pero sin verificar al 100% — ver `data/examenes-oficiales/auxiliar-administrativo-canarias/' +
      '"26-03-14 ejercicio unico - OEP 2021"/NOTAS-T-368.md`). Sin marca fiable, NO ADIVINAR la ' +
      'respuesta correcta.',
  },
  // ── Soltar al que «cree estar dentro» sin soltar al que sí lo está ───────────────────────
  sim_sesion_fantasma: {
    titulo: 'Comprobar que se suelta la sesión fantasma y NO se desloguea al usuario sano (T-434)',
    ruta: 'scripts/sim/sim-sesion-fantasma.ts',
    estado: 'vivo',
    notas:
      'AUTH_SECRET=… npx tsx --env-file=.env.local scripts/sim/sim-sesion-fantasma.ts ' +
      '[--url=https://www.vence.es]. Navegador real. Siembra el blob LEGACY de Supabase en ' +
      'localStorage antes de que cargue la app (si no, el pre-hydrate ya habría corrido) y mira ' +
      'qué queda después. DOS casos y hacen falta los dos, porque este cambio puede fallar en ' +
      'las dos direcciones y solo una se nota: soltar de MENOS deja a la persona encerrada ' +
      '(silencioso), soltar de MÁS desloguea a premium sanos (ruidoso y caro). ' +
      '⚠️ EL FIXTURE ES LA PARTE FRÁGIL: el blob tiene que llevar access_token y un expires_at ' +
      'NO caducado, o el cliente lo trata como token expirado —rama que ya limpiaba— y el caso ' +
      'sale VERDE contra código SIN el arreglo, que es lo que pasó el 01/08 y no probaba nada. ' +
      'Validada por mutación el 04/08: ROJA contra producción sin el arreglo, VERDE (2/2) contra ' +
      'local con él. Solo LEE; el fantasma se fabrica con un id inventado. La decisión vive ' +
      'aparte y pura en `lib/auth/sesionFantasma.ts` (9 tests) y la vigilancia en ' +
      '`npm run canary:perfil-sin-resolver`, que cuenta las curas EXCLUYENDO el tráfico headless ' +
      'de esta misma simulación.',
  },
  // ── La ley que se guardó como "unknown" y se publicaba como si fuera una ley ──────────────
  backfill_law_name_relleno: {
    titulo: 'Reponer la ley real donde se guardó un relleno ("unknown") en test_questions y en las stats (T-559)',
    ruta: 'scripts/calidad/backfill-law-name-unknown.cjs',
    estado: 'vivo',
    escribe: ['law_name'],
    notas:
      'node scripts/calidad/backfill-law-name-unknown.cjs [--apply] [--lote N]. Dry-run por ' +
      'defecto. Resuelve la ley desde el `article_id` que la propia fila ya tiene: NO inventa ' +
      'nada, y lo que no resuelve lo deja en NULL y lo CUENTA. Idempotente. ' +
      'REPARA DOS TABLAS y la segunda es la que más duele: en `user_article_stats` la columna ' +
      'va DENTRO del índice único, así que el relleno no ensuciaba un campo — PARTÍA en dos las ' +
      'estadísticas por artículo del usuario (medido: 15.811 filas, 493 usuarios, MÁS que en el ' +
      'origen porque ahí quedó lo anterior al backfill de junio). Por eso ahí no vale un UPDATE: ' +
      '9.050 filas ya tienen hermana con la ley buena y el índice las rechazaría, así que se ' +
      'FUNDEN sumando contadores y se borra la fila-relleno, en transacción. ' +
      '`user_article_stats_pre_outbox` se deja fuera a propósito (foto congelada del cutover que ' +
      'no lee nadie). Correrlo DESPUÉS de desplegar el arreglo del escritor: si no, el gemelo ' +
      'del backend sigue produciendo ~800 filas/día y vuelve a crecer. Si esto vuelve a dar >0 ' +
      'filas cuando ya estaba limpio, el defecto ha REAPARECIDO — mirar quién escribe sin pasar ' +
      'por `lib/laws/lawNameResuelta` antes de re-ejecutar (lo canta la regla ' +
      '`law_name_relleno_escrito` de alert-rules).',
  },
  // ── La cabecera nunca deja nada fuera de la pantalla ──────────────────────────────────────
  sim_cabecera_alcanzable: {
    titulo: 'Comprobar que la cabecera no deja perfil ni notificaciones fuera de la pantalla (T-504)',
    ruta: 'scripts/sim/sim-cabecera-alcanzable.ts',
    estado: 'vivo',
    notas:
      'npm run sim:cabecera [-- --url=https://www.vence.es] [--solo=premium|free]. Navegador real ' +
      'sobre 4 anchuras de escritorio × 3 tipos de sesión. Comprueba TRES cosas distintas: que la ' +
      'fila no desborda su contenedor, que todo lo pulsable de la cabecera se puede pulsar de ' +
      'verdad, y que los enlaces que no caben están en el menú «Más» y ese menú se abre y se puede ' +
      'usar (con `elementFromPoint`, no contando enlaces: la primera versión los contaba y daba ' +
      'verde con el menú recortado por un `overflow-x`). Sale 2 = NO CONCLUYENTE si algún caso no ' +
      'se pudo juzgar, porque un verde PARCIAL no es un verde. Correrla al añadir cualquier cosa a ' +
      'la cabecera: es lo que faltaba cuando el menú creció hasta echar el avatar fuera del ' +
      'viewport en las cuatro anchuras y en los dos planes. Necesita AUTH_SECRET (SSM) y solo LEE. ' +
      'El CRITERIO (guiones de medida + qué cuenta como defecto) NO vive aquí: está en ' +
      '`lib/ui/navOverflowProbe.ts`, compartido con `e2e/smoke-cabecera-alcanzable.spec.ts`, que ' +
      'corre el caso ANÓNIMO solo en cada PR y cada 6 h contra producción (workflow e2e-smoke). ' +
      'Esta simulación es la que cubre los menús CON sesión, que son los largos, y por eso sigue ' +
      'siendo la que hay que correr al tocar la cabecera; el smoke es la red de debajo. Si un caso ' +
      'no se puede ni abrir (un modal tapando la cabecera del usuario que salga de la BD) se ' +
      'degrada a NO CONCLUYENTE en vez de tumbar la corrida entera.',
  },
  // ── Precio de fidelidad de quien se queda sin suscripción al vaciar la cuenta antigua ──────
  crear_ofertas_fidelidad: {
    titulo: 'Crear POR ADELANTADO el precio de fidelidad de quien se le apaga la suscripción (T-448)',
    ruta: 'scripts/premium/crear-ofertas-fidelidad.ts',
    estado: 'vivo',
    notas:
      'NODE_OPTIONS="--require ./scripts/sim/stubs/server-only-shim.cjs" npx tsx --env-file=.env.local ' +
      'scripts/premium/crear-ofertas-fidelidad.ts [--apply] [--limite=N]. Dry-run por defecto. ' +
      'EJECUTADO el 01/08/2026: 189 ofertas creadas, 0 fallos (84 a 35 € trimestral, 73 a 59 € ' +
      'semestral, 32 a 20 € mensual) — 190 vivas en total, una por persona. Se crean por ' +
      'adelantado y no al pulsar el botón por tres motivos: el perfil no puede enseñar la CIFRA ' +
      'si la oferta no existe (y la cifra es el argumento entero), crearla en el clic habla con ' +
      'Stripe en vivo y un fallo manda a la persona a /premium con la TARIFA NUEVA, y así se ' +
      'sabe de antemano a cuántos les sale en vez de descubrirlo de uno en uno. Idempotente ' +
      '(price por lookup_key + ON CONFLICT DO NOTHING): repetirlo no duplica. Las ofertas las ' +
      'anula el barrido del cron un mes después de vencer (mismo criterio que promete el email).',
  },
  // ── Preferencias de email: reparación del efecto colateral del botón de baja masiva ──────
  restaurar_soporte_baja_masiva: {
    titulo: 'Devolver las respuestas por email a quien no pidió perderlas (T-369/T-373)',
    ruta: 'scripts/emails/restaurar-soporte-baja-masiva.cjs',
    estado: 'historico',
    notas:
      'YA EJECUTADO el 31/07/2026 (79 filas). Se deja registrado para no reconstruirlo y por si ' +
      'reaparece el patrón. Dry-run por defecto, `--apply` escribe, y vuelca el estado previo a ' +
      '~/vence-backups/ (FUERA del repo: lleva correos reales y `scratchpad/` no está gitignoreado). ' +
      'Toca SOLO la firma del botón rojo (`email_soporte_disabled AND unsubscribed_all`): quien ' +
      'eligió la categoría «Soporte y transaccional» tiene `unsubscribed_all=false` y NO se toca. ' +
      'NO reactiva marketing ni newsletter — siguen de baja de la publicidad, que es lo que pidieron. ' +
      'La causa ya está cerrada en `processUnsubscribeByToken` (casilla `includeSoporte`), así que ' +
      'si esto vuelve a dar >0 filas, el defecto ha REAPARECIDO: mirar ahí antes de re-ejecutar.',
  },
  slot_dispositivo_inactivo: {
    titulo: 'El slot de un dispositivo sin usar deja de bloquear a su dueño a los 7 días',
    ruta: 'scripts/sim/sim-slot-dispositivo.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/revisar-fraudes.md',
    notas:
      'npm run sim:slot-dispositivo — EJECUTA la regla contra la BD real con un usuario efímero ' +
      'que se limpia solo, porque vive dentro de la función SQL `register_device` y un test de JS ' +
      'tendría que mockear justo lo que hay que comprobar. Afirma las DOS direcciones (el slot ' +
      'muerto libera · el vivo sigue bloqueando · la frontera a los 6 días aún ocupa). Nace de ' +
      'medir [T-418] el 04/08/2026: 35 de 289 premium topaban el límite de 2 aparatos y, de los 91 ' +
      'con los dos slots llenos, 39 tenían uno ocupado por una máquina que ya no se usa (patrón de ' +
      'relevo tras re-registrarse). GOTCHA que decide la implementación: NO se borra la fila a los ' +
      '7 días — `user_devices` es la prueba de qué cuentas comparten aparato y el barrido de fraude, ' +
      'el cupo compartido y el anti-autoreferido la leen con ventana de 30 días; borrarla se la ' +
      'recortaría a 7 en silencio. Se acorta lo que OCUPA PLAZA, no lo que se recuerda. ' +
      'Migración: supabase/migrations/20260804_device_slot_inactivo_7_dias.sql.',
  },
  errores_horneados: {
    titulo: 'Impedir que una página cacheada hornee su pantalla de error (T-506)',
    ruta: 'lib/calidad/erroresHorneados.cjs',
    estado: 'vivo',
    runbook: 'docs/procedures/gestionar-feedback-bug.md',
    notas:
      'Núcleo puro + guardarraíl de CI (__tests__/guardrails/erroresHorneados.guardrail.test.ts). ' +
      'Marca el `catch` que devuelve JSX en un componente cuya salida se cachea ' +
      '(`revalidate`/`force-static`): ahí un fallo pasajero se congela como si fuera la página ' +
      'buena. Nace de un caso real (03/08/2026): `/administrativo-estado/test` sirvió ~17 h la ' +
      'pantalla «Error cargando temas» con los 45 temas intactos en la BD, y lo descubrió un ' +
      'usuario premium (feedback `ddaa31dd`), no nosotros. Salida legítima FIRMADA junto al catch ' +
      '(`erroresHorneados: excepcion — <por qué>`) para el fragmento decorativo que no debe tumbar ' +
      'la página entera; las firmadas van con trinquete para que no crezcan en silencio. ' +
      'Complemento en caliente: el texto está en TEXTOS_PANTALLA_ERROR de `lib/sim/oraculo.ts`, ' +
      'así que el barrido de rutas caza las que ya estén vivas.',
  },
  // ── Que el temario se pueda LEER (T-596) ──────────────────────────────────────────────────
  encabezado_articulo: {
    titulo: 'Qué se lee en la línea de un artículo del temario (rúbrica o, si no hay, su texto)',
    ruta: 'lib/teoria/encabezadoArticulo.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      'Núcleo puro y criterio ÚNICO: lo usan las 131 copias de `TopicContentView.tsx` (el render) y ' +
      'el kind `articulo_servido_sin_texto` del sweep (la medida), para que detector y página no ' +
      'puedan discrepar. Nace de que el encabezado colgaba solo de `article.title`, que 13.952 ' +
      'artículos activos (23% del banco) tienen a NULL TENIENDO el texto guardado: se servían mudos ' +
      '48 de 62 en un tema y lo destapó un premium estudiando, no una alerta. El arreglo es de ' +
      'RENDER y no un backfill (catorce mil rúbricas no se rellenan a mano, y el artículo que se ' +
      'importe mañana volvería a nacer roto). Aplicado a las 131 vistas con ' +
      '`npm run teoria:encabezado-articulo` (dry-run por defecto, no toca lo que no encaje con el ' +
      'patrón) y vigilado por `__tests__/guardrails/encabezadoArticulo.guardrail.test.ts`, que mira ' +
      'las 131: la oposición 132 nace vigilada aunque se copie de una vista vieja. Comprobación en ' +
      'caliente con navegador real: `npm run sim:articulo-con-texto` (validado por mutación — en ' +
      'rojo contra producción antes del deploy, con los 48 casos y sus caracteres guardados).',
  },
  // ── Consumo de LLM (API facturable + suscripción de Claude Code) ──────────────────────────
  llm_gasto: {
    titulo: 'Ver el consumo de LLM del sistema: lo que se factura y lo que consume cuota',
    ruta: 'scripts/observabilidad/llm-gasto.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/observability.md',
    notas:
      'npm run llm:gasto [-- --dias N] [--json]. Lee UNA fuente (`observable_events`, ' +
      'event_type=llm_call) y separa por `billing`: `api` cuesta dinero por token, `suscripcion` ' +
      '(Claude Code) consume CUOTA y su coste es 0 a propósito — sumarlos sería mentir en las dos ' +
      'direcciones. El coste de la API es ESTIMACIÓN nuestra (tarifas en lib/observability/llm.ts) ' +
      'y solo cubre los call-sites instrumentados: los que hablan en crudo con el proveedor están ' +
      'listados en lib/observability/llmCallSites.ts, con guardarraíl de trinquete en CI.',
  },
  // ── Un cero de un detector no se distingue de un detector muerto (T-529) ──────────────────
  health_kinds_evaluados: {
    titulo: 'Ver si un kind del barrido de salud se EVALUÓ de verdad, o si nadie lo mira',
    ruta: 'scripts/health/kinds-evaluados.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/health-check.md',
    notas:
      'npm run health:kinds-evaluados [-- --kind <kind>] [--dias N] [--umbral N] [--json]. Lee el ' +
      'latido que `content-health-sweep.service.ts` (el @Cron real) y su gemelo CLI escriben en ' +
      'CADA pasada — `cron_run` en `observable_events` con `metadata.kindsEvaluados` (kind → nº de ' +
      'sujetos mirados esta vez, con hallazgos o sin ellos). Antes de esto, `content_health_findings` ' +
      'a 0 para un kind significaba a la vez "vigilado y limpio" y "nadie lo miró", y no había forma ' +
      'de distinguirlos ([T-406], [T-384]). Núcleo puro en `lib/health/kindsEvaluados.cjs`: criterio ' +
      'AUTORREFERENCIAL (un kind visto en pasadas recientes que deja de aparecer = sospechoso), sin ' +
      'mantener una TERCERA copia del universo de ~50 kinds (ya duplicado entre el script CLI y el ' +
      '@Cron). Credencial: VENCE_LECTOR_URL (cae a DATABASE_URL si no está).',
  },
  llm_ingest_claude_code: {
    titulo: 'Meter el consumo de Claude Code (suscripción) en el stream de observabilidad',
    ruta: 'scripts/observabilidad/ingest-claude-code-usage.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/observability.md',
    notas:
      'npm run llm:ingest-claude-code [-- --dias N] [--dry]. Lee los transcripts locales de Claude ' +
      'Code (~/.claude/projects/**/*.jsonl), agrega por (día, sesión, modelo) y emite `llm_call` ' +
      'con billing=suscripcion. NO necesita clave ni llamar a Anthropic: la suscripción no expone ' +
      'facturación, así que esta es la única forma de ver qué sesión se come la cuota. IDEMPOTENTE ' +
      'por `dedupeKey` (día:sesión:modelo): re-ingerir un día lo actualiza, no lo duplica. Medido ' +
      'el 26/07: 49.456 respuestas y 20.081M tokens en 30 días, casi todo caché leída.',
  },
  plan_paso2_tras_literal: {
    titulo: 'Cerrar el Paso 2 (scope) tras reescribir epígrafes al literal, tema a tema y con la medición delante',
    ruta: 'scripts/temario/plan-paso2-tras-literal.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'Compañero de `sim-materias-ganadas`: convierte su medición en el `consensus.json` que come ' +
      '`verify:scope record`. Solo lee de BD (los veredictos previos); el registro lo hace el ' +
      'pipeline. Existe porque reescribir a literal deja TODO el Paso 2 en `stale` de golpe, y las ' +
      'dos salidas obvias son malas: re-sellar en bloque declara cobertura sin medir, y dejarlo ' +
      '`stale` esconde el trabajo. Medido el 27/07/2026: tcae_murcia 37 correct/6 issues, ' +
      'tcae_galicia 19/3, auxiliar_administrativo_clm 12/9 — cada issue con el bloque de materia ' +
      'escrito en `findings`, listo para la cola de generación sin re-investigar.',
  },
  sim_ultimo_verde_deploy: {
    titulo: '¿Qué commit desplegaría el lanzador AHORA? (último verde de main, sin desplegar nada)',
    ruta: 'scripts/deploy/sim-ultimo-verde.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/pusheo-revision-despliegue.md',
    notas:
      'Simula la decisión de `deploy-cuando-verde.sh` contra el CI REAL sin desplegar ni escribir: ' +
      'recorre los últimos N commits de origin/main, pide sus check-runs y aplica el MISMO núcleo ' +
      'puro que el lanzador (`lib/deploy/ultimoVerde.js`). Sin esto, la única forma de saber si el ' +
      'criterio funciona era lanzar un deploy y esperar quince minutos. Sirve también para calibrar ' +
      'la ventana: imprime a cuántos commits de la punta está el último verde. GOTCHA medido el ' +
      '06/08/2026 ([T-619]): el fenómeno es de RÁFAGA, no permanente — por la mañana, con huecos de ' +
      '~10 min entre pushes y runs de 3-4 min, cada commit se juzgaba y la punta estaba verde; por ' +
      'la tarde, con varias sesiones cerrando a la vez y pushes cada 2 min, 21 commits seguidos se ' +
      'quedaron sin veredicto. O sea que el gate se rompe JUSTO cuando más trabajo hay esperando.',
  },
  generar_bloques_por_oposicion: {
    titulo: 'Convertir a DATO las 131 getBlockInfo copiadas en los TopicContentView del temario',
    ruta: 'scripts/temario/generar-bloques-por-oposicion.cjs',
    estado: 'historico',
    runbook: 'docs/maintenance/crear-nueva-oposicion.md',
    notas:
      'UN SOLO USO (T-611): generó `lib/temario/bloquesPorOposicion.ts` y el fixture ' +
      '`__tests__/temario/fixtures/bloques-originales.json`. Se conserva como PRUEBA de cómo se ' +
      'derivó el dato, no para re-ejecutarlo: desde el borrado de los originales ya no hay de dónde ' +
      'derivar nada y el dato manda. Deriva del COMPORTAMIENTO (transpila cada getBlockInfo y la ' +
      'ejecuta para n=1..999), no del texto, así que la migración es equivalente por construcción: ' +
      '131/131 convertidas, 130.869 comprobaciones, 0 divergencias. GOTCHA que casi lo estropea: la ' +
      'primera versión muestreó hasta 120 y perdió los Bloques II a VI de administrativo-estado ' +
      '(numera 201..608) dando "0 divergencias", porque la comprobación medía sobre el MISMO rango ' +
      'truncado que la generación. Por eso hay una segunda comprobación por otro camino —los ' +
      'literales numéricos del código original, ignorando comentarios y textos, tienen que caber bajo ' +
      'el techo— que es la que lo cazó. Al dar de alta una oposición NO se ejecuta esto: se añade su ' +
      'fila a mano en bloquesPorOposicion.ts (el test de cobertura te para si falta).',
  },
  sim_materias_ganadas: {
    titulo: 'Medir qué materias GANA un temario al reescribir sus epígrafes al literal, y si las servimos',
    ruta: 'scripts/temario/sim-materias-ganadas.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'node scripts/temario/sim-materias-ganadas.cjs <pt> [--json salida]. Solo lectura. Compara el ' +
      'epígrafe ANTERIOR (dump previo en /tmp/verify_epigrafe_<pt>.json) con el actual en BD, saca ' +
      'los segmentos AÑADIDOS y mide si el tema sirve preguntas de esa materia. Responde a la ' +
      'pregunta que deja abierta toda reescritura a literal: el Paso 2 previo se verificó contra el ' +
      'texto CONDENSADO, así que su "correct" no dice nada de lo nuevo. Medido el 27/07/2026: ' +
      '`tcae_murcia` 40 temas ganaron materia y solo 8 segmentos sin cobertura; `tcae_galicia` 22 y 3 ' +
      '—uno de ellos "Representación, participación y negociación colectiva", que se había detectado ' +
      'a mano: la herramienta lo confirma sola—. Con eso el Paso 2 se cierra CON DATOS: el tema que ' +
      'ganó materia y la sirve recupera su veredicto; el que tiene hueco va a `issues` con el bloque ' +
      'concreto escrito, no a un sello en bloque.',
  },
  // ── programa_url: ¿el enlace lleva a un documento DE VERDAD? ──────────────────────────────
  sim_programa_url_vigilable: {
    titulo: 'Comprobar si el programa_url de las oposiciones activas es una página de error/login servida con 200',
    ruta: 'scripts/convocatoria/sim-programa-url-vigilable.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'Simulación ON-DEMAND, solo lectura: no escribe ni pinga badge. REUTILIZA `clasificarVigilancia` ' +
      '(el núcleo de T-165 para `seguimiento_url`) sobre la otra columna, en vez de abrir un detector ' +
      'nuevo. Medido el 27/07/2026 sobre 122 oposiciones activas: 3 hallazgos reales — ' +
      '`tecnico-auxiliar-universidad-de-murcia` (URL de FRAGMENTO del BORM `#/home/anuncio/…` = ' +
      'cascarón de SPA, con inscripción ABIERTA y 47 usuarios; repuntado al PDF directo), ' +
      '`correos-personal-operativo` (el sitio responde 200 con su página de error para cualquier ruta; ' +
      'su portal de empleo ya no existe en correos.es y vive tras login en conecta.correos.es) y ' +
      '`auxiliar-administrativo-diputacion-barcelona` (contenido dudoso). GOTCHA que invalidó la ' +
      'primera pasada: los boletines sirven PDF SIN extensión, así que sin extraer su texto TODOS ' +
      'parecen cascarón — daba 17 falsos positivos. Complementa a `convocatoria_enlace_no_boletin` ' +
      '(T-134), que juzga si la URL es del boletín que promete la etiqueta pero no si el documento VIVE.',
  },
  // ── configurador de tests ─────────────────────────────────────────────────────────────────
  sim_estimate_por_leyes: {
    titulo: 'Comprobar que el contador del configurador "por leyes" dice la verdad',
    ruta: 'scripts/sim/sim-estimate-por-leyes.ts',
    estado: 'vivo',
    runbook: 'docs/roadmap/tareas-pendientes.md',
    notas:
      'npx tsx --env-file=.env.local scripts/sim/sim-estimate-por-leyes.ts. Solo lectura. Contrasta ' +
      '`estimateAvailableQuestions` SIN tema (modo por leyes, T-326) contra SQL escrito aparte: total ' +
      'por ley, oficiales de la propia oposición, acotado a artículos concretos, oposición sin banco ' +
      'oficial propio (debe dar 0, NO el cross-oposición), **oposición SIN TEMARIO construido — ' +
      'acotar tiene que DEGRADAR, no dar 0 (T-551)** y sin selección. **Lo que vigila no es la ' +
      'aritmética sino el CRITERIO**: ese número es el que enciende la casilla "🏛️ Preguntas ' +
      'oficiales" y el que el usuario lee antes de decidir, así que si cuenta oficiales de otras ' +
      'oposiciones sobre leyes compartidas (CE, LOTC…) promete preguntas que el test no va a servir ' +
      '— el bug del label "115" de Seg. Social T3, por el otro lado. Un test con mocks no lo caza. ' +
      'Correrla al tocar `lib/api/test-config/queries.ts` o el conteo de oficiales. ⚠️ **Mide la ' +
      'copia del FRONTEND, que producción no ejecuta** — para el camino servido, `sim_estimate_servido`.',
  },
  sim_estimate_servido: {
    titulo: 'El contador «por leyes» dice la verdad EN EL CAMINO QUE DE VERDAD SIRVE',
    ruta: 'scripts/sim/sim-estimate-servido.ts',
    estado: 'vivo',
    runbook: 'docs/roadmap/tareas-pendientes.md',
    notas:
      '`npm run sim:estimate-servido` (o `SIM_BASE=https://www.vence.es …`). Solo lectura. Va por ' +
      'HTTP a `/api/v2/test-config/estimate`, así que le da igual quién responda: **mide lo que ve ' +
      'el usuario**, no una función. Nace de que el mismo defecto se escapó TRES veces —T-326 (la ' +
      'lógica solo en el frontend), T-551 (la guarda en un camino y no en su gemelo) y el arreglo de ' +
      'T-551, aplicado otra vez solo al frontend— mientras las capas daban verde porque preguntaban ' +
      'a la copia equivocada: la familia `test-config` está enrutada al backend (`x-served-by: ' +
      'vence-backend`). Dos casos y los DOS hacen falta: **degradación** (oposición sin temario ' +
      'construido → acotar no puede dar 0) y **control** (oposición con temario → acotar TIENE que ' +
      'recortar); sin el control, un "degradar siempre" pasaría la prueba y estaríamos sirviendo ' +
      'materia fuera de programa, que es el defecto opuesto y peor. Los fixtures se descubren de la ' +
      'BD, no se clavan, para que siga valiendo cuando esas oposiciones tengan temario. ' +
      '**TERCER caso desde [T-623]: que la petición QUEPA.** Los dos anteriores preguntan si el ' +
      'número es correcto; éste pregunta algo anterior — si la petición llega siquiera. La selección ' +
      'de artículos viaja DENTRO de la URL como JSON y al url-encodificar se triplica, así que a ' +
      'partir de ~8 KB nginx corta con 414/494 y devuelve HTML; el cliente lo parsea como JSON, ' +
      'revienta, y la pantalla se queda igual: el usuario lo vive como que la app se ha colgado (lo ' +
      'reportó una usuaria, no una alerta). Por eso la simulación lee el cuerpo como TEXTO antes de ' +
      'parsear: así dice «el servidor devolvió HTML, HTTP 414, URL de N bytes» en vez del críptico ' +
      '«Unexpected token \'<\'» que ve el usuario.',
  },
  audit_verificacion_cosmetica: {
    titulo: 'Preguntas que figuran VERIFICADAS apoyándose solo en un pase cosmético',
    ruta: 'scripts/audit-verificacion-cosmetica.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/revisar-preguntas-con-agente.md',
    notas:
      '`npm run audit:verificacion-cosmetica [--json]`. SOLO LEE. Núcleo puro ' +
      '`lib/calidad/verificacionCosmetica.cjs` (12 tests). Nace de T-465: un pase cuyo trabajo era ' +
      'REESCRIBIR explicaciones firmó `article_ok`/`answer_ok` con confianza alta, y con eso siete ' +
      'preguntas inestudiables quedaron marcadas como comprobadas hasta que un usuario las impugnó ' +
      'una a una. Medido el 01/08/2026: 4.159 firmas cosméticas afirmando fondo, 1.713 preguntas ' +
      'activas cuya ÚNICA verificación es un pase así. La PREVENCIÓN no está aquí sino en el punto ' +
      'de escritura: trigger `tg_verificacion_cosmetica_no_firma` (migración ' +
      '20260801_verificacion_cosmetica_no_firma.sql), que pone esos flags a NULL y emite ' +
      '`verificacion_cosmetica_firmaba_fondo`. Este script solo INVENTARÍA lo que ya se firmó antes.',
  },
  explicaciones_bucle_reescritura: {
    titulo: 'Bucle para reescribir explicaciones a escala (gate de citas, volcado para re-verificar, correcciones con rastro)',
    ruta: 'scripts/explicaciones/',
    estado: 'vivo',
    runbook: 'docs/maintenance/revisar-preguntas-con-agente.md',
    notas:
      'Cinco herramientas + README con el bucle entero. NO son de una tarea concreta: sirven para ' +
      'cualquier reescritura de explicaciones a escala (T-409, T-249, T-197, T-424, T-207). ' +
      '`gate-citas.cjs --pre|--post` es el paso 5 del manual y acumula TRES modos de cita cortada ' +
      'que costó encontrar uno a uno —por el final (falta la palabra que decide: «diez días» sin ' +
      '«naturales»), por el principio (arranca en minúscula y pierde el sujeto) y por quedarse en ' +
      'los dos puntos (la enumeración que prueba la clave queda fuera)— más el punto final AÑADIDO, ' +
      'donde el artículo tenía una coma y seguía con una salvedad. La lección general vale para ' +
      'cualquier gate: comprobar la FORMA del recorte no dice nada si esa forma la produce el propio ' +
      'recortador; hay que comprobarla contra la FUENTE. ' +
      '`dump-preguntas-vivas.cjs` prepara el paso 7 (re-verificación por agente independiente sobre ' +
      'la pregunta VIVA), que sobre 16 lotes encontró defectos en 8 y NINGUNO lo veía un gate ' +
      'determinista: todos eran afirmaciones de derecho falsas con la forma impecable. ' +
      '`corregir-enunciado.cjs` y `corregir-opcion.cjs` hacen el UPDATE y el evento de ' +
      'observabilidad EN UNA TRANSACCIÓN (`enunciado_referencia_corregida`, `opcion_errata_corregida`) ' +
      'con el texto anterior y el nuevo. ⚠️ `corregir-opcion` aborta si el cambio supera 3 caracteres: ' +
      'cambiar el CONTENIDO de una opción toca a la clave y no se hace de pasada; la errata legítima ' +
      'que excede el margen va con `--forzar`, que deja constancia del forzado en el evento en vez ' +
      'de relajar la guarda. Vivían en `scratchpad/` y se subieron al comprobar que ya no se ' +
      'reescribían «en cinco minutos».',
  },
  audit_explicacion_truncada: {
    titulo: 'Explicaciones activas que se cortan a mitad de frase',
    ruta: 'scripts/audit-explicacion-truncada.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      '`npm run audit:explicacion-truncada [-- --json] [-- --muestra 20]`. SOLO LEE. Núcleo puro ' +
      '`lib/health/explicacionTruncada.cjs` (26 tests, todos con textos reales del banco), cableado a ' +
      'los dos gemelos del sweep con el kind `explicacion_truncada` y paridad vigilada por ' +
      '`__tests__/backend/contentSweepTruncadaParity.test.ts`. ' +
      'LO QUE COSTÓ NO FUE EL BARRIDO SINO LA CALIBRACIÓN (T-250, abierta desde el 28/07 justo por ' +
      'eso): la heurística ortográfica «no acaba en signo de cierre» da 8.938 sobre 136.310 activas ' +
      'y casi todas son CORRECTAS — cierran con la referencia de la fuente, con una URL, o están mal ' +
      'puntuadas pero completas. Cablear eso habría llenado la bandeja de aciertos y matado el ' +
      'detector. El criterio que sí discrimina es GRAMATICAL: la última palabra pide continuación ' +
      '(preposición, conjunción, determinante) o el texto acaba en coma → 112 hallazgos, 20 de 20 ' +
      'correctos en muestra aleatoria juzgada a mano. ⚠️ Las tres exclusiones NO son cosmética: sin ' +
      'ellas vuelven los falsos positivos que hundieron la primera versión — URLs (el `isAllowed=y` ' +
      'final es un parámetro, no la conjunción), locuciones de cierre («entre otros») y letra suelta ' +
      'en MAYÚSCULA (la «O» de una tabla de coordenadas es Oeste, no una conjunción). ' +
      'La muestra es determinista a propósito (sin Math.random): re-calibrar exige reproducirla.',
  },
  audit_explicacion_yuxtaposicion: {
    titulo: 'Explicaciones que reproducen la opción FALSA con la palabra buena pegada, sin veredicto',
    ruta: 'scripts/audit-explicacion-yuxtaposicion.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      '`npm run audit:explicacion-yuxtaposicion [-- --json] [-- --muestra 20]`. SOLO LEE (T-525). ' +
      'Núcleo puro `lib/health/explicacionYuxtaposicion.cjs` (27 tests con casos reales del banco), ' +
      'cableado al sweep (subproceso, kind `explicacion_yuxtaposicion`) desde `scripts/health-sweep.cjs`. ' +
      'CLI-only por la MISMA razón que `cita_no_literal`/`barrido-citas.cjs`: compara, opción por ' +
      'opción, el segmento de la explicación contra el texto de esa opción, y eso no cabe en un ' +
      '`WHERE` ni lo puede correr el backend NestJS (proyecto aparte, sin `lib/`). ' +
      'CRITERIO: por cada opción que NO es la correcta, ¿su segmento de explicación (viñeta `- A) …`) ' +
      'CONTIENE casi la opción entera (ratio de longitud 0,85-1,7) y NO lleva ninguna palabra ni ' +
      'marca de veredicto? Medido 05/08/2026 sobre las 2.816 activas con plantilla de viñetas: 172 ' +
      'preguntas / 210 segmentos, 26 de examen oficial; 28/30 en muestra aleatoria juzgada a mano. ' +
      '⚠️ Tres exclusiones sostienen la precisión — sin ellas el ratio de opciones CORTAS (tipo ' +
      'checklist de ofimática, "Sumar"/"Recuento") se dispara de casualidad, y preguntas «señale la ' +
      'excepción» marcan las demás opciones con un ✓ o una afirmación en prosa («cierto», «sí está», ' +
      '«también está», «está en el listado») que SÍ comunican un veredicto (aunque sea "sí") y no son ' +
      'el silencio que define el defecto. GOTCHA de la calibración: `\\b` en JS NO reconoce vocales ' +
      'acentuadas como "de palabra", así que un patrón cerrado con `est[aá]\\b` deja de casar "está" ' +
      'seguida de espacio — el límite ya ocurrió entre la "t" y la "á". Se cierra con lookahead ' +
      'explícito (`(?=\\s|$|[.,;:])`) en su lugar; el test que lo demuestra pilló el bug antes de mandar.',
  },
  // ── salud del contenido: teoría servida ───────────────────────────────────────────────────
  audit_tablas_refluidas: {
    titulo: 'Tablas de boletín que se sirven como párrafo corrido (el punto ciego de detectFlattenedTable)',
    ruta: 'scripts/audit-tablas-refluidas.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/tablas-articulos.md',
    notas:
      '`npm run audit:tablas-refluidas [-- --json]`. SOLO LEE. Núcleo puro ' +
      '`lib/teoria/detectReflowedTable.cjs` (6 tests con casos reales). **COMPLEMENTA a ' +
      '`detectFlattenedTable`, no lo duplica**, y el discriminante es medible: aquel busca rachas de ' +
      'LÍNEAS CORTAS (la salida cruda de pdftotext) y se queda mudo en cuanto el texto se RE-FLUYE, ' +
      'que es justo lo que el manual de generación manda hacer antes de insertar. Este mira la huella ' +
      'que sobrevive al re-fluido: cabeceras de columna en mayúsculas encajadas en el párrafo y, sobre ' +
      'todo, REPETIDAS (el salto de página del boletín reimprime la fila de encabezados). ' +
      'Medido el 03/08/2026 sobre los 54.674 artículos activos: **1 hallazgo**. ' +
      '⚠️ Su primera versión daba 2 y el de más impacto (78 preguntas servidas) era un FALSO POSITIVO: ' +
      'un texto de esterilización que escribe «ZONA SUCIA/LIMPIA/ESTÉRIL» en mayúsculas por énfasis. ' +
      'Por eso la lista de cabeceras se podó de las palabras que la prosa usa igual (ZONA, PERSONAL, ' +
      'TOTAL, GRUPO, NIVEL). **LÍMITE CONOCIDO:** solo ve cabeceras en MAYÚSCULAS; una tabla re-fluida ' +
      'con encabezados en minúscula sigue siendo invisible. Segunda señal candidata sin calibrar: ' +
      'densidad de cifras con unidad (≥6 por párrafo) → 30 artículos, precisión sin medir. ' +
      'BAJO DEMANDA, no pinga el badge.',
  },
  // ── salud del contenido: psicotécnicas ────────────────────────────────────────────────────
  audit_psico_explicacion: {
    titulo: 'Psicotécnicas cuya explicación no llega a la respuesta que dice explicar',
    ruta: 'scripts/audit-psico-explicacion.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/impugnaciones-claude-code.md',
    notas:
      '`npm run audit:psico-explicacion [-- --todos] [-- --json]`. SOLO LEE. Núcleo puro ' +
      '`lib/health/psicotecnicoExplicacionSinRespuesta.cjs` (19 tests, todos con preguntas reales). ' +
      'CUBRE UN HUECO ENTERO: los detectores de explicaciones del barrido (`audit_note_explanation`, ' +
      '`explicacion_estructura_rota`, `cita_no_literal`) comparan contra el ARTÍCULO vinculado, y una ' +
      'psicotécnica no tiene artículo → 7.040 preguntas activas con explicación y cero cobertura. ' +
      'Nace de la impugnación `3ff87618` (03/08/2026), donde la CLAVE era correcta y la explicación ' +
      'razonaba sobre otro deportista: llegaba al número bueno por un camino falso. ' +
      'Medido: 3.630 medibles → 48 graves (nota interna publicada, se corta sin resolver, o cierra ' +
      'con la cifra de OTRA opción) + 123 avisos (nunca menciona su cifra). BAJO DEMANDA, no pinga el ' +
      'badge: el criterio dice si la explicación CIERRA, no si el razonamiento es correcto — y el caso ' +
      'origen citaba su cifra. ⚠️ Su primera versión marcaba por LONGITUD y daba 296 graves con 4 de ' +
      'los 5 primeros sanos: en psicotécnicos la explicación buena es corta por naturaleza. Las ' +
      'exenciones (decimal con apóstrofo, miles con punto, clave con varias cifras, clave por rango, ' +
      'redondeo, clave que enumera enunciados) salen de leer los marcados, no de imaginarlos.',
  },
  // ── salud del contenido: pregunta ↔ artículo ──────────────────────────────────────────────
  audit_instrumento_derivado: {
    titulo: 'Preguntas que piden el contenido de un Plan/Estrategia que la ley solo manda crear',
    ruta: 'scripts/audit-instrumento-derivado.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      '`npm run audit:instrumento-derivado [-- --ley <texto>] [--json]`. SOLO LEE. Núcleo puro en ' +
      '`lib/health/instrumentoDerivado.cjs` (13 tests, calibrado con las 9 preguntas reales del art. 7 ' +
      'de la Ley 12/2007 clasificadas a mano). **HERMANO de `audit:vinculo-vecino`, no un duplicado**: ' +
      'reutiliza sus primitivas (`norm`/`words`/`recall`, las exclusiones de negación y meta-opción) y ' +
      'se distingue por un discriminante medible — allí un artículo VECINO sí responde y el arreglo es ' +
      're-vincular; aquí NO responde ninguno de la ley y el arreglo es importar el instrumento o retirar ' +
      'la pregunta. Por eso aquel se queda mudo en estos casos: exige un vecino al que apuntar. ' +
      'Medido el 01/08/2026 sobre el banco: 147 preguntas nombran un instrumento, 38 hallazgos ' +
      '(6 firmes + 32 «hay que leer»), 33 descartadas por responderlas el artículo. BAJO DEMANDA, no ' +
      'pinga el badge (mismo criterio que el hermano). Nace de 5 impugnaciones ciertas de un usuario ' +
      'premium que ningún detector del barrido podía ver.',
  },
  sim_baja_emails_vivo: {
    titulo: 'Comprobar que el SERVIDOR DESPLEGADO respeta la casilla de la baja masiva de emails',
    ruta: 'scripts/sim/sim-baja-emails-vivo.cjs',
    estado: 'vivo',
    runbook: 'docs/roadmap/tareas-pendientes.md',
    notas:
      'npm run sim:baja-emails-vivo [-- --base http://localhost:3000]. POST real contra ' +
      '`/api/unsubscribe` del servidor vivo, con usuarios EFÍMEROS que crea y borra él mismo ' +
      '(seguro contra producción). **NO duplica a `sim:baja-emails`**: aquélla llama a ' +
      '`processUnsubscribeByToken` EN PROCESO —ejercita la lógica con el código de tu árbol, que es ' +
      'la capa correcta para el UPDATE con columnas dinámicas que los tests no ven porque mockean ' +
      'Drizzle—; ésta pregunta si lo que hay VIVO se comporta así. La distancia entre las dos no es ' +
      'teórica: [T-369] estuvo un día con el arreglo en verde en local y el defecto vivo en ' +
      'producción, y el mismo 01/08 [T-450] enseñó la versión cara —un arreglo desplegado, con tests ' +
      'y guardarraíl en verde, que en producción no hacía nada—. **Son DOS casos y el segundo es lo ' +
      'que lo hace medir algo**: sin marcar la casilla `email_soporte_disabled` sigue en false, ' +
      'marcándola pasa a true; un endpoint que ignorase el campo pasaría el primero con nota. ' +
      'Correrla tras tocar `/api/unsubscribe`, `processUnsubscribeByToken` o el modal de ' +
      '`app/unsubscribe/page.tsx`.',
  },
  // ── el repaso de un test es de su dueño ───────────────────────────────────────────────────
  sim_repaso_ajeno: {
    titulo: 'Comprobar que el repaso de un test no se le sirve a otra persona (T-482)',
    ruta: 'scripts/sim/sim-repaso-ajeno.ts',
    estado: 'vivo',
    notas:
      'SIM_BASE=http://localhost:3477 npx tsx --env-file=.env.local scripts/sim/sim-repaso-ajeno.ts ' +
      '(necesita AUTH_SECRET de SSM /vence-frontend/AUTH_SECRET). Navegador real + BD real. ' +
      'CINCO casos: (1) el dueño ve SU repaso —y con Bearer—, (2) con la sesión de A el repaso de B ' +
      'da 403 y no se pinta nada suyo, (3) sin sesión el GET da 401 y el cuerpo no lleva preguntas, ' +
      '(4) el gemelo psicotécnico igual, (5) `POST /api/tests/recover` sin sesión no escribe (se ' +
      'cuentan las filas antes y después). ' +
      '⚠️ HACE FALTA NAVEGADOR y no basta con tests: la mitad del arreglo vive en el CLIENTE ' +
      '(`app/revisar/[testId]/page.tsx` tiene que mandar el Bearer), y si no lo manda la pantalla ' +
      'de repaso se queda en 401 para TODO el mundo sin que typecheck ni unit digan nada — es la ' +
      'lección ya pagada en `project-admin-endpoints-sin-auth`. ' +
      '⚠️ GOTCHA de medida: NO usar un `waitForTimeout` para dar por buena la respuesta. En dev la ' +
      'primera compilación de la ruta tarda varios segundos y el caso 1 salía ROJO con el arreglo ' +
      'bien puesto (la petición salía con su Bearer y la respuesta llegaba después de mirar). Se ' +
      'espera la RESPUESTA (`waitForResponse`): un canario que depende de lo rápido que compile la ' +
      'máquina no es un canario. ' +
      'Contraste que demuestra que tiene colmillo: el mismo GET contra producción (código anterior) ' +
      'devuelve 200 con las 25 preguntas del examen y las respuestas de esa persona.',
  },
  // ── el repaso de fallos respeta los artículos que el usuario acotó ────────────────────────
  sim_repaso_articulos: {
    titulo: 'Comprobar que el repaso de fallos NO sirve artículos fuera de la selección (T-603)',
    ruta: 'scripts/sim/sim-repaso-articulos.ts',
    estado: 'vivo',
    notas:
      '`npm run sim:repaso-articulos` (o `SIM_BASE=http://localhost:3477 …`; necesita AUTH_SECRET de ' +
      'SSM /vence-frontend/AUTH_SECRET). SOLO LEE. Navegador real + BD real: descubre solo un usuario ' +
      'con fallos en ≥3 artículos de una misma ley, acuña su sesión y mira los artículos que el ' +
      'ENDPOINT sirve. Tres casos: acotado a un artículo no aparece ningún otro · SIN acotar sigue ' +
      'llegando la ley entera (contraste, sin el cual un filtro que devolviera SIEMPRE vacío pasaría ' +
      'el primero) · acotar recorta de verdad. ' +
      '⚠️ HACE FALTA NAVEGADOR: el defecto vivía ENTRE dos pantallas (el configurador construía bien ' +
      'la selección y el salto a /test/repaso-fallos-v2 la tiraba por el camino), así que ninguna de ' +
      'las dos piezas estaba «mal» por separado y ningún test las cazó en dos meses y medio. ' +
      'Contraste medido el 06/08: contra PRODUCCIÓN (código anterior) sirve 47 de 50 preguntas fuera ' +
      'del artículo pedido; con el arreglo, 0 de 2. ' +
      'Complementa —no sustituye— a `__tests__/api/tests/failedQuestionsLawScope.test.ts` (el salto ' +
      'configurador→URL, con ida y vuelta contra el parser de producción) y al NIVEL A-bis de ' +
      '`__tests__/integration/failedQuestionsLawScope.integration.test.ts` (la query real contra RDS).',
  },
  // ── ¿lo que servimos entra en el temario de quien lo recibe? ──────────────────────────────
  sim_scope_servido: {
    titulo: '¿Le servimos a ESTA persona preguntas fuera de SU temario? (medida hacia delante, T-607)',
    ruta: 'scripts/sim/sim-scope-servido.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      '`npm run sim:scope-servido -- --usuario <uuid>` o `-- --oposicion <position_type>` (elige un ' +
      'usuario real con historial); `--ruta` para otro camino (p.ej. el examen de un tema), ' +
      '`--tandas N`, `SIM_BASE` para local. Necesita AUTH_SECRET de SSM. SOLO LEE. ' +
      '⚠️ MIDE HACIA DELANTE, y ese es el punto: la misma pregunta se intentó responder DOS veces ' +
      'cruzando servidas de hace días contra el `topic_scope` de hoy ([T-583] y la 1ª versión de ' +
      '[T-607]) y las dos dieron cifras sin significado — si a una pregunta le cambian el artículo o ' +
      'alguien recorta un scope, la servida de la semana pasada aparece «fuera» sin haberlo estado ' +
      'nunca, y **`topic_scope` no tiene `updated_at`**, así que hacia atrás no se puede resolver. ' +
      'Aquí las preguntas se piden AHORA con la sesión de un usuario REAL y se juzgan contra el ' +
      'scope de AHORA. ' +
      'El criterio NO se reimplementa: lo pone `fueraDeScope` (`lib/api/_shared/topicScopeSql.ts`), ' +
      'gemelo en memoria de `articleInScope` — respeta `article_numbers IS NULL` = «toda la ley», ' +
      'que es justo el error que infló las dos mediciones anteriores (46 de 73 «fugas» eran legítimas). ' +
      'GOTCHA de medida: la ley y el artículo se resuelven en BD por `question.id`, NO leyendo el ' +
      'JSON servido — adivinar el nombre del campo dio un falso «40 de 40 fuera» el 06/08. ' +
      'NO sustituye a la sonda continua que sigue pendiente en [T-607] (esa mide todas las servidas ' +
      'de todo el mundo en el punto de servicio); esta es la versión bajo demanda, para contestar ' +
      'una impugnación concreta («¿le va a volver a pasar?») sin esperar días de telemetría. ' +
      'Usada el 06/08 para cerrar `dba485dc`/`410025b4` (Lucia, UC3M): 50 servidas por Test Rápido y ' +
      '32 por el examen de su tema, 0 fuera.',
  },
  // ── un modal abierto en móvil, ¿se puede TOCAR entero? ────────────────────────────────────
  sim_modal_tocable: {
    titulo: 'Comprobar que un modal en móvil no tiene zonas que se ven pero no se pueden pulsar (T-608)',
    ruta: 'scripts/sim/sim-modal-tocable.ts',
    estado: 'vivo',
    notas:
      '`npm run sim:modal-tocable -- --usuario <uuid>` (o `--oposicion <position_type> --tema N`, ' +
      '`--movil "iPhone 13"`, `SIM_BASE` para local). Necesita AUTH_SECRET de SSM. SOLO LEE. ' +
      'Abre el modal de «solo preguntas falladas» en un viewport de móvil y pregunta, punto por ' +
      'punto de arriba abajo, **quién recibiría el toque** (`document.elementFromPoint`). ' +
      '⚠️ LAS TRES CONDICIONES SON NECESARIAS A LA VEZ, y por eso el fallo llevaba tiempo ' +
      'invisible: **móvil** (en escritorio el modal no llega a la franja de abajo), **con el ' +
      'banner de cookies EN PANTALLA** (quien ya las aceptó no vuelve a verlo, y desde ahí ' +
      'probamos siempre) y mirando el PUNTO, no el aspecto — el modal se pintaba perfecto. ' +
      'Corre las dos pasadas y el CONTRASTE no es adorno: si aceptar las cookies no cambiara el ' +
      'resultado, la simulación no estaría midiendo el banner. Solo cuenta como fallo la pasada ' +
      'sin aceptar. ' +
      'Contraste medido el 06/08: contra PRODUCCIÓN, 2 de 5 puntos del modal se los queda el ' +
      'banner (z=9999 sobre el modal en z=50); con el arreglo (`CAPAS.modal`), 0 de 5. ' +
      'GOTCHA de medida: se espera la RESPUESTA del endpoint de falladas y luego a que el modal ' +
      'sea visible, NUNCA un `waitForTimeout` — en dev la primera compilación tarda y daba «el ' +
      'modal no llegó a abrirse» con el arreglo bien puesto. ' +
      'El criterio de capas vive en `lib/ui/capas.ts` (`CAPAS`/`tapaA`, 6 tests): quedan **41** ' +
      'ficheros con modales en `z-50` sin migrar, que es la parte 2 de [T-608].',
  },
  // ── suplantación («ver como usuario») ─────────────────────────────────────────────────────
  sim_impersonacion: {
    titulo: 'Comprobar que la suplantación es de solo lectura, visible, cerrable y que CADUCA sola',
    ruta: 'scripts/sim/sim-impersonacion.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/suplantacion-ver-como-usuario.md',
    notas:
      'npx tsx scripts/sim/sim-impersonacion.ts [userId] [--url …], con AUTH_SECRET y DATABASE_URL ' +
      'del entorno (`.env.development.local` en local). Navegador real (Playwright) contra servidor ' +
      'real; NO escribe nada (el POST de prueba usa un id inexistente). 10 comprobaciones del ciclo ' +
      'entero: identidad del usuario, marca `imp` hasta el access token, escritura 403, lectura 200, ' +
      'franja visible, salida, y —desde T-335— que con el plazo VENCIDO no se acuña token ni se sirve ' +
      'la cuenta, incluida la variante «sin reloj» (sesiones anteriores al arreglo). **Lo que le da ' +
      'valor es el CONTRASTE**: cada rechazo va emparejado con el caso que SÍ debe pasar (la misma ' +
      'escritura con sesión normal; la misma cookie rotada dentro de plazo). Sin eso, un 401/403 ' +
      'puede venir de cualquier causa y parecer que la protección funciona — que es exactamente cómo ' +
      'se coló el fallo del 30/07: la sim daba verde midiendo el arranque de la suplantación, nunca ' +
      'su final. Correrla tras tocar `verifyAuth`, `authjs.ts`, `mintAccessToken` o el endpoint.',
  },
  medir_pago_fallido_falsos: {
    titulo: 'Medir a cuánta gente que PAGA BIEN le mandamos «Problema con el pago» (T-594)',
    ruta: 'scripts/stripe/medir-pago-fallido-falsos.cjs',
    estado: 'vivo',
    notas:
      'npm run stripe:pago-fallido-falsos [-- --dias 30]. Solo LEE. Cruza los correos ' +
      '`pago_fallido` con la suscripción del destinatario: si su periodo arrancó a los pocos ' +
      'segundos, el «fallo» era la autenticación del banco (3DS/SCA), que Stripe anuncia con un ' +
      '`invoice.payment_failed` que no es un rechazo. Medido el 05/08/2026 antes del arreglo: ' +
      '**148 de 214 (69%)** en 30 días, la mayoría ~5 s ANTES de que arrancara su periodo, es ' +
      'decir en mitad de la compra. Sirve para dimensionarlo y para comprobar tras el despliegue ' +
      'que baja a cero. El criterio del arreglo vive en `lib/stripe/falloPagoReal.ts`.',
  },
  avisar_usuario: {
    titulo: 'Escribirle a UNA persona por algo que hemos detectado NOSOTROS (T-601)',
    ruta: 'scripts/soporte/avisar-usuario.cjs',
    estado: 'vivo',
    notas:
      'node scripts/soporte/avisar-usuario.cjs --a <email> --asunto "…" --texto <fichero.md> ' +
      '--motivo "…" [--preview <email>] [--enviar]. SIMULA por defecto (enseña el correo entero ' +
      'sin tocar nada). Cubre el hueco entre las otras cuatro vías de envío, que todas RESPONDEN a ' +
      'algo que la persona escribió antes (impugnación, feedback, newsletter): ésta es para quien ' +
      'NO ha reclamado. Lleva la puerta `exigirPersona(\'aviso\')` — un trabajador de la flota no ' +
      'puede usarla — y registra en `email_events` con `email_type=aviso_soporte` (tipo propio, no ' +
      '`soporte_respuesta`: mezclarlos haría que ese cubo signifique lo que contestamos Y lo que ' +
      'iniciamos). El MOTIVO es obligatorio y queda escrito: es lo que explica dentro de seis meses ' +
      'por qué le escribimos a alguien que no había pedido nada. ⚠️ NO es para campañas (eso es ' +
      '`scripts/newsletters/`): una persona y un motivo concreto.',
  },
  compras_atascadas: {
    titulo: 'Encontrar a quien lleva días intentando pagarnos y no puede (T-601)',
    ruta: 'scripts/stripe/compras-atascadas.cjs',
    estado: 'vivo',
    notas:
      'npm run stripe:compras-atascadas [-- --dias 60]. Solo LEE (escribe únicamente con ' +
      '--rescatar <cus_id>, que expira sus checkouts abiertos). Recorre TODAS las cuentas de ' +
      'Stripe y busca clientes con suscripciones `incomplete`, cargos FALLIDOS y ningún cobro: ' +
      'ingreso que no entra y que no vigilaba nada. ⚠️ NO confundir con ' +
      '`stripe:pago-fallido-falsos` (T-594), que es lo contrario (el pago va bien y el defecto es ' +
      'nuestro correo). **El corte descarta el abandono**: medido el 06/08/2026 sobre 60 días, 8 ' +
      'clientes nunca pagaron pero 6 no tenían ni un cargo (abrieron el checkout y se fueron, ' +
      'embudo normal); exigir ≥1 cargo fallido deja **2**, que son los reales — los dos muriendo ' +
      'en `link`. Complementa a la alerta `compra_atascada_checkout_expirado`, que solo ve a quien ' +
      'INTENTA cancelar; esto ve a quien ya está atrapado y calla. Criterio compartido con ' +
      '`lib/stripe/cancelCheckoutAbierto.ts`.',
  },
  sim_identidad_pago: {
    titulo: 'Comprobar que en los endpoints de pago la identidad sale del token y no del cliente',
    ruta: 'scripts/sim/sim-identidad-pago.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/suplantacion-ver-como-usuario.md',
    notas:
      'npx tsx scripts/sim/sim-identidad-pago.ts [--url …], con AUTH_SECRET y DATABASE_URL del ' +
      'entorno. 10 comprobaciones contra servidor real; NO escribe en Stripe (lo único legítimo ' +
      'que ejerce es abrir un portal de facturación, que no cobra). Cubre el agujero T-340: ' +
      '`cancel`, `reactivate`, `subscription` (GET y portal), `create-checkout` y ' +
      '`cancel/feedback` leían el userId del CUERPO sin token → con el UUID de otra persona se ' +
      'le podía cancelar la suscripción, **reactivársela** (volver a cobrarle), leer su ' +
      'facturación o abrirle el portal. Cada rechazo va emparejado con el caso que SÍ debe ' +
      'pasar (leer suplantando, y que el dueño pueda leer y abrir su portal): sin ese ' +
      'contraste, un endpoint que devolviera 403 a todo el mundo se leería como un éxito. ' +
      'Correrla tras tocar cualquier ruta de /api/stripe o el helper `requireUsuarioPropio`. ' +
      'El guardarraíl estático que la acompaña es `__tests__/guardrails/endpointsPagoIdentidad.test.ts`.',
  },
  // ── precio heredado del vaciado de la cuenta de cobro antigua ─────────────────────────────
  //
  // TRES piezas que escriben `user_price_offers` y crean prices/enlaces en Stripe. Antes de
  // tocar el precio de nadie, mirar aquí: la tarifa la decide UN solo núcleo puro
  // (`lib/stripe/precioHeredado.ts`), y una cuarta puerta con criterio propio significaría
  // cobrar dos importes distintos por el mismo caso.
  precio_heredado_cli: {
    titulo: 'Mantenerle a UNA persona el precio que tenía, a mano (caso reclamado por soporte)',
    ruta: 'scripts/stripe/precio-heredado.cjs',
    estado: 'vivo',
    notas:
      'node scripts/stripe/precio-heredado.cjs — crea el price + Payment Link + la fila de ' +
      '`user_price_offers` (`creado_por=soporte`) para quien RECLAMA. Es la vía de una en una, ' +
      'con criterio humano: sirve cuando el importe no se puede derivar o no es una de las tres ' +
      'tarifas del catálogo. Para el resto está `oferta_heredada_auto`, que hace lo mismo sola ' +
      'cuando la persona pulsa su botón. Las dos comparten la decisión del importe con ' +
      '`lib/stripe/precioHeredado.ts` (núcleo puro, con test de paridad): NO duplicar ahí las ' +
      'tarifas ni los lookup_key, o dos personas del mismo caso acabarán pagando distinto.',
  },
  oferta_heredada_auto: {
    titulo: 'Recuperar automáticamente el precio anterior de los afectados por el vaciado de Stripe',
    ruta: 'lib/api/premium/ofertaHeredada.ts',
    estado: 'vivo',
    notas:
      'Lo llama `POST /api/v2/premium/recuperar-precio` desde el botón del perfil (T-341). ' +
      'Deriva la tarifa del histórico REAL en la cuenta antigua y crea la oferta en la cuenta ' +
      'que HOY cobra — porque una suscripción no se puede mover entre cuentas de Stripe, así ' +
      'que lo que se recupera es el PRECIO, no la suscripción. Idempotente por dos vías: ' +
      '`lookup_key` para el price (las personas con la misma tarifa comparten price) y el ' +
      'índice único **PARCIAL** `user_price_offers_una_por_precio` para la fila. GOTCHA que ' +
      'costó un 500 en la primera prueba real: ese índice lleva ' +
      '`WHERE redeemed_at IS NULL AND revoked_at IS NULL`, y un `ON CONFLICT` que no repita ese ' +
      'predicado NO lo reconoce y hace fallar el INSERT entero. Si la fila no llega a entrar, ' +
      'el Payment Link recién creado se DESACTIVA: un enlace vivo sin fila detrás es dinero ' +
      'que puede entrar sin saber por qué, y en Stripe no caducan solos.',
  },
  canary_opciones_duplicadas: {
    titulo: 'Trinquete: ninguna pregunta activa puede repetir una opción',
    ruta: 'scripts/canary-opciones-duplicadas.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      '`npm run canary:opciones-duplicadas` (solo lectura; exit 2 si el número sube). Techo ' +
      'declarado CERO en las dos bandas: `error` = la clave está dentro del par (se acierta y se ' +
      'falla a la vez) y `warn` = dos distractores clonados. **Por qué un canario y no un guard ' +
      'en el punto de escritura, que es la regla de la casa:** `questions.option_*` lo escriben ' +
      '28 scripts de importación distintos sin un camino común — el caso que `toolWriters` ' +
      'contempla para los recursos con decenas de escritores legítimos. El camino de GENERACIÓN ' +
      'sí está cubierto aguas arriba (`verificar-batch-generado.cjs` exige las cuatro opciones ' +
      'distintas y aborta el lote); el goteo medido venía del IMPORTADOR, y esa puerta no ' +
      'existe. **El techo es 0 porque las 33 medidas el 31/07 se repararon ese mismo día**: con ' +
      'el banco limpio, cualquier aparición es una regresión demostrable, que es justo lo que un ' +
      'techo heredado no permite distinguir. Comparte núcleo con el detector del barrido ' +
      '(`lib/health/opcionesDuplicadas.cjs`, kind `opciones_duplicadas`), así que canario y badge ' +
      'no pueden divergir de criterio. Medido al estrenarlo: 0 y 0 sobre 138.115 activas.',
  },
  canary_identidad_pago: {
    titulo: 'Comprobar tras cada deploy que la caja no se cierra por un id desincronizado (y que cancelar sigue cortando)',
    ruta: 'backend/src/canary-identidad-pago/canary-identidad-pago.service.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/health-check.md',
    notas:
      'POST /api/v2/canary/run-identidad-pago (CRON_SECRET). Lo dispara el workflow ' +
      '`frontend-deploy` — el deploy es el único momento en que esa política cambia—, no un ' +
      'cron. Prueba **las dos mitades juntas**: que `create-checkout` NO corta con un userId ' +
      'ajeno y que `cancel` SÍ corta; por separado no prueban nada (una pasa con todo abierto ' +
      'y la otra con todo cerrado). Nace del 31/07: 17 intentos de compra bloqueados con 403 ' +
      'y ninguna alerta. **La sonda destructiva no puede hacer daño**: antes comprueba en vivo ' +
      'que su sujeto no tiene suscripción, y si la tuviera se omite y lo dice ' +
      '(`cancelAssertion`) en vez de arriesgarse o inventarse un verde. Integrado sin silos: ' +
      "`endpoint='canary-identidad-pago'` entra en el uptime de `/admin/salud-sistema` (que " +
      "agrega por `canary-%`), la regla `canary_identidad_pago_failed` manda el correo, y el " +
      'tipo está en `CON_REGLA_PROPIA` para que el catch-all no duplique el aviso.',
  },
  sim_precio_heredado: {
    titulo: 'Comprobar contra datos reales que el botón «recupera tu precio» cobra lo que debe y una sola vez',
    ruta: 'scripts/sim/sim-precio-heredado.ts',
    estado: 'vivo',
    notas:
      'npx tsx scripts/sim/sim-precio-heredado.ts [--url=…], con AUTH_SECRET y DATABASE_URL del ' +
      'entorno y el servidor levantado. 7 comprobaciones contra Stripe y BD REALES: sin sesión ' +
      'no se crea nada, la afectada recupera su tarifa, el importe es del catálogo del vaciado, ' +
      'el segundo clic no crea una segunda oferta, la fila queda en la cuenta que hoy cobra, y ' +
      '«reactivar» en la cuenta antigua se rechaza. **ESCRIBE en Stripe** (price + Payment Link) ' +
      'y en `user_price_offers`, y por eso limpia al terminar: revoca la fila y desactiva los ' +
      'enlaces que ha creado. El caso 6 es el que sostiene a los demás: quien ya está en la ' +
      'cuenta nueva NO debe recibir oferta — sin ese contraste, un endpoint que no creara ' +
      'ofertas nunca pasaría por bueno. Correrla tras tocar `ofertaHeredada`, `precioHeredado` ' +
      'o `reactivateSubscription`.',
  },
  sintaxis_staged_check: {
    titulo: 'Impedir que un fichero que no parsea llegue a `main` y bloquee el deploy de todos',
    ruta: 'scripts/check-sintaxis-staged.cjs',
    estado: 'vivo',
    notas:
      'Hook `.husky/pre-commit`, lo PRIMERO que corre (milisegundos). Pasa `node --check` por ' +
      'los `.cjs`/`.mjs`/`.js` staged. No opina de estilo: el lint sigue viviendo solo en CI ' +
      'por los 247 warnings heredados. Existe porque el mismo modo de fallo ha pasado 3 veces ' +
      '(backticks de markdown dentro de un template literal, que cierran la plantilla): el CI ' +
      'lo caza, pero YA en `main`, y hasta que alguien lo note ninguna sesión puede desplegar. ' +
      'Estrenándolo encontró `scripts/temario/detect-temario-revision.cjs` roto en `main`. ' +
      'Núcleo puro `lib/calidad/sintaxisStaged.cjs` (12 tests). **Un fallo en un fichero con ' +
      'pinta de JSX avisa y NO bloquea**: `node --check` no entiende JSX, y un bloqueo ' +
      'injusto enseña a usar `--no-verify`, que apaga además el db:check y el display-drift. ' +
      'Escape propio: `SINTAXIS_CHECK_SKIP=1`.',
  },
  robustez_push_guard: {
    titulo: 'Bloquear el push de código de producción que va sin capas, y de señales que nadie vigila',
    ruta: 'scripts/robustez-push-guard.cjs',
    estado: 'vivo',
    notas:
      'Hook `.husky/pre-push`, entre el guard del backlog y el typecheck. Dos preguntas, las ' +
      'dos contestables con el diff: (1) ¿toca producción sin UNA sola capa (test, spec, sim, ' +
      'canary, guardarraíl)?; (2) ¿estrena un `eventType` que no aparece en alert-rules ni en ' +
      'los catálogos de señales? No juzga si los tests son buenos —un hook no puede saberlo—, ' +
      'solo si los hay. Núcleo puro `lib/calidad/robustezPushGuard.cjs` (14 tests). Fail-open ' +
      'y con escape `ROBUSTEZ_GUARD_SKIP=1`, que se imprime: un gate que no se puede saltar en ' +
      'un hotfix acaba desactivado entero. **GOTCHA que costó una prueba negativa:** el rango ' +
      'es `origin/main...HEAD` con TRES puntos; con dos se colaban los ficheros de otras ' +
      'sesiones y, como casi siempre traen algún test, dejaba pasar cualquier cosa.',
  },
  perfil_sin_resolver: {
    titulo: 'Medir si las sesiones sin perfil se están curando solas (y si hay dinero en juego)',
    ruta: 'scripts/canary-perfil-sin-resolver.cjs',
    estado: 'vivo',
    notas:
      '`npm run canary:perfil-sin-resolver [-- --horas N]`. Solo LEE. Nace de T-434: un usuario ' +
      'cuyo `user_profiles.id` no se resolvió navega con la sesión firmada y **para la BD no ' +
      'existe** — sus estadísticas fallan, el checkout le responde «User not found in database» ' +
      'y el formulario de soporte también, así que NI PUEDE AVISARNOS. Medido el 01/08/2026: 235 ' +
      'personas, la más antigua desde el 7 de julio, y 85 intentos de compra rechazados en 7 días ' +
      'de 12 personas. **No se puede consultar «sesiones sin perfil»** (la sesión vive en una ' +
      'cookie, no en la BD): se cuenta el REBOTE (`auth`/`warn` «Usuario no existe») por usuarios ' +
      'DISTINTOS, no por eventos —uno navegando mucho taparía si el grupo crece—, y se CRUZA con ' +
      '`auth_perfil_recuperado`. El cruce es lo que aporta: rotos≈constantes CON curaciones = ' +
      'siguen naciendo rotos al ritmo que se curan, un goteo que cualquier gráfica de «rotos» a ' +
      'secas leería como éxito. Y rotos>0 con CERO curaciones = el reintento no está corriendo. ' +
      'Simulación hermana: `npm run sim:reintento-perfil` (7 casos contra la BD real, con ' +
      'usuarios efímeros que se borran solos). **Segundo bloque (01/08): «clientes que CREEN ' +
      'estar dentro»**, ventana propia de 14 días, porque la persistencia no se puede medir en ' +
      '24 h: quien perdió la sesión y cuyo cliente NO se enteró sigue navegando y respondiendo ' +
      'sin que se le guarde nada durante DÍAS, y en una ventana corta es idéntico a una ' +
      'caducidad normal. La señal es la PERSISTENCIA, no el volumen (los de un solo día ' +
      'acumulan 1-4 rebotes, igual que un roto). Corte calibrado sobre 483 usuarios/14d: 391 ' +
      '(81%) rebotan un solo día → caducidad, se descartan; 46 en 3+ días → rotos, el peor 13 ' +
      'días seguidos. Criterio en el núcleo puro `lib/auth/rebotePersistente.cjs` (13 tests), no ' +
      'en la consulta. **TERCER bloque (05/08) y es LA CAUSA de los persistentes: navegadores ' +
      'con DOS identidades.** Al medir los 182 se cayó la explicación anterior («no llegan a ' +
      'tener sesión Auth.js»): **180 de 182 tenían identidad VERIFICADA**, 0 tenían fila en ' +
      '`user_profiles` con el id que rebotaba y 0 estaban en `deleted_users_log`. O sea, gente ' +
      'SANA cuyo navegador arrastra el id de la sesión Supabase legacy de `localStorage` y lo ' +
      'manda por `?userId=` (1.920 de los 401 de user-stats no traían identidad de token). Se ' +
      'cruzan las dos caras del MISMO hecho: `identityMismatch` (SERVIDOR, existía desde el ' +
      '07/07 y **no la miraba nadie** — no hubo que construir detector, hubo que mirarla) y ' +
      '`auth_identidad_ajena_descartada` (CLIENTE, el drenaje). Mismatch>0 con CERO descartes = ' +
      'el arreglo no corre → compruébalo con `npm run sim:sesion-fantasma`, no lo supongas.',
  },
  sesion_fantasma: {
    titulo: 'Comprobar en un navegador real que se suelta la identidad ajena sin desloguear al sano',
    ruta: 'scripts/sim/sim-sesion-fantasma.ts',
    estado: 'vivo',
    notas:
      '`npm run sim:sesion-fantasma [-- --url=https://www.vence.es]`, con `AUTH_SECRET` y ' +
      '`DATABASE_URL` del entorno. Navegador real (Playwright); NO escribe nada y las cookies ' +
      'forjadas van marcadas como simulación para no envenenar el canario hermano ' +
      '(`canary:perfil-sin-resolver`). Cubre lo que ningún test puede: el bucle vive en el ' +
      'CABLEADO —`localStorage` de verdad, `INITIAL_SESSION` de verdad, React montándose de ' +
      'verdad—, no en la decisión, que ya tiene 16 unitarios. **Cada caso lleva su contraste** ' +
      'porque este cambio falla hacia los dos lados y solo uno se nota: soltar de menos deja a ' +
      'la persona encerrada (silencioso), soltar de más desloguea a premium sanos (caro). ' +
      '**DOS GOTCHAS que la hacían inútil y están fijados por guardarraíl:** (1) el blob del ' +
      'fixture DEBE llevar `access_token` y `expires_at` vigente — sin eso supabase-js lo borra ' +
      'antes de que React monte (medido: desaparecía a los 3 s, el AuthProvider arrancaba a los ' +
      '4,3 s) y el caso salía VERDE sin haber probado nada; (2) se mide a los 10 s, **después** ' +
      'del veredicto de `INITIAL_SESSION` (~3,5-6 s) y **antes** del rescate tardío de 15 s del ' +
      'camino antiguo, que si no también saldría verde y no distinguiría el arreglo. El caso ' +
      '«sin sesión» sale como ⏳ PENDIENTE y no cuenta para el veredicto: su arreglo existe ' +
      '(`decidirSesionFantasma`) pero cablearlo desloguea y esa decisión no está tomada.',
  },
  rutas_oposicion_personalizada: {
    titulo: 'Recorrer una oposición personalizada COMO UN USUARIO y encontrar lo que está roto',
    ruta: 'scripts/sim/sim-rutas-oposicion-personalizada.ts',
    estado: 'vivo',
    notas:
      '`npm run sim:rutas-oposicion-personalizada [-- --free] [-- --vacia]`. Crea una oposición efímera con su ' +
      'temario, la fija como objetivo y hace el recorrido entero: mira a dónde te manda el ' +
      '**Header**, **DESCUBRE** las rutas siguiendo cada enlace desde el hub (no las declara), ' +
      'entra en el tema y pulsa el botón de empezar. Se limpia sola; necesita `AUTH_SECRET`. ' +
      '**NACE DE QUE COMPROBAR PANTALLA POR PANTALLA NO ESCALA:** una lista de casos escrita a ' +
      'mano solo cubre lo que uno se acordó de mirar, y lo que falta es por definición lo que no ' +
      'pensó. Encontró cuatro agujeros que ninguna prueba veía: el botón de EMPEZAR el test ' +
      'llevaba a una ruta inexistente (se podía armar el temario y no llegar a estudiar), el ' +
      'icono 📚 daba 404, los enlaces internos del temario seguían rotos tras arreglar el ' +
      'temario, y el menú «Test» mandaba a OTRA oposición. **NO se fía del código HTTP**: estas ' +
      'páginas son cascarones que devuelven 200 y luego pintan el error, así que mira el TEXTO ' +
      'renderizado. ⚠️ **LÍMITE CONOCIDO (01/08/2026):** el test EN SÍ queda **no concluyente** — ' +
      'con cuenta real carga y se responde (comprobado a mano) pero con la cuenta efímera la ' +
      'pantalla sale vacía; descartado el plan (premium y free), el onboarding y las cookies. Se ' +
      'marca así a propósito: un rojo que no distingue «roto» de «mi cuenta no lo representa» se ' +
      'acaba ignorando, y forzarlo a verde sería mentir. **Tres lecciones de método** comentadas ' +
      'en el fichero, útiles para cualquier simulación de navegador: la cuenta de prueba tiene ' +
      'que parecerse al usuario (sin onboarding, el modal tapa la pantalla), no construir la URL ' +
      'a mano (el usuario llega pulsando un botón que pone otros parámetros), y una aserción ' +
      'equivocada gasta la confianza igual que un fallo de código. 🆕 **`--vacia` (T-508): recorre ' +
      'una oposición que EXISTE pero no tiene ni un tema**, que era el punto ciego de esta ' +
      'simulación — creando siempre una oposición CON temario recorría el camino feliz y daba ' +
      'verde mientras el caso MAYORITARIO estaba roto (03/08/2026: de 585 `custom_oposiciones` ' +
      'activas, **580 sin un solo tema**, etiquetas del onboarding viejo). Ahí el icono 📚 daba ' +
      '404 y una usuaria premium lo reportó. En ese modo no se exige el test (sin temas no hay ' +
      'botón que pulsar: un rojo imposible de poner verde se deja de leer) sino que **ninguna ' +
      'ruta MIENTA**, más la comprobación positiva de que la pantalla EXPLICA que faltan temas. ' +
      'Hermanas: ' +
      '`sim:tests-oposicion-personalizada` y `sim:oposicion-personalizada`.',
  },
  tests_oposicion_personalizada: {
    titulo: 'Comprobar EN UN NAVEGADOR que se puede estudiar con tu propio temario',
    ruta: 'scripts/sim/sim-tests-oposicion-personalizada.ts',
    estado: 'vivo',
    notas:
      '`npm run sim:tests-oposicion-personalizada [-- --url=…]`. Crea una oposición efímera con ' +
      'una ley que SÍ tiene preguntas (si cogiera una cualquiera, el tema saldría a cero y la ' +
      'simulación daría verde sin probar nada) y se limpia sola. Necesita `AUTH_SECRET`. ' +
      '**NACE DE UN FALLO DE MEDICIÓN, no de código:** el 01/08/2026 se comprobó la ruta con ' +
      '`curl`, devolvió **HTTP 200** y se dio por buena una pantalla que en el navegador decía ' +
      '**«404 · Tema No Encontrado»** (lo vio Manuel). Estas páginas son cascarones que cargan ' +
      'sus datos por API tras montar: **el 200 lo devuelve el cascarón** y el fallo ocurre ' +
      'después, así que medir el código HTTP es medir lo único que no puede fallar. Y no era un ' +
      'fallo sino TRES puertas encadenadas, cada una invisible desde la anterior: la validación ' +
      'de slug del endpoint, el enum de Zod y el `isValidTema` del componente — las tres contra ' +
      'el catálogo estático, donde una personalizada no está ni puede estar. Hermana: ' +
      '`npm run sim:oposicion-personalizada` (guardar/editar contra BD, sin navegador).',
  },
  oposicion_personalizada: {
    titulo: 'Comprobar que un temario propio se guarda entero y con la forma que espera topic_scope',
    ruta: 'scripts/sim/sim-oposicion-personalizada.ts',
    estado: 'vivo',
    notas:
      '`npm run sim:oposicion-personalizada`. Escribe, pero con usuario EFÍMERO que se borra solo ' +
      '(oposición, temas y scope incluidos), así que es seguro. Nace de T-327: el creador de ' +
      'oposición personalizada convierte lo que arma el usuario en `custom_oposiciones` + `topics` ' +
      '+ `topic_scope`, y **los tres fallos posibles son SILENCIOSOS** — Postgres acepta un scope ' +
      'inflado por repetidos, un tema vacío y un `article_numbers` a `{}` sin rechistar; el usuario ' +
      'no ve un error, ve un temario distinto del que construyó. Comprueba: repetidos que no ' +
      'inflan, temas vacíos descartados y renumerados, **«toda la ley» llegando como NULL y no ' +
      'como `{}`** (que es «ninguno», el opuesto exacto), que no exista el estado «etiqueta sin ' +
      'temario» y que el nombre repetido choque con 23505. **Ya justificó su existencia el ' +
      '01/08/2026**: cazó que `topics.descripcion_corta` es NOT NULL en la BD aunque `db/schema.ts` ' +
      'la declare opcional — un invariante que solo vive en Postgres y que ningún unitario podía ' +
      'ver; sin esto, el guardado habría reventado en el primer clic de producción. Núcleo puro ' +
      'con 15 tests en `lib/api/oposicionPersonalizada/plan.ts`.',
  },
  perfil_roto_se_cura: {
    titulo: 'Comprobar en un NAVEGADOR real que un usuario roto se cura solo al cargar página',
    ruta: 'scripts/sim/sim-perfil-roto-se-cura.ts',
    estado: 'vivo',
    notas:
      '`npm run sim:perfil-roto-se-cura [-- --url=https://www.vence.es]`. Solo LEE (usa un ' +
      'usuario que ya existe, así que la reparación esperada es encontrar su perfil, no crear ' +
      'uno) → es seguro contra producción, que es donde hay que comprobarlo. Necesita ' +
      '`AUTH_SECRET` (SSM `/vence-frontend/AUTH_SECRET`). **La capa que faltaba en T-434:** el ' +
      'núcleo puro y el resolutor SE EJECUTAN en sus pruebas, pero el cableado dentro del ' +
      'callback `jwt` solo lo miraban guardarraíles que leen el fichero como TEXTO — eso ' +
      'demuestra que el código está escrito, no que funcione. Y no hay otra forma: a ese ' +
      'callback lo invoca `@auth/core` por dentro en cada rotación de sesión, así que hay que ' +
      'hacer que la aplicación lo llame. Forja la cookie de sesión con el MISMO mecanismo que ' +
      '`sim-impersonacion.ts` (`lib/sim/session.ts`), sin abrir otra puerta: así se fabrica el ' +
      'estado exacto de los 235 rotos —cookie válida, con email y SIN `appUserId`— que es justo ' +
      'lo que no se le puede pedir a Google que produzca. **Probado por mutación el 01/08/2026:** ' +
      'apagando el reintento, `session.user.id` sale `null` (el estado roto reproducido) y el ' +
      'caso 1 se pone rojo. Contra un despliegue sin T-434 el caso 1 falla POR DISEÑO: es la ' +
      'línea base, no un defecto.',
  },
  contexto_push_guard: {
    titulo: 'Bloquear el push que borra el contexto de una ficha viva del backlog',
    ruta: 'scripts/contexto-push-guard.cjs',
    estado: 'vivo',
    notas:
      'Hook `.husky/pre-push`, justo tras el guard de claims. Caza el modo de fallo del 31/07: ' +
      '`docs/roadmap/tareas-pendientes.md` es el fichero que TODAS las sesiones tocan y las fichas ' +
      'nuevas se insertan en el mismo sitio, así que el conflicto es lo normal (cuatro veces en una ' +
      'tarde) — y resolverlo quedándose con «su» lado borra el trabajo de documentar de la otra. ' +
      '**Nada lo veía:** `backlogRegistry.guardrail` mira ids únicos (un id sigue siendo único con ' +
      'el cuerpo borrado), `sync` reconcilia título y prioridad, y el push-guard mira claims → la ' +
      'ficha podía quedarse en una línea con el CI en verde. **Compara contra `origin/main`, NO ' +
      'contra el padre de tus commits**, porque el caso del MERGE es invisible desde el padre: si ' +
      'resuelves tirando el bloque ajeno, tus commits nunca borraron nada respecto de su propio ' +
      'padre. Si HEAD no contiene `origin/main` NO opina (no puede atribuir la pérdida). Núcleo ' +
      'puro `lib/backlog/perdidaDeContexto.cjs` (29 tests) + simulación de extremo a extremo con ' +
      'repo de usar y tirar `scripts/backlog/sim-contexto-guard.cjs` (8 casos, incluido el merge). ' +
      'Calibrado sobre los 1.063 commits del fichero con `scripts/backlog/sim-perdida-contexto.cjs`: ' +
      'dispara en el 0,9% de los commits y en el 91% de las fichas que señala alguien tuvo que ' +
      'restaurarlas a mano. Umbral: pierde ≥600 caracteres Y ≥50% del cuerpo; cerrar con ✅ exime ' +
      '(pero se reporta, para que un borrado no se disfrace de cierre). Fail-open; escape PROPIO ' +
      '`CONTEXTO_GUARD_SKIP=1` — compartirlo con otro guard apagaría dos de una vez. Mide su ' +
      'fricción (bloqueo y escape) vía `friccion-emitir.cjs`, T-423. **NO es el detector de fichas '+
      'huérfanas** (`lib/backlog/fichaHuerfana.cjs`, dentro de `backlog.cjs sync`): aquél parte de la BD '+
      '(fila viva sin ficha), informa y no bloquea; éste parte del markdown, bloquea en el pre-push, y ve '+
      'además la ficha VACIADA —que para el otro está sana, porque su id sigue existiendo—. Se solapan '+
      'solo en «desaparecida»: red detrás de puerta, no dos puertas con criterios distintos.',
  },
  purgar_feedback_espurio: {
    titulo: 'Borrar del historial de una persona los apuntes que escribió otro (con respaldo y rastro)',
    ruta: 'scripts/purgar-feedback-espurio.cjs',
    estado: 'vivo',
    notas:
      'node scripts/purgar-feedback-espurio.cjs [--apply] — DRY-RUN por defecto. Nace de ' +
      'T-340: un clic en «Reactivar» durante una suplantación de solo lectura dejó 3 apuntes ' +
      'en el historial VISIBLE de una usuaria que ella no escribió. **El criterio vive en el ' +
      'fichero (persona + ventana + motivos), no en la línea de comandos**: un criterio por ' +
      'argumento invita a borrar de más. Antes de tocar nada imprime lo que borra Y lo que ' +
      'conserva —sin ese contraste, un criterio demasiado ancho se lee igual que uno bueno—, ' +
      'y guarda las filas completas en `observable_events` (`dato_espurio_purgado`) en la ' +
      'MISMA transacción, así que si el respaldo falla no se borra. Reconstruir una fila = ' +
      'leer su evento de purga; por eso el respaldo va a la BD y no a un fichero suelto. ' +
      'Corrido el 31/07 sobre daluamva (3 filas; su baja real de febrero intacta).',
  },
  // ── observabilidad de cliente ─────────────────────────────────────────────────────────────
  sim_ruido_console: {
    titulo: 'Medir qué parte de los console_error de cliente es ruido y qué parte es daño (y predecir el efecto del arreglo)',
    ruta: 'scripts/observabilidad/sim-ruido-console.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/observability.md',
    notas:
      'node scripts/observabilidad/sim-ruido-console.cjs [--dias N]. Solo lectura. Separa los ' +
      '`console_error` en tres cubos con la MISMA regla que aplica el logger ' +
      '(lib/observability/consoleNoise.ts): ya-ruido (GSI/FedCM/401), CANDIDATOS (mensaje de red, ' +
      'que solo bajan a debug si la página se estaba yendo) y errores de APLICACIÓN, que la regla ' +
      'no toca nunca. De ahí sale una PREDICCIÓN falsable con la que juzgar el despliegue. Medido ' +
      'el 28/07/2026 sobre 3 días: 14.320 eventos → 32,2% ya-ruido · 52,9% candidatos · 14,9% ' +
      'aplicación, así que los errores deben caer a entre 2.127 y 9.704. **Si se quedan cerca de la ' +
      'cota ALTA, es que ocurren con la pestaña VISIBLE y hay daño real, no ruido.** Correrlo ANTES ' +
      'y DESPUÉS del deploy es la verificación: sin él, "el ruido bajó" no se distingue de "se ' +
      'silenció señal".',
  },
  sim_desperdicio_mints: {
    titulo: 'Medir cuántas veces se re-acuña el access token frente a las que hace falta (desperdicio de /api/auth/token)',
    ruta: 'scripts/observabilidad/sim-desperdicio-mints.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/observability.md',
    notas:
      'node scripts/observabilidad/sim-desperdicio-mints.cjs [--dias N]. Solo lectura. El RS256 dura ' +
      '1 h, así que el suelo es ~1 acuñación por usuario y HORA ACTIVA; el script compara ese suelo ' +
      'con las acuñaciones reales (`auth_token_minted`, ×10 por el muestreo del 10% en ' +
      'via=authjs_session; el `bridge` va sin muestrear y se cuenta aparte). Medido el 28/07/2026: ' +
      '**58.800 reales frente a 1.999 de suelo = 29,4× de desperdicio** (45 por usuario y hora, ' +
      'mediana de 7 días, rango 29-136). Causa: 9 copias del patrón «refreshSession() y si no ' +
      'getSession()» que FORZABAN la re-acuñación saltándose la caché del adapter (T-210); ' +
      'convergieron en `auth.getAccessToken()`. Correrlo ANTES y DESPUÉS del deploy: la predicción ' +
      'era −96,6%. ⚠️ **Desplegado el 28/07 a las 11:17 UTC: salió −39% (96,7 → 58,8 por usuario y ' +
      'hora contra la misma franja del día anterior), no −96,6% — y el error es de la PREDICCIÓN: el ' +
      'suelo de "1 por usuario-hora" salía del TTL del token, pero la caché del adapter vive en ' +
      'MEMORIA y muere en cada carga de página y cada pestaña, así que el suelo real es "≈1 por carga ' +
      'de página". Al re-usar este script, derivar el suelo del ciclo de vida de la caché, no del TTL.** ' +
      '**Ojo con el falso alivio:** quedar MUY por debajo del suelo no es eficiencia, es ' +
      'que hay usuarios activos sin token (401 silenciosos) — el script lo avisa. La misma señal en ' +
      'vivo y sin intervención es la alerta `auth_token_mint_waste` (>8 reales/usuario/hora); su ' +
      'silencio tras desplegar es la verificación continua. El guardarraíl estático que impide ' +
      'reintroducir el patrón es `__tests__/guardrails/bearerTokenSinglePath.test.ts`.',
  },
  sim_captura_atribucion: {
    titulo: 'Simular el efecto de ampliar la captura de atribución antes de encenderla (canales, volumen y ruido)',
    ruta: 'scripts/atribucion/sim-captura-ampliada.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/observability.md',
    notas:
      'npx tsx scripts/atribucion/sim-captura-ampliada.ts [--dias N]. Solo lectura. Usa los MÓDULOS ' +
      'REALES (lib/attribution/deriveChannel + touchPolicy), no una copia: si la lógica cambia, la ' +
      'simulación cambia con ella. Nació de T-243, donde el toque solo se emitía con UTM/click-id → ' +
      'el 86% de las altas quedaba como `direct` y `organic` salía 1 vez en 12 días. Comprueba tres ' +
      'cosas: (1) reclasifica los toques YA guardados y avisa si algún dominio PROPIO o de infra se ' +
      'cuela como `referral`; (2) acota el volumen de escritura nuevo; (3) enseña la política sobre ' +
      'referrers reales. **Ya pagó el día que se escribió:** destapó que ' +
      '`android-app://com.google.android.gm/` (Gmail) se clasificaba como `organic` por contener ' +
      '`.google.` — 121 casos en 7 días; un clic desde el correo NO es SEO. Correrlo ANTES de tocar ' +
      '`deriveChannel` o la política de toques.',
  },
  auditar_normas_del_epigrafe: {
    titulo: 'Normas que el PROGRAMA nombra y que su oposición no sirve (bajo demanda, NO va al badge)',
    ruta: 'scripts/scope/audit-normas-del-epigrafe.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'Caso que lo motiva: el Tema 1 de Guardia Civil enumeraba 14 normas y escopaba 2; las otras ' +
      '(DUDH, CEDH, PIDESC, PIDCP, Carta DDFF UE, tortura) existían con 859 preguntas activas y se ' +
      'servían solo a Policía Nacional. Al engancharlas, el tema pasó de 229 a 1.146 preguntas. ' +
      '**NO está en `/admin/contenido` a propósito, y la decisión está medida** (30/07): 891 hallazgos ' +
      'con el criterio inicial → 226 exigiendo 3 palabras significativas y que lo ignore la oposición ' +
      'entera → 150 excluyendo familias ya servidas; pero al muestrear los mayores, la mayoría eran ' +
      'FALSOS POSITIVOS por dos causas que un matcher léxico no resuelve: contenedores equivalentes con ' +
      'otro nombre (`LPRL` ≡ `LEY PREVENCIÓN DE RIESGOS LABORALES ENF`, `Excel 2019` ≡ `Excel 365`) y ' +
      'epígrafes con un ANEXO del boletín pegado. Un badge así entrena a ignorar la categoría entera. ' +
      'Se corre a mano, lo adjudica una persona contra el programa oficial, y para enganchar lo ' +
      'confirmado se usa `escopar_ley_entera`. Núcleo puro `lib/health/normaDelEpigrafeSinEscopar.cjs` ' +
      '(12 tests, con los falsos positivos medidos fijados como casos negativos).',
  },
  revisar_oposicion_temario: {
    titulo: '¿Se puede responder ya a una queja de temario? (Regla previa OBLIGATORIA, con veredicto)',
    ruta: 'scripts/temario/revisar-oposicion.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      '`npm run epigrafe:revision -- <position_type> [--pregunta <question_id>]`. Corre la Regla previa ' +
      '§2 del runbook y sale con 0/1/2 (verde / hay bloqueos / no se pudo comprobar). Con `--pregunta` ' +
      'acota el veredicto a **los temas que sirven esa pregunta**, que es lo que hace la puerta ' +
      'cumplible: se exige poner en orden uno o dos temas, no los veintiuno. Núcleo puro ' +
      '`lib/temario/revisionEpigrafe.cjs` (14 tests) + `npm run sim:puerta-temario` contra RDS. ' +
      'Lo EXIGE `cerrar.ts` antes de mandar el email (escape `--temario-igualmente "<motivo>"`). ' +
      'Caza dos cosas que el 🛑 del dossier no veía: el epígrafe sin clonar del tema concreto y el ' +
      '`verified_correct` que **no vino del pipeline** — el 04/08/2026 había 711 temas en 45 ' +
      'oposiciones sellados por `claude_direct` con `agent_run_id=\'--run\'`, 550 de ellos sin Paso 1.',
  },
  escopar_ley_entera: {
    titulo: 'Enganchar una ley COMPLETA al temario de un tema (rescatar preguntas que ningún tema sirve)',
    ruta: 'scripts/scope/escopar-ley-entera.cjs',
    estado: 'vivo',
    escribe: ['topic_scope'],
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      '`--pt <position_type> --tema <N> --ley "<short_name>" [--motivo "…"] [--apply]`. Dry-run por ' +
      'defecto. Para el caso de [T-055]: un contenedor con preguntas activas que **ningún tema sirve** ' +
      'y un epígrafe que lo pide por su nombre — recuperarlas es re-escopar, no generar. **Se NIEGA si ' +
      'el epígrafe no nombra la ley**; para cuando la pide con otras palabras hay `--motivo`, que queda ' +
      'escrito en el evento `topic_scope_ley_entera_anadida` (obligar a explicarlo es la guarda, no el ' +
      'flag). Idempotente. Expresa «toda la ley» por AUSENCIA de `article_numbers` — así no añade un ' +
      'escritor más a esa columna, que tiene trinquete por ser el temario servido. Existe porque el repo ' +
      'acumulaba una docena de `scripts/_xxx.cjs` de un solo uso haciendo este INSERT sin ninguna guarda. ' +
      '**Dos cosas que hay que comprobar A MANO antes** (ninguna la puede deducir el script): que la ' +
      'oposición no esté cerrada por `questionTag` en `lib/config/oposiciones.ts` (si lo está, escopar no ' +
      'basta: hay que etiquetar las preguntas) y que no exista ya un contenedor GEMELO escopado, porque ' +
      'entonces esto duplica en vez de rescatar. Verificar SIEMPRE con `GET /api/questions/filtered?' +
      'action=count&topicNumber=N&positionType=…` (cachea 60 s): el HTML se renderiza en cliente y es ' +
      'idéntico para un tema lleno y uno vacío.',
  },
  latido_sesiones_worktree: {
    titulo: '¿Qué sesión de trabajo (worktree) está viva? — señal con hora, para saber qué se puede borrar',
    ruta: 'scripts/sessions/latir.cjs',
    estado: 'vivo',
    escribe: ['worktree_sessions'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      'Escritor ÚNICO de `worktree_sessions`. Se invoca solo: `backlog.cjs` late en CADA comando ' +
      '(subproceso detached, no puede añadir latencia ni fallar) y el hook `pre-push` también — eso ' +
      'segundo cubre a la sesión que solo lee código y commitea, que antes no dejaba rastro ninguno. ' +
      '`--cerrar <slug>` quita las filas al borrar el worktree, para que el listado no acumule ' +
      'directorios que ya no existen. Para LEER: `node scripts/sessions/latidos.cjs` (informe + ' +
      'candidatas a cerrar), `--tsv` (lo consume `listar-worktrees.sh`) y `--slug <slug>`, cuyo EXIT ' +
      'CODE 3 usa `borrar-worktree.sh` para NEGARSE a borrar una sesión en uso. Bandas y trampa de ' +
      'los nombres casi idénticos en el núcleo puro `lib/sessions/latido.js` (24 tests). **Lo que NO ' +
      'sirve como señal, ya probado (T-296): la fecha del directorio** (una sesión viva pasa horas sin ' +
      'tocar su worktree), **el `cwd` de las transcripciones** (dice siempre el repo principal) y la ' +
      'rama o el `.session-id` (existen desde que se creó). NUNCA borrar un worktree sin mirar además ' +
      '`git status` y `git log origin/main..`: la señal dice que nadie lo usa, no que no haya trabajo dentro.',
  },
  parte_de_sesiones: {
    titulo: 'El PARTE: qué hace cada sesión, quién está parado y qué espera decisión — en una pantalla',
    ruta: 'scripts/sessions/parte.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      '`npm run parte` (exit 3 si hay algo parado; `--json` para encadenar). **Solo LEE**: no ' +
      'reparte ni manda, porque el claim ya reparte y es atómico. **Sin LLM**: los hechos son ' +
      'deterministas. Contesta la pregunta que no vivía en ninguna tabla —«¿quién está PARADO?»— ' +
      'cruzando `backlog_tasks` con `worktree_sessions`: `list` pintaba la tarea cogida y ' +
      '`latidos` la sesión dormida, y nadie ataba los cabos. Distingue TRES motivos que no son el ' +
      'mismo (parada · lease_vencido · desaparecida, esta última cuando la sesión NUNCA latió: se ' +
      'dice, no se supone). Núcleo puro `lib/sessions/parte.cjs` (14 tests). NUNCA hacer que diga ' +
      'verde cuando no ha podido mirar: sin señales el veredicto es ⚪, no 🟢.',
  },
  colocar_ficha_backlog: {
    titulo: 'Colocar una ficha nueva del backlog en su sitio (a mano se coloca mal)',
    ruta: 'scripts/backlog.cjs',
    estado: 'vivo',
    escribe: ['docs/roadmap/tareas-pendientes.md'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      '`ficha <id> [--texto <fichero.md>]` (o por stdin) · `reubicar [--apply]` para devolver a su ' +
      'sección las que ya quedaron fuera. Lo cita `reserve` en lugar del ' +
      '«escríbela a mano» de antes. **Nace de que a mano NO sale bien:** el fichero pasa de ' +
      '11.000 líneas y la frase `## Abiertas` aparece DENTRO del texto de varias fichas (las que ' +
      'hablan de este problema), antes que el encabezado real — así que un `index()`, un `sed` o ' +
      '«pégala arriba» aciertan la MENCIÓN y la ficha aterriza en el preámbulo, fuera de toda ' +
      'sección. Medido al estrenarlo: **58 fichas huérfanas, 27 vivas**, o sea que colocarla mal ' +
      'era el resultado NORMAL, no el desliz. Y el aviso no bastaba: el ancla falsa con la que se ' +
      'tropezó el 04/08 era un bullet de otra sesión documentando esta misma trampa. Localiza el ' +
      'encabezado por **línea exacta**, nunca por búsqueda de texto, y se niega a escribir si el ' +
      'id no está RESERVADO en `backlog_tasks` (la BD es el árbitro; el markdown no admite reserva ' +
      'atómica), si el id ya tiene ficha, si la cabecera dice otro id, si la ficha nace con ✅, o ' +
      'si desaparecería alguna ficha previa. ⚠️ **NO reduce los conflictos de git** —todas las ' +
      'sesiones insertan en el mismo punto— y no pretende hacerlo: eso se resuelve al fusionar ' +
      'conservando LOS DOS lados. Criterio puro en `lib/backlog/insertarFicha.cjs` (11 tests). ' +
      '`reubicar` las manda al FINAL de «## Abiertas» (arriba escriben las sesiones las fichas ' +
      'NUEVAS: meter 27 ahí es chocar con quien esté creando una) y NO toca las cerradas ' +
      'huérfanas — su sitio sería «## Hechas» y hay TRES secciones así, elegir una es adivinar. ' +
      'Trinquete en `backlogRegistry.guardrail`: «ninguna ficha VIVA fuera de sección», nacido en ' +
      'verde tras reubicar las 27. Funciona igual en local y en un trabajador remoto (texto + una ' +
      'consulta a RDS).',
  },
  embudo_preguntas_sesiones: {
    titulo: 'Preguntar a Manuel sin que tenga que entrar en la terminal de cada sesión (el embudo)',
    ruta: 'scripts/backlog.cjs',
    estado: 'vivo',
    escribe: ['session_questions'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      '`preguntar "…" [--contexto] [--tarea] [--bloquea]` · `preguntas` · `responder <id> "…"` · ' +
      '`retirar <id> --motivo`. Escritor ÚNICO de `session_questions`. Antes de T-493 una duda ' +
      'moría en la terminal de la sesión, o se colaba en el `resume_check` de una tarea PAUSADA ' +
      'donde `clasificarEspera` la buscaba con CINCO expresiones regulares — si no se escribía la ' +
      'palabra correcta, desaparecía de la lista. **La respuesta vuelve sola**: el CLI la imprime ' +
      'en cualquier comando (mismo camino que el latido) y marca `seen_at` para avisar UNA vez. ' +
      'Preguntar NO bloquea; si de verdad no se puede avanzar, eso es `pause`. Sin lease a ' +
      'propósito: caducar sería perder la pregunta. Criterio puro en `lib/backlog/preguntas.cjs` ' +
      '(16 tests). NUNCA hacer que caduque ni añadir un segundo sitio donde preguntar.',
  },
  sim_identidad_maquina: {
    titulo: 'Simular que dos MÁQUINAS comparten session-id (comprobación de ejecución, no de texto)',
    ruta: 'scripts/sim/sim-identidad-maquina.cjs',
    estado: 'vivo',
    escribe: ['worktree_sessions'],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`npm run sim:identidad-maquina`. Segundo escritor de `worktree_sessions` además de ' +
      '`latir.cjs`, y **acotado a un sid desechable propio** que borra al terminar (en `finally`): ' +
      'no toca ninguna fila real. Existe porque los unitarios ejercitan los núcleos puros y lo que ' +
      'de verdad se rompe aquí está en el script suelto — al construir T-484, unas comillas ' +
      'invertidas dentro de un comentario SQL cerraron la plantilla de JS y dejaron `latir.cjs` ' +
      'SIN PODER ARRANCAR con las 84 pruebas en verde. Afirma cuatro cosas contra la BD real: el ' +
      'host se escribe, se REFRESCA al cambiar de máquina (antes solo se ponía en el INSERT), el ' +
      'aviso de identidad compartida sale por **stderr** y queda serie temporal en ' +
      '`observable_events` con severidad `warn`. NUNCA ampliarlo para tocar filas que no sean las suyas.',
  },
  clasificar_familia_oposiciones: {
    titulo: 'Clasificar la familia de las oposiciones del catálogo (la que personaliza el banner)',
    ruta: 'scripts/backfill-familia.cjs',
    estado: 'vivo',
    notas:
      '`--dry-run` enseña el diff sin escribir · sin flags re-clasifica TODO · `--only-null` solo las ' +
      'filas sin familia, que es el reconcile tras cada pasada del feed. **NO degrada**: `otros` es el ' +
      'comodín del clasificador, no un veredicto, así que nunca pisa una familia concreta (regla en ' +
      '`lib/oposiciones/familiaBackfill.cjs`, con tests). Medido el 31/07 (T-377): sin esa regla la ' +
      'pasada completa borraba 6 correcciones a mano, y el `--dry-run` no existía — solo podías no ' +
      'correrlo o correrlo a ciegas sobre 2.658 filas. Lo vigila `scripts/canary-familia.cjs` ' +
      '(cobertura de abiertas ≥80% + clasificador↔BD).',
  },
  reevaluar_shuffle_safety_por_criterio: {
    titulo: 'Re-evaluar los veredictos de barajabilidad cuando cambia el CRITERIO (no el contenido)',
    ruta: 'scripts/backfill-shuffle-safety.ts',
    estado: 'vivo',
    escribe: ['shuffle_safety'],
    runbook: 'docs/roadmap/barajar-opciones-verificacion-robusta.md',
    notas:
      '`--recriterio [--apply] [--max N]`. Dry-run por defecto. Es el modo que faltaba: el trigger de ' +
      'invalidación mira el **hash del CONTENIDO**, así que cuando lo que mejora es el detector ' +
      '(`explanationReferencesLetters`) el veredicto viejo se queda escrito para siempre. Medido el ' +
      '30/07 (T-306): el fix de los grados centígrados (T-301) dejó de marcar 106 activas y **ninguna ' +
      'cambió de estado**, y el endurecimiento de las tildes del 28/07 llevaba **21 preguntas** ocho ' +
      'días marcadas `unsafe` por textos como «es la cámara alta» o «son las células óseas». ' +
      '**Acotado por SQL** a `shuffle_safety_verified_by = backfill_deterministic_v3`: no toca lo que ' +
      'firmó `llm_audit_v1` ni `aplicar-explicacion` — esa es la regresión del 22/07 y aquí se impide ' +
      'por consulta, no por disciplina. Escribe por `record_shuffle_safety` (deja fila en ' +
      '`question_shuffle_safety_history`, porque un cambio de criterio tiene que ser auditable) y emite ' +
      '`shuffle_safety_recriterio`. Guardarraíl de VOLUMEN: más de `--max` (2000) cambios aborta — un ' +
      'criterio que mueve miles de filas de golpe es más probablemente un detector roto que una mejora. ' +
      'Idempotente (2ª pasada = 0 cambios). Verificar después con `sweep-shuffle-safety-drift.ts`, que ' +
      'es detector independiente: debe seguir dando 0 regresiones. NUNCA aplicarlo sin leer el dry-run: ' +
      'lista cada cambio con su dirección, y un `safe→unsafe` masivo es una señal, no un trámite.',
  },
  degradar_origen_hito: {
    titulo: 'Degradar el `origen` de un hito de convocatoria cuando su fecha no consta en ninguna fuente',
    ruta: 'scripts/convocatoria/degradar-origen-hito.cjs',
    estado: 'vivo',
    escribe: ['origen'],
    runbook: 'docs/runbooks/rollover-oposiciones.md',
    notas:
      '`--listar [slug]` · `--autocontradictorios [--apply]` · `--hito <uuid> --verificado "…" [--apply]`. ' +
      'Dry-run por defecto. ÚNICA vía para cambiar `convocatoria_hitos.origen`, que NO es documentación: ' +
      '**el render decide con él** (un `registro` se MUESTRA como fecha oficial; una `estimacion` se ' +
      'oculta desde el 20/07). Hasta T-256 no había escritor: el campo se ponía a mano desde scripts de ' +
      'construcción sin exigir fuente, y quedaron **642 de 960 `registro` sin url, sin cita y sin ' +
      'documento**. Caso verificado contra DOS fuentes (Huesca): la landing anunciaba "Primer ejercicio ' +
      '01/11/2026" y ni el Ayuntamiento ni el BOE han publicado fecha. **La contención es lo importante:** ' +
      '«sin respaldo» NO es «inventada» —muchos cierres de plazo derivan de `inscription_deadline`, que sí ' +
      'está verificado—, así que solo degrada solo lo AUTOCONTRADICTORIO (título que dice "previsión" con ' +
      '`origen=registro`) y para todo lo demás exige `--verificado "<qué fuente miraste y qué decía>"`, que ' +
      'queda en la traza. Escribe UN campo, RELEE tras escribir y emite `hito_origen_degradado` en éxito Y ' +
      'en rechazo. Decisión en el núcleo puro `lib/convocatoria/hitoOrigen.js` (19 tests). NUNCA rellenar ' +
      'la cita con una URL genérica para callar el check: convierte un dato dudoso en uno que parece verificado.',
  },
  acreditar_hito: {
    titulo: 'Acreditar la fecha de un hito de convocatoria con la cita literal de su boletín',
    ruta: 'scripts/convocatoria/acreditar-hito.cjs',
    estado: 'vivo',
    escribe: ['url', 'cita_literal', 'source_documento_id'],
    runbook: 'docs/runbooks/rollover-oposiciones.md',
    notas:
      '`--hito <uuid> --url "<url del documento>" --cita "<frase literal>" [--documento <uuid>] [--apply]`. ' +
      'Dry-run por defecto. Es la OTRA mitad de `degradar_origen_hito`: el hallazgo ' +
      '`hito_registro_sin_fuente` se cierra degradando (la fecha no consta) **o acreditando** (sí consta), ' +
      'y hasta T-256 la segunda vía era escribir a mano, sin nada que impidiese pegar la portada del ' +
      'boletín y dar el hito por verificado —justo lo que el runbook prohíbe—. **La contención está en el ' +
      'núcleo puro `lib/convocatoria/hitoAcreditacion.js` (22 tests):** la url debe apuntar a un DOCUMENTO ' +
      '(no a una portada ni a una sección) y **la cita debe NOMBRAR la fecha del hito** — una cita que no ' +
      'dice la fecha no prueba la fecha, y es el error que de verdad pasa desapercibido porque suena bien. ' +
      'Un hito cuyo título se confiesa "previsión" NO se acredita: ahí toca degradar. Escribe dos campos ' +
      '(tres con `--documento`), RELEE tras escribir y emite `hito_acreditado` en éxito Y en rechazo. ' +
      'Estrenado con el examen del Cuerpo Administrativo de la Junta General de Asturias (07/11/2026), que ' +
      'llevaba meses sin fuente y resultó ser CIERTO: lo fija el BOJG serie C núm. 116.',
  },
  // ── temario: epígrafe literal y ley servida ───────────────────────────────────────────────
  verify_epigrafe_apply: {
    titulo: 'Reescribir los epígrafes de un temario al LITERAL del boletín (Paso 1 de verificación)',
    ruta: 'scripts/verify-epigrafe-literality.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'npm run verify:epigrafe -- apply <pt> <plan.json> [--apply]. DRY-RUN por defecto: enseña el ' +
      'diff campo a campo y no escribe. Guarda PURA en lib/temario/epigrafeApply.js (15 tests) con ' +
      'tres invariantes que antes vivían en un markdown y se incumplieron: (1) los CUATRO campos de ' +
      'display se escriben juntos (title, epigrafe, description, descripcion_corta) — el fallo del ' +
      '08/07/2026 en Cantabria fue olvidar `descripcion_corta`, que además quedó desplazada y solo se ' +
      'veía en la página LIVE; (2) el epígrafe propuesto DEBE coincidir con el literal oficial, así ' +
      'que por esta puerta no puede entrar temario inventado —los boletines que no parsean se ' +
      'acreditan con `oficial_manual` + `source_url`, explícito y trazable—; (3) sin drift de ' +
      'versión/app, con la MISMA definición que el detector nocturno (lib/temario/displayDrift.js). ' +
      'Al aplicar: transacción + record_epigrafe_verification a `literal` con su fuente + recache ' +
      'compartida (scripts/lib/temario-recache.cjs). Caso raíz 27/07/2026: los 7 temas de informática ' +
      'de Cantabria tenían la versión CORRECTA pero escrita a ojo, y por eso les faltaban materias ' +
      'del programa vigente (navegadores Chrome/Edge, Recortes, Snap Layouts).',
  },
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
  clasificar_tipo_documento: {
    titulo: 'Clasificar el TIPO de un documento del hub de provenance (convocatoria/bases/OEP/…) por su cabecera',
    ruta: 'lib/convocatoria/tipoDocumento.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/provenance-convocatorias.md',
    notas:
      'Núcleo PURO (sin red ni BD): dado título/URL/texto, decide qué `tipo` de `convocatoria_documentos` ' +
      'es un documento leyendo su CABECERA (no el texto entero — daba falsos positivos por menciones ' +
      'de pasada). Ante la duda, `nota`: un tipo falso se usa como fuente de verdad, un `nota` de más ' +
      'se ignora. Dos consumidores: `sim-tipo-documento.cjs` (CLI manual, simula y aplica en lote sobre ' +
      'el histórico) y el mirror TS `backend/src/tipificar-documentos/tipo-documento-mirror.ts` (cron ' +
      'diario — el backend no puede importar `lib/`, MANTENER EN SYNC, paridad en ' +
      '__tests__/backend/tipoDocumentoMirror.test.ts). Reglas ORDENADAS por especificidad, cada una ' +
      'con su exclusión medida sobre el corpus real (27/07).',
  },
  simular_tipo_documento: {
    titulo: 'Simular/aplicar en lote la reclasificación de `nota`→tipo real sobre el hub de provenance',
    ruta: 'scripts/convocatoria/sim-tipo-documento.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/provenance-convocatorias.md',
    notas:
      'node scripts/convocatoria/sim-tipo-documento.cjs [--todo] [--ver <tipo>] [--apply ' +
      '[--solo-alta]]. Herramienta MANUAL del paso 1 de T-147 (163 documentos tipados el 27/07). No ' +
      're-tipa duplicados (mismo doc_key ya tipado en su convocatoria — eso es `merge-dup-docs.cjs`). ' +
      'Desde el 05/08 tiene un GEMELO recurrente: `tipificar_documentos_cron`, que hace lo mismo cada ' +
      'noche para que el backlog no se rellene solo; este script sigue vivo para pasadas manuales ' +
      '`--todo` sobre el histórico y para revisar una muestra (`--ver`) antes de confiar en el criterio.',
  },
  tipificar_documentos_cron: {
    titulo: 'Cron diario que reclasifica `nota`→tipo real en `convocatoria_documentos` (T-147, "arreglar el productor")',
    ruta: 'backend/src/tipificar-documentos/tipificar-documentos.service.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/provenance-convocatorias.md',
    notas:
      '@Cron 09:45 UTC diario (justo tras detect-notas-convocatoria, 09:30). Lee hasta 1000 filas ' +
      '`tipo=\'nota\'` (las más antiguas primero), clasifica con el mismo criterio que ' +
      '`sim-tipo-documento.cjs` (mirror TS, no puede importar `lib/`) y hace UPDATE por `id` — NO ' +
      'inserta nada, así que nunca compite con el historial de monitoreo de `detect-notas-convocatoria` ' +
      '(que sigue clonando TODO como `nota` a propósito: es su append por content_hash). Si el ' +
      'doc_key ya está tipado por otra fila en la misma convocatoria (duplicado real), Postgres lo ' +
      'rechaza (unique_violation) y se cuenta como `bloqueadosPorDuplicado` en vez de fusionar a ' +
      'ciegas — eso lo resuelve `merge-dup-docs.cjs` aparte. Por qué existe: sin esto, tipar era un ' +
      'gesto manual y el 96% del hub volvía a quedarse en `nota` cada noche (medido 27/07→05/08: ' +
      '6.063→6.398 sin que nadie tocara nada). Cierra el "paso 2" que la ficha marcaba como ' +
      '"hallazgo de diseño, no tocar el INSERT" — se resolvió sin tocarlo.',
  },
  bandeja_documentos: {
    titulo: 'Bandeja de documentos oficiales clonados pendientes de revisar (y de volcar a la BD)',
    ruta: 'scripts/convocatoria/bandeja-documentos.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      'npm run docs:bandeja [-- --ver <id>] [--revisado <id> --nota "…"] [--slug X]. No decide ni ' +
      'escribe en la convocatoria: enseña el documento clonado JUNTO a lo que hoy dice la BD para ' +
      'que la decisión y el dual-write los haga quien tiene criterio. Sustituye al pre-masticado ' +
      'con LLM del cron, ELIMINADO el 26/07 tras medir 6.886 extracciones y CERO triadas, ~17 USD. ' +
      'No se dejó tras un flag: código muerto que alguien puede encender es una factura esperando. El cron además solo clona ya las oposiciones ' +
      'is_active: antes el 96% de lo clonado era de procesos que no preparamos (750 doc/día → ~25). ' +
      'Se ve en /admin/contenido (columna Docs) y en el sweep (kind documentos_sin_revisar).',
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
  simular_plazas_contexto: {
    titulo: 'Simular la regla «con contexto» de plazas_afirmadas_sin_documento (y la frontera de número)',
    ruta: 'scripts/convocatoria/sim-plazas-contexto.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      'node scripts/convocatoria/sim-plazas-contexto.cjs [--json salida] [--slug X]. No escribe ' +
      'nada. Corre sobre las MISMAS filas que el detector vivo y compara tres reglas: la viva ' +
      '(¿aparece la cifra?), la viva CON FRONTERA (¿como número entero, no dentro de otro?) y la ' +
      'de CONTEXTO reutilizando `landingClaims` (¿el documento la llama plazas?). Con eso se ' +
      'decidió [T-202]: la de contexto NO se enciende (56 hallazgos, casi todos falsos: 13 por el ' +
      'patrón y 37 por tablas que el PDF aplanó) y la frontera SÍ (7 casos que estaban en verde ' +
      'porque la cifra vivía dentro de un código, p.ej. 216 en `C1.1000197163216`).',
  },
  simular_frase_plazas: {
    titulo: 'Simular la frase de plazas de la landing (vieja vs nueva) sobre TODAS las activas',
    ruta: 'scripts/convocatoria/sim-frase-plazas.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-convocatorias.md',
    notas:
      'npx tsx scripts/convocatoria/sim-frase-plazas.ts [--todas]. No escribe nada. Importa el ' +
      'núcleo real `lib/convocatoria/reservaDiscapacidad.ts`, así que si cambia la regla cambia la ' +
      'simulación. Enseña la frase ANTES y AHORA de cada landing viva agrupada por tipo de cambio, ' +
      'y comprueba que ninguna pierde su cifra de plazas. Correrla es lo que destapó en [T-214] la ' +
      'concordancia rota en singular («1 reservadas para discapacidad») y lo que permite tocar la ' +
      'primera frase de 123 landings publicadas sin desplegar a ciegas.',
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
  scope_ley_entera_contradicha: {
    titulo: 'Cuántos scopes «toda la ley» contradicen a su PROPIO epígrafe, contrastado contra el índice del BOE',
    ruta: 'scripts/scope/medir-ley-entera.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      '`npm run scope:medir-ley-entera [-- --json]`. SOLO LEE: no escribe, no pinga badge. Es el ' +
      'punto 1 de [T-528] — la medición que hacía falta antes de decidir nada. Se distingue del ' +
      'detector `scope_over_inclusion_suspect` en que aquél razona sobre el TEXTO del epígrafe ' +
      '(cuenta segmentos, busca palabras de cierre) y este lo contrasta contra las SECCIONES ' +
      'REALES de la ley, así que lo que saca es una contradicción comprobable y no una sospecha. ' +
      'Núcleo puro `lib/laws/epigrafeEnumeraSecciones.cjs` (12 unitarios) sobre `parseBoeSections`. ' +
      'MEDIDO el 04/08: de 1.957 scopes «ley entera» solo 476 (24%) son medibles —el resto son ' +
      'leyes sin índice del BOE y ahí NO se opina, un cero aquí no dice que estén bien—; de esos, ' +
      '22 contradicen (17 ciertas a mano, 5 falsas por una norma que el atribuidor no reconoce) y ' +
      '10 estaban marcadas `verified_correct`. GOTCHA: la atribución sección→ley se REUTILIZA de ' +
      '`scopeTitleBoundary` (T-129); sin ella salían 33 hits y los primeros eran falsos (a la Ley ' +
      '4/2015 se le colgaban los libros de la LECrim del mismo epígrafe).',
  },
  scope_recortes_pendientes: {
    titulo: 'La cola de recortes de scope YA adjudicados contra la fuente oficial y sin aplicar',
    ruta: 'scripts/scope-over-inclusion.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'Flag `--pendientes [--json]` (`npm run scope:pendientes`) de la MISMA herramienta que emite ' +
      'los sospechosos y aplica la guarda determinista: misma tabla, mismo criterio de cola que ' +
      '`--reguard`, una sola puerta. Es la entrada del kind `scope_over_inclusion_confirmed` del ' +
      'panel de salud — el badge dice CUÁNTOS, esto dice CUÁLES. Ordena por IMPACTO (artículos ' +
      'que salen del scope al recortar), que es la regla que el flujo aprendió a base de fallos: ' +
      'impacto 0 = higiene segura, >150 preguntas = decisión de programa. POR QUÉ EXISTE (medido ' +
      'el 31/07, T-088): adjudicar y aplicar son dos trabajos distintos, y entre uno y otro la ' +
      'cola era invisible — el badge de sospechosos estaba a 0 (todos adjudicados) con 16 ' +
      'recortes confirmados esperando en 12 oposiciones. Solo LEE.',
  },
  scope_peers_comparados: {
    titulo: 'Encontrar el tema HERMANO que ya acotó esta misma ley, para adjudicar un scope por evidencia comparada',
    ruta: 'scripts/scope-over-inclusion.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'Flag `--peers <position_type> <tema> "<short_name>"` de la MISMA herramienta que emite los ' +
      'sospechosos (una puerta, no dos). Es el paso 2 de T-154: `consenso_banco` dice en agregado ' +
      'si tener la ley entera es la anomalía, y esto dice EN QUIÉN apoyarse. Marca con ★ el ' +
      'hermano con parecido alto + scope acotado + epígrafe verificado, y **si no lo hay lo dice** ' +
      'en vez de ofrecer el más parecido como si valiera. Sirve sobre todo para los epígrafes en ' +
      'PROSA, donde no hay bloques que mapear y la alternativa es opinar. Núcleo puro en ' +
      'lib/laws/peerScopes.js (CommonJS, sin mirror). GOTCHA de calibración: las palabras de ' +
      'relleno ("concepto y clases", "nociones básicas", "estudio particular") están excluidas a ' +
      'propósito — si contaran, cualquier par de epígrafes administrativos parecería hermano.',
  },
  arbol_ley_boe: {
    titulo: 'Ver la estructura LIBRO › TÍTULO › CAPÍTULO › artículos de una ley del BOE (con la rúbrica VIGENTE)',
    ruta: 'scripts/scope/arbol-ley-boe.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'SOLO LEE (no toca BD ni law_sections). Es la herramienta para ADJUDICAR sobre-inclusión de ' +
      'scope en las leyes-código, que es justo lo que `poblar_law_sections_boe` no puede darte: ' +
      'allí los títulos REINICIAN por libro y la ley se rechaza a propósito (T-104). Lógica en el ' +
      'núcleo puro lib/laws/arbolLeyBoe.js, testeada sin red. Acepta el `short_name` y resuelve el ' +
      'id por `laws.boe_url` — ÚSALO ASÍ: teclear el id de memoria me costó un diagnóstico entero ' +
      'confundiendo las DOS "LO 14/2007" que existen (biomédica y Estatuto de CyL). GOTCHAS que ya ' +
      'trae resueltos: (1) los ids del BOE MIENTEN (en la LECrim el art. 1 tiene id `co` y el id ' +
      '`tx-3` es el TÍTULO XIV) → se clasifica por LABEL; (2) el índice REPITE secciones tras ' +
      'sucesivas reformas (la Ley 42/2007 trae el Título II y el III dos veces) → se fusionan, o el ' +
      'mapeo sale corto y se recorta de más; (3) la rúbrica se lee con `rubricaVigente`, porque el ' +
      'bloque trae TODAS sus versiones históricas y el primer match es la DEROGADA. NO cubre ' +
      'normativa de la UE (RGPD, TUE, TFUE): no está en la API del BOE consolidado, vive como ' +
      'documento DOUE y hay que parsear ese espejo aparte.',
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

  // ── campos de referencia que la landing PUBLICA ────────────────────────────────────────────
  sanear_referencia_publicada: {
    titulo: 'Sacar de la landing las notas internas coladas en los campos de referencia',
    ruta: 'scripts/convocatoria/sanear-referencia-publicada.cjs',
    estado: 'vivo',
    escribe: ['boe_reference', 'diario_referencia', 'convocatoria_numero', 'oep_decreto'],
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      'Dry-run por defecto. Esos campos se PINTAN en el hero y bajo el botón oficial, y se usaban ' +
      'como bloc de notas de auditoría: medidas 7 landings activas el 31/07 (T-435), la peor ' +
      'sirviendo «⚠️ SIN VERIFICAR: la fila afirma 688 plazas…». NO TIRA NADA Y NO INVENTA NADA: ' +
      'conserva lo que va DELANTE del marcador (la cita del boletín, que es la convención de la ' +
      'casa) y MUDA la nota a `convocatoria_verification` como `needs_human` — la duda deja de ' +
      'publicarse pero sigue viva. Si el valor EMPIEZA por el marcador no toca nada: la referencia ' +
      'se pasa con `--referencia` tras abrir el boletín, y `--verificado` (que la exige) marca ' +
      '`verified_correct`. Dual-write en `convocatorias` (de donde lee la vista SSOT) y en ' +
      '`oposiciones`. Detección: `lib/convocatoria/notaInternaPublicada.cjs` (kind ' +
      '`nota_interna_publicada`), que mira `oposiciones_ssot` — sobre la tabla base da CERO con el ' +
      'texto en pantalla. **NO clona nada**: `--verificado` exige `--cita` y la CONTRASTA contra el ' +
      '`extracted_text` del documento ya clonado en el hub (`convocatoria_documentos`), enlazando ' +
      '`source_url` + `verified_source_hash`; si el documento falta, manda al clonador canónico ' +
      '`backend/scripts/clonar-documento.ts` en vez de abrir un segundo camino de escritura al hub. ' +
      'Tras aplicar hay que invalidar caché y comprobar el HTML SERVIDO.',
  },

  sim_vuelta_al_articulo: {
    titulo: 'Comprobar con navegador que la vuelta del test devuelve a SU artículo',
    ruta: 'scripts/sim/sim-vuelta-al-articulo.ts',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/roadmap/tareas-pendientes.md',
    notas:
      '`npm run sim:vuelta-articulo [-- --url https://www.vence.es]`. Solo navega, no escribe. ' +
      'Nace de [T-611] (feedback de Ángela): al volver de un test aterrizaba arriba del tema y con ' +
      'las leyes PLEGADAS. Hace falta navegador porque la ley plegada NO es `display:none` en el ' +
      'HTML servido — es estado de React tras hidratar, y el despliegue va en un efecto post-montaje ' +
      'a propósito (la página es ISR y tocar el HTML sería un hydration mismatch): medirlo por HTTP ' +
      'da VERDE con el bug puesto. Cuatro comprobaciones: control (sin ancla la tarjeta no se ve, o ' +
      'el resto no prueba nada), la vuelta (con ancla la tarjeta se VE), la señal ' +
      '`temario_vuelta_articulo=articulo`, y el ancla rota (ni revienta ni miente: `no_encontrado`). ' +
      'El caso NO va quemado: se elige de BD un tema activo con 2+ leyes, porque un slug fijo ' +
      'envejece y acaba probando una página que ya no existe. GOTCHA: el ancla se localiza por ' +
      'selector de ATRIBUTO, no por `#id` — `CSS.escape` es un global del navegador y en Node no existe.',
  },
  // ── topic_scope_verification (estado de verificación del temario) ──────────────────────────
  degradar_sellado_sin_pipeline: {
    titulo: 'Degradar a never_verified los temas sellados a mano y sin Paso 1',
    ruta: 'scripts/temario/degradar-sellado-sin-pipeline.cjs',
    estado: 'vivo',
    escribe: ['topic_scope_verification.state'],
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'Dry-run por defecto; `--apply` escribe en UNA transacción y deja rastro en el historial ' +
      'append-only con `verified_by` propio. NO toca `topic_scope`: las preguntas se sirven igual, ' +
      'lo único que cambia es que el estado deja de afirmar que alguien verificó lo que nadie ' +
      'verificó. El criterio de «sellado sin pipeline» NO se reescribe aquí: sale de ' +
      '`ESCRITORES_SIN_PIPELINE` (`lib/temario/revisionEpigrafe.cjs`), la MISMA constante que usa ' +
      'el badge — dos puertas al mismo hecho con criterios distintos se contradicen. Aborta si el ' +
      'conjunto supera `--max` (700 por defecto): un salto así es criterio roto, no deuda nueva. ' +
      'Corrido el 06/08/2026: 562 temas en 32 oposiciones (`scopeSinPipeline` 881→319). Se dejaron ' +
      'fuera a propósito los 319 que SÍ tienen el epígrafe verificado literal — decisión de Manuel: ' +
      'degradar los 881 encendía 45 oposiciones de golpe y así es como se mata un badge.',
  },
  // ── seguimiento_url ────────────────────────────────────────────────────────────────────────
  repuntar_seguimiento_url: {
    titulo: 'Cambiar la seguimiento_url de una oposición (con guardarraíl de vigilabilidad)',
    ruta: 'scripts/seguimiento/repuntar-url.cjs',
    estado: 'vivo',
    escribe: ['seguimiento_url', 'fetcher_type', 'headless_required'],
    runbook: 'docs/maintenance/oeps-convocatorias-seguimiento.md',
    notas:
      'Dry-run por defecto. Descarga la candidata con las cabeceras EXACTAS del cron, la pasa por ' +
      '`decidirEscritura` y RECHAZA una URL que no sirva contenido; `--anclas` exige además que la ' +
      'página mencione el proceso. Resetea `seguimiento_last_hash` en `oposiciones` (la tabla que usa ' +
      'el cron; existe también en `convocatorias` y resetear esa NO hace nada). Traza en ' +
      '`observable_events` (`seguimiento_url_repuntada`). **Desde T-453 mide con NAVEGADOR antes de ' +
      'rechazar**: si el fetch plano ve un cascarón pero el headless ve contenido, PROMUEVE la fuente ' +
      'a `fetcher_type=headless` (+`headless_required`, que exige el CHECK `chk_fetcher_headless_consistency`) ' +
      'y escribe la URL en la misma transacción — antes rechazaba la URL BUENA de cualquier portal SPA ' +
      'y esas fuentes quedaban invigilables para siempre (13 activas así el 01/08). La guarda que NO ' +
      'cambia: si el navegador tampoco ve nada (`ambos_ciegos`) se rechaza igual, porque ahí el ' +
      'problema es la URL y marcar headless solo lo enmascara.',
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
  actualizar_articulo_oficial: {
    titulo: 'Poner al día el `content` de artículos contra su fuente oficial (BOE y EUR-Lex)',
    ruta: 'scripts/actualizar-articulo-oficial.cjs',
    estado: 'vivo',
    escribe: ['content'],
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      'Dry-run por defecto. Hermano de `reactivar_articulo_boe`, que reactiva UN artículo apagado ' +
      'contra el BOE; esto pone al día EN TANDA el texto de artículos ACTIVOS. **Admite las DOS ' +
      'fuentes: `BOE-A-AAAA-N` y `CELEX:0…`** (T-376, 31/07/2026) — antes solo EUR-Lex, así que ' +
      'para las leyes del BOE, que son la mitad del catálogo, no había ninguna puerta. La lectura ' +
      'del BOE vive en `lib/laws/fuenteOficialBoe.cjs` y reutiliza `bloqueVigente`, el mismo ' +
      'extractor del Paso 1; la política NO se duplicó. Los ids `DOUE-*` siguen fuera a propósito. ' +
      'Nace de T-184: el ' +
      'RGPD servía 41.381 caracteres de menos (el art. 28, 12 párrafos; el 40, 21). **La fuente de ' +
      'una norma UE es EUR-Lex CONSOLIDADO (CELEX que empieza por 0), NO el espejo del BOE**, que ' +
      'reproduce el DOUE original CON erratas: comparando contra él "divergían" 80 de 99 artículos ' +
      'y arreglarlos habría metido «las orientación sexuales» en 49 oposiciones. Rechaza un CELEX ' +
      'del sector 3. La política vive en `lib/laws/actualizarArticuloGuardas.js` (9 tests): solo ' +
      'reescribe `incompleto` y `erratas`, BLOQUEA `contaminado` y `sin_oficial`, y `reordenado` ' +
      'pide bandera. Usa `parrafosDeEurLex`, que reconstruye el `\n` por apartado y por letra ' +
      '(volcar plano arregla la literalidad y ROMPE la teoría) y corta en el encabezado de ' +
      'división: sin eso el art. 31 se llevaba pegado «Sección 2 Seguridad de los datos ' +
      'personales» — contaminación nuestra, cazada mirando el texto antes de escribir, no con un ' +
      'contador. Re-compara DENTRO de la transacción y hace ROLLBACK si no queda `identico`. ' +
      'Escribir `content` dispara `reset_questions_on_article_update`: las preguntas del artículo ' +
      'quedan pendientes de re-verificar, que es lo correcto.',
  },
  deploy_cuando_verde: {
    titulo: 'Desplegar EN CUANTO el CI verdee (sigue a origin/main y reintenta solo)',
    ruta: 'scripts/deploy-cuando-verde.sh',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/pusheo-revision-despliegue.md',
    notas:
      '`scripts/deploy-cuando-verde.sh backend|frontend [vueltas]`. No despliega él: espera y llama ' +
      'al `deploy-*.sh` de siempre. Existe porque con varias sesiones pusheando cada pocos minutos, ' +
      'la ventana que exigen los guardarraíles —árbol limpio + al día + lock libre + CI VERDE de ESE ' +
      'SHA— casi nunca coincide: el 28/07 un fix de UNA línea necesitó SIETE intentos y solo UNO ' +
      'falló por el código. Reacciona distinto a cada estado: espera si el CI está en curso, ' +
      'RESINCRONIZA si GitHub canceló el run (llegó otro push) o si origin/main avanzó, PARA si el ' +
      'árbol está sucio (el build usa el working tree) y ABORTA si el CI está en rojo de verdad — ' +
      'eso se arregla, no se fuerza. El veredicto no lo decide él: vive en `lib/deploy/ciGate.js` ' +
      '(11 tests), el mismo criterio que aplican los scripts de deploy en jq, con paridad vigilada ' +
      'por `__tests__/guardrails/ciGateParidad.test.ts`.',
  },
  friccion_sesiones: {
    titulo: '¿Cuánto cuesta trabajar en paralelo, y qué guardarraíl se está muriendo?',
    ruta: 'scripts/friccion-sesiones.cjs',
    estado: 'vivo',
    escribe: ['observable_events'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      '`npm run sesiones:friccion [-- --dias 7]`. Todo lo construido para que 2-10 sesiones no se ' +
      'pisen contesta «¿qué pasa AHORA?»; nada dejaba SERIE TEMPORAL. Lo que mide, y es lo que ' +
      'importa, NO es cuántas veces bloquea un guardarraíl —eso solo dice que trabaja— sino ' +
      'cuántas veces lo RODEAN con su escape: ese ratio es un indicador ADELANTADO, se ve subir ' +
      'antes de que el guardarraíl deje de servir. Bandas: <25% sano (el escape hace de válvula), ' +
      '25-66% erosión (falta contemplar un caso legítimo), >=66% MUERTO (ya no protege, es un ' +
      'peaje: o se arregla el criterio o se quita). Con pocos datos NO opina. El 31/07 murieron ' +
      'TRES guardarraíles exactamente así y los tres se descubrieron por casualidad. Emiten el ' +
      'push-guard y el de índice compartido vía `scripts/friccion-emitir.cjs`, best-effort ' +
      'absoluto (corren dentro de hooks de git). Núcleo `lib/observability/friccionSesiones.cjs`, ' +
      '11 tests. **Para emitir NO se escribe un spawn propio: se llama a `emitirFriccion` de ' +
      '`lib/sessions/friccion.cjs`** (T-542) — cada guardarraíl se copiaba el suyo y la sexta ' +
      'puerta, la de temario, nació imprimiendo «queda contado» sin contar nada.',
  },
  friccion_emisor: {
    titulo: 'Emitir un roce entre sesiones sin poder romper nada (emisor único)',
    ruta: 'lib/sessions/friccion.cjs',
    estado: 'vivo',
    escribe: ['observable_events'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      '`emitirFriccion({ clase, guard, detalle, segundos })`. Es la ÚNICA forma legítima de contar ' +
      'un roce: no lanza nunca, no bloquea (detached+unref, corre dentro de hooks de git), no ' +
      'imprime, y descarta una clase que no esté en el catálogo cerrado de ' +
      '`lib/observability/friccionSesiones.cjs` antes de gastar un proceso. **Nace de un fallo ' +
      'medido (T-542, 04/08/2026):** el emisor estaba copiado a mano en cada guardarraíl (6 copias ' +
      'privadas) y la sexta puerta —la de temario, T-518— nació SIN escribir la suya, imprimiendo ' +
      '«queda contado» y no contando nada. Peor que el silencio: el mensaje le decía a la ' +
      'siguiente sesión que no se preocupara. Lo destapó una sesión que rodeó la puerta y fue a ' +
      'buscar su escape al bus. GOTCHA al consultar: el `detalle` se guarda en la columna ' +
      '`error_message`, NO en `metadata` — buscarlo en el jsonb da cero filas y se lee como «el ' +
      'bus está roto». Capas: `__tests__/sessions/friccionEmisor.test.ts` (6), ' +
      '`__tests__/impugnaciones/puertaTemarioFriccion.test.ts` (8, verificado que falla contra el ' +
      'código original), guardarraíl `puertasQueCuentan.guardrail` con TRINQUETE sobre las 6 ' +
      'copias privadas restantes, y `npm run sim:friccion-puertas` de extremo a extremo contra RDS.',
  },
  epigrafe_vs_fuente: {
    titulo: '¿Qué oposiciones sirven un temario que NO está en su propia fuente? (triaje del Paso 1)',
    ruta: 'scripts/temario/audit-epigrafe-vs-fuente.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      '`npm run audit:epigrafe-fuente [-- --slug X] [--limite N] [--json out]`. SOLO LEE. Núcleo ' +
      'puro `lib/temario/epigrafeEnFuente.cjs` (22 tests). **Cubre el hueco de [T-528]**: 2.295 ' +
      'temas (60%) sin contrastar nunca contra su fuente, teniendo el programa_url en las 126 ' +
      'activas. No sustituye al Paso 1 ni pinga badge: ORDENA LA COLA para empezar por donde más ' +
      'se miente. **La pregunta es barata a propósito** —¿el epígrafe de la BD aparece DENTRO del ' +
      'documento?— y por eso no necesita parsear el boletín, que es lo que falla en un tercio de ' +
      'los casos. Reutiliza `fetchProgramaText` de `verify-epigrafe-literality.cjs`, no otro ' +
      'fetcher. Calibrado contra `administrativo_asturias`, del que se conoce el temario antes y ' +
      'después de clonarlo: **0/30 antes, 30/30 después**. Tres gotchas que decidían si servía: ' +
      '(1) hay que limpiar el mobiliario de página o un tema que cruza de página se declara ' +
      'ausente; (2) el pie CAMBIA con la paginación, así que se enmascaran los dígitos antes de ' +
      'contar repeticiones — con tope de 80 caracteres, o el filtro se lleva por delante la lista ' +
      'de temas; (3) **`fuente_no_es_temario` va en cubo APARTE**: `administrativo-estado` salía ' +
      'el primero con «45 de 45 fuera de su fuente» y su programa_url era el RD de la OEP 2026, ' +
      'sin un solo tema dentro — mezclar enlaces rotos con paráfrasis pone lo uno delante de lo ' +
      'otro. Las oposiciones personalizadas y lo que deja fuera un `--limite` se cantan, no se callan.',
  },
  sid_corto: {
    titulo: 'Cómo se escribe un session-id en pantalla sin que colisione con el de otra sesión',
    ruta: 'lib/sessions/sid.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`sidCorto(sid)`. Abrevia por SEGMENTO, nunca por longitud: la forma canónica de `nuevoSid` ' +
      'es `<nombre>-<máquina>-<azar>`, con lo distintivo al principio, así que recortar a 8 ó 12 ' +
      'caracteres corta por donde no es. **Medido el 04/08 (T-538):** con cinco sesiones abiertas ' +
      'el mismo día (`imp-04ago-b/c/d/e/g`) las cinco se escribían `imp-04ag`, y `cola.cjs list` ' +
      'marcaba con candado seis reservas AJENAS junto al nombre que quien miraba leía como suyo — ' +
      'el icono distinguía y el texto no. Ocho filas ajenas leídas como propias en una sesión. ' +
      'Si el sid no tiene esa forma (uno antiguo, un UUID de CLAUDE_CODE_SESSION_ID) NO se toca: ' +
      'más vale largo que colisionando. Y las etiquetas dicen la RELACIÓN («🙋 TUYA» / «🔒 otra ' +
      'sesión (imp-04ago-b)»), no solo el id. Guardarraíl: ' +
      '`__tests__/guardrails/sidSinTruncarAMano.guardrail.test.ts` (recorre los 7 módulos que ' +
      'enseñan un sid y distingue un sid del id de un usuario) + `__tests__/sessions/sidCorto.test.ts`.',
  },
  puertas_que_cuentan: {
    titulo: 'Una puerta que bloquea tiene que contarse (guardarraíl)',
    ruta: 'lib/calidad/puertasQueCuentan.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    notas:
      'Núcleo puro + `__tests__/guardrails/puertasQueCuentan.guardrail.test.ts`. Marca la puerta ' +
      'que comunica un rechazo (🛑/⛔) y puede devolver `false` pero NO llama a `emitirFriccion`. ' +
      'Detecta por COMPORTAMIENTO, no por mención —igual que `toolWriters`—: un comentario que ' +
      'nombre la fricción no cuenta como contarla, que es exactamente la trampa del caso original. ' +
      'Lleva además un trinquete sobre los módulos que lanzan `friccion-emitir.cjs` por su cuenta ' +
      '(6 el 04/08, casi todos en hooks de git; migrarlos es trabajo aparte porque romper el ' +
      'pre-push deja a todas las sesiones sin poder subir nada).',
  },
  sesiones_solape: {
    titulo: '¿Otra sesión está tocando mis mismos ficheros? (mapa en vivo)',
    ruta: 'scripts/sessions/latidos.cjs',
    estado: 'vivo',
    escribe: ['worktree_sessions'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      '`node scripts/sessions/latidos.cjs`. El claim del backlog reparte IDS DE TAREA; las ' +
      'sesiones chocan por FICHEROS, y eso no lo veía nadie (T-361 fue el mismo bug encontrado ' +
      'por dos sesiones el mismo día; T-375 y T-382 se cogieron por separado siendo los mismos ' +
      'ficheros). Cada sesión publica su HUELLA —sucio + lo que va por delante de origin/main, ' +
      'sacado de GIT y no declarado, porque una intención anotada se pudre y el estado observado ' +
      'no— y la escribe el propio latido, sin pedir disciplina. Avisa también en `backlog.cjs ' +
      'claim`. NUNCA bloquea: dos sesiones pueden tocar un fichero por motivos legítimos, y un ' +
      'corte por solape se acabaría rodeando. Calibrado sobre worktrees reales (el único fichero ' +
      'compartido por 3+ era el markdown del backlog, así que está excluido). Núcleo puro ' +
      '`lib/sessions/solape.cjs`, 21 tests. Reporta aparte, y más grave, varias sesiones en el ' +
      'MISMO checkout: ahí no hay conflicto de git que avise, se sobrescriben en vivo.',
  },
  done_verificacion: {
    titulo: 'Impedir cerrar una tarea cuyo código servido todavía NO está desplegado',
    ruta: 'scripts/backlog/verificacion.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      'Segunda puerta de `backlog.cjs done` (Fase 1 de T-392). La primera mira el TEXTO del ' +
      'outcome y caza al que confiesa; esta mira los HECHOS: si los commits que DECLARAN la tarea ' +
      'tocan superficie servida y el sha vivo (`/api/health`) aún no los incluye, no se puede ' +
      'haber verificado. Nace del cierre de T-363 —código de COBROS en `main`, sin desplegar y ' +
      'sin verificar— que la puerta de texto dejó pasar porque el outcome sonaba terminado. ' +
      'Núcleo puro `lib/backlog/verificacionGate.cjs` (11 tests). Lo que lo salva de ser sello: ' +
      '«servido» se DERIVA de quién importa el fichero, no de dónde vive — y solo cuentan líneas ' +
      'con forma de import (una mención en un comentario daba `pushGuard` como servido) y ' +
      'commits que DECLARAN, no que citan (criterio de T-403; sin eso T-431 heredaba ficheros de ' +
      'otra sesión). Alcance medido: 36% de las tareas cerradas de 7 días. Fail-open sin red. ' +
      'Escape `--igualmente`, que queda contado en el bus de fricción. Calibración: ' +
      '`npm run sim:verificacion -- --listar`.',
  },
  pareja_farmeo: {
    titulo: 'Detectar la PAREJA de cuentas clavadas en el tope del free (el farmeo mínimo viable)',
    ruta: 'lib/security/parejaFarmeo.js',
    estado: 'vivo',
    escribe: ['fraud_alerts'],
    runbook: 'docs/runbooks/revisar-fraudes.md',
    notas:
      'Núcleo puro (18 tests) usado por el @Cron real `backend/src/fraud-sweep` —vía su espejo ' +
      '`pareja-farmeo.ts`, con test de PARIDAD de 19 casos— y por el gemelo CLI ' +
      '`scripts/fraud-sweep.cjs`. Cierra un punto ciego aritmético: `multi_account_device` pedía ' +
      '≥3 cuentas y una pareja tiene 2; `device_daily_farming` pedía >60 preguntas/día y 2 ' +
      'cuentas × el tope free de 25 son 50, así que el patrón que produce el propio límite caía ' +
      'bajo los dos cortes A LA VEZ (de 5 equipos triados a mano el 31/07, 4 sin una sola señal ' +
      'histórica). NO se arregla bajando el umbral a 2 cuentas: inundaría el inbox de familias. ' +
      'La señal es la FORMA —las dos al tope, el mismo día, repetido— con DOS condiciones porque ' +
      'ninguna basta sola: ≥3 días clavados Y ≥50% de sus días ACTIVOS (el denominador son los ' +
      'activos, no la ventana: si no, quien usa la app 4 días al mes nunca daría). Validado ' +
      'contra verdad conocida: los 3 equipos confirmados a mano salen los 3 como farmeo. La zona ' +
      'intermedia se imprime en el CLI y no abre señal.',
  },
  registro_crons: {
    titulo: '¿Sigue habiendo ALGUIEN escribiendo en el registro de ejecuciones de los crons?',
    ruta: 'scripts/canary-registro-crons.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/health-check.md',
    notas:
      '`npm run canary:registro-crons`. Solo lee. Criterio puro en `lib/cron/registroVivo.cjs` ' +
      '(13 tests), compartido con `/api/admin/health`. Nace de que la tabla `cron_runs` estuvo ' +
      'DOS MESES muerta (24/05→31/07) sin que nada avisara: los crons se mudaron a los `@Cron` ' +
      'del backend, que emiten a `observable_events` con `event_type=\'cron_run\'`, y el panel ' +
      'siguió consultando la tabla — no fallaba, devolvía CERO filas, y cero se pinta igual que ' +
      '«todo bien». Todo lo que había vigilaba «¿este cron va retrasado?» y nada «¿sigue ' +
      'escribiendo alguien aquí?»: por eso `registroMudo` es una comprobación APARTE y de ' +
      'primera clase (si se mezclara, un termómetro roto saldría como «todos los crons muertos»). ' +
      'El nombre del cron va en `endpoint`, NO en `metadata->>\'cron\'`, que falta en algunos ' +
      'y agruparlos por él los pierde en silencio. Primera pasada: 28 crons visibles donde el ' +
      'panel enseñaba 0, y 4 incidencias de 24 h invisibles (content-health-sweep en `failure` ' +
      'desde el 29/07, refresh-rankings con consulta rota).',
  },
  trabajo_huerfano: {
    titulo: '¿Algún worktree abandonado guarda trabajo que no existe en ningún otro sitio?',
    ruta: 'scripts/sessions/huerfanos.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`npm run sesiones:huerfanos` (solo lee git + `worktree_sessions`). Criterio puro en ' +
      '`lib/sessions/trabajoHuerfano.cjs`, COMPARTIDO con el mapa `latidos.cjs` y con el guard de ' +
      '`borrar-worktree.sh` — tres puertas al mismo recurso con criterios distintos no protegen. ' +
      'La pregunta NO es cuántos commits hay sino QUÉ SE PERDERÍA: `origin/main...HEAD` (tres ' +
      'puntos, si no lo que falta de main cuenta como propio) ∩ «difiere hoy de main» (mata los ' +
      '47 commits de vence-clean, ya arriba por contenido) ∪ lo no commiteado. Medido 31/07: de ' +
      '5 worktrees con «trabajo», 4 eran ruido y 1 llevaba 3 días con 43 líneas perdidas. NACE EN ' +
      'SILENCIO (hoy 0 huérfanos), así que la prueba de que encuentra algo es `npm run ' +
      'sim:huerfanos`, que reconstruye los 5 casos sobre repos de verdad. NO va al barrido ' +
      'nocturno: los worktrees son locales y el sweep corre en Fargate. Emite `trabajo_huerfano` ' +
      'al bus de fricción (T-423).',
  },
  reserva_perdida: {
    titulo: 'Avisar a una sesión de que lo que tenía reservado ya lo lleva otra',
    ruta: 'scripts/sessions/reserva-perdida.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      'Lo invoca el hook `UserPromptSubmit` en CADA turno (a través de `recordatorio-hook.cjs`); ' +
      'a mano, `node scripts/sessions/reserva-perdida.cjs --estado` dice además qué tienes ahora. ' +
      'El reparto ya soltaba bien las reservas de una sesión muerta, pero no tenía vuelta: al que ' +
      'la perdía nadie se lo decía, así que seguía trabajando y escribiendo — «me voy a dormir y ' +
      'por la mañana dos sesiones me hablan de lo mismo» (Manuel, 04/08). Cubre las DOS colas ' +
      '(backlog_tasks y feedback/impugnaciones) y detecta además la IDENTIDAD PARTIDA: reclamar ' +
      'con un sid que no late hace que te den por muerta y te quiten lo tuyo estando viva (caso ' +
      'real: el feedback 8b788ee0 reclamado con el id del worktree mientras se latía desde el ' +
      'principal). Núcleo puro en `lib/sessions/reservaPerdida.cjs` (22 tests) + guardarraíl ' +
      '`avisoReservaPerdidaCableado` porque su modo de fallo es enmudecer en silencio. ' +
      'No añade escritores (solo lee; la foto anterior vive en /tmp) y es fail-open con throttle ' +
      'de 90 s y timeout de 2,5 s: un hook que cuelga el prompt se desactiva el primer día.',
  },
  contador_servible: {
    titulo: 'Medir cuánto promete el contador de un tema por encima de lo que el test puede servir',
    ruta: 'scripts/sim/sim-contador-servible.ts',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/salud-contenido.md',
    notas:
      '`npm run sim:contador-servible [-- --oposicion <position_type>]`. Solo lectura. El serve ' +
      'aplica DOS filtros que los contadores no aplicaban: `buildOfficialExamFilter` (una oficial ' +
      'solo se sirve si su exam_position es de TU oposición) y `buildQuestionTagFilter`. La ' +
      'tarjeta prometía preguntas que el test no da; lo cazó una usuaria premium (feedback ' +
      '8b788ee0): subalterno_gva T3 anunciaba 39 y servía 22. La rama de OFICIALES quedó cerrada ' +
      'en [T-507] (se descuenta en los 4 contadores); la del TAG sigue ABIERTA por decisión de ' +
      'producto y este script es donde se mira: 1.374 temas · 137.252 preguntas (03/08), con ' +
      'policia_nacional T21 anunciando 2.006 y sirviendo 222, y mecanico_conductor_estado ' +
      'sirviendo CERO en 8 temas que sí anuncian. No es la puerta: la puerta en CI es ' +
      '`__tests__/integration/topicCountVsServed.integration.test.ts`, que exige que la ' +
      'diferencia anunciado−servido sea EXACTAMENTE la del tag y nada más. ' +
      '⚠️ GOTCHA de medida: la condición del tag tiene que ser NULL-safe (`NOT (tags @> …)` es ' +
      'NULL con tags NULL) — sin eso PN T21 parecía servir 608 en vez de 222.',
  },
  push_guard_menciones: {
    titulo: 'Medir si «citar una tarea» sigue siendo distinguible de «trabajarla» (gate del push-guard)',
    ruta: 'scripts/backlog/sim-push-guard-menciones.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      '`npm run sim:push-guard-menciones [-- --ejemplos]`. Solo lectura (git log; ni BD ni red). ' +
      'Respalda la relajación de T-403: el guard dejó de exigir claim por un `T-NNN` que solo ' +
      'sale en el CUERPO de un commit cuyo ASUNTO ya declara otra tarea. Recorre el historial ' +
      'con la función REAL (`clasificarMenciones`, sin copia) y estima cuántas de esas citas ' +
      'eran trabajo, contando que el commit toque un fichero DISTINTIVO de la tarea citada ' +
      '(declarado por <=2 tareas: sin ese filtro `scripts/backlog.cjs` o `alert-rules.ts` hacen ' +
      'culpable a cualquiera — 158 casos crudos frente a 69). Medido 31/07: banda relajada ' +
      '2,8 % (217 commits/323 citas) y banda de control —asunto mudo, que SIGUE bloqueando— ' +
      '17,2 %, o sea que la regla literal de la ficha («el cuerpo nunca bloquea») habría abierto ' +
      'ese 17 %. Es GATE, no informe: si el repo empieza a declarar trabajo solo en el cuerpo, ' +
      'la relajación deja de ser segura y nadie se enteraría. Techo 6 %, exit 1 al pasarlo.',
  },
  flota_arrancar_trabajador: {
    titulo: 'Convertir una máquina Linux pelada en un TRABAJADOR de la flota, sincronizado con las sesiones del portátil',
    ruta: 'scripts/flota/arrancar-trabajador.sh',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`./arrancar-trabajador.sh <nombre>` EN EL VPS, idempotente. Las sesiones se reparten el ' +
      'trabajo por BASE DE DATOS (claim con lease, latido, embudo, entregas), así que una sesión ' +
      'en un servidor participa del MISMO reparto sin sincronizar nada — pero solo si arranca bien ' +
      'puesta. Exige las DOS credenciales que no puede inventarse: `CLAUDE_CODE_OAUTH_TOKEN` ' +
      '(`claude setup-token` en una máquina con navegador; NO se copia `.credentials.json`, ese ' +
      'camino no está soportado y caduca en silencio) y `VENCE_COORDINACION_URL` (el rol de 4 ' +
      'tablas, NUNCA el `.env.local` del portátil, que es la credencial de la APLICACIÓN y abre ' +
      'usuarios y pagos). Declara `VENCE_SESSION_ROLE=trabajador` y `VENCE_SESSION_HOME` desde el ' +
      'ARRANQUE —si se las pusiera la sesión no serían garantía— y **termina con el preflight como ' +
      'GATE: si no puede latir, no arranca nada**, porque un trabajador invisible reclamaría tareas ' +
      'que nadie ve. La credencial se persiste en `/etc/vence-flota/<slug>.env` (0600) y la lee una ' +
      'unidad **systemd**, que es lo que hace que el token se pida UNA vez y que la flota se levante ' +
      'sola tras un reinicio; dentro arranca **tmux** para que la sesión siga siendo atachable y se ' +
      'pueda hablar con ella. Los dos, no uno: tmux solo no sobrevive a un reinicio, y una flota que ' +
      'hay que rearrancar a mano no es una flota. GOTCHA de la documentación: **`--bare` NO lee ' +
      '`CLAUDE_CODE_OAUTH_TOKEN`**, así que se arranca `claude` normal aunque bare sea lo que ' +
      'recomiendan para CI. La cuenta la decide `lib/flota/cuentas.cjs`.',
  },
  credencial_lectura_negocio: {
    titulo: '¿CON QUÉ credencial leo una tabla de negocio? (punto único, T-624)',
    ruta: 'lib/db/negocioSoloLectura.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      'Responde CON QUÉ url; `lib/db/pgSsl.cjs` → `pgConfig(url)` responde CÓMO conectar con ella ' +
      '(el gotcha del `sslmode` que pisa la opción `ssl`). Se COMPONEN: ' +
      '`new Client(pgConfig(urlLecturaNegocio()))`. Preferencia de MENOR a mayor privilegio, ' +
      'mirando entorno y `.env.local` para cada una: `VENCE_LECTOR_URL` (negocio, T-486) antes que ' +
      '`DATABASE_URL` (coordinación, que desde T-539 solo alcanza las 4 tablas de la flota y da ' +
      '«permission denied» contra negocio). Nace de medir CUATRO copias del mismo ' +
      '`VENCE_LECTOR_URL || DATABASE_URL` el 06/08/2026, ninguna de las cuales —salvo una— miraba el ' +
      'fichero, así que un trabajador con la credencial en `.env.local` se quedaba fuera. Núcleo ' +
      'PURO e inyectable (`resolver(env, envFile)`): la primera versión se probaba contra el ' +
      '`.env.local` REAL y su test pasaba en el portátil donde se escribió y fallaba en cualquier ' +
      'otro worktree. Trinquete: `__tests__/guardrails/credencialLectura.guardrail.test.ts` rechaza ' +
      'una quinta copia (prohíbe ELEGIR dos veces, no mencionar las variables: los avisos y ' +
      'comentarios deben poder nombrarlas).',
  },

  canary_rol_lector: {
    titulo: 'El rol de LECTURA de la flota: que lea lo que el trabajo necesita y NADA que identifique a una persona',
    ruta: 'scripts/canary-rol-lector.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`VENCE_LECTOR_URL=… npm run canary:rol-lector`. Nace de la PRIMERA tarea real de la flota ' +
      '(T-476): tres de las cuatro alertas no se pudieron triar porque el rol de coordinación solo ' +
      'escribe — y casi todo el trabajo apto (barridos, auditorías de scope, generación, ' +
      'adjudicaciones) es LEER y proponer. La línea: **se deniega el identificador directo** ' +
      '(correo, nombre, teléfono, IP, pago, tokens) y **se permite la actividad por `user_id`**, ' +
      'que es un UUID — hace falta para diagnosticar y no dice quién es nadie. Comprueba las DOS ' +
      'mitades y una tercera que un canario flojo pasaría por alto: que un rol llamado «lector» ' +
      'NO pueda escribir. La migración NO usa `ALTER DEFAULT PRIVILEGES` a propósito: una tabla ' +
      'nueva no queda legible sola, cuesta un grant explícito y a cambio nada se expone por nacer. ' +
      '**Falso verde arreglado en [T-574]:** `SELECT … LIMIT 1` con RLS activo y CERO políticas no ' +
      'lanza error — filtra en silencio a 0 filas, indistinguible de una tabla vacía. `DEBE_LEER` ' +
      'se comprueba ahora también contra el catálogo (`pg_class`+`pg_policies`, núcleo puro ' +
      '`lib/db/rlsSelectBlocked.cjs`), y así se cazó que `test_questions` estaba en ese estado ' +
      '(dio 19/19 en verde durante semanas). Sigue en 18/19 hasta que [T-573] le añada su política ' +
      '— el rojo es correcto, no una regresión de este canario. Añade además una sección ' +
      'informativa con el recuento TOTAL de tablas RLS-sin-política (85 medidas el 05/08), la ' +
      'mayoría bloqueadas a propósito (PII/operativas) y fuera del veredicto.',
  },
  flota_gobierno: {
    titulo: 'Gobernar la flota desde el portátil: quién vive, qué hace, darle trabajo — sin entrar en ningún servidor',
    ruta: 'scripts/flota/flota.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`npm run flota` (estado) · `-- encargar <w> [--tarea T-nnn]` · `-- arrancar|parar <w>`. ' +
      'No duplica nada: quién vive sale del latido, qué hace del claim, qué pregunta del embudo ' +
      '(T-493) y qué entrega de la quinta espera (T-539). Lo único propio es el cruce con lo ' +
      'ESPERADO (`lib/flota/maquinas.cjs`), que es lo que permite decir «falta w2» en vez de ' +
      'enseñar solo lo que hay — un panel que solo pinta lo que existe no puede avisar de una ' +
      'caída. **Y sonda la AUTENTICACIÓN**, que es el punto ciego del latido: éste es node ' +
      'hablando con Postgres y funciona igual con la sesión atascada en la pantalla de login. ' +
      'Medido en el primer arranque real (05/08): dos trabajadores 🟢, latiendo, preflight verde y ' +
      'NINGUNO autenticado. El encargo se manda por tmux y sale de `lib/flota/encargo.cjs`, que ' +
      'también descarta las tareas no aptas (impugnaciones, cobros, deploys, nada que hable con ' +
      'usuarios) — aunque lo que de verdad protege es la credencial, no el texto. **Antes de cada ' +
      'encargo pone su clon al día y comprueba que no esté ya trabajando** (ver `flota_clon_al_dia`).',
  },
  flota_rescate: {
    titulo: 'Sacar de la máquina de un trabajador el trabajo que solo existe ahí (y empujarlo aunque él no pueda)',
    ruta: 'lib/flota/rescate.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`npm run flota -- rescatar [w]`. La orden es puramente ADITIVA (nunca `reset`, `clean`, ' +
      '`stash` ni push forzado) y mira TODAS las ramas, no `HEAD`: un trabajador entrega en una ' +
      'rama por tarea y luego vuelve a `main`, así que lo entregado nunca es `HEAD` — mirar ahí ' +
      'daba «nada que salvar» con 22 commits atrapados (05/08). La ref de destino lleva el sha ' +
      'dentro, así que rescatar dos veces escribe la MISMA ref: idempotente sin comprobar nada. ' +
      '**SEGUNDA FASE (T-628):** en el VPS el push del propio rescate falla SIEMPRE —los ' +
      'trabajadores no tienen credenciales de git— así que el trabajo quedaba identificado y ' +
      'quieto (medido el 06/08: 11 ramas atrapadas, una con un bug de producción, y 6 tareas que ' +
      'el panel presentaba como «esperando tu decisión» cuando solo esperaban esto). Ahora el ' +
      'rescate emite `ORIGEN=<rama>|<destino>` y el PORTÁTIL —único sitio con SSH a la máquina Y ' +
      'credenciales del repo— se trae las refs y las empuja **con el nombre que ya calculó el ' +
      'rescate**: recalcularlo allí sería un segundo generador del mismo nombre. ' +
      '⚠️ **No se ejecuta contra trabajadores EN MARCHA**: el rescate commitea el árbol sucio, así ' +
      'que a mitad de tarea le commitearía el trabajo a medias. Prueba: `npm run sim:rescate-flota` ' +
      '(repos git desechables) + `__tests__/flota/rescateSegundaFase.test.ts` para la decisión.',
  },

  flota_clon_al_dia: {
    titulo: 'El clon de un trabajador, al día ANTES de cada encargo — si no se puede, no se le da trabajo',
    ruta: 'lib/flota/actualizacion.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      'Un clon viejo no es «una versión anterior»: trae **los guardarraíles de su fecha**, que son ' +
      'lo único que hace segura a la flota. Medido el 05/08 — `w1` llevaba **30 commits de retraso**, ' +
      'así que no tenía el canario con el que habría comprobado su propio permiso ni el comando ' +
      '`revision` que su situación pedía, y se quedó una hora parado preguntando algo que su propio ' +
      'repo ya sabía responder. Falla CERRADO ([T-539]): si no se puede comprobar, no se encarga. ' +
      'Y **nunca a la brava** — un árbol sucio o con commits sin empujar puede ser el único rastro ' +
      'de un trabajo ([T-431]): se rehúsa y se dice qué hay; tirarlo lo decide una persona. ' +
      'GOTCHA que costó el primer intento: la sonda hay que citarla en comillas SIMPLES — con ' +
      '`JSON.stringify` el shell de fuera expande los `$(…)` antes de tiempo y la sonda acaba ' +
      'describiendo otro repo. Prueba: `npm run sim:clon-al-dia` (13 casos con repos git reales, ' +
      'incluido ese citado). Evento `flota_clon_desactualizado` + regla `RULE_FLOTA_CLON`.',
  },
  aprobacion_envios: {
    titulo: 'Lo que sale HACIA UNA PERSONA lo aprueba una persona — la puerta que impide que un trabajador envíe correos',
    ruta: 'lib/sessions/aprobacion.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      'Regla de Manuel (05/08), no negociable: «siempre tengo que aprobar lo que se envía, porque ' +
      'ahí se detectan fallos y los usuarios necesitan que haya personas detrás, no la IA». Lo que ' +
      'HOY lo impide de verdad es el PERMISO —un trabajador no tiene `.env.local`, ni credenciales ' +
      'AWS (no saca `AUTH_SECRET` de SSM), ni clave de correo, y su rol de lectura no ve la ' +
      'dirección de nadie: medido, cero variables sensibles en su entorno—, pero eso es un ' +
      'accidente del aprovisionamiento. Por eso el criterio vive AQUÍ (`puedeEnviar` puro + ' +
      '`exigirPersona`) y los **cuatro** scripts que entregan a una persona (impugnaciones, ' +
      'feedback, dos newsletters) lo invocan al empezar y salen con código 4. **Un rol sin ' +
      'declarar cuenta como trabajador.** La salida obligatoria es `backlog.cjs borrador`, que ' +
      'deja el texto en el MISMO embudo (`session_questions.kind`) y lo saca el primero en ' +
      '`npm run flota` — un bloqueo sin salida se rodea ([T-375]). Guardarraíl: ' +
      '`aprobacionEnvios.guardrail.test.ts` (27) exige que ningún script de envío se quede sin la ' +
      'puerta, que es como se pierden las protecciones: añadiendo un quinto que no la tiene.',
  },
  borradores_sin_duplicar: {
    titulo: 'Un borrador por destinatario: la flota re-analizaba el mismo caso y dejaba dos',
    ruta: 'lib/backlog/borradores.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      'El claim de la cola de impugnaciones protege el trabajo SIMULTÁNEO; no protegía el YA HECHO. ' +
      'Al terminar, el trabajador SUELTA la fila (hace bien: no puede cerrarla) y vuelve al pool, ' +
      'así que el siguiente la re-analiza desde cero. Medido al estrenarlo: de los diez primeros ' +
      'borradores, **tres pares duplicados**. El coste no es la cuota gastada dos veces — es que ' +
      'Manuel tenga que decidir cuál de los dos mandar, justo el trabajo que la flota venía a ' +
      'ahorrarle. Empareja **por identificador, no por texto** (cada trabajador redacta el ' +
      'destinatario con su prosa); **sin id NO deduplica** a propósito, porque dos destinatarios ' +
      'sin identificador pueden ser legítimamente distintos. Escape: `--igualmente`. 11 tests.',
  },
  flota_salud_panel: {
    titulo: 'La salud de la FLOTA en el panel donde se mira la del resto del sistema',
    ruta: 'lib/flota/salud.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/health-check.md',
    notas:
      'Tarjeta 🤖 en `/admin/salud-sistema`, alimentada desde el MISMO endpoint que el resto ' +
      '(`/api/admin/system-health`) y con su mismo `run` resiliente: si la flota no se puede leer, ' +
      'ese indicador queda `unknown` y el panel sigue en pie. Nace porque sus señales ya llegaban ' +
      '**por el catch-all**, que es la red de seguridad y no una vista — servía para que nada ' +
      'quedara oculto, no para responder «¿está la flota bien?», y eso obligaba a abrir una ' +
      'terminal. **Va la PRIMERA del grid** porque una flota parada NO SE NOTA: sigue en el ' +
      'registro, nadie recibe una queja y puede estar así horas. Rojo = todos sin señal, o ≥5 ' +
      'turnos muertos en 3 h (eso ya no es azar); ámbar = cola de revisión, borradores esperando ' +
      'OK, o faltan trabajadores. **Lo que NO finge:** el panel no entra en las máquinas, así que ' +
      'no dice si un proceso vive — eso lo sabe `npm run flota` mirando el tmux.',
  },
  flota_turno: {
    titulo: 'El TURNO de un trabajador, visible: qué se le encargó y si murió con la tarea cogida',
    ruta: 'scripts/flota/flota.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      'Evento `flota_turno` (`fase` = encargado | muerto). Se observaba el ANDAMIAJE de las ' +
      'sesiones (preflight, fricción, clon al día) pero **no el trabajo**: un `claude -p` nacía y ' +
      'moría dentro de un fichero de log en su máquina, sin cruzar a ninguna parte — no había cómo ' +
      'responder «¿cuánto tarda un turno?» ni «¿cuántos mueren a medias?» sin entrar por SSH. Un ' +
      'turno que muere CON LA TAREA COGIDA la deja reclamada por nadie y bloqueada para el resto; ' +
      'el vigía los relanza, pero **cinco en tres horas apuntan a una causa común** (cuota, un ' +
      'guardarraíl que no pueden satisfacer) y eso solo se ve con la serie → ' +
      '`RULE_FLOTA_TURNOS_MUERTOS`. **El rastro lo deja la PUERTA de envío, no cada llamador**: al ' +
      'ponerlo se emitía desde cada sitio y se olvidó en `repartir`, así que la serie nacía ' +
      'incompleta el primer día; lo exige un guardarraíl.',
  },
  flota_productividad: {
    titulo: '¿La flota produce, y a qué coste para Manuel? — el criterio de fracaso declarado del piloto',
    ruta: 'lib/sessions/productividad.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`npm run flota -- productividad [--dias 7]`. La ficha del piloto declaró ANTES de empezar ' +
      'cómo se sabría si salía bien; de sus tres criterios solo uno tenía comando (`sesiones:friccion`, ' +
      'que se REMITE, no se copia). **DOS HALLAZGOS al estrenarlo (05/08):** (1) «tareas cerradas por ' +
      'trabajador» sale **0 por construcción** —un trabajador no cierra, ENTREGA; cerrar exige ' +
      'verificar y eso es de una persona ([T-539])—, así que la métrica declarada era ciega y la ' +
      'producción real de la flota son sus entregas y su tasa de aceptación; (2) medido en vivo: ' +
      '162 cerradas en 7 días, TODAS por personas, con 9 entregas de la flota en cola. El semáforo ' +
      'mira la COLA DE REVISIÓN, no la producción, porque ése era el criterio de fracaso: producir ' +
      'más a costa del tiempo de Manuel es perder. Usa MEDIANA (una entrega olvidada desplaza la ' +
      'media y esconde el resto) y **dice «no medido» en vez de rellenar** (`worked_seconds` solo ' +
      'existe desde [T-414]). Evento `flota_productividad` + `RULE_FLOTA_PRODUCTIVIDAD`, y **serie duradera** en la tabla `flota_productividad_historico` — el bus NO sirve como historia y se comprobó antes de decidirlo (10,8 M de filas y solo 32 días: se poda). Guarda las ENTRADAS del cálculo, no solo el veredicto, para poder re-juzgar la historia si se recalibran los umbrales; y compara con la medida anterior métrica a métrica con ±10 % tratado como ruido. 30 tests. **Y da PREVISIÓN** (`--ventana <h>`), con dos trampas esquivadas a propósito: (a) el ritmo NO sale de `worked_seconds`, que mide tiempo con la tarea COGIDA y no esfuerzo —hay entregas de «22 h» que son una tarea reclamada de un turno a otro—, sino de **entregas por hora de reloj**, que ya incluye paradas y reintentos; (b) si se revisa más despacio de lo que se entrega, **la previsión la manda la REVISIÓN** y añadir trabajadores no acorta nada, solo alarga la cola. Con menos de 3 entregas medidas se niega a dar un número.',
  },
  flota_cuentas: {
    titulo: 'De qué CUENTA de Claude Code tira cada trabajador de la flota (registro multi-cuenta)',
    ruta: 'lib/flota/cuentas.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      'Misma forma que el registro multi-cuenta de Stripe (`lib/stripe.ts` → `ACCOUNT_ENV`), a ' +
      'propósito: **añadir una cuenta = UNA fila + su variable de entorno**, sin tocar la lógica de ' +
      'ningún consumidor. La cuenta por defecto lee la variable histórica sin sufijo. El reparto es ' +
      'DETERMINISTA por nombre y no rotatorio: `w1` cae siempre en la misma cuenta reinicie las ' +
      'veces que reinicie — con rotación, el consumo por cuenta dejaría de ser comparable consigo ' +
      'mismo y, si una topa su límite, no se podría saber a quién le pasó ni reproducirlo. Lo ' +
      'explícito (`--cuenta`) manda, pero un nombre que no existe FALLA en vez de caer al reparto ' +
      'en silencio. Una cuenta sin token NO existe: declararla no la crea. 15 tests.',
  },
  backlog_espera_revision: {
    titulo: 'La QUINTA espera del backlog: «hecho, con entregable, esperando que una persona lo revise»',
    ruta: 'lib/backlog/revision.cjs',
    estado: 'vivo',
    escribe: ['backlog_tasks'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      '`backlog.cjs revision <id> --entrega "…"`. Suelta el claim (entregar es soltarla), sale ' +
      'bajo 🙋 en `list` y en `npm run parte` con desde cuándo espera y quién la dejó, `claim` la ' +
      'rechaza salvo `--force --motivo`, y NO se despierta sola: la despierta `wake`. La entrega ' +
      'es obligatoria (≥20 caracteres) y lo hace cumplir un CHECK de la tabla, no solo el CLI. ' +
      'Antes se DEDUCÍA de la prosa de `resume_check` con cinco expresiones regulares; la 1ª ' +
      'vuelta del piloto de flota lo desmintió — el trabajador no tenía comando con el que decirlo ' +
      'y acabó en `pause --hasta` con una fecha inventada. Mismo patrón que `snooze_until` y ' +
      '`due_at`: una condición en prosa no es una condición. La comprobación va en el MISMO UPDATE ' +
      'atómico del claim (guardarraíl `esperaRevision.guardrail`), porque tenerla solo en ' +
      '`claimGate` dejaba pasar la tarea igual — lo destapó `npm run sim:espera-revision` (17 casos ' +
      'contra la BD real), no los 19 tests unitarios.',
  },
  backlog_archivado: {
    titulo: 'El último escalón del ciclo de una tarea: `done` ≠ archivada (verificación en producción)',
    ruta: 'lib/backlog/archivo.cjs',
    estado: 'vivo',
    escribe: ['backlog_tasks'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      'Fase 2/3 de [T-392]. La Fase 1 (`done_verificacion`) ya impide cerrar una tarea cuyo ' +
      'código servido no está desplegado; esto cubre la otra mitad del encargo de Manuel tras ' +
      'cerrar [T-363] con cobros en main sin desplegar y sin que nadie lo mirase — *"cuando está ' +
      'verificada [en producción] y todo correcto, ponerle estado archivado"*. `backlog.cjs done` ' +
      'reutiliza el MISMO análisis de superficie servida de la Fase 1 (sin recalcularlo) para ' +
      'decidir, en el momento de cerrar: si no toca nada servido, se ARCHIVA SOLA (regla 1: sin ' +
      'superficie servida no hay nada que ver funcionar en producción); si sí toca, queda ' +
      '`requiere_archivo=true` y hace falta `backlog.cjs archive <id> --evidencia "…"` —evidencia ' +
      'obligatoria, ≥20 caracteres y sin vocabulario vacío ("ok"/"listo"/"funciona"), mismo criterio ' +
      'que `backlog_espera_revision`—. El cubo de cerradas-sin-archivar sale en `list` (🗄, con aviso ' +
      'a partir de 3 días) para no repetir el error de dejarlo invisible (regla 3 de la ficha). ' +
      'DELIBERADAMENTE no son estados nuevos de `status` (la ficha original los dibujaba como ' +
      '`verificando`/`archivada`): decenas de `WHERE status IN (...)` a lo largo de `backlog.cjs` ' +
      'asumen que `done` es terminal, y el ciclo real ya vivía repartido en otras columnas — esto ' +
      'es aditivo sobre `done`, no un `status` más ancho. **Migración `supabase/migrations/' +
      '20260805_backlog_archivado.sql` pendiente de aplicar** (05/08): el rol `vence_coordinacion` ' +
      'que usan claim/heartbeat/done tiene DML pero NO es owner de `backlog_tasks` (dueño: ' +
      '`venceadmin`), así que un trabajador de la flota no puede correr el ALTER TABLE — necesita ' +
      'una persona. Por eso TODO lector/escritor de las columnas nuevas es fail-open ante "columna ' +
      'no existe" (42703): con la migración sin aplicar, `done`/`list`/`archive` funcionan EXACTO ' +
      'igual que antes, sin el escalón nuevo — se activa solo en cuanto alguien corra el `.sql`. ' +
      '23 tests en `lib/backlog/archivo.cjs`.',
  },
  backlog_archivado_migracion: {
    titulo: 'Backfill de las ~350 tareas `done` anteriores al ciclo de archivado (T-392 F3)',
    ruta: 'scripts/backlog/migrar-archivado-t392.cjs',
    estado: 'historico',
    escribe: ['backlog_tasks'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      'Un solo uso: marca `archived_at`/`archive_evidence` de todo lo `done` de antes SIN ' +
      're-verificar (la propia ficha [T-392] lo pide así — repasar 350 cierres contra producción ' +
      'no es el trabajo, y bloquearía el estreno del ciclo). `requiere_archivo` queda en NULL a ' +
      'propósito (no `false`): no se AFIRMA que no tocaran superficie servida, solo que no entran ' +
      'en el cubo retroactivamente. **Bloqueado el 05/08 hasta que se aplique la migración de ' +
      'esquema** (ver `backlog_archivado`) — dry-run por defecto, `--apply` para escribir.',
  },
  canary_rol_coordinacion: {
    titulo: 'El rol de BD de la flota, ejercitado: que SÍ puede coordinarse y que NO puede leer negocio',
    ruta: 'scripts/canary-rol-coordinacion.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`VENCE_COORDINACION_URL=… npm run canary:rol-coordinacion`. Un GRANT es una afirmación ' +
      'sobre PRODUCCIÓN y la mitad que importa NO se puede leer en el `.sql`: que el rol no pueda ' +
      'leer negocio. Los privilegios se acumulan por vías que no están en ese fichero, así que ' +
      'aquí se INTENTA leer `user_profiles`, `questions`, `test_sessions` y `observable_events` ' +
      '(que necesita INSERT y NO debe poder leerse: cientos de miles de filas con `user_id`) y se ' +
      'exige que el motor lo rechace con 42501. La otra mitad ejercita lo que un trabajador SÍ ' +
      'necesita: latir, reclamar, preguntar y dejar rastro. Escribe solo filas `CANARY-…` y las ' +
      'borra con la credencial ADMIN, porque el rol de coordinación no tiene DELETE — que es ' +
      'justo lo que se quiere. Sin credencial dice «no puedo mirar», NO se da un verde. ' +
      'Migración: `supabase/migrations/20260804_rol_coordinacion_flota.sql`.',
  },
  sesion_preflight: {
    titulo: '¿Esta sesión está COMPLETA para trabajar? (y un trabajador autónomo no puede trabajar si no)',
    ruta: 'scripts/sessions/preflight.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`npm run sesion:preflight`. Comprueba identidad, BD de coordinación y que el latido se ' +
      'ESCRIBE de verdad (lo mira en `worktree_sessions`; NO lo escribe él — el escritor único ' +
      'sigue siendo `latir.cjs`). Existe porque todo el andamiaje hace fail-open al faltarle la ' +
      'BD, que es correcto para una PERSONA (no se le para el trabajo a quien está delante por ' +
      'una avería de telemetría) y es lo contrario de lo que hace falta en un TRABAJADOR ' +
      'autónomo: trabajar sin supervisión y sin dejar rastro. Con `VENCE_SESSION_ROLE=trabajador` ' +
      'la misma ceguera pasa a BLOQUEAR, y ese criterio vive en UN sitio ' +
      '(`lib/sessions/preflight.cjs` → `cegueraBloquea`) compartido por el push-guard y el guard ' +
      'del índice. El rol es identidad y vive con el sid. Medido el 04/08 en un clon sin ' +
      '`.env.local` —la condición NORMAL de un worktree de agente— : sesión invisible para el ' +
      'reparto y tres protecciones apagadas sin que nada lo dijera. Capas: 20 tests + ' +
      '`npm run sim:preflight-trabajador` (ejecuta los binarios reales y mira EXIT CODES, que es ' +
      'lo que git obedece; provoca la ceguera con una URL inalcanzable, no quitando ficheros). ' +
      'Comprueba TAMBIÉN la ubicación: con `VENCE_SESSION_HOME` declarado por el lanzador, detecta ' +
      'que el proceso está trabajando en el árbol de OTRA sesión — donde adopta su `.session-id` y ' +
      'se vuelve indistinguible de ella, porque sid, latido y huella se derivan todos del ' +
      'directorio. Es el único ancla que sobrevive a un cambio de cwd.',
  },
  indice_compartido: {
    titulo: 'Impedir que dos sesiones compartan el índice de git (pre-commit)',
    ruta: 'scripts/check-indice-compartido.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      'Lo invoca `.husky/pre-commit`. Para el commit si OTRA sesión viva trabaja en tu mismo ' +
      'directorio. La causa no es descuido: `git add` escribe en el índice del REPOSITORIO, así ' +
      'que el add de una sesión y el commit de otra son la misma cola y git no puede saber quién ' +
      'puso qué — el dato de «quién» NO EXISTE, y por eso ningún guardarraíl de contenido lo ' +
      'arregla. El 31/07 el trabajo de una sesión acabó en main bajo el mensaje de otra. Este SÍ ' +
      'bloquea (a diferencia de los tres que se quitaron ese día en T-375) porque se satisface ' +
      'con un comando —`scripts/worktrees/crear-worktree.sh`— y la alternativa es irreversible. ' +
      'Una SOLA sesión en el checkout principal no dispara nada: el problema es la concurrencia, ' +
      'no el sitio. Fail-open total; escape `INDICE_COMPARTIDO_OK="motivo"` — desde T-496 pide un ' +
      'MOTIVO, porque el `=1` se había vuelto un prefijo (6 de 10 escapes sin bloqueo previo). ' +
      'Y desde T-486 NO bloquea el commit PARCIAL (`git commit -m … -- <rutas>`): git le da un ' +
      'índice temporal propio (`next-index-<pid>`, vía `GIT_INDEX_FILE`), así que lo que otra ' +
      'sesión tenga preparado no puede colarse. El corte es estrecho a propósito — `git commit -a` ' +
      'también trae un índice distinto (`index.lock`) y SÍ arrastra lo ajeno, medido. Salió de que ' +
      '2 de los 3 escapes con motivo escrito ya resolvían así el problema, apagando el guard para ' +
      'hacer justo lo correcto. Núcleo `lib/sessions/indiceCompartido.cjs`, 41 tests + ' +
      '`npm run sim:indice-parcial` (repos git reales: compara el veredicto con lo que git mete ' +
      'de verdad en el commit, y reproduce el fallo de T-415).',
  },
  backlog_esfuerzo: {
    titulo: 'Esfuerzo declarado en cajones + tiempo REAL medido por tarea',
    ruta: 'lib/backlog/esfuerzo.cjs',
    estado: 'vivo',
    escribe: ['backlog_tasks'],
    runbook: 'docs/runbooks/tareas-pendientes.md',
    notas:
      '`backlog.cjs reserve "…" --esfuerzo minutos|rato|larga|sesion_propia` (ABORTA sin él) y ' +
      '`backlog.cjs esfuerzo <id> <cajón>`. En cajones y NO en horas: una estimación en horas se ' +
      'vuelve ficción y envejece sola. `list`/`next` ordenan por prioridad y, a igualdad, por lo ' +
      'más corto, con lo NO declarado al final. El tiempo se acumula solo (`worked_seconds`, por ' +
      'tramos con la tarea reclamada — NO closed_at-created_at, que mide espera) y `done` canta ' +
      'el contraste. Antes había CERO tareas con duración medible porque cerrar ponía ' +
      'claimed_at=NULL: sin poder desmentirla, una estimación se rellena a ojo y muere. En ' +
      '`reap` NO se acumula, a propósito (sesiones muertas con claimed_at de hace días). 17 tests.',
  },
  cola_reserva: {
    titulo: 'La reserva de la cola caduca cuando muere su sesión, no por reloj',
    ruta: 'lib/impugnaciones/reserva.cjs',
    estado: 'vivo',
    escribe: ['user_feedback', 'question_disputes', 'psychometric_question_disputes'],
    runbook: 'docs/maintenance/impugnaciones-claude-code.md',
    notas:
      'Criterio ÚNICO que usan `cola.cjs` y los dos `revisar-*.cjs`. Con un reloj fijo no hay ' +
      'número bueno: corto traiciona a la sesión VIVA que lleva horas con un caso difícil (dos ' +
      'sesiones acabaron en el mismo feedback el 31/07), largo deja el caso bloqueado si se apaga ' +
      'el ordenador. Ahora la reserva caduca cuando su sesión deja de LATIR, con dos frenos: un ' +
      'suelo de 2 h por debajo del cual no se toca (el peor caso sigue siendo el de antes) y no ' +
      'inventar veredicto si el dueño no publica latido. Los comandos de revisión LATEN al abrir ' +
      'un caso: trabajar ES la señal. Hay versión SQL además de JS porque la decisión tiene que ' +
      'ir DENTRO del UPDATE atómico; su paridad está testeada. 12 tests.',
  },
  cola_puerta_cierre: {
    titulo: 'Exigir tener el caso RESERVADO para poder cerrarlo (la reserva deja de ser decorativa)',
    ruta: 'lib/impugnaciones/puertaCierre.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/maintenance/impugnaciones-claude-code.md',
    notas:
      'La cola tenía reserva atómica y NADA que la exigiera: `cerrar.ts` y `cerrar-feedback.ts` ' +
      '—los dos comandos que mandan el email y conceden el euro— no miraban `claimed_by` ni una ' +
      'vez. Medido el 01/08/2026 sobre RDS: de 165 impugnaciones cerradas en 14 días, 28 (17 %) ' +
      'no habían pasado nunca por reserva; de 111 feedbacks, 58 (52 %). Y en simulación con seis ' +
      'sesiones concurrentes el claim aguanta (1 ganador de 6) pero la que PERDÍA cerraba la fila ' +
      'igualmente: la reserva protegía el reparto, no el acto de responder. Es el principio 8 del ' +
      'runbook de sesiones paralelas (impedir en el punto de ESCRITURA), que el backlog ya aplica ' +
      'con su pre-push. BLOQUEA TAMBIÉN el cierre «sin reservar», no solo el ajeno: bloquear solo ' +
      'lo ajeno llega tarde (la otra sesión ya gastó el análisis), y lo que CREA la colisión es ' +
      'trabajar sin reservar, porque entonces la cola le ofrece ese mismo caso a las demás. ' +
      'Satisfacible con un comando (`cola.cjs claim <id>`) y quien sigue el manual nunca ve la ' +
      'puerta: `revisar-impugnacion.cjs` ya reserva al abrir el dossier. Escape declarado ' +
      '`--igualmente "<motivo>"`, contado como `guard_escape` del guard `cierre-cola` en el bus de ' +
      'fricción. FAIL-OPEN sin sid y sin BD. IO compartido por los dos cierres en ' +
      'scripts/impugnaciones/lib/comprobar-reserva.ts. ' +
      '**⚠️ Desde T-609 (06/08) el escape NO cubre el caso «ajena» (claim VIVO de otra sesión).** ' +
      'Hasta entonces `--igualmente` se comprobaba ANTES que nada, así que un motivo cualquiera ' +
      'se saltaba TAMBIÉN el claim vivo — no solo «nadie la tiene». Medido: 4 cierres seguidos ' +
      'usaron el escape contra una reserva viva y mandaron 3 correos con un texto ya vetado por ' +
      'Manuel (ver embudo_puerta_veto, el mismo incidente). Ahora «ajena» se comprueba PRIMERO y no ' +
      'admite escape — un claim vivo se resuelve hablando con la otra sesión, no saltándolo (mismo ' +
      'criterio que el push-guard del backlog, T-375). El escape sigue vivo para «sin_reservar» ' +
      '(nadie la tiene, o la tenía una sesión ya muerta), donde no hay nadie a quien pisar. ' +
      '14 tests + trinquete de criterio único.',
  },
  deploy_estado: {
    titulo: '¿Hay alguien desplegando AHORA? (sin competir por el lock)',
    ruta: 'scripts/deploy-estado.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/runbooks/pusheo-revision-despliegue.md',
    notas:
      '`npm run deploy:estado` (también sale al final de `npm run deploy:pendiente`). La COLA de ' +
      'deploys ya existía y funciona —el `flock` de /tmp/vence-deploy.lock serializa a todas las ' +
      'sesiones—, pero era INVISIBLE: la única forma de saber que otra sesión desplegaba era ' +
      'lanzar el deploy y quedarse bloqueado hasta 45 min, así que varias sesiones proponían ' +
      'desplegar a la vez sin poder verse. Cruza TRES fuentes en vez de creerse una: la tabla ' +
      '`deploy_runs` (lo que alguien declaró al empezar), el PROCESO del lanzador (la verdad, ' +
      'pero solo desde el mismo host) y un sondeo NO BLOQUEANTE del propio flock. Cuando ' +
      'discrepan lo dice —una fila abierta de un deploy que murió NO es "ocupado", que es la ' +
      'lección de los claims zombi que hubo que segar con `backlog.cjs reap`—. Salidas: 0 libre, ' +
      '3 ocupado, 4 dudoso. Núcleo puro `lib/deploy/estado.cjs` (15 tests). Lo escriben los ' +
      'propios `deploy-*.sh` vía `scripts/deploy-marcar.cjs`, best-effort y con `trap`, así que ' +
      'un build que aborta no deja la fila abierta y la telemetría nunca puede tumbar un deploy.',
  },
  revision_entre_trabajadores: {
    titulo: 'La flota se revisa a sí misma: el escalón «entregada → revisada»',
    ruta: 'scripts/backlog.cjs',
    estado: 'vivo',
    escribe: ['backlog_tasks', 'review_verdict'],
    runbook: 'docs/runbooks/sistema-sesiones-paralelas.md',
    notas:
      '`backlog.cjs revisado <id> --veredicto ok|problemas --hallazgos "…"`. De los SEIS escalones ' +
      'del ciclo de una tarea, cinco avanzaban solos (el supervisor reparte, el trabajador ' +
      'entrega, el deploy despierta, el reloj suelta) y «entregada → revisada» esperaba a que ' +
      'ALGUIEN decidiera mirar: medido el 06/08, **23 entregas paradas, 15 h de media, la más ' +
      'vieja 41 h** — no una cola lenta, una cola SIN SALIDA. Lo mueve ahora otro trabajador con ' +
      '`ENC.encargoRevision`, que es un encargo DISTINTO a propósito: con el normal («haz esta ' +
      'tarea») el siguiente la REHARÍA desde cero, que es lo que pasó con las impugnaciones ' +
      '(cinco borradores del mismo caso). Tres reglas en la TABLA, no en la buena voluntad: ' +
      'veredicto cerrado (un «ok pero…» no contesta «¿se puede mergear?»), hallazgos con longitud ' +
      'mínima (un veredicto sin hallazgos es un sello) y **nadie revisa lo suyo**. NO delega el ' +
      'merge a `main`: al juntar ramas salen choques que ninguna ve por separado. Primeros seis ' +
      'veredictos: 3 ok y 3 problemas — uno destapó un FALSO VERDE en la ficha de [T-486] ' +
      '(«canarios 19/19» no probaba nada: RLS sin política devuelve 0 filas sin error).',
  },
  candado_deploy: {
    titulo: 'El candado de deploy que SÍ cruza máquinas (arriendo en deploy_runs)',
    ruta: 'scripts/deploy/candado.cjs',
    estado: 'vivo',
    escribe: ['deploy_runs', 'lease_until'],
    runbook: 'docs/runbooks/pusheo-revision-despliegue.md',
    notas:
      '`adquirir|renovar|soltar|estado`. Cierra el hueco de [T-485]: la exclusión mutua la daba ' +
      '`flock` sobre /tmp/vence-deploy.lock, que es PER-MÁQUINA, así que dos deploys desde ' +
      'máquinas distintas NO se veían — y dos `update-service` solapados sobre el mismo servicio ' +
      'de ECS es el incidente del 24/07 ([T-075]). La detección ya existía (`veredicto()` de ' +
      '`lib/deploy/estado.cjs` clasifica el run de otro host como en_curso/sospechoso); lo que ' +
      'faltaba era que BLOQUEARA, y su propio comentario lo admitía: «un dudoso no bloquea a ' +
      'nadie». Es ARRIENDO, no lock: 10 min renovados mientras el deploy viva, así que un build ' +
      'de 40 min no lo pierde a mitad y un `kill -9` lo suelta solo. **Fail-CLOSED**, y ahí está ' +
      'la diferencia con `scripts/deploy-marcar.cjs`, que es telemetría y falla en abierto: si no ' +
      'puede comprobar la BD, sale 4 y no despliega. El `flock` se QUEDA como segunda puerta ' +
      'local. Núcleo puro `lib/deploy/candado.cjs`; la exclusión se demuestra ejecutándola con ' +
      '`npm run sim:candado-deploy` (dos adquisiciones reales, 8 casos) porque un test de texto ' +
      'habría dado verde también con el flock solo, que era justo el fallo.',
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

  // ── PIPELINE DE GENERACIÓN DE PREGUNTAS ────────────────────────────────────────────────────
  // Se registran los cinco pasos el 26/07/2026 porque `tools:buscar "batch generado"` devolvía
  // CERO herramientas: el pipeline más usado del repo era invisible para la pregunta "¿esto ya
  // existe?". El trinquete de `lifecycle_state` ya los CONTABA como escritores, pero contar no es
  // describir — quien no supiera que existen los habría reconstruido. Es el silo que T-130 vino a
  // cerrar, aquí en la pieza que más se toca. Van en ORDEN de uso; el manual es el mismo para los
  // cinco y explica los pasos 1 a 10.
  verificar_articulos_vs_boe: {
    titulo: 'Paso 1: comprobar que el texto de un artículo en BD coincide con el BOE VIGENTE antes de generar sobre él',
    ruta: 'scripts/verificar-articulos-vs-boe.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      'No escribe nada. `<law_slug> <BOE-ID> [<art>…]`; sin artículos verifica todos los activos ' +
      '(1 fetch por artículo, sé considerado). Es la ÚNICA capa que compara el `content` contra la ' +
      'fuente: los gates posteriores comparan la pregunta contra el `content`, así que un artículo ' +
      'desactualizado pasa entero el pipeline y se enseña Derecho derogado. Elige la versión por ' +
      '`fecha_vigencia` (los `<version>` del BOE NO vienen en orden) vía `lib/laws/boeBloqueVigente`. ' +
      'Avisa además de notas de vigencia diferida. Ordena natural, así que verifica también los ' +
      '`bis`/`ter`.',
  },
  simular_batch_preinsercion: {
    titulo: 'Paso 2: gate MECÁNICO de un borrador de preguntas ANTES de insertarlo en BD',
    ruta: 'scripts/simular-batch-preinsercion.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      'No escribe nada: lee el JSON del borrador y los artículos de RDS. Toda la lógica vive en el ' +
      'núcleo PURO `lib/generacion/simularBatch.js` (testeado). Existe para que un defecto que caza ' +
      'una regex no se descubra con las preguntas ya en BD. GOTCHA HISTÓRICO (26/07): trataba ' +
      '`NO_LITERAL` como AVISO mientras el gate de BD lo trata como defecto duro, así que daba ' +
      '"limpio para insertar" a lotes que el otro rechazaba — medido en el T204 de T-045: 5 de 14 ' +
      'preguntas reescritas EN BD en vez de en el borrador. Ya bloquea en PARIDAD. Hermano de ' +
      '`verificar_batch_generado`: si los dos discrepan, el simulador no sirve para nada. ' +
      'Con `--equilibrar` además REPARA la posición de la correcta (§2.2-ter) reescribiendo el ' +
      'borrador — ver `transponer_posicion_correcta`.',
  },
  audit_clave_inciso_anulado: {
    titulo: '¿La RESPUESTA CORRECTA de una pregunta viva reproduce un inciso anulado por el TC?',
    ruta: 'scripts/audit-clave-inciso-anulado.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/incisos-anulados-tc.md',
    notas:
      'No escribe nada (salvo `--emit`, que manda a `observable_events` el kind ' +
      '`question_clave_inciso_anulado`). Hermano de `audit-annulled-provisions`: aquel comprueba que el ' +
      'ARTÍCULO tenga nota de vigencia, este mira lo que de verdad duele — que la CLAVE enseñe como ' +
      'válido lo que el TC anuló, que es el incidente fundacional (art. 126.2 LBRL / STC 103/2013). ' +
      'Cruza `vigencia_notes.annulledFragments` (el inciso LITERAL del BOE) con la opción correcta: ' +
      'comparación de subcadenas, sin juez LLM. Núcleo puro `lib/laws/claveConIncisoAnulado.js` (12 tests). ' +
      'BANDAS calibradas sobre los 50 artículos con fragmento: `alta` solo si el inciso es distintivo ' +
      '(≥30 ch) —uno largo no coincide por azar—; los CORTOS («favorable», «legalmente») van a cola de ' +
      'revisión, no al badge, porque son a la vez los más peligrosos y los más ruidosos. Descarta ' +
      'marcadores «(Anulado)» y rúbricas, que son la mitad de lo capturado. ON-DEMAND: no pinga el badge. ' +
      'Nació al encontrar a mano la pregunta `9d361d19` (art. 92.8 CC), cuya clave decía «informe ' +
      'FAVORABLE del Ministerio Fiscal» con su propia explicación citando la STC 185/2012 que anuló esa ' +
      'palabra. NUNCA auto-corrige.',
  },
  corregir_plazas_contra_boletin: {
    titulo: 'Corregir una cifra de plazas contra el boletín (paso 4 del §6 de provenance)',
    ruta: 'scripts/corregir-plazas-contra-boletin.cjs',
    estado: 'vivo',
    escribe: ['plazas_libres', 'plazas_promocion_interna', 'plazas_discapacidad'],
    runbook: 'docs/runbooks/provenance-convocatorias.md',
    notas:
      'Dry-run por defecto. El §6 tiene cuatro salidas para una cifra sin documento que la pruebe y ' +
      'esta era la ÚNICA sin herramienta — justo la que cambia un dato que el opositor LEE en la ' +
      'landing (T-191). GUARDA CLAVE: la cifra nueva tiene que aparecer en la CITA aportada, ' +
      'comprobado con `cifraEnTexto`, EL MISMO predicado del detector `plazas_afirmadas_sin_documento` ' +
      '→ es imposible escribir por aquí una cifra que el detector no daría por probada. Además exige ' +
      'que la cita parezca prueba (mismo criterio que `cita_no_prueba_nada`: cláusula en prosa o fila ' +
      'de tabla; un membrete no vale), `--esperado` como optimistic check, dual-write en TRANSACCIÓN ' +
      'sobre `oposiciones` + convocatoria vigente, traza del éxito Y del rechazo en `observable_events`, ' +
      'y re-lectura posterior. Núcleo puro `lib/convocatoria/correccionPlazas.cjs` (20 tests). ' +
      'NO es para la cifra que se deduce del propio texto: eso es la válvula firmada `cifra_derivada`. ' +
      'Caso raíz: `administrativo-aragon` publicaba 139 restando a las 144 convocadas las 5 reservadas ' +
      'a colectivos — la resta no aparece escrita, mismo patrón que el 2.163 de Policía Nacional, y ' +
      'anunciaba 5 plazas MENOS de las convocadas.',
  },
  explicacion_sin_cita: {
    titulo:
      '«Explicación estructurada SIN cita»: el rastro de que el artículo no responde a la pregunta',
    ruta: 'scripts/audit-explicacion-sin-cita.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/revisar-preguntas-con-agente.md',
    notas:
      'Núcleo puro `lib/health/explicacionSinCita.js` (21 tests) + `npm run audit:sin-cita`. BAJO ' +
      'DEMANDA, no pinga el badge. Nace de T-342: el esquema hace `cita` OPCIONAL, así que una ' +
      'explicación sin ella pasa todos los gates — pero es la huella de que el agente leyó el ' +
      'artículo y no encontró frase que sostuviera la respuesta. NO es un detector de formato, es de ' +
      'huecos de TEMARIO. Reusa `citaNoLiteral` de impugnaciones (criterio único, con trinquete en ' +
      '`criterioCitaUnico`), no lo reimplementa. **ALCANCE ACOTADO a propósito:** calcula ' +
      '`cita_no_literal` pero NO lo reporta, porque ese terreno es del barrido de citas, que tiene su ' +
      'propia calibración (solo las AJENAS, solape < 0,5; las «retocadas» no son defecto). Medido el ' +
      '30/07 sobre 7.037 activas con estructura: 3.925 salen no literales en bruto — reportarlas ' +
      'habría sido un badge gritando. Sin acotar: 4.336 hallazgos; acotado: **411 (5,8%) y 17.547 ' +
      'exposiciones**. Dos exenciones que lo sostienen: preguntas de NEGACIÓN (ahí no poder citar la ' +
      'clave es lo ESPERADO) y meta-opciones («todas son correctas»). GOTCHA medido: el patrón de ' +
      'negación va sin distinguir mayúsculas, porque en los enunciados se resalta escribiéndola así ' +
      '(«señale la INCORRECTA») y con la regex sensible a la caja se escapaba.',
  },
  atajos_coherencia: {
    titulo:
      '¿El banco se contradice a sí mismo sobre un atajo de teclado? (no dice cuál es el correcto)',
    ruta: 'scripts/audit-atajos-coherencia.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/revision-preguntas-informatica.md',
    notas:
      'Núcleo puro `lib/health/atajoCoherencia.js` (21 tests) + runner `npm run audit:atajos`. BAJO ' +
      'DEMANDA, no pinga el badge. Nace de T-354: el 30/07/2026 el banco servía a la vez Ctrl+Alt+O ' +
      '(pregunta oficial, 242 exposiciones) y Ctrl+Alt+F como atajo de nota al pie, y NINGÚN detector ' +
      'podía verlo porque todos comparan una pregunta contra su fuente — y la fuente también estaba ' +
      'mal (6 artículos con el set inglés). Este NO consulta fuentes y NO decide cuál es la verdad: ' +
      'solo señala que no puede haber dos, que es lo que lo hace barato y seguro. Bandas: `interna` ' +
      '(un mismo texto se contradice, indefendible), `contenedor`, `familia` (Word 365 común vs ' +
      'Escritorio PUEDEN diferir de verdad: Office para la Web cambia atajos). GOTCHAS de calibración, ' +
      'los dos medidos: (1) los patrones de acción van ANCLADOS al inicio — sin eso «abrir» juntaba ' +
      '«abrir Cortana» con «abrir un documento» y daba 30 teclas en un solo hallazgo falso; (2) solo ' +
      'atajos de LETRA, porque las teclas de función no se localizan y Mayús+F12 es alias legítimo de ' +
      'Ctrl+G para Guardar. Medido: 247 afirmaciones, 4 hallazgos `interna` y 10 `familia`, casi todos ' +
      'apuntando al mismo culpable (Word 365 Escritorio art.5).',
  },
  transponer_posicion_correcta: {
    titulo:
      'Reparar la POSICIÓN de la opción correcta de un lote (§2.2-ter) sin descuadrar la explicación',
    ruta: 'lib/generacion/transponerPosicion.js',
    estado: 'vivo',
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      'Núcleo PURO (15 tests) + flag `--equilibrar` de `simular-batch-preinsercion.cjs`, que es quien ' +
      'ya DETECTA el desequilibrio: no hay detector nuevo ni umbral propio, se repara exactamente lo ' +
      'que `analizarLote` bloquea (>40% en una letra, <10%, o ciclo regular de periodo 4). Hace ' +
      'TRANSPOSICIÓN de dos posiciones, nunca rotación de cuatro, y mueve con ella la cabecera y la ' +
      'viñeta afectadas — el fallo de `gen_atc_t209` (25/07/2026) fue rotar cuatro a mano y dejar dos ' +
      'viñetas describiendo la opción equivocada, invisible para el gate y cazado por una auditoría ' +
      'ciega. Aborta si la explicación no está sincronizada con `correct_option` en vez de propagar el ' +
      'desajuste. GOTCHA propio (27/07, lo destapó un canario sobre un lote de 15): repartir solo ' +
      '"hasta cubrir el mínimo" dejaba la letra en exceso al 40% exacto; con n=8 el fallo es invisible ' +
      'porque cupoMin y cupoMax coinciden.',
  },
  insertar_batch_generado: {
    titulo: 'Paso 3: insertar un borrador de preguntas como `draft` (invisible), con dedup e invariantes',
    ruta: 'scripts/insertar-batch-generado.cjs',
    estado: 'vivo',
    escribe: ['lifecycle_state'],
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      '`<fichero.json> <law_slug> <batch_id>`. Entra todo como `draft` → `is_active=false` (columna ' +
      'GENERATED), así que nada se sirve hasta aprobar. Comprueba dedup contra las preguntas previas ' +
      'de la ley y 6 invariantes sobre una fila de prueba. GOTCHA: **aborta si el batch_id ya ' +
      'existe** (Paso 2-bis), porque el tag es la unidad de aprobación y el 26/07 dos sesiones ' +
      'compusieron el mismo tag a mano → 21 preguntas bajo un tag, y aprobar habría transicionado ' +
      'trabajo ajeno sin auditar. Usa sufijo de sesión en el tag. Deja los ids en un JSON para ' +
      'poder re-taguear si hace falta.',
  },
  verificar_batch_generado: {
    titulo: 'Paso 4: gate MECÁNICO del batch ya en BD (literalidad de la clave, citas, tells de forma, distribución)',
    ruta: 'scripts/verificar-batch-generado.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      'No escribe: lee de RDS por `batch_id`. Es la PUERTA de `aprobar_batch_generado`, que se niega ' +
      'a aprobar si no está verde. Trata `NO_LITERAL` como defecto DURO: en un borrador nuevo la ' +
      'clave se ancla al literal del artículo, no se adjudica (la adjudicación "condensación válida" ' +
      'nació para RECLASIFICAR preguntas ya en el banco, no para escribir). Avisa de `CORRECTA ' +
      'PARCIAL` cuando la cita sigue más allá de la opción; la exención por "cláusula ya en el ' +
      'enunciado" solo reconoce la cláusula LITERAL, así que un acotamiento semántico correcto no ' +
      'limpia el aviso y se adjudica a mano. Reporta por POSICIÓN en el lote: al reparar, usar ese ' +
      'índice y no el número de artículo (varias preguntas comparten artículo).',
  },
  auditar_batch_input: {
    titulo: 'Paso 5: empaquetar el batch + los artículos citados para la auditoría CIEGA por LLM',
    ruta: 'scripts/auditar-batch-input.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      'No escribe: `<batch_id> <salida.json> [--split N]`. Adjunta el texto del artículo preguntado ' +
      'y de los que citan las explicaciones, para que el auditor pueda verificar las remisiones. ' +
      'LÍMITE CONOCIDO (T-149): resuelve el número de la cita contra la ley de la PREGUNTA, así que ' +
      'una cita a otra norma («el artículo 31 de la Ley 58/2003» desde el reglamento) trae el ' +
      'artículo equivocado, y las remisiones que viven en el TEXTO del artículo no se extraen. ' +
      'Mitigación: nombrar siempre la ley al citar un artículo ajeno, y pedirle al auditor que diga ' +
      '"me falta el art. X" en vez de juzgar contra el texto que no tiene.',
  },
  oposicion_sin_temario: {
    titulo: 'Quién ha elegido una oposición que no tiene NI UN TEMA (y cuántos de esos pagan)',
    ruta: 'scripts/health/oposicion-sin-temario.cjs',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/roadmap/tareas-pendientes.md',
    notas:
      '`[--todos] [--limite N]`. SOLO LEE: no escribe, no pinga badge y no manda correo, porque ' +
      'las tres salidas (marcar la oposición en el selector, atender a los premium, construir el ' +
      'temario) son decisiones de producto sin tomar — y una alerta sin remediación construida ' +
      'enseña a ignorar el buzón (T-426). Cubre un hueco real: los badges de salud de contenido ' +
      'miran DENTRO de las oposiciones que preparamos, así que a esta gente no la ve nadie. ' +
      'Criterio en `lib/health/oposicionSinTemario.cjs` con 15 tests. **Dos guardas que no son ' +
      'cosméticas:** las oposiciones PERSONALIZADAS guardan un UUID en la misma columna y su ' +
      'temario vive en `custom_oposiciones` (contarlas ya hizo publicar una cifra equivocada), y ' +
      'la CADENA VACÍA no es una oposición (8 perfiles reales que inflaban el recuento a mano). ' +
      'La banda la decide quién PAGA, no el volumen. [T-397]',
  },
  duplicados_exactos: {
    titulo: 'Duplicados EXACTOS del banco (legislativas Y psicotécnicas): simula el barrido y jubila los sobrantes por lotes',
    ruta: 'scripts/calidad/duplicados-exactos.cjs',
    estado: 'vivo',
    escribe: ['lifecycle_state', 'psychometric_questions.is_active'],
    runbook: 'docs/maintenance/impugnaciones-claude-code.md',
    notas:
      '`[--dia YYYY-MM-DD] [--aplicar] [--limite N]`. SIMULA por defecto; solo escribe con ' +
      '`--aplicar`, y con motivo — `retired_duplicate` es un estado TERMINAL y no hay vuelta atrás. ' +
      'Criterio ESTRICTO a propósito: mismo artículo + enunciado normalizado idéntico + LAS MISMAS ' +
      'CUATRO OPCIONES, y excluye los supuestos (`exam_case_id`), porque los casos prácticos ' +
      'comparten enunciado POR DISEÑO — una métrica de parecido dio 3.230 falsos pares en T-321 y ' +
      'no sirve para borrar. Conserva por prioridad: examen OFICIAL > explicación estructurada > ' +
      'más servida > más antigua. GUARDA: aparta los grupos cuyo artículo se quedaría con menos de ' +
      '4 preguntas — jubilar ahí cambia la repetición por un artículo que no da ni para un test. ' +
      'Transiciona por `transition_question_state` (nunca UPDATE de `lifecycle_state`) y cada ' +
      'jubilación anota de cuál es duplicada. Origen: 3 impugnaciones de Marta (31/07/2026); el ' +
      'lote del 21/03 se saldó con 287 jubiladas y 3 apartadas por la guarda. ' +
      '**`--banco psicotecnicas` (T-410, 31/07)**: mismo criterio sobre `psychometric_questions`, ' +
      'que no tiene lifecycle — desactiva con `is_active=false` + `deactivation_reason` (reversible) ' +
      'y protege la SECCIÓN en vez del artículo. Ahí la clave del grupo incluye la HUELLA de ' +
      '`image_url`+`content_data`: sin ella 95 de 98 grupos son falsos positivos (preguntas ' +
      'distintas que comparten un enunciado genérico y se diferencian en la figura). ' +
      '**`--parafraseadas`** lista —nunca escribe— la clase que el corte exacto no ve: mismas ' +
      'opciones con el enunciado redactado distinto, que es la que se le escapó entera a la ' +
      'deduplicación de mayo. El criterio (normalización, clave de opciones, quién sobrevive, ' +
      'banda error/warn por el TEXTO de la respuesta y no por su índice) vive en el módulo puro ' +
      '`lib/calidad/duplicados.js`, con tests, para que los dos bancos no diverjan. ' +
      '**`--adjudicados <fichero.json> [--aplicar]` (T-439)**: aplica una adjudicación hecha A MANO. ' +
      'Existe aquí y no en un script aparte porque `lifecycle_state` tiene trinquete de escritores; rehusa jubilar una pregunta de examen OFICIAL y aborta entero si algún estado cambió desde que se adjudicó. ' +
      '**`--banco legislativas --parafraseadas` (T-425, 31/07)**: el mismo corte para `questions`, ' +
      'que NO se podía trasladar tal cual — agrupar solo por opciones da 3.376 grupos casi todos ' +
      'legítimos (series de variante: `polvorín semienterrado`/`superficial`, `ingreso`/`reintegro`, ' +
      'tramos de una tabla) y encima `esJuegoGenerico` descarta el caso que originó la ficha, porque ' +
      'sus opciones son cuatro números de artículo. Aquí se cruza el parecido del enunciado con el ' +
      'número ABSOLUTO de palabras distintas: el ratio solo dice «se parecen», el absoluto dice «se ' +
      'parecen POR POCO TEXTO», que es lo que separa la errata del supuesto práctico (mismo preámbulo ' +
      'largo, pregunta final distinta, ratio 0,90 sin ser gemelas). Dos bandas: GEMELA (318 grupos, ' +
      '817 preguntas, 499 sobrantes) y cola de revisión (1.292). LISTA Y NO ESCRIBE NUNCA, ni la banda ' +
      'alta: un intercambio de UNA palabra de contenido («prevención secundaria»/«terciaria») hace otra ' +
      'pregunta y pasa el umbral — límite irreducible, fijado con un test para que nadie lo «arregle» ' +
      'sin querer. NO pinga badge a propósito mientras no se decida qué hacer con lo que salga: una ' +
      'alerta sin remediación construida enseña a ignorar el buzón (lección de T-426).' +
      '**`--misma-clave` (T-519, 03/08)**: el TERCER corte, y el único que NO exige que las opciones ' +
      'coincidan — por eso ve lo que los otros dos no pueden. Agrupa por artículo + TEXTO de la ' +
      'respuesta correcta (nunca por su índice: las copias vienen barajadas) y descarta la pareja si ' +
      'las opciones también coinciden, para no contar dos veces el mismo defecto. Lo destapó la ' +
      'impugnación `9e0d7418`: una usuaria pidió un test del art. 2 de la LGSS, le salieron 10 ' +
      'preguntas y OCHO examinaban la misma frase; el artículo servía 13 activas y 11 preguntaban lo ' +
      'mismo, con enunciados y distractores distintos, así que era invisible para las dos herramientas ' +
      'que había. El discriminador NO puede ser «misma respuesta» a secas: un artículo con una ' +
      'enumeración (LOFCS art. 5, principios básicos de actuación) tiene N preguntas que piden ' +
      'subhechos DISTINTOS y comparten la etiqueta como respuesta. Lo que separa las dos cosas es si ' +
      'el ENUNCIADO pide lo mismo, medido sobre las palabras de CONTENIDO (`secuenciaDeContenido` de ' +
      'T-439, que ya quita el ruido de cita — el nombre desarrollado de la ley que exige §2.2-quater ' +
      'pesa más que la materia e infla el parecido solo). Calibrado con anclas leídas a mano: los ' +
      'falsos positivos conocidos caen en 0,12-0,27 y los ciertos de 0,48 arriba → GEMELA ≥0,85 ' +
      '(2.277 grupos, 4.233 sobrantes; 6 de 6 ciertas en muestra) y cola 0,55-0,85 (1.919). ' +
      'La banda del grupo la fija su MEJOR pareja, no la peor: un grupo es un cierre transitivo y el ' +
      'caso que originó la ficha tiene parejas en 0,48 y en 0,87. LISTA Y NO ESCRIBE, como los otros ' +
      'dos cortes. La PREVENCIÓN va aparte y en el punto de escritura: `analizarDuplicados` ' +
      '(`lib/generacion/simularBatch.js`) compara ahora la clave también contra las VIVAS — antes ' +
      'solo lo hacía intra-lote, y por ahí entraba la clase entera.',
  },
  aprobar_batch_generado: {
    titulo: 'Paso 6: transicionar un batch `draft` → `approved` (lo hace VISIBLE), con gate y resumen de auditoría',
    ruta: 'scripts/aprobar-batch-generado.cjs',
    estado: 'vivo',
    escribe: ['lifecycle_state'],
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      '`<batch_id> "<resumen de auditoría>"` — el resumen es POSICIONAL y se exige ≥80 chars: ' +
      'aprobar sin auditar tiene que costar mentir por escrito. Corre el gate de BD y se niega si no ' +
      'está verde. Transiciona por `transition_question_state` (nunca UPDATE directo de ' +
      '`lifecycle_state`: el trigger lo registraría como `bypass_detected`). Antes de escribir ' +
      'IMPRIME EL ALCANCE DE VISIBILIDAD —qué temas de qué oposiciones van a servir estas preguntas—, ' +
      'que es el guardarraíl que cazó que unas preguntas de un tema oculto se servían además a una ' +
      'oposición activa por compartir `topic_scope`. Emite `question_batch_approved` en ' +
      '`observable_events`.',
  },
  registrar_paso9: {
    titulo: 'Registrar el veredicto del Paso 9 (re-verificación post-aplicación) en ai_verification_results',
    ruta: 'scripts/registrar-paso9.cjs',
    estado: 'vivo',
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      'Dry-run por defecto; `<batch_id> <veredictos.json> [--apply]`. Es la CONTRAPARTE de escritura ' +
      'de `verificar-batch-servido.cjs` (T-155): ese comando BLOQUEA si falta el Paso 9, y esto es lo ' +
      'que lo acredita. Nace de la causa de fondo de que el paso se saltara — no tenía herramienta: ' +
      'el manual lo documentaba como un insert a mano copiado de un snippet, y con el cliente de ' +
      'Supabase, obsoleto tras el cutover a RDS. Medido el 26/07: los 11 lotes ATC de esa sesión ' +
      'tenían Paso 7 registrado y NINGUNO el Paso 9, aun habiéndose corrido el re-check en siete. ' +
      'Las guardas viven en el núcleo puro `lib/generacion/cierreLote.js` (14 tests), el mismo que ' +
      'decide el cierre, para que no haya dos definiciones de qué acredita un Paso 9: rechaza ' +
      'preguntas AJENAS al lote (los batch_id se componen a mano y ya hubo una colisión entre ' +
      'sesiones), rechaza acreditar un Paso 9 sin Paso 7 previo, y exige un hallazgo de >=40 chars ' +
      'para que registrar un paso no hecho cueste mentir por escrito. Permite registro PARCIAL (el ' +
      're-check suele mirar solo las reparadas) pero LISTA siempre lo que queda sin acreditar. NO ' +
      'toca lifecycle_state ni el contenido: solo acredita una auditoría ya hecha.',
  },

  // ── Calibración del canal de ALERTAS (las tres simulaciones son hermanas) ─────────────────
  // Estaban sin registrar: se escribieron una detrás de otra (T-258, T-263, T-272) y cada una
  // tuvo que redescubrir a las anteriores leyendo el runbook. Van juntas y con su relación
  // escrita para que la cuarta no nazca duplicando a ninguna.
  sim_cooldown_persistido: {
    titulo: 'Medir cuántos correos de alerta evita el cooldown persistido (antes de tocar un cooldownMin)',
    ruta: 'scripts/alerts/sim-cooldown-persistido.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/health-check.md',
    notas:
      'node scripts/alerts/sim-cooldown-persistido.cjs [--dias 7]. Solo lectura. Replaya los ' +
      '`alert_fired` reales con los `cooldownMin` del FUENTE y dice cuántos correos se evitan por ' +
      'regla (T-258, 7 días: 497 → 347). Responde "¿este cooldown está bien puesto?". Hermana de ' +
      '`sim_fatiga_email`, que responde otra pregunta distinta: cuántos correos manda la POLÍTICA ' +
      'del canal (severidad + backoff + agrupación) con los cooldowns ya dados. Cota INFERIOR: no ' +
      've los disparos que el cooldown ya silenció, porque esos no dejaron fila.',
  },
  sim_cadencia_cron: {
    titulo: 'Medir si `cron_overdue` acusa a un job SANO por declarar mal su cadencia (fase vs intervalo)',
    ruta: 'backend/scripts/sim-cadencia-cron-overdue.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/health-check.md',
    notas:
      'npm run sim:cadencia-cron -- --dias 7 [--job <nombre>]. Solo lectura. Importa el ' +
      '`findOverdueCrons` REAL y solo le cambia el catálogo: mide los correos con la cadencia vieja ' +
      'vs la nueva contra los ticks que de verdad ocurrieron (T-263: 11 → 0). Úsalo cuando ' +
      '`cron_overdue` señale un job que parece vivo — una FASE constante distinta de 0 con cadencia ' +
      '`*/N` es declaración equivocada, no avería.',
  },
  sim_fatiga_email: {
    titulo: 'Medir cuántos correos manda el canal de alertas con la política de email (severidad + backoff + agrupación)',
    ruta: 'backend/scripts/sim-fatiga-email.ts',
    estado: 'vivo',
    runbook: 'docs/runbooks/health-check.md',
    notas:
      'npm run sim:fatiga-email -- --dias 7 [--severidad critical] [--sin-backoff] [--sin-agrupar]. ' +
      'Solo lectura. Importa `decideEmail`/`parseEmailHistory` REALES de ' +
      '`backend/src/alerts/email-policy.ts` — la primera versión llevaba la curva COPIADA y por eso ' +
      'NO vio el defecto que sí cazó el test unitario (reinicio de racha == último escalón ⇒ el ' +
      'backoff se desarmaba solo y la avería crónica volvía a 9 correos en 3 días). Medido el ' +
      '30/07: 393 disparos → 35 correos (56 → 5,0/día). Además LISTA los problemas que no avisarían ' +
      'nunca con la política puesta: si alguno debe avisar, su regla necesita `emailAlways: true`. ' +
      'Correr ANTES de tocar la curva, la severidad mínima o de añadir una excepción.',
  },

  // ── Cerrar la cola de atención (impugnaciones y feedback) ─────────────────────────────────
  cerrar_impugnacion: {
    titulo: 'Cerrar una impugnación por el endpoint (que es lo que manda el email y concede el euro)',
    ruta: 'scripts/impugnaciones/cerrar.ts',
    estado: 'vivo',
    runbook: 'docs/maintenance/impugnaciones-claude-code.md',
    notas:
      'npx tsx --env-file=.env.local scripts/impugnaciones/cerrar.ts <dispute_id> --estado ' +
      'resolved|rejected --mensaje <f.txt> [--aplicar]. Dry-run por defecto. Existe porque el ' +
      'manual PROHÍBE el UPDATE directo: sin el endpoint no sale el email (el trigger que lo hacía ' +
      'se eliminó el 14/04/2026 por fallar en silencio), no se concede el 1 € de recompensa y se ' +
      'salta la puerta de barajado. Antes se improvisaba un script suelto por sesión. ' +
      'GOTCHAS: (1) AUTH_SECRET NO está en .env.local, sale de SSM /vence-frontend/AUTH_SECRET; ' +
      '(2) el admin tiene que ser el de la whitelist (manueltrader@gmail.com), otro da 403; ' +
      '(3) canta si cierra SIN email en vez de enterrarlo en el JSON. ' +
      '`--sin-recompensa "<motivo>"` para el mismo hallazgo repetido (un fallo, una recompensa). ' +
      'Desde T-474 EXIGE tener la impugnación reservada (ver cola_puerta_cierre); escape ' +
      '`--igualmente "<motivo>"`. ' +
      '**Desde T-520 EXIGE además el VERDICTO SISTÉMICO** (`--sistemico`), porque la regla de ' +
      '«mira si el fallo es sistémico antes de cerrar» llevaba desde el 30/07 escrita en el manual, ' +
      'impresa por el dossier y en la checklist, y aun así se olvidaba: un aviso entre otras diez ' +
      'líneas no es una condición, y encima el dossier se lee al EMPEZAR mientras el cierre llega ' +
      'media hora después. Taxonomía CERRADA de tres salidas, cada una con su prueba — ' +
      '`aislado: <razón ≥25 chars>` · `medido: <qué> → <N>` (exige la CIFRA: sin número, «medido» ' +
      'es decir que no se midió) · `ficha T-nnn: <qué>` (exige el id). Un campo de texto libre se ' +
      'rellena con «lo he mirado» y no se puede contar ni revisar. Escape contado: ' +
      '`--sistemico-omitido "<por qué no procede>"`. Núcleo puro `lib/impugnaciones/verdictoSistemico.cjs` ' +
      '(9 tests con los verdictos reales que lo motivaron). Se anuncia también en dry-run, para que ' +
      'no sorprenda con el mensaje ya aprobado. ' +
      '**Desde T-609 (06/08) EXIGE además mirar el EMBUDO** (ver embudo_puerta_veto): si hay una ' +
      'respuesta de Manuel en `session_questions` que VETA este envío y nadie la ha consultado, ' +
      'aborta con el texto delante en vez de mandar lo vetado. Escape propio `--embudo-igualmente ' +
      '"<motivo>"` — separado de `--igualmente` y `--temario-igualmente` a propósito: compartir el ' +
      'escape apagaría las tres puertas de una vez.',
  },
  embudo_puerta_veto: {
    titulo: 'Que el cierre no mande un correo que Manuel ya vetó en el embudo',
    ruta: 'scripts/impugnaciones/lib/puerta-embudo.ts',
    estado: 'vivo',
    escribe: [],
    runbook: 'docs/maintenance/impugnaciones-claude-code.md',
    notas:
      'Incidente 06/08/2026: un trabajador dejó 4 preguntas en el embudo con el borrador de ' +
      'rechazo de Manolo (arts. 108/110/112/114 CE); Manuel respondió «NO ENVIAR TAL CUAL» a las ' +
      '06:16; a las 06:24-26 OTRA sesión cerró tres con `--igualmente` (ver además ' +
      'cola_puerta_cierre, que ese mismo escape también se saltaba) y mandó el texto vetado — el ' +
      'veredicto llevaba 8 min en la BD sin que nada lo consultara. MEDIDO contra la fila real: no ' +
      'era `kind=\'borrador\'` con `draft_target` (lo que asumía la ficha al abrirse), sino ' +
      '`kind=\'pregunta\'` con `draft_target IS NULL` y el id de la impugnación dentro de la PROSA ' +
      'de `question` — un detector que solo mirara `draft_target` no habría visto nada de este ' +
      'incidente. Núcleo puro `lib/impugnaciones/embudoVeto.cjs`: busca el id (uuid completo o ' +
      'prefijo de 8, con frontera de palabra — mismo criterio que `borradorAbierto.cjs`/T-588) en ' +
      '`question`+`context`+`draft_target` de CUALQUIER fila respondida, y reconoce un VETO por ' +
      'marcador explícito («no enviar…», «no se manda…», «vetado») calcado del texto real del ' +
      'incidente. Deliberadamente asimétrico: NO intenta reconocer una aprobación (bloquearía las ' +
      'notas de cierre normales, que son la mayoría de las respuestas `answered`), solo el veto — ' +
      'un falso negativo aquí es solo un `--embudo-igualmente` de más, un falso positivo dejaría ' +
      'salir el correo vetado. Escape `--embudo-igualmente "<motivo>"`, contado como `guard_escape` ' +
      'del guard `embudo`. FAIL-OPEN sin BD. 25 tests del núcleo (incluida la reproducción con el ' +
      'texto VERBATIM de Manuel) + 6 de fricción.',
  },
  cerrar_feedback: {
    titulo: 'Responder o cerrar en silencio un feedback por el endpoint',
    ruta: 'scripts/impugnaciones/cerrar-feedback.ts',
    estado: 'vivo',
    runbook: 'docs/maintenance/impugnaciones-claude-code.md',
    notas:
      'npx tsx --env-file=.env.local scripts/impugnaciones/cerrar-feedback.ts <feedback_id> ' +
      '[--mensaje <f.txt> | --silencioso] [--aplicar]. El modo SILENCIOSO cierra sin escribir: es ' +
      'para el hilo que acaba en cortesía («gracias, lo pruebo»), que si no se queda en ' +
      '`waiting_admin` contando como pendiente para todas las sesiones. Comparte identidad de ' +
      'admin con cerrar_impugnacion vía scripts/impugnaciones/lib/admin-token.ts (misma whitelist, ' +
      'mismo TTL: duplicarla garantizaba que un día divergieran). ' +
      'GOTCHA: este endpoint exige `adminUserId` en el CUERPO — el de impugnaciones lo saca del token. ' +
      'Desde T-474 EXIGE tener el feedback reservado (ver cola_puerta_cierre), que es donde peor ' +
      'estaba: 52 % de los cerrados en 14 días no había pasado por reserva.',
  },

  // ── Visibilidad del antifraude ────────────────────────────────────────────────────────────
  canary_cobertura_dispositivos: {
    titulo: 'Medir qué porcentaje de usuarios activos tiene huella de dispositivo (visibilidad del antifraude)',
    ruta: 'scripts/canary-cobertura-dispositivos.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/revisar-fraudes.md',
    notas:
      'npm run canary:cobertura-dispositivos [-- --dias N] [--json]. Solo lectura. Nace de [T-371]: ' +
      'el antifraude por dispositivo (multicuenta, límite por cuenta, farmeo del free, ' +
      'anti-autoreferido de referidos) SOLO ve a quien tiene fila en `user_devices`, y cuando no la ' +
      'tiene no falla nada — las consultas devuelven cero y todo parece tranquilo (misma firma que ' +
      'T-304). GOTCHA DE MEDIDA, que es el motivo de que exista: cuenta solo usuarios con ACTIVIDAD ' +
      'real. Medido contra el padrón entero da 61%, contra uso real 92,4% — el hueco son cuentas que ' +
      'nunca respondieron una pregunta, y un denominador mal elegido convierte mantenimiento en ' +
      'alarma. Rojo <60%, ámbar <80%, sobre el suelo medido antes del arreglo.',
  },

  marcar_contenedor_institucional: {
    titulo: 'Marcar is_virtual las «leyes» que son fichas de organismos (FMI, OMS, OTAN…) y no tienen articulado',
    ruta: 'scripts/laws/marcar-contenedor-institucional.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/completitud-leyes.md',
    notas:
      'node scripts/laws/marcar-contenedor-institucional.cjs [--aplicar]. Simula por defecto. ' +
      'Criterio PURO y testeado en lib/laws/contenedorInstitucional.js: exige las TRES cosas a la ' +
      'vez — 1 solo artículo, sin fuente registrada y DECLARADO «contenido institucional» en su ' +
      'propio texto. Estrecho a propósito: marcar is_virtual saca la ley de la vigilancia de ' +
      'completitud para siempre y en silencio, así que un Protocolo de la UE de un artículo NO ' +
      'cumple. Aplicado 31/07/2026 a 7 (FMI, OMS, OTAN, FAO, EUROJUST, TEDH/TJUE, UE-instituciones, ' +
      '375 preguntas, que se siguen sirviendo igual). Deja traza en observable_events ' +
      '(law_marcada_virtual). Contexto: [T-026].',
  },

  vigilar_fuentes_legales: {
    titulo: 'Vigilar por hash las fuentes legales que el cron del BOE no cubre (avisa si la norma cambió)',
    ruta: 'scripts/laws/vigilar-fuentes-legales.cjs',
    estado: 'vivo',
    runbook: 'docs/runbooks/completitud-leyes.md',
    notas:
      'npm run laws:vigilar [-- --aplicar] [--ley <uuid>] [--limite N]. Simula por defecto. Cubre el ' +
      'hueco de `check-boe-changes`, que excluye a propósito las leyes sin boe_url, las de URL ' +
      'doc.php y las de scope=eu: 160 leyes reales con 4.893 preguntas, el TUE entre ellas. ' +
      'Núcleo puro `lib/laws/sourceWatch.cjs` (11 tests) y descargador COMPARTIDO con ' +
      'verify-law-source.cjs (`lib/laws/fetchSourceText.cjs`) — si cada uno leyera distinto, el ' +
      'hash no compararía lo mismo que se verificó. Sin LLM a propósito. ' +
      'GOTCHA nº1: NO usa `verified_source_hash` (que es sha256 del texto CRUDO truncado a 32 y de ' +
      'otra herramienta); su línea base vive en law_source_verification_history con ' +
      'verified_by=vigilancia-hash. Mezclarlos da «cambiada» siempre. ' +
      'GOTCHA nº2: detecta pantallas de captcha/WAF (el BORM devuelve 810 chars con incident id ' +
      'variable) y las marca `inaccesible`, que NO es un cambio. Frase-gatillo: «revisa los ' +
      'cambios de fuentes legales».',
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
