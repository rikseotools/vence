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
  /**
   * Comando por el que se EMPIEZA a trabajar este kind, si la campaña tiene
   * utillaje propio (`npm run …`). Existe para que la herramienta no quede en un
   * SILO: el 26/07/2026 dos sesiones construyeron a la vez dos planificadores
   * distintos para `article_no_coverage` porque ninguna encontró el del otro —
   * uno estaba documentado en el runbook y el otro solo en CLAUDE.md y una ficha.
   * Declarándolo aquí, el panel, la guía y el guardarraíl leen todos lo mismo, y
   * el test verifica que el script existe de verdad en package.json.
   */
  comando?: string
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
  // T-275: no es un error, es una respuesta correcta que llega TARDE — el mismo punto ciego que
  // T-254. Va con la frase de health-check porque es salud de app/infra, no de contenido.
  visibility_map_frio: { title: 'Mapa de visibilidad frío (index-only scans que no lo son)', ...HEALTH_CHECK },
  // Preventivo del anterior: marca la tabla ANTES de que se enfríe, por no tener la protección.
  visibility_map_sin_ajuste: { title: 'Tabla grande sin el ajuste de autovacuum por inserts', ...HEALTH_CHECK },
  // Distingue «lento» de «choca contra un timeout»: la forma de la cola, no la magnitud.
  latencia_techo_timeout: { title: 'Latencia contra un TECHO de timeout (no es lentitud)', ...HEALTH_CHECK },
  // T-307: el barrido se cortó a mitad. Es el hallazgo que dice «esta foto está INCOMPLETA»: sin
  // él, un detector que revienta deja el resto del panel con los datos de la pasada anterior y
  // pasa por verde (pasó el 29 y el 30/07: dos días de ceguera con el badge tranquilo).
  sweep_incompleto: { title: 'El barrido de salud se cortó a mitad (panel incompleto)', ...HEALTH_CHECK },
  chat_ia_errores: {
    title: 'El chat IA está sirviendo errores',
    triggerPhrase: 'revisa los errores del chat',
    runbook: 'docs/maintenance/revisar-chat-ai.md',
    claudeHace:
      'el chat le está devolviendo al usuario "ha ocurrido un error" en vez de una respuesta. La CAUSA está en `ai_chat_traces` (`trace_type=\'llm_call\'`, campos `output_data->>\'errorStatus\'` y `errorMessage`), no en el log: mírala ahí antes de tocar nada. Las dos vistas hasta ahora son **cuenta del proveedor sin saldo** (Anthropic lo manda como 400 «Your credit balance is too low», NO como 402) y **modelo inexistente** (404, p.ej. un `claude-*` retirado: comprobar `ai_api_config.default_model`). Ojo con el histórico: hasta el 28/07/2026 `ai_chat_logs.had_error` estaba en false SIEMPRE aunque la respuesta fuera un error, así que en logs viejos no te fíes de esa columna — filtra por el texto de `full_response`.',
  },
  feedback_sin_conversacion: {
    title: 'Feedback pendiente que NO se puede responder',
    triggerPhrase: 'revisa los feedbacks incontestables',
    runbook: 'docs/procedures/gestionar-feedback-bug.md',
    claudeHace:
      'el feedback está `pending` pero no tiene fila en `feedback_conversations`, y `/api/v2/feedback/respond` rechaza responder sin ella (409 «no tiene conversacion abierta»): el usuario escribió y no recibirá contestación nunca. Crea la conversación (`INSERT INTO feedback_conversations (feedback_id, user_id, status) VALUES (…, …, \'waiting_admin\')` o el endpoint admin `create-conversation`) y responde por el flujo normal. Y MIRA DE DÓNDE VINO: si el camino de creación no abre conversación, el arreglo va ahí, no en el parche uno a uno — pasó con las solicitudes del chat de IA (T-247), donde las 6 que llegaron entre abril y julio se quedaron sin una sola respuesta, cerradas en silencio. Las solicitudes de borrado de cuenta están excluidas del detector a propósito: van por `eliminacion-cuentas.md` y no se responden por el hilo.',
  },
  // ── CONVOCATORIAS: el proceso fiel al documento oficial (docs/runbooks/verificar-convocatorias.md) ──
  convocatoria_timeline_incoherente: {
    title: 'Timeline de convocatoria incoherente',
    triggerPhrase: 'revisa el timeline de convocatorias',
    runbook: 'docs/runbooks/verificar-convocatorias.md',
    claudeHace: 'arregla los hitos que se contradicen entre sí (orden imposible, dos fechas de examen para el mismo ciclo) contra la fuente oficial.',
  },
  convocatoria_estado_incoherente: {
    title: 'El estado del proceso se contradice con sus propias fechas',
    triggerPhrase: 'revisa los estados de convocatoria',
    runbook: 'docs/runbooks/verificar-convocatorias.md',
    comando: 'audit:estados',
    claudeHace:
      'para cada oposición señalada, mira la contradicción concreta del mensaje: `inscripcion_abierta` con el plazo VENCIDO, `pendiente_examen` con el examen ya pasado, un estado post-examen con el examen en el futuro, o el estado en desacuerdo con lo que el front muestra (home/SEO/banner filtran por FECHAS, no por `estado_proceso`: si divergen, la oposición aparece o desaparece del catálogo por el motivo equivocado). Es DETERMINISTA: detecta la contradicción, no adivina el estado bueno — para eso hace falta fuente oficial (sigue el runbook). Ojo a las CATALOGADAS visibles: si el radar nunca las verificó o lleva >30 días sin hacerlo, su fecha no tiene garantía y puede estar engañando en /oposiciones/inscripcion-abierta. Misma lógica en el CLI `npm run audit:estados` (núcleo `lib/convocatoria/estadoCoherencia.cjs`), útil para ver el informe entero de golpe.',
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
  oposicion_incompleta: {
    title: 'Oposición publicada con la construcción a medias (lo que el gate de creación encontró)',
    triggerPhrase: 'revisa las oposiciones incompletas',
    runbook: 'docs/maintenance/crear-nueva-oposicion.md',
    claudeHace: 'son los hallazgos de `npm run audit:oposicion <slug>`, el gate que se corre AL CREAR una oposición: fila de `oposiciones` con campos vacíos, topics sin `topic_scope`, temas marcados disponibles con 0 preguntas, timeline sin hitos, `estado_proceso` divergente entre `oposiciones` y su convocatoria vigente, rutas de frontend que faltan, registros de UI (OnboardingModal, perfil, mapeo CCAA, CcaaFlag) sin dar de alta. ⚠️ POR QUÉ EXISTE EL KIND (T-455, 01/08/2026): hasta esa fecha el gate escribía **CERO** filas en `content_health_findings` y **CERO** en `observable_events` — comprobaba diez fases y todo moría en la terminal de quien lo ejecutaba, así que si fallaba (o no se corría) la oposición se publicaba igual y no quedaba rastro en ninguna parte. Es el mismo modo de fallo que ya costó semanas con `landing_incompleta`: una comprobación ON-DEMAND que nadie repite no es una comprobación. Ahora cada ejecución REEMPLAZA lo anterior de ese slug (el gate es una foto del estado actual; dejar hallazgos de una oposición ya arreglada es la forma más rápida de que el panel deje de leerse) y emite `oposicion_auditada`. Para resolverlos: correr el gate, arreglar lo que señale siguiendo el manual de creación, y volver a correrlo — el verde es la AUSENCIA de filas. NUNCA marcar `is_active=true` con hallazgos `error` abiertos.',
  },
  nota_interna_publicada: {
    title: 'La landing publica una nota interna nuestra (el campo de referencia usado como bloc de notas)',
    triggerPhrase: 'revisa las notas internas publicadas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'los campos de REFERENCIA (`boe_reference`, `diario_referencia`, `convocatoria_numero`, `oep_decreto`) se PINTAN en el hero de la landing y bajo el botón "Ver convocatoria en …", y se estaban usando para apuntar auditorías. Caso raíz 31/07 (T-435): `celador-sermas-madrid` servía «⚠️ SIN VERIFICAR: la fila afirma 688 plazas (52 discapacidad)…», o sea, contándole al opositor que no nos fiamos de nuestra propia cifra; medidas 7 landings activas así. Y aquella nota era FALSA: quien la escribió miró el sumario del boletín y la entrada contigua — el documento correcto (BOCM-20250704-15, que el propio `programa_url` ya enlazaba) dice «CELADOR/A · TOTAL 740 · CUPO GRAL. 688 · CUPO DISCAP. 52», así que el dato era bueno y la duda, inventada. ⚠️ Se mira sobre `oposiciones_ssot`, NO sobre `oposiciones`: el mismo barrido contra la tabla base da CERO con el texto en pantalla, porque la nota vive en `convocatorias` y la vista resuelve desde ahí. NO marca la referencia larga con cita literal del boletín: eso es la convención de la casa (mediana 210 caracteres sobre 119 landings activas, p90 599) y marcarla daría 60-90 hallazgos que matarían el badge. Arreglo: `node scripts/convocatoria/sanear-referencia-publicada.cjs` (dry-run por defecto) — conserva lo que va DELANTE del marcador, muda la nota a `convocatoria_verification` como `needs_human` (la duda no se pierde, deja de publicarse) y hace dual-write. Si el valor EMPIEZA por el marcador no hay nada publicable que rescatar: hay que abrir el boletín y pasar la referencia con `--referencia "…"`, y solo entonces `--verificado`. NUNCA dejar que la herramienta adivine la referencia del propio texto: la primera versión proponía `BOCM-20250704-16`, que es justo el documento que la nota descartaba. La verificación se APOYA EN EL HUB, no en una descarga privada: `--verificado` exige `--cita` y la contrasta contra el `extracted_text` del documento ya clonado en `convocatoria_documentos`, y enlaza `source_url` + `verified_source_hash` — una verificación cuya prueba solo existió en la terminal de quien la hizo no es provenance. Si el documento no está clonado, la herramienta NO clona: manda al canónico `backend/scripts/clonar-documento.ts` (`ensure_convocatoria_documento` es el único camino de escritura al hub). Tras aplicar, invalidar caché (`landing` y `oposiciones-catalog`, per-instancia: repetir) y comprobar sobre el HTML SERVIDO, no sobre la BD.',
  },
  convocatoria_link_mismatch: {
    title: 'Enlace "Ver en BOE" que no corresponde a la referencia mostrada',
    triggerPhrase: 'revisa los enlaces de convocatoria',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'compara el ID del BOE que MUESTRA la convocatoria (boe_reference) con el del ENLACE (programa_url): si difieren, el usuario pincha "Ver en BOE" y aterriza en OTRO documento (medido 25/07: 5 vigentes mostraban la OEP 2026 y enlazaban a la convocatoria de 2025). Verifica contra el boletín cuál es el correcto y alinea referencia y enlace (normalmente el enlace se quedó en el ciclo anterior). NUNCA repuntar sin confirmar contra fuente oficial.',
  },
  convocatoria_etiqueta_boletin: {
    title: 'El botón oficial promete un boletín y lleva a otro (etiqueta ≠ enlace)',
    triggerPhrase: 'revisa los enlaces de convocatoria',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'la tarjeta oficial de la landing compone el texto con `diario_oficial` ("Ver convocatoria en BOJA") y el enlace con `programa_url`: si la etiqueta nombra un boletín y la URL es de otro, el botón miente. Punto ciego de convocatoria_link_mismatch, que compara referencia vs enlace y da limpio cuando ambos son el MISMO documento (caso raíz 25/07: UAL con diario_oficial=BOJA y programa_url a boe.es). Decide cuál es el bueno contra la fuente oficial —normalmente manda el documento enlazado— y alinea la etiqueta; si el plazo cuenta desde OTRO boletín, eso va en `diario_referencia` y en la FAQ del plazo, no en la etiqueta. NUNCA cambiar el enlace sin confirmar el documento.',
  },
  convocatoria_enlace_no_boletin: {
    title: 'El botón oficial promete un boletín y el enlace no es de ninguno (portal, portada o temario)',
    triggerPhrase: 'revisa los enlaces de convocatoria',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'punto ciego de los dos detectores anteriores: ambos exigen RECONOCER un boletín en la URL, así que cuando `programa_url` apuntaba a un portal institucional se callaban los tres. Caso raíz 26/07 (T-134): `policia-nacional`, con plazo ABIERTO, prometía "Ver convocatoria en BOE" y llevaba a `policia.es/portalaspirantes/en/web/…` — ni BOE, ni convocatoria, ni español; medido ese día, 56 de 123 landings activas estaban en esa zona muerta. `error` = hay convocatoria PUBLICADA (existe documento oficial que enlazar) y el botón lleva a una portada/sección de portal o a una página en otro idioma; `warn` = aún no hay convocatoria (OEP aprobada, sin OEP, proceso cerrado) o el enlace es un TEMARIO bajo un rótulo que SÍ promete la convocatoria. ⚠️ DESDE EL 28/07 el detector juzga el enlace que la landing ENSEÑA, no `programa_url` a pelo: sin convocatoria publicada y con el documento de la OEP clonado, la página enlaza ESE documento y rotula "Ver OEP en {diario}" (núcleo compartido `lib/convocatoria/enlaceOficial.cjs`). Corolario al triar: un aviso en una oposición sin convocatoria casi siempre significa que FALTA CLONAR EL DOCUMENTO DE SU OEP —por eso la landing cae al portal institucional—, no que haya que cambiar la etiqueta; herramienta `scripts/convocatoria/bandeja-documentos.cjs`. Arreglo: busca el documento oficial de la convocatoria en su boletín y repunta `programa_url` (dual-write en `oposiciones` Y en la convocatoria vigente, que es de donde lee la landing), o —si de verdad no hay documento— cambia `diario_oficial` a lo que el enlace es en realidad y deja el boletín de las bases en `diario_referencia`. Simula antes con `node scripts/convocatoria/sim-enlace-boletin.cjs`. NUNCA repuntar sin abrir el documento y confirmar que es esa convocatoria.',
  },
  // ── Kinds ON-DEMAND del triaje epígrafe↔fuente (T-552): los emite `npm run audit:epigrafe-fuente`.
  // NO van al barrido nocturno porque medir exige DESCARGAR el programa de cada oposición, y el
  // sweep hace TRUNCATE y recalcula todo en cada pasada: serían 126 descargas por noche de una
  // señal que solo cambia cuando alguien repunta la URL. Automatizarlo pide persistir el veredicto
  // (migración) + el gemelo @Cron del backend + deploy → [T-553].
  temario_fuera_de_su_fuente: {
    title: 'El temario que servimos NO aparece en el documento del que dice venir',
    triggerPhrase: 'revisa los temarios contra su fuente',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    comando: 'audit:epigrafe-fuente',
    claudeHace:
      'compara cada epígrafe de la BD contra el texto del `programa_url` y pregunta solo si APARECE dentro: si es literal aparece, si es paráfrasis no. Sin parsear el boletín (que falla en un tercio de los casos), sin alinear temas y sin LLM. Medido el 04/08 sobre las 126 activas: 2.193 temas medibles y 765 (35%) fuera de su fuente — 22 oposiciones literales, 41 parciales y 11 enteramente parafraseadas. Ordena la cola del Paso 1 por impacto; NO lo sustituye. ⚠️ Un «parafraseado» no dice de quién es la culpa: puede ser paráfrasis NUESTRA (el caso normal) o un `programa_url` que apunta a OTRO CICLO —el caso Cantabria, donde una Orden posterior había modificado el programa—. Las dos piden abrir el documento. Para atacarlo: Paso 1 del runbook (clonar el literal con `verify:epigrafe apply`).',
  },
  programa_url_no_es_temario: {
    title: 'El `programa_url` apunta a un documento SIN temario dentro',
    triggerPhrase: 'revisa los temarios contra su fuente',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    comando: 'audit:epigrafe-fuente',
    claudeHace:
      'cubo APARTE del anterior, y separarlos es lo que hace útil la cola: al estrenar el triaje el primero de la lista era `administrativo-estado` con «45 de 45 fuera de su fuente», y su `programa_url` era el RD 387/2026 de la Oferta de Empleo Público — un decreto de plazas sin un solo tema dentro. Ese 0/45 no decía «parafraseamos», decía «el enlace no es un temario». Medido sobre las 126: **44** están así (portales tipo `zaragoza.es/oferta/…` o `jccm.es/tramites/…`, portadas de boletín como `bopmalaga.es`, o el decreto de la OEP) y otras 8 no se pueden ni descargar. Se distingue por la racha de enteros consecutivos: un programa enumera 1,2,3… y una norma no. ⚠️ Esto NO es lo mismo que `convocatoria_enlace_no_boletin`: aquel juzga `programa_url` como ENLACE DEL BOTÓN (¿lleva al boletín que promete?) y este como FUENTE DEL TEMARIO (¿tiene temas dentro?). El campo sirve a dos contratos y un portal puede ser un botón correcto y una fuente inútil a la vez. Arreglo: localizar el documento con el programa y repuntar `programa_url` con dual-write; hasta entonces el temario de esa oposición NO se puede medir.',
  },
  // ── Kinds ON-DEMAND: los emite `npm run audit:landing -- <slug>`, no el sweep nocturno ──
  // Se midieron sobre las 123 landings activas antes de decidir dónde viven (T-142): en el barrido
  // nocturno producían 168 y 89 hallazgos respectivamente, casi todos por falta de contexto (el
  // 96% de los documentos del hub están clonados como `nota`, y las FAQ enumeran subconjuntos).
  // Con un humano leyendo la salida de la auditoría, los mismos detectores son precisos.
  landing_enlace_roto: {
    title: 'Enlace de la landing que no responde (404/5xx)',
    triggerPhrase: 'audita la landing',
    runbook: 'docs/runbooks/salud-contenido.md',
    comando: 'audit:landing',
    claudeHace:
      'la auditoría descarga la landing SERVIDA y comprueba todos sus enlaces —internos y externos—. Un enlace roto en la landing de una oposición con plazo abierto es tráfico de campaña que se pierde. Arregla el destino (o quita el enlace) y vuelve a correr `npm run audit:landing -- <slug>`. NO se ejecuta en el barrido nocturno a propósito: 123 landings × ~70 enlaces son ~8.600 peticiones por noche que no se pagan por lo que cazan.',
  },
  landing_cifra_sin_respaldo: {
    title: 'La landing afirma una cifra que no aparece en el documento oficial',
    triggerPhrase: 'audita la landing',
    runbook: 'docs/runbooks/salud-contenido.md',
    comando: 'audit:landing',
    claudeHace:
      'contrasta las cifras que la página AFIRMA (plazas, preguntas, minutos, temas del programa) contra el `extracted_text` del documento de convocatoria clonado en el hub. Caso raíz 26/07: la landing de policia-nacional decía "psicotécnicos (80 preguntas, 60 min)" — cifras que NO estaban en su BOE, venían de otra convocatoria y llevaban meses publicadas. Verifica la cifra en el documento y corrige el texto (dual-write `oposiciones` + convocatoria vigente) o, si el documento no es el correcto, clónalo con su tipo real. NUNCA "ajustar" la cifra a lo que diga la landing.',
  },
  landing_superficies_contradictorias: {
    title: 'La landing se contradice a sí misma (dos superficies, dos números del mismo hecho)',
    triggerPhrase: 'audita la landing',
    runbook: 'docs/runbooks/salud-contenido.md',
    comando: 'audit:landing',
    claudeHace:
      'compara las superficies de RESUMEN de la página (tarjetas del hero, caja de convocatoria, temas_count) buscando el mismo concepto con números distintos. Caso raíz: el hero decía "46 temas del programa" y la FAQ "45", que es lo que tiene el Anexo I. Decide cuál es el correcto contra el documento oficial y alinea las dos superficies. OJO con el matiz que el detector ya conoce: los temas del PROGRAMA OFICIAL y los que SERVIMOS pueden diferir legítimamente si añadimos contenido de apoyo — eso no es contradicción, y por eso las FAQ (que enumeran subconjuntos) no se comparan entre sí.',
  },
  documentos_sin_revisar: {
    title: 'Documentos oficiales clonados que nadie ha revisado',
    triggerPhrase: 'revisa los documentos nuevos',
    runbook: 'docs/runbooks/salud-contenido.md',
    comando: 'docs:bandeja',
    claudeHace:
      'el cron clona a diario los documentos oficiales (bases, resoluciones, notas) de las oposiciones que PREPARAMOS, y la decisión de qué se publica la toma una sesión leyendo la FUENTE. Corre `npm run docs:bandeja` para ver la cola (lo de plazo abierto primero), `--ver <id>` para leer el documento entero junto a lo que hoy dice la BD, y actualiza con dual-write lo que corresponda (fechas, plazas, examen_config, versiones de software del temario). Al terminar, `--revisado <id> --nota "qué se hizo"`. CONTEXTO: hasta el 26/07 esto lo pre-masticaba un LLM barato que generó 6.886 extracciones de las que se triaron CERO (~17 USD tirados); el paso se ELIMINÓ (no se dejó tras un flag) porque el documento se clona igual y quien decide es quien tiene criterio y la fuente delante. NUNCA publicar un dato que no esté en el documento.',
  },
  landing_incompleta: {
    title: 'Landing publicada a medio hacer (hero sin tarjetas, sin FAQs, sin SEO)',
    triggerPhrase: 'revisa las landings incompletas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'oposición ACTIVA cuya landing está servida a medias: `error` = el opositor la ve vacía (hero sin tarjetas o menos de 3 FAQs); `warn` = se ve bien pero pierde SEO/contexto (sin seo_title/description, sin titulo_requerido, sin examen_config). Caso raíz 25/07: Aux. Admin. UAL llevaba semanas publicada así y solo se detectó al ir a mandarle una newsletter a 1.334 personas. Completa los campos con datos VERIFICADOS contra el boletín oficial (plazas por turnos, titulación, plazo, estructura del examen), escribe en `oposiciones` Y en la convocatoria vigente (dual-write; la landing lee la SSOT) y revalida la caché — ojo: `purge-cache` es per-instancia, hay que repetirlo. NUNCA rellenar FAQs ni cifras a ojo.',
  },
  convocatoria_oep_sin_enlace: {
    title: 'Convocatoria con OEP en texto sin enlazar a la entidad (histórico con año de convocatoria)',
    triggerPhrase: 'revisa el histórico de convocatorias',
    runbook: 'docs/runbooks/historico-convocatorias-landing.md',
    claudeHace: 'para cada oposición señalada, corre `node scripts/oep/poblar-historico.cjs <slug>`: corre el backfill de la entidad OEP con --apply (idempotente) y verifica (gate) que TODAS las convocatorias con oep_decreto quedaron enlazadas a `oep` vía `convocatoria_oep`. El síntoma es que el histórico de la landing muestra el año de CONVOCATORIA en vez del de OEP. Si el gate sigue fallando, el `oep_decreto` no parsea → revisar `parseOepDecreto` en backfill-oep-entidad.cjs.',
  },
  seguimiento_url_stale: {
    title: 'seguimiento_url que vigila un ciclo ya cerrado',
    triggerPhrase: 'revisa las urls de seguimiento',
    runbook: 'docs/maintenance/oeps-convocatorias-seguimiento.md',
    claudeHace: 'para cada oposición señalada, verifica contra fuente oficial si la `seguimiento_url` apunta a la convocatoria VIGENTE o a un ciclo ya cerrado. Si está desfasada, repúntala a la página de la convocatoria viva Y pon `seguimiento_last_hash=NULL` (si no, la siguiente pasada del cron da un `changed` falso garantizado). `stale_boletin` (apunta a un documento de boletín inmutable de año viejo) es casi seguro; `posible_ciclo_viejo`/`url_generica` son cola de revisión: pueden ser legítimas (OPE plurianual, portal sin página propia). NUNCA repuntar sin confirmar la URL nueva contra fuente oficial.',
  },
  seguimiento_fuente_ciega: {
    title: 'seguimiento_url que responde 200 pero no vigila nada',
    triggerPhrase: 'revisa las fuentes ciegas de seguimiento',
    runbook: 'docs/maintenance/oeps-convocatorias-seguimiento.md',
    claudeHace:
      'para cada oposición señalada, la `seguimiento_url` responde 200 pero el cron no puede vigilarla: el cron hashea el HTML SERVIDO sin ejecutar JS, así que una SPA (o un "página en desuso", o un WAF que contesta 200) devuelve un shell inmutable → hash congelado, `seguimiento_change_status` en `ok` y panel verde SIN vigilancia. Es peor que una URL desfasada porque a ojo humano la página se ve perfecta. Qué hacer: (1) mirar el `nivel` — `pagina_en_desuso` trae la URL nueva en el propio texto (repuntar ahí); `bloqueo_waf` y `redireccion_sin_destino` exigen otra fuente; `shell_sin_contenido` es SPA. (2) Buscar una alternativa SERVIDA EN HTML: página propia del proceso en la web del convocante, ficha por convocatoria del PAG (`administracion.gob.es/pagFront/ofertasempleopublico/detalleEmpleo.htm?idConvocatoria=N`) o, para cuerpos AGE, el índice del CUERPO en INAP sin sufijo de año. (3) Repuntar SIEMPRE con `node scripts/seguimiento/repuntar-url.cjs <slug> <url> --anclas "…"`, que la comprueba con las cabeceras del cron y REHÚSA escribir una URL no vigilable y resetea el hash en la tabla correcta. NUNCA editar `seguimiento_url` a mano: `seguimiento_last_hash` existe en `oposiciones` Y en `convocatorias` y el cron solo usa la de `oposiciones`. Si no hay ninguna URL servida en HTML, dejarla y anotarla como caso de headless-fetcher (T-125). Simulación bajo demanda, sin escribir nada: `node scripts/seguimiento/sim-fuentes-ciegas.cjs [--todos]`.',
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
    comando: 'npm run huerfanos:plan',
    claudeHace: 'localiza los artículos que están en el topic_scope y tienen contenido real pero 0 preguntas activas (al usuario nunca le salen en los tests aunque el tema en conjunto sí tenga preguntas), y genera preguntas ancladas al texto del artículo con doble auditoría ciega antes de activarlas. Excluye derogados.',
  },
  articulo_servido_sin_texto: {
    title: 'Artículos del temario que no tienen NADA que leer',
    triggerPhrase: 'revisa los artículos sin texto',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace:
      'localiza los artículos escopados en un tema vivo que se sirven MUDOS (ni rúbrica ni contenido: el usuario ve el número y el botón «Hacer test», y ni una línea que estudiar) e importa su texto VERBATIM desde la fuente oficial, con la doble auditoría de siempre. NO confundir con «revisa los artículos sin preguntas», que es lo contrario: allí el artículo se lee bien y lo que falta son preguntas. Origen (T-596): hasta el 05/08/2026 el encabezado de la tarjeta colgaba solo de `title`, que 13.952 artículos activos (23% del banco) tienen a NULL TENIENDO el texto guardado, así que se servían mudos 48 de 62 artículos en un tema; el arreglo fue de render (`lib/teoria/encabezadoArticulo`) y este detector vigila lo que queda, que es la deuda de contenido real. Lo destapó un usuario premium, no una alerta.',
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
  psicotecnico_integridad: {
    title: 'Psicotécnicos con la integridad rota (sin sección, sección ajena, clave inválida)',
    triggerPhrase: 'revisa los psicotécnicos',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace:
      'mira los tres invariantes que emite el barrido sobre `psychometric_questions` activas y los repara UNO A UNO contra la fuente, nunca en lote: sin `section_id` (la pregunta existe pero no cae en ninguna sección, así que NO se sirve a nadie) → asignarle la sección que le corresponde por su categoría; sección de OTRA categoría (los totales por categoría mienten y la pregunta sale donde no toca) → corregir el `section_id`, no la categoría, salvo que la materia diga lo contrario; y `correct_option` fuera de 0-3 o nulo (la pregunta no se puede corregir al responderla) → verificar la clave contra el enunciado y las opciones, y si no se puede determinar, desactivar en vez de adivinar. NUNCA fijar una clave a ojo.',
  },
  opciones_duplicadas: {
    title: 'Dos opciones IDÉNTICAS dentro de la misma pregunta (se queda en tres alternativas)',
    triggerPhrase: 'revisa las opciones duplicadas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace:
      'separa las DOS BANDAS antes de tocar nada, porque no son el mismo problema. `error` = la clave está DENTRO del par: da igual cuál de las dos marque el opositor, acierta y falla a la vez, así que la pregunta está rota y se repara hoy. `warn` = el par son dos distractores: la pregunta sigue siendo resoluble (la clave está fuera) pero se sirve con tres alternativas de hecho y se lee descuido. Se repara SIEMPRE reescribiendo una opción que NO sea la clave, dándole el contenido que le falta a la rejilla de la propia pregunta (Uniform/Universal × Locator/Library, natural/artificial × activa/pasiva, las cuatro categorías OMS, los cuatro principios de la bioética): casi siempre la casilla ausente es evidente al leer las otras tres. En las preguntas de «señale la FALSA» el distractor nuevo tiene que ser una afirmación VERDADERA, que es el error fácil de cometer ahí. NUNCA tocar `correct_option`. GOTCHA de medición: lo único que se normaliza es el espacio en blanco — al comparar con `lower()` o con una regex mal escapada salieron fantasmas (un `\\s+` que llegó a SQL como `s+` borraba las eses e igualaba `wardrobes` con `wardrobess`). Y una opción vacía NO forma par: las oposiciones de tres alternativas sirven la D vacía por diseño. El cambio es un UPDATE directo de `questions.option_*` y NO deja rastro en ningún historial, así que la única traza es `updated_at`: anótalo al terminar e invalida la caché `questions`.',
  },
  audit_note_explanation: {
    title: 'Explicación = nota de auditoría (defecto de pipeline)',
    triggerPhrase: 'revisa las explicaciones rotas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'localiza las preguntas visibles cuya "explicación" es en realidad la crítica de un pase IA anterior ("La explicación debería…", "posible errata", "Nota técnica:", "Esta pregunta debería anularse"), verifica la clave contra la ley/fuente y reescribe la explicación (o la manda a needs_human si hay defecto de fondo) con el flujo de `docs/maintenance/revisar-preguntas-con-agente.md`.',
  },
  article_audit_note: {
    title: 'La prosa de auditoría también está DENTRO del temario (no solo en la explicación)',
    triggerPhrase: 'revisa la prosa de auditoría del temario',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'localiza artículos ACTIVOS cuyo `content` —la TEORÍA que el opositor lee en /temario, no la explicación de una pregunta— lleva incrustada la nota de un pase de auditoría anterior (patrón: "esa/esta/dicha/tal afirmación es/resulta incorrecta", con o sin negrita markdown). Por cada hallazgo: contrastar el punto con la FUENTE OFICIAL (nunca reescribir de memoria), reescribir el párrafo afirmando lo que dice la fuente, y revisar las preguntas que cuelgan de ese artículo por si heredaron la confusión — si una pregunta se generó del párrafo confuso, la pregunta también estará mal. Ojo al volumen en los bloques mega-chunk (Correos): el arreglo es de PÁRRAFO, no de artículo entero. NUNCA inventar el dato: si la fuente no lo aclara, quitar la afirmación en vez de adivinarla.',
  },
  law_unverified_source: {
    title: 'Ley sin verificar contra su fuente (falso verde / importada a medias)',
    triggerPhrase: 'revisa la completitud de las leyes',
    runbook: 'docs/runbooks/completitud-leyes.md',
    claudeHace: 'localiza las leyes que sirven en temas vivos sin verificar contra su fuente oficial (`false_green` = marcada "actualizada" sin evidencia, `no_source` = sin URL de fuente, `never_verified`, `incomplete` = faltan artículos), registra la fuente que falte, compara artículo por artículo contra el boletín oficial e importa lo que falte (verbatim, doble auditoría) — NUNCA marca verificada sin evidencia.',
  },
  law_source_changed: {
    title: 'La fuente oficial de una ley ha CAMBIADO desde que la verificamos',
    triggerPhrase: 'revisa los cambios de fuentes legales',
    runbook: 'docs/runbooks/completitud-leyes.md',
    claudeHace: 'corre `npm run laws:vigilar` (vigilancia por HASH de las fuentes que el cron `check-boe-changes` NO cubre: sin `boe_url`, URL `doc.php` o `scope=eu` — 160 leyes reales sirviendo 4.893 preguntas). Para cada ley marcada CAMBIADA: descarga la fuente, compara con nuestros artículos, decide si el cambio afecta al articulado que servimos y actualiza lo que toque; después re-verifica con `verify-law-source.cjs` para fijar la nueva línea base. **No hay ningún LLM en la detección, a propósito**: el hash dice QUE cambió, el juicio sobre QUÉ cambió lo pone Claude. GOTCHA: `inaccesible` NO es un cambio — si una fuente lo repite, el problema es de acceso (WAF/captcha, como el BORM el 31/07) y toca fetcher headless, no tocar el contenido. Y NUNCA re-verificar sin abrir el documento: pisar la línea base silencia el aviso sin haber mirado nada.',
  },
  article_annulled_unmarked: {
    title: 'Inciso anulado por el TC (o disposición derogada) servido sin nota de vigencia',
    triggerPhrase: 'revisa los incisos anulados',
    runbook: 'docs/runbooks/incisos-anulados-tc.md',
    claudeHace: 'corre `scripts/audit-annulled-provisions.cjs` (cruza el análisis del BOE datosabiertos — referencias posteriores "SE DECLARA … inconstitucional/nulidad … art. N" — con nuestros artículos) y `node scripts/audit-notas-vigencia-tc.cjs "<ley>"`, que va al TEXTO CONSOLIDADO artículo por artículo y caza además los pronunciamientos COMPETENCIALES ("no es conforme con el orden constitucional de competencias"), invisibles para el primero porque el análisis del BOE no los enumera por artículo. Para cada hallazgo verifica el inciso contra la sentencia y añade la nota de vigencia. OJO a la diferencia de remediación: en `nulidad` el inciso NO existe → REVISAR la clave de las preguntas de ese artículo; en `competencial` el precepto NO es nulo (es inaplicable como básico o en CCAA con competencia propia) → basta la nota, NO se jubilan preguntas. NUNCA auto-corrige la clave: revisión humana como en el caso art. 126.2 LBRL / STC 103/2013. Si el barrido sale "NO CONCLUYENTE", es que muchos artículos no se localizaron en el índice del BOE: no interpretar la ausencia de hallazgos como limpio.',
  },
  hito_registro_sin_fuente: {
    title: 'Hito que se muestra como fecha OFICIAL sin ninguna fuente',
    triggerPhrase: 'revisa las fechas sin fuente',
    runbook: 'docs/runbooks/rollover-oposiciones.md',
    claudeHace:
      'para cada hito señalado, comprueba su fecha contra el boletín de esa convocatoria. Si el boletín la publica, añade la cita (url + cita_literal) y el hito se queda como `registro`. Si NO consta en ninguna fuente, degrádalo con `node scripts/convocatoria/degradar-origen-hito.cjs --hito <uuid> --verificado "<qué miraste y qué decía>" --apply`, que es la única vía y deja traza. Los que el propio título confiesa como previsión se degradan en bloque con `--autocontradictorios`. NUNCA rellenar la cita con una URL genérica del boletín para callar el check: convierte un dato dudoso en uno que PARECE verificado. Y ojo: «sin fuente» no es «inventada» — si la fecha coincide con un campo verificado de la convocatoria, lo que falta es provenance, no verdad.',
  },
  scope_phantom_article: {
    title: 'Artículo escopado sin fila activa en la BD (inexistente o desactivado)',
    triggerPhrase: 'revisa los artículos fantasma del scope',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    claudeHace: 'para cada ley señalada, coge los números escopados en topic_scope que no tienen fila ACTIVA en articles (mismo law_id): si es `inexistente` y la ley SÍ tiene ese artículo en su fuente oficial (BOE), lo importa verbatim (doble auditoría) y genera las preguntas que falten; si es `desactivado` (existe con is_active=false, a veces con preguntas ya listas), lo reactiva tras revisar por qué se desactivó; si la ley NO lo tiene (over-scope), lo quita del article_numbers. NUNCA inventa el artículo ni deja el número colgado sirviendo 0 preguntas/teoría en silencio.',
  },
  scope_titulo_huerfano: {
    title: 'Título con preguntas huérfanas (hueco interno del temario)',
    triggerPhrase: 'revisa los huecos del temario',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    claudeHace: 'para cada oposición señalada corre el pipeline verify:scope (dump → 2 agentes epígrafe↔scope → consenso): el detector marca un título de una ley que la oposición usa, con preguntas activas y flanqueado a ambos lados por artículos escopados, pero con 0 artículos suyos en el scope. Decide contra el epígrafe oficial si el hueco es REAL (el epígrafe nombra ese título → añade su rango de artículos al topic_scope del tema que corresponde, reusando las preguntas ya en BD) o LEGÍTIMO (el programa no lo incluye → dejarlo). NUNCA añade un título que el epígrafe no pida ni quita contenido que sí pida.',
  },
  scope_over_inclusion_suspect: {
    title: 'Scope más ancho que el epígrafe (mete casi la ley entera)',
    triggerPhrase: 'revisa la sobre-inclusión del temario',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    claudeHace: 'para cada tema señalado (banda HIGH: el epígrafe cita títulos con huecos o artículos concretos pero el scope mete casi toda la ley) corre el adjudicador verify:scope: obtén la estructura oficial de la ley (títulos/capítulos y sus rangos), mapea cada materia que NOMBRA el epígrafe a su título/capítulo, y LISTA los títulos con preguntas escopadas que el epígrafe NO nombra. Si el epígrafe realmente acota (deja títulos fuera), recorta el article_numbers a lo que pide el epígrafe (las preguntas fuera de programa quedan en BD, dejan de servirse en ese tema); si el epígrafe abarca de verdad toda la ley, es falso positivo y se deja. NUNCA recortes un bloque que el epígrafe sí pide ni des por buena la ley entera sin mapear su estructura (ese atajo fue el falso verde del caso T11).',
  },
  scope_over_inclusion_confirmed: {
    title: 'Recorte de scope ya adjudicado contra la fuente oficial y sin aplicar',
    triggerPhrase: 'revisa los recortes de temario pendientes',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    comando: 'npm run scope:pendientes',
    claudeHace: 'corre `npm run scope:pendientes` (la cola sale ordenada por IMPACTO: artículos que salen del scope al recortar) y aplica de MENOR a mayor con el flujo probado: propuesta `[{tema, veredicto:[{ley, quitar, anadir, razon}]}]` → `node scripts/verify-topic-scope.cjs plan <pt> <json>` → `apply <pt> --include-gate` (¡SIN pasarle el jsonPath: con él falla EN SILENCIO, sin COMMIT — verifica en BD que el scope cambió antes de darlo por aplicado!) → marcar la fila con `razon=\'[RECORTE APLICADO …]\'` o correr `--reguard`. Los de impacto grande (>150 preguntas) y las interpretaciones institucionales NO se auto-aplican: exigen releer el epígrafe oficial y, si toca, decisión de Manuel. Si el recorte deja la ley a 0 artículos, se quita la FILA de topic_scope entera, no se vacía el array. NUNCA apliques un recorte sin comprobar antes que su adjudicación sigue casando con el scope actual (el scope pudo cambiar desde que se adjudicó).',
  },
  scope_title_boundary_overflow: {
    title: 'Artículo escopado de un título que el epígrafe NO nombra (off-by-one de frontera)',
    triggerPhrase: 'revisa las fronteras de título del temario',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    claudeHace: 'corre el runner on-demand `npx tsx scripts/scope/sim-title-boundary.ts <position_type> [topic]` (núcleo puro lib/laws/scopeTitleBoundary.js sobre la estructura título→rango del índice del BOE): lista los artículos escopados cuyo TÍTULO no aparece en el epígrafe (caso raíz LOSU/Mario 24/07: art.1 = Título Preliminar y art.6 = Título III en un epígrafe que solo pide Título I, II y IX Cap I). OJO: es alta-recall/baja-precisión (no pinga badge) — muchos epígrafes nombran el título por su MATERIA, no por su número, así que hay falsos positivos; ADJUDICA cada candidato: verifica contra el BOE si el epígrafe nombra ese título por número O por rúbrica. Solo si el epígrafe no lo pide de ninguna forma, recorta esos artículos del article_numbers (las preguntas quedan en BD, dejan de servirse en ese tema) + revalida cache temario/test-counts. Distinto de la sobre-inclusión (aquí el scope es AJUSTADO, solo se cuela 1-2 arts en la frontera); lo introduce verify:scope al razonar por rango contiguo en vez de por pertenencia real al título. NUNCA recortes un artículo que el epígrafe sí pide.',
  },
  answer_in_annulled_fragment: {
    title: 'Pregunta activa cuya clave reproduce un inciso ANULADO por el TC',
    triggerPhrase: 'revisa los incisos anulados',
    runbook: 'docs/runbooks/incisos-anulados-tc.md',
    claudeHace: 'para cada artículo señalado verifica la clave de la pregunta contra la sentencia del TC: el gate (≥60 car. de la clave dentro del inciso anulado) es un CANDIDATO, no un bug confirmado — hay falsos positivos cuando la clave y el inciso comparten la cláusula inicial pero difieren en el fondo. Si la clave reproduce de verdad el texto anulado, corrige (nota de vigencia en el artículo + revisar la pregunta); NUNCA auto-flip de clave.',
  },
  plazas_afirmadas_sin_documento: {
    title: 'Cifra de plazas afirmada en la landing sin ningún documento que la contenga',
    triggerPhrase: 'revisa las plazas sin documento',
    runbook: 'docs/runbooks/provenance-convocatorias.md',
    comando: 'npm run audit:convocatorias',
    claudeHace: 'para cada oposición señalada corre `npm run audit:convocatorias` y mira su bloque plazas_afirmadas_sin_documento. Una cifra de plazas solo puede ser un HECHO (y entonces algún documento de convocatoria_documentos la contiene, en dígitos o en letra) o una PREVISIÓN (y entonces se declara con plazas_prevision + motivo). Resolver en este orden: (1) comprobar si el documento que la prueba simplemente no está clonado y clonarlo desde su URL oficial; (2) si el documento clonado NO es el que prueba la cifra (pasa cuando se clonó el menú del portal en vez del anuncio), clonar el bueno; (3) si la cifra sale de sumar literales DEL MISMO documento (turno libre desglosado), firmarla en convocatoria_verification con la clave cifra_derivada en findings explicando la cuenta y citando los sumandos; (4) si la cifra no la sostiene nada, corregirla contra el boletín o marcarla plazas_prevision. NUNCA inventar la cifra ni firmar cifra_derivada para callar el aviso: esa válvula existe para aritmética sobre literales, y «lo sumé yo» es exactamente lo que se dijo del 2.163 de Policía Nacional, que era una invención.',
  },
  reserva_discapacidad_sin_declarar: {
    title: 'Convocatoria que no declara si el cupo de discapacidad va DENTRO del turno libre o APARTE',
    triggerPhrase: 'declara el cupo de discapacidad',
    runbook: 'docs/runbooks/provenance-convocatorias.md',
    comando: 'npm run reserva:declarar',
    claudeHace: 'corre `--proponer`: barre las convocatorias con cupo sin declarar, propone con la EVIDENCIA y los números que casaron, y separa las dos colas — las que piden LEER (el documento está, la forma es nueva) y las que piden CLONAR el boletín (eso es plazas_afirmadas_sin_documento, no esto). Sin declarar, `oposiciones_ssot` SUMA el cupo por defecto, así que cada fila en NULL puede estar inflando el total publicado (la UNED publicaba 60 donde el BOE convoca 54) y la landing calla la reserva. Declarar con `--slug=… --incluidas=true|false --cita="<literal>" --url=… --motivo="…" --apply`; la guarda exige que la cita NOMBRE el cupo y contenga el total que la declaración implica (o que enumere los dos cupos). Al leer: «del total … se reservan N» NO significa siempre dentro — depende de qué total guardemos; las tablas se resuelven por posición (nuestra cifra cierra la fila = dentro; la abre y la fila cierra con la suma = aparte); y el total va en LETRAS a menudo. Si la guarda rechaza un «aparte» porque falta NUESTRA cifra en la cita, sospechar que esa cifra es una RESTA nuestra (Ujieres 40-4, INGESA 9-2): corregirla antes con corregir-plazas-contra-boletin.cjs y declarar después. NUNCA declarar por analogía ni por la suma más redonda —se lee en el boletín o se deja sin declarar— y NUNCA dar una oposición por declarada: se declara un CICLO, y un rollover nace en NULL.',
  },
  convocatoria_docs_incompletos: {
    title: 'Provenance de convocatoria incompleta (documento referenciado sin clonar/enlazar)',
    triggerPhrase: 'revisa la provenance de convocatorias',
    runbook: 'docs/runbooks/provenance-convocatorias.md',
    claudeHace: 'para cada oposición señalada lee la vista convocatoria_docs_coverage: primero enlaza lo ya clonado sin fetch (scripts/backfill-hito-source-documento.cjs --apply), luego clona los documentos referenciados que falten desde su URL oficial (backend/scripts/clonar-documento.ts, con content_hash + snapshot, tipo real no "nota") y enlaza source_documento_id, y resuelve las citas sin fuente. NUNCA clona sin verificar la URL oficial ni fabrica cita/hash; si la URL da 403/está caída deja el hueco anotado. Los hitos huérfanos (convocatoria_id NULL) se asignan primero a su convocatoria mirando la fecha del hito.',
  },
  temario_revision_pendiente: {
    title: 'Temario por revisar contra su convocatoria vigente (sin verificar del todo)',
    triggerPhrase: 'revisa las revisiones de temario pendientes',
    runbook: 'docs/roadmap/temario-versionado-por-convocatoria.md',
    claudeHace: 'lista la cola con scripts/temario/detect-temario-revision.cjs (oposiciones activas cuya convocatoria vigente tiene el temario no verificado del todo contra su fuente oficial, priorizadas por usuarios). Para cada una, por orden de usuarios: baja el temario oficial del programa_url de la convocatoria (clonándolo al hub, cero re-descarga), corre el pipeline T-107 (verify:epigrafe dump→workflow→plan→apply y verify:scope) contra la fuente, y aplica los diffs (que suelen ser pequeños — el temario es estable pero SIEMPRE cambia algo entre convocatorias) al temario VIVO. NUNCA auto-aplicar sin verificar contra el boletín; el temario es contenido legal. Extremadura Auxiliar es el caso raíz (25/25 en drift, temario parafraseado que no casa con el Anexo IV 2024).',
  },
  epigrafe_provenance_no_doc: {
    title: 'Epígrafe verified_literal sin documento del hub enlazado (provenance huérfana)',
    triggerPhrase: 'revisa la provenance de epígrafes',
    runbook: 'docs/runbooks/provenance-convocatorias.md',
    claudeHace: 'para cada oposición señalada, los epígrafes están marcados verified_literal pero sin source_documento_id → se validaron contra una URL suelta, no contra el documento clonado del hub convocatoria_documentos. Si tienen source_url, enlázalos con scripts/provenance/link-epigrafe-docs.cjs --apply (canonicaliza → ensure_convocatoria_documento → fija source_documento_id). Si NO tienen source_url (verificados antes del hub), re-sourcéalos: baja el temario oficial del programa_url y corre verify-epigrafe-literality.cjs record con source_url (que ya enlaza al hub). NUNCA marcar verified_literal sin fuente ni fabricar la URL.',
  },
  plazas_reserva_sin_declarar: {
    title: 'Plazas publicadas con una suma que puede ser falsa (reserva de discapacidad sin declarar)',
    triggerPhrase: 'revisa las plazas de reserva sin declarar',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace:
      'la convocatoria tiene reserva de discapacidad pero NO declara si va DENTRO del turno libre o APARTE ' +
      '(`convocatorias.plazas_discapacidad_incluidas IS NULL`). La vista SSOT tiene que dar un número, así que ' +
      'supone que van aparte y SUMA: si en realidad iban dentro, estamos publicando plazas que no existen. ' +
      'Abre el boletín de esa convocatoria (`programa_url`/`boe_reference`), busca el reparto por turnos y ' +
      'DECLARA la columna: true si la reserva está incluida en el total del turno libre, false si se suma. ' +
      'NUNCA suponer — es preferible dejarlo sin declarar que declarar mal. Origen: una usuaria vio 51 plazas ' +
      'en el catálogo del Ayuntamiento de Sevilla cuando la convocatoria tiene 46 (29/07/2026); el bug de código ' +
      'que sumaba en todas las superficies ya está arreglado y con guardarraíl ' +
      '(`__tests__/guardrails/plazasReservaDiscapacidad.test.ts`), esto vigila el hueco de DATOS que queda. ' +
      'Núcleo: `lib/convocatoria/reservaSinDeclarar.cjs`; la regla de presentación, `lib/convocatoria/reservaDiscapacidad.ts`.',
  },
  epigrafe_ruido_boletin: {
    title: 'Epígrafe con la cabecera/pie del PDF del boletín incrustada',
    triggerPhrase: 'revisa los epígrafes sucios',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace:
      'el epígrafe se trajo el pie del PDF del boletín al importarlo, a veces PARTIENDO LA FRASE por la mitad ' +
      '(caso ordenanza-ayuntamiento-cordoba T8). Compara el epígrafe contra el temario oficial del programa_url ' +
      'y limpia SOLO el artefacto de maquetación, sin reescribir la materia. Envenena dos cosas: la verificación ' +
      'de literalidad compara contra un texto que ya no es el programa, y la adjudicación epígrafe↔scope por LLM ' +
      'razona sobre basura. OJO: «Depósito legal» es materia legítima en biblioteconomía — el detector ya no lo ' +
      'marca solo, pero al limpiar a mano no lo borres.',
  },
  explicacion_estructura_rota: {
    title: 'Explicación estructurada que se renderiza rota',
    triggerPhrase: 'revisa las explicaciones descuadradas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace:
      'la explicación es correcta de fondo pero se PINTA rota: casi siempre un `**` sin pareja en la razón de ' +
      'una opción, herencia de la transcripción del histórico, que partía «**A) Insertar** — …» y se quedaba ' +
      'con «Insertar** — …» (el opositor ve un asterisco doble suelto en mitad de la frase). Repáralo quitando ' +
      'la repetición del enunciado de la opción y el asterisco huérfano: la razón debe explicar POR QUÉ falla, ' +
      'no repetir lo que la opción ya dice. Reescribe con `scripts/aplicar-explicacion.ts` para que estructura ' +
      'y texto queden coherentes. NO toques la clave ni el contenido: esto es un defecto de FORMA. Ojo con la ' +
      'rama de la cita: si `cita.bloque` está relleno, el render pinta la cita entera y NO hay defecto.',
  },
  explicacion_truncada: {
    title: 'Explicación cortada a mitad de frase',
    triggerPhrase: 'revisa las explicaciones cortadas',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace:
      'la explicación termina EN SECO y falta lo que venía detrás: «…los miembros del Cuerpo Nacional de», ' +
      '«…optar por la vecindad civil del otro», «…tres años de». NO confundir con «revisa las explicaciones ' +
      'descuadradas», que es el texto entero pintado mal; aquí falta texto. El criterio es GRAMATICAL y no ' +
      'ortográfico, y eso es lo que hace usable el detector: «no acaba en punto» da 8.938 sobre 136.310 y casi ' +
      'todas son correctas (cierran con la referencia de la fuente, con una URL, o están mal puntuadas pero ' +
      'completas); mirar si la ÚLTIMA PALABRA pide continuación —preposición, conjunción, determinante— o si ' +
      'acaba en coma deja 112, con 20 de 20 correctos en muestra aleatoria. Repáralo COMPLETANDO la frase ' +
      'contra el artículo vinculado, nunca poniendo un punto donde se cortó: el punto tapa el hueco y deja al ' +
      'opositor sin la parte que faltaba. Núcleo `lib/health/explicacionTruncada.cjs`; para ver la cola de ' +
      'trabajo por exposición, `npm run audit:explicacion-truncada`.',
  },
  explicacion_yuxtaposicion: {
    title: 'La explicación reproduce la opción FALSA con la palabra buena pegada, sin veredicto',
    triggerPhrase: 'revisa las explicaciones que reproducen la opción falsa',
    runbook: 'docs/runbooks/salud-contenido.md',
    comando: 'npm run audit:explicacion-yuxtaposicion',
    claudeHace:
      'la explicación (plantilla de viñetas `- A) …`) reproduce la opción FALSA casi carácter por carácter, con la palabra corregida ' +
      'PEGADA detrás o delante y SIN decir en ningún momento que esa opción es incorrecta: «- A) Art. 5.1: La delimitación de las ' +
      'competencias de la Unión se rige por el principio de cooperación leal atribución.» — «atribución» es la corrección, pegada sin ' +
      'coma ni veredicto a la frase FALSA. El opositor falla, lee la "explicación" y no tiene forma de distinguir el texto legal real ' +
      'del inventado (lo cazó Adrián Castelló, impugnación `b061898d`). NO confundir con «revisa las explicaciones descuadradas» (defecto ' +
      'de FORMATO) ni con «revisa las citas» (juzga el blockquote; aquí no hay blockquote). Reparar diciendo QUÉ PALABRA SOBRA y CUÁL ES ' +
      'LA DEL PRECEPTO contra el artículo vinculado —poner un «INCORRECTA» delante NO basta, hay que decir la corrección explícita, que es ' +
      'justo lo que la yuxtaposición se calla— y reescribir con `scripts/aplicar-explicacion.ts`. En las 26 de examen oficial: tocar SOLO ' +
      'la explicación, nunca el enunciado ni las opciones. NUNCA auto-corregir la clave. Núcleo `lib/health/explicacionYuxtaposicion.cjs` ' +
      '(CLI-only: compara, opción por opción, el segmento contra el texto de la opción, y eso no cabe en un `WHERE`).',
  },
  vinculo_articulo_vecino: {
    title: 'Pregunta colgada de un artículo que no la responde (lo hace un vecino)',
    triggerPhrase: 'revisa los vínculos al artículo vecino',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace:
      'corre `npm run audit:vinculo-vecino` (BAJO DEMANDA: precisión ≈1 de cada 3, por eso NO pinga el badge). ' +
      'Cada línea es una SOSPECHA: abre el artículo vinculado y el sugerido en el BOE y mira cuál responde ' +
      'LITERALMENTE la opción correcta. Solo entonces re-vincula `primary_article_id`. OJO con las preguntas que ' +
      'abarcan varios artículos a la vez («¿en qué sección de la Constitución se reconoce el derecho de huelga?»): ' +
      'ahí el vínculo actual suele ser tan defendible como el sugerido. NUNCA re-vincular por cercanía de número. ' +
      'Al re-vincular, comprueba que el artículo destino está escopado en los mismos temas o la pregunta cambia de sitio.',
  },
  pregunta_instrumento_derivado: {
    title: 'Pregunta que pide el contenido de un Plan/Estrategia que la ley solo manda crear',
    triggerPhrase: 'revisa las preguntas de planes y estrategias',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace:
      'corre `npm run audit:instrumento-derivado` (BAJO DEMANDA, NO pinga el badge; acota con `-- --ley <texto>`). ' +
      'Es el HERMANO de `vinculo_articulo_vecino` y cubre su punto ciego: allí el vínculo está mal y un artículo ' +
      'vecino sí responde; aquí NO responde ninguno, porque la respuesta vive en un documento que la ley se limita ' +
      'a ordenar (el Plan Estratégico, el Informe de Impacto de Género). El opositor abre el artículo desde la ' +
      'pregunta y no hay nada que leer. Para cada línea, abre el artículo y decide entre DOS arreglos: importar el ' +
      'instrumento como contenido propio (si el epígrafe lo pide), o RETIRAR la pregunta (`retired_irreparable`). ' +
      'NUNCA cambiar la clave para que encaje con el artículo. Lee la banda: `error` = el artículo nombra el ' +
      'instrumento y nadie contiene la respuesta (caso limpio); `warn` = la clave es demasiado corta para medirla ' +
      'por solape de palabras (un órgano, una fecha, una cifra) y hay que LEERLA — ahí es donde apareció una clave ' +
      'equivocada: «¿quién publica la memoria?» respondía «el Instituto Andaluz de la Mujer» cuando el artículo ' +
      'solo dice que ASESORA. Mira también el epígrafe del tema: si dice «aspectos generales de la normativa», el ' +
      'contenido interno de un Plan no entra en programa.',
  },
  scope_cross_tema_dup: {
    title: 'Misma ley duplicada entre temas (repartir por materia)',
    triggerPhrase: 'revisa las leyes duplicadas entre temas',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    claudeHace: 'corre `npm run scope:health -- --pending` para ver qué ley está duplicada en qué oposición/temas (bucket REPARTO). Para cada una: mira los epígrafes de los temas hermanos que comparten la ley entera, decide qué parte de la ley pide cada uno (por título/capítulo/materia), y REPARTE el article_numbers entre ellos con simulación orphan-check (la unión debe conservar todas las preguntas). NO huerfanes preguntas; si dos epígrafes cubren legítimamente el mismo bloque (cross-cutting, solape pequeño), déjalo. Contenedores de contenido clínico (NULL) compartidos entre temas hermanos suelen ser legítimos (no partibles por artículo).',
  },
  scope_sin_verificar: {
    title: 'Scope sin auditar contra el epígrafe oficial (nunca verificado o stale)',
    triggerPhrase: 'revisa los scopes sin verificar',
    runbook: 'docs/runbooks/verificar-epigrafes-scope.md',
    claudeHace: 'para cada oposición marcada, su topic_scope nunca se ha auditado contra el epígrafe oficial (state never_verified) o quedó `stale` tras un cambio — es un punto ciego: podría servir preguntas fuera de programa sin que salte ningún otro detector (caso Auxiliar Extremadura 25/07). Lanza el pipeline verify:scope de esa oposición: `npm run verify:scope dump <position_type>` → Workflow `verify-scope-oposicion` (2 agentes anclados al BOE/boletín + juez) → `verify:scope plan` → `verify:scope apply` (recorta lo que el epígrafe no pide, reusando las preguntas ya en BD; nada se borra). Prioriza las de más ventas/tráfico. NUNCA recortar un bloque que el epígrafe sí pide ni dar por buena la ley entera sin mapear su estructura.',
  },
  shuffle_safe_regressed: {
    title: "Barajado: pregunta 'safe' cuya explicación cita letras/posición (regresión)",
    triggerPhrase: 'revisa el barajado',
    runbook: 'docs/roadmap/barajar-opciones-verificacion-robusta.md',
    claudeHace: 'para cada pregunta señalada (shuffle_safety=safe cuya explicación referencia una opción por letra/número/posición) confirma que barajar rompería la explicación y bájala a unsafe vía record_shuffle_safety, o reescribe la explicación a formato sin letras (Fase 2) si procede. Si el finding reporta hash desincronizado, re-verifica (el trigger debería haberla puesto stale). Es un miss del detector/auditoría LLM o una edición no invalidada. NUNCA dejar barajable una explicación letra-anclada ni auto-editar la explicación sin verificar la clave.',
  },
  shuffle_narrativa_letra_clavada: {
    title: 'Barajado: el intro/outro de una explicación estructurada clava la letra',
    triggerPhrase: 'revisa el barajado',
    runbook: 'docs/roadmap/barajar-opciones-verificacion-robusta.md',
    comando: 'npm run shuffle:narrativa',
    claudeHace:
      'la pregunta tiene explicación ESTRUCTURADA (razones keadas a cada opción, letra puesta por el render) y aun así su `intro` o su `outro` nombran una opción por su letra —típicamente «La respuesta correcta es la **C**.», heredado al transcribir el histórico—. Esos dos campos se emiten VERBATIM en cualquier orden, así que al barajar el recuadro dice una letra arriba y otra en la cabecera que calcula el render: se contradice solo. Remedio: PODAR la letra de la narrativa, no reescribir las razones (que están bien). En estilo `impugnacion` el render regenera la apertura con la letra correcta, así que el texto en orden natural queda idéntico; en `boletin` la cabecera «Por qué C es correcta» ya la anuncia, así que la línea sobra. Herramienta: `npm run shuffle:narrativa -- --pregunta <id> --apply` (dry-run por defecto, muestra el antes/después y separa las que requieren criterio humano). NUNCA tocar las razones ni la cita para arreglar esto, y NUNCA marcar `safe` a mano: el gate de serve ya se niega a barajarlas mientras la letra siga ahí.',
  },
  shuffle_veredicto_criterio_viejo: {
    title: 'Barajado: veredictos que el detector de HOY contradice (mejoró el criterio y nadie los recalculó)',
    triggerPhrase: 'revisa el barajado',
    runbook: 'docs/roadmap/barajar-opciones-verificacion-robusta.md',
    comando: 'npm run shuffle:recriterio',
    claudeHace:
      'la causa es la INVERSA de los otros dos hallazgos de barajado: aquí el contenido de la pregunta no se ha movido — se ha movido el CRITERIO. El trigger de invalidación compara el hash del CONTENIDO, así que cuando se afina `explanationReferencesLetters` el veredicto viejo se queda escrito y la mejora del detector nunca llega al banco. Medido dos veces: el endurecimiento de las tildes (28/07) dejó 21 preguntas mal marcadas OCHO DÍAS, y el de los grados centígrados (T-301) otras 91 hasta que una sesión tropezó con ellas. Remedio: correr `backfill-shuffle-safety.ts --recriterio` (dry-run, lista cada cambio y su dirección), LEER la salida y aplicar con `--apply`. Está acotado por SQL a los veredictos que firmó el propio backfill determinista, así que no puede pisar los de la auditoría LLM. Un `unsafe→safe` masivo tras un arreglo del detector es lo esperado; un `safe→unsafe` masivo NO: eso es señal de que el detector se ha roto, y por eso el script aborta pasados 2000 cambios. Después, comprobar que el barrido vuelve a dar 0 en este kind y que `shuffle_safe_regressed` sigue en 0. NUNCA tocar `shuffle_safety` a mano ni subir el techo de `--max` para que pase.',
  },
  shuffle_encendido_sin_efecto: {
    title: 'Barajado encendido pero sin efecto (o sin rastro): ninguna respuesta guarda el orden',
    triggerPhrase: 'revisa el barajado',
    runbook: 'docs/roadmap/barajar-opciones-verificacion-robusta.md',
    claudeHace:
      'la bandera FEATURE_SHUFFLE_OPTIONS está activa y aun así NINGUNA respuesta reciente guarda `option_order`. Son dos escenarios muy distintos y hay que distinguirlos ANTES de tocar nada: (1) el servidor no está barajando de verdad → el piloto es inerte y los datos que se estén usando para juzgarlo no valen; (2) el servidor SÍ baraja y la permutación no vuelve al guardar → el servidor corrige la posición MOSTRADA contra la clave ORIGINAL y está registrando FALLOS FALSOS en silencio (la fila queda coherente consigo misma, así que después es indetectable). Para distinguir: `npx tsx scripts/sim/sim-shuffle-extremo-a-extremo.ts <position_type>` ejecuta la función real de servir con las banderas de producción y dice si devuelve preguntas permutadas; y `observable_events` con event_type=shuffle_options_served trae el orden por pregunta que se sirvió de verdad. Si es el escenario (2): APAGAR la bandera primero (SSM + force-new-deployment, ECS lee los secretos al arrancar) y diagnosticar después; ese daño NO se puede reparar sin el evento de servido, porque la permutación usa un nonce aleatorio por exposición. Caso raíz 28/07/2026: el piloto de Valencia llevaba 8 horas encendido con option_order a NULL en el 100 % de las filas y nada avisó. NUNCA reactivar el piloto sin comprobar en la primera hora que option_order deja de estar a NULL.',
  },
  cita_no_literal: {
    title: 'La cita en blockquote no aparece en el artículo vinculado',
    triggerPhrase: 'revisa las citas',
    runbook: 'docs/runbooks/salud-contenido.md',
    comando: 'npm run citas:barrido',
    claudeHace:
      'la explicación presenta como CITA LITERAL (blockquote) un texto que no está en el artículo vinculado. Cada hallazgo es una de dos cosas, y las dos son defecto: (a) cita inventada o parafraseada —el caso típico: un resumen con paréntesis vendido como texto de la ley—, o (b) la pregunta está MAL VINCULADA y la cita es de otro artículo. Solo se reportan las AJENAS (solape <0.5); las `retocadas` (el artículo dice lo mismo y la cita solo está reformateada) no son defecto y quedan fuera a propósito. Para cada una: leer el artículo REAL —contra el BOE, no contra nuestra copia— y decidir si se corrige la cita o se re-vincula el artículo; si se re-vincula, comprobar antes el impacto de colocación (el artículo decide en qué tema aparece la pregunta). Reescribir la explicación con `scripts/aplicar-explicacion.ts` y pasarla por `validar-explicacion.cjs`, que es el mismo criterio que produjo el hallazgo. NUNCA auto-corregir la clave ni dar por buena la cita porque "suene" al artículo. Medido el 29/07: 1.032 no literales de 17.470 que pretenden serlo, pero solo 15 AJENAS (8 ya vistas por usuarios).',
  },
  enunciado_norma_sin_nombrar: {
    title: 'Enunciado que cita un artículo de una norma que no nombra',
    triggerPhrase: 'revisa los enunciados sin norma',
    runbook: 'docs/runbooks/salud-contenido.md',
    comando: 'npm run enunciados:sin-norma',
    claudeHace:
      'para cada pregunta señalada, el enunciado cita un artículo «de la ley» / «de la normativa» sin decir NUNCA de cuál se trata («Según el artículo 75 de la ley, ¿cuál es el contenido mínimo…?»). Incumple la §2.2-quater del manual de generación (cada pregunta debe ser AUTOCONTENIDA): los tests salen barajados y sueltos, así que el opositor no tiene ese contexto. El dato para arreglarlo YA está en la BD: la pregunta cuelga de un artículo y ese artículo tiene su ley, así que se reescribe el enunciado nombrándola («Según el artículo 75 de la Ley 9/2017, de Contratos del Sector Público, …»). Ir por LEY, no pregunta a pregunta: el defecto viene de remesas de generación enteras y dentro de una ley el arreglo es el mismo. NUNCA tocar el enunciado de una pregunta de examen OFICIAL (ahí el enunciado es el que salió publicado; si aparece alguna, se deja), ni cambiar opciones, clave o explicación al hacerlo. Gate hermano que vigila la otra mitad de la misma regla al GENERAR: lib/generacion/siglasSinDesarrollar.js (siglas sin desarrollar).',
  },
  cobertura_banda_ciega: {
    title: 'Tema con baja cobertura de artículos y pocas preguntas para notarlo (banda ciega, T-543)',
    triggerPhrase: 'revisa la banda ciega de cobertura',
    runbook: 'docs/runbooks/salud-contenido.md',
    comando: 'npm run huerfanos:plan',
    claudeHace: 'para cada tema marcado, mira `npm run huerfanos:plan -- --oposicion <slug>` (deuda completa, sin acotar al badge) para ver TODOS los artículos huérfanos de esa oposición, incluidos los que no disparan ningún otro finding. Prioriza los temas con MENOS preguntas servidas (se notan antes al estudiar) y genera preguntas ancladas al artículo con doble auditoría ciega, mismo pipeline que `article_no_coverage`. Es la banda que queda ENTRE `article_no_coverage` (exige ≥60% cubierto) y `low_coverage` (exige <6 preguntas): un tema con cobertura de artículos <60% pero con las preguntas suficientes (6-50) para que un opositor note la repetición dentro de una sola sesión de estudio. NUNCA bajar el umbral de `article_no_coverage` al 60% para "arreglarlo" — eso inunda el badge con 218 hallazgos de golpe (medido 05/08); este detector existe precisamente para no tener que hacerlo.',
  },
  visual_deixis_no_image: {
    title: 'Pregunta que invoca una imagen que no existe',
    triggerPhrase: 'revisa las preguntas sin imagen',
    runbook: 'docs/runbooks/salud-contenido.md',
    claudeHace: 'localiza las preguntas activas cuyo enunciado apunta a un icono/símbolo/imagen ("el siguiente icono", "el siguiente símbolo", "observa la figura", "las restas de la imagen") pero tienen image_url NULL → son irresolubles (nadie ve el gráfico). Para cada una: si el enunciado/opciones ya describen el visual en texto, es autocontenida (dejar); si necesita la imagen y hay fuente oficial recuperable, reconstruir la imagen; si no hay fuente, jubilar con transition_question_state(admin_image_unavailable → retired_irreparable). NUNCA inventar la imagen ni fijar una clave a ciegas.',
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
