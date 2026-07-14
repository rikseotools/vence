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

### 🟢 [APARCADA — tracking] 16 preguntas de diagnóstico por imagen/radioprotección esperando su oposición
- **Contexto (14/07, cierre cubo mislink "paciente"):** al cerrar Paciente Quirúrgico salieron 16 preguntas de radiodiagnóstico/ecografía/RMN/medicina nuclear/radioprotección (rayos X=Röntgen, Sievert, gammagrafía, zonas RD 783/2001…). Venían de bancos comerciales genéricos TCAE (Aula Plus / TuTestDigital Murcia) mal vinculadas a "posiciones anatómicas".
- **Qué se hizo:** creada la **ley editorial reusable "Diagnóstico por imagen y radioprotección"** (`e731eb12-0b6b-4596-bcc7-fca56f8efeb4`, slug `diagnostico-por-imagen-radioproteccion`, 4 arts de fuentes oficiales RD 783/2001 + MedlinePlus) y las **16 re-vinculadas ahí** con explicación §8.1, todas `approved`+AVR.
- **Por qué aparcadas (no visibles):** verificado contra fuente oficial (tcae_murcia BORM, tcae_sas BOJA, 0/~330 temas TCAE modelados) que **el temario oficial TCAE NO incluye diagnóstico por imagen** → crear un tema en TCAE sería inventar temario (viola `verificar-epigrafe-topic-scope.md`). Están correctamente ancladas pero invisibles hasta que exista la oposición que sí las tiene en temario (→ ver tarea TSID abajo).
- **Estado:** DONE el anclaje; **reviven automáticamente** al construir la oposición TSID (scopear la ley ahí). Detalle: memoria `project_verificar_vivas_campana`.

### 🟠 [VENDIBLE] Construir la oposición Técnico Superior en Imagen para el Diagnóstico y Medicina Nuclear (TSID)
- **Por qué:** FP sanitario real y vendible cuyo temario SÍ es diagnóstico por imagen + radioprotección + medicina nuclear. Es el **home natural** de la ley editorial `e731eb12` y de las 16 preguntas ya aparcadas (arriba) — encajan de un tirón al escopar la ley en sus temas.
- **Cómo:** flujo `crear-nueva-oposicion.md` + scaffolder (memoria `project_scaffolder_crear_oposicion`); temario oficial del título de TSID (BOE del RD del título + convocatoria del servicio de salud correspondiente); reusar la ley editorial ya creada + ampliarla (protección radiológica avanzada, anatomía radiológica, posiciones radiográficas, contraste, PACS/RIS). Verificar epígrafe→scope al cerrar.
- **Estado:** ABIERTA (sin comprometer). Manuel eligió aparcar las 16 (opción A) y dejar B como pendiente. Bloque mislink ~600 (Outlook 365 + clínicos TCAE) sigue en pausa aparte.

### 🔵 [CAMPAÑA] Verificación de las leyes "nunca verificadas" contra BOE (sweep 14/07)
- **Contexto:** de las 120 leyes con `last_verification_summary IS NULL`, las **47 con `boe_url` de BOE `act.php`** (verificables) se barrieron contra el BOE. Hallazgos por tipo:
- **✅ HECHO — problema de TÍTULO (sistemático):** (1) **strip** del prefijo redundante "Artículo N." → 1.439 títulos DB-wide (guardarraíl `scripts/check-article-title-prefix.cjs` = 0); (2) **backfill** de rúbricas faltantes desde BOE en títulos "bare" ("Artículo N" sin rúbrica) → ~264 restauradas, con **guard de `boe_url` por ley** (0 fallos → ningún Archivos oculto). FTS se re-indexa por trigger; embeddings NULLeados (no crítico: 33k/57k ya eran NULL, chat usa keyword fallback; regen = tarea infra aparte, script apunta a Supabase congelada).
- **🔴 EN CURSO — content drift REAL:** **526 `content_mm` en 30 leyes** aflorados. Campaña por-ley (align mismo-número a BOE + auditar preguntas de drift real), priorizada por uso. **3/30 HECHAS (las de más uso, 253 preg):** RD 2/2006 PRL PN (164, limpia), LOSCAM (63, +3 obsoletas "Áreas Sanitarias"→needs_human), DLeg 1/2002 CLM (26, limpia). **27 restantes** (uso menor): LO 2/1989 (114 cm), Decreto 315/1964 (83), RD 563/2010 (64), Ley 4/2011 Empleo CLM, etc. Parte formato (align inocuo), parte drift real (auditar preguntas). Método: memoria `project_badge_monitoreo_verificacion_boe_count_0` §método.
- **PEND menor:** 4 leyes con title_mm residual (casos borde irregulares: sub-números, sin separador); ~87 títulos con formato irregular no stripeados; **63 leyes no-BOE + 10 doc.php** nunca verificadas (fuente regional/editorial → verificación aparte, no por API BOE).

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
