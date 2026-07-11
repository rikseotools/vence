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

### 🟠 [ALTA] Incorporar la oposición Técnico Auxiliar de Informática
- **Qué:** está **catalogada** pero sin temario ni tests. Construir su contenido para hacerla vendible.
- **Por qué:** promesa explícita al usuario — feedback `cbf5998b` (Cristina Laorden, 07/07): *"la ponemos en nuestras tareas pendientes para incorporarla y te avisaremos en breve"*. Prometido "en breve".
- **Cómo:** `docs/maintenance/crear-nueva-oposicion.md`. Avisar a Cristina (`cbf5998b`) al terminar.
- **Estado:** catalogada, sin contenido.

### 🟠 [ALTA] Construir la oposición Ayudantes en Ejecución Penal (Gobierno Vasco)
- **Qué:** `cuerpo-de-ayudantes-en-ejecucion-penal-gobierno-vasco` está **catalogada** (⚪) pero sin temario ni tests. Es el equivalente autonómico a Ayudantes de IIPP en el País Vasco (prisiones transferidas al Gobierno Vasco).
- **Por qué:** promesa explícita al usuario — feedback `b2c2db3f` (adriangarri17@gmail.com, premium, Bilbao, 11/07): le dijimos *"estamos elaborando la oposición… te avisaremos en cuanto esté lista"*. Aún **no hay convocatoria ni temario oficial** (previsto este año); construir cuando salga, verificando cada tema contra el programa oficial.
- **Cómo:** `docs/maintenance/crear-nueva-oposicion.md`. El núcleo común con la estatal (que ya tenemos) se reutiliza. Avisar a `b2c2db3f` al terminar.
- **Estado:** catalogada, sin contenido. Esperando convocatoria oficial.

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

### 🟢 [BAJA] Pagar a Alfonso Martinez su saldo de embajador (6 €)
- **Qué:** `alfonsomartinezocho@gmail.com` (user `7c6612bd`) tiene **6 € pagables** = 2 recompensas de bug aprobadas (3 €+3 €), sin hold, 0 pagado. Emitir vale Amazon.es.
- **Por qué:** dinero ganado y disponible sin cobrar; es el primero que dispara el badge "toca pagar" del nav admin. Amazon.es mínimo 5 € → pagar un vale de 5 € (queda 1 € de saldo) o esperar a que acumule 10 €.
- **Cómo:** `docs/runbooks/embajadores-recompensas.md` (POST `/api/admin/rewards/pay` o `payAccumulated`). Panel `/admin/embajadores/7c6612bd`.
- **Estado:** detectado 11/07, pendiente de decisión de Manuel (no pagar aún).
