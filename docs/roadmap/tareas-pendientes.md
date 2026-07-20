# 📋 Tareas pendientes (backlog general, sin fecha)

> **Fuente única de las tareas que Manuel aparca para "luego".** Es el sitio canónico del backlog
> **sin fecha** (para tareas **con fecha** → memoria `agenda_tareas_programadas`).
>
> ## 🔒 ANTES de trabajar una tarea: CÓGELA
>
> Con varias sesiones a la vez **este fichero NO reparte**: el reparto lo lleva la tabla
> `backlog_tasks` (RDS), unida a estas fichas por el **id `T-xxx`** de cada cabecera. Un markdown
> no admite claim atómico — dos sesiones leen "libre", ambas escriben, gana la última.
>
> ```bash
> node scripts/backlog.cjs list           # qué hay y quién tiene qué
> node scripts/backlog.cjs next           # sugiere la siguiente por prioridad
> node scripts/backlog.cjs claim T-042    # CÓGELA antes de tocar nada
> node scripts/backlog.cjs done T-042 --outcome "…"   # + mueve la ficha a "## Hechas"

### [T-029] ✅ [HECHA — ya lo estaba, 12/07] Exponer en la UI el filtro "excluir preguntas recientes"
- **La ficha estaba obsoleta.** Se escribió el 10/07 diciendo que `config.excludeRecent` era `false` fijo
  y que no había control en el configurador. **El 12/07, el commit `fa5ecddf` la implementó** — *"feat(premium):
  cablea 'excluir preguntas recientes' como feature premium (👑 + modal + server gate)"* — y nadie cerró la tarea.
- **Lo que hay hoy** en `components/TestConfigurator.tsx:1788-1831`: checkbox "🔄 Excluir preguntas recientes"
  con corona 👑 para los free, `gate('exclude_recent', …)` (activar es **premium**, desactivar es libre: al free
  le abre el modal de upgrade SIN activarlo), selector de **30 / 15 / 7 días**, y cableado al config que se envía
  (líneas 1094-1095). El backend ya estaba (`lib/api/filtered-questions/queries.ts`).
- **Cero trabajo necesario.** Detectado al ir a implementarla: lo advirtió Manuel de memoria («creo que ya estaba
  y era botón premium»), y se confirmó leyendo el código y el `git log` antes de tocar nada.
- **Lección:** antes de coger una tarea de UI de la lista, comprobar en el código que sigue viva. Entre que se
  escribe una ficha y se ataca pueden pasar semanas y otra sesión puede haberla resuelto.

> ```
>
> **Runbook completo: `docs/runbooks/tareas-pendientes.md`** (lease/heartbeat, guardarraíles, y cómo
> pushear y desplegar al terminar → `docs/runbooks/pusheo-revision-despliegue.md`).
>
> **Dos comandos:**
> - *"añádelo a tareas pendientes"* → Claude **añade** aquí una entrada (título + por qué + link al detalle + estado) y corre `sync`.
> - *"¿qué tareas pendientes tenemos?"* → Claude **lee este fichero** y las lista (por prioridad).
>
> **Regla de oro (anti-saturación de memoria):** el **detalle/cómo** vive en el runbook/roadmap del repo;
> aquí solo va **título + por qué/prioridad + link + estado**. La memoria no duplica esto: solo apunta a este
> fichero (memoria `project_backlog_tareas_pendientes`).
>
> **Formato por tarea (OBLIGATORIO):** `### [T-042] 🟠 Título` + 1-3 líneas (por qué, link al cómo, estado).
> Sin el id `T-xxx` nadie puede coger la tarea y el guardarraíl de CI se pone rojo. Al cerrar una,
> muévela a "## Hechas" con la fecha, o bórrala si ya no aporta.

## 🔢 Orden de ataque (reordenado 20/07 — **penaliza el coste en tokens**)

> **Criterio (Manuel, 20/07):** lo que **quema muchos tokens va a prioridad baja**. Arriba, lo barato
> y con valor claro. Esto NO es orden de impacto: T-040 sigue siendo la de más impacto de todo el
> backlog (~21.000 preguntas), pero es también la más cara, así que baja.
>
> **La fuente de verdad del estado y la prioridad es la tabla `backlog_tasks` (RDS)**, no este índice.
> `node scripts/backlog.cjs next` ya aplica este orden.

**🟠 Alta — barato y con valor claro (empezar por aquí):**
1. **T-035** Capturar fecha de examen de las 2 oposiciones de la Univ. de León — 2 consultas a fuente oficial
2. **T-009** Disposiciones anuladas (STC) — el detector v1+v2 YA está hecho; quedan ~5 candidatos + cron
5. **T-039** Botón premium temario completo + **PDF server-side** — código acotado; cubre perk premium Y el fix in-app (absorbe el paso 2 de T-001)

**🟡 Media — coste moderado:**
6. **T-002** Render multi-convocatoria (landing con las 2 convocatorias separadas)
7. **T-008** Aux. Admin. C. de Madrid: landing multi-convocatoria (va detrás de T-002)
8. **T-034** Migrar `/leyes/[law]` a on-demand (flakiness del build)
9. **T-011** Email RGPD de borrado *exactly-once*
10. **T-031** Provisionar RDS read replica (barato en tokens, decisión de coste €)
11. **T-036** Cubos sellados en verde — quedan 3 cabos acotados
12. **T-012** Poblar `law_sections` en todas las leyes (scriptable, pero muchas leyes)
13. **T-004** Osakidetza bilingüe — barato pero bajo valor (0 preguntas cuelgan)
14. **T-028** Valorar oposiciones pedidas por usuarios
15. **T-014** 16 preguntas de imagen esperando su oposición (aparcada)
16. **T-007** Verificación scope↔epígrafe — *(en curso por otra sesión, no se toca)*

**🟢 Baja — caras en tokens (dejar para cuando haya presupuesto):**
17. **T-015** Editorial TCAE "Unidad del paciente"
18. **T-030** Bloque II de Agrupación Profesional Servicios Públicos CARM
19. **T-018** Verificar + completar Aux. Admin. Ayto. de Madrid
20. **T-023** Huecos de contenido Aux. Admin. Aragón
21. **T-024** Huecos de contenido Aux. Admin. Extremadura
22. **T-020** Supuestos prácticos Administrativo C. de Madrid
23. **T-026** Completitud de leyes — sistema hecho; es **mantenimiento**, drena poco a poco
24. **T-003** Títulos huérfanos — **DRENADO 20/07** (42 clusters adjudicados, 16 huecos reales arreglados); queda solo como mantenimiento de lo que aparezca nuevo
25. **T-038** Relink masivo de `needs_human` + explicaciones flojas
26. **T-044** Construir Aux. Admin. Univ. de **Almería** (21 plz, inscripción viva) — la más barata de construir: reusa Cádiz/Huelva/Granada
27. **T-045** Construir Agentes de Tributos **Agencia Tributaria Canaria** — ⚠️ degradada: son **8 plz libres** (no 20) y temario tributario específico
28. **T-016** Construir TSID · 29. **T-021** Construir Ujieres Cortes · 30. **T-022** Construir Gestión A2 Andalucía

**⬜ Sin prioridad — fuera del orden de ataque:**
- **T-040** Artículos-cajón (~21.000 preguntas, 110 mega-chunks) — **aparcada por tamaño (Manuel, 20/07)**. No se prioriza ni se coge de paso; si se abre, con plan propio y aprobación. Su ausencia de la lista de arriba es deliberada.

> **Nota de calibración:** el drenaje CE-mislink del 19-20/07 costó ~2M tokens para 840 preguntas.
> Sirve de vara de medir: T-040 y T-038 son de ese orden o mayores; construir una oposición, también.

## Abiertas").
> Snapshot manual: al cerrar/abrir tareas puede quedar desfasado — la fuente de verdad de estado es cada `### [PRIORIDAD]`.

**Calidad / correctness (primero):**

> ⚠️ Índice desfasado respecto a `backlog_tasks` (fuente de verdad). Cerradas el 20/07: **T-001** (paso 1 desplegado; paso 2 → T-039) y **T-006**. Varias "abiertas" son colas cortas de tareas casi hechas: T-036 (3 cabos), T-009 (detector hecho, ~5 candidatos), T-026 (sistema vivo = mantenimiento), T-004 (solo Osakidetza bilingüe).

1. 🟠 Cubos sellados en verde — **3 cubos CERRADOS**; quedan 3 cabos: 52 needs_human (= import de contenido, NO relink), §8.1-ter al manual (bloqueado), 4 huérfanas de scope
2. ✅ [HECHA 20/07] Importar normas que faltan + reactivar las 22 ocultadas del cubo 3 — 10 ya approved, 5 recuperadas (CyL), 1 retirada (ley derogada), 6 en needs_human por decisión
3. 🟠 Relink `needs_human` + reescritura de explicaciones flojas (19/07)
4. ✅ [HECHA 20/07] Framework profesional de canaries — P1-P3 núcleo DESPLEGADO (contrato, is_synthetic, registro, guardarraíles cota/completitud/boot, runner, 3 canaries migrados, 5 reglas alerta, runbook). Queda OPCIONAL migrar 13 canaries que divergen

**Contenido / scope↔epígrafe:**
5. 🟡 Drenar backlog de títulos huérfanos del temario (465 en 96 oposiciones)
6. 🟡 Verificación scope↔epígrafe — backlog de plataforma
7. 🟡 Huecos de contenido Aux. Admin. Aragón (epígrafes 13/07)
8. 🟡 Huecos de contenido Aux. Admin. Extremadura (verify:scope 14/07)
9. 🟡 Verificar + completar Aux. Admin. Ayto. de Madrid
10. 🟢 Bloque II (parte específica) Agrupación Profesional Servicios Públicos CARM vacía
11. 🟢 Editorial TCAE "Unidad del paciente"

**Ingresos / vendibles:**
12. 🟠 Construir Ujieres de las Cortes Generales
13. 🟠 Construir Gestión Administrativa A2 (Junta de Andalucía)
14. 🟠 Construir TSID (Imagen para Diagnóstico y Medicina Nuclear)
15. 🟠 Botón premium "imprimir/descargar temario completo"
16. 🟡 Supuestos prácticos para Administrativo Comunidad de Madrid (demanda usuaria)

**Landings / app:**
17. 🟡 Render multi-convocatoria: landing pinta las 2 convocatorias vivas separadas
18. 🟡 Aux. Admin. Comunidad de Madrid — landing multi-convocatoria (vía-a)
20. 🟡 Migrar `/leyes/[law]` a on-demand (flakiness del build)

**Infra / decisión de coste:**
21. 🟡 Provisionar RDS read replica (admin/analytics)
22. 🟢 Email RGPD de borrado *exactly-once*
23. 🟢 Poblar `law_sections` (títulos/capítulos) en todas las leyes + teoría

**Cabos / pilotos:** *(los 2 que había aquí se cerraron el 20/07 — ver por qué en sus fichas)*
24. ✅ [ABSORBIDO 20/07] Leyes non-BOE con gaceta propia → eran 23 actionable, subconjunto de las 64 de "Completitud de leyes" (nº 4 bis); se sigue allí
25. ✅ [CERRADA 20/07] Triaje con OpenRouter + ensemble → investigación con veredicto ("no industrializar"), cero infraestructura viva; residuo: ~$9 de crédito sin gastar

**Baja / seguimiento / demanda:**
26. 🟢 Capturar fecha de examen de las 2 oposiciones de la Univ. de León
27. 🟢 16 preguntas de diagnóstico por imagen esperando su oposición (aparcada)
29. 🟢 Oposiciones pedidas por usuarios — valorar (no comprometido)

## Abiertas

### [T-001] ✅ [CERRADA 20/07 — paso 1 desplegado y verificado; paso 2 fusionado en T-039] "Imprimir PDF" del temario falla en silencio en navegadores in-app (Google App/redes)
> **Cierre 20/07:** re-verificado con el método de la propia ficha — `fbb280e8` **es ancestro del deploy vivo `10922182`** → el aviso in-app está en producción. El **paso 2** (generar el PDF server-side) NO se pierde: era la misma cosa que **T-039**, así que se fusiona allí en vez de quedar duplicado en dos tareas.
> ⚠️ **Corregido 20/07:** esta ficha decía "SIN DEPLOY" y **era stale**. Verificado contra el deploy vivo: el commit de `lib/browser/inAppBrowser.ts` **es ancestro del frontend en producción** → el aviso in-app YA le llega al usuario. Lo que sigue pendiente es el **paso 2** (generar el PDF de verdad server-side), no un despliegue. Método para no repetir el error: `curl -s https://www.vence.es/api/health | grep deploy` + `git merge-base --is-ancestor <commit> <deploy_vivo>` (runbook `pusheo-revision-despliegue.md` §"verificar si un fix está desplegado").
- **Qué:** el botón "Imprimir PDF" (`TopicContentView.tsx`, `handlePrint` → `window.print()`) **no hacía nada** dentro de los navegadores in-app de iOS (app de Google/GSA, Instagram, Facebook…), que bloquean `window.print()`. Fallaba en silencio, sin aviso. Por ahí entra mucho tráfico de Google/redes. Caso María (fb feb79fc5, `piyou22@gmail.com`): 100% de sus sesiones GSA in-app en iPhone.
- **✅ PASO 1 construido (20/07, aviso in-app + centralización):**
  - **Detector** `lib/browser/inAppBrowser.ts` — puro/SSR-safe: allowlist de apps (GSA, Instagram, FBAN, TikTok, LINE, X, Snapchat, LinkedIn, WhatsApp, Pinterest) **+ heurística iOS-webview** (iOS que no es Safari/CriOS/FxiOS/EdgiOS real → WKWebView) para no tener falsos negativos con apps desconocidas.
  - **Componente compartido** `components/TopicPrintButton.tsx` — botón + los 2 modales (registro + aviso in-app con "copiar enlace") en un solo sitio. **Elimina la duplicación** que había en los ~117 `TopicContentView.tsx` (2 variantes, una con typos sin tildes → arreglados de paso). Rollout por codemod anclado + auto-verificado.
  - **Observabilidad** — evento `temario_print_action` (`lib/observability/client.ts` union + SAMPLE_RATES + manual `observability.md`), `action ∈ {print, inapp_blocked, copy_link, register_prompt}` + `{slug, topic}`. Antes el botón era CIEGO. Con `inapp_blocked` mediremos el tamaño real del muro.
  - **Capas de test (verde):** unitario detector + corpus de simulación de UAs, integración de componente RTL/jsdom conduciendo el componente real con las 6 ramas incl. fallo/ausencia de portapapeles, guardarraíl estructural anti-regresión (`__tests__/guardrails/topicPrintButton.guardrail.test.ts`). Typecheck limpio. Seguridad: el temario no expone `correct_option`, detector puro, componente sin datos sensibles.
  - **PENDIENTE:** deploy (`scripts/deploy-frontend.sh`). Al desplegar, avisar a Victoria/María y valorar reward.
- **Paso 2 — fix de verdad (pendiente decisión):** que el botón **genere el PDF nosotros** (ruta server que renderice el tema) en vez de `window.print()`, para que la descarga funcione desde cualquier navegador (in-app incluido) Y sirva de perk premium (PDF del temario completo/por bloque).

### [T-002] 🟡 [ABIERTO 19/07] Render multi-convocatoria: landing pinta las 2 convocatorias vivas como bloques separados
- **Qué:** cuando una oposición tiene 2 convocatorias vivas a la vez (caso Aux. Admin. Comunidad de Madrid: Orden 264/2026 de 645 plz **en tramitación** —lista de admitidos, examen pendiente— + Orden 1628/2026 de 673 plz con **inscripción abierta** hasta 10/08/2026), la landing lee de `oposiciones_ssot` (solo la `is_current`) para hero/tarjetas, y el **timeline mezcla los hitos de AMBAS convocatorias** (dos "Convocatoria publicada en BOCM", dos plazos de inscripción) → puede confundir a un usuario despistado.
- **Origen:** feedback de Esther Pimentel (`9d7cabdd`, resuelto): buscaba dónde inscribirse en Aux. Admin. de Madrid; el timeline mezclado y la confusión Ayuntamiento/Comunidad la despistaron. El hero SÍ muestra bien la abierta (673 plz, 10/08); el dato es correcto, es solo UX.
- **Por qué pendiente:** el schema ya soporta N convocatorias (migración `20260718_convocatorias_multi_por_año.sql`); falta la **vía (a) de render** (OEP manual §4e-ter): que la landing liste las convocatorias no `archived_at` de la oposición como **bloques separados** (cada una con sus plazas/fechas/hitos propios), en vez de mezclarlas. Hoy va la vía interina (`is_current` + hitos de ambas).
- **Cómo:** cambio de código en la landing (pintar todas las convocatorias no archivadas, agrupando hitos por convocatoria). No urgente. Detalle: memoria `project-convocatorias-multi-por-año-schema`, `docs/roadmap/consolidacion-convocatorias-radar-ssot.md`.

### [T-003] 🟡 [ABIERTO 19/07] Drenar backlog de títulos huérfanos del temario (465 en 96 oposiciones)
- **Qué:** el nuevo detector `scope_titulo_huerfano` (barrido nocturno, LIVE) marca **465 títulos** de una ley que la oposición usa, con preguntas activas y flanqueados a ambos lados por artículos escopados, pero con **0 artículos suyos en el `topic_scope`** (hueco INTERNO). Es un *upper bound* con falsos positivos legítimos (títulos que el programa no incluye).
- **Por qué:** son preguntas ya en BD que el usuario no puede practicar (caso raíz: CE Título V en Diputación Córdoba, 186 preg — ya arreglado). Varios apuntan a huecos reales (ej. Andalucía no escopa CE Título III, 66-96, 699 preg).
- **Cómo:** frase-gatillo **"revisa los huecos del temario"** → adjudicar por oposición con `verify:scope` (epígrafe↔scope), priorizando por nº de preguntas huérfanas. Si el epígrafe pide el título → añadir su rango al scope; si no → dejarlo. Detalle: memoria `project_scope_titulo_huerfano_deteccion` + `docs/runbooks/verificar-epigrafes-scope.md` §"Huecos del temario".
- **✅ ANÁLISIS A FONDO HECHO (20/07)** — el backlog está **caracterizado y priorizado**, listo para drenar (el drenaje en sí sigue sin empezar). Herramientas nuevas: `scripts/scope/analiza-titulos-huerfanos.cjs` + `refina-titulos-huerfanos.cjs`. Hallazgos (medidos, no estimados; hoy **471 títulos / 98 oposiciones**):
  - **Drenar por CLUSTER, no por fila:** las 471 filas son solo **42 criterios únicos `(ley,título)`** → **11,2x de apalancamiento**. Una decisión ("¿el programa incluye el Tít.IV de la Ley 7/1985?") cierra decenas de filas.
  - **Es un upper bound MUY ruidoso: precisión cruda ~25 %** (validada a mano, 1 de 4). No drenar a ciegas. 3 fuentes de ruido medidas y con antídoto (todo en el runbook): **cola suelta** (18 %: un solo artículo lejano —CE art.116 en Madrid— fabrica 3 títulos huérfanos falsos), **word-matching contra el epígrafe equivocado** (atar tema↔ley: 120→49 candidatos), y **el nombre de la propia ley** casando con su título.
  - **⚠️ `verified_correct` es bandera, NUNCA filtro.** 169 de las 471 caen en temas ya verificados: filtrarlas esconde justo lo que el detector existe para cazar (es el punto ciego de `verify:scope`).
  - **🔴 Hueco REAL confirmado contra BD, listo para arreglar:** `administrativo_seguridad_social` · **CE Título V (108-116)** · **227 preguntas** · 156 usuarios. Escopa 153 artículos de la CE y **ninguno** del 108-116, pese a que el epígrafe de su T7 dice **literalmente** "Relaciones entre el Gobierno y las Cortes Generales" — y sus temas de CE están `verified_correct`. Mismo patrón que el caso raíz de Córdoba.
- **✅ PRIMER DRENAJE HECHO (20/07) — 3 clusters adjudicados, 62 filas cerradas:** confirma en la práctica que el prefiltro es ruido en su mayoría y que la adjudicación por epígrafe es rápida (`scripts/scope/huecos-ce-titulo-v-apply.cjs`).
  - **CE Título V (108-116)** — huérfano en **36 oposiciones**; adjudicado uno a uno: **solo 3 lo piden** (8% de precisión). ARREGLADOS reusando las 227 preguntas ya en BD: `administrativo_seguridad_social` T7, `administrativo_canarias` T4, `administrativo_cantabria` T3 (su epígrafe llega a enumerar *"De las relaciones entre el Gobierno y las Cortes Generales (Título V)"* y el scope se paraba en el 107). Las otras 33 son exclusiones legítimas (sus programas cubren la CE parcialmente) → NO tocar.
  - **Ley 7/1985 Tít.IV "Otras entidades locales" (42-45)** — 19 oposiciones: **0 reales**. Ningún programa menciona comarcas, mancomunidades ni áreas metropolitanas (verificado sobre TODOS sus temas, no solo los que escopan esa ley). El match era la frase genérica "entidades locales".
  - **Ley 7/1985 Tít.V (46-77)** — 7 oposiciones: **0 reales**. El único candidato (`diputacion_ourense` T11) pedía órganos colegiados de la **Ley 40/2015**, no del régimen local.
- **✅ LOTE 2 (20/07) — 5 clusters más adjudicados, 9 temas ampliados** (`scripts/scope/huecos-clusters-lote2-apply.cjs`; adjudicador reutilizable `adjudica-cluster-huerfano.cjs`):
  - **EBEP (RDL 5/2015) Tít.IV "Adquisición y pérdida de la relación de servicio"** — 23 oposiciones, **6 reales**. Discriminador limpio: el tema debe **escopar ya RDL 5/2015**; los que cuelgan de su ley autonómica (Andalucía 5/2023, Extremadura 13/2015, Murcia 1/2001, Estatuto Marco 55/2003) cubren la materia con su propia norma → no tocar. Arreglados: `auxiliar_administrativo_extremadura` T3 (**294 usuarios**), `ayuntamiento_madrid` T15, `ayuntamiento_granada` T15, `ayuntamiento_alcala_henares` T17, `universidad_huelva` T6, `agrupacion_profesional_servicios_publicos_carm` T3.
  - **CE Tít.III Cortes** (29 opos → 1 real: `diputacion_huesca` T1), **Tít.II Corona** (37 → 1: `ayuntamiento_alcala_henares` T1), **Tít.VI Poder Judicial + Tít.IX TC** (38 → 1: `junta_general_asturias` T2, cuyo epígrafe enumera los cinco títulos y solo tenía tres).
  - **Cero reales:** Ley 40/2015 Tít.I (AGE, 19 opos — los candidatos piden "órganos administrativos/colegiados", arts 5-22, o administración autonómica) y CE Tít.IV (21 opos — el único casaba el Reglamento del Gobierno del **Ayuntamiento** de Madrid).
  - **Falsos positivos que solo caza la revisión humana:** un tema de **cardiología** casó "corona" (síndrome **corona**rio); "El Poder Judicial **en Andalucía**" es el Estatuto andaluz, no el Título VI. Los patrones de materia ayudan pero **no sustituyen** leer el epígrafe.
- **✅ LOTE 3 (20/07) — BACKLOG DRENADO: los 42 clusters están adjudicados.** 4 arreglos más (`huecos-clusters-lote3-apply.cjs`): `ayuntamiento_granada` T3 (INSERT CE Tít.VIII — solo escopaba el Estatuto andaluz pese a pedir "Las Comunidades Autónomas: constitución y competencias"), `administrativo_la_rioja` T8 (+Ley 7/1985 Tít.III La provincia; tenía solo arts 1-13), y `diputacion_segovia` T18/T19, repartiendo el EBEP Tít.V entre ambos según lo que pide cada epígrafe (72-77 plantillas/RPT vs 69-71 oferta y planes de empleo) en vez de volcar 69-84 en los dos.
  - **Cero reales** en: CE Tít.VII (62 opos), Tít.I, Tít.IX; EBEP Tít.III y Tít.VI; Ley 39/2015 Tít.I, III y IV; Ley 40/2015 Tít.II; LO 3/2007 Tít.II y III; LO 3/2018 Tít.IV y VII.
  - **El nombre de la norma es la trampa recurrente** (3 clusters distintos): `tcae_aragon` T8 casó "Procedimiento Administrativo Común" porque es el **título de la ley** —su scope (1-14, 29-33, 106-126) casa con precisión su epígrafe—; la Ley 5/2018 cántabra lleva "Sector Público Institucional" en su propio nombre. Y el patrón "Tribunal de Cuentas" pescó 5 temas del Tribunal de Cuentas **Europeo**.
- **📊 BALANCE FINAL del drenaje (3 lotes):** de **471 títulos huérfanos en 98 oposiciones**, solo **16 eran huecos reales** (~3,4%) — todos arreglados reusando banco ya en BD, sin crear ni borrar una sola pregunta, y **registrados** en `topic_scope_verification` con su nota. El resto queda documentado como falso positivo **con su razón**, para que el barrido nocturno no lo re-abra como trabajo. **Lo que queda es mantenimiento:** re-adjudicar lo que aparezca nuevo, con el método y las herramientas ya montadas (`analiza-`, `refina-`, `adjudica-cluster-huerfano.cjs` + runbook §"Huecos del temario").

### [T-004] 🟢 [ABIERTO 19/07] Artículos truncados/basura de import — barrido fresco: clusters grandes HECHOS
- **Qué (HECHO 19/07, verificado vs fuente oficial + en vivo en RDS):** Aragón VIII Convenio (8 arts, nº de maquetación BOA pegado al texto), UMU Matrícula 2026/2027 (~27 arts: marca de agua PDF incrustada + apartados descolocados 18/19/29/30 recompuestos contra fuente), Cantabria Decreto 152/2005 art.7, Instituciones Internacionales GC (5 títulos mal atribuidos), Osakidetza Decreto 255/1997 (5 arts euskera→castellano). Detalle: `docs/roadmap/campana-citas-ajenas-2026-07.md` §"Barrido fresco".
- **PEND (bajo ROI, teoría-only):** Osakidetza Decreto 255/1997 arts **5, 8, 13, 14, 15, 17, 20** aún bilingües (0 preguntas cuelgan) → re-import castellano del BOPV.
- **Nota:** el detector "arranca en apartado >1" tiene ALTA tasa de falsos positivos (numeración "artículo.apartado", p.ej. art.21→"21.1" es correcto) — filtrar a mano.

### [T-005] ✅ [HECHO 19/07] PROYECTO — split físico de "Instituciones Internacionales GC" (917 preguntas)
- **Qué:** el contenedor virtual mezclaba ~12 organizaciones, escopado como "toda la ley" en guardia_civil T6 y policia_nacional T4 (mis-scoping: cada opositor recibía lo de la otra materia). **Split completo en 3 fases** (vivo en RDS, cero regresión de contenido).
- **Resultado:** 13 leyes creadas — 6 de tratado (Carta ONU, Estatuto Consejo de Europa, Estatuto INTERPOL, Regl. UE CEPOL/Europol/Frontex) + 7 editoriales (UE, OTAN, EUROJUST, FAO, FMI, OMS, Tribunales europeos TEDH/TJUE). Los 39 arts numerados (Fase 1) + las 815 del art.0 clasificadas por 12 agentes Sonnet con integridad verificada 815/815 (Fase 2). Contenedor repurposado (no borrado) a bucket "teoría general" (17 preg, solo GC T6).
- **Scoping corregido:** GC T6 → 13 orgs + teoría general (917); PN T4 → UE + coop. policial (INTERPOL/Europol/Eurojust/Frontex/CEPOL) + tribunales (434, antes 917).
- **Detalle:** `docs/roadmap/split-instituciones-internacionales-gc.md`.

### [T-006] ✅ [CERRADA 20/07] Importar normas para desbloquear needs_human — cluster Biblioteca cerrado
> **Cierre 20/07:** la ficha decía "HECHO" pero seguía `open` en `backlog_tasks` (única discrepancia markdown↔tabla del backlog). Resuelto: el **bloque importable está hecho** (12 preguntas recuperadas). Lo que quedaba **no era importable**: 43 defectos reales de clave/opción → pertenecen a **T-038**; y ~7 de contenido no normativo, que forzar a "artículo" sería inventar estructura.
- **Contexto:** los cubos 1/3 dejaron 71 needs_human con motivo de esta sesión (`ai_provider IN claude_code_cubo1_reverify / mislink_v1 / vg_relink`). Al inspeccionarlos, el "importar normas para desbloquear todo de golpe" resultó **optimista**: desglose real →
  - **43** (`cubo1_reverify`, todos *sin sugerencia*) = **defectos reales de clave/opción**, no los arregla ningún import → decisión humana.
  - **~7** (`vg_relink`) = **contenido NO normativo** (Punto Violeta, "Círculo de Fortaleza" del Plan VioGén, Resolución ONU 54/134, fundación SAM/GRUME 1986, Pacto de Estado) → forzarlo a un "artículo" sería inventar estructura. Se quedan parkeados (o retiro), **no** se importan.
  - **~19** (`mislink_v1`) = mal-vinculadas a norma real → **este es el bloque importable.**
- **✅ Cluster Biblioteca (oposición `auxiliar-biblioteca-estado` ACTIVA, 48 temas / ~4.977 activas) — HECHO:** 7 preguntas recuperadas verificando cada clave contra el BOE consolidado (nunca fiando la explicación almacenada):
  - **RD 582/1989** (Reglamento Bibliotecas Públicas del Estado, BOE-A-1989-12304, 27 arts) importado + scope T11 → 4 preg (arts 2/7/16/22).
  - **RD 635/2015** (depósito legal en línea, BOE-A-2015-8338, 11 arts) importado + scope T213 → 2 preg (arts 3/6).
  - **Ley 16/1985** (ya en BD) + **Disposición derogatoria** añadida como art `DD` + scope T10 → 1 preg (c2f8bed4).
  - **c9eb6c4e RETIRADA-en-sitio** (needs_human, nota escrita): RD 509/2020 sigue vigente pero **RD 124/2022 suprimió la DG de Bellas Artes** y RD 313/2023 la reestructuró → el enunciado tiene premisa caducada. NO se importó RD 509/2020 (norma volátil, bajo valor). Reescribir contra estructura vigente o retirar.
- **✅ Grupo A CyL HECHO (20/07):** **5 preguntas recuperadas** (approved + is_active) importando verbatim de fuente oficial los artículos que faltaban, verificando cada clave literal contra ellos, relinkando y ampliando scope. Sus 2 leyes YA estaban en BD y escopadas — el defecto era import incompleto, no ley ausente:
  - **Ley 13/1990 CES CyL** (BOE-A-1991-2826): **art.1 nuevo** (`6947bfae`, sede Valladolid = A) + **art.10 completado** con su apartado 1 (`2d4df8f3`, Pleno ≥1/trimestre = C). Scope T7 (arts=null=ley entera) → sin cambio.
  - **Decreto 12/2024 CyL** (BOCyL eli/2024/06/27/12): **arts 4, 10, 11 nuevos** (`a1d1b0b8` consejería competente=D, `490e1ed6` info orientativa=B, `d4c0185c` info inmediata=D). Scope ampliado en `administrativo_castilla_leon` T503 + `auxiliar_administrativo_cyl` T22 (2,3,5,7,8,9,14 → +4,10,11).
  - Script durable: `scripts/impugnaciones/cubo3-grupoA-cyl-apply.cjs`. Trazado `ai_provider='claude_code_cubo3_relink'`.
  - **✅ Completitud del articulado CERRADA (20/07):** importados verbatim los artículos que faltaban del articulado operativo — **Ley 13/1990** art.15 (Los Vicepresidentes) + art.1 (art.2 estaba completo, no truncado) → arts 1-18 + 4bis + 15bis; **Decreto 12/2024** arts 1/6/12/13 → arts 1-14, con el `topic_scope` completado a la ley entera (1-14) y `boe_url` BOCyL registrado. Las disposiciones transitorias de 1990 (agotadas) no se importan como artículos. Script `scripts/impugnaciones/cubo3-grupoA-completitud.cjs`. Los artículos nuevos quedan `embedding_stale=true` (los recoge el regen). **✅ EL REGEN YA EXISTE (20/07): `scripts/regenerate-stale-embeddings.cjs`** (`--law <uuid>` | `--all`) — 1er consumidor real de `embedding_stale` (nadie lo consumía; ~40k stale/null). Regenera el vector del texto ACTUAL (pgvector `::vector` + OpenAI). Ya corrido para las re-importadas de hoy. Nota: `verification_status` de ambas sigue `pendiente` porque la auditoría palabra-por-palabra de los artículos **preexistentes** pertenece al sweep de completitud (tarea aparte) — aquí solo se garantizó que el articulado está **completo** y que los artículos tocados coinciden literal con la fuente oficial.
- **🔴 CLUSTER BOJA parafraseado + falso-verde de abril (hallazgo 20/07, detalle en memoria `project-completitud-leyes-vs-fuente`):** 56 leyes/749 preg estaban "verificadas" con evidencia HUECA (la Capa 3 solo mira números; el "manual" de abril no comparó nada). Triadas con `scripts/verify-law-literal.cjs` (cruft-aware): ~30 GENUINAMENTE ROTAS = teoría PARAFRASEADA (no verbatim), casi todas Junta de Andalucía. **Re-importadas verbatim ya: Decreto 13/2021 CyL (97p), 7/2013 CyL (54p), 204/1995 JA (37p), Orden 19/02/2015 JA (30p).** 226/2020 JA = desajuste de versión, needs-humano. ~7 sin URL (Decreto 622/2019 JA 81p) = research. Plantilla + guardarraíles en memoria.
- **🔵 Grupo B (20/07) — 1 retirada, 4 parkeadas en needs_human, 1 ya resuelta:**
  - **`860b3fbb` RETIRADA** (`retired_irreparable`, reason `admin_law_derogated`): LO 15/1999 derogada por LO 3/2018; la clave A ("Director… 4 años, de entre el Consejo Consultivo") ya no es cierta (ahora Presidencia AEPD, 5 años, otro procedimiento) + explicación cruzada. Irrecuperable como está; rehacer = pregunta nueva de LO 3/2018.
  - **`07f68313` — verificado que NO relinka limpio:** el art.109 de Ley 2/2006 CyL regula la vinculación **general** (concepto/subconcepto), pero la pregunta es sobre **créditos declarados AMPLIABLES** (categoría de la ley anual Ley 5/2024), que el art.109 no sostiene → relinkarlo sería re-crear un mislink. Se queda en needs_human.
  - **Parkeadas en needs_human (decisión Manuel, reversible):** `26eb24b0` (Presupuestos CyL anual, sin hueco permanente). `a1e0046e` (RD 2099/1983 precedencias), `b628ff43` (Decreto 248/2023 Madrid estructura), `b647ee0d` (Decreto 200/1993 Galicia) = leyes nuevas de 1 pregunta c/u, varias de estructura orgánica (caducan rápido) → no importar por ~1 pregunta cada una.
  - `c9eb6c4e` (RD 509/2020) ya resuelta el 19/07.

### [T-007] 🟡 [ABIERTO 19/07] Verificación scope↔epígrafe — backlog de plataforma
- **Qué:** de **149 temas** en `verified_issues`/`needs_human` (`verify:scope audit`), la sesión 19/07 resolvió las **3 oposiciones de mayor demanda con issues**: `auxiliar_administrativo_estado` (T107 falso positivo), `administrativo_estado` (T603/T7/T307 + **re-partición del bloque EBEP T403/T406/T407**), `tramitacion_procesal` (**37/37 correct**: T1 Habeas Corpus fuera, T10 protección de datos acotada, T23 LGSS fuera — todo verificado contra BOE-A-2025-27053).
- **✅ `auxiliar_administrativo_madrid` verificada (20/07, 21/21 temas):** era la mayor bolsa demanda↔sin-verificar (1.292 usuarios, **42 premium = la nº1 en premium de la plataforma**), estaba **21/21 `never_verified`**. Pipeline 2 agentes → consenso: **16 correct, 5 needs_human**. **4 fixes aplicados por reuso/recorte** (`scripts/scope/madrid-aux-admin-scope-fix.cjs`, verificados vs estructura de ley): **T4** quitada Ley 40/2015 (126 preg off-«fuentes»: sancionador/competencia/fundaciones, sin tema propio en Madrid) 1042→899; **T9** +arts 131-187 Ley 9/2017 (procedimientos de adjudicación que el epígrafe pide) 137→209; **T10** +Ley 53/1984 incompatibilidades (49 preg reusadas) 1282→1331; **T14** quitado RD 829/2023 art.15 «Ministerio de Cultura» (stray, 0 preg). **needs_human (5):** T2 (ILP ¿potestad legislativa?), T8 (participación dentro de la ley CM de transparencia), **T17/T18 (§5-bis variante Office Word/Excel escritorio-vs-web, BLOQUEADAS)**, **T19 = COBERTURA: falta banco de Power BI (generar), no error de scope**.
- **Queda (por tipo):** **~14 variante Office** (Word/Excel escritorio vs web) = **BLOQUEADAS** esperando nota informativa oficial del tribunal (§5-bis; no accionables por nosotros); **~29 comodín/estatuto entero sin particionar**; **~22 imports** de leyes que no están en BD (mayoría `administrativo_navarra`, baja demanda); **faltan-bloques** de oposiciones de menor demanda; y **~100 `never_verified`** sin auditar (deuda de cobertura, no error).
- **Follow-ups menores de la sesión:** barrer el **comodín CE art.149** a otras oposiciones (solo hecho en `administrativo_estado` T7/T307); residuales EBEP borderline (`administrativo_estado` T406 arts 29/30 retrib, T403 arts 27/75) — tolerados, no urgen.
- **Cómo:** runbook `verificar-epigrafes-scope.md` (pipeline 2 agentes). Priorizar por demanda: siguiente foco = **faltan-bloques de alta demanda** reusando banco. Los `needs_human` NO son "leyes rotas": muchos son falsos positivos de word-matching (Explorador Windows: T107/T603/T34 mismo caso) o criterios a arbitrar.

### [T-008] 🟡 [ABIERTO 19/07] Aux. Admin. Comunidad de Madrid — landing multi-convocatoria (vía-a) + etiqueta cruzada
- **Qué:** Madrid tiene **dos convocatorias 2026 vivas** (Orden 264/2026 en `lista_admitidos` examen 15/10 + Orden 1628/2026 673 plazas inscripción abierta hasta 10/08). El schema ya soporta ambas como filas propias (migración `20260718_convocatorias_multi_por_año.sql`) y la vigente (673, abierta) se ve; pero **la landing solo pinta la `is_current`** — falta la **vía-(a)**: que liste simultáneamente las convocatorias no archivadas (§4e-ter del manual OEPs).
- **Dato menor a limpiar:** la fila del ciclo en curso (Orden 264/2026) tiene `convocatoria_numero=NULL` y la archivada tiene ese número mal atribuido (cruce de etiquetas preexistente); rellenar con cuidado por el índice `convocatorias_ref_oficial_unica`.
- **Cómo:** `docs/maintenance/oeps-convocatorias-seguimiento.md` §4e-ter; memoria `project-convocatorias-multi-por-año-schema`.

### [T-009] 🟡 [BARRIDO COMPLETO 20/07 — 0 bugs activos; solo queda cablear a cron] Disposiciones ANULADAS (STC) / incisos derogados en ley vigente
> **Barrido COMPLETO (20/07):** 357 leyes = el universo entero de las que se sirven en temarios vivos
> (el auditor filtra `is_active + boe_url BOE-A- + presente en topic_scope de tema activo`; con `--limit 800` salen las mismas
> que con 400 → no queda nada por escanear). 40 con anulación TC, 8 sin análisis BOE, **21 hallazgos**.
> Triaje completo: 11 sin preguntas (riesgo imposible) + 10 con preguntas verificadas → **0 bugs activos**.
> Caso grande: **LO 4/2000 art. 58** (28 preguntas visibles) — servimos el inciso anulado por la **STC 17/2013**
> (*"toda devolución acordada en aplicación del párrafo b) … tres años"*) sin nota de vigencia, pero **ninguna clave
> lo da por válido** (1 aparición, como distractor). El detector se auto-validó cazando la Ley 1/2004 CAA art. 4 (STC 40/2025).
> **ÚNICO pendiente: cablearlo a cron.** OJO al alcance real: `scripts/health-sweep.cjs` ya NO es la fuente de la lógica —
> el servicio NestJS `content-health-sweep` es el "PORT IN-PROCESS … FUENTE ÚNICA de la lógica de detección" y corre
> `@Cron('0 3 * * *')`. Así que esto es **cambio de backend + deploy**, no un añadido al script. Además el auditor es
> pesado en red (357 leyes × llamadas al BOE), así que habría que acotarlo (rotación por noche o frecuencia semanal).
