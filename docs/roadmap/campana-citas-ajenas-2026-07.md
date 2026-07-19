# Campaña "citas ajenas" — mislinks detectados por barrido de citas (16-17/07/2026)

## PASADA 19/07 — drenaje needs_human COMPLETADO (23/23; 0 quedan en needs_human)
Resultado final: **22 a visible** (21 approved + 1 tech_approved) + **1 retirada** (`6bf9caae`, ley derogada). Todo verificado contra fuente oficial (BOE/BOCyL), **0 flips de clave** (2 claves que un verificador previo proponía cambiar —`514c0c65`→A y el cluster CES— resultaron correctas al leer el texto consolidado). Herramienta nueva durable: `scripts/impugnaciones/aplicar-needs-human.cjs` (re-vínculo + explicación validada con `validar-explicacion.cjs` + marca AVR fix_applied + transición lifecycle canónica en una pasada; nunca toca correct_option).
- **Imports verbatim nuevos (fuente oficial):** CES CyL arts 9/12 + art.4 actualizado (BOE-A-1991-2826); Ley 2/2016 CM art.1 Definiciones (BOE-A-2016-6728); Decreto 12/2024 Servicio 012 arts 2/5/7 (BOCYL-D-28062024-1). Editoriales: enriquecido Word 365 art.1 (comodines < >), TCAE "Atención Primaria" (EAP, RD 137/1984), y creados arts editoriales "Valores del documento de archivo" y ley "Formas de la actividad administrativa" (autorización).
- **Scope añadido (epígrafe manda):** Ley 2/2016→aux_madrid (+art.1); Decreto 12/2024→2 temas CyL cuyo epígrafe nombra "Servicio de Atención al Ciudadano 012"; ley editorial autorización→administrativo_estado.
- **Salvamentos con matiz:** `da8231b5` LEC 728→529 (caución en 529.3, mismo temario); `80a7a71e` se mantuvo en TFUE 301 (Decisión 2019/853 fuera de temario) explicando España=21; `81ddc4bc` mantenida en art.1 Orden con contexto CORA (dato de preámbulo); `a9579e00` RD67/2010 art.2→art.1 Objeto.
- **Decisiones Manuel (caso a caso):** `6bf9caae` retirar (Ley 15/1999 derogada); `2fe7c245` crear editorial + salvar; `81ddc4bc` salvar con contexto.
- Traza: AVR `fix_applied=true` + `question_lifecycle_history`. **PEND:** invalidar caché (tag questions) + regenerar embeddings (articles `embedding_stale=true`).

### ~~ESTADO needs_human previo~~ (RESUELTO por la pasada de arriba — histórico)
- **RESUELTAS (→approved, 15):**
  - Re-explicación (art OK): `ffc5ed3b`(LO3/2007 art.14, cita inventada 14.12 → B es texto del art.24), `42a032bc`(LO1/2004 art.29 ya vinculado; aclarado nombre órgano vigente).
  - Relink a art existente: `48cb3ed0`(Preámbulo CE→art.9), `b580147c`(→LAP art.11), `0a7bd51e`(→Decreto 13/2021 art.18), `da8231b5`(LEC 728→529, caución en 529.3).
  - Cluster **CES CyL** (BOE-A-1991-2826 consolidado Ley 4/2013): `3ce5c259`(art.4 actualizado stale→36 miembros/4 expertos Junta), `514c0c65`(import art.9; D incorrecta='anteproyecto' vs 'proyecto' de Reglamento — el AVR proponía A, ERRÓNEO), `83124c1f`(import art.12), `4b59d812`(→art.13; B incorrecta='Realizar' vs 'Ordenar' publicación).
  - **Ley 2/2016 CM** (import art.1 Definiciones verbatim BOE-A-2016-6728 + '1' al scope aux_madrid): `e5aac807`(intersexualidad 1.3), `379248ad`(victimización secundaria 1.11).
  - **Decreto 12/2024 Servicio 012** (import arts 2/5/7 verbatim BOCYL-D-28062024-1 + Decreto añadido al scope de 2 temas CyL cuyo epígrafe nombra "Servicio de Atención al Ciudadano 012"): `dc94fdbb`(ámbito=art.2, NO art.3), `ad90385d`(art.5.4), `5027abde`(art.7).
- **PENDIENTE tras esta pasada (8):**
  - **Editorial/enriquecer (3):** `86a225d8`(TCAE: EAP, falta RD 137/1984 art.4 o enriquecer editorial), `03b01d9e`(Word 365 comodines < >, enriquecer art.1), `e9416316`(archivística: valores primarios/secundarios, editorial).
  - **Decisión Manuel — sin precepto ancla / régimen obsoleto (5):** `2fe7c245`(autorización, doctrinal García de Enterría, sin precepto), `81ddc4bc`(CORA propuso PAG — dato en PREÁMBULO Orden HAP/1949/2014), `a9579e00`(RD 67/2010 objeto global, PREÁMBULO), `80a7a71e`(CESE 21 escaños España, Decisión UE 2019/853 no en BD), `6bf9caae`(ficheros FFCCS: Ley 15/1999 art.22 DEROGADA íntegra por LO 3/2018 — régimen obsoleto, mislinkeada a LO3/2018 art.22=videovigilancia). Retirar vs mantener needs_human.

## ESTADO needs_human tras pasada 18-19/07 (para retomar)
Se procesaron por cubos las ~29 preguntas que quedaron en `needs_human`. **Lo mecánico está cerrado; falta trabajo de contenido.**
- **RESUELTO (a visible)**: huérfanos re-vinculados al artículo que responde (§3.1, verificado): `36c79015`(Decreto 24/2022 CyL art8), `07ab258c`(RGPD art5), `9d451ce9`/`200a0d1e`/`8667f512`(CP 513/537/428), `df5aeb28`(RP art12 — falso positivo), `89449dbd`(Ley 11/1986 CM art2, explicación reescrita) · adjudicados: `e105ee19`, `b72000de`, `e47141d1`(cita art9→11).
- **RETIRADO**: `e85ff2ca` (ET art48 prestación nacimiento: RDL 9/2025 = 19 semanas, ninguna opción correcta → retired_irreparable).
- **PENDIENTE (contenido/decisión, siguen en needs_human)**:
  - Retirar (decisión Manuel): `48cb3ed0`(CE "fuente directa", doctrinal sin precepto), `80a7a71e`(21 escaños CESE post-Brexit, fuente Decisión UE 2019/853 no en BD).
  - Actualizar/recomponer artículo verbatim contra fuente oficial (NO parafrasear): `3ce5c259`(CES CyL art4 desactualizado: verificado que vigente=4 expertos Junta+2 Cortes por Ley 4/2013), `514c0c65`+`4b59d812`(CES CyL: clave mal + art10 truncado/art9 ausente — competencias Pleno / funciones Presidente), `da8231b5`(caución medidas cautelares: LEC art529 en BD es otro tema/truncado).
  - Cubo **sin_norma (8)** y **reparación (5)**: no abiertos — necesitan importar norma ausente o recomponer artículo incompleto. IDs recuperables de RDS.
- **Fuente durable**: diagnósticos en `ai_verification_results` proveedores `claude_code_citas_2026_07` + `claude_code_mislink_ley_2026_07`; transiciones en `question_lifecycle_history`.
- **⚠️ COORDINAR con la otra sesión antes de seguir**: su "cubo 3 (vínculo de ley equivocado)" + subsistema `lib/laws/completeness.ts` solapan con esto. Reconciliar inventarios para no duplicar.


**Origen:** al atender la impugnación de Fvital (pregunta de Correos colgada del TREBEP) y la de Iván
(Manual del MAP colgado del art. 26 Ley 39/2015) se vio un patrón: explicaciones que **citan un
artículo que no es el que la pregunta tiene vinculado**. Se scriptó un detector y se barrió el banco.

## Herramientas (durables, en el repo)
- `scripts/impugnaciones/barrido-citas.cjs` — caza explicaciones cuya cita entrecomillada NO aparece
  en el artículo vinculado; clasifica por solape de vocabulario en `ajena` (<0.5, defecto grave) /
  `dudosa` / `retocada` (≥0.8, solo estilo). Flags `--out`, `--incluir-elipsis`.
- `scripts/impugnaciones/ingesta-verificacion-citas.cjs` — vuelca veredictos a `ai_verification_results`
  con proveedor de campaña (NUNCA `claude_code`: machacaría la traza previa, §5.1) + `review_method_version`.

## Método (v2.1 del manual `revisar-preguntas-con-agente.md`)
Barrido → 688 no literales, familia **AJENA = 139**. Verificación (7 agentes Sonnet) → auditoría CIEGA
independiente (5 agentes) → adjudicación por cruce de las dos pasadas. Diagnósticos en RDS:
`SELECT * FROM ai_verification_results WHERE ai_provider='claude_code_citas_2026_07'` (139 filas).

## HECHO y verificado en producción (63 preguntas)
- **45 re-vínculos** de `primary_article_id` (clave intacta, ninguna sale de su temario — verificado
  contra `topic_scope`). `fix_applied=true` en AVR.
- **18 explicaciones reescritas** (las que tras re-vincular seguían citando el artículo viejo + citas
  inventadas), todas revalidadas con `validar-explicacion.cjs`. Re-verificación post-aplicación: 45/45 coherentes.
- Cache invalidada (`tag: questions`, v180).

## Causa raíz (probada por 3 vías independientes)
Un vinculador emparejó preguntas por **número de artículo sin cruzar `law_id`**: art. 133 CP donde
iba 133 CE, RDL 1/2013 estatal sobre "Ley 2/2013 CyL", leyes de 3 organismos distintos de CyL
cruzadas. En casi todos la explicación YA citaba la ley correcta → el fallo vive solo en `primary_article_id`.
**El barrido de citas solo caza los mislinks que tienen cita en la explicación; el bug es más amplio.**

## ~~PENDIENTE — decisiones humanas (27, no auto-aplicar)~~ — TODAS RESUELTAS (19/07)
> Las 27 (y las 23 de `needs_human`) quedaron resueltas entre la pasada 18-19/07 y la del 19/07 (ver sección "PASADA 19/07 … COMPLETADO" arriba). Estado global de la campaña: 176 diagnosticadas → 0 pendientes (161 approved + 14 tech_approved + 1 retirada). Lo de abajo es histórico.

Recuperables de AVR (arriba). Por cubo:

### Clave posiblemente errónea (1) — NUNCA tocar sin verificación humana
- `514c0c65` Ley 13/1990 CES CyL: actual=D, un verificador propone A ("Funcionamiento del Pleno").

### Huérfanos de temario (6) — relink correcto los sacaría del `topic_scope`
- `89449dbd`→Ley 11/1986 CM art 2 · `df5aeb28`→LOGP art 8 · `4b59d812`→Ley 13/1990 CES CyL art 13
  (además clave dudosa) · `07ab258c`→RGPD art 5 · `36c79015`→Decreto 24/2022 CyL art 8 · `6bf9caae`→LO 15/1999 art 22.
- Decidir por cada una si además se amplía el `topic_scope` de la oposición.

### Adjudicar (7) — las dos pasadas discreparon
- `48cb3ed0` (CE art 9.1, doctrinal sin precepto único) · `da8231b5` (LEC 728→529.3) ·
  `b72000de` (TREBEP art 53.5) · `80a7a71e` (Decisión UE 2019/853, no en BD) ·
  `3ce5c259` (Ley 13/1990 CyL art 4 consolidado — contenido BD pre-reforma 2013) ·
  `e105ee19` (artículo OK, matiz de explicación) · `e47141d1` (Decreto 7/2016 CyL art 11.4, no art 9).

### Sin norma / artículo en BD (8) — falta importar
- `b580147c` Ley 41/2002 art 11 · `83124c1f` Ley 13/1990 CyL art 12 · `e9416316` (archivos estatales) ·
  `86a225d8` RD 137/1984 art 4 · `e5aac807` Ley 2/2016 CM art 1 · `dc94fdbb`/`5027abde`/`ad90385d`
  Decreto 12/2024 CyL (Servicio 012) arts 2/7/5 (solo importados arts 3,8,9,14).

### needs_human de reparación (5) — mislink más profundo o artículo incompleto
- `03b01d9e` (Word 365 art 1, sección comodines incompleta) · `42a032bc` (LO 1/2004 art 29: opción C
  usa nombre derogado del órgano) · `379248ad` (mislink de LEY: Ley 3/2016→Ley 2/2016 CM art 1) ·
  `ffc5ed3b` (LO 3/2007 art 14 incompleto en BD) · `0a7bd51e` (Ley 2/2010 CyL: art 48 no define lo pedido).

## Detector de mislink por ley (2ª campaña, causa raíz) — HECHO
`scripts/impugnaciones/barrido-mislink-ley.cjs --precision`: mira la LEY que la explicación nombra vs
la vinculada; modo precisión exige colisión mismo-nº-otra-ley (LECrim art 6 ↔ CP art 6). Bruto 1.291 →
49 alta precisión → pipeline v2.1 → **16 re-vínculos aplicados y verificados** (cluster LECrim→CP + CP116→CE).
Los defectuosos no aplicables (huérfanos de scope, sin norma, clave dudosa) → `needs_human` (`ai_detected_wrong_article`).
Diagnósticos en RDS `ai_verification_results` proveedor `claude_code_mislink_ley_2026_07`.
PEND: cruzar con el "cubo 3 (vínculo de ley equivocado)" y el subsistema `lib/laws/completeness.ts` de la otra sesión (solapan).

## Barrido fresco de truncados/basura de import (19/07) — 2 clusters grandes HECHOS
Detector inline: arts con `article_number` numérico puro cuyo contenido arranca en apartado > 1 (alta tasa de falsos positivos = normas con numeración "artículo.apartado", p.ej. art.21→"21.1" es correcto). Defectos REALES arreglados (todo verificado, nada inventado):
- **VIII Convenio Colectivo PL Aragón (8 arts: 2,18,30,41,54,82,107,116)**: número de maquetación del BOA ("20291"…) pegado antes del texto → strip mecánico.
- **Normas Matrícula UMU 2026/2027 (~27 arts)**: (a) **25 arts** con marca de agua del PDF incrustada ("Esta es una copia auténtica imprimible… sede.um.es/validador/") → eliminada; (b) **4 arts con apartados descolocados entre fronteras**, recompuestos contra fuente oficial (um.es/normas): art.29 Reconocimiento (ap.1-4) ↔ art.30 Transferencia (ap.1-6); art.18 Anulación a petición (ap.1-4) ↔ art.19 Anulación por impago (ap.1-7).
- **Decreto 152/2005 Cantabria art.7**: prefijo basura "3 " antes de "1." → limpiado.
- Embeddings regenerados + caché teoria/temario invalidada en cada caso.
**PENDIENTE (teoría-only o estructural, menor ROI):**
- `Decreto 255/1997` (Estatutos Osakidetza) arts **11, 12, 16** importados en **euskera** en vez de castellano (0 preguntas colgando → solo teoría). Necesita texto castellano del BOPV.
- `Instrucción Detención Policial 2` art.9 = FALSO POSITIVO (título "Artículo 9.2", split editorial intencional).
- `Instituciones Internacionales GC` — **títulos corregidos (19/07)**: era mucho más que "4 normas": es un compendio EDITORIAL (virtual) de ~6 normas (Carta ONU, Estatuto INTERPOL, Estatuto Consejo de Europa, Reglamentos UE CEPOL 2015/2219, Europol 2016/794, Frontex 2019/1896), **40 artículos, 982 preguntas** (827 en el contenedor art.0), en guardia_civil + policia_nacional. Corregidos 5 títulos mal atribuidos (art.3 INTERPOL→CEPOL, art.4 CEPOL→Europol, art.6 Frontex→CEPOL, art.7 CEPOL→ONU, art.18 ONU→CEPOL); los números de artículo YA casan con la norma real (solo la etiqueta de norma en el título estaba mal). El **split físico** (crear 6 leyes reales, mover 40 arts, re-scopear, re-vincular 982 preguntas + tratar el contenedor art.0) queda como **PROYECTO GRANDE aparte** (alto riesgo: 2 oposiciones top) — NO hacer sin plan propio.

## Artículos truncados — HECHO (19 recompuestos y vivos)
De los "33 truncados" del backlog, **solo 19 eran truncamiento legal real** (43 preguntas); los otros 14 eran
preámbulo troceado (pseudo-arts `exp/EXP`) y editorial por secciones (manual app PIAE Valencia, Manual
Penitenciario) — NO truncamiento. Los 19 recompuestos contra fuente oficial (BOCyL, BOC, Carta ONU + Reglamentos
UE, resolución UMU), continuidad re-verificada (texto viejo ⊆ nuevo, ≥90% vocab) antes de aplicar; caché
teoria+temario invalidada.
**Hallazgos estructurales pendientes (necesitan decisión):**
- La "ley" `Instituciones Internacionales GC` mezcla 4 normas (Carta ONU + Reglamentos UE CEPOL/Europol/Frontex);
  `title` mal atribuidos (uno decía Frontex, era CEPOL). Separar en las leyes reales.
- `Normas Matrícula UMU` art. 32 no estaba truncado: tenía pegado por delante un párrafo del art. 31 (bug de
  límites de import). Limpiado. Revisar el art. 31 por si le falta ese párrafo al final.
- `Instrumentos internacionales` y demás editoriales: el detector `content` arranca-en-apartado->1 sobre-reporta
  (preámbulos y manuales por secciones) → filtrar por `article_number` numérico puro.

## Otros subproductos
- **Falso positivo del guardarraíl** `validar-explicacion.cjs` ("Truco/Consejo/Tip" saltaba con "Consejo
  Consultivo"): **ya corregido en origin/main** por otra sesión (mejor que mi parche) — no re-pushear.
