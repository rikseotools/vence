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

### 🟡 [MEDIA — calidad] Verificar + completar Aux. Administrativo del Ayuntamiento de Madrid
- **Qué:** `auxiliar_administrativo_ayuntamiento_madrid` (22 temas, activa) NO está verificada ni completa: (1) **Paso 1 epígrafe 22/22 `never_sourced`** + **Paso 2 scope `never_verified`** (nunca auditada contra el PDF oficial de madrid.es); (2) **T21 Word + T22 Excel: 0 preguntas** con `disponible=true` (el usuario los ve vacíos); (3) **8 temas finos con solo 6 preguntas** (T8-T12 Ley Capitalidad/Pleno/Distritos/ROGA + T18-T20 atención ciudadanía/sugerencias). El núcleo SÍ está bien (T1 1.081, T3 1.625, T4 1.212, T15/T16/T17 cientos).
- **Por qué:** detectado 15/07 al investigar feedback `9d7cabdd` (Esther Pimentel, free, la buscaba). Está activa y vendible pero con huecos que un usuario ve.
- **Cómo:** Paso 1 clonar epígrafe del PDF oficial (`programa_url` = madrid.es BasesEspecificas.pdf) → `verify:scope` 2 agentes → generar preguntas de T21/T22 (ofimática Word/Excel Office) + reforzar los 8 finos. Doble auditoría + `tech_approved`.
- **Estado:** sin empezar (en curso 15/07). Conecta con los otros huecos de ofimática (Windows/Office de otras oposiciones).

### ✅ [HECHA 15/07] Aux. Admvo. Universidad de León — OPOSICIÓN COMPLETA (21/21 temas)
- **Qué:** (1) **T15 "Estatuto del Estudiante Universitario (RD 1791/2010)"** — el temario oficial (BOE-A-2026-4150, Anexo II) lo pide **COMPLETO** (sin delimitar títulos), pero en BD solo hay **12 de ~65 artículos** con 7 preguntas → sincronizar el RD 1791/2010 entero desde el BOE + generar preguntas de los ~53 artículos que faltan. (2) **T14 "Normativa de matrícula y permanencia de la ULE"** — verificar que la normativa interna ULE está cargada al completo (hoy 5-8 arts, 7 preg).
- **Por qué:** feedback `f326d13c` de Ana Llano (anais.llafe@gmail.com, **premium**, `auxiliar_administrativo_universidad_leon`, 14/07). Verificado contra el BOE oficial: tiene razón, están incompletos. **Se le prometió "a lo largo de esta semana" (NO se le avisa; solo cumplir el plazo).**
- **Cómo:** sync RD 1791/2010 desde BOE (`monitoreo-boe-y-crear-leyes-nuevas.md`) → generar preguntas ancladas al texto + doble auditoría ciega + `tech_approved`. T14: localizar la normativa ULE oficial (interna, boe=null) y completarla.
- **HECHO (15/07):** **T15 RD 1791/2010** sincronizado desde BOE (`BOE-A-2010-20147`): los 12 artículos en BD eran **paráfrasis editoriales** (similitud 24-60% vs BOE) → alineados a verbatim + añadidos 56 → **67/67 arts**. De las 7 preguntas viejas, 3 (arts 25/30/42) inventaban contenido que el verbatim no soporta → `needs_human` (auditoría ciega x2, nunca auto-flip); 4 OK. **79 preguntas IA nuevas** (batch `gen_rd1791_leon_2026-07-15`) con doble auditoría ciega 2×OK → **67/67 arts con cobertura, 83 preg**. **T14 Normativa ULE**: reconstruida a **verbatim 2022** (RD 822/2021, PDF oficial vía Playwright/pdftotext) — separado "4 y 5" en arts 4+5, **añadido art 8 (Límites y extinción, faltaba)**, preámbulo + disposiciones, desactivado "Anexo" (contenido ajeno), 7 preguntas viejas re-vinculadas a su art real + **5 nuevas** → **8/8 arts, 12 preg**. Beneficio colateral: misma normativa escopada en T19 de `administrativo_universidad_leon`. Caché revalidada (MV+tags+ISR), API en vivo confirma T15=83/T14=12.
- **AMPLIADO (15/07): oposición entera revisada y COMPLETADA — 21/21 temas con cobertura, 0 vacíos.** Al auditar la opo salieron 4 temas "vacíos" que en realidad eran el **bug `topic_scope.article_numbers=[]`** (item ALTA "barrido global" de este backlog; univ_leon estaba anotada como misconfig pendiente en memoria office-split → resuelta). Fix por epígrafe reusando scopes vetados: **T19** Informática/Windows10 → **1.052 preg** (era 0); **T20** Ofimática (Office 2021 = **escritorio** → común+solo-Escritorio, NO web) → **2.048 preg**; **T21** Internet + **Google Workspace** (insertada) y **borrada fila Outlook** (cliente equivocado) → **602 preg**; **T9** RD 822/2021 sync BOE (`BOE-A-2021-15781`, 37 arts), scope Cap II-VI+VIII, 5 viejas inventadas→needs_human + **22 IA** (2×OK) → **33 preg** (art 6 = remisión a RD 99/2011, hueco honesto). Convocatoria **VIVA** (listas definitivas admitidos 14/07, examen pendiente; NO rollover). Detalle: memoria `project_leon_t14_t15_completada`.
- **Follow-ups menores:** re-registrar `verify:scope` de T15/T9 (scopes cambiados, stale por trigger); T10-13/17 al mínimo (6 preg, finos pero funcionales); mismo bug scope vacío PEND en `ingesa` y `scs_canarias` (office-split).

### ✅ [HECHA 15/07] Estrechar scope T14 Aux. Admvo. Aragón (VIII Convenio Colectivo PL Aragón)
- **Qué:** T14 (`auxiliar_administrativo_aragon`, "Negociación laboral… convenios colectivos") escopa los **137 artículos ENTEROS** del VIII Convenio Colectivo PL Aragón (ley `28f62de0`), pero el epígrafe lo delimita a *"ámbito de aplicación **y** derechos y deberes del personal laboral"*. Resultado: **93/137 arts sin preguntas** (jubilación, pólizas, ropa de trabajo, anticipos, acción social…) que el usuario ve en gris y le generan alarma.
- **Por qué urge:** feedback `310bb050` de Isabel B (isa91187@gmail.com, **premium**, examen en ~3 días desde 14/07). Ya respondida (que su temario no pide el convenio entero + estamos ajustando el filtro). Hay que cumplirlo YA para que no vea 93 arts vacíos.
- **Cómo:** verify:scope contra el **BOA `BOA20230519011`** (la BD NO tiene título/capítulo del convenio → traer la estructura oficial) → identificar los artículos de "ámbito de aplicación" (art 1) + el título/capítulo de "derechos y deberes del personal laboral" → estrechar `topic_scope` a ese subconjunto (2 agentes, judgment-gate; NO quitar de más). NUNCA generar 93 preguntas de artículos fuera de programa.
- **HECHO (15/07):** verificado contra la estructura oficial del BOA (traída con Playwright del portal mia.aragon.es), consenso 2 agentes → **scope 137→69 arts** (Cap I-VI; fuera Cap VII-XI: excedencias, salud laboral, concursos, disciplinario, representación). Generadas **25 preguntas IA** (batch `gen_convenio_aragon_2026-07-15`, 25/25 PERFECT en triple auditoría) → **69/69 arts con cobertura**. Follow-up menor: `programa_url` apunta a bases/reseña, no al temario. Conecta con los otros huecos de Aragón (T6/T16, siguen abiertos).

### 🟠 [ALTA — bug funcional] El endpoint de borrado de cuenta nunca completa (falta insertar `deleted_users_log`)
- **Qué:** `DELETE /api/admin/delete-user` falla siempre con *"deleted_users_log row … is missing — insert it (with deletion_reason) before calling delete_user_account"*. `deleteUserData` (queries.ts:44-50) **exige** que la fila de auditoría exista antes de llamar a `public.delete_user_account(uuid)`, pero ni la ruta ni el flujo de "solicitar borrado desde perfil" la insertan → todo borrado admin requiere fallback manual por SQL.
- **Por qué:** un usuario que pide borrar su cuenta no se borra por el panel; hay que meter mano en RDS. Rompe el derecho de supresión (RGPD) por la vía normal y obliga a intervención manual cada vez.
- **Cómo:** insertar la fila `deleted_users_log` (original_user_id, email, plan_type, target_oposicion, registered_at, deletion_reason, requested_via='feedback') **dentro de la ruta** justo antes de `deleteUserData`, con los datos capturados del perfil. Idempotente (no duplicar si ya existe). Test que cubra el happy-path completo end-to-end. (Enlaza con memoria `feedback_delete_user_api_504_fallback`.)
- **Estado:** detectado 14/07 al procesar feedback account_deletion `757d7f41` (anteromilan@gmail.com borrado a mano por SQL, con log de auditoría). Endpoint sin arreglar.

### 🟡 [MEDIA — cobertura fina] Ampliar preguntas del Tema 8 de Aux. Administrativo SMS (Ley 4/1994 Murcia)
- **Qué:** tras estrechar el scope del Tema 8 a los arts **9,10,11,12,25** de la Ley 4/1994 de Salud de la Región de Murcia (era 9-26, inflado), el tema queda con solo **8 preguntas activas**. Generar más ancladas a esos 5 artículos (Fines, Plan de Salud, Consejo de Salud Región, mapa sanitario, órganos del SMS).
- **Por qué:** feedback de daluamva@gmail.com (premium, `22835b84`, 14/07) → tenía razón, el scope sobre-incluía Áreas de Salud/zona básica (materia del T7) y el régimen del SMS (T9/T12). Corregido y verificado (2 agentes + epígrafe literal). Ahora falta densidad de preguntas.
- **Cabo de criterio (anotado):** los arts 20-21 (naturaleza/fines del SMS) se dejaron FUERA por lectura literal del epígrafe ("El SMS: **órganos**…"); si se detecta que el régimen jurídico del SMS no lo cubre ningún otro tema del programa, reconsiderar meterlos. Hoy: fuera.
- **Cómo:** generar preguntas ancladas al texto de cada artículo (BORM/BOE-A-1994-22255) + doble auditoría ciega + `tech_approved`. Runbook `salud-contenido.md` (article_no_coverage) / `revisar-preguntas-con-agente.md`.
- **Estado:** scope corregido y aplicado 14/07 (MV refrescada + revalidate), pendiente generar preguntas.

### 🟡 [MEDIA — demanda de usuaria] Supuestos prácticos para Administrativo de la Comunidad de Madrid
- **Qué:** crear supuestos prácticos (`exam_cases`) para `administrativo_madrid`. Hoy tiene **0** (el temario sí está: 47 temas, ~11.177 preguntas activas). Otras oposiciones ya los tienen (administrativo-seguridad-social 8, auxilio-judicial 8, auxiliar-administrativo-carm 6, administrativo_estado 2…).
- **Por qué:** demanda directa — feedback de Raquel García Moyano (`garciamoyanoraquel7179@gmail.com`, free, usuaria activa con 26 tests hechos, opos `administrativo_madrid`, 13/07). El administrativo C1 lleva 2º ejercicio de supuesto práctico → contenido de conversión. Ya se le respondió que están "en elaboración".
- **Cómo:** modelo `exam_cases` (`oposicion_type='administrativo_madrid'`, `case_title`, `is_active`). Anclar a fuente oficial (temario/normativa de la convocatoria de Madrid), nunca inventar. Doble auditoría antes de activar.
- **Estado:** detectado 13/07 (triaje feedback), 0 supuestos, sin empezar.

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

### 🟡 [MEDIA] Huecos de contenido en Aux. Administrativo Gobierno de Aragón (revisión epígrafes 13/07)
- **Qué:** dos conceptos que el epígrafe oficial cita pero sin artículo que los cubra: (1) **T6** "fuentes del derecho administrativo" (jerarquía normativa) — no existe artículo estatal genérico para escopar; (2) **T16** "certificados y firma electrónica" — el editorial de Informática Básica/Red Internet no lo trata.
- **Por qué:** detectado en la verificación scope↔epígrafe (2 agentes, consenso `needs_human`). No se inventa contenido → hay que crear el artículo editorial correspondiente y escoparlo.
- **Cómo:** crear artículo editorial (fuente normalizadora) para cada concepto y añadirlo al `topic_scope` del tema; re-verificar. Runbook `verificar-epigrafes-scope.md`.
- **Estado:** resto de la oposición verificado (18/20 correct tras arreglar T12 mover II Acuerdo→T13 y T8/T7 mover reglamentos 127-133). Solo estos 2 huecos.

### ✅ [HECHA 15/07] Preguntas de temas sin cubrir de Aux. Admvo. Diputación de Cuenca
- **Qué:** faltan preguntas en 4 temas de `auxiliar_administrativo_diputacion_cuenca` (el resto está bien cubierto): **T5** Régimen local (TRRL RD Leg 781/1986 + ROF RD 2568/1986, hoy 9 preg), **T14** Reglamento de Bienes de las EELL (RD 1372/1986, hoy 7 preg), **T19** Informática básica + Explorador Windows 10 (0), **T20** Ofimática Word/Outlook/Excel Office 2021 (0).
- **Por qué urge:** **compromiso con fecha** — feedback `affe9ed8` (sandradrz / "Ale", premium activa, 12/07): le dijimos que **estarán disponibles esta semana** (~antes del 19/07/2026).
- **Cómo:** T5/T14 = editorial legal anclado al BOE de esos RD (nunca inventar). T19/T20 = familia Windows/Office (ver tareas de informática pendientes de otras oposiciones). Lifecycle `tech_approved` + doble auditoría ciega. Avisar a Ale (`sandradrz@gmail.com`, feedback `affe9ed8`) al terminar.
- **HECHO (15/07):** el backlog estaba **stale** — T19/T20 ya estaban cubiertos (1052/2766 preg), no a 0. Huecos reales solo T5/T14. Verificación previa (2 agentes) cazó **sobre-scope oculto**: T5 TRRL incluía Título II (Municipio) fuera de epígrafe → corregido a {1,25-34} (Provincia); ROF −art35; T14 Bienes −Cap III. Re-verificados `verified_correct`. Generadas **16 preguntas IA** (batch `gen_cuenca_regimen_local_2026-07-15`, 16/16 PERFECT triple auditoría) → **T5 9→22, T14 7→18**. Follow-ups menores: `programa_url` a bases/reseña no temario; epígrafe no confirmado byte a byte vs BOP; TRRL con títulos de artículo vacíos. Falta: avisar a Ale (`sandradrz@gmail.com`).

### 🔴 [URGENTE] Construir los 5 temas de la parte específica de Téc. Auxiliar (Aux. de Servicios) UMU
- **Qué:** faltan T9 (funciones especialidad), T11 (máquinas reproductoras), T13 (control de accesos), T14 (seguridad edificios/incendios), T18 (mantenimiento 1er nivel TIC) — `disponible=false`, 0 scope, 0 preguntas. Los 5 tienen **epígrafe oficial ya cargado**.
- **Por qué urge:** convocatoria **R-838/2026 con inscripción ABIERTA** (18 plazas); ya **2 usuarias** lo han pedido (Laura García, María Sol). Sin la parte específica no es vendible al 100% justo en la ventana de inscripción.
- **Cómo:** memoria `project_umu_aux_servicios_parte_especifica` (plan 2 vías) + `docs/maintenance/crear-nueva-oposicion.md`. Generar editorial con fuente (nunca inventar), lifecycle `tech_approved`, luego `disponible=true`.
- **Estado:** VÍA A (T8/T10/T12) hecha; VÍA B (estos 5) pendiente.

### 🟠 [ALTA] Completar la parte específica de Técnico Auxiliar de Informática (TAI) del Estado
- **Qué:** `tecnico_informatica` está **LIVE** con el Bloque I (Organización del Estado + Administración electrónica, 9 temas servibles) + 2 temas del Bloque II. Faltan **22 temas marcados "En elaboración"**: Bloque II (Tecnología básica, 3 de 5), Bloque III (Desarrollo de sistemas, 9 temas), Bloque IV (Sistemas y comunicaciones, 10 temas). Esqueleto completo (33 temas, todos visibles), 22 disponible=false.
- **Por qué:** promesa a Cristina Laorden (feedback `cbf5998b`, 07/07). Ya hay ~20 usuarios con TAI como objetivo, **todos bien asignados** a `tecnico_informatica` (verificado 12/07). Servible en organización, pero la parte técnica de informática (el núcleo) falta.
- **Cómo:** editorial verificado contra el temario oficial (BOE de la convocatoria TAI), lifecycle `tech_approved`, luego `disponible=true`. `docs/maintenance/crear-nueva-oposicion.md`.
- **Estado (12/07):** LIVE Bloque I; 22 temas en elaboración. `coverage_level` ya corregido a `con_tests`. Esqueleto **certificado completo contra BOE-A-2024-14098** (33 temas = oficial, 9-5-9-10). Cristina ya avisada de que está disponible (feedback cerrado); avisar de nuevo al completar la parte técnica.

### ✅ [HECHA 12/07] Ayudantes en Ejecución Penal del País Vasco COMPLETA (53/53)
- **Qué:** `ayudantes-ejecucion-penal-pais-vasco` **servible al 100% (53/53), verify:scope 53/53 verified_correct**. Los 3 últimos temas (T22 Comunicación oral, T109 Actividad penitenciaria CAPV, T124 Oficina Única) generados 12/07 contra las fuentes vascas creadas en BD (T22 ley virtual comunicación oral; T109 RD 474/2021 + Decreto 326/2024 art 9/12/13/DA2; T124 Manual/Instrucción 1/2021 C.1-C.3). 16 preguntas IA + auditoría ciega 26/26 PERFECT + tech_approved. runaans ya avisado (feedback `b2c2db3f`).
- **Limpieza menor pendiente (opcional):** retirar del onboarding la aspiracional duplicada `cuerpo-de-ayudantes-en-ejecucion-penal-gobierno-vasco` (0 usuarios; toca `OnboardingModal.tsx` + deploy).

### ✅ [HECHA 12/07] Auxiliar de Biblioteca del Estado COMPLETA (48/48)
- **Qué:** `auxiliar_biblioteca_estado` LIVE y **servible al 100% (48/48 temas)**. Bloque I Legislación 11/11, Bloque II Historia del libro 4/4, Bloque III Biblioteconomía 30/30, Bloque IV Práctica 3/3.
- **Cómo se hizo:** Bloque I reutilizando banco legal existente + 3 islotes normativos (leyes importadas del BOE: Ley 10/2007, Ley 1/2015 BNE, Ley 23/2011). Toda la biblioteconomía (Bloques II-IV + T9/T11/T213) generada como **contenido editorial anclado a fuentes reputadas** (ley virtual `biblioteconomia-editorial` `d2cea377`, arts = temas; IFLA, BNE, Library of Congress, UNE/UDC, RAE, W3C, OAI, Ministerio de Cultura), **~191 preguntas IA + doble auditoría ciega Sonnet por lote + balance de distractores + posición uniforme + `tech_approved`**. Método replicable: ver [[reference_leyes_virtuales_editoriales]] + `docs/maintenance/generar-preguntas-con-ia.md`.
- **Pendiente menor (opcional):** desplegar el subtítulo cosmético de bloque "en elaboración" (commit `7bdbd9e4`) ya es innecesario (todo servido); revisar si conviene quitarlo. Aviso a Alfonso ya enviado (feedback ccb41d99).

### 🟠 [ALTA] Framework profesional de canaries (P1-P3) — que no se repita el incidente 11/07
- **Qué:** clase base `CanaryProbe` + exclusión central del usuario sintético de analíticas (`SYNTHETIC_USER_IDS`) + migrar todos los canary a la base + guardarraíl CI + runbook. Que ningún write-canary pueda acumular datos sin límite ni contaminar métricas.
- **Por qué:** el 11/07 `canary-stats-pipeline` acumuló 10.737 filas en `test_questions` sin limpiar → su drift-query se ahogó (13,6s → cron falla → alertas). P0 (purga + auto-acotado de ese canary) HECHO; falta el framework para el resto.
- **Cómo:** `docs/roadmap/canary-framework.md` (diseño + fases). P1 incluye **verificar/blindar** que `smoke@vence.es` no sesga rankings/dificultad.
- **Estado:** P0 hecho y desplegado. P1-P3 pendientes.

### 🟠 [ALTA] Construir la oposición Auxiliar de Archivos de la AGE (Sección Archivos, C1)
- **Qué:** **Escala de Auxiliares de Archivos, Bibliotecas y Museos de OO.AA. del Ministerio de Cultura — Sección Archivos**, grupo **C1** (título Bachiller/Técnico). Catalogada pero SIN temario/tests (todas las entradas "archivo" están inactivas). Referencia: **BOE-A-2023-11435** (169 plazas, OEP 2020-2022).
- **Por qué:** promesa explícita — feedback `1a698b2f` (Raquel Hermoso, 10/07, free, Madrid): le dijimos *"la estamos elaborando… te avisaremos cuando esté disponible"*. Hay **compromiso de aviso**. Demanda por ahora baja (2 menciones "archivo" en BD), pero prometida.
- **Cómo:** temario oficial = **Anexo II del BOE-A-2023-11435**. **Parte general (temas 1-8) = solape EXACTO con Auxiliar Administrativo del Estado** → reusar scope (CE + Corona, Cortes, org. territorial/CCAA, AGE, Ley 39/2015, EBEP, LO 3/2007 igualdad, Ley 19/2013 transparencia). **Parte específica** (temas 9-18 Ministerio de Cultura/Ley 16/1985/Sistema de Archivos + historia cultural; temas 19+ archivística) = editorial con fuente (BOE/manual), **nunca inventar**, lifecycle `tech_approved`. Guía: `docs/maintenance/crear-nueva-oposicion.md`.
- **Avisar a Raquel** (`raquel.hermoso.lindoso@gmail.com`, feedback `1a698b2f`) al terminar.
- **Estado:** catalogada, sin contenido. Prometida a 1 usuaria.

### 🟠 [ALTA] Añadir contexto introductorio de la CE 1978 al Tema 1 de Aux. Administrativo de Andalucía
- **Qué:** añadir al Tema 1 (`auxiliar_administrativo_andalucia`) una introducción a la Constitución: **antecedentes, características y estructura** de la CE 1978 (ayuda a entenderla y puede caer en el examen).
- **Por qué:** promesa explícita — feedback `ce6e250e` (maricarmen alba, 09/07): *"vamos a añadir ese contexto introductorio al tema"*. Nota: el epígrafe oficial del T1 NO lo exige literal → es material de apoyo, no tocar el scope oficial; añadir como teoría introductoria.
- **Estado:** pendiente. Avisar a maricarmen al terminar.

### 🟢 [DEMANDA — valorar, no comprometido] Oposiciones pedidas por usuarios (aún no en plataforma)
- **Limpiador/a-Camarero/a (actividades domésticas)** — interés apuntado (feedback `e7f02223`, Mari Carmen Verdejo, 29/06). Valorar demanda antes de construir.
- **Cuidador de la Diputación de Córdoba** — interés apuntado (feedback `705aeaab`, maricarmen alba, 09/07). Parecido a SAS pero con atención socio-sanitaria; distinta oposición. Valorar demanda.

### 🟡 [MEDIA — decisión de coste] Provisionar RDS read replica para lecturas admin/analytics
- **Qué:** una **RDS read replica** a la que apuntar los endpoints admin/analytics pesados (`getReadDb()` + `USE_READ_REPLICA=true` + `DATABASE_URL_REPLICA`). La fontanería en `db/client.ts` **ya existe** (patrón era-Supabase); tras el cutover a RDS (04/07) apunta al primario → hoy no aísla nada.
- **Por qué:** aísla el **CÓMPUTO** de las lecturas analíticas del hot-path de usuarios (lo que los pools separados NO hacen — misma instancia física). Es la capa 3 del fix de contención RDS del 12/07.
- **Gatillo:** hacerlo **solo si**, ya con la cache de paneles admin desplegada (12/07), la contención del primario persiste. No pagar infra (~coste de otra instancia RDS) por un escaneo que la cache ya eliminó. Medir 1-2 semanas primero.
- **Cómo:** `docs/runbooks/contencion-rds-paneles-admin.md` §3. Provisionar réplica en `aws rds create-db-instance-read-replica` (perfil `vence`) → set `DATABASE_URL_REPLICA` en SSM → flip `USE_READ_REPLICA=true` → apuntar endpoints admin a `getReadDb()`.
- **Estado:** pendiente, gatillado (no antes de medir).

### 🟡 [MEDIA] Desplegar el guardarraíl anti-duplicado de recompensas
- **Qué:** commit `f3bc0954` (dedup por motivo: bug=feedback_id / ugc=url; evento `reward_duplicate`) está en `origin/main` pero **NO desplegado** (prod = `4465d15c`).
- **Por qué:** cierra el hueco de doble recompensa por el mismo motivo (control robusto). No bloquea nada (creación manual ya se verifica), pero conviene que esté vivo.
- **Cómo:** `docs/runbooks/pusheo-revision-despliegue.md` (`scripts/deploy-frontend.sh`, gate CI verde). Va junto con lo que haya en main.
- **Estado:** commiteado + pusheado, pendiente de deploy.

### 🟢 [BAJA] Pagar a Alfonso Martinez su saldo de embajador (9 €)
- **Qué:** `alfonsomartinezocho@gmail.com` (user `7c6612bd`) tiene **9 € pagables** = 3 recompensas de bug aprobadas (3 €×3), sin hold, 0 pagado. La 3ª es del bug de Auxiliar de Biblioteca (12/07). Emitir vale Amazon.es.
- **Por qué:** dinero ganado y disponible sin cobrar; dispara el badge "toca pagar" del nav admin. Amazon.es mínimo 5 € → pagar un vale de 5 € (queda 4 € de saldo) o esperar a que acumule 10 €.
- **Cómo:** `docs/runbooks/embajadores-recompensas.md` (POST `/api/admin/rewards/pay` o `payAccumulated`). Panel `/admin/embajadores/7c6612bd`.
- **Estado:** 9 € acumulados (12/07), pendiente de decisión de Manuel (no pagar aún).

### 🟡 [MEDIA] Migrar /leyes/[law] a on-demand (arreglar la flakiness del build)
- **Qué:** `/leyes/[law]` es la ÚNICA ruta de alto volumen que sigue en SSG real (`generateStaticParams` → 1.278 leyes). Prerenderiza 1.278 páginas RDS-dependientes en cada build → **CONNECT_TIMEOUT a RDS + OOM** intermitentes (build falló 2 veces el 12/07 desplegando el fix de /test/articulo).
- **Por qué:** el resto de rutas dinámicas ya usa on-demand (`return []`) desde 30/04/2026; ésta se quedó atrás. Acopla la fiabilidad/memoria del build a RDS.
- **Cómo:** `docs/runbooks/build-resilience-leyes-ondemand.md` (diseño en 3 piezas: on-demand + hot-set SEO desde GSC + warming + revalidación por dato-BOE). SEO-safe (precedente propio, `cache-revalidation.md` §force-dynamic). Con capas de seguridad + canary.
- **Estado:** diseñado (runbook), sin implementar.
