## 🔢 Por dónde empezar

> **Criterio de orden (Manuel, 20/07): lo que quema muchos tokens va a prioridad baja.** Arriba, lo
> barato y con valor claro. **NO es orden de impacto** — T-040 sigue siendo la de más impacto de todo
> el backlog (~21.000 preguntas) y precisamente por cara está aparcada.
>
> **El orden por tarea NO se mantiene a mano aquí.** La fuente de verdad del estado y la prioridad es
> la tabla `backlog_tasks` (RDS) y se consulta con **`node scripts/backlog.cjs next`**, que ya aplica
> el criterio. Esta sección solo guarda el criterio y las decisiones que no caben en una columna.

#### ⏱️ MAÑANA (28/07), en este orden

1. **T-166 — PRIMERO, y es lo único con fecha.** Un comando de dos minutos:
   `node scripts/oep/pilot-hash-gate.cjs --n 120 --comparar scratchpad/oep-hashes-27jul.json`
   **Por qué mañana y no cuando se pueda:** la línea base se tomó el 27/07 ~15:20 UTC, así que el 28
   mide el delta limpio de **24 h**, que es justo el ruido diario que falta. Cada día que pase mide
   48 h, 72 h… y deja de ser comparable. **Contexto:** `detect-oep-llm` está PAUSADO desde el 27/07
   por coste (~8 USD/día laborable) → **el sensor semántico del radar no corre**. Ese número decide
   si el embudo se implementa y se reactiva, o si hay que replantear. Banda: 5-12% implementar,
   >25% replantear (sería repetir T-047). Copia de la línea base también en
   `/home/manuel/Documentos/github/vence/scratchpad/` por si se borra el worktree.
2. **T-175 (cabo) — mirar el log de las 09:30 UTC.** El 27/07 se desenvolvió la causa real de los
   errores de `detect-notas`; **la ejecución de mañana es la primera que la imprime**. Dos documentos
   se descargaban bien y fallaban al INSERTAR, y hasta ahora era indiagnosticable. Es leer un log, no
   trabajo. Si no se mira ese día, hay que esperar al siguiente.
3. **T-184** 🔴 (el RGPD servido no es el texto oficial, 80 de 99 artículos) — la de más impacto de
   usuario que está libre. **Contexto:** es verificación contra fuente oficial, del tipo en que
   equivocarse cuesta caro; pide sesión con cabeza fresca, no un rato suelto al final del día.

#### 🧭 Bandas de coste (aplicables a CUALQUIER tarea, no solo a una lista)

| Banda | Qué es | Ejemplos |
|---|---|---|
| **Barata** | acotada, mecánica, sin generar contenido | arreglar un detector, un guardarraíl, triar errores, una query |
| **Media** | toca datos de producción y exige verificar contra fuente | repuntar URLs, adjudicar scope, completitud de leyes |
| **Cara** | genera contenido o barre el banco entero | construir una oposición, campañas de preguntas, T-038 |

**Vara de medir (medida, no estimada):** el drenaje CE-mislink del 19-20/07 costó **~2M tokens para
840 preguntas**. T-040 y T-038 son de ese orden o mayores; construir una oposición, también.

#### 📌 Decisiones que siguen vigentes

- **T-040 (artículos-cajón, ~21.000 preguntas) está APARCADA por tamaño** (Manuel, 20/07). No se
  prioriza ni se coge de paso; si se abre, con plan propio y aprobación. Su ausencia es deliberada, y
  por eso lleva `⬜` (prioridad `ninguna`): `next` no la sugiere nunca.

> **⚠️ Por qué esta sección ya no enumera tareas.** Hasta el 27/07 aquí había una lista numerada de 31
> tareas del 20/07. Medido al reescribirla: **15 ya estaban cerradas** y solo cubría **16 de las 76
> vivas (21%)**. Quien la leyera como guía se orientaba con un mapa de una semana antes — pasó de
> verdad al buscar tareas rápidas el 27/07. Una lista a mano de 76 entradas se desincroniza sola; el
> orden lo da la herramienta y aquí solo vive lo que la herramienta no puede saber.
## Importar contenido para cerrar residuo CE-relink (7 preguntas) — 19/07
Del drenaje CE-mislink (837 resueltas) quedan 7 preguntas bloqueadas por FALTA DE CONTENIDO en BD.
Cada una se desbloquea importando de fuente oficial (verbatim, verificar contra fuente, NUNCA inventar):
- [x] ~~**Estatuto de INTERPOL art. 3**~~ **HECHO 20/07**: importado verbatim del PDF oficial INTERPOL `I/CONS/GA/1956 (2023)` (pág. 3). `b593350b` revinculada, explicación §5.1 con cita literal y **approved/visible**. El art. 3 entra en scope automáticamente (ambas filas de `topic_scope` de esa ley tienen `article_numbers=NULL` = toda la ley) → se practica ya en Policía Nacional y Guardia Civil.
- [x] ~~**Ley 1/2004 Consejo Audiovisual de Andalucía art. 4**~~ **CERRADO 20/07 — la tarea estaba MAL PLANTEADA**: no hay texto vigente que importar. El "(Anulado)" de nuestra BD es CORRECTO, no un fallo de import: el BOE consolidado (últ. mod. 21/03/2025) muestra el art. 4 (Funciones) como **(Anulado)** porque la **STC 40/2025, de 11/02/2025** declaró inconstitucional y nulo el art. 7 del Decreto-ley 2/2020, que había reformado esas funciones por decreto-ley vulnerando la reserva de ley del Parlamento andaluz (art. 131.3 EAA). Ambigüedad jurídica: la doctrina clásica diría que revive la redacción original de 2004, pero el BOE **no publica** texto vigente, así que no hay fuente oficial contra la que verificar respuestas. **Decisión (Manuel): retiradas las 3 preguntas** que colgaban del artículo (`4dd964b4`, `bedd71f9`, `52d35910`, todas ya ocultas) con `admin_law_derogated`. El artículo queda **anotado en BD** con la nota de la sentencia para que no se generen preguntas nuevas sobre él.
- [x] ~~**RD 176/2022 Código Conducta GC** — rejilla de títulos/capítulos~~ **HECHO 20/07**: importada del BOE la estructura del Código (anexo) y aplicada a los 44 artículos del Código: Tít.I Cap.I *Valores fundamentales* (arts. 1-9), Tít.I Cap.II *Principios institucionales* (arts. 10-23), Tít.II Cap.I *Normas generales* (24-32), Tít.II Cap.II *Normas durante la prestación del servicio* (33-50). `a689fe59` resuelta y visible: la clave D es correcta porque **"El valor" es un VALOR FUNDAMENTAL (Cap.I, art. 4 del Código), no un principio institucional (Cap.II)**.

## ✅ Drenaje CE-mislink — CERRADO 20/07/2026
**840 preguntas resueltas y visibles · 9 retiradas · residuo 5.**
Detalle completo en `docs/roadmap/campana-citas-ajenas-2026-07.md` §Drenaje CE-mislink.

Las 5 que quedan son suelo de juicio humano, no trabajo automatizable:
- `235fdd3f` — libre circulación del solicitante de asilo en Ceuta/Melilla: es **jurisprudencia del TS**
  (+ art. 5 Directiva 2013/33/UE), no hay precepto que citar. Decidir: retirar o reformular.
- `7e949e29` — premisa falsa: el art. 13 CE no enumera reunión/manifestación/asociación (están repartidos en
  LO 4/2000 arts. 7, 8 y 9). Reformular enunciado o retirar.
- `5ebd42b1`, `ddb0a848` — categoría "Poder Judicial" de los portales de internet públicos: clasificación de
  manual sin precepto que la respalde (confianza baja).
- `887c89cd` — "Tipos de Estado": taxonomía doctrinal variable según manual (confianza baja).


## ✅ [DESPLEGADO 24/07 — verificado en prod] Desplegar F0 antifraude + PDF-premium + nav (el bloqueo por vCPU AWS del 22/07 se resolvió)
> **CERRADA 24/07:** los tres aterrizaron (deploy frontend+backend del 23/07, tras liberarse la vCPU). Verificado en prod: `/api/version`=`a0d760a9` (no el rollback `:503`/`4f67958b`); F0 `/api/v2/admin/fraud/{pending-count,signals}`=**401** (existen, no 404); nav «**Test combinando leyes**» presente en el HTML de home; PDF-premium (T-076)=**403** en todos los temas. **T-076 y T-087 marcadas `done` en `backlog_tasks`.** Lo de abajo queda como histórico del bloqueo (no accionar). Cabos vivos aparte: T-091/T-092/T-093.
- **[histórico] Qué estaba en `origin/main` SIN desplegar** (todo commiteado, nada que perder):
  - **Sistema antifraude F0** (T-078): `cf7062859` (badge 🚨 + revisión + runbook `revisar-fraudes.md` + endpoints `/api/v2/admin/fraud/{pending-count,signals,signals/review}` + pestaña "Señales" en `/admin/fraudes` + sweep `scripts/fraud-sweep.cjs`) · `e5cfe988b` (**cron backend** `backend/src/fraud-sweep/` @Cron 03:15 UTC) · `f229dbfe5` (afinado IP-detector: excl. CDN + device-corr).
  - **PDF-premium** (T-076): `d06e0ed3` — descargar/imprimir PDF del temario es premium (todos los temas, 👑 + modal).
  - **Nav**: `8ffa41c4` — "Test combinando leyes" + quitar "Leyes".
- **Por qué NO se desplegó (bloqueador REAL, verificado 22/07):** ECS no puede colocar tasks nuevas → *"You've reached the limit on the number of vCPUs you can run concurrently"* → el rolling deploy falla y **ECS hace rollback a `:503` (4f67958b, build viejo)**. NO es clobber entre sesiones (eso ya se arregló, `a4e1e69d3`); es el **límite de vCPU de la cuenta**, agravado por la **migración a koigrid** de otra sesión que consume la capacidad. Mientras dure, NINGÚN deploy aterriza (afecta a todas las sesiones).
- **Estado del build:** ya construí la imagen `vence-frontend:506` (SHA `9fa97b6a`, incluye F0 frontend + PDF + nav), pusheada a ECR y validada por smoke (home 200, auth 401). Desde 9fa97b6a → tip actual solo hay docs + 1 fix de backend (health-sweep), **ningún frontend nuevo** → `:506` sigue vigente para el frontend.
- **CÓMO RETOMAR cuando termine la migración koigrid + baje la presión de vCPU:**
  1. **Frontend:** `aws --profile vence --region eu-west-2 ecs update-service --cluster vence-backend --service vence-frontend --task-definition vence-frontend:506` (o reconstruir del tip con `scripts/deploy-frontend.sh` desde worktree limpio de origin/main; da igual, no hay frontend nuevo). Esperar `services-stable` + verificar `curl https://www.vence.es/api/version` = `9fa97b6a`.
  2. **Backend:** `scripts/deploy-backend.sh` desde worktree limpio → sube el cron `fraud-sweep` + el fix de health-sweep. Verificar en logs `/ecs/vence-backend`: "Cron 'fraud-sweep' registrado".
  3. **Verificar F0 en vivo:** badge 🚨 en `/admin/fraudes` (endpoint `/api/v2/admin/fraud/pending-count`); frase **"revisa las señales de fraude"** → runbook `revisar-fraudes.md`.
  4. **Re-check salud:** el runbook `health-check.md` daba 🔴 ROJO por **saturación de BD/pool** (mismo crunch de vCPU) → debería volver a verde al recuperarse la capacidad. Confirmar que bajan los 5xx de `/api/interactions` + errores de `answer-and-save`.
- **OJO al desplegar con varias sesiones activas:** coordinar (SOLO una despliega); si el límite de vCPU persiste, bajar `maximumPercent` del servicio (200→110) para que el rolling arranque 1 task extra en vez de duplicar, o pedir aumento de quota vCPU a AWS Service Quotas.
- **Contexto completo:** memoria/sesión antifraude (T-078); manual deploy `docs/runbooks/pusheo-revision-despliegue.md`.

## 🧹 Cabos sueltos F0 antifraude / deploy (23/07/2026) — para retomar en cualquier sesión

## 🔢 Orden de ataque (reordenado 20/07 — **penaliza el coste en tokens**)

> **Criterio (Manuel, 20/07):** lo que **quema muchos tokens va a prioridad baja**. Arriba, lo barato
> y con valor claro. Esto NO es orden de impacto: T-040 sigue siendo la de más impacto de todo el
> backlog (~21.000 preguntas), pero es también la más cara, así que baja.
>
> **La fuente de verdad del estado y la prioridad es la tabla `backlog_tasks` (RDS)**, no este índice.
> `node scripts/backlog.cjs next` ya aplica este orden.

**🟠 Alta — barato y con valor claro (empezar por aquí):**
1. ~~**T-035** Capturar fecha de examen Univ. de León~~ — ✅ **AUTOMATIZADA, cero consulta manual** (`detect-oep-llm` extrae la fecha de la `seguimiento_url` + T-072 `nota_examen` de los PDFs → llega como señal 🎯). Fuera del orden de ataque. **NO mirar la web a mano.**
2. **T-009** Disposiciones anuladas (STC) — el detector v1+v2 YA está hecho; quedan ~5 candidatos + cron
5. ~~**T-039** Botón «Descargar PDF» + PDF server-side por tema~~ — ✅ **HECHA + DESPLEGADA** (deploy `4f67958b`; render markdown/tablas/estructura; PDF por tema verificado en vivo 200/application/pdf). Resuelve del todo «Imprimir PDF falla en in-app» (T-001). La Fase 2 (temario completo) se saca a **T-076**.
   - ~~**T-076** Gating de impresión PDF por plan~~ — ✅ **CERRADA + DESPLEGADA** (24/07). Shipped **más duro que el plan**: el PDF del temario por tema es **Premium para TODOS los temas** (cupo gratis descartado, decisión 21/07; se sacrifica el SEO «PDFs descargables» a cambio de no filtrar valor premium). Verificado en prod: `GET /api/temario/administrativo-estado/{1,5,20}/pdf` sin auth → `403 premium_required`. Gating: `TopicPrintButton.tsx` + `lib/premium/features.ts` (`print_pdf`) + defensa server-side en la route (`verifyAuthOptional`+`getUserPlanType`+`isPremiumPlan`). Commit `0090552f6`.
   - **T-077** Cambiar de oposición requiere plan premium **semestral o anual** (los de compromiso largo). Free + mensual + trimestral no pueden → upsell a los planes largos. *Detalle a decidir:* si el free puede fijar/cambiar su **única** oposición objetivo en el onboarding (no matar la exploración inicial) o bloqueo total. NO es antigüedad de cuenta (descartado), es el **tier del plan**.

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
26. ~~**T-044** Construir Aux. Admin. Univ. de Almería~~ — ✅ **HECHA, PUBLICADA Y VIVA** (20-21/07). Fuera del orden de ataque.
27. **T-045** Construir Agentes de Tributos **Agencia Tributaria Canaria** — ⚠️ degradada: son **8 plz libres** (no 20) y temario tributario específico
28. **T-016** Construir TSID · 29. **T-021** Construir Ujieres Cortes · 30. **T-022** Construir Gestión A2 Andalucía

**⬜ Sin prioridad — fuera del orden de ataque:**
- **T-040** Artículos-cajón (~21.000 preguntas, 110 mega-chunks) — **aparcada por tamaño (Manuel, 20/07)**. No se prioriza ni se coge de paso; si se abre, con plan propio y aprobación. Su ausencia de la lista de arriba es deliberada.

> **Nota de calibración:** el drenaje CE-mislink del 19-20/07 costó ~2M tokens para 840 preguntas.
> Sirve de vara de medir: T-040 y T-038 son de ese orden o mayores; construir una oposición, también.

