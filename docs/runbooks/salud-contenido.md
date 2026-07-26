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

7. **`convocatoria_enlace_no_boletin`** (*"revisa los enlaces de convocatoria"*, misma frase que los otros dos detectores de enlace): el botón oficial de la landing dice **"Ver convocatoria en {diario_oficial}"** y el `programa_url` **no es de NINGÚN boletín**. Es el tercer detector de la misma tarjeta y tapa el hueco que dejaban los otros dos: `convocatoria_link_mismatch` compara dos ids `BOE-…` y `convocatoria_etiqueta_boletin` compara dos boletines — **los dos necesitan reconocer un boletín en la URL para poder hablar**, así que un portal institucional los dejaba mudos a los tres. Caso raíz 26/07 (T-134): **`policia-nacional`**, con plazo ABIERTO, prometía el BOE y llevaba a `policia.es/portalaspirantes/**en**/web/escala-basica-ejecutiva` — ni BOE, ni convocatoria, ni español; se descubrió al preparar su newsletter, no por el sistema. Medido ese día: **56 de 123 landings activas** estaban en esa zona muerta.
   - **Bandas:** `error` = hay **convocatoria publicada** (`estado_proceso` con ficha viva: publicada/convocada/inscripción/admitidos/pendiente examen → existe un documento oficial que enlazar) y el enlace es una **portada/sección de portal** o está **en otro idioma**. `warn` = aún no hay convocatoria (OEP aprobada, sin OEP, proceso ya cerrado) —ahí la página institucional puede ser lo mejor disponible y lo que suele fallar es la **etiqueta**— o el enlace es un **TEMARIO**.
   - **Lo que NO se marca, a propósito:** que la entidad publique las bases **en su propia sede** (un PDF, una ficha con id) es legítimo y frecuente; marcarlo sería la bandeja ruidosa que ya hubo que retirar (T-047). El detector solo habla cuando la URL **ni siquiera puede ser un documento**.
   - **El caso TEMARIO es una decisión de diseño, no un typo:** `programa_url` sirve a **dos contratos** —es el programa/temario oficial que hashea el Sistema 2 de literalidad de epígrafe (`programa_last_hash`) **y** el enlace del botón de convocatoria—. En Andalucía, CLM, SESCAM y Guardia Civil apunta a un temario: **correcto como `programa_url`, engañoso bajo "Ver convocatoria"**. Por eso queda en `warn` y no bloquea el gate: repuntarlo a ciegas rompería la otra superficie.
   - **Cómo arreglar:** busca el documento oficial de la convocatoria en su boletín, **ábrelo y confirma que es esa convocatoria**, y repunta `programa_url` con **dual-write** (`oposiciones` **y** la convocatoria vigente, que es de donde lee la landing) + purga de caché repetida (es per-instancia). Si de verdad no hay documento, la honesta es la otra: cambia `diario_oficial` a lo que el enlace es en realidad y deja el boletín de las bases en `diario_referencia`. **NUNCA repuntar sin abrir el documento.**
   - **Antes de tocar nada, simula:** `node scripts/convocatoria/sim-enlace-boletin.cjs` (no escribe nada; `--limpias` enseña también las que pasan, `--json` para tuberías). El registro de boletines que decide todo esto es compartido: `lib/convocatoria/canonicalizeBoletinUrl.cjs` (`PATTERNS` = identidad del documento, `BOLETIN_HOSTS` = dominio). **Añadir un boletín = una fila ahí y su espejo en el backend @Cron** (`content-sweep-parity` compara las dos tablas por valor y falla si divergen).

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
- **Alias en mayúscula:** pg pasa `SELECT plazas_libres L` a `row.l` (minúscula) — leer `row.plazas_libres`, no `row.L`.
- **La imagen ECS poda postgres-js** → el sweep usa `pg` (node-postgres), presente en la imagen. NO usar `postgres`/postgres-js en scripts que corran en la imagen.
- **Reusar la imagen del frontend** para el sweep acopla: cambiar el script exige re-deploy del frontend.

Detalle de diseño y de las 3 capas de detección: memoria `project_deteccion_oposiciones_3capas`.
