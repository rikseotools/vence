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
  actualizar_articulo_oficial: {
    titulo: 'Poner al día el `content` de artículos contra su fuente oficial (normas UE: EUR-Lex)',
    ruta: 'scripts/actualizar-articulo-oficial.cjs',
    estado: 'vivo',
    escribe: ['content'],
    runbook: 'docs/maintenance/generar-preguntas-con-ia.md',
    notas:
      'Dry-run por defecto. Hermano de `reactivar_articulo_boe`, que reactiva UN artículo apagado ' +
      'contra el BOE; esto pone al día EN TANDA el texto de artículos ACTIVOS. Nace de T-184: el ' +
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
  duplicados_exactos: {
    titulo: 'Duplicados EXACTOS del banco: simula el barrido y jubila los sobrantes por lotes',
    ruta: 'scripts/calidad/duplicados-exactos.cjs',
    estado: 'vivo',
    escribe: ['lifecycle_state'],
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
      'lote del 21/03 se saldó con 287 jubiladas y 3 apartadas por la guarda.',
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
