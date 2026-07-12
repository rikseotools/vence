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

### 🟡 [MEDIA] Completar los 3 temas específicos de Ayudantes en Ejecución Penal del País Vasco
- **Qué:** la oposición **YA está LIVE** bajo el slug `ayudantes-ejecucion-penal-pais-vasco` (`con_tests`, **50/53 servidos**, verify:scope 53/53). Faltan **3 temas en elaboración**: T22 (Comunicación oral, editorial), T109 (Actividad penitenciaria en CAPV) y T124 (Oficina Única de Gestión). **Las 3 fuentes ya están creadas en BD** (RD 474/2021, Decreto 326/2024, Manual de Gestión Penitenciaria / Instrucción 1/2021); falta **generar las preguntas** (doble pasada, `tech_approved`).
- **Por qué:** feedback `b2c2db3f` (runaans, premium, Bilbao) — **ya avisado el 12/07** de que está disponible (feedback cerrado). Servible casi al 100%; faltan 3 temas específicos.
- **Cómo:** editorial verificado contra las fuentes vascas ya en BD (T22 patrón ley virtual; T109/T124 contra Decreto 326/2024 + Manual). `docs/maintenance/crear-nueva-oposicion.md`.
- **Limpieza:** retirar la aspiracional duplicada `cuerpo-de-ayudantes-en-ejecucion-penal-gobierno-vasco` (catalogada, is_active=false, 0 users).
- **Estado:** LIVE 50/53; 3 temas con fuente creada, preguntas pendientes.

### 🟡 [MEDIA] Completar la parte específica (biblioteconomía) de Auxiliar de Biblioteca del Estado
- **Qué:** la oposición `auxiliar_biblioteca_estado` está LIVE con el Bloque I (legislación, 9 temas servibles, ~8.000 preguntas). Faltan **39 temas marcados "En elaboración"**: Bloque II (Historia del libro, T101-104), Bloque III (Biblioteconomía, T201-230: MARC 21, CDU, tipos de bibliotecas, préstamo, OPAC…), Bloque IV (Práctica, T301-303), y T9 (Ministerio de Cultura) + T11 (Ley 10/2007 y Ley 1/2015 BNE, a importar).
- **Por qué:** creada 12/07 a raíz del bug de Alfonso Martínez (premium sin contenido). Servible ya en legislación, pero la materia propia de la profesión falta. **Comparte Bloque I con la de Archivos** (tarea de arriba).
- **Cómo:** editorial verificado contra fuente (manuales de biblioteconomía + normas de catalogación), lifecycle `tech_approved`, luego `disponible=true`. Ley 10/2007 y 1/2015 vía `docs/maintenance/monitoreo-boe-y-crear-leyes-nuevas.md`. Metodología como la específica de ETGOA / T22 comunicación oral IIPP-PV.
- **Estado:** esqueleto completo + Bloque I servible + go-live 12/07; 39 temas en elaboración.

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

### 🟡 [MEDIA] Desplegar el guardarraíl anti-duplicado de recompensas
- **Qué:** commit `f3bc0954` (dedup por motivo: bug=feedback_id / ugc=url; evento `reward_duplicate`) está en `origin/main` pero **NO desplegado** (prod = `4465d15c`).
- **Por qué:** cierra el hueco de doble recompensa por el mismo motivo (control robusto). No bloquea nada (creación manual ya se verifica), pero conviene que esté vivo.
- **Cómo:** `docs/runbooks/deploy.md` (`scripts/deploy-frontend.sh`, gate CI verde). Va junto con lo que haya en main.
- **Estado:** commiteado + pusheado, pendiente de deploy.

### 🟢 [BAJA] Pagar a Alfonso Martinez su saldo de embajador (9 €)
- **Qué:** `alfonsomartinezocho@gmail.com` (user `7c6612bd`) tiene **9 € pagables** = 3 recompensas de bug aprobadas (3 €×3), sin hold, 0 pagado. La 3ª es del bug de Auxiliar de Biblioteca (12/07). Emitir vale Amazon.es.
- **Por qué:** dinero ganado y disponible sin cobrar; dispara el badge "toca pagar" del nav admin. Amazon.es mínimo 5 € → pagar un vale de 5 € (queda 4 € de saldo) o esperar a que acumule 10 €.
- **Cómo:** `docs/runbooks/embajadores-recompensas.md` (POST `/api/admin/rewards/pay` o `payAccumulated`). Panel `/admin/embajadores/7c6612bd`.
- **Estado:** 9 € acumulados (12/07), pendiente de decisión de Manuel (no pagar aún).
