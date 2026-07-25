# Diseño — Temario versionado por convocatoria (SSOT del temario)

> **Estado:** propuesta de diseño (25/07/2026). No implementado. Pendiente de OK.
> **Origen:** auditoría 25/07 (caso `auxiliar_administrativo_extremadura`). Verificado: el temario NO está atado a la convocatoria y el 88 % de las oposiciones con convocatoria 2024+ nunca se ha contrastado con su fuente oficial. Es un gap sistémico, no un dato aislado.

## 1. Problema (verificado contra esquema + código)

- **`topics` (el temario) se identifica solo por el string `position_type`.** No tiene FK a `convocatorias` ni a `oposiciones`. `topic_scope` cuelga de `topics`.
- **Ningún código de runtime hace `UPDATE topics ... epigrafe`.** El temario lo INSERTAn los scripts de _build_ en el alta y se queda **congelado**. Los crons de seguimiento tocan `convocatorias`/`convocatoria_documentos` (plazas/fechas/docs), nunca el temario.
- **La convocatoria (proceso) SÍ está versionada** (`convocatorias`, `is_current`, por año). El temario NO. Son dos mundos desconectados: no hay join entre proceso y temario.

### Consecuencias
1. Una convocatoria nueva puede cambiar el temario (epígrafes, programa, forma de evaluar — "siempre cambia algo") y **nada lo propaga** → el opositor estudia un temario viejo. (Extremadura: 296 usuarios, 25/25 temas en `drift_detected`.)
2. **No se puede modelar una oposición con 2 convocatorias vigentes simultáneas con temarios distintos** (caso Comunidad de Madrid). Hoy el índice único `convocatorias (oposicion_id) WHERE is_current` lo prohíbe; se workaroundea partiendo en 2 oposiciones.
3. La verificación T-107 (epígrafe↔fuente) existe pero **solo marca drift, nunca corrige**, y cubre el 10 % de los topics.

## 2. Requisitos (del dueño de producto)

- **(a)** El temario **cuelga de una convocatoria** (versionado). El temario suele ser estable entre convocatorias, pero **cada convocatoria nueva exige revisar** el del año anterior contra su fuente oficial y aplicar los cambios (pequeños pero siempre existen).
- **(b)** **Fallback:** OEP aprobada pero convocatoria aún no publicada → se sirve el temario de la **convocatoria anterior** hasta que salga la nueva y se revise.
- **(c)** Una oposición puede tener **N convocatorias vigentes simultáneas, cada una con su propio temario** (ligeramente distinto). Debe modelarse nativamente, sin partir en oposiciones.

## 3. Principio de diseño

**El temario es una entidad versionada de primera clase (`temario_versions`) que las convocatorias REFERENCIAN.** Varias convocatorias pueden compartir la misma versión (caso común: temario estable). Una convocatoria con cambios estrena una versión nueva (copiada de la anterior + diffs verificados). El servicio resuelve el **temario efectivo** de la convocatoria que el usuario prepara.

### 3.1 Clone-once: TODO documento en la BD, cero re-descarga (principio)

**Cada documento y URL que toca el sistema (convocatoria, bases, temario, correcciones, listas) se CLONA una vez al hub `convocatoria_documentos` y se anota** — nunca se re-descarga para verificar. Por cada documento se guarda: `url` (canónica), `doc_key` (identidad), `content_hash`, `extracted_text` (el texto íntegro extraído), `boletin`/`referencia`/`fecha_publicacion`, `fetched_at`. La verificación y la revisión de temario **leen el `extracted_text` de la BD**, no la red.

- **Por qué:** la auditoría 25/07 tuvo que re-bajar los PDF del DOE (WebFetch no lee los PDF cifrados del boletín). Si estuvieran clonados, la revisión sería instantánea y offline. Y si el boletín retira el PDF, la evidencia se pierde para siempre si no se clonó.
- **La `temario_versions.source_documento_id` apunta a esa fila clonada** → "la URL del documento por si hay que verificar algo" + su snapshot con hash. Provenance completa: del epígrafe servido → al documento oficial clonado → a su URL y fecha.
- Reutiliza el camino único ya construido (T-107): `ensure_convocatoria_documento(boletin_doc_key(url), url, content_hash, extracted_text, …)`. Idempotente y deduplicado: un mismo BOE/DOE citado por N convocatorias = 1 sola fila.
- **Regla:** ningún paso del pipeline (detección, verificación, revisión) fetchea una URL que ya esté clonada; si no está, la clona (y la deja para siempre). El fetch solo ocurre **una vez por documento nuevo**.

**Clave de bajo riesgo (las preguntas NO se versionan):** las preguntas cuelgan del ARTÍCULO vía `topic_scope` (`questions.primary_article_id` → `articles`; un artículo aparece en un tema si está en el `topic_scope` de ese tema). Versionar el temario (topics+scope) **no duplica preguntas**: la misma pregunta se sirve en la versión cuyo scope incluye su artículo. Mismo pool, distinto filtrado por versión.

## 4. Modelo de datos

### 4.1 Nueva tabla `temario_versions`
```
temario_versions(
  id                    uuid PK,
  oposicion_id          uuid NOT NULL REFERENCES oposiciones,
  label                 text,            -- p.ej. "2024", "OEP 2023"
  estado                text NOT NULL,   -- draft | verified | active | superseded
  source_convocatoria_id uuid REFERENCES convocatorias,   -- convocatoria que estrenó esta versión
  source_documento_id   uuid REFERENCES convocatoria_documentos,  -- doc oficial del temario (hub T-107)
  parent_version_id     uuid REFERENCES temario_versions, -- de qué versión se copió (linaje)
  verified_at           timestamptz,
  created_at, updated_at
)
```
- Estados: `draft` (recién copiada, sin revisar) → `verified` (revisada contra fuente) → `active` (servible) → `superseded` (reemplazada).
- `source_documento_id` **enlaza al hub de provenance** ya construido (T-107): la versión apunta al documento oficial clonado del que se verificó.

### 4.2 `topics` y `topic_scope`: pertenencia a versión
- `topics` **añade** `temario_version_id uuid REFERENCES temario_versions` (nullable en migración, luego NOT NULL).
- `position_type` + `topic_number` **se conservan** (serving + back-compat). En el caso de 1 versión activa, `position_type` ↔ versión es 1:1 → el serving actual no cambia.
- `topic_scope` no cambia (cuelga de `topic_id`, que ya pertenece a una versión).

### 4.3 `convocatorias`: qué temario usa
- `convocatorias` **añade** `temario_version_id uuid REFERENCES temario_versions` (nullable).
- Varias convocatorias → misma versión si el temario es idéntico; versión nueva si cambia.
- **Relajar** el índice único `(oposicion_id) WHERE is_current` para permitir **N vigentes** por oposición (requisito c). Cada una con su `temario_version_id`.

### 4.4 Verificación por versión (reusa T-107)
- `topic_epigrafe_verification` y `topic_scope_verification` cuelgan de `topic_id` → **ya son por-versión** automáticamente (cada versión tiene sus topics). El `source_documento_id` (hub) apunta al documento de ESA convocatoria.

## 5. Resolución del "temario efectivo" (vista pura + función testeable)

Vista `convocatoria_temario_efectivo(convocatoria_id) → temario_version_id`:
1. Si la convocatoria tiene `temario_version_id` en estado `active`/`verified` → esa.
2. Si no (OEP aprobada sin temario propio) → la **versión activa más reciente de la misma oposición con `verified_at <= convocatoria.fecha`** (fallback, requisito b).
3. Si no hay ninguna → `never_sourced` (flag, no sirve temario falso).

El serving resuelve: usuario → convocatoria objetivo → `temario_efectivo` → topics/scope de esa versión → preguntas por `topic_scope`.

## 6. Disparador de revisión (requisito a) — reusa el pipeline existente

Cuando el **radar/seguimiento** detecta convocatoria nueva o cambio de `programa_last_hash` (ya existe la señal):
1. **Clonar** el documento oficial del temario al hub (`ensure_convocatoria_documento` — ya construido).
2. **Crear versión `draft`** copiada de la versión activa anterior (`parent_version_id`), con sus topics/scope (el temario es mayormente estable → copia + diffs).
3. Ejecutar el pipeline **`verify:epigrafe` + `verify:scope`** (T-107) de la versión draft contra el `source_documento_id` → produce los **diffs** (epígrafes que cambian, scope a ajustar).
4. Emitir hallazgo observable `temario_revision_pendiente` (badge) → **un humano revisa/aplica** los diffs (pequeños) → versión pasa a `verified`/`active`; la convocatoria apunta a ella; la anterior a `superseded`.

Nunca auto-aplica cambios de temario (contenido legal). El sistema **detecta + prepara + mide el diff**; el humano decide.

## 7. Migración (3.703 topics, backward-compatible, sin big-bang)

- **M1:** crear tablas/columnas (todo nullable). Cero efecto.
- **M2:** por cada oposición activa, crear **una** `temario_version` `active` (label = año de su convocatoria vigente; `source_convocatoria_id` = la vigente), y `UPDATE topics SET temario_version_id=…` para sus topics. Backfill `convocatorias.temario_version_id` de la vigente.
- **M3:** validar invariante (cada topic con versión; cada oposición ≥1 versión active) y poner `temario_version_id` NOT NULL en topics.
- **Back-compat:** con 1 versión activa por oposición, `position_type` sigue resolviendo 1:1 → **el serving actual no cambia una línea** hasta que una oposición estrene una 2ª versión.

## 8. Fases (cada una desplegable y con valor)

- **Fase 1 — Modelo + migración** (§4, §7). Vista `temario_efectivo` con fallback trivial (1 versión). Sin cambio de serving. Guardarraíl: invariante topic↔versión.
- **Fase 2 — Disparador de revisión** (§6): del radar a versión draft + verify + badge. Reusa hub + T-107. El humano aplica.
- **Fase 3 — Fallback real** (§5.2): OEP aprobada sin temario → versión anterior. Vista + función pura testeada.
- **Fase 4 — N convocatorias simultáneas** (requisito c): relajar índice único `is_current`, serving por-convocatoria (perfil `target_convocatoria`), retirar el workaround de "partir en 2 oposiciones". Es la fase de mayor blast-radius en serving → va la última, tras probar el modelo.
- **Fase 5 — Campaña de verificación** (el 88 % sin verificar): T-107 continúa, ahora **por versión** y disparado por convocatoria. Extremadura entra aquí (revisar sus 25 temas contra el Anexo IV 2024).

## 9. Observabilidad (no silencioso)

- Detector `convocatoria_sin_temario_verificado` (extiende `epigrafe_provenance_no_doc`): convocatoria vigente cuyo `temario_efectivo` está `draft`/`never_sourced` o cuya `source` no está clonada al hub. Badge + frase-gatillo.
- Evento `temario_revision_pendiente` al crear una draft por convocatoria nueva.
- Métrica: % de convocatorias vigentes con temario `verified`.

## 10. Riesgos y cómo se mitigan (anti-chapuza)

| Riesgo | Mitigación |
|---|---|
| Blast radius del serving (todo usa `position_type`) | Migración a 1 versión/oposición mantiene 1:1 → serving intacto hasta Fase 4. |
| Duplicar preguntas por versión | No se duplican: cuelgan del artículo vía `topic_scope`; mismo pool, distinto filtrado. |
| Auto-aplicar cambios de temario legal | Prohibido: el sistema detecta+prepara+mide diff; el humano aplica (regla nuclear). |
| Migración de 3.703 topics | Transaccional, invariante validado, NOT NULL solo tras backfill; local-first en Postgres efímero. |
| Índice único `is_current` (Fase 4) | Se relaja solo en Fase 4, con serving ya version-aware y tests. |
| Fallback sirve temario incorrecto | El fallback exige versión `verified`; si no hay, `never_sourced` (no sirve temario sin validar). |

## 11.bis. Endurecimiento (auto-crítica 25/07 → decisiones firmes)

- **Copy-on-write DESCARTADO.** A nuestra escala (~127 oposiciones × ~30 temas × pocas versiones/año = decenas de miles de filas) la duplicación es irrelevante para Postgres y COW mete lógica de herencia que enreda verificación/scope/preguntas. **Copiar todo = simple y correcto.** (Fue sobre-ingeniería mía.)

- **`position_type` (56 ficheros lo leen) — resuelto con `is_active` como COMPUERTA, sin tocar los 56.**
  Redefinición: **`topics.is_active` = "pertenece a la versión servible por defecto" de esa oposición.** Los ~56 lectores legacy ya filtran `WHERE is_active` → automáticamente reciben SOLO la versión por defecto, **sin cambiar una línea**. Las versiones no-default tienen sus topics con `is_active=false` (no se sirven por la vía legacy). Esto reconcilia además el fleco #4 (is_active vs estado): `is_active` se deriva del estado de la versión (active-default → true).
  - Single-version (99%): 1 versión active-default → comportamiento idéntico a hoy.
  - Multi-version (Madrid): versión A default (is_active=true) + versión B (is_active=false). La vía legacy sirve A; la vía **version-aware** sirve B por `temario_version_id` explícito.

- **Fase 4, coste REAL y acotado.** No son "56 ficheros". Gracias a la compuerta `is_active`, la Fase 4 = **un solo punto nuevo**: que el serving resuelva la versión desde la convocatoria objetivo del usuario (`user_profiles.target_convocatoria`) y, si no es la default, consulte por `temario_version_id`. Los 56 lectores legacy siguen sirviendo la default vía `is_active`. Producto decide cuál es la "default" cuando hay 2 vigentes.

- **Guarda del disparador (fleco #3):** una versión draft se crea SOLO cuando aparece un **documento oficial de temario con `content_hash` NUEVO en el hub** (texto estable, deduplicado), NO cuando cambia `programa_last_hash` (que incluye ruido de página: relojes, tokens). El cambio se mide sobre el snapshot clonado, no sobre el fetch en vivo.

- **Invariante de versión activa (fleco #5):** una convocatoria referencia **exactamente una** `temario_version` (FK simple `convocatorias.temario_version_id`). No hay ambigüedad de "cuál está activa": las activas = las apuntadas por convocatorias vigentes. Índice/constraint: a lo sumo una versión `active`+`es_default` por oposición.

- **Migración, edge case (fleco #6):** oposiciones **sin** convocatoria vigente → se les crea igualmente una versión `v1` `active`+default (label = año de su última convocatoria o "base"), `source_convocatoria_id` = la última conocida o NULL. Servible como fallback. Ninguna oposición se queda sin versión.

## 11. Qué se reutiliza (no se reinventa)

- **Hub de provenance** (T-107): `source_documento_id` de la versión → documento oficial clonado. `ensure_convocatoria_documento`, canonicalizador, guardarraíles CI.
- **Pipeline `verify:epigrafe` + `verify:scope`**: se dispara por convocatoria en vez de a mano.
- **Radar/seguimiento**: la señal de convocatoria nueva ya existe; solo se conecta al disparador.
- **Rollover**: el pivote de convocatoria y el disparador de revisión se alinean.
