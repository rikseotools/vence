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

### 🟢 [MEJORA APP — no urgente] Email RGPD de borrado *exactly-once* (marcador durable en `deleted_users_log`)
- **Qué:** en `DELETE /api/admin/delete-user`, el correo de confirmación RGPD (Art. 12.3) puede **duplicarse** en un caso raro: si un 1er intento borró la cuenta y **envió el email** pero devolvió 500 por otra causa (p.ej. error del store de auth legacy), al reintentar (perfil ya ausente + fila de auditoría) la ruta reenvía el email desde el email durable de `deleted_users_log`. El reintento ya NO re-borra ni da 500 perpetuo (arreglado `4ef7a929`), pero el email no es *exactly-once*.
- **Por qué:** cumplimiento/UX: un usuario borrado podría recibir 2 correos "cuenta eliminada". Impacto bajo (camino raro), pero es un cabo real anotado en la revisión adversarial del fix.
- **Cómo:** columna `deleted_users_log.rgpd_email_sent_at timestamptz` (migración additiva) + mapearla en Drizzle; enviar el email solo si es `NULL` y sellarla tras el envío OK. Enlaza con memoria `feedback_delete_user_api_504_fallback`.
- **Estado:** ABIERTA (follow-up del fix desplegado 15/07). No bloqueante.

### 🟢 [MEJORA APP — no urgente] Poblar títulos y capítulos (`law_sections`) en TODAS las leyes + mostrarlos en teoría
- **Qué:** hoy la estructura de títulos/capítulos (`law_sections`: título + descripción + rango de artículos) está poblada en **solo 13 de 1.291 leyes activas** y solo se usa para el control "Filtrar por Títulos"; nunca se muestra como **cabecera inline** al leer la teoría. Objetivo: poblar `law_sections` en todas las leyes (verificado contra fuente oficial/BOE, **nunca contra el "art 0 — Estructura" sintético**, que puede estar fabricado) **y** renderizar los títulos/capítulos como cabeceras sobre los artículos que agrupan.
- **Por qué:** (1) petición **repetida** de usuaria premium fiel (Nila, `auxiliar_administrativo_madrid`, feedbacks 26/05 y 15/07: "poner los títulos correspondientes… los artículos hacen referencia a los títulos"); (2) los **filtros por título/capítulo** solo funcionan donde hay `law_sections` → hoy fallan/no aparecen en el 99% de leyes; (3) la **teoría que imprimen los usuarios** llevaría los títulos y capítulos (mejor estudio y referencia cruzada entre artículos).
- **Cómo:** `law_sections` (título, `article_range_start/end`, `section_type` título/capítulo, `order_position`); fuente = BOE/gaceta oficial de cada ley. Render: `app/teoria/[law]/LawArticlesClient.tsx` (hoy solo filtra vía `/api/teoria/sections` → `fetchLawSections`). Empezar por temario de oposiciones vivas (p.ej. Estatuto de Autonomía CM, LO 3/1983, hoy 0 filas).
- **Estado:** ABIERTA. Detectado 15/07 (feedback Nila, cerrado en silencio). Sin recompensa (sugerencia, no bug funcional).

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

### 🟡 [MEDIA — calidad] Verificar + completar Aux. Administrativo del Ayuntamiento de Madrid
- **Qué:** `auxiliar_administrativo_ayuntamiento_madrid` (22 temas, activa) NO está verificada ni completa: (1) **Paso 1 epígrafe 22/22 `never_sourced`** + **Paso 2 scope `never_verified`** (nunca auditada contra el PDF oficial de madrid.es); (2) **T21 Word + T22 Excel: 0 preguntas** con `disponible=true` (el usuario los ve vacíos); (3) **8 temas finos con solo 6 preguntas** (T8-T12 Ley Capitalidad/Pleno/Distritos/ROGA + T18-T20 atención ciudadanía/sugerencias). El núcleo SÍ está bien (T1 1.081, T3 1.625, T4 1.212, T15/T16/T17 cientos).
- **Por qué:** detectado 15/07 al investigar feedback `9d7cabdd` (Esther Pimentel, free, la buscaba). Está activa y vendible pero con huecos que un usuario ve.
- **Cómo:** Paso 1 clonar epígrafe del PDF oficial (`programa_url` = madrid.es BasesEspecificas.pdf) → `verify:scope` 2 agentes → generar preguntas de T21/T22 (ofimática Word/Excel Office) + reforzar los 8 finos. Doble auditoría + `tech_approved`.
- **Estado:** sin empezar (en curso 15/07). Conecta con los otros huecos de ofimática (Windows/Office de otras oposiciones).

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

### 🟡 [MEDIA] Huecos de contenido en Aux. Administrativo Junta de Extremadura (verify:scope 14/07)
- **Qué:** tras `verify:scope` de `administrativo_extremadura` (30 temas, 2 agentes + consenso). **T15 RESUELTO 14/07** (el Reglamento sancionador Decreto 9/1994 estaba en BD mal etiquetado "Ingreso" + FABRICADO por IA → importados los 18 arts LITERALES del DOE oficial + 2 preguntas re-vinculadas). **Queda solo T24**: falta la *"Ley de Presupuestos Generales de la CA de Extremadura"* (normas de contratación/convenios/encargos/transferencias) — es una **ley ANUAL** (decisión: no forzar import de ley anual por unos arts que se quedan `stale`; la contratación la cubre Ley 9/2017). No está en `laws`. Estado: **29/30 `verified_correct`**.
- **Extra:** los **arts 74-79 (negociación colectiva)** de la Ley 13/2015 FP Extremadura quedan **huérfanos** (no están en el epígrafe de ningún tema 6-10) → decidir si van a algún tema o están fuera de programa.
- **Por qué:** la ley nacional principal (Ley 40/2015 en T15, Ley 9/2017 en T24) sí está cubierta; falta el complemento regional que el epígrafe nombra. No se inventa contenido.
- **Cómo:** crear cada ley regional desde el DOE/BOE (`monitoreo-boe-y-crear-leyes-nuevas.md` §"Crear ley nueva") y escoparla al tema; re-verificar. Runbook `verificar-epigrafes-scope.md`.
- **Estado:** resto de la oposición **28/30 `verified_correct`** (incl. función pública 6/7/8/10 reparada: reparto correcto de la Ley 13/2015 por epígrafe, re-verificado).

### 🟢 [SEGUIMIENTO — outward] Avisar a los interesados de que TAI está completa
- **Qué:** TAI (`tecnico_informatica`) está **COMPLETA y verificada** (33 temas, ~11k preguntas, S1 scope 33/33 correct + S2 literalidad 33/33 literal, T106 DNI-e cerrado con RD 255/2025). Ver memoria `project_tai_estado_construccion`. Queda solo la acción *outward*: avisar a Cristina Laorden (`cbf5998b`) y a los ~20 usuarios con TAI como objetivo (newsletter `novedad-convocatoria`).
- **Por qué:** promesa a Cristina + demanda real. Ojo: el examen 2025 ya se celebró (23/05/2026); enfocar el aviso a la preparación / próxima OEP, no a una convocatoria abierta.
- **Estado:** contenido 100% listo; **confirmar con Manuel antes de enviar** (acción outward).

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

### 🟠 [ALTA] Construir la oposición Ayudantes en Ejecución Penal (Gobierno Vasco)
- **Qué:** `cuerpo-de-ayudantes-en-ejecucion-penal-gobierno-vasco` está **catalogada** (⚪) pero sin temario ni tests. Es el equivalente autonómico a Ayudantes de IIPP en el País Vasco (prisiones transferidas al Gobierno Vasco).
- **Por qué:** promesa explícita al usuario — feedback `b2c2db3f` (adriangarri17@gmail.com, premium, Bilbao, 11/07): le dijimos *"estamos elaborando la oposición… te avisaremos en cuanto esté lista"*. Aún **no hay convocatoria ni temario oficial** (previsto este año); construir cuando salga, verificando cada tema contra el programa oficial (excluirá temas de la estatal y añadirá autonómicos).
- **Cómo:** `docs/maintenance/crear-nueva-oposicion.md`. El núcleo común con la estatal (que ya tenemos) se reutiliza. Avisar a `b2c2db3f` al terminar.
- **Estado:** catalogada, sin contenido. Esperando convocatoria oficial.

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

### 🟢 [SEGUIMIENTO] Capturar la fecha de examen de las 2 oposiciones de la Universidad de León
- **Qué:** Auxiliar Administrativo (`auxiliar-administrativo-universidad-leon`) y Escala Administrativa (`administrativo-universidad-leon`) tienen la **inscripción cerrada** y el **examen pendiente de fecha** (`exam_date=null`). Ambas con contenido completo y vendible (15/07).
- **Cómo:** cuando la ULE publique la fecha del primer ejercicio (seguimiento en `unileon.es/convocatorias-ptgas-pdi`), actualizar `exam_date` + hitos de la landing. El cron de seguimiento de convocatorias debería detectarlo; si no, revisar a mano.
- **Estado:** contenido LISTO; solo falta la fecha oficial (no publicada a 15/07).
