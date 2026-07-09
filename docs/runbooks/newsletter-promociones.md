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

SIEMPRE mandar el borrador a **manueltrader@gmail.com** y esperar visto bueno antes del envío masivo. (Nota: Gmail colapsa el pie repetido en "..." cuando recibes varios borradores seguidos; el usuario que lo recibe una vez NO lo ve.)

> **🔒 El preview DEBE ser EXACTO al envío real (regla de Manuel, 09/07):** el correo de vista previa tiene que ser **idéntico** al que recibirán los destinatarios — **mismo asunto y mismo HTML**. **PROHIBIDO** poner "preview", "[PRUEBA]", "TEST" o cualquier marca en el asunto o el cuerpo; si el asunto no es exactamente el que verá el destinatario, el preview no vale. Usar el modo del script:
> ```bash
> node scripts/newsletters/send-promo-inscripcion.cjs <config.json> --preview manueltrader@gmail.com
> ```
> `--preview <email>` renderiza con el MISMO template + userVars que el envío real (asunto `{{nombreOposicion}}: {{subtitulo}}`, sin marcas), manda a UN solo correo, y **NO registra en `email_events` ni crea tokens** → no ensucia la campaña ni las stats. Es la única forma correcta de mandar la vista previa.

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

### Aprendizajes de medición (05/07)
- **El tracking de clics SÍ funciona** (confirmado: campañas León-CyL y Jaén registraron `clicked` a los minutos). Un envío con alta apertura y **0 clics sostenidos** (caso La Rioja: 50% open, 0 clics en días) apunta a **CTA/desinterés**, no a instrumentación rota.
- **Open rate temprano** (primeros minutos) es buen indicador pero **el CTR real se mide a horas/días** — no concluir CTR=0 recién enviado.
