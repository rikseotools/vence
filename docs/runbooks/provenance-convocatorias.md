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

### 2.1-bis. De dónde sale el documento de una SEÑAL del radar (28/07/2026, T-221)

**El caso:** el 96% de lo que reportaba `audit:convocatorias` era `senal_aplicada_sin_documento` —se
cambiaban plazas/fechas/estado sin papel detrás—. Medido en RDS: **133 señales aplicadas en 7 días,
19 con documento (14%)**. La tentación es "clonar más"; era el diagnóstico equivocado.

**La causa real estaba en el SENSOR, no en el clonado.** El sumario del boletín se aplanaba a texto
(`htmlToText`) *antes* de trocearlo por disposición, así que el enlace de cada anuncio se perdía —y
el prompt del LLM pedía después una `url` que ya no existía en lo que se le daba: devolvía `null`
siempre, por construcción. La señal se quedaba con la URL del **sumario del día**, y un sumario NO
sirve como prueba: el del BORM son 739.029 caracteres que "respaldan" cualquier cifra (T-147(c)).

**Cómo funciona ahora** (`backend/src/detect-boletines/boletines.ts`):
- `htmlToTextConAnclas()` conserva cada `<a href>` como marca `⟦Ln⟧`, y `extractCandidatosFromSumarioText()`
  devuelve `{titulo, url}` por disposición. Los boletines JSON (DOGV, DOGC) traen el enlace por
  registro (`collectJsonEntradas`), y el sumario del BOE por item (`collectBoeEntradas`).
- **El LLM no elige la URL** — viene del parseo, pegada a su candidato. `urlDelCandidato()` solo decide
  a qué candidato corresponde el nombre extraído, y **ante empate o parecido flojo devuelve `null`**.
  Una URL equivocada es peor que ninguna: sería la prueba de OTRA convocatoria.
- El `apply` (`lib/api/oep-signals/queries.ts`) registra el puntero en el hub para **toda** señal (antes
  solo dentro del bloque con año OEP, y el 45% no lo trae), y **emite `senal_aplicada_sin_documento`**
  a `observable_events` cuando no puede, con la causa (`sin_source_url` / `url_no_reconocida`).

**Dos trampas medidas, las dos daban 200** (ver `feedback-verificar-el-arreglo-no-declararlo`):
1. El `href` del BOPA de Asturias trae `&amp;`: sin decodificar, el servidor responde **200 con otra
   página** (los parámetros llegan como `amp;p_p_lifecycle`).
2. El `urlPdf` del DOGV sin el prefijo `/datos` devuelve **200 con el HTML del portal** (126 KB de SPA)
   en vez del PDF (967 KB) — y encima `boletin_doc_key` no lo reconoce. Por eso el adapter lo canoniza.

**Simular antes de tocar nada** (no escribe, no llama al LLM, 0 €):
```bash
cd backend
npx tsx scripts/sim-enlace-anuncio.ts --dias 5                 # cobertura de enlaces por boletín
npx tsx scripts/sim-enlace-anuncio.ts --dias 5 --con-bd        # CADENA COMPLETA (¿lo reconoce doc_key?)
npx tsx scripts/sim-enlace-anuncio.ts --dias 5 --verificar     # + HEAD a una muestra
```
Medición del 28/07 tras el arreglo: **69% de los candidatos salen con enlace** (antes 0%) y **63%
llegan a documento registrado** — 9 de los 12 boletines que producen señales, en verde.

**Cómo se añade un boletín al doc_key** (se hizo ese día con BOPA, BON, BOME, DOCM y la variante de
la sede del BOC): una fila en `PATTERNS` de `canonicalizeBoletinUrl.cjs` + su rama espejo en una
migración `CREATE OR REPLACE FUNCTION boletin_doc_key` + fixture en el test de paridad **y** en
`scripts/provenance/canary-doc-key-parity.cjs`. **Verifica el id contra la URL real antes**: en el
BOME, el `BOME-B-…` que va en la ruta es el BOLETÍN del día, no el anuncio — usarlo habría colapsado
todos los anuncios de esa fecha en un mismo doc_key. Ya no hay que tocar a los llamadores: preguntan
con `boletin_doc_key_reconocido(url)` en vez de llevar copiada la lista de prefijos (había 3 copias,
y ninguna se enteraba de que la migración añadía boletines).

**Lo que queda fuera y por qué NO es "falta un parser":** DOE y BOPV publican en su sumario una URL
que **no es el documento** (el DOE devuelve una página de título+analítica sin la disposición; el
BOPV mete el texto en un `iframe`). Ahí hace falta resolver primero la URL de contenido real —
darles doc_key crearía provenance apuntando a un caparazón, que es peor que no tener documento.

**Lo que NO se hizo a propósito:** un cron que clone el texto solo. El clonador canónico es una
herramienta y no un cron *por diseño* (elegir el documento bueno pide criterio); lo que cambia es que
ahora hay un puntero trazable a su señal que curar, en vez de nada. El tipado fino lo sigue haciendo
§2.2-bis.

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

### 2.2-bis.2. El paso 2 resuelto: cron diario, sin tocar `detect-notas-convocatoria` (T-147, 05/08)

`sim-tipo-documento.cjs --apply` es manual: sin nadie ejecutándolo, el hub vuelve a llenarse de
`nota` cada día (medido: 6.063→6.398 entre el 27/07 y el 05/08, sin que nadie tocara nada). La
ficha original planteaba tipar en el INSERT del cron `detect-notas-convocatoria`, pero ESE cron
clona todo como `nota` A PROPÓSITO (es su historial de monitoreo, append por `content_hash`; el
índice `ux_convocatoria_documentos_conv_dockey` las excluye para permitirlo) — tipar ahí las haría
deduplicar por `doc_key` y se perdería el historial.

En vez de tocar el insert, hay un **segundo cron** (`backend/src/tipificar-documentos/`, @Cron
09:45 UTC diario, justo tras `detect-notas-convocatoria`) que reclasifica en el sitio las filas
YA insertadas: lee hasta 1000 `nota` (las más antiguas primero), clasifica con el mismo criterio
(mirror TS `tipo-documento-mirror.ts` — el backend no importa `../lib`, paridad fijada en
`__tests__/backend/tipoDocumentoMirror.test.ts`) y hace **UPDATE por `id`** — nunca inserta, así
que jamás compite con el modelo de append de `detect-notas-convocatoria`. Si el `doc_key` ya está
tipado por OTRA fila en la misma convocatoria (duplicado real, el caso de arriba), Postgres lo
rechaza con `unique_violation`; se cuenta como bloqueado y se deja como estaba — la fusión sigue
siendo `merge-dup-docs.cjs`, no algo que este cron decida a ciegas.

Registrado en `lib/admin/toolRegistry.ts` (`tipificar_documentos_cron`); el propio
`sim-tipo-documento.cjs` sigue vivo para pasadas `--todo` sobre el histórico y para revisar
muestras (`--ver`) antes de confiar en una regla nueva.

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

> **La cifra tiene que aparecer ENTERA, y eso vale para las dos escrituras.** «Aparecer» no es
> `includes`: en dígitos, el `216` de dentro del código `C1.1000197163216` no prueba 216 (T-202); y en
> letra —que es la mitad que se quedó sin arreglar hasta el 28/07— **«treinta» dentro de «treinta y
> seis» no prueba 30**, ni «mil» dentro de «dos mil setecientas cuatro» prueba 1000, ni «dos» dentro de
> «todos» prueba 2. Los numerales españoles se componen, así que aquí no basta la frontera de palabra:
> `lib/convocatoria/cifraEnTexto.cjs` exige que **ninguna palabra de numeral toque la aparición**, con
> la «y» juzgada por lo que lleva detrás («…laboral **y tres** plazas» sí prueba el 3).
> **Qué hacer si tocas esta regla:** el caso nuevo va al fixture COMPARTIDO
> (`__tests__/fixtures/cifraEnDocumento.cjs`) —que es lo que mantiene alineados el núcleo, el espejo
> del @Cron y `landingClaims`— y **antes de dar el cambio por bueno se mide sobre las convocatorias
> vivas** con `node scripts/convocatoria/sim-plazas-contexto.cjs` (el 28/07: 0 acusaciones nuevas).
> Ese simulador lleva su propio brazo de control congelado y avisa si deja de medir: un `0` suyo
> significa «no cambia nada» solo cuando el control sigue vivo.

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
4. **¿No la sostiene nada?** → corregirla contra el boletín **con la herramienta** (desde T-191 ya la hay;
   antes era el único paso del §6 que se hacía a mano, y es el que cambia un dato que el opositor LEE):

   ```bash
   node scripts/corregir-plazas-contra-boletin.cjs --slug=<slug> --valor=<n> \
     --cita="<literal del boletín que la sostiene>" --url=<url del documento> \
     --motivo="<por qué la publicada estaba mal>" [--esperado=<valor actual>] [--apply]
   ```

   Rehúsa escribir si la cita **no contiene la cifra** (mismo `cifraEnTexto` que el detector: no se
   puede colar una cifra que el detector no daría por probada), si la cita es un membrete, o si otra
   sesión cambió el valor entre medias. Hace el dual-write en transacción, deja traza del éxito y del
   rechazo, y re-lee para verificar. Si la cifra no está escrita pero es aritmética honesta sobre el
   mismo documento, **esta no es la vía**: firma `cifra_derivada` (punto 3).

   Y si no la sostiene nada en absoluto → `plazas_prevision` con motivo.

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

**Si la firma equivocada YA está puesta, hay que RETIRARLA** (pasó en este mismo caso: una segunda
sesión, trabajando en paralelo, firmó `cifra_derivada` justificando el 139 justo antes de que se
corrigiera el dato). Una válvula firmada sobre una cifra que ya no existe es peor que no tener
válvula: es una justificación en verde, con cita y autor, invitando a la siguiente sesión a
«restaurar» el número malo. Se retira quitando la clave y **dejando el rastro del error**:

```sql
UPDATE convocatoria_verification
   SET findings = (findings - 'cifra_derivada') || jsonb_build_object('derivada_retirada', '<por qué era falsa>')
 WHERE convocatoria_id = '<id>';
```

Antes de retirarla, comprobar que el hallazgo **no reaparece**: si la cifra corregida está escrita
literalmente en el boletín (144 lo está), la válvula sobra y `audit:convocatorias` sigue en cero. Si
reapareciera, es que el dato nuevo tampoco está probado y el trabajo no estaba terminado.

### ⚠️ Qué significa (y qué NO) que este detector esté a cero

La regla es «la cifra aparece en el texto de algún documento». Eso vale para cifras grandes y **es
casi ciego para las pequeñas**, porque un número corto aparece por azar en cualquier boletín (fechas,
artículos, apartados). Medido el 27/07 sobre 60 corpus reales, preguntando por cifras *arbitrarias*:

| dígitos de la cifra | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| se dan por «probadas» sin serlo | **100 %** | **83,5 %** | 30,1 % | 9,2 % |

Consecuencias prácticas:

- **Cero hallazgos no es «todo probado»**: es «nada probado que yo pueda ver». Para `plazas_libres` de
  1-2 dígitos, este detector no aporta garantía.
- **No lo amplíes a `plazas_promocion_interna` ni `plazas_discapacidad` tal cual.** Se simuló: da
  **0 hallazgos** sobre 96 convocatorias, y no porque estén bien — esas columnas son casi siempre de
  1-2 dígitos, justo la banda ciega. Sería falsa tranquilidad con pinta de cobertura.
- **La mejora conocida es exigir CONTEXTO** (que la cifra aparezca junto a «plazas»/«vacantes», no
  suelta). Simulada: **58 de 118** convocatorias (49 %) dejarían de estar probadas. Eso es una campaña
  de verificación, no un cambio de regla — hay que triarla antes de encenderla, o inunda el badge.
  Ver la ficha del backlog.

### La válvula ya no se fía de ti (guardarraíl, 27/07/2026)

Firmar `cifra_derivada` **ya no basta para callar el aviso**. El detector valida la firma con
`lib/convocatoria/validarDerivada.cjs` y solo la acepta si se sostiene sola:

| situación | veredicto |
|---|---|
| la cifra es **suma** de números presentes en la cita (126 = 103 + 23) | ✅ `suma_verificable` |
| la cita **contiene** la cifra (documento impreso que el extractor no lee) | ✅ `cifra_en_cita` |
| la cifra **no aparece ni es suma de nada** de su cita | ❌ `no_es_suma` → **corregir el dato** |
| la firma no aporta `source_snippet` | ❌ `sin_cita` |

La frontera es la que separa **leer** de **interpretar**: sumar partes que el documento enumera pero no
totaliza es leer; restar de un total que el documento sí declara es decidir que parte de lo que cuenta
no cuenta. Lo segundo no se firma como hecho — se corrige el dato.

**Calibrado contra las firmas reales, no inventado.** Dos reglas plausibles se descartaron por medirlas
antes de activarlas: «rechazar si la cita menciona otra cifra de plazas» habría tumbado **las tres**
firmas legítimas (todas mencionan otra: 146, 110, 100); y «rechazar si la cita contiene la cifra, porque
entonces la válvula sobra» habría tumbado la del Ayuntamiento de Madrid, donde el 111 **está impreso** en
el BOCM y lo que falla es el extractor (CMap roto). Si tocas esta regla, **corre el auditor contra la BD
antes de darla por buena**: así se cazaron las dos.

**Y la cita tiene que ser PRECISA, por un motivo medido.** La probabilidad de que una cifra *arbitraria*
sea suma de algún subconjunto de los números de la cita crece a plomo con su longitud:

| números en la cita | 3 | 5 | 8 | 10 | 15 | 25 |
|---|---|---|---|---|---|---|
| cifra mala que colaría | 1,3 % | 5,2 % | 23,6 % | 42,5 % | 69,7 % | 79,1 % |

Con una cita larga, que la cuenta cuadre no prueba nada. Por eso una cita con más de **8** números
distintos no exime (`cita_imprecisa`): hay que recortarla al fragmento que sostiene la cuenta. Limitar
el número de sumandos NO sirve (con 10 números: 43 % → 39 %); el problema es el tamaño del conjunto.

Al contar se quita el ruido del boletín —fechas `17/12/2025`, `núm. 244`, años sueltos—, porque no son
plazas: contarlos inflaba la cita de Extremadura de 7 números a 16 y la rechazaba siendo legítima. Ese
falso positivo apareció al correr los **tres** caminos (auditor, sweep CLI y la query del backend)
contra la BD antes de dar el guardarraíl por bueno. Hazlo tú también.

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

## 7. ¿El cupo de discapacidad va DENTRO del turno libre o APARTE? (`plazas_discapacidad_incluidas`)

**Frase-gatillo:** *"declara el cupo de discapacidad"*, *"revisa las reservas de discapacidad"*. Ficha: **T-218**.

Hermano del §6 y con la misma disciplina, porque es el mismo tipo de acto: **escribir un hecho que el
opositor lee**. Aquí el hecho es la RELACIÓN entre dos cifras que ya tenemos, y decide dos cosas visibles:

- el **total** que publica `oposiciones_ssot` — `IS TRUE` no suma el cupo; `false` y **`NULL` SÍ lo suman**;
- la **frase de la landing** — «…, de las cuales N están reservadas» (dentro) vs «… y otras N más» (aparte),
  y **silencio** si no consta, que es lo honesto pero publica menos de lo que sabemos.

Sin declarar, la vista suma por defecto: cada fila en `NULL` es una moneda al aire sobre si estamos
**inflando el total**. Pasó de verdad — la UNED publicaba 60 donde el BOE convoca 54.

```bash
# 1. QUÉ FALTA, con la evidencia delante (no escribe nada, ni con propuesta unánime)
npm run reserva:declarar -- --proponer [--slug=<slug>]

# 2. DECLARAR, con la cita literal del boletín
npm run reserva:declarar -- --slug=<slug> --incluidas=true|false \
  --cita="<literal>" --url=<url del documento> --motivo="<qué dice y dónde>" [--apply]
```

**La guarda** (núcleo puro `validarDeclaracionReserva` en `lib/convocatoria/correccionPlazas.cjs`): la cita
tiene que **nombrar el cupo** y contener el **total que tu declaración implica** — el turno libre guardado si
va dentro, `libres + cupo` si va aparte. Alternativa admitida para el «aparte»: que el texto **enumere los
dos cupos** («se dividen en dos cupos: general 1.747 · reserva 131»), porque hay boletines que no imprimen la
suma. **No basta con que aparezcan las dos cifras**: *«425 plazas, de las cuales 43 reservadas»* también las
trae y significa lo contrario — lo que decide es el conector.

### Cómo se lee un boletín, en la práctica

`--proponer` reconoce ya seis formas reales (`lib/convocatoria/evidenciaReserva.cjs`, 19 tests) y **separa
las dos colas**, que son trabajos distintos: las que **piden LEER** (el documento está, la forma es nueva) y
las que **piden CLONAR** el boletín (ningún documento trae la cifra junto a la reserva → eso es §6, no esto).

Al leer, el criterio que resuelve casi todo:

- **«Del total de las plazas … se reservan N»** NO significa siempre «dentro». Depende de **qué total
  guardamos**: la UNED dice 54 y guardamos 54 ⇒ dentro; Ujieres dice *cuarenta* y guardábamos 36 ⇒ aparte.
  La misma frase, veredictos opuestos.
- **Las tablas se resuelven por posición:** si nuestra cifra CIERRA la fila, guardamos el total ⇒ dentro
  (`305 9 13 327`); si la ABRE y la fila cierra con la suma, guardamos el cupo general ⇒ aparte
  (`89 7 23 3 122`).
- **El total va en LETRAS más de lo que parece** («convocatoria de cuarenta plazas»): por eso el lector usa
  `cifraEnTexto`, el mismo predicado del detector del §6.

### 🚩 Si la guarda rechaza un «aparte» porque falta NUESTRA cifra en la cita

Sospecha lo primero de que **nuestra cifra sea una resta nuestra**. Pasó en dos: Ujieres guardaba 36 donde el
BOE dice «cuarenta … se reservan cuatro» (40−4) e INGESA guardaba 7 donde dice «9 plazas … se reservarán 2»
(9−2). Es el patrón que el §6 llama invención presentada como hecho. Se arregla ENCADENANDO las dos
herramientas: primero `corregir-plazas-contra-boletin.cjs` para poner la cifra impresa, y **después**
declarar la relación. El total publicado no cambia; lo que cambia es que el desglose deja de ser una cuenta
nuestra.

### Tercera familia: la convocatoria ACUMULA varias OEP y nuestra cifra es la suma

Distinta de la anterior y se reconoce igual de rápido: la guarda rechaza porque **nuestra cifra no está
impresa**, pero aquí no es una resta — es que el boletín enumera las partes **por decreto de OEP** y
nosotros guardamos el acumulado. Dos casos leídos el 28/07:

- `administrativo-asturias`: el BOPA da *«ACCESO LIBRE ORDINARIO 13»* (OEP 2022) y *«ACCESO LIBRE
  ORDINARIO 3»* (OEP 2023), más *«ACCESO LIBRE DE PERSONAS CON DISCAPACIDAD 1»*. Guardamos 16 (=13+3) y
  109 de promoción (=100+1+8). Cuadra al dígito, pero **ni el 16 ni el 17 aparecen escritos**.
- `administrativo-la-rioja`: el BOR encadena *«tres (3) plazas por el sistema de acceso de turno libre y
  una (1) plaza por el turno reserva para discapacidad»* por cada decreto. Guardamos 17 + 5; el título sí
  imprime el total (**22 plazas de turno libre y reserva para discapacidad**), pero el 17 no.

**Ruta correcta, y es una que ya existe: NO se inventa una segunda válvula.** Es aritmética sobre literales
del MISMO documento, o sea exactamente lo que el §6 legitima con `cifra_derivada`: se firma la suma en
`convocatoria_verification` (explicando la cuenta y citando los sumandos) y **después** se declara la
relación. Sin esa firma, la cifra publicada es una cuenta nuestra sin rastro, que es lo que este runbook
persigue desde el principio.

### Qué NO hacer

- **NUNCA** declararlo por analogía con una convocatoria parecida ni por lo que dé la suma más redonda.
  Se lee en el boletín o **se deja sin declarar**, que es una respuesta legítima: la landing calla y no miente.
- **NUNCA** dar una oposición por declarada: **se declara un CICLO**. Un rollover a la convocatoria del año
  siguiente nace en `NULL` —correctamente, porque hay que leer SU boletín— así que la cuenta de resueltas
  decae sola. Pasó con `diputacion-cadiz` el mismo día.
- **NUNCA** fiarse de una propuesta sin mirar sus números. La primera versión del lector propuso 3 «limpias»
  y **las 3 eran coincidencia aritmética** entre fechas de un índice de procesos. Por eso el informe imprime
  la cuenta que casó, y por eso una fila de números sin vocabulario de reserva al lado ya no es evidencia.
