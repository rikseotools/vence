# Campaña "citas ajenas" — mislinks detectados por barrido de citas (16-17/07/2026)

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

## PENDIENTE — decisiones humanas (27, no auto-aplicar)
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

## Subproductos descubiertos (frentes aparte, no de esta campaña)
1. **33 artículos con contenido truncado** en toda la BD (empiezan por un apartado >1), **70 preguntas
   visibles** afectadas. Focos: Decreto 7/2013 CyL, Decreto 13/2021 CyL, Instituciones Internacionales GC.
   Query: los artículos cuyo `content` arranca en un nº de apartado >1 (ver barrido en el hilo).
2. **Bug de vínculo por nº de artículo sin `law_id`** (causa raíz arriba) — merece detector propio y barato:
   preguntas cuya explicación nombra una ley/artículo distinto del vinculado. Mide el tamaño real (los
   139 son solo los que tenían cita).
3. **Falso positivo del guardarraíl** `validar-explicacion.cjs`: el filtro "Truco/Consejo/Tip" saltaba con
   "Consejo Consultivo"/"Consejo Nacional…". **CORREGIDO** (17/07): solo salta como etiqueta (`palabra:` o negrita a solas).
