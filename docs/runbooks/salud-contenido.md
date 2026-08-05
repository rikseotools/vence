# Runbook: Salud de contenido + salud de app (detección + alertas)

> **Cuándo consultarlo:** cuando el usuario diga *"salud de contenido"*, *"qué tarjetas/datos están mal"*, *"badge de contenido"*, *"revisa las incoherencias de datos"*, cuando llegue el **email semanal de contenido** o el **email de fallos de app**, o cuando el **indicador "Salud del contenido"** de `/admin/salud-sistema` se ponga ámbar/rojo. NO confundir con `health-check.md` (salud de infra: 5xx, pool, latencia) ni con `oeps-convocatorias-seguimiento.md` (señales OEP).

## Filosofía: dos salud distintas, urgencia distinta

- **🔴 Salud de la APP (fallos):** el usuario topa con un error AHORA — endpoints caídos (landing/temario/test ≠ 200), 500/502/503, render-errors, webhook roto, tema publicado sin preguntas. **Urgente.**
- **🟡 Salud del CONTENIDO (calidad):** el dato está mal pero la app funciona — tarjetas de plazas/temas incoherentes, dual-write de convocatoria incompleto, cobertura fina de temas, timeline sin hitos. **A revisar, no urgente.**

Mezclarlas genera fatiga de alertas. Por eso van separadas en cadencia y en superficie.

## Arquitectura: computa UNA vez, léelo en 3 sitios

```
scripts/health-sweep.cjs  (EventBridge → ECS Fargate, ~05:00 Madrid)
        │  recorre TODAS las is_active: HTTP + cobertura (MV) + coherencia + observable_events(24h)
        ▼
  content_health_findings   (TRUNCATE + INSERT cada run = estado ACTUAL)
        │
        ├── 📧 email        → APP (nightly, si hay fallos) · CONTENIDO (semanal, lunes)
        ├── 🖥️ panel        → indicador "Salud del contenido" en /admin/salud-sistema
        └── 🔢 badge nav    → /api/admin/content-health devuelve `badge` (❌+🟡 de contenido)
```

**Por qué una tabla y no calcular en vivo:** el badge/panel se abren en horas de usuarios; recalcular la auditoría (canary + coherencia sobre todo el catálogo) en cada carga machacaría la BD. El sweep computa de madrugada (tráfico mínimo) y todas las superficies leen el snapshot → cero carga extra en admin.

## Piezas

| Pieza | Qué |
|---|---|
| `scripts/health-sweep.cjs` | El barrido. Autocontenido con `pg` (la imagen standalone poda postgres-js) + `fetch` builtin. App: HTTP + cobertura(MV) + observable_events. Contenido: coherencia de tarjetas + dual-write + hitos. Escribe la tabla + manda emails. |
| `content_health_findings` (tabla) | Snapshot: `category` (app/content), `severity` (error/warn), `oposicion_slug`, `kind`, `message`, `detail`, `computed_at`. |
| `GET /api/admin/content-health` | Lee la tabla → `{counts, status, badge, computedAt, stale, content[], app[]}`. Auth admin. |
| Indicador `/admin/salud-sistema` | Card "Salud del contenido" (semáforo + lista). |
| Schedule `vence-health-digest` | EventBridge Scheduler → ECS, cron ~05:00 Madrid. |

## Cómo se ejecuta

- **Automático:** el schedule de AWS lo lanza cada madrugada. No lo lanzas tú.
- **A mano (probar/forzar):**
  ```bash
  DATABASE_URL=... RESEND_API_KEY=... node scripts/health-sweep.cjs        # real: escribe tabla + emails
  DRY_RUN=1 DATABASE_URL=... node scripts/health-sweep.cjs                  # escribe tabla, imprime emails, no envía
  DRY_RUN=1 FORCE_CONTENT_EMAIL=1 ...                                       # fuerza el email de contenido (sin ser lunes)
  NO_WRITE=1 ...                                                            # no toca la tabla (solo email)
  ```
- **Las herramientas CLI sueltas** (a demanda, para investigar): `npm run canary:oposiciones` (app) y `npm run audit:coherencia` (contenido). El sweep usa la misma lógica pero automática y persistida.

## Cuándo salta el email

- **App:** SIEMPRE que haya un fallo (la noche que sea). Silencio si verde.
- **Contenido:** solo los **lunes** (resumen semanal), porque el contenido cambia despacio y a diario spamearía. El badge/panel lo ven a diario.

## Qué hacer cuando algo está rojo

1. **App rojo** (endpoint caído, 5xx, tema vacío): es un bug. Investiga el endpoint/oposición. Los render-errors suelen traer la causa pg si el `catch` la loguea (ver instrumentación de `/api/v2/admin/validation-errors`).
2. **Contenido rojo** (tarjeta de plazas/temas incoherente, no_hitos):
   - **Tarjetas de plazas:** casi siempre la tarjeta muestra el **total de la OEP con reservas** en vez de las plazas reales de la convocatoria (militares, otras categorías…). **Verifica contra el boletín oficial** (`programa_url`/`boe_reference`) qué plazas se presenta un opositor de ESA categoría y corrige la tarjeta (o la convocatoria si es la que está mal). NUNCA inventar — ver §6g de `crear-nueva-oposicion.md`.
     > 🆕 **Antes de "corregir" la tarjeta, comprueba si falta un TURNO** (16/07/2026). Puede que la tarjeta tenga razón y el que esté corto sea nuestro esquema: el BON de Navarra reparte 585 plazas en **cuatro** turnos (264 libre + 264 promoción + 51 discapacidad + **6 reserva para mujeres víctimas de violencia de género**) y las columnas solo modelaban tres → la tarjeta buena (585) parecía errónea contra la suma (579). La cola de turnos vive en **`convocatorias.plazas_otros_turnos`** (jsonb, con su cita) y el total se deriva con **`convocatoria_plazas_total(id)`**. Añade el turno con su cita literal en vez de bajar la tarjeta.
     > ⚠️ **El sweep auditaba la copia que NADIE VE (bug corregido 16/07).** Leía `oposiciones.landing_estadisticas` (legacy) cuando la landing lee `oposiciones_ssot`, donde **gana la fila de `convocatorias`**. En `administrativo-navarra` la copia legacy decía "Plazas totales: 264" (cuadraba → visto bueno) mientras el opositor veía 585 sin comprobar; **7 de 91 landings activas** tenían tarjetas distintas entre legacy y vista. Al mirar la vista aparecieron **4 tarjetas que mienten** (celador-sescam-clm 537 vs 128; tcae-aragon 425 vs 238; administrativo-madrid 129 vs 107/7/105; auxiliar-archivos-estado 25 vs 31). **Si tocas este check, audita SIEMPRE `oposiciones_ssot`:** validar la copia equivocada da tranquilidad falsa, que es peor que no tener guardarraíl.
   - **`no_hitos`:** la convocatoria está con inscripción abierta sin timeline → poblar `convocatoria_hitos` con las fechas oficiales.
   - **`temas_card`:** usar `{temasCount}` para que se auto-resuelva.
3. **Contenido ámbar** (dual-write, cobertura fina): no urgente. Dual-write = completar los campos NULL de la fila `convocatorias`. Cobertura fina = generar más preguntas (§ generar-preguntas-con-ia.md).
   - **`dual-write DIVERGENTE`** (*"revisa el dual-write de convocatorias"*): la fila legacy `oposiciones` y su convocatoria `is_current` tienen valores DISTINTOS y ambos no-null. **Adjudicar fila a fila con `node scripts/dual-write-adjudicar.cjs <plan.json>`** (dry-run por defecto; exige `gana` y `porQue` escritos, lista blanca de campos, escribe el SSOT antes que la legacy y verifica en la transacción). **NUNCA copiar en bloque:** en la tanda del 26/07 salió **7-7** — a veces va por delante la convocatoria y a veces la legacy.
     - **De dónde sacar la evidencia sin salir a la web:** los **hitos de registro** (`convocatoria_hitos` con `origen='registro'`) ya llevan cita y URL oficiales. El `estado_proceso` correcto es **el último hito oficial registrado**. Así se adjudicaron 14 de 15 sin abrir un boletín.
     - **⚠️ Mira `archived_at` ANTES de decidir.** Con dos ciclos vivos, un "legacy por delante" puede ser justo lo contrario: `administrativo-seguridad-social` y `tecnico-informatica` tenían el ciclo viejo **archivado** y la vigente era la OEP 2026 → el rollover estaba bien y la stale era la legacy. Sin mirarlo, la adjudicación sale invertida.
     - **⚠️ Un `exam_date` marcado `exam_date_approximate` NO sostiene `pendiente_examen`** (es una estimación nuestra, no un examen anunciado). Uno firme sí.
     - **En las de PLAZAS la causa suele ser SEMÁNTICA, no dato stale:** si la reserva de discapacidad va **dentro** del turno libre o **aparte** (`plazas_discapacidad_incluidas`). El propio `npm run audit:coherencia` ya lo explica por ti — usa `lib/convocatoria/divergenciaPlazas.js` y dice *"gana la CONVOCATORIA: la legacy guarda el TOTAL (…)"* cuando la aritmética lo demuestra, o *"NO se explica por la reserva → leer la cita"* cuando toca criterio. Ese criterio **solo vale para `plazas_libres`**; para los demás campos hay que leer la cita.
4. **`audit_note_explanation`** (*"revisa las explicaciones rotas"*): preguntas visibles cuya `explanation` es en realidad la **crítica de un pase IA anterior** guardada por error (*"La explicación debería…"*, *"posible errata"*, *"Nota técnica:"*, *"Esta pregunta debería anularse"*) — defecto de pipeline (se remediaron ~46 el 10/07). Para cada una: **verificar la clave contra la ley/fuente** (leer otros artículos si hace falta) → si la clave es correcta, **reescribir la explicación** didáctica (cita literal + análisis A/B/C/D); si hay defecto de fondo (clave/artículo/opciones), **`needs_human`**. NUNCA auto-flip de clave. Flujo con agentes: `docs/maintenance/revisar-preguntas-con-agente.md` (generar/reparar → auditoría ciega → aplicar). Memoria `project_explicaciones_nota_auditoria`.
5. **`visual_deixis_no_image`** (*"revisa las preguntas sin imagen"*): preguntas activas cuyo enunciado **apunta a un icono/símbolo/imagen que no está almacenado** (*"¿qué significado tiene el siguiente icono?"*, *"el siguiente símbolo advierte de…"*, *"observa la siguiente figura"*, *"de las restas de la imagen, indica…"*) con `image_url` NULL y `content_data` vacío → **irresoluble**: el estudiante ve las opciones pero no el gráfico. Punto ciego que ningún otro detector veía (coherencia enunciado↔imagen) y que el re-verificador LLM puede dar por bueno porque solo mira el texto. Para cada una: **(a)** si el enunciado o las opciones ya describen el visual en palabras (p. ej. *"El icono muestra dos documentos superpuestos…"*, o los glifos van en las opciones) → **autocontenida, dejar**; **(b)** si necesita la imagen y hay **fuente oficial** recuperable → reconstruir la imagen y re-vincular; **(c)** si no hay fuente (típico en IA no-oficial) → **jubilar** con `transition_question_state(..., 'admin_image_unavailable', 'retired_irreparable', ...)` + invalidar caché `questions`. NUNCA inventar la imagen ni fijar una clave a ciegas. Caso raíz 22/07 (usuaria Concha, impugnación `7119bd5d`): icono de Outlook marcado `needs_human` 2× por *"requiere imagen no disponible"* y re-aprobado el 10/07 como falso positivo → visible y roto hasta que lo impugnó; barrido posterior jubiló 5 más.

   - 🎯 **Calibración del detector (T-113, 26/07): las 5 que marcaba eran falsos positivos** — preguntas AUTOCONTENIDAS que aluden a un visual pero traen en TEXTO todo lo necesario. Dos guardas, en el núcleo puro `lib/health/visualDeixis.cjs` (el CLI lo requiere; el backend @Cron lo replica y `content-sweep-parity` compara POR VALOR):
     1. **`esquema` NO cuenta como sustantivo visual.** En administración/informática "el siguiente esquema" introduce un esquema TEXTUAL, inline en el enunciado (`ES_órgano>_ _>ID_específico`, metadato ENI) o desplegado en las opciones (clasificación URO de Correos). Medido: 2 activas lo usan y **ninguna ha tenido nunca `image_url`** → precisión 0 como señal.
     2. **SQL autocontenido:** si la consulta entera (`SELECT … FROM`) está en el enunciado **o en las OPCIONES**, se responde leyendo el SQL; el diagrama es contexto, no el dato que falta. Mirar las opciones es imprescindible: en 2 de los 3 casos reales la query vive ahí.
   - ⚠️ **Punto ciego asumido:** una pregunta que diga "el siguiente esquema" Y necesite de verdad una imagen Y no use otra palabra visual no se marcará. Estrecho, y este detector es `warn` de triaje.
   - **`content_data.image_base64` cuenta como imagen almacenada.** Muchas preguntas de ofimática guardan el icono ahí y no en `image_url`: por eso no se marcan, y es correcto.

6. **`article_no_coverage`** (*"revisa los artículos sin preguntas"*): artículos que están en el `topic_scope` **con texto real importado** pero con **0 preguntas activas** — el tema en conjunto puede tener cientos de preguntas, así que ningún otro detector lo ve; simplemente ese artículo del temario **nunca le sale al opositor**. Procedimiento (campaña T-115, validado 26/07/2026):
   - **Empieza SIEMPRE por el planificador**, no por SQL a mano: `npm run huerfanos:plan` da el estado, las leyes con más huérfanos y **el siguiente lote propuesto con su impacto simulado** (`--ley <slug>`, `--simula <slug> <arts…>`, `--excluir` para sesiones en paralelo, `--deuda` para la deuda real, **`--oposicion <slug>` para CERRAR una oposición del todo**). Núcleo puro `lib/generacion/huerfanosPlan.js`, testeado y **en paridad con el detector** (si alguien recalibra el sweep, el test rompe).
   - **La misma salida trae dos señales más (fusionadas el 26/07 al retirar un planificador duplicado):** la columna **`usuarios`** —a cuántos opositores llega cada hueco, que NO es lo mismo que el alcance: dos leyes con idéntico rendimiento por artículo escrito estaban delante de 3.130 y 733 usuarios— y el aviso **⚠️ de leyes con batch en las últimas 24 h de CUALQUIER sesión**. Este último nace de una colisión real: dos sesiones generaron sobre los mismos 5 artículos de la LPRL con 13 minutos de diferencia y hubo que jubilar 9 preguntas por redundancia de fondo. **El dedup del Paso 3 no lo evita** (compara enunciados; dos preguntas que evalúan lo mismo con otras palabras se le escapan). `--excluir` sigue estando, pero exige saber de antemano qué excluir; esto lo detecta solo. **Avisa, no filtra:** continuar una ley que otra sesión dejó a medias puede ser lo correcto, lo que no puede pasar es elegirla sin saberlo.
   - ⚠️ **El badge a cero NO es temario cubierto.** El detector exige ≥4 huecos, así que cubrir 1 de 4 ya lo apaga y deja 3 artículos sirviendo 0 preguntas, ahora invisibles. Medido 26/07: **3.093 huérfanos visibles al badge vs 10.339 de deuda real.** La simulación avisa de los residuales; `--deuda` los lista.
   - ⚠️⚠️ **Y hay una deuda que el badge NO PUEDE ver: la numeración no numérica (T-146, 26/07/2026).** El detector filtra `article_number ~ '^[0-9]+$'` en sus dos consultas, así que **`bis`/`ter`/`quáter` y las disposiciones adicionales, transitorias, finales y derogatorias no existen para él**. Medido: **1.312 artículos activos escopados** son no numéricos (165 leyes) y **715 tienen texto real y 0 preguntas**. Se listan con **`npm run huerfanos:plan -- --invisibles`** (y `--invisibles adicional` por familia). **No se cubren todos**: una disposición final de entrada en vigor no es materia de examen. La familia que sí importa es la de **reforma** (183 huecos, 1.345 ch de media), que es donde vive el Derecho más nuevo — y precisamente la que más cae en examen. Antes de generar, ojo: hasta el 26/07 **el Paso 1 era imposible** para ellos porque el verificador no encontraba el bloque del BOE (la BD escribe `6bis`, el BOE «Artículo 6 bis»); ya está arreglado con `bloqueDeArticulo()`.
   - **Prioriza por ALCANCE, no por oposición.** La pregunta cuelga del **artículo**, así que cubrir un artículo apaga el hueco en TODAS las oposiciones que lo escopan a la vez. Ranking: agrupar los huérfanos por `(law_id, article_number)` y ordenar por nº de `position_type` distintos que lo escopan. Medido: 13 preguntas sobre 5 artículos de la LPRL taparon el hueco en **19 temas de 19 oposiciones**; ir oposición por oposición habría costado 19 lotes.
   - **La fuente es el `content` que ya está en BD** (verbatim BOE) — esto NO es buscar en internet. Pero **antes de generar, contrasta ese `content` contra el BOE vigente** con `scripts/verificar-articulos-vs-boe.cjs`: si el artículo se importó antes de una reforma, el lote sale coherente y **derogado** (ver el GOTCHA de las versiones desordenadas en `generar-preguntas-con-ia.md` §Paso 1).
   - Generar con el pipeline completo de `generar-preguntas-con-ia.md`: `insertar-batch-generado.cjs` (entra en `draft`, invisible) → `npm run batch:gate` (mecánico: literalidad, cita truncada, longitudes, cabecera, siglas y **overclaim**) → **doble auditoría ciega** con 2 agentes independientes (uno de checks, otro adversarial "búscame lo impugnable") → `aprobar-batch-generado.cjs` (emite `question_batch_approved` a `observable_events`) → **Paso 9** (re-verificación con un agente NUEVO sobre la pregunta ya viva) → refresh de MV + invalidar tags → **`npm run batch:servido -- <batch_id>`** (cierre: se lo pregunta a producción por HTTP, no a la BD).
   - **El Paso 9 no es formalidad.** El 26/07 las dos auditorías ciegas dieron 18/18 PERFECT y el Paso 9 cazó un **overclaim**: la explicación del art. 5 LBRL remataba *"sin excluir clase alguna de bienes"* cuando el art. 80 declara inalienables los de dominio público, y un distractor introducía justo esa salvedad. Ese patrón ya es gate determinista (`lib/generacion/overclaimExplicacion.js`), pero dile explícitamente al agente del Paso 9 que **contraste cada distractor con el resto de la ley**, no solo con su artículo.
   - **Seguimiento:** `SELECT metadata FROM observable_events WHERE event_type='question_batch_approved'` responde cuántos artículos se han cubierto, con qué lotes y qué oposiciones se beneficiaron, sin reconstruirlo a mano desde los tags.
   - **Cuántas por artículo:** según su estructura (§2.6 del manual). Un artículo de una frase da 1; uno enumerativo con apartados da 4-5. No forzar cuota.
   - NUNCA inventar contenido ni fijar una clave sin que la opción correcta sea cita literal (o condensación válida) del artículo.

6bis. **`cobertura_banda_ciega`** (*"revisa la banda ciega de cobertura"*, T-543, 05/08/2026): la zona que NINGÚN otro detector de cobertura ve, porque cae **entre** los dos: `article_no_coverage` exige ≥60% de artículos cubiertos; `low_coverage` exige <6 preguntas servidas en TODO el tema. Un tema con cobertura de artículos <60% pero servido con 6-50 preguntas —ni tan pocas como para disparar `low_coverage`, ni tan cubierto como para disparar `article_no_coverage`— queda invisible en las dos rejillas a la vez.
   - **Origen:** Neus A.B. (premium) escribió tres veces en 19h sobre el tema 3 (EACV, Estatut d'Autonomia) de `subalterno_gva`: 48 artículos escopados con texto, solo 22 servían preguntas (46%). El scope y el epígrafe estaban verificados y correctos — no era un fallo de temario, era que el tema tenía 39 preguntas repartidas en muy pocos artículos, y repetía.
   - **Calibración medida contra RDS antes de tocar el detector** (método de la casa: medir → mirar casos a mano → elegir corte, NUNCA bajar el 60% de `article_no_coverage` de golpe — eso mete 218 hallazgos de una tacada, que es cómo se mata un badge): la banda sin acotar (≥4 huecos, cobertura <60%, ≥6 preguntas) da **218 temas / 74 oposiciones**, pero su mediana de preguntas servidas es **92** y su p75 **293** — con esas cifras un opositor tarda semanas en agotar el pool y no nota el hueco. El dolor real (repetir dentro de la MISMA sesión de estudio) aparece por debajo de la mitad del preset de test más grande de la app (100, `customQuestionCap` en `TestConfigurator.tsx`): acotado a **6-50 preguntas servidas** quedan **69 temas / 38 oposiciones**. Umbrales en `UMBRAL_BANDA_CIEGA` de `lib/generacion/huerfanosPlan.js`, función `disparaBandaCiega`, en paridad testeada con los dos gemelos del sweep (mismo patrón que `article_no_coverage`).
   - **Cómo trabajarlo:** `npm run huerfanos:plan -- --oposicion <slug>` — desde T-543 esta bandera enseña la **deuda completa** de la oposición (no solo lo que mueve el badge global), precisamente para que un tema de la banda ciega no vuelva a quedar invisible en la propia herramienta que sirve para cerrarla. Prioriza los temas con MENOS preguntas servidas (se notan antes) y genera con el mismo pipeline de doble auditoría ciega que `article_no_coverage` (§6 arriba).
   - **Lo que NO cubre esto:** la deuda real de GENERACIÓN sigue siendo trabajo de contenido caro (verificar contra BOE, escribir, doble auditoría ciega) — este detector solo hace visible dónde está, no la resuelve sola.

7. **`convocatoria_enlace_no_boletin`** (*"revisa los enlaces de convocatoria"*, misma frase que los otros dos detectores de enlace): el botón oficial de la landing dice **"Ver convocatoria en {diario_oficial}"** y el `programa_url` **no es de NINGÚN boletín**. Es el tercer detector de la misma tarjeta y tapa el hueco que dejaban los otros dos: `convocatoria_link_mismatch` compara dos ids `BOE-…` y `convocatoria_etiqueta_boletin` compara dos boletines — **los dos necesitan reconocer un boletín en la URL para poder hablar**, así que un portal institucional los dejaba mudos a los tres. Caso raíz 26/07 (T-134): **`policia-nacional`**, con plazo ABIERTO, prometía el BOE y llevaba a `policia.es/portalaspirantes/**en**/web/escala-basica-ejecutiva` — ni BOE, ni convocatoria, ni español; se descubrió al preparar su newsletter, no por el sistema. Medido ese día: **56 de 123 landings activas** estaban en esa zona muerta.
   - **Bandas:** `error` = hay **convocatoria publicada** (`estado_proceso` con ficha viva: publicada/convocada/inscripción/admitidos/pendiente examen → existe un documento oficial que enlazar) y el enlace es una **portada/sección de portal** o está **en otro idioma**. `warn` = aún no hay convocatoria (OEP aprobada, sin OEP, proceso ya cerrado) —ahí la página institucional puede ser lo mejor disponible y lo que suele fallar es la **etiqueta**— o el enlace es un **TEMARIO**.
   - **⚠️ El detector juzga el enlace que la landing ENSEÑA, no `programa_url` a pelo (28/07/2026).** Sin convocatoria publicada y con el documento de la OEP ya clonado, la página enlaza **ese** documento y rotula **"Ver OEP en {diario}"** (regla F4/T-108). Mientras el detector ignoró eso marcó **5 de 13 avisos sobre URLs que ningún opositor ve** — `administrativo-andalucia` señalado por el temario del IAAP cuando la página enseña su BOJA, y `administrativo-castilla-la-mancha` con su DOCM. La regla vive ahora en el núcleo compartido **`lib/convocatoria/enlaceOficial.cjs`** (`enlaceOficialEfectivo` + `rotuloEnlaceOficial`), que consumen la página, el detector y los dos barridos: **si cambias cómo la landing elige el enlace o el rótulo, cámbialo AHÍ o los vigilantes volverán a quedarse atrás.**
   - **Corolario práctico al triar:** un aviso en una oposición **sin convocatoria** casi siempre significa que **falta clonar el documento de su OEP** (por eso cae al portal institucional), no que haya que cambiar la etiqueta. Herramienta: `scripts/convocatoria/bandeja-documentos.cjs`.
   - **Lo que NO se marca, a propósito:** que la entidad publique las bases **en su propia sede** (un PDF, una ficha con id) es legítimo y frecuente; marcarlo sería la bandeja ruidosa que ya hubo que retirar (T-047). El detector solo habla cuando la URL **ni siquiera puede ser un documento**.
   - **El caso TEMARIO es una decisión de diseño, no un typo:** `programa_url` sirve a **dos contratos** —es el programa/temario oficial que hashea el Sistema 2 de literalidad de epígrafe (`programa_last_hash`) **y** el enlace del botón de convocatoria—. En Andalucía, CLM, SESCAM y Guardia Civil apunta a un temario: **correcto como `programa_url`, engañoso bajo "Ver convocatoria"**. Por eso queda en `warn` y no bloquea el gate: repuntarlo a ciegas rompería la otra superficie.
   - **Cómo arreglar:** busca el documento oficial de la convocatoria en su boletín, **ábrelo y confirma que es esa convocatoria**, y repunta `programa_url` con **dual-write** (`oposiciones` **y** la convocatoria vigente, que es de donde lee la landing) + purga de caché repetida (es per-instancia). Si de verdad no hay documento, la honesta es la otra: cambia `diario_oficial` a lo que el enlace es en realidad y deja el boletín de las bases en `diario_referencia`. **NUNCA repuntar sin abrir el documento.**
   - **Antes de tocar nada, simula:** `node scripts/convocatoria/sim-enlace-boletin.cjs` (no escribe nada; `--limpias` enseña también las que pasan, `--json` para tuberías). El registro de boletines que decide todo esto es compartido: `lib/convocatoria/canonicalizeBoletinUrl.cjs` (`PATTERNS` = identidad del documento, `BOLETIN_HOSTS` = dominio). **Añadir un boletín = una fila ahí y su espejo en el backend @Cron** (`content-sweep-parity` compara las dos tablas por valor y falla si divergen).

## Documentos oficiales sin revisar: la bandeja (*"revisa los documentos nuevos"*)

**Comando:** `npm run docs:bandeja` · `--ver <id>` · `--revisado <id> --nota "…"` · kind `documentos_sin_revisar`.

El cron `detect-notas-convocatoria` (09:30 UTC) descarga la página de seguimiento de cada oposición **que preparamos**, clona los documentos que cuelgan de ella en `convocatoria_documentos` con su texto y su hash, y **ahí para**. La decisión —qué fecha, qué plazas, qué versión de software se publica— la toma **una sesión de Claude leyendo la fuente**, con dual-write.

**Dos cosas cambiaron el 26/07/2026, las dos medidas:**
1. **El cron solo mira las oposiciones `is_active`.** Antes recorría el catálogo entero (464+ con `seguimiento_url`) y el **96% de los documentos clonados en 7 días (5.244 de 5.437) eran de procesos que nadie estudia en Vence**: 750 documentos/día de ruido. Con el filtro quedan **~25/día**, que es una bandeja atendible.
2. **Se ELIMINÓ la pre-extracción con LLM** (no apagada tras un flag: borrada, junto a su prompt, su parser y la caché que existía solo para ella). Generaba un JSON de seis campos por documento con Haiku: **6.886 extracciones y CERO triadas** — nadie miró ni una, y costaron ~17 USD (el 56% del saldo de LLM). No sobraba por mala, sino por **redundante**: el documento se clona igual y quien decide es quien tiene criterio. De regalo, el cron dejó de depender del proveedor — el 26/07 Anthropic estuvo 10 horas sin saldo y con esto el pipeline no se habría enterado.

**Flujo de trabajo:** `docs:bandeja` (cola, con las de **plazo abierto primero**) → `--ver <id>` (el documento entero **junto a lo que hoy dice la BD**, para comparar) → actualizar con dual-write (`oposiciones` + convocatoria vigente) → `--revisado <id> --nota "qué se hizo"`.

**Las `seguimiento_url` irán afinándose sobre la marcha:** algunas apuntan al portal de empleo del organismo en vez de a la ficha del proceso. Cuando se detecte, se repunta con `scripts/seguimiento/repuntar-url.cjs` (que verifica que la nueva URL sea vigilable y mencione el proceso). **NUNCA publicar un dato que no esté en el documento.**

## Auditar UNA landing entera: `npm run audit:landing -- <slug>` (*"audita la landing"*)

**Un comando, un veredicto, un exit code.** No escribe nada. Es el punto de entrada que faltaba: hasta T-142 había seis herramientas dispersas (`audit:oposicion`, `audit:coherencia`, `audit:convocatorias`, `canary:oposiciones`, `canary-landing-vs-bd`, el sweep) y **ninguna respondía "audítame ESTA landing"**, así que antes de mandarle una campaña nadie las corría. Por eso el envío de newsletters lo usa como **puerta**.

Qué hace, recorriendo el **inventario de superficies** (`lib/admin/landingSurfaces.ts`, el mismo del guardarraíl de CI y del panel):
1. junta lo que el sweep ya calculó para ese slug (`content_health_findings`);
2. re-ejecuta los **núcleos puros** sobre los datos vivos (completitud, botón oficial), por si el sweep no ha corrido desde el último cambio;
3. añade lo que no cubría nadie: **enlaces del HTML servido** (`landing_enlace_roto`), **cifras afirmadas contra el documento de convocatoria clonado** (`landing_cifra_sin_respaldo`) y **superficies que se contradicen** (`landing_superficies_contradictorias`);
4. lista las **superficies con hueco declarado** — lo que hoy no vigila nadie, a la vista.

**Los tres kinds son ON-DEMAND a propósito, y eso se midió antes de decidirlo.** Enchufados al barrido nocturno sobre las 123 landings activas daban **168** avisos de cifra y **89** "contradicciones". Las causas, medidas: el hub de provenance tiene el **96% de los documentos clonados como `nota`** (6.408 de 6.625; solo 149 son `convocatoria`), así que en la mayoría de landings se contrastaría contra el documento equivocado; y las FAQ **enumeran subconjuntos** ("10 preguntas de reserva" frente a "60 del test"), que comparados entre sí parecen contradicciones y no lo son. Con el documento correcto y un humano leyendo, los mismos detectores son precisos — cazaron las cifras inventadas de `policia-nacional`. **Cuando suba la cobertura de documentos de tipo `convocatoria`, `landing_cifra_sin_respaldo` se puede promover a nocturno sin tocar el núcleo.**

**Matiz que el sistema ya conoce (y que evita que dos detectores se peleen):** los temas del **programa oficial** y los que **servimos** pueden diferir legítimamente si añadimos contenido de apoyo (Policía Nacional: 45 del Anexo I + un bloque de inglés para el requisito A2). Por eso `temas_card` **ignora las tarjetas que dicen "programa/oficial"** y el núcleo de afirmaciones las trata como concepto aparte (`temas_programa`), que es el único que se contrasta contra el boletín.

## Cobertura de la landing: qué ve el opositor ↔ quién lo vigila

**Dónde:** `lib/admin/landingSurfaces.ts` (fuente única) · panel `/admin/salud-sistema` → *"Cobertura de la landing"*, junto a la guía de runbooks · guardarraíl `__tests__/guardrails/landingSurfaces.guardrail.test.ts`.

**Para qué:** la guía de runbooks contesta *"tengo un hallazgo, ¿qué hago?"*. Este inventario contesta la pregunta que antes no tenía sitio — **"¿qué parte de la landing NO está vigilada por nadie?"**. Los detectores se fueron añadiendo de uno en uno, cada uno tras su incidente, así que un hueco solo se descubría cuando un usuario se caía por él (26/07: el botón *"Ver convocatoria en BOE"* llevaba al portal de aspirantes **en inglés** con el plazo abierto, y los tres detectores de enlaces daban verde).

**El guardarraíl (CI, sin BD ni red) exige, en las dos direcciones:**
- cada superficie nombra **marcadores que existen** en `app/[oposicion]/page.tsx` — si la página deja de pintar algo o se renombra, el inventario deja de ser ficción;
- cada `kind` citado **existe** en `runbookRegistry`;
- una superficie **sin detector declara su hueco** con motivo (y su tarea `T-NNN`, que debe existir en el backlog);
- **a la inversa:** todo kind de landing/convocatoria/seguimiento está **asignado** a una superficie → un detector nuevo obliga a decir qué vigila.

**Huecos declarados hoy** (visibles en el panel, no enterrados en el código): el **badge del hero** (nadie compara *"CONVOCATORIA PUBLICADA"* con el `estado_proceso` real), las **etiquetas compuestas** de `diario_oficial` (*"BOP Córdoba"*: el registro de boletines solo entiende códigos simples, y marcarlas daría falsos positivos en BOP legítimos), y **`landing_description` + `seo_description`, que `landing_incompleta` exige pero la landing NO sirve** (medido 26/07 al montar el inventario) → antes de rellenar más descripciones hay que decidir si se cablean o si el detector deja de pedirlas ([T-128]).

## GOTCHAS

- **PDF escaneado que WebFetch/agente no leen** (p. ej. BOPA): WebFetch lo guarda a fichero → `pdftotext -layout <fichero>` extrae el texto (así se cerró el desglose de asturias, 10/07).
- **Epígrafes importados de un PDF arrastran la cabecera y el pie del boletín, a veces EN MEDIO de la frase** (27/07). En `ordenanza-ayuntamiento-cordoba` el T8 decía *"…Medidas preventivas y pautas de **de la Provincia Este documento es una copia electrónica… Fima automática 2F177891AA88… Nº 99 p. 7474** actuación ante incendios…"* y el T10 se llevaba puesto el pie de firma entero. Rompe la verificación de literalidad y envenena cualquier adjudicación epígrafe↔scope, porque el texto que se compara no es el del programa. Barrido para localizarlos (4 en todo el catálogo, 2 falsos positivos por *"Depósito legal"* como materia real):
  ```sql
  SELECT position_type, topic_number, left(epigrafe,120) FROM topics
   WHERE epigrafe ~* '(Fima autom|copia electrónica de un documento|Código Seguro de Verificación|Powered by TCPDF|Boletín Oficial de la Provincia|Lo que se hace público|Nº ?[0-9]+ p\. ?[0-9]+)';
  ```
  Arreglo: reescribir con el texto **literal** del anexo oficial (no recortar a ojo: el corte puede estar en mitad de una frase). Ojo, el epígrafe es lo que hashea la verificación de scope → al tocarlo se invalida sola, que es lo correcto.
- **Alias en mayúscula:** pg pasa `SELECT plazas_libres L` a `row.l` (minúscula) — leer `row.plazas_libres`, no `row.L`.
- **La imagen ECS poda postgres-js** → el sweep usa `pg` (node-postgres), presente en la imagen. NO usar `postgres`/postgres-js en scripts que corran en la imagen.
- **Reusar la imagen del frontend** para el sweep acopla: cambiar el script exige re-deploy del frontend.

Detalle de diseño y de las 3 capas de detección: memoria `project_deteccion_oposiciones_3capas`.

## Enunciado que cita una norma sin nombrarla (`enunciado_norma_sin_nombrar`)

**Frase-gatillo:** *"revisa los enunciados sin norma"*.

*"Según el artículo 75 **de la ley**, ¿cuál es el contenido mínimo…?"* — fuera del test no hay forma
de saber de qué norma habla. Incumple la **§2.2-quater** del manual de generación: *cada pregunta
debe ser AUTOCONTENIDA*, porque los tests salen barajados y sueltos.

**El punto ciego que cierra.** Esa regla ya tenía vigilada la mitad de las siglas
(`lib/generacion/siglasSinDesarrollar.js`, «IGIC» a pelo) **pero solo al GENERAR**: nadie la barría
sobre el banco vivo, así que lo anterior a la regla no lo miraba nadie. Y las dos mitades nacen
igual, de una impugnación: el gate de siglas de la de Laura García (02/07, «LBRL»), este de la de
Esther Lázaro (29/07, `6ed11712`): *«Porque no indica a qué normativa se refiere»*.

**Medido el 29/07** sobre 139.464 activas: **274**, 443 exposiciones, **0 de examen oficial**, y 270
salen de 6 leyes (198 de un mismo lote de Extremadura). No es ruido disperso: es una remesa de
generación que escribió el enunciado como si el lector ya supiera de qué norma se habla.

**Cómo se repara.** El dato ya está en casa —la pregunta cuelga de un artículo y ese artículo tiene
su ley—, así que la sustitución es determinista y no inventa nada:

```bash
npm run enunciados:sin-norma                             # informe por ley (no toca nada)
npm run enunciados:sin-norma -- --ley "Ley 9/2017"       # antes/después de esa ley
npm run enunciados:sin-norma -- --ley "Ley 9/2017" --apply
```

Se va **por ley**, no pregunta a pregunta: dentro de una ley el arreglo es idéntico y el nombre que
se inserta hay que leerlo una vez. La herramienta **salta siempre las de examen OFICIAL** (ahí el
enunciado es el que salió publicado) y solo toca el enunciado — nunca opciones, clave ni explicación.
Tras sustituir, comprueba con el propio detector que la pregunta deja de estar marcada; si seguiría
marcada, la deja para revisión humana en vez de escribir media reparación.

> ⚠️ Dos trampas que enseñó el piloto sobre la Ley 13/2015, antes de tocar una fila: sin concordancia
> de género salía *«de la Decreto 225/2014»*, y sin la condición de cierre la sustitución mordía el
> «Ley» de *«de la **Ley** 13/2015»* y escribía *«Ley 13/2015 13/2015»*. Las dos están fijadas en
> `__tests__/health/repararEnunciadoSinNorma.test.ts`.

## La cita del blockquote no está en el artículo (`cita_no_literal`)

**Frase-gatillo:** *"revisa las citas"*.

La explicación presenta como **cita literal** algo que el artículo vinculado no dice. Cada hallazgo
es una de dos cosas, y las dos son defecto:

- **Cita inventada o parafraseada** — el caso típico es un resumen con paréntesis vendido como texto
  de la ley: *«La oferta se presentará en un único sobre (cuando no haya criterios evaluables
  mediante juicio de valor) o en dos sobres (cuando sí los haya)»*.
- **Pregunta mal vinculada** — la cita es correcta, pero de otro artículo.

**Por qué importa más de lo que parece:** el **43 %** de lo impugnado y aceptado tiene la cita no
literal, frente al 30,7 % del banco (medido en [T-207]). Y no llega como queja `no_literal`, sino
como `otro`, `tema_incorrecto` o `respuesta_incorrecta`: **la cita rota es un marcador de pregunta
enferma**, no un defecto de estilo.

```bash
npm run citas:barrido                      # informe con desglose por gravedad
npm run citas:barrido -- --out hallazgos.json
npm run citas:barrido -- --incluir-elipsis # las que llevan «…», no concluyentes
```

**Solo se reportan las AJENAS** (solape <0,5: el artículo no habla de eso). Las *retocadas* —el
artículo dice lo mismo y la cita solo está reformateada— son la inmensa mayoría (904 de 1.032 el
29/07) y **no son defecto**: incluirlas dejaría el badge gritando todas las noches, que es como se
consigue que se deje de mirar.

**Medido el 29/07:** 44.370 explicaciones con blockquote · 17.470 pretenden ser cita literal · 1.032
no lo son · **15 AJENAS, 8 de ellas ya vistas por usuarios**. La cifra de 13.424 que arrastraba
[T-207] es de un criterio anterior y quedó desfasada tras la campaña de julio.

**Cómo se atiende cada una:** leer el artículo **contra el BOE**, no contra nuestra copia (puede ser
la copia la que esté incompleta). Después decidir si se corrige la cita o se re-vincula el artículo
— y si se re-vincula, comprobar antes el impacto de colocación, porque el artículo decide en qué
tema aparece la pregunta. La explicación se reescribe con `scripts/aplicar-explicacion.ts` y se pasa
por `validar-explicacion.cjs`, que aplica **el mismo criterio** que produjo el hallazgo. NUNCA
auto-corregir la clave ni dar por buena una cita porque «suene» al artículo.

> ⚠️ Este hallazgo **no lo refresca el `@Cron` nocturno**: compara la cita contra el texto del
> artículo fila a fila, así que se emite desde el CLI (`barrido-citas.cjs --json`). Un cero en el
> badge significa «nadie ha corrido el barrido», no «no hay ninguna».

## La explicación se PINTA rota (`explicacion_estructura_rota`)

*Frase-gatillo: **"revisa las explicaciones descuadradas"***

**No confundir con *"revisa las explicaciones rotas"*** (`audit_note_explanation`). Aquella es de
FONDO: el campo trae la nota de un pase de IA en lugar de una explicación, y el opositor no recibe
ninguna explicación. Esta es de FORMA: la explicación es correcta y está bien razonada, pero se
renderiza mal. Se arreglan distinto y por eso son dos kinds.

### Qué es

Desde la Fase 2 de T-080, producción **no sirve la columna `explanation`**: compone el texto desde
`explanation_data` con `renderStructuredExplanation`, asignando las letras al orden realmente
servido. Consecuencia directa: **un campo mal formado en la estructura sale a pantalla tal cual**, y
mirar la columna `explanation` no lo delata (es el resultado del mismo render).

La avería dominante es un `**` **sin pareja** en la razón de una opción. Viene de la transcripción
del histórico: el texto original decía `- **A) Insertar** — El menú Insertar…`, la transcripción se
quedó con la parte de detrás de la letra (`Insertar** — El menú Insertar…`) y el `**` de apertura se
fue con la etiqueta. El render antepone su propio `- **A)** `, así que el usuario lee:

> - **A)** Insertar** — El menú Insertar permite añadir celdas…

**Medido el 29/07/2026: 163 preguntas activas · 7.989 exposiciones acumuladas** (2,6% de las 6.335
con explicación estructurada).

### Cómo se destapó (y por qué no lo veía nadie)

Salió de la auditoría posterior a la poda de narrativas del 29/07: cinco agentes revisaron las 115
preguntas que se acababan de tocar y señalaron «asteriscos huérfanos» en 11. Al comparar contra el
backup resultó que **ya venían rotas** — la reparación no las había causado. Ningún detector miraba
la estructura: los que había (`audit_note_explanation`, el cubo de apelotonadas,
`shuffle_safe_regressed`) razonan sobre el TEXTO.

### Cómo se repara

La razón debe explicar **por qué falla esa opción**, no repetir lo que la opción ya dice. Así que la
reparación no es "cerrar el asterisco": es quitar la repetición del enunciado, que es lo que sobra.

```
- ANTES: "Con un reproductor de CD o con un reproductor de DVD** — Solo menciona uno de los dos metodos…"
- DESPUÉS: "Solo menciona uno de los dos métodos (reproductor de CD o de DVD) y omite la opción de unidad flash USB."
```

Reescribe con `npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts <id> <fichero.json> --apply`,
que deja estructura y texto coherentes por construcción. **NUNCA toques la clave ni las opciones:**
esto no es un defecto de contenido, y una pregunta puede estar aquí siendo jurídicamente impecable.

### GOTCHAS

- **`cita.bloque` MANDA sobre `ref`/`texto` en el render.** Si está relleno, la cita se pinta entera
  y no hay defecto que denunciar. Sin esa guarda, la rama de la cita dispara **1.412 falsos
  positivos** de golpe — fue la primera medición de esta clase y era falsa entera.
- **Al corregir una cita, corrige también el `bloque`.** Cambiar solo `ref` no se ve: el render usa
  el `bloque`. Pasó al reparar `1ddf9e87` y `1332862d` el 29/07.
- El detector **no** mira `cita.ref` para la negrita: una referencia no es prosa.

### Piezas

| Qué | Dónde |
|---|---|
| Núcleo puro (19 tests) | `lib/health/explicacionEstructuraRota.cjs` |
| Barrido CLI | `scripts/health-sweep.cjs` (kind `explicacion_estructura_rota`) |
| Espejo del `@Cron` (writer real) | `backend/src/content-health-sweep/content-health-sweep.service.ts` |
| Guardarraíles | `__tests__/health/explicacionEstructuraRota.test.ts`, `content-sweep-parity.test.ts` |
| El render que lo convierte en lo que se ve | `lib/shuffle/structuredExplanation.ts` |

## Pregunta colgada del artículo equivocado, con el vecino al lado (`vinculo_articulo_vecino`)

*Frase-gatillo: **"revisa los vínculos al artículo vecino"*** · `npm run audit:vinculo-vecino`

### Qué es

Del modelo nuclear: la pregunta cuelga de un artículo y **ese artículo es la fuente de verdad de su
contenido**. Si el artículo vinculado no dice lo que la pregunta pregunta, se rompen dos cosas a la
vez: quien abre el artículo desde la pregunta no encuentra la respuesta, y la pregunta se sirve en
los temas que escopan el artículo equivocado.

Caso raíz (29/07/2026): una pregunta sobre los objetivos de la Corporación RTVE colgaba del
**artículo 36** de la LO 3/2007 (deber genérico de los medios públicos) cuando su contenido es del
**37**. La cazó un usuario en una impugnación, no nosotros.

### ⚠️ Es una COLA DE SOSPECHAS, no una lista de arreglos

**Precisión medida ≈ 1 de cada 3.** Por eso es un runner bajo demanda y **no pinga el badge**: un
detector que acierta un tercio en el panel enseña a ignorar el panel.

Las dos exclusiones que ya lleva dentro (y que hay que respetar si alguien toca el núcleo):

| Se descarta | Por qué |
|---|---|
| Enunciados de NEGACIÓN («señale la INCORRECTA», «excepto», «¿cuál NO es?») | El desajuste es **por diseño**: la respuesta correcta cita otro artículo a propósito, porque es la que no encaja. Ejemplo real: una pregunta sobre partidos políticos cuya respuesta correcta es el texto de los **sindicatos** (art. 7 CE) — el vínculo al art. 6 es el BUENO. Eran 122 de 326. |
| Meta-opciones («Todas son correctas», «A) y B)») | No tienen contenido propio, así que su recall contra cualquier artículo es cero y no dice nada. |

Y aun con las dos, siguen colándose preguntas que **abarcan varios artículos a la vez** («¿en qué
sección de la Constitución se reconoce el derecho de huelga?»): ahí el vínculo actual suele ser tan
defendible como el sugerido.

### Cómo se triaje

1. `npm run audit:vinculo-vecino` (o `-- --ley "CE"`, `-- --min-servidas 50`, `-- --json`).
2. Para cada sospecha: abrir **el artículo vinculado y el sugerido en el BOE** y ver cuál responde
   LITERALMENTE la opción correcta.
3. Solo entonces re-vincular `primary_article_id`. **Antes de aplicar, comprobar que el artículo
   destino está escopado en los mismos temas**, o la pregunta cambia de sitio sin querer. En el caso
   raíz, el 36 y el 37 estaban los dos en el T4 de Córdoba, así que la pregunta no se movió.
4. Registrar el cambio como evento observable (`pregunta_relinkada`) con el motivo.

**NUNCA re-vincular por cercanía de número.**

### Piezas

| Qué | Dónde |
|---|---|
| Núcleo puro (17 tests) | `lib/health/vinculoArticuloVecino.cjs` |
| Runner bajo demanda | `scripts/audit-vinculo-articulo-vecino.cjs` · `npm run audit:vinculo-vecino` |
| Registro | `lib/admin/runbookRegistry.ts` → `vinculo_articulo_vecino` |
