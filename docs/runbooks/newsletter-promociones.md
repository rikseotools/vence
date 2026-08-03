# Runbook: Promociones por Newsletter (oposiciones con inscripción abierta)

> **Cuándo consultarlo:** cuando el usuario diga *"promociona por newsletter una inscripción abierta"*, *"manda una newsletter de X oposición"*, *"avisa a los de tal provincia de que se abrió la inscripción"*, *"campaña de email a interesados"* o similar. Claude DEBE seguir este runbook ANTES de improvisar.

Objetivo: avisar por email a los usuarios de la **zona** de una oposición (target exacto + provincia/comunidad) cuando se abre su inscripción, para que se preparen en Vence. Cada envío es medible (aperturas + clics) en `/admin/newsletters` → tab **Historial de Envíos**.

Relacionado: memoria `project_campana_email_inscripcion_abierta`. Base de datos VIVA = **AWS RDS** (`project_cutover_rds_prod`), NO Supabase.

---

## 0. Conexión a la BD (RDS prod)

La BD viva es RDS. Exportar la URL antes de cualquier query/envío:
```bash
export PROD_DATABASE_URL="postgresql://venceadmin:<PASS>@vence-prod.c1mkcg6astb0.eu-west-2.rds.amazonaws.com:5432/app"
```
Pass en `scratchpad/rdsprod.env` (memoria `project_cutover_rds_prod`). Cliente `pg` con `ssl:{rejectUnauthorized:false}`. **NO usar el cliente Supabase** (apunta al backup congelado, datos viejos).

---

## 1. Localizar oposiciones con inscripción ABIERTA y jugables

```sql
SELECT slug, short_name,
       COALESCE(plazas_libres,0)+COALESCE(plazas_promocion_interna,0) AS plazas,
       temas_count, inscription_deadline, estado_proceso, coverage_level
FROM oposiciones
WHERE is_active = true
  AND inscription_deadline IS NOT NULL
  AND inscription_deadline >= CURRENT_DATE
ORDER BY inscription_deadline;
```

**Filtro de calidad OBLIGATORIO:** solo promocionar si tiene **tests jugables**. Priorizar por cierre de inscripción más próximo.

> **Aprendizaje 05/07: `coverage_level` puede estar STALE.** Jaén figuraba como `con_landing` pero en realidad tenía 40 temas disponibles + 11k preguntas + landing y tests vivos → era jugable. **No fiarse solo del flag: verificar la jugabilidad EMPÍRICAMENTE** antes de descartar un `con_landing`:
> 1. **Temas:** `SELECT COUNT(*) FILTER (WHERE disponible) FROM topics WHERE position_type='<pt>' AND is_active`.
> 2. **Preguntas jugables por artículo+topic_scope** (no por tags): unir `topic_scope`→`articles`→`questions is_active` y contar; comprobar que **ningún tema queda en 0** (`GROUP BY topic_number`).
> 3. **Landing y test vivos en prod:** `curl -o /dev/null -w '%{http_code}' https://www.vence.es/<slug>` y `.../<slug>/test` (ambos 200), y confirmar que la landing NO es placeholder "en desarrollo".
> Si cumple, es promocionable y conviene **corregir el flag**: `UPDATE oposiciones SET coverage_level='con_tests' WHERE slug=...` (la tabla NO tiene `updated_at`). Si sigue siendo solo landing sin tests, **NO enviar** (quema la oportunidad).

**Confirmar demanda de pago (opcional, refuerza la decisión):** cruzar la audiencia con `user_profiles.plan_type='premium'`. Si ya hay algún premium apuntando a esa oposición (por `target_oposicion` o zona), es señal de demanda real y de pago. Premium global se distingue con `plan_type != 'free'`.

---

## 2. Calcular la audiencia por zona

Dos fuentes se unen:
- **Target exacto:** `user_profiles.target_oposicion = '<slug con GUIONES_BAJOS>'`.
- **Zona (geo):** `user_profiles.ciudad ILIKE '%municipio%'` para los municipios de la provincia/comunidad.

Filtrar SIEMPRE por consentimiento: `email_preferences.unsubscribed_all = false` y `email_newsletter_disabled = false`, y `email` no vacío.

> **🔒 Garantía anti-desuscritos (por diseño):** el filtro de consentimiento va **hardcoded en el `WHERE`** de la query de audiencia del script `send-promo-inscripcion.cjs` — **NO es un parámetro del config**, así que **ninguna ejecución puede saltárselo** aunque el `promo.json` esté mal. Excluye tanto la **baja total** (`unsubscribed_all`) como la **baja solo de newsletter** (`email_newsletter_disabled`). Quien se da de baja desaparece automáticamente del siguiente envío (verificado E2E). Nota: quien **no tiene fila** en `email_preferences` SÍ recibe — es correcto: "sin fila" = nunca se dio de baja (`COALESCE(...,false)` lo trata como suscrito). **Es imposible enviar a un desuscrito con este script.**

### 2.0-bis SEGMENTAR POR FAMILIA: ya se puede HOY, sin construir nada (medido 03/08/2026)

**No hace falta un criterio de audiencia nuevo.** La herramienta admite **una audiencia por envío** —un
`target_oposicion` concreto o un tipo general—, así que una familia es simplemente **N envíos, uno por
cada oposición suya**. Y para casi todas las familias N es pequeño:

| Familia | Oposiciones activas con usuarios | Usuarios | % premium | % premium **teniendo temario** |
|---|---|---|---|---|
| administracion_general | **84** | 8.883 | 2,66 % | 2,67 % |
| justicia | 2 | 572 | 2,05 % | 2,10 % |
| sanidad | 22 | 346 | 2,03 % | 2,28 % |
| **oficios** | **5** | 342 | **3,94 %** | **4,39 %** |
| seguridad | 5 | 269 | **0,60 %** | **0,74 %** |
| tecnica | 2 | 51 | 2,60 % | 3,92 % |

**Cómo usarlo, por familia:**

- **Oficios: 5 envíos cubren la familia ENTERA** (`ordenanza-ayuntamiento-cordoba` 134,
  `ujieres-cortes-generales` 73, `tecnico-auxiliar-universidad-de-murcia` 53, `subalterno-gva` 45,
  `subalterno-parlamento-andalucia` 37). Es la familia que **mejor convierte de todo el catálogo** y la
  que más crece (317 altas en 30 días). Primera opción si hay que elegir uno.
- **Sanidad: los 5 primeros envíos cubren el 57 %** (`tcae-murcia` 67, `tcae-sermas-madrid` 41,
  `tcae-galicia` 36, `auxiliar-enfermeria-gva` 27, `tcae-sas` 27). La cola son 17 oposiciones de
  menos de 20 usuarios: no compensa el envío individual salvo que la promo sea suya.
- **Administración general NO se segmenta**: son 84 oposiciones y el **83 % de toda la base**. Para
  ella la audiencia general YA es su segmento.
- **⛔ A seguridad NO se le manda oferta premium.** 269 usuarios al **0,60 %**, y —esto es lo que
  decide— **0,74 % incluso teniendo temario**, contra el 2,67 % de administrativa. La medición separa
  a propósito quién tiene contenido y quién no, para no confundir «no convierte» con «no tiene qué
  estudiar»: aquí no es falta de producto, es que ese público no compra. El retorno esperado de un
  envío entero son ~2 conversiones, y el coste es fatiga de lista y reputación de envío.

**La familia NO se pregunta: se DEDUCE.** `user_profiles.target_oposicion` → `oposiciones.familia`
cubre el **91,7 %** de los 11.959 usuarios (95,9 % tiene objetivo). Añadir un paso al registro para
preguntarlo sería preguntarle a 9 de cada 10 algo que ya está en la BD, y encima solo captaría a los
nuevos: deducirlo funciona **retroactivamente sobre toda la base**. Las **favoritas no sirven** como
señal supletoria — medido: de los 671 usuarios cuya familia no se puede deducir, solo **6** tienen una
configuración guardada y **2** preguntas guardadas (1,2 %); son función de repaso, no de identidad.

```sql
-- las oposiciones de una familia, ordenadas por audiencia (una fila = un envío)
SELECT o.slug, replace(o.slug,'-','_') AS audience_key, count(u.id) AS usuarios
FROM oposiciones o
JOIN user_profiles u ON replace(o.slug,'-','_') = u.target_oposicion
WHERE o.is_active AND o.familia = 'oficios'
GROUP BY 1,2 ORDER BY usuarios DESC;
```

### 2.0 ELEGIR EL ALCANCE correcto (¡decisión previa, no acotar de menos!)
> **Aprendizaje 05/07 (fallo real en León):** acoté el envío a la **provincia** de León cuando el puesto (Universidad de León) lo puede opositar **toda la comunidad autónoma** → se quedó fuera medio Castilla y León y hubo que hacer un envío make-up. **Regla:** el alcance por defecto de una oposición es **su comunidad autónoma completa**, no solo la provincia.
- **Autonómico / universidad / estatal en una CCAA** → toda la **comunidad autónoma** (todas sus provincias).
- **Provincial (Diputación, ayuntamiento)** → dos opciones válidas; **preguntar a Manuel**:
  1. **Provincia + limítrofes** (incl. provincias de OTRA comunidad si tocan) — más quirúrgico, mejor open/click rate, menos fatiga de lista. **Recomendado para puestos provinciales** (ej. Dip. Jaén → Jaén + Córdoba + Granada + Ciudad Real + Albacete).
  2. Toda la comunidad autónoma — máximo alcance.
- **Uniprovinciales** (La Rioja, Madrid, Murcia, Navarra, Cantabria, Asturias, Baleares): comunidad == provincia.
- Presentar a Manuel el nº de audiencia de cada alcance para que decida (una query por alcance).

### 2.1 DESCUBRIR municipios reales ANTES de fijar la lista (paso obligatorio)
No inventar la lista de memoria: **primero descubrir qué ciudades existen de verdad** en la base con `GROUP BY ciudad` sobre una lista candidata amplia. Así ves los volúmenes reales y cazas falsos positivos antes de enviar:
```sql
SELECT up.ciudad, COUNT(*) n
FROM user_profiles up LEFT JOIN email_preferences ep ON ep.user_id = up.id
WHERE up.email IS NOT NULL AND up.email <> ''
  AND COALESCE(ep.unsubscribed_all,false)=false AND COALESCE(ep.email_newsletter_disabled,false)=false
  AND (up.ciudad ILIKE '%granada%' OR up.ciudad ILIKE '%cordoba%' OR ...)  -- lista candidata
GROUP BY up.ciudad ORDER BY 2 DESC;
```

**GOTCHAS de datos (críticos):**
- `target_oposicion` usa **GUIONES BAJOS** (`administrativo_la_rioja`); `oposiciones.slug` usa **GUIONES** (`administrativo-la-rioja`). Convertir con `slug.replace(/-/g,'_')`.
- `target_oposicion` tiene basura (UUIDs, vacíos) → el match exacto los ignora solo.
- **Geo = `user_profiles.ciudad`** (texto libre). Usar lista amplia de municipios + capital.
- **`ILIKE` es CASE-insensible pero ACENTO-sensible.** `%leon%` NO matchea `"León"`. **Incluir SIEMPRE las dos variantes** con y sin tilde (`"leon"` y `"león"`, `"avila"` y `"ávila"`, `"cordoba"` y `"córdoba"`). En León olvidarlo habría perdido 66 de 102 usuarios.
- **Falsos positivos por substring** (el peligro nº1): nombres cortos o embebidos matchean pueblos de OTRA provincia/comunidad. Casos reales cazados: `%rota%`→"La Orotava" (Canarias); `%jerez%`→"Jerez de los Caballeros" (Badajoz); `%san fernando%`→"San Fernando de Henares" (Madrid); `%sevilla%`→"Sevilla la Nueva" (Madrid); `%león%`→"Salvaleón"/"Gibraleón". **Cazarlos con el GROUP BY (§2.1) y excluirlos con `excludeCiudades`** (§5). OJO: algunos "sospechosos" SÍ son válidos según el alcance (Gibraleón es Huelva; San Leonardo de Yagüe es Soria).
- **Comunidades uniprovinciales**: comunidad == provincia; "toda la comunidad" ya es la provincia.

---

## 3. Plantilla (tabla `email_templates`)

Usar el slug **`inscripcion-abierta`** (formato vistoso: cabecera degradado azul + subtítulo de plazo + caja verde de features con ✅ + **botón CTA arriba** para que no lo esconda el recorte "..." de Gmail).

Variables: `userName`, `nombreOposicion` (cabecera + intro), `subtitulo` (plazo), `textoPlazas`, `features` (items `<li>`), `ctaUrl`, `slug`, `unsubscribeUrl`. Asunto = `{{nombreOposicion}}: {{subtitulo}}`.

Gestionar plantillas en `/admin/newsletters` → tab **Plantillas BD**, o vía `email_templates` en RDS. Para crear/duplicar otra, `INSERT ... ON CONFLICT (slug) DO UPDATE`.

**Precisión:** no afirmar features que la oposición no tenga (p. ej. "Exámenes oficiales" solo si están cargados). Ver `feedback_verificar_existencia_oposicion_metodo`.

---

## 4. Vista previa a Manuel → OK

> **🔒 GATE PRE-ENVÍO OBLIGATORIO (antes de la preview):** la newsletter manda tráfico a la landing, así que la landing y sus datos deben estar **perfectos y verificados contra el boletín oficial**. Corre los tres controles y arréglalo TODO antes de mandar la preview:
> ```bash
> npm run canary:oposiciones -- <slug>     # CAPA 1: landing/temario/test=200, temas sirven preguntas
> npm run audit:coherencia -- <slug>       # CAPA 2: cifras de tarjetas cuadran con la BD
> ```
> y la **CAPA 3** (verificación dato-vs-boletín, `crear-nueva-oposicion.md` §6g): re-confirmar plazas, plazo exacto, titulación y estructura del examen contra el BOE. Si la oposición ya pasó §6g al crearse y la convocatoria no ha cambiado, basta re-confirmar; si cambió, re-verificar. Incidente Granada (09/07): la FAQ del examen estaba incompleta y solo lo cazó esta verificación — **no la saltes**.

SIEMPRE mandar el borrador a **manueltrader@gmail.com** y esperar visto bueno antes del envío masivo. (Nota: Gmail colapsa el pie repetido en "..." cuando recibes varios borradores seguidos; el usuario que lo recibe una vez NO lo ve.)

> **🔒 El preview DEBE ser EXACTO al envío real (regla de Manuel, 09/07):** el correo de vista previa tiene que ser **idéntico** al que recibirán los destinatarios — **mismo asunto y mismo HTML**. **PROHIBIDO** poner "preview", "[PRUEBA]", "TEST" o cualquier marca en el asunto o el cuerpo; si el asunto no es exactamente el que verá el destinatario, el preview no vale. Usar el modo del script:
> ```bash
> node scripts/newsletters/send-promo-inscripcion.cjs <config.json> --preview manueltrader@gmail.com
> ```
> `--preview <email>` renderiza con el MISMO template + userVars que el envío real (asunto `{{nombreOposicion}}: {{subtitulo}}`, sin marcas), manda a UN solo correo, y **NO registra en `email_events` ni crea tokens** → no ensucia la campaña ni las stats. Es la única forma correcta de mandar la vista previa.
>
> **🔎 "No me llega el preview" (gotcha 25/07):** el correo es comercial → **Gmail lo mete en "Promociones" o Spam**, no en Principal — míralo ahí. Si aun así no aparece, **verifica la entrega real en Resend**: `curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/emails/<id>` → `last_event` (`delivered` = salió bien; el `id` lo imprime el envío). Y confirma **a qué cuenta**: el preview va a `manueltrader@gmail.com`; si el destinatario revisa otra bandeja (`mcasadocano@gmail.com`…), no lo verá → reenvíalo a su cuenta.

---

## 5. Envío real

Script permanente: **`scripts/newsletters/send-promo-inscripcion.cjs`** (réplica exacta del endpoint `/api/admin/newsletters/send`: token de baja individual en `email_unsubscribe_tokens` + pixel de apertura + tracking de clics + registro `sent` en `email_events`; rate limit 1/seg).

```bash
export PROD_DATABASE_URL="postgresql://venceadmin:<PASS>@vence-prod...:5432/app"
# 1) config JSON (ver cabecera del script para el esquema)
node scripts/newsletters/send-promo-inscripcion.cjs /tmp/promo.json --dry                     # prueba en seco (cuenta audiencia; OJO: rate-limita 1/seg también)
node scripts/newsletters/send-promo-inscripcion.cjs /tmp/promo.json --preview manueltrader@gmail.com   # vista previa IDÉNTICA (§4)
node scripts/newsletters/send-promo-inscripcion.cjs /tmp/promo.json --send                    # envío real
```

Ejemplo `promo.json`:
```json
{
  "targetOposicion": "administrativo_la_rioja",
  "slug": "administrativo-la-rioja",
  "nombreOposicion": "C1 Administrativo de La Rioja",
  "subtitulo": "Inscripción abierta hasta el 8 de julio",
  "textoPlazas": " Se han convocado <strong>17 plazas</strong> y la inscripcion esta abierta hasta el <strong>8 de julio</strong>.",
  "features": ["<strong>42 temas</strong> del temario oficial", "<strong>Tests por tema</strong> con correccion al instante", "<strong>Repaso</strong> de las preguntas que fallas", "<strong>Estadisticas</strong> de tu progreso"],
  "municipios": ["rioja","logro","calahorra","arnedo","haro","alfaro","lardero","najera","villamediana","navarrete"],
  "excludeCiudades": ["orotava","jerez de los caballeros"],
  "excludeSentCampaignId": "inscripcion-abierta_1783280833224",
  "templateSlug": "inscripcion-abierta"
}
```

**Opciones para audiencia limpia y envíos incrementales** (añadidas 05/07):
- **`excludeCiudades`** (array, opcional): excluye por substring los **falsos positivos** cazados en el GROUP BY (§2.1). No aplica a los que entran por `target_oposicion` exacto (esos son legítimos).
- **`excludeSentCampaignId`** (string, opcional): **no re-enviar** a quien ya recibió una campaña previa (excluye por `user_id` vía `email_events` `sent`). Es el mecanismo para **envíos make-up/incrementales** (p. ej. ampliar de provincia a comunidad) **sin duplicar**. Verificar 0 solapamiento con una query de intersección antes de enviar.

> **GOTCHA `node_modules`:** el config JSON suele estar en scratchpad fuera del repo; ejecutar desde la raíz del repo **o** con `NODE_PATH=<repo>/node_modules node scripts/...`.
> **Envíos grandes (>~350 destinatarios):** a 1/seg superan el timeout de foreground (~10 min). Lanzar en **segundo plano** y verificar `email_events` al terminar. Un dry-run de cientos de líneas también puede agotar el timeout aunque ya haya impreso `👥 Audiencia: N` — basta con leer esa línea.

Alternativa (audiencias predefinidas, no geo): endpoint `/api/admin/newsletters/send` con `templateSlug` + `selectedUserIds` o `audienceType` desde el panel `/admin/newsletters` → tab **Enviar Newsletter**.

---

## 6. Verificar y medir

```sql
-- eventos de la campaña
SELECT event_type, COUNT(*) FROM email_events WHERE campaign_id='<campaignId>' GROUP BY event_type;
```
- **Tab Historial de Envíos** (`/admin/newsletters`): agrupa por `template_id + fecha` y muestra el embudo **Enviados → Abiertos → Open Rate → Clics → CTR** (+ Muy Activos/Activos = usuarios con test en 30/90 días). Lee `email_events WHERE email_type='newsletter'`.
- **Aperturas** (`opened`) las registra el pixel `/api/email-tracking/open`; **clics** (`clicked`) los registra `/api/email-tracking/click` al redirigir. Ambos con `template_id`+`campaign_id` de la campaña.
- Cada columna Enviados/Abiertos/Clics es clicable → lista de usuarios de ese evento.

---

## 7. Buenas prácticas

- **Nunca** saltarse el filtro de consentimiento ni el token de baja individual.
- **Elegir bien el alcance ANTES** (§2.0): por defecto **comunidad autónoma**, no provincia. Para provinciales, ofrecer "provincia + limítrofes" vs comunidad y que Manuel decida con los números.
- Verificar jugabilidad **empíricamente** (§1), no fiarse del `coverage_level` (puede estar stale).
- **Descubrir municipios reales con GROUP BY** (§2.1) antes de fijar la lista; incluir variantes **con y sin tilde** (ILIKE es acento-sensible); excluir falsos positivos con `excludeCiudades`.
- Envíos incrementales (ampliar zona): usar `excludeSentCampaignId` y **verificar 0 solapamiento** antes de enviar.
- **Verificar fechas y plazas contra el boletín OFICIAL** (BOE/BOCYL/BOP), NO deducirlas de la BD. El plazo suele ser "N días naturales/hábiles desde el siguiente a la publicación en BOE". Gotcha de almacenamiento: las fechas en `oposiciones` están guardadas como **día−1 a las 22:00 UTC** (= medianoche hora española del día real); p. ej. `2026-07-12T22:00Z` = "hasta el 13 de julio". Confirmar el día humano con el boletín.
- Vista previa a Manuel + OK (§4) antes del envío masivo (salvo que Manuel diga "envíalo" directamente).
- Tras el piloto de una zona, replicar a las demás con inscripción abierta reusando el mismo script y plantilla, cambiando el `config.json`.

### Leer bien la PUERTA de auditoría (`audit:landing`) — 27/07

La auditoría previa al envío mezcla **dos tipos de hallazgo** y confundirlos cuesta tiempo o, peor, tranquilidad falsa:

- **Recalculados en vivo** (enlaces del HTML servido, cifras contra el documento clonado, botón oficial, completitud): reflejan el estado de AHORA.
- **Heredados del barrido nocturno** (`content_health_findings`, `computed_at` de esa madrugada): `dual_write`, `scope_sin_verificar`, `article_no_coverage`, `documentos_sin_revisar`… **Si acabas de arreglar uno, seguirá saliendo hasta el sweep siguiente.** Compruébalo contra la BD antes de volver a "arreglarlo" (`SELECT computed_at FROM content_health_findings WHERE oposicion_slug='<slug>'`).

**Un ❌ de enlace roto no siempre es un enlace roto.** El chequeo de enlaces ahora hace **retry-once** ante timeout o 5xx (igual que `canary-oposiciones-live.cjs`); antes, una página nuestra tardando 4,1 s en la primera petición (ISR frío) daba veredicto ❌ y **habría bloqueado la campaña por nada**. Un 404 se sigue creyendo a la primera.

**Y lo que la puerta NO mira: que el timeline enseñe las fechas.** El render solo muestra la fecha de los hitos con `origen='registro'`; con `inferencia` pinta *"Fecha por confirmar"*. Antes de anunciar un plazo por correo, **abre la landing** y comprueba que el fin de plazo se ve. Si no, es provenance: `docs/runbooks/provenance-convocatorias.md` §2.4.

### Aprendizajes de medición (05/07)
- **El tracking de clics SÍ funciona** (confirmado: campañas León-CyL y Jaén registraron `clicked` a los minutos). Un envío con alta apertura y **0 clics sostenidos** (caso La Rioja: 50% open, 0 clics en días) apunta a **CTA/desinterés**, no a instrumentación rota.
- **Open rate temprano** (primeros minutos) es buen indicador pero **el CTR real se mide a horas/días** — no concluir CTR=0 recién enviado.

---

## 8. Cross-sell segmentado (promocionar una oposición NUEVA a opositores de otras)

Cuando publicas una oposición **nueva** que aún **no tiene target directo** (nadie la tiene como `target_oposicion`) o quieres captar por afinidad de temario, el envío NO es geográfico sino **cross-sell**: a opositores de OTRAS oposiciones que comparten temario, con la plantilla **`oposicion-cruzada`** ("Prepara X sin empezar de cero"). Caso raíz: **Ujieres de las Cortes Generales (25/07/2026)** — 0 target directo, nacional. Complementa la §14 de `crear-nueva-oposicion.md` (que nombra la plantilla pero no cómo segmentar ni calcular los temas).

### 8.1 Audiencia: por dónde se TRABAJA, no por la CCAA de la oposición
Una oposición **nacional** (Cortes Generales, AGE) no tiene zona propia, pero **el puesto está en un sitio físico**. Ujieres se trabaja **solo en Madrid** (Congreso, Senado, Junta Electoral Central) → la audiencia natural es **la zona del puesto** (Madrid) + quien ya oposita allí. **Investiga SIEMPRE dónde está el puesto** antes de acotar. Para segmentos de oposiciones nacionales/de otra CCAA, filtra por **target AND zona-del-puesto** (los de esa oposición que viven donde se trabaja); para oposiciones de la propia zona (p.ej. Aux. Admin. Madrid) el target ya implica la zona.

### 8.2 El perfil del candidato = TIPO de trabajo, no solo temario
Mira en qué consiste el puesto. Ujieres = servicios generales/subalterno de un edificio (vigilancia, accesos, protocolo, reparto), nivel ESO → perfil de ordenanza/subalterno, no de oficina. Si casi no hay opositores de ese perfil en BD, el cross-sell de calidad es a oposiciones de **mismo NIVEL** (C2/D administrativas) que además comparten el temario general.

### 8.3 Calcular los temas EXACTOS comunes (un correo por oposición)
El gancho es que el candidato vea **SUS** temas, no un genérico. Cruza las leyes del `topic_scope` de la nueva oposición con las de cada oposición candidata (intersección por `law_id`):
```sql
WITH nueva AS (SELECT DISTINCT ts.law_id FROM topics t JOIN topic_scope ts ON ts.topic_id=t.id WHERE t.position_type='<pt_nueva>')
SELECT DISTINCT l.short_name
FROM topics t JOIN topic_scope ts ON ts.topic_id=t.id JOIN laws l ON l.id=ts.law_id
WHERE t.position_type='<pt_candidata>' AND ts.law_id IN (SELECT law_id FROM nueva) ORDER BY 1;
```
Traduce cada ley a lenguaje de correo ("La Constitución", "La Ley 39/2015 del Procedimiento Administrativo", "Los Reglamentos del Congreso y del Senado"…) → `temasComunesHtml` de ESE segmento. **Un envío por segmento**: `temasComunesHtml` es variable global del envío; `oposicionActual` se resuelve por destinatario, pero conviene pasarlo **fijo y limpio** por segmento (el nombre completo trae coletillas tipo "(examen octubre 2026)").

### 8.4 Ganchos de conversión verificados (C2/D)
- **Empleo fijo / estabilidad, NUNCA el salario** — para C2/D el motor es la plaza fija, no el sueldo.
- **Ratio plazas/aspirantes + % de presentación** — p.ej. "en la convocatoria anterior, ~68 aspirantes por plaza, pero solo 1 de cada 3 se presentó → ~22 reales por plaza". Parece durísimo y acaba siendo motivador y honesto (mucha inscripción, poca presentación real).
- **Previsión de examen por histórico** — media del intervalo convocatoria→examen de las últimas convocatorias (Ujieres: 2018 ~11 m, 2022 ~19 m → media ~15 m → previsión "finales de 2027"). Refuerza "tiempo de sobra para prepararte con calma". **SIEMPRE etiquetada como estimación, no oficial** (el `exam_date` de BD sigue NULL; el hito, marcado `origen='estimacion'`).
- Datos SIEMPRE verificados contra fuente (BOE + academias) y enmarcados como "en la convocatoria anterior (año)".

### 8.5 Envío: `send-promo-cruzada.cjs`
El endpoint `/api/admin/newsletters/send` **exige token admin en prod** → para envío por script se usa **`scripts/newsletters/send-promo-cruzada.cjs`** (copia de `send-promo-inscripcion.cjs` con `BASE_VARS` cross-sell; misma infra: token de baja + pixel de apertura + tracking de clics + `email_events` + rate-limit 1/seg + `--dry`/`--preview`/`--send`). Audiencia por `targetOposicion` (`municipios: []` = solo target). Config:
```json
{
  "targetOposicion": "auxiliar_administrativo_madrid",
  "slug": "ujieres-cortes-generales",
  "templateSlug": "oposicion-cruzada-ujieres",
  "nuevaOposicion": "Cuerpo de Ujieres de las Cortes Generales",
  "nuevaOposicionCorta": "Ujieres Cortes Generales",
  "oposicionActual": "Auxiliar Administrativo de la Comunidad de Madrid",
  "temasComunes": ["La <strong>Constitución Española</strong>", "La <strong>Ley 39/2015</strong> del Procedimiento Administrativo", "..."],
  "municipios": []
}
```
Flujo: `--preview manueltrader@gmail.com` (idéntico al real) → OK → `--send` (**background si >~350**, ~1 s/correo). GOTCHA: `NODE_TLS_REJECT_UNAUTHORIZED=0` (cert self-signed de RDS) + `PROD_DATABASE_URL` exportado.
