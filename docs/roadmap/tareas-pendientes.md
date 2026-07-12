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

### 🔴 [URGENTE — esta semana, prometido] Preguntas de 4 temas sin cubrir de Aux. Admvo. Diputación de Cuenca
- **Qué:** faltan preguntas en 4 temas de `auxiliar_administrativo_diputacion_cuenca` (el resto está bien cubierto): **T5** Régimen local (TRRL RD Leg 781/1986 + ROF RD 2568/1986, hoy 9 preg), **T14** Reglamento de Bienes de las EELL (RD 1372/1986, hoy 7 preg), **T19** Informática básica + Explorador Windows 10 (0), **T20** Ofimática Word/Outlook/Excel Office 2021 (0).
- **Por qué urge:** **compromiso con fecha** — feedback `affe9ed8` (sandradrz / "Ale", premium activa, 12/07): le dijimos que **estarán disponibles esta semana** (~antes del 19/07/2026).
- **Cómo:** T5/T14 = editorial legal anclado al BOE de esos RD (nunca inventar). T19/T20 = familia Windows/Office (ver tareas de informática pendientes de otras oposiciones). Lifecycle `tech_approved` + doble auditoría ciega. Avisar a Ale (`sandradrz@gmail.com`, feedback `affe9ed8`) al terminar.
- **Estado:** prometido a 1 usuaria, sin empezar.

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
- **Cómo:** `docs/runbooks/deploy.md` (`scripts/deploy-frontend.sh`, gate CI verde). Va junto con lo que haya en main.
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
