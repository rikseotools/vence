# Runbook — Provenance de documentos de convocatoria (referenciado → clonado → enlazado)

**Cuándo seguir este runbook (frase-gatillo):** *"revisa la provenance de convocatorias"*, o cuando el panel `/admin/salud-sistema` muestre el hallazgo **`convocatoria_docs_incompletos`**. Seguir esto ANTES de improvisar.

> 🎯 **Principio (diseño `docs/roadmap/verificacion-convocatorias-documentos-proceso.md`):** cada dato de la landing (`exam_date`, `plazas_*`, calendario, hitos) debe **apuntar a su documento-fuente oficial** clonado (URL + tipo + cita literal + hash + snapshot). Cero invención. Si un hito cita un BOE/boletín, ese documento debe estar **clonado en `convocatoria_documentos` y ENLAZADO** vía `convocatoria_hitos.source_documento_id`.

## 0. Qué avisa el hallazgo

- **`convocatoria_docs_incompletos`** (category `content`, severity `warn`) por oposición viva cuya convocatoria vigente tiene provenance incompleta. Fuente: **VISTA `convocatoria_docs_coverage`** (migración `20260721_convocatoria_docs_coverage.sql`).
- El detector vive en el sweep (`scripts/health-sweep.cjs` + gemelo `backend/src/content-health-sweep/content-health-sweep.service.ts`).
- **`epigrafe_provenance_no_doc`** (frase-gatillo *"revisa la provenance de epígrafes"*) — el OTRO consumidor del hub (ver §0.bis).

## 0.bis. El HUB: `convocatoria_documentos` es la fuente única (T-107, 24/07)

**Regla:** `convocatoria_documentos` es el único almacén de documentos oficiales clonados. **Todo lo que referencia un documento oficial PRODUCE por el mismo camino y CONSUME por FK** — nunca guarda una URL suelta (el bug que lo motivó: la verificación de epígrafe guardaba `txt.php?id=…` mientras el documento estaba clonado como `/pdfs/….pdf` → no casaban → falso verde de provenance).

- **Camino ÚNICO de escritura:** función SQL **`ensure_convocatoria_documento(convocatoria_id, doc_key, canonical_url, content_hash?, tipo?, titulo?, extracted_text?, fuente?)`** (migración `20260725_provenance_doc_hub.sql`). Idempotente por `(convocatoria_id, doc_key)`. **SOLO opera sobre documentos CANÓNICOS (`tipo<>'nota'`):** las notas de monitoreo comparten `doc_key` pero un consumidor jamás debe enlazar a una nota; si solo existe la nota, `ensure_` crea el documento canónico (fix 25/07 — antes su SELECT devolvía notas → 110 epígrafes mal enlazados; guardarraíl `__tests__/integration/provenanceLinkNotNota`). Repunte de enlaces rotos: `scripts/provenance/repoint-nota-to-canonical.cjs`. La llaman por igual el backend (Drizzle raw) y los scripts `.cjs` (pg) → dedup idéntico, runtime-agnóstico. Mismo patrón que `transition_question_state` / `record_epigrafe_verification`.
- **Identidad canónica `doc_key`:** la calcula el ÚNICO canonicalizador **`lib/convocatoria/canonicalizeBoletinUrl.cjs`** (puro, testeado). BOE `txt.php` y `/pdfs` del mismo documento → mismo `doc_key` (`BOE-A-2025-26262`). Boletines no reconocidos (cola larga) → `doc_key` = URL normalizada (dedup por URL exacta, `recognized:false`). Índice único parcial `ux_convocatoria_documentos_conv_dockey`. **Boletines reconocidos (25/07):** BOE, BOCM, DOGV, BOCYL, DOGC, **BOC** (Canarias), **BOJA** (Andalucía), **DOG** (Galicia, `_es`/`_gl` convergen), **MIA** (portal CSV de Aragón — SPA `?csv=` y API `carp-core-mia…/rest/documentos/CSV/pdf` convergen). Añadir uno = una fila en `PATTERNS` (JS) + su rama en `boletin_doc_key` (SQL) + su URL en el fixture del guardarraíl de paridad `__tests__/integration/docKeyParity.integration.test.ts` (si no, JS y SQL divergen en silencio).
- **Consumidores (enlazan por FK, `source_url`/`url` quedan como espejo):**
  - `convocatoria_hitos.source_documento_id` (hitos del timeline).
  - `topic_epigrafe_verification.source_documento_id` (Paso 1 del scope — el epígrafe clonado). Lo fija `verify-epigrafe-literality.cjs record` automáticamente.
- **Backfill de lo legacy:** `scripts/provenance/backfill-doc-key.cjs --apply` (pone `doc_key` en las filas ya clonadas) y `scripts/provenance/link-epigrafe-docs.cjs --apply` (enlaza epígrafes verificados antes del hub que tengan `source_url`).
- **Invariante:** un epígrafe `verified_literal` debe tener `source_documento_id` NOT NULL. Los que no → los caza `epigrafe_provenance_no_doc`: si tienen `source_url` se enlazan solos con `link-epigrafe-docs.cjs`; si no, hay que re-sourcearlos (bajar el temario oficial del `programa_url` y correr `record` con `source_url`).
- **DOS usos, dedup OPUESTA (decisión 25/07):** el hub guarda (a) **documentos canónicos** (`tipo≠'nota'`: BOE/convocatoria…) = uno por documento → dedup por `doc_key`; y (b) **notas de monitoreo** (`tipo='nota'`, del cron de seguimiento) = se APILAN por cada cambio de la página (historial). Por eso el índice único `ux_…_conv_dockey` **excluye `tipo='nota'`** (`WHERE doc_key IS NOT NULL AND tipo<>'nota'`): deduplicar notas colapsaría su historial. Espejo SQL del canonicalizador: **`boletin_doc_key(url)`** (para el backend, que no alcanza `lib/`).
- **Productores enrutados por el hub (25/07):** `backend/scripts/clonar-documento.ts` (canónicos) llama a `ensure_convocatoria_documento(boletin_doc_key(url), …)` + UPDATE que preserva metadata curada; `detect-notas-convocatoria` (notas) rellena `doc_key` sin deduplicar. **Requiere DEPLOY del backend para activarse.** Canary de paridad JS↔SQL: `scripts/provenance/canary-doc-key-parity.cjs`.
- **3er consumidor del hub — documentos de OEP (T-108, 25/07):** el decreto de una OEP se clona con **`tipo='oep_decreto'`** y se enlaza a la entidad `oep` (`oep.source_documento_id` + `convocatoria_documentos.oep_id`, bidireccional). Lo escribe el radar al aplicar una señal (`fuente='oep-radar'`, solo si la fuente es un boletín reconocido) y el backfill histórico (`scripts/oep/clonar-oep-documento.cjs`, `fuente='oep-backfill'`). Guardarraíl de integridad: `__tests__/integration/oepEntidadIntegrity.integration.test.ts` (source_documento_id→oep_decreto, puente sin cruce de oposiciones, enlace bidireccional). Modelo OEP: `docs/roadmap/oep-entidad-modelo.md`.

## 1. Leer la cobertura (la vista es la fuente única)

```sql
SELECT slug, año, docs_clonados, hitos_con_url, hitos_enlazados,
       hitos_enlazables, docs_por_clonar, citas_sin_fuente, incompleto
FROM convocatoria_docs_coverage
WHERE is_active AND is_current AND incompleto
ORDER BY docs_por_clonar DESC;
```

Columnas (por convocatoria):
- `docs_clonados` — filas en `convocatoria_documentos`.
- `hitos_con_url` — hitos que apuntan a un documento oficial (tienen `url`).
- `hitos_enlazados` — hitos con `source_documento_id` (provenance completa).
- `hitos_enlazables` — la `url` YA coincide con un doc clonado, falta el enlace → **backfill SIN fetch**.
- `docs_por_clonar` — la `url` NO coincide con ningún doc clonado → **hay que clonar el documento oficial**.
- `citas_sin_fuente` — `cita_literal` sin `source_documento_id` → la cita no tiene evidencia clonada.

## 2. Arreglar, en orden de coste

### 2.1. Enlazar lo ya clonado (barato, determinista, sin red)
```bash
node scripts/backfill-hito-source-documento.cjs          # dry-run (cuenta)
node scripts/backfill-hito-source-documento.cjs --apply  # enlaza por coincidencia exacta de URL
```
Idempotente (solo `source_documento_id IS NULL`) y determinista (si la url coincide con >1 doc, elige el más antiguo). Cierra `hitos_enlazables` sin tocar contenido.

### 2.2. Clonar el documento referenciado (fetch oficial, con verificación)
Para cada `docs_por_clonar`: coger la `url` del hito (BOE/boletín/sede), **clonar** el documento con la herramienta existente (`backend/scripts/clonar-documento.ts`; usa el fetcher headless para SPAs) → inserta en `convocatoria_documentos` (url, tipo, `content_hash`, `extracted_text` snapshot, `llm_extraction`, `confianza`). Después enlazar el hito (`source_documento_id`).
- **NUNCA inventar:** el documento se clona de su URL oficial. Si la URL da 403/está caída (madrid.es, algún BOP con TLS roto), **NO se clona a ciegas** — se deja el hueco anotado (es "URL de seguimiento caída", familia T-047), no se fabrica evidencia.
- El `tipo` se pone según el documento (`oep_decreto`, `bases`, `resolucion_tribunal`, `correccion_errores`, `anuncio_fecha`, `lista_admitidos`…), no `nota` (que es lo que emite el pipeline automático `detect-notas`).

### 2.2-bis. Tipar lo YA clonado (`nota` → su tipo real)

El 94% del hub está en `nota` y **sin tipo no se puede usar como fuente**. El núcleo puro
`lib/convocatoria/tipoDocumento.cjs` deduce el tipo de la CABECERA del documento (no del texto
entero: buscar en todo el PDF daba 67 falsos "lista de admitidos"), con la URL y el título como
refuerzo, y **ante la duda deja `nota`**.

```bash
node scripts/convocatoria/sim-tipo-documento.cjs                 # landings vivas, no escribe
node scripts/convocatoria/sim-tipo-documento.cjs --ver bases     # muestra a revisar A MANO
node scripts/convocatoria/sim-tipo-documento.cjs --apply         # escribe + traza en observable_events
node scripts/convocatoria/sim-tipo-documento.cjs --todo          # el hub entero (no solo landings vivas)
```

**Revisa la muestra ANTES de aplicar; no es opcional.** En la primera pasada (27/07) `oep_decreto`
tenía precisión ~0 —4 de 4 eran convocatorias que citan el RD de la OEP en su primer párrafo— y
`bases` se tragaba los extractos del BOE de administración local, que SIEMPRE dicen *"se han
publicado las bases que han de regir la convocatoria"* sin ser las bases. Las tres regresiones
están fijadas en `__tests__/lib/convocatoria/tipoDocumento.test.js`.

**Duplicados:** el índice `ux_convocatoria_documentos_conv_dockey` es UNIQUE sobre
`(convocatoria_id, doc_key) WHERE tipo <> 'nota'` — las `nota` NO deduplican (son historial de
monitoreo), los documentos tipados sí. Así que una `nota` cuyo `doc_key` ya tiene fila tipada es
**el mismo documento clonado dos veces**: no se re-tipa, se fusiona.

```bash
node scripts/provenance/merge-dup-docs.cjs --notas                    # dry-run
node scripts/provenance/merge-dup-docs.cjs --notas --adoptar-texto --apply
```

⚠️ `--adoptar-texto` existe por un hallazgo del 27/07: **12 de 18 notas duplicadas tenían MÁS
texto que el documento tipado, y dos tipados estaban VACÍOS**. Fusionar sin mirar habría tirado
339.207 caracteres de texto oficial. Con el flag, el superviviente adopta el texto (y el hash)
del más completo y **después** se borra el duplicado — en ese orden, o revienta el UNIQUE
`uq_conv_doc_url_hash` al coexistir dos filas con la misma url+hash.

### 2.2-ter. Campaña: clonar el documento del BOTÓN OFICIAL (`programa_url`)

Hueco sistémico medido el 27/07: **el documento más oficial de la landing no lo clona nadie.** El
cron `detect-notas` clona lo que cuelga de la `seguimiento_url`; el `programa_url` —el que abre el
botón "Ver convocatoria en {diario}"— se quedaba fuera. Resultado: **44 de 122 landings activas**
lo tenían fuera del hub, y por eso el detector de cifras no podía contrastar (`administrativo-madrid`
afirma "47 temas del programa" y en sus documentos clonados no hay ni un «Tema N»: el Anexo III
del temario no estaba).

```bash
node scripts/convocatoria/campana-clonar-programa.cjs              # qué haría (no escribe)
node scripts/convocatoria/campana-clonar-programa.cjs --limite 12  # por lotes
node scripts/convocatoria/campana-clonar-programa.cjs --apply
```

Prioriza las que hoy no tienen NINGÚN documento tipado. **Decide** (qué falta, si el documento
sirve, de qué tipo es) con los núcleos compartidos y **delega el escribir** en la herramienta
canónica `backend/scripts/clonar-documento.ts` — no hay un segundo escritor.

**Tres motivos por los que se salta un documento, y los tres son correctos:**
- *tipo no reconocido* → el clasificador no sabe QUÉ es. Clonarlo tipado a lo bruto lo convertiría
  en fuente de verdad; va a revisión humana.
- *boletín completo* → el `programa_url` apunta al PDF del boletín ENTERO, no al anuncio. Caso real:
  `administrativa-universidad-de-murcia` → BORM 146/2026, **739.000 caracteres y 179 anuncios**. Si
  se clona, el detector de cifras da por respaldada cualquier afirmación cuyo número aparezca ahí
  dentro — y con 739 KB aparece cualquiera. **Ese `programa_url` hay que repuntarlo al anuncio**
  (`repuntar-enlace-convocatoria.cjs`), no clonar el boletín.
- *no responde / pared del portal* → sede caída o WAF. Se reintenta otro día; no se inventa.

### 2.3. Citas sin fuente (`citas_sin_fuente`)
Un hito con `cita_literal` pero sin `source_documento_id`: localizar el documento del que salió la cita, clonarlo (2.2) y enlazar. Si la cita no se puede rastrear a un documento oficial, es sospechosa (¿de dónde salió el texto?) → verificar contra fuente antes de dejarla.

**Las estimaciones NO cuentan (27/07/2026).** Un hito con `origen='estimacion'` declara que la fecha es NUESTRA y que ningún boletín la publica: pedirle documento es una contradicción de categoría, y el aviso no se podía apagar haciendo lo correcto. La vista los excluye desde la migración `20260727_docs_coverage_excluye_estimaciones.sql`. Los `registro` e `inferencia` sin fuente **sí siguen contando**: esos sí tienen un documento detrás que nadie ha clonado.

### 2.4. Después de enlazar, deriva el `origen` con la regla compartida
Enlazar el documento y poner la `url` no basta: el timeline **oculta la fecha** de todo hito cuyo `origen` no sea `registro` (lista blanca de `lib/convocatoria/fechaEstimada.ts`). Un hito con fecha oficial pero `origen='inferencia'` se pinta como *"Fecha por confirmar"* — pasó en `ordenanza-ayuntamiento-cordoba`, cuyo **fin de plazo** salía sin fecha justo cuando se iba a anunciar por newsletter.

```bash
node scripts/clasificar-hitos.cjs --slug <slug>          # dry-run, solo esa oposición
node scripts/clasificar-hitos.cjs --slug <slug> --apply
```
`--slug` acota a una oposición: revisar UNA landing no debe reescribir los ~1.000 hitos del catálogo. Sin él, el comportamiento es el de siempre (todo). **No pongas `origen` a mano:** la regla (citar boletín con identificador o traer `url` ⇒ registro) vive en `clasificar()` y está testeada.

## 3. Hitos huérfanos (`convocatoria_id IS NULL`)

La vista es por convocatoria, así que **no ve** los hitos con `convocatoria_id NULL` (cuelgan solo de `oposicion_id`). El detector los cuenta aparte (finding con `detail.orphan=true`). Estos hitos tienen provenance no atribuible a un ciclo: hay que **asignarlos a su convocatoria** (normalmente la `is_current`, pero si el hito es de un ciclo pasado va a la convocatoria archivada de ese año — mirar la fecha del hito, no asumir). Solo entonces entran en la cobertura.

## 4. Qué NO tocar / no hacer

- **NO** clonar sin verificar la URL oficial. **NO** fabricar `cita_literal` ni `content_hash`.
- **NO** asignar un hito huérfano a la `is_current` sin mirar su fecha (podría ser de un ciclo archivado).
- El pipeline `detect-notas` seguirá clonando `nota` automáticas desde la `seguimiento_url`; esto es complementario (los documentos que respaldan HECHOS, citados por hitos).

## 5. Verificar el arreglo

```sql
-- tras enlazar/clonar, la convocatoria debe salir de la lista:
SELECT slug, docs_por_clonar, hitos_enlazables, citas_sin_fuente, incompleto
FROM convocatoria_docs_coverage WHERE slug = '<slug>';
```
`incompleto` debe pasar a `false` cuando `docs_por_clonar = hitos_enlazables = citas_sin_fuente = 0`.

## 6. Cifra de plazas afirmada sin documento (`plazas_afirmadas_sin_documento`)

**Frase-gatillo:** *"revisa las plazas sin documento"*. **Badge:** severidad `error`.

Los apartados anteriores miran si falta papeleo. Este mira algo más grave: **la landing afirma un número
de plazas que no está escrito en ninguno de los documentos que hemos clonado**, ni en dígitos (`139`,
`1.030`) ni en letra (`ciento treinta y nueve`) — los boletines escriben en letra, y un buscador
solo-dígitos daría 22 acusaciones falsas de 31.

Una cifra de plazas solo puede ser dos cosas:

- un **HECHO** → algún documento de la convocatoria la contiene;
- una **PREVISIÓN** → se declara con `plazas_prevision` + motivo.

Lo que no puede ser es una cifra huérfana presentada como hecho. Así acabó
`auxiliar-administrativo-estado` enseñando un total de **2.170** (el 1.450 de la OEP 2026 metido en una
fila de 2025 junto al 720 de su convocatoria) que no existía en ningún documento del mundo.

```bash
npm run audit:convocatorias           # informe completo; el bloque plazas_afirmadas_sin_documento es este
npm run audit:convocatorias:gate      # modo gate (CI)
```

### Cómo resolver, en este orden

1. **¿El documento que la prueba no está clonado?** → clonarlo desde su URL oficial (§1-2 de este runbook).
2. **¿El documento clonado no es el que la prueba?** → pasa cuando se clonó el *menú* del portal en vez del
   anuncio (el chrome del DOGC, 4 KB de «Sortir ràpid»; el sumario del BOJA, 32 KB de menús). Clonar el bueno.
3. **¿La cifra sale de sumar literales DEL MISMO documento?** (turno libre desglosado: 23 + 103 = 126, y el
   «126» no aparece escrito) → **firmarla**: `convocatoria_verification` en `verified_correct` con la clave
   `cifra_derivada` en `findings`, explicando la cuenta y citando los sumandos literales.
4. **¿No la sostiene nada?** → corregirla contra el boletín, o marcarla `plazas_prevision` con motivo.

### El PDF que NO se puede leer: renderiza la página y léela (27/07/2026, T-191)

Hay boletines municipales cuyo PDF lleva el **CMap roto**: el texto sale en mojibake y **ningún
extractor lo salva** — `pdftotext`, `pdftotext -layout` y `gs -sDEVICE=txtwrite` devuelven lo mismo
(`EKD/E/MEd'KZ1` por «DENOMINACIÓN CATEGORÍA»). Antes de dar el documento por inservible:

```bash
pdftoppm -png -r 150 -f 3 -l 3 documento.pdf pag   # y LEER la imagen
```

Con la página renderizada la tabla se lee sin ambigüedad. Así se probó que las **111 plazas** de
`auxiliar-administrativo-ayuntamiento-madrid` están impresas en el Anexo I del BOCM-20251210-49
(cupo general 100 + reserva discapacidad 11 = total 111), después de que las dos vías anteriores
—`sede.madrid.es` con WAF y el PDF con `pdftotext`— estuvieran documentadas como muertas.

**Y aun así hay que firmar la verificación**, porque el corpus sigue sin poder probar la cifra por
extracción: `convocatoria_verification` con `cifra_derivada` + un `source_snippet` que **describa la
tabla en prosa** (el detector `cita_no_prueba_nada` exige ≥5 palabras en minúscula o dos de las
cifras afirmadas; un membrete no vale). Comprueba el snippet contra ese mismo criterio ANTES de
escribirlo — a mí me cazó por dejarlo vacío.

### Restar las reservas NO da «las plazas» (27/07/2026, T-191)

`administrativo-aragon` publicaba **139** plazas y el BOA (Resolución de 19/12/2025, BOA 247,
Anexo I) convoca **144**: `250102 Escala General Administrativa. Administrativos 144 (3 reservadas a
víctimas de violencia de género, 1 reservada a víctimas de terrorismo y 1 reservada a personas
transexuales)`. El 139 salía de restar esas 5 — **una resta que no aparece escrita en ningún sitio**,
el mismo patrón que el 2.163 de Policía Nacional.

**Las plazas reservadas a colectivos son plazas del turno libre CON reserva, no plazas descontadas.**
El caso hermano lo confirma: en Madrid la cifra correcta (111) *incluye* las 11 de reserva por
discapacidad. Efecto de la resta: la landing anunciaba **5 plazas menos** de las convocadas.
Corregido a 144 en las dos filas del dual-write, con traza `plazas_corregidas_contra_boletin`.

### Qué NO hacer

- **NUNCA** inventar la cifra ni ajustarla "a ojo" para que cuadre.
- **NUNCA** firmar `cifra_derivada` para callar el aviso. Esa válvula es para aritmética sobre literales del
  mismo documento; *"lo sumé yo"* es exactamente lo que se dijo del **2.163** de Policía Nacional
  (2.704 − 541), que sí era una invención presentada como hecho. La diferencia no la ve un regex: la ve
  quien lee, y por eso la excepción deja rastro firmado.
- La regla es condición **necesaria, no suficiente**: que el `3` de Ávila aparezca en el texto no prueba que
  sean 3 plazas — eso se lee. Pero si no aparece ni una vez, el documento no puede probarla.

### Gotcha: el auditor puede estar mudo

`scripts/audit-convocatoria-completitud.cjs` moría con `self-signed certificate in certificate chain`
porque `DATABASE_URL` trae `sslmode=require`, que choca con `ssl: { rejectUnauthorized: false }` (el
certificado de RDS lo es). No fallaba ruidosamente: simplemente el auditor **y su gate de CI** no corrían.
Arreglado quitando el parámetro de la URL, como ya hacía `scripts/health-sweep.cjs`. **Si un auditor deja
de reportar hallazgos, comprobar que conecta antes de celebrar que está todo limpio.**
