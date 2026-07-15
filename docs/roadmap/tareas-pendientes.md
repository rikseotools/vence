# 📋 Tareas pendientes (backlog general, sin fecha)

> **Fuente única de las tareas que Manuel aparca para "luego".** Es el sitio canónico del backlog
> **sin fecha** (para tareas **con fecha** → memoria `agenda_tareas_programadas`).
>
> **Dos comandos:**
> - *"añádelo a tareas pendientes"* → Claude **añade** aquí una entrada (título + por qué + link al detalle + estado).
> - *"¿qué tareas pendientes tenemos?"* → Claude **lee este fichero** y las lista (por prioridad).
>
> **Regla de oro (anti-saturación de memoria):** el **detalle/cómo** vive en el runbook/roadmap del repo;
> aquí solo va **título + por qué/prioridad + link + estado**. La memoria no duplica esto: solo apunta a este
> fichero (memoria `project_backlog_tareas_pendientes`).
>
> Formato por tarea: `### [PRIORIDAD] Título` + 1-3 líneas (por qué, link al cómo, estado). Al cerrar una,
> muévela a "## Hechas" con la fecha, o bórrala si ya no aporta.

## Abiertas

### 🔵 [PILOT — abierto] Triaje de revisión de preguntas con modelos de pago baratos (OpenRouter) + ensemble
- **Qué:** capa de triaje binario (¿el artículo/opción sostiene LITERAL la clave? FP vs mislink) con modelos **de pago baratos** para quitar volumen a los agentes Claude, reservando Claude para el juicio (relink/explicación/fuente/adjudicación). Idea Manuel: **consenso de 2-3 modelos** = doble-pasada barata.
- **Hecho (14/07):** $10 de crédito puestos (1.000/día). Gratis DESCARTADO (429 + rompen JSON). Bake-off de **44 modelos** de pago. **2 joyas:** `amazon/nova-lite-v1` ($0.06, 602ms) y `google/gemma-3-12b-it` ($0.05) → 12/12 JSON, **0 peligrosos, 4/6 FP-ok**. **Ganador = ensemble `nova-lite-v1 + gemma-3-12b-it`** (0 peligro, limpia 4/6). Haiku ($1) NO aporta. Coste de todo el trabajo: ~$0.17-0.76.
- **PEND (retomar):** probar el ensemble ganador en el cubo **"opción no literal" (846 vivas, `options_ok=false`)** = su tarea natural más limpia → etiquetar ~12 a mano, medir ahorro; si limpia mucho + 0 peligro → industrializar con Claude aplicando `option_fix`; si no, aparcar.
- **Cómo:** manual **`docs/maintenance/verificacion-modelos-gratis-openrouter.md` §8** (paso a paso, credencial, límites, harness). Scripts durables en `verify-live-scripts/` (`bakeoff_openrouter/compare`, `ensemble_analysis`, `build_sample2`). Memoria `reference_openrouter_modelos_gratis`. **Estado: ABIERTA.**

### 🟢 [APARCADA — tracking] 16 preguntas de diagnóstico por imagen/radioprotección esperando su oposición
- **Contexto (14/07, cierre cubo mislink "paciente"):** al cerrar Paciente Quirúrgico salieron 16 preguntas de radiodiagnóstico/ecografía/RMN/medicina nuclear/radioprotección (rayos X=Röntgen, Sievert, gammagrafía, zonas RD 783/2001…). Venían de bancos comerciales genéricos TCAE (Aula Plus / TuTestDigital Murcia) mal vinculadas a "posiciones anatómicas".
- **Qué se hizo:** creada la **ley editorial reusable "Diagnóstico por imagen y radioprotección"** (`e731eb12-0b6b-4596-bcc7-fca56f8efeb4`, slug `diagnostico-por-imagen-radioproteccion`, 4 arts de fuentes oficiales RD 783/2001 + MedlinePlus) y las **16 re-vinculadas ahí** con explicación §8.1, todas `approved`+AVR.
- **Por qué aparcadas (no visibles):** verificado contra fuente oficial (tcae_murcia BORM, tcae_sas BOJA, 0/~330 temas TCAE modelados) que **el temario oficial TCAE NO incluye diagnóstico por imagen** → crear un tema en TCAE sería inventar temario (viola `verificar-epigrafe-topic-scope.md`). Están correctamente ancladas pero invisibles hasta que exista la oposición que sí las tiene en temario (→ ver tarea TSID abajo).
- **Estado:** DONE el anclaje; **reviven automáticamente** al construir la oposición TSID (scopear la ley ahí). Detalle: memoria `project_verificar_vivas_campana`.

### 🟢 [CONTENIDO — hueco detectado] Crear editorial TCAE "Unidad del paciente" (condiciones ambientales de la habitación)
- **Qué:** al cerrar el cubo mislink de bancos clínicos TCAE (14/07) afloran preguntas huérfanas del tema **"La unidad del paciente / condiciones ambientales de la habitación"** (temperatura 20-24 ºC, humedad 40-60%, ruido/confort acústico, ventilación, iluminación) — no existe editorial TCAE que las cubra (solo se cazan sueltas en Higiene art.1). ~5-6 por banco → varias en needs_human.
- **Por qué:** es un tema TCAE clásico y real (todos los temarios lo incluyen bajo "unidad del paciente / paciente encamado"); las preguntas están correctas pero sin home literal. Verificado: 0 editoriales "Unidad del paciente" en `laws`, 0 epígrafes TCAE con "condiciones ambientales".
- **Cómo:** crear ley editorial virtual "Unidad del paciente" (fuentes normalizadas: temario TCAE + guías de confort hospitalario) con arts (cama y mobiliario, condiciones ambientales, aislamientos) y re-vincular las needs_human del cubo; verificar epígrafe→scope (probablemente encaja en el tema "paciente encamado/cuidados básicos" de cada TCAE). Relacionada con la exploración física (maniobras) que solo tiene editorial enfermero. Detalle: memoria `project_verificar_vivas_campana`.
- **Estado:** ABIERTA (backlog). Las preguntas quedan en needs_human con motivo hasta crearla.

### 🟠 [VENDIBLE] Construir la oposición Técnico Superior en Imagen para el Diagnóstico y Medicina Nuclear (TSID)
- **Por qué:** FP sanitario real y vendible cuyo temario SÍ es diagnóstico por imagen + radioprotección + medicina nuclear. Es el **home natural** de la ley editorial `e731eb12` y de las 16 preguntas ya aparcadas (arriba) — encajan de un tirón al escopar la ley en sus temas.
- **Cómo:** flujo `crear-nueva-oposicion.md` + scaffolder (memoria `project_scaffolder_crear_oposicion`); temario oficial del título de TSID (BOE del RD del título + convocatoria del servicio de salud correspondiente); reusar la ley editorial ya creada + ampliarla (protección radiológica avanzada, anatomía radiológica, posiciones radiográficas, contraste, PACS/RIS). Verificar epígrafe→scope al cerrar.
- **Estado:** ABIERTA (sin comprometer). Manuel eligió aparcar las 16 (opción A) y dejar B como pendiente. Bloque mislink ~600 (Outlook 365 + clínicos TCAE) sigue en pausa aparte.

### ✅🔵 [CAMPAÑA — CERRADA 14/07] Verificación de leyes BOE contra fuente + títulos + drift de contenido
- **Resultado (verificado en BD 14/07):** campaña sobre las leyes BOE **cerrada**. (1) **Títulos:** strip 1.439 prefijos "Artículo N." + backfill 264 rúbricas desde BOE (guard `boe_url` por ley, 0 fallos). Guardarraíl `scripts/check-article-title-prefix.cjs`=0. Títulos "bare"=**0**. (2) **Content drift:** align de las 27 leyes a BOE → **`content_mm=0 / 1.951 artículos comparados / 27 leyes`** (`reverify.ts`). Método: memoria `project_campana_titulos_contenido_drift` + `project_badge_monitoreo_verificacion_boe_count_0` §método.
- **Auditoría de obsolescencia (red de seguridad):** 6 agentes ciegos sobre 226 preguntas de los 91 arts tocados hoy → 219 OK, **7 obsoletas** (reforma de ley / artículo equivocado). Prueba anti-daño: BD==BOE vigente byte a byte en las 7 → el align fue FIEL, las destapó, no las rompió.
- **⚠️ Corrección de cifras previas:** el reporte anterior habló de "1.459 títulos bare / ~87 irregulares / 63 leyes non-BOE" → **NO aguanta contra la BD**. Bare reales=0. El detector amplio marca 202 pero son casi todos falsos positivos (MAYÚSCULAS/editoriales cuyo título=nombre-ley). Defectos de extracción REALES tiny: CCom arts titulados "º", Código Civil títulos-rango ("a 324") — pre-existentes, ajenos a esta campaña.
- **Cómo confirmar que sigue cerrada (durable):** guardarraíl títulos → `DATABASE_URL=... node scripts/check-article-title-prefix.cjs` (debe dar 0). Content drift → re-fetch BOE por ley y comparar `normalizeText(BOE)` vs `normalizeText(articles.content)` con `lib/boe-extractor` (patrón: memoria `project_campana_titulos_contenido_drift`; las 27 leyes daban `content_mm=0/1.951`). El sweep nocturno `scripts/health-sweep.cjs` también las re-mira.

### 🟠 [CABO — ALTA] Adjudicar las 7 preguntas obsoletas en needs_human (campaña 14/07)
- **Qué:** 7 preguntas pasadas a `needs_human` hoy (con `ai_verification_results`), esperando disposición humana/modelo-fuerte → cada una acaba `approved` (re-vincular al artículo correcto / re-escribir) o `retired_*`. NUNCA auto-flip. IDs y motivos en memoria `project_campana_titulos_contenido_drift`.
- **Los 7 IDs (durable) — `question_id` → ley/art → motivo:**
  - `d4883182-72e2-42ef-b30a-e13757eba009` → Ley 11/2017 SERMAS art 9 → `wrong_article` (pregunta pide *funciones*, el art solo regula nombramiento/cese; probable mal-vinculada a artículo de funciones).
  - `ae76ef4e-9ee3-409f-9586-ce42a12e8c86` → RD 865/2001 art 10 → `all_wrong` (respuesta marcada "D.G. Política Interior"; el texto vigente dice "D.G. Extranjería e Inmigración" — reforma orgánica, ninguna opción coincide).
  - `323326f0-f767-46e3-a3d9-e810337a6cff` → RD 853/2022 art 14 → `wrong_article` (pregunta sobre acceso a Escala Básica; el art regula ascensos de Oficial en adelante).
  - `6d26cfcd-3d23-4ede-9824-13f26278ac85` → DL 2/2004 Aragón art 10 → `all_wrong` (respuesta "cinco/áreas de salud"; el texto dice "cuatro" repr. Administración + "cuatro" SAS).
  - `391480d2-b97c-48a7-ac13-8aa2dd557b1b` → DL 2/2004 Aragón art 33 → `all_wrong` (opciones = hospitales nominados; el art vigente es genérico, no nombra hospitales).
  - `b4487a5e-e91a-4481-be03-40d41df1a4ce` → RD 323/2024 art 5 → `all_wrong` (respuesta "CIDA y SRD"; RD 323/2024 reestructuró y ya no los nombra).
  - `cb113e76-5c54-4c0c-a525-9922f8f6fe75` → LO 9/2021 art 8 → `wrong_article` (pregunta sobre medidas de investigación de Fiscales Europeos; el art enumera atribuciones del Juez de garantías).
- **Cómo retomar (sesión nueva, SIN mi scratchpad):** conectar a **RDS** (`DATABASE_URL` de `.env.local`, `ssl:{rejectUnauthorized:false}`, cliente `backend/node_modules/postgres`; memoria `project_cutover_rds_prod`). Ver estado: `SELECT id, lifecycle_state, primary_article_id FROM questions WHERE id = ANY(ARRAY[...los 7...])`. Contexto de cada una: la fila en `ai_verification_results WHERE review_method_version='campaign-align-audit-2026-07-14'` (guarda `explanation`, `article_ok`, `answer_ok`). Disponer con `SELECT transition_question_state(qid, <lifecycle_state actual como expected>, 'approved'|'retired_*', <reason_code>, '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f', <avr_id>, <notas>)`. Flujo `docs/maintenance/revisar-preguntas-con-agente.md`.
- **Idea de automatización (charla 14/07):** el drenaje de cubos `needs_human`/`needs_review` (este + el backlog ~2.828 `wrong_article`) se puede abaratar: pre-filtro determinista (¿la opción correcta aparece literal en el artículo?) → modelo gratis/barato (OpenRouter) como *finder* → modelo fuerte solo como *adjudicador* + toda escritura. NUNCA modelo barato para generar contenido ni para transicionar estado. Detalle memoria `project_drenaje_needs_human_doble_pasada`.
- **Estado:** ABIERTA (cola en marcha).

### 🔵 [CABO — MEDIA] ~129 leyes non-BOE con gaceta oficial propia sin verificar contra fuente
- **Qué:** el `content_mm=0` de la campaña cubre solo las leyes BOE (API `act.php`). Quedan **~129 leyes non-BOE con URL oficial propia** (gaceta regional DOE/DOGC/BOJA, doc.php…) cuyo contenido nunca se verificó contra su fuente — no por chapuza, sino porque **no están en la API del BOE**; se verifican por **WebFetch a su gaceta**, no por API.
- **Cómo:** triar primero (cuáles son estatutarias reales verificables vs editoriales ya cubiertas por método editorial) → luego verificar las estatutarias contra su fuente oficial. Es lectura, no toca nada hasta decidir. NO confundir con las 481 leyes "non-BOE sin-url" que son **editoriales/virtuales por diseño** (Inglés, TCAE clínico, Word 365…), verificadas por método editorial, NO cabo de esta campaña.
- **Cómo retomar (regenerar la lista, durable):** conectar a RDS (ver arriba) y correr — `SELECT l.short_name, l.boe_url, count(DISTINCT a.id) arts, count(DISTINCT q.id) preg FROM laws l JOIN articles a ON a.law_id=l.id AND a.is_active JOIN questions q ON q.primary_article_id=a.id AND q.is_active WHERE l.boe_url IS NOT NULL AND l.boe_url<>'' AND l.boe_url NOT ILIKE '%boe.es%' GROUP BY l.id ORDER BY preg DESC`. Eso da las ~129 con URL propia. Para verificar una: WebFetch a `l.boe_url` (su gaceta) y comparar como en la campaña BOE pero con extractor genérico (el `lib/boe-extractor` es específico de BOE; para DOE/DOGC/BOJA hay que adaptar o extraer a mano). Runbook `verificar-epigrafes-scope.md` + `monitoreo-boe-y-crear-leyes-nuevas.md`.
- **Defectos de extracción tiny detectados (aparte, pre-existentes):** arts del **Código de Comercio** con `title='º'` (artefacto de extracción de ordinales) y **Código Civil** con títulos-rango (`'a 324'`, arts agrupados). No urgente; corregir el título cuando se toque cada ley.
- **Estado:** ABIERTA (sin empezar el triaje).

### 🟡 [MEDIA] Huecos de contenido en Aux. Administrativo Gobierno de Aragón (revisión epígrafes 13/07)
- **Qué:** dos conceptos que el epígrafe oficial cita pero sin artículo que los cubra: (1) **T6** "fuentes del derecho administrativo" (jerarquía normativa) — no existe artículo estatal genérico para escopar; (2) **T16** "certificados y firma electrónica" — el editorial de Informática Básica/Red Internet no lo trata.
- **Por qué:** detectado en la verificación scope↔epígrafe (2 agentes, consenso `needs_human`). No se inventa contenido → hay que crear el artículo editorial correspondiente y escoparlo.
- **Cómo:** crear artículo editorial (fuente normalizadora) para cada concepto y añadirlo al `topic_scope` del tema; re-verificar. Runbook `verificar-epigrafes-scope.md`.
- **Estado:** resto de la oposición verificado (18/20 correct tras arreglar T12 mover II Acuerdo→T13 y T8/T7 mover reglamentos 127-133). Solo estos 2 huecos.

### 🟡 [MEDIA] Huecos de contenido en Aux. Administrativo Junta de Extremadura (verify:scope 14/07)
- **Qué:** tras `verify:scope` de `administrativo_extremadura` (30 temas, 2 agentes + consenso). **T15 RESUELTO 14/07** (el Reglamento sancionador Decreto 9/1994 estaba en BD mal etiquetado "Ingreso" + FABRICADO por IA → importados los 18 arts LITERALES del DOE oficial + 2 preguntas re-vinculadas). **Queda solo T24**: falta la *"Ley de Presupuestos Generales de la CA de Extremadura"* (normas de contratación/convenios/encargos/transferencias) — es una **ley ANUAL** (decisión: no forzar import de ley anual por unos arts que se quedan `stale`; la contratación la cubre Ley 9/2017). No está en `laws`. Estado: **29/30 `verified_correct`**.
- **Extra:** los **arts 74-79 (negociación colectiva)** de la Ley 13/2015 FP Extremadura quedan **huérfanos** (no están en el epígrafe de ningún tema 6-10) → decidir si van a algún tema o están fuera de programa.
- **Por qué:** la ley nacional principal (Ley 40/2015 en T15, Ley 9/2017 en T24) sí está cubierta; falta el complemento regional que el epígrafe nombra. No se inventa contenido.
- **Cómo:** crear cada ley regional desde el DOE/BOE (`monitoreo-boe-y-crear-leyes-nuevas.md` §"Crear ley nueva") y escoparla al tema; re-verificar. Runbook `verificar-epigrafes-scope.md`.
- **Estado:** resto de la oposición **28/30 `verified_correct`** (incl. función pública 6/7/8/10 reparada: reparto correcto de la Ley 13/2015 por epígrafe, re-verificado).

### ✅ [HECHA 13-14/07] Téc. Auxiliar (Aux. de Servicios) UMU — oposición COMPLETA y verificada
- **Qué:** oposición al 100% → **18/18 temas `disponible=true`, 18/18 `verified_correct`, 3.060 preguntas, 0 temas finos** (todos ≥15).
- **Detalle:** (1) construidos los 5 temas B2 vacíos (T9/T11/T13/T14/T18) con editorial de fuente oficial (5 leyes virtuales, doble auditoría); (2) reforzados los temas finos con +52 preguntas (incl. ley virtual Guía Técnica INSST para T17); (3) corregido T12 (faltaban arts 12-15 postales); (4) **resuelto T6 (LOSU)**: re-escopado a Tít I+II (1-6) + Tít IX Cap I (38-43) tal como pide el epígrafe, quitando 44-63 (Gobernanza+económico, no pedidos; las 15 preguntas siguen vivas en BD), + 12 preguntas nuevas sobre 38-43. Memoria `project_umu_aux_servicios_parte_especifica` (🏁 COMPLETA). Convocatoria R-838/2026 abierta → vendible al 100%.
- **PEND opcional (no forzado):** avisar a Laura García (`a8b4792d`) y María Sol (`0720dd5f`) de que la parte específica ya está lista.

### 🟠 [ALTA] Incorporar la oposición Técnico Auxiliar de Informática
- **Qué:** está **catalogada** pero sin temario ni tests. Construir su contenido para hacerla vendible.
- **Por qué:** promesa explícita al usuario — feedback `cbf5998b` (Cristina Laorden, 07/07): *"la ponemos en nuestras tareas pendientes para incorporarla y te avisaremos en breve"*. Prometido "en breve".
- **Cómo:** `docs/maintenance/crear-nueva-oposicion.md`. Avisar a Cristina (`cbf5998b`) al terminar.
- **Estado:** catalogada, sin contenido.

### 🟠 [ALTA] Construir la oposición Ayudantes en Ejecución Penal (Gobierno Vasco)
- **Qué:** `cuerpo-de-ayudantes-en-ejecucion-penal-gobierno-vasco` está **catalogada** (⚪) pero sin temario ni tests. Es el equivalente autonómico a Ayudantes de IIPP en el País Vasco (prisiones transferidas al Gobierno Vasco).
- **Por qué:** promesa explícita al usuario — feedback `b2c2db3f` (adriangarri17@gmail.com, premium, Bilbao, 11/07): le dijimos *"estamos elaborando la oposición… te avisaremos en cuanto esté lista"*. Aún **no hay convocatoria ni temario oficial** (previsto este año); construir cuando salga, verificando cada tema contra el programa oficial (excluirá temas de la estatal y añadirá autonómicos).
- **Cómo:** `docs/maintenance/crear-nueva-oposicion.md`. El núcleo común con la estatal (que ya tenemos) se reutiliza. Avisar a `b2c2db3f` al terminar.
- **Estado:** catalogada, sin contenido. Esperando convocatoria oficial.

### 🟠 [ALTA] Añadir contexto introductorio de la CE 1978 al Tema 1 de Aux. Administrativo de Andalucía
- **Qué:** añadir al Tema 1 (`auxiliar_administrativo_andalucia`) una introducción a la Constitución: **antecedentes, características y estructura** de la CE 1978 (ayuda a entenderla y puede caer en el examen).
- **Por qué:** promesa explícita — feedback `ce6e250e` (maricarmen alba, 09/07): *"vamos a añadir ese contexto introductorio al tema"*. Nota: el epígrafe oficial del T1 NO lo exige literal → es material de apoyo, no tocar el scope oficial; añadir como teoría introductoria.
- **Estado:** pendiente. Avisar a maricarmen al terminar.

### 🟠 [VENDIBLE — gap de competidores] Construir Ujieres de las Cortes Generales
- **Qué:** `ujieres-cortes-generales` **catalogada** (⚪ `is_active=false`, nacional) sin temario ni tests. Construir para hacerla vendible.
- **Por qué:** gap detectado por el radar de competidores (≥2: ADAMS, MAD, Opositatest, CET, Temarios…). **40 plazas turno libre, oposición pura** (2 tests de 100 preg: psicotécnico + temario → 100% nuestro formato). **Recorrido máximo:** convocatoria prevista ~mayo 2026, examen nov 2026–abr 2027. Requisito ESO (C2/AP). Psicotécnicos ya los tenemos; falta temario específico (17 temas, régimen de las Cortes Generales).
- **Cómo:** `docs/maintenance/crear-nueva-oposicion.md` (editorial con fuente oficial — reglamento/estatuto del personal de las Cortes Generales; verificar contra BOE la convocatoria antes de fijar fechas/plazas, nunca inventar).
- **Estado:** catalogada 13/07 (triaje señal competidores), sin contenido. Convocatoria oficial por confirmar en BOE.

### 🟠 [VENDIBLE — gap de competidores] Construir Cuerpo de Gestión Administrativa A2 (Junta de Andalucía)
- **Qué:** `cuerpo-gestion-administrativa-junta-andalucia` **catalogada** (⚪ `is_active=false`, A2) sin temario ni tests.
- **Por qué:** gap detectado por competidores (≥2: ADAMS, GoKoan). **OEP 2025: 77 plazas turno libre** (+150 PI que NO vendemos); ciclo libre anterior ya examinado (2º sem 2025), próxima convocatoria libre pendiente = oportunidad viva. A2, 69 temas, oposición. **Forward-build barato:** ya tenemos Administrativo C1 y Auxiliar C2 andaluces → banco común reutilizable (CE, Estatuto de Andalucía, empleo público, procedimiento…).
- **Cómo:** `docs/maintenance/crear-nueva-oposicion.md`. Verificar plazas/fechas del turno libre contra BOJA (Resolución de convocatoria) antes de activar.
- **Estado:** catalogada 13/07 (triaje señal competidores), sin contenido.

### 🟢 [DEMANDA — valorar, no comprometido] Oposiciones pedidas por usuarios (aún no en plataforma)
- **Limpiador/a-Camarero/a (actividades domésticas)** — interés apuntado (feedback `e7f02223`, Mari Carmen Verdejo, 29/06). Valorar demanda antes de construir.
- **Cuidador de la Diputación de Córdoba** — interés apuntado (feedback `705aeaab`, maricarmen alba, 09/07). Parecido a SAS pero con atención socio-sanitaria; distinta oposición. Valorar demanda.

### 🟡 [MEDIA] Fusionar ley duplicada "RD Estructura Min Transformación Digital" → RD 210/2024
- **Qué:** existen DOS entradas en `laws` para el mismo real decreto (estructura orgánica básica del Ministerio para la Transformación Digital y de la Función Pública): la buena **RD 210/2024** (`c955d78e-…`, con `boe_url`, sincronizada) y una **duplicada incompleta** `RD Estructura Min Transformación Digital` (`a5db1ec1-c30f-4aa8-ae08-869e373e5cc1`, **sin `boe_url`**, artículos-stub 174-343 chars). La duplicada NO se monitoriza ni sincroniza con el BOE.
- **Por qué:** **3 preguntas activas** cuelgan de la duplicada (p.ej. "¿De quién depende el INCIBE?", OEP AGE, sociedad dependiente) → **mal vinculadas**: no se actualizan cuando RD 210/2024 cambia en el BOE. Detectado 12/07 revisando el monitoreo BOE (aviso de Manuel: "puede que alguna esté mal vinculada y no la localices"). Patrón a vigilar en más RD de estructura orgánica.
- **Cómo:** mapear cada una de las 3 preguntas al artículo equivalente de RD 210/2024 (verificar contenido) → re-vincular `primary_article_id` → deprecar la ley duplicada (`is_active=false` o consolidar). Runbook: impugnaciones §7.2 / verificar-epigrafe-topic-scope.
- **Estado:** detectado 12/07. 3 preguntas + 1 ley duplicada.

### 🟡 [MEDIA] Exponer en la UI el filtro "excluir preguntas recientes" (feature oculta)
- **Qué:** `excludeRecent` / `excludeRecentDays` está **implementado y funciona en servidor** (`lib/api/filtered-questions/queries.ts:1265` aparta las respondidas en los últimos N días, con reserva anti-test-corto), y llega por URL (`exclude_recent=true` + `recentDays`). **Pero NO hay control en `TestConfigurator.tsx`**: `config.excludeRecent` es `false` fijo y solo se lee de `searchParams`. Un usuario normal no puede activarlo.
- **Por qué:** funcionalidad terminada pero inalcanzable = valor perdido; y da pie a prometer a usuarios (impugnaciones `pregunta_repetida`) algo que no pueden usar. El sistema ya prioriza "nunca vistas" (`prioritizeNeverSeen`, automático), pero excluir explícitamente lo reciente no es accesible.
- **Cómo:** añadir un toggle en el configurador que setee `excludeRecent` + `recentDays` (30/15/7d). El resto del cableado ya existe.
- **Estado:** detectado 10/07 investigando impugnación de María José Morell (APSP CARM). Backend OK, falta UI.

### 🟢 [DEMANDA — valorar] Parte específica (Bloque II) de Agrupación Profesional Servicios Públicos CARM vacía
- **Qué:** la oposición `agrupacion_profesional_servicios_publicos_carm` tiene la parte general sobradísima (T1 1.373q, T4 2.490q, T8 3.655q) pero **la parte específica del Bloque II está vacía o casi**: T6 Seguridad y salud (0), T7 Atención al ciudadano (9), T9 Vigilancia/custodia y movilización de enfermos (0), T10 Técnicas de limpieza (0), T11 Manipulación de alimentos (0), T12 Mantenimiento básico de edificios (0).
- **Por qué:** banco pequeño en la parte propia del puesto → repetición para el usuario (origen de la impugnación de María José Morell). Crear ahí sí tiene impacto; en la parte general no.
- **Cómo:** `docs/maintenance/crear-nueva-oposicion.md` (editorial con fuente, nunca inventar, `tech_approved`). Verificar demanda antes de construir.
- **Estado:** detectado 10/07. Valorar demanda.

### 🟡 [MEDIA] Detector permanente de "explicación = nota de auditoría"
- **Qué:** añadir al sweep de salud (`scripts/health-sweep.cjs` → `content_health_findings`) un grep sobre `explanation` de preguntas `is_active=true` con patrones de meta-nota: `La explicación debería/actual/omite/anterior`, `Esta pregunta debería`, `posible errata`, `Nota técnica:`, `respuesta oficial del examen`, `debería (anularse|impugnarse)`. Excluir `aunque técnicamente` (falso positivo legítimo).
- **Por qué:** el 10/07 se encontraron ~46 preguntas visibles cuya "explicación" era en realidad la crítica de un pase IA anterior (defecto de pipeline). Se remediaron (36 reescritas + 10 `needs_human`), pero sin detector reaparecerá en silencio. Memoria `project_explicaciones_nota_auditoria`.
- **Estado:** remediación hecha; detector NO implementado.

### 🟡 [MEDIA] Desplegar el guardarraíl anti-duplicado de recompensas
- **Qué:** commit `f3bc0954` (dedup por motivo: bug=feedback_id / ugc=url; evento `reward_duplicate`) está en `origin/main` pero **NO desplegado** (prod = `4465d15c`).
- **Por qué:** cierra el hueco de doble recompensa por el mismo motivo (control robusto). No bloquea nada (creación manual ya se verifica), pero conviene que esté vivo.
- **Cómo:** `docs/runbooks/deploy.md` (`scripts/deploy-frontend.sh`, gate CI verde). Va junto con lo que haya en main.
- **Estado:** commiteado + pusheado, pendiente de deploy.

### 🔴 [ALTA] Barrido: scripts que aún leen la BD Supabase CONGELADA (post-cutover 04/07)
- **Qué:** ~250 scripts `.cjs` en `scripts/` crean `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` y leen tablas de datos (`oposiciones`, `questions`, `convocatoria*`, `topic*`…). Desde el cutover a RDS (04/07/2026) eso lee un **snapshot congelado** → veredictos/salidas STALE.
- **Por qué:** `audit:estados` (gate de CI/cron, §0.bis del manual OEPs) daba **falsos ❌/🟡** leyendo Supabase congelada (11/07: mostraba `inscripcion_abierta` con plazo vencido cuando en RDS ya estaban cerradas; 568 filas vs 2533 reales). La mayoría de los 250 son one-offs muertos, pero los **recurrentes** (audits, radar, canaries, seo-audit) engañan silenciosamente.
- **Cómo:** repuntar a RDS con el idiom de la casa (`postgres(process.env.DATABASE_URL, {ssl:'require'})` + guard `if(!DATABASE_URL) exit`), leyendo de `oposiciones_ssot` cuando aplique, y castear DATE a `::text` (footgun tz de pg, §4g-bis). Priorizar los que se ejecutan de forma recurrente; los one-offs muertos se pueden ignorar o archivar. Patrón de referencia ya aplicado: `scripts/audit-estados-convocatoria.cjs`, `scripts/audit-oposiciones-coherencia.cjs`.
- **Estado (11/07):** `audit:estados` **REPARADO** (RDS/`oposiciones_ssot`, 0 ❌, commit `80672a6`). **Migración masiva HECHA** (commit `5b6a2f30`): shim agnóstico `scripts/lib/pg-agnostic-client.cjs` (drop-in de supabase-js sobre `DATABASE_URL`; `npm run test:db-shim` = 18 casos verde) + **540 scripts repuntados** (1 línea de import) + `leer-notas` a pg directo.
- **PENDIENTE (~124 conversión MANUAL a SQL/pg):** los que el shim no cubre y **fallan ruidosamente** (nunca datos erróneos en silencio):
  - **~92** usan `.auth`/`.storage` (siguen en Supabase: auth/almacenamiento NO migrados) o `.rpc`/`.or`/`.contains`/`.channel`.
  - **~32** usan selects anidados (embeds PostgREST `tabla:fk(cols)` = JOINs). Detección: `awk '/\.select\(\`/{inb=1} inb{buf=buf $0} /\`\)/{if(inb){if(buf ~ /[a-z_]+ *\(|:[a-z_]/)print FILENAME; inb=0;buf=""}}' scripts/*.cjs`.
  - Patrón de arreglo: reescribir a `postgres` (ej. `audit-oposiciones-coherencia.cjs`) o, si el subset encaja, ya usan el shim.
