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

### 🟢 [ABIERTO 19/07] Aux. Admin. Diputación de Zaragoza — scope↔epígrafe: 19 correct / 1 issue (build) / 0 needs_human
- **Qué:** verificación scope↔epígrafe completa (BOP `bop_1582_2026.pdf`, Anexo II) contra topic_scope, 2 agentes + consenso, **trackada en `topic_scope_verification`** (19/07). Origen: impugnaciones de Sandra Barbastro (art. 71 y 100 LCSP, falsos positivos — sí entran en su T11 "contratación pública", verificado).
- **HECHO 19/07 (6 temas → verified_correct, todos por consenso de 2 agentes):**
  - **T2** — añadido LO 5/2007 Estatuto de Aragón (toda la ley, 198 Q).
  - **T18** — añadida Ley 7/2018 Igualdad Aragón (arts 1-3 + 16-28, 24 Q).
  - **T5** *(pasó a needs_human, ver abajo)* — añadidos 39/2015 arts 29-33 (términos y plazos).
  - **T6** — añadidos 39/2015 arts 1-2 (objeto/ámbito) + 24-25 (silencio) + 96-105 (tramitación simplificada + ejecución).
  - **T11** — añadidos LCSP arts 131-188 (formas y procedimientos de adjudicación, 75 Q).
  - **T17** — añadidos RDL 2/2004 arts 182-193 (gasto/ejecución) + 200-212 (contabilidad EELL); **eliminada Ley 47/2003** (Ley General Presupuestaria ESTATAL, sobre-scope de otro nivel).
- **T4 scope + 1er lote de generación HECHO 19/07** (verified_correct): añadida Ley 7/1999 Admin Local Aragón arts 1-6 + 72-138 (rango curado, no invade T9/T10/T12/T13/T16). **Generadas 8 preguntas** (arts 1-6, 72, 74) con doble auditoría Sonnet (2 reequilibradas por tell de longitud) → approved/visibles (tag `gen_zaragoza_t4_ley7_1999_2026-07-19`). **COBERTURA pendiente:** faltan lotes para el resto del rango (arts 75-138: comarcas, mancomunidades, entidades menores, órganos) → seguir generando.
- **verified_issues (1, BUILD):**
  - **T15** — la **Ley 5/2015 de Subvenciones de Aragón NO existe en BD** → importar ley (verbatim, doble auditoría) + generar preguntas.
- **Build de generación pendiente:** más lotes T4 (Ley 7/1999 75-138) + T15 (importar Ley 5/2015 + generar). Manual `generar-preguntas-con-ia.md`; verificado contra fuente, draft→doble auditoría→approve, NUNCA inventar.
- **needs_human RESUELTOS 19/07 (decisión Manuel, 3 temas → correct):** T1 (quitado art. 116 CE), T5 (mantenidos 39/2015 66-68, solapamiento legítimo), T14 (añadidos RDL 2/2004 59-110, los 5 impuestos locales, 56 Q).
- **Cómo:** runbook `verificar-epigrafes-scope.md` (`verify:scope status auxiliar_administrativo_diputacion_zaragoza`). **Solo quedan los 2 builds (T4/T15).**

### 🟠 [ABIERTO 17/07] "Imprimir PDF" del temario falla en silencio en navegadores in-app (Google App/redes)
- **Qué:** el botón "Imprimir PDF" (`TopicContentView.tsx`, `handlePrint` → `window.print()`) **no hace nada** dentro de los navegadores in-app de iOS (app de Google/GSA, Instagram, Facebook…), que bloquean `window.print()`. Falla en silencio, sin aviso. Por ahí entra mucho tráfico de Google/redes.
- **Diagnóstico (caso María, fb feb79fc5, `piyou22@gmail.com`):** 100% de sus sesiones en 3 días y 4 deploys fueron GSA in-app en iPhone; nunca Safari ni ordenador → descarta versión cacheada/cuenta. A Manuel en navegador normal le funciona. Resuelto a la usuaria con apaño (abrir en Safari) + reward 3€ creado.
- **Fix de verdad (pendiente decisión):** que el botón **genere el PDF nosotros** (client jsPDF/html2pdf o ruta server que renderice el tema) en vez de depender de `window.print()`, para que funcione desde cualquier navegador. Mientras, mínimo detectar in-app browser y mostrar aviso en vez de no-op.

### 🟡 [ABIERTO 17/07] Aux. Admin. SMS — generar preguntas de 2 artículos en scope sin banco (prometido a Luisa)
- **Qué:** dos artículos correctamente escopados pero con **0 preguntas activas**, prometidos a la usuaria (fb `daluamva@gmail.com`, `auxiliar_administrativo_sms`): **T8 Ley 4/1994 art 9 (Fines)** y **T3 Ley 12/2014 CARM Transparencia art 1 (Objeto y finalidad)**. Conviene reforzar de paso T8 arts 10-12 (1 preg c/u, tema muy fino: 8 preg).
- **Por qué pendiente:** generación de contenido (fuente oficial BOE + doble auditoría + GATE) → no al vuelo; decisión de Manuel. Le dijimos "estamos trabajando en ello" y pidió **aviso expreso cuando estén** ("AVISARME CUANDO ESTEN").
- **Cómo:** `docs/maintenance/generar-preguntas-con-ia.md`. Reward embajador 3€ al resolver (sin mencionar). Feedbacks claim-ados: `22835b84` (T8), `85d564cf` (T3 Ley 12/2014). Contexto scope (verificado contra BORM 07/10/2021): sesión 17/07.

### 🟠 [ABIERTO 17/07] Vídeos de los cursos de informática no cargan en móvil/tablet (MP4 non-faststart)
- **Qué:** los 24 vídeos de los 5 cursos (Word, Excel, Access, Outlook, Windows 11) son **MP4 non-faststart** (`moov` al final de ficheros de 1,1–1,6 GB) → iPhone/Android no pueden hacer streaming progresivo y **no cargan** (escritorio sí). Serving OK (Content-Type, Range, reproductor `playsInline`). Confirmado midiendo el fichero real con ffprobe.
- **Por qué pendiente:** el fix (remux `ffmpeg -c copy -movflags +faststart`, **lossless**) es op de infra ~30 GB (descarga+resubida a bucket `videos-premium` de prod, sobrescribe) → espera OK de Manuel. Reportado por Victoria (fb 4e8964ba, premium) — reward 3€ tras aplicar.
- **Cómo:** script listo `_vfix.cjs` (raíz repo; modo seco / `--apply`). Detalle: memoria `project-video-cursos-mobile-faststart`. Tamaño 1,5GB/lección (recode para adelgazar) = decisión aparte.

### 🟠 [ABIERTO 17/07] Campaña "citas ajenas" — 27 decisiones humanas + causa raíz mislinks
- **Qué:** barrido detectó explicaciones que citan un artículo distinto del vinculado (mislink). **63 ya corregidas y verificadas en prod** (45 re-vínculos + 18 explicaciones); quedan **27 para decisión humana** (1 clave dudosa, 6 huérfanos de temario, 7 adjudicar, 8 sin norma en BD, 5 needs_human).
- **Por qué pendiente:** tocan clave / scope / normas sin importar → no auto-aplicable. Recuperables de RDS: `ai_verification_results WHERE ai_provider='claude_code_citas_2026_07'`.
- **Cómo/detalle (IDs por cubo):** `docs/roadmap/campana-citas-ajenas-2026-07.md`. Herramienta reusable: `scripts/impugnaciones/barrido-citas.cjs`.

### 🔵 [ABIERTO 17/07] Causa raíz: vínculo por nº de artículo sin cruzar `law_id`
- **Qué:** el mislink de la campaña de citas viene de un vinculador que emparejó por número de artículo sin filtrar por ley (133 CP↔133 CE, RDL 1/2013↔Ley 2/2013 CyL, organismos CyL cruzados). Los 139 tratados son solo los que tenían cita delatora; **el bug es más amplio**.
- **Siguiente paso:** detector barato (explicación nombra ley/art ≠ vinculado) para medir el tamaño real antes de campaña. Detalle: `docs/roadmap/campana-citas-ajenas-2026-07.md` §Subproductos.

### 🟡 [ABIERTO 17/07] 33 artículos con contenido truncado en BD (70 preguntas visibles)
- **Qué:** artículos cuyo `content` empieza por un apartado >1 (faltan párrafos iniciales) → el usuario lee la ley a medias en el temario. Focos: Decreto 7/2013 CyL, Decreto 13/2021 CyL, Instituciones Internacionales GC.
- **Cómo:** recomponer contra BOE. Detalle + query: `docs/roadmap/campana-citas-ajenas-2026-07.md` §Subproductos pto 1.


### ✅ [CERRADO 15/07] Barrido global del bug "topic_scope con article_numbers vacío" — NO era sistémico
- **Qué era:** filas de `topic_scope` con `law_id` correcto pero `article_numbers = '{}'` VACÍO → esa ley aporta 0 preguntas al tema aunque su banco exista. El tema parece OK (disponible + preguntas de otras leyes) y el hueco pasa desapercibido.
- **Origen:** detectado por Jen (15/07): T16 de Cádiz sin preguntas de la Ley 29/1998, con 604 en BD. **Cádiz arreglada y verificada (24/24).**
- **Barrido global HECHO (15/07) → 0 casos reales.** Recuento definitivo: `{}` vacío = **0** · NULL = 1.696 · con artículos = 3.557. **Cádiz eran las únicas filas `{}` y ya se poblaron.**
- **⚠️ Falso positivo corregido:** la 1ª detección conflaba `NULL` con `{}`. **NO son lo mismo:** `article_numbers IS NULL` = **"toda la ley"** (convención válida — enfermerías, Office común, etc.: sirven su ley entera; verificado en `lib/api/filtered-questions/queries.ts:576-578`), `article_numbers = '{}'` = **inerte** (el bug). Las 1.696 NULL están **BIEN**. La supuesta "Madrid T14 mismo bug" también era falsa (ni scopea la LJCA). Query correcta (solo `{}`) documentada en `docs/runbooks/verificar-epigrafes-scope.md` §"Regla previa OBLIGATORIA".
- **Gotcha residual (menor, no urgente):** la función SQL vieja `get_topic_questions_v2` NO respeta `NULL = toda la ley` (devuelve 0), a diferencia del API real de tests. Si algún path legacy la usa, mostraría 0 en temas con scope NULL. Verificar qué la consume aún (probablemente nada en el flujo de tests moderno).

### 🔵 [PILOT — abierto] Triaje de revisión de preguntas con modelos de pago baratos (OpenRouter) + ensemble
- **Qué:** capa de triaje binario (¿el artículo/opción sostiene LITERAL la clave? FP vs mislink) con modelos **de pago baratos** para quitar volumen a los agentes Claude, reservando Claude para el juicio (relink/explicación/fuente/adjudicación). Idea Manuel: **consenso de 2-3 modelos** = doble-pasada barata.
- **Hecho (14/07):** $10 de crédito puestos (1.000/día). Gratis DESCARTADO (429 + rompen JSON). Bake-off de **44 modelos** de pago. **2 joyas:** `amazon/nova-lite-v1` ($0.06, 602ms) y `google/gemma-3-12b-it` ($0.05) → 12/12 JSON, **0 peligrosos, 4/6 FP-ok**. **Ganador = ensemble `nova-lite-v1 + gemma-3-12b-it`** (0 peligro, limpia 4/6). Haiku ($1) NO aporta. Coste de todo el trabajo: ~$0.17-0.76.
- **PILOT HECHO (15/07) → APARCADO:** ensemble sobre "opción no literal" dio **1 peligroso (no 0)** + solo 38% ahorro. El cubo NO es homogéneo (mezcla verbatim, "señale la FALSA", meta-opciones, datos corruptos, conceptuales cortas) → los baratos aciertan solo ⅔ y **fallan en bloque** en casos-borde (la corrupta: los 3 dijeron mantener). Conclusión: **no industrializar el triaje para estos cubos**; el juicio de literalidad sigue siendo de Claude. Detalle: manual §9.
- **Dónde SÍ sirven los baratos (no descartar del todo):** señal informativa/priorización (no decisión), reformateo/normalización determinista, pre-filtro con Claude detrás, detección de patrones grep-ables. Idea futura: probar solo en sub-cubo homogéneo (opción >60 chars, alto solape con artículo). Manual §9.
- **Cómo:** manual **`docs/maintenance/verificacion-modelos-gratis-openrouter.md` §8-§9**. Scripts durables en `verify-live-scripts/` (`bakeoff_*`, `ensemble_analysis`, `optlit_extract`, `optlit/`). Memoria `reference_openrouter_modelos_gratis`. **Estado: APARCADO (con usos válidos anotados).**

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

### ✅🟠 [CABO — HECHO 15/07] Adjudicadas las 7 preguntas obsoletas en needs_human (campaña 14/07)
- **RESULTADO (15/07, tras doble pasada real verificando cada texto contra BOE):** 0/7 en needs_human. **1 reactivada a `approved`** (`323326f0` RD 853/2022 art 14 era **FALSO POSITIVO** — "Escala Básica Primera Categoría"=Oficial de Policía, el art 14.1 responde literal; la doble pasada lo cazó). **6 retiradas a `retired_irreparable`** (Manuel eligió retirar; todas de bancos comerciales no oficiales): 4 obsoletas por reforma (ae76ef4e RD865/2001, 6d26cfcd + 391480d2 DL2/2004 Aragón, b4487a5e RD323/2024) + 2 wrong_article cuyo artículo correcto no está en BD (d4883182 SERMAS art faltante BOCM; cb113e76 respuesta está en Reglamento UE 2017/1939 art 30, no en la ley ES). Auditoría en `ai_verification_results` (`review_method_version='campaign-align-adjudication-2026-07-15'`). Detalle memoria `project_campana_titulos_contenido_drift`.
- **Hueco de taxonomía detectado:** no hay `reason_code` terminal exacto para "artículo-correcto-no-disponible-en-BD"; se usó `admin_law_derogated` (el terminal-irreparable más cercano) + la razón real precisa en las `notes`. Candidato a añadir `admin_out_of_scope`/`admin_article_unavailable` a `lib/constants/lifecycleReasons.ts` si recurre.

<!-- histórico (cerrado): 7 preguntas pasadas a needs_human en la campaña 14/07 -->
- **Qué (original):** 7 preguntas pasadas a `needs_human` (con `ai_verification_results`), esperando disposición → cada una acaba `approved` o `retired_*`. NUNCA auto-flip. IDs y motivos en memoria `project_campana_titulos_contenido_drift`.
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
- **✅ TRIAJE HECHO (15/07):** 129 leyes / 2.085 preguntas, agrupadas por dominio de la fuente. Clasificación:
  - **Boletines oficiales autonómicos (verificables como BOE, extractor por-fuente):** boa.aragon.es (9 leyes/344 preg), gobiernodecanarias.org=BOC (9/159), borm.es (8/112), asturias.es+sede+miprincipado (6/107), boc.cantabria.es (4/61), bocm.es (5/23), euskadi.eus+osakidetza (4/45), doe.juntaex.es (2/16), bocyl.jcyl.es (1/13), docm.jccm.es (2/11), xunta.gal (3/6). **juntadeandalucia.es (39/329)** ⚠️ dominio genérico Junta — hay que ver si cada URL es BOJA oficial o página web.
  - **Parlamentos autonómicos (reglamentos de cámara, fuente oficial):** jgpa.es Asturias (2/172), ccyl.es (1/62), parlamentodeandalucia.es (1/44), parlamento-cantabria.es (1/18).
  - **UE (eur-lex/europarl, fuente oficial UE):** 7 leyes/39 preg.
  - **Institucional propia (su web ES la fuente):** uc3m.es (7/110), um.es (4/44), ugr, colegios, ayuntamientos (córdoba 48, zaragoza), hacienda.gob.es, ingesa — normativa propia, ya anclada a su fuente.
  - **✅ DEFECTO RESUELTO 15/07 — agregador → BOCyL oficial:** `noticias.juridicas.com` (2 leyes CyL / 150 preg) era agregador no oficial. **Re-ancladas al BOCyL oficial (ELI):** Decreto 13/2021 → `bocyl.jcyl.es/eli/es-cl/d/2021/05/20/13/` (+ corregida fecha errónea del name: "de 6 de mayo"→"de 20 de mayo"); Decreto 7/2013 → `bocyl.jcyl.es/eli/es-cl/d/2013/02/14/7/`. Contenido verificado por **muestreo 6/6 arts** (13/2021 arts 1/4/20 + 7/2013 arts 1/3/20 coinciden literal BD↔BOCyL; el agregador fue fiel). Ambos vigentes. Verificación exhaustiva de los 59 arts = parte del trabajo mayor por-fuente. 0 leyes activas quedan en noticias.juridicas.
  - Lista completa durable en scratchpad `triage129.tsv` (efímero) — regenerable con el SQL de abajo (columna `boe_url` incluida).
- **Cómo (siguiente):** (1) arreglar YA el agregador (re-anclar las 2 CyL al BOCyL). (2) Verificar por bloques de fuente homogénea (el extractor `lib/boe-extractor` es solo-BOE; cada gaceta necesita adaptar el parseo o extraer a mano). Prioridad por volumen: BOA Aragón > BOJA Andalucía > BOC Canarias > BORM. NO confundir con las 481 "non-BOE sin-url" = editoriales/virtuales por diseño (Inglés, TCAE clínico, Word 365…), NO cabo de esta campaña.
- **Cómo retomar (regenerar la lista, durable):** conectar a RDS (ver arriba) y correr — `SELECT l.short_name, l.boe_url, count(DISTINCT a.id) arts, count(DISTINCT q.id) preg FROM laws l JOIN articles a ON a.law_id=l.id AND a.is_active JOIN questions q ON q.primary_article_id=a.id AND q.is_active WHERE l.boe_url IS NOT NULL AND l.boe_url<>'' AND l.boe_url NOT ILIKE '%boe.es%' GROUP BY l.id ORDER BY preg DESC`. Eso da las ~129 con URL propia. Para verificar una: WebFetch a `l.boe_url` (su gaceta) y comparar como en la campaña BOE pero con extractor genérico (el `lib/boe-extractor` es específico de BOE; para DOE/DOGC/BOJA hay que adaptar o extraer a mano). Runbook `verificar-epigrafes-scope.md` + `monitoreo-boe-y-crear-leyes-nuevas.md`.
- **Defectos de extracción tiny detectados (aparte, pre-existentes):** arts del **Código de Comercio** con `title='º'` (artefacto de extracción de ordinales) y **Código Civil** con títulos-rango (`'a 324'`, arts agrupados). No urgente; corregir el título cuando se toque cada ley.
- **Estado:** ABIERTA (sin empezar el triaje).

### 🔵 [CABO — GRANDE] Drenar el cubo needs_human (4.387 preguntas) — piloto hecho 15/07
- **Estado del cubo (15/07):** **4.387** en needs_human. ~3.186 "artículo mal vinculado" (wrong_article_link 1.273 + ai_detected_wrong_article 1.218 + wrong_article 695), 419 admin_marked_problem, 245 all_wrong, 276 backfill legacy. Top ley: CP 1.158, LECrim 334, LSP2010 181, CC 118.
- **✅ PILOTO CERRADO (Orden INT/859/2023, 53 preg):** flujo manual v2.1 completo (3 verificar + 3 auditar ciego + adjudicar Opus + 1 reescribir explicación con cita literal). **Resultado: 11 approved (21%) / 42 retired_irreparable (79%).** De los 11: 3 FP reactivados + 8 re-vinculados con explicación nueva verificada. Los 42: contenido fuera del articulado (anexos no cargados, otra norma, no positivizado). 0 needs_human restantes en la ley. Detalle: memoria `project_drenaje_needs_human_piloto_ordenint`.
- **Aprendizajes (para decidir cómo escalar):** (1) la **triple pasada es necesaria** — cada capa cazó errores (verificación 52% retire → auditoría literal 74% → reescritura-con-cita 79%); una sola pasada deja pasar malas o retira buenas. (2) **Coste ~12k tokens/pregunta** con flujo completo → barrer 4.387 es caro; **priorizar bancos legales limpios** (alta recuperación), NO bancos comerciales de temario general mal vinculado (baja recuperación, 79% retire). (3) Guardarraíl `banned_words_promotion_gate` exige explanation_ok=true para promover (obliga a explicación nueva al re-vincular). (4) Defecto de datos: "art 0" fabricado + anexos sin cargar → algunas retiradas son recuperables cargando anexos del BOE.
- **PEND:** decidir estrategia de escalado (¿qué leyes/bancos priorizar? ¿umbral de coste? ¿pre-filtro?) antes de seguir. El pipeline barato OpenRouter quedó APARCADO (no fiable para juicio de literalidad, ver entrada PILOT arriba).

### ✅ [HECHA 15/07] Estrechar scope T14 Aux. Admvo. Aragón (convenio colectivo) + cobertura
- **Qué:** T14 (`auxiliar_administrativo_aragon`, "Negociación laboral, conflictos y convenios colectivos…") escopaba el VIII Convenio Colectivo PL Aragón **entero (137 arts)**, pero el epígrafe lo delimita a *"ámbito de aplicación y derechos y deberes del personal laboral"*. Usuaria premium (Isabel, feedback `310bb050`, examen ~17/07) veía ~81 arts vacíos.
- **Resuelto:** epígrafe **confirmado literal** contra el temario oficial 2025 (Anexo XXXI) — bajado del portal Angular+CSV `mia.aragon.es` con **Playwright** (`programa_url` de BD apuntaba a las bases, no al temario; corregido a la Resolución 25-nov-2025). Consenso 2 agentes → **SOBRE-SCOPE**: scope estrechado **137→69 arts** (Cap I-VI; fuera Cap VII-XI = disciplinario/sindical/movilidad/selección/salud laboral). T14 re-verificado `verified_correct`. Cobertura del hueco interno: **44/69 → 69/69** con 25 preguntas IA generadas (doble auditoría ciega + paso 9, todas PERFECT, batch `gen_convenio_aragon_2026-07-15`). Caché revalidada. Aprendizajes en manual `verificar-epigrafe-topic-scope.md` (Vector 3 SPA/Playwright + Vector 3-bis `verified_correct` laxo).

### ✅ [HECHA 15/07] Aux. Admvo. Diputación de Cuenca — scope T5/T14 corregido + cobertura (prometido a Ale ~19/07)
- **Qué (backlog decía mal):** el backlog pedía "generar preguntas para 4 temas (T5, T14, T19, T20)" por estar "a 0". **REALIDAD verificada:** T19 (1052q) y T20 (2766q) YA cubiertos; los huecos reales eran T5 (9q) y T14 (7q). Backlog stale.
- **Resuelto siguiendo el manual de epígrafes:** los 20 temas estaban `never_verified` → verificación 2 agentes de T5/T14 detectó **SOBRE-SCOPE** (como Aragón): T5 TRRL 31→11 arts (quitado Título II "El Municipio" 2-24, añadido 32-34 que faltaban del Título III "La Provincia"; ROF −art35 Municipio); T14 Reglamento Bienes 9→7 (quitados Cap III 17-18/44/56/70). Cross-check de contenido en BD confirmó límites (art24=Alcalde/Municipio, art25=Provincia). Re-verificados `verified_correct`. Cobertura: **16 preguntas IA nuevas** (TRRL Provincia + ROF + Bienes) con triple auditoría PERFECT (batch `gen_cuenca_regimen_local_2026-07-15`); T5 9→22, T14 →18. Caché revalidada.
- **Follow-ups menores (datos):** (1) `programa_url` de Cuenca apunta a la reseña BOE, no al temario (está en BOP Cuenca nº13, 30-ene-2026) — corregir. (2) Epígrafe de T5/T14 NO confirmado byte-literal contra el BOP (el scope se corrigió contra la estructura de las leyes, que es lo que manda; riesgo bajo por ser epígrafe muy específico). (3) TRRL en BD tiene los artículos SIN título (dato pobre).

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

### 🟡 [MEDIA] Huecos de contenido en Aux. Administrativo Diputación de Zaragoza (verify:scope 18/07)
- **Qué:** feedback de Sandra (bug `6f789351`, *"en contratos solo entra hasta el art. 43, pero salen preguntas de otros artículos"*) disparó `verify:scope` de la oposición completa (20 temas, antes `never_verified` → **12 correct, 4 issues, 4 needs_human**; run `verify_auxiliar_administrativo_diputacion_zaragoza_2026-07-18`). El feedback quedó **resuelto y respondido** (T11 NO era sobre-scope: aptitud 65-73 y precio 99-102 SÍ son "contratación pública"; su material corta antes que el epígrafe oficial).
- **T11 contratación (needs_human):** falta el bloque *"formas y procedimientos de contratación"* = procedimientos de adjudicación LCSP (~arts 131-179), hoy ausentes. Valorar ampliar (es más preguntas, no menos).
- **Deuda aragonesa (4 issues):** el epígrafe nombra normativa autonómica pero solo está la estatal — **T2** Estatuto de Autonomía de Aragón (LO 5/2007), **T4** ley aragonesa de régimen local, **T15** Ley de Subvenciones de Aragón, **T18** ley aragonesa de igualdad. Enganchar + poblar desde fuente oficial.
- **Otros needs_human:** T5 (términos/plazos 39/2015 arts 29-33), T6 (silencio 24-25 + ejecución 97-105), T17 (contabilidad EELL + posibles arts estatales de Ley 47/2003 que sobran).
- **Cómo:** crear/importar cada ley regional (BOA/BOE) y escoparla; ampliar T11; re-verificar. No inventar contenido. Runbook `verificar-epigrafes-scope.md`.

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

### 🟢 [CASI CERRADA 19/07] Barrido: scripts que aún leen la BD Supabase CONGELADA (post-cutover 04/07)
- **Qué:** scripts `.cjs` en `scripts/` que crean `createClient(NEXT_PUBLIC_SUPABASE_URL, …)` y leen/escriben tablas de datos. Desde el cutover a RDS (04/07/2026) eso lee un **snapshot congelado** → salidas STALE (o, si escriben, writes a un espejo que nunca llega a prod).
- **Por qué:** `audit:estados` daba **falsos ❌/🟡** leyendo Supabase congelada (11/07: `inscripcion_abierta` con plazo vencido). El fuego real eran los **recurrentes** (audits, radar, canaries) que engañaban en silencio.
- **✅ EL FUEGO REAL YA ESTÁ APAGADO (verificado 19/07):** TODOS los audits/canaries recurrentes de npm (`audit:estados`, `audit:epigrafe`, `audit:coherencia`, `audit:scraped-reconcile`, `audit:display-drift`, `canary:oposiciones`, `canary:verificacion-contenido`, `verify:scope`…) leen de **RDS/pg**. **Ninguno** de los scripts sin migrar está cableado a npm, GHA, cron ni require. La migración masiva (commit `5b6a2f30`, shim `pg-agnostic-client.cjs`, 540 scripts) cubrió lo vivo.
- **✅ GUARDARRAÍL nuevo (19/07):** `npm run audit:frozen-supabase` (`scripts/check-frozen-supabase-data.cjs`) — estático, sin DB. Caza cualquier `.cjs` que lea/escriba tablas de datos vía supabase-js crudo sin el shim, con **baseline-trinquete** (hoy 105; falla con `--fail` si aparece uno NUEVO). Whitelist `LEGIT_AUTH_STORAGE` (4 scripts auth/storage que DEBEN seguir en Supabase). Impide la regresión que motivó todo esto.
- **Resto = 105 one-offs DORMIDOS** (mayoría `_tmp_*`, `import-t3xx`, `fix-*`, `gen_*` de campañas viejas; 72 escriben). **Solo muerden si alguien los re-lanza a mano** — no hay riesgo silencioso en ningún flujo automático. Reescribir 105 scripts muertos NO compensa; el trinquete los tolera y solo baja al archivarlos.
- **⚠️ Ojo:** la Supabase congelada (`https://auth.vence.es`, self-hosted) **sigue viva** porque aún sirve **auth/storage en prod** (no migrados) → no se puede decomisionar para forzar que fallen; por eso el guardarraíl estático es la red correcta.
- **✅ 4 one-offs de escritura NEUTRALIZADOS (19/07):** `import-andalucia-oficiales`, `import-cyl-new`, `import-cyl-similar-new`, `parity-oposiciones-compatibles-progress` llevan sentinel `FROZEN-SUPABASE-NEUTRALIZED` + abort (exit 1) salvo `ALLOW_FROZEN_SUPABASE_WRITE=1`. El guard los excusa del conteo → BASELINE 105→**101** (68 escriben, todos dormidos).
- **PEND menor (opcional):** el resto (101) son one-offs dormidos tolerados por el trinquete; bajan solos al archivarse/migrarse. Valorar cablear `audit:frozen-supabase --fail` a CI si se quiere bloqueo duro (hoy manual, para no meter ruido en pre-commit).

## Landing multi-convocatoria: publicar 2 OEPs en paralelo (patrón nuevo, 15/07/2026)
- **Qué:** cuando una oposición tiene un ciclo en curso (examen futuro, inscripción ya cerrada) Y abre una convocatoria nueva con inscripción abierta, la landing debe mostrar **las dos** (captar en ambas). Hoy solo pinta la `is_current` de `convocatorias` (vía `oposiciones_ssot`).
- **Build pendiente:** que la landing liste TODAS las convocatorias no archivadas de la oposición (no solo `is_current`). Cambio de código pequeño en el lector de `oposiciones_ssot`/landing.
- **Doc del patrón:** `docs/maintenance/oeps-convocatorias-seguimiento.md` §4e-ter. Primer caso real: **Auxiliar Admin. Comunidad de Madrid** (ciclo lista_admitidos examen 15/10/2026 + Orden 1628/2026, 626 plazas libres, inscripción hasta 10/08/2026). Decisión Manuel: excepción legítima para captación.

## Gaps de demanda por análisis de competidores (15/07/2026)
Oposiciones que muchos competidores preparan y NOSOTROS tenemos solo catalogadas (0 tests/landing) — verificado que no hay variante construida con otro slug. Demanda clara desatendida, ordenado por nº de competidores:
- **Agente de Hacienda Pública del Estado** — 14 competidores. ❌ solo catalogada.
- **Gestión Procesal y Administrativa (Justicia)** — 13. ❌ catalogada.
- **Gestión de la Administración Civil del Estado** — 10. ❌ catalogada.
- **Policía Local** — 10 (solo catalogadas municipales). ❌
- Cuerpo Técnico de Hacienda (4), Ujieres Cortes Generales (4), Auxiliar Vigilancia Aduanera (4), Bibliotecarios (4).
- **Prioridad:** las 4 primeras son estatales grandes y populares → mayor ROI para construir. Runbook: `analizador-competidores.md` + `crear-nueva-oposicion.md`. Cruzar con GSC (demanda orgánica) antes de decidir.
