### [T-694] 🟡 [ABIERTO 08/08] El hub cuelga documentos que NO son de esa convocatoria: uno del ciclo anterior y una fila de fixture de test en la oposición de más tráfico

**De dónde sale:** los dos aparecieron trabajando [T-190] (re-clonar documentos con extracción
pobre) y **ninguno se arregla con esa ficha**: allí el problema es la CALIDAD del texto extraído;
aquí el documento está perfectamente extraído y lo que falla es **de quién es**.

**Caso 1 — Madrid publica una cifra respaldada por el documento de OTRO ciclo.**
`auxiliar-administrativo-ayuntamiento-madrid` tiene en su convocatoria `is_current`
`plazas_libres=111`, y su `landing_description` y su `boe_reference` dicen literalmente *«La OEP
2025 (Acuerdo de 27/11/2025, BOCM nº 10.017) incorpora 111 plazas de turno libre, **pendientes de
convocatoria**»*. Pero el documento que tiene adjunto es **`BOE-A-2024-21734`, la convocatoria de
2024, con 256 plazas** — un ciclo distinto y ya cerrado. No es reserva de discapacidad
(`plazas_discapacidad` es NULL): son **dos convocatorias distintas**, no la misma cifra mal extraída.
Re-clonar ese documento (hecho ya en T-190) trae una ficha de análisis perfecta que sigue demostrando
el número del ciclo equivocado.

**SOSPECHO** que el documento de 2024 quedó enganchado a la fila `is_current` en un rollover sin que
nadie lo revisara — no confirmado, haría falta mirar el historial de `convocatorias`.

**Y ningún detector lo ve:** comprobado `content_health_findings` para ese slug — 2 hallazgos
activos (`convocatoria_timeline_caducado`, `article_no_coverage`) y **ninguno sobre esto**.
`plazas_afirmadas_sin_documento` calla porque SÍ hay documento; `convocatoria_docs_incompletos`
calla porque el documento está clonado y enlazado. Lo que nadie pregunta es **si el documento
pertenece al ciclo que la fila describe**.

**Caso 2 — una fila de fixture de test escribiendo contra datos reales.**
`auxiliar-administrativo-estado` (la oposición de más tráfico del catálogo, 2.179 usuarios) tiene un
`convocatoria_documentos` con `url` `…/BOE-A-2099-TESTHUB.pdf` (año **2099**), `content_hash='h1'`,
`titulo='T'` y un `extracted_text` que es, literalmente, la página de error 404 de boe.es
(`fetched_at` 2026-07-25). Es un fixture de canary/test que apuntó a la convocatoria **REAL** en vez
de a una de prueba.

**Qué hacer, en este orden:**
1. **Madrid:** decidir contra el boletín a qué ciclo pertenece cada cosa — o el documento de 2024 se
   desengancha de la fila `is_current` (y la de 2024 recupera el suyo), o la fila `is_current` está
   mal y describe un ciclo que no es. **NUNCA** ajustar `plazas_libres` para que cuadre con el
   documento: eso publica la cifra del ciclo equivocado.
2. **TESTHUB:** encontrar qué script de test la escribió y hacer que apunte a datos de prueba; sólo
   entonces borrar la fila. Borrarla sin arreglar el origen la trae de vuelta.
3. **Y lo que evita el próximo:** valorar un detector que compare el AÑO/ciclo del documento con el de
   la convocatoria a la que cuelga. Es el hueco que los tres kinds existentes no cubren.

**Relacionadas:** [T-190] (de donde salen), [T-181] (documentos clonados en la oposición equivocada —
primo hermano: allí es otra OPOSICIÓN, aquí otro CICLO de la misma), [T-152] (campañas a Madrid).
