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
