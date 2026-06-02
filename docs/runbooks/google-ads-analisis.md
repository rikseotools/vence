# Runbook: Análisis de Google Ads / Campañas

**Cuándo seguir este runbook:** cuando Manuel diga *"investiga ads"*, *"campañas"*,
*"rendimiento de anuncios"*, *"dónde meto presupuesto"*, *"qué tal van los anuncios"*
o similar. Léelo ANTES de improvisar.

> Integración técnica: ver `scripts/google-ads/README.md` y `lib/services/googleAds/`.
> Decisión rectora de Manuel: **mantener puja por CLIC** (no pujar por valor).

---

## TL;DR — qué dicen los datos (aprendizajes 02/06/2026, 290 ventas / 9.232€)

1. **La gente compra premium MÁS cerca del examen.** Pico absoluto: **0-30 días
   antes** (85 ventas, 2.174€, media **15 días**). Decae cuanto más lejos está el
   examen. → **Examen inminente = momento dulce de venta, NO "demasiado tarde".**
2. **Examen ya pasado → la fuente se seca.** Apenas hay ventas tras el examen.
   La única regla casi segura: *"examen pasado = apagar/reducir, salvo nueva convocatoria"*.
3. **El coste/registro POR SÍ SOLO engaña.** Hay que cruzarlo con (a) **fecha de
   examen** y (b) **ingreso real atribuido**. Ejemplo real: Madrid tenía los
   registros más baratos (0,69€) pero su examen ya había pasado → leads débiles;
   carm tenía registros caros (3,90€) pero examen en 3 semanas → leads calientes.
4. **Mayor oportunidad: oposiciones que VENDEN mucho pero NO se anuncian.**
   `auxiliar_administrativo_estado` = #1 (2.797€, 30% del total) con poca/ninguna
   campaña. `auxiliar_administrativo_valencia` (645€, ticket más alto ~54€) sin campaña.

---

## Dónde mirar (herramientas)

- **Panel admin:** `/admin/ads` — selector de rango, campañas ordenables por columna,
  €/registro con semáforo (verde barato / rojo caro o examen pasado).
- **CLI** (necesitan `.env.local`):
  - `npm run ads:report [RANGO]` — coste/clics/conversiones por campaña.
  - `npm run ads:roi [RANGO]` — coste vs ingreso atribuido por campaña.
  - `npm run ads:tracking` — estado del tracking (final_url_suffix).
  - `npm run ads:campaign -- pause/enable/budget <id> [--apply]` — gestión (dry-run por defecto).

---

## Modelo de datos — cómo se enlaza todo

- **Coste / clics / registros por campaña** → Google Ads API (`metrics`). Ojo: la
  conversión activa que cuenta Google es **"Registro"**, NO compra (la action
  "purchase" está oculta). O sea, `metrics.conversions` = registros, no ventas.
- **Campaña → oposición** → la **URL final del anuncio** lleva el slug:
  `ad_group_ad.ad.final_urls` → `https://www.vence.es/auxiliar-administrativo-madrid`.
- **Ingreso real por CAMPAÑA (hacia delante)** → `user_acquisition`
  (`utm_campaign` = ID numérico de campaña) ⋈ `conversion_events.amount`.
  ⚠️ Solo registros posteriores al deploy del 02/06/2026.
- **Ingreso histórico por OPOSICIÓN** → `conversion_events` (event_type
  `payment_completed`, `event_data->>'amount'`) ⋈ `user_profiles.target_oposicion`.
  (target usa guiones_bajos; el slug usa guiones → `replace(target_oposicion,'_','-')`).
- **Fecha de examen** → **FUENTE ÚNICA `oposiciones.exam_date`** (+ `exam_date_approximate`),
  mantenida por el manual de OEPs (`docs/maintenance/oeps-convocatorias-seguimiento.md`
  §4e) con la **OEP vigente**. ⚠️ NO usar `convocatoria_hitos` para esto: mezcla OEPs
  viejas y se queda con un examen pasado aunque haya OEP nueva (error real 02/06: Madrid
  marcado "pasado 12-abr" cuando su OEP nueva tiene examen ~oct-2026 en `exam_date`).

---

## Cómo investigar (queries probadas — ejecutar con `node --env-file=.env.local`)

**A) Ingreso histórico por oposición** (dónde se vende de verdad):
```sql
SELECT up.target_oposicion, count(*) ventas,
       sum((ce.event_data->>'amount')::numeric) ingreso
FROM conversion_events ce JOIN user_profiles up ON up.id=ce.user_id
WHERE ce.event_type='payment_completed'
GROUP BY up.target_oposicion ORDER BY ingreso DESC NULLS LAST;
```

**B) Ventana de compra respecto al examen** (cuándo compran):
```sql
SELECT CASE WHEN ex.fecha IS NULL THEN 'sin fecha'
            WHEN (ex.fecha-ce.created_at::date)<=30 THEN '0-30d'
            WHEN (ex.fecha-ce.created_at::date)<=60 THEN '31-60d'
            WHEN (ex.fecha-ce.created_at::date)<=90 THEN '61-90d'
            ELSE '>90d' END ventana,
       count(*) ventas, round(avg(ex.fecha-ce.created_at::date)) dias_medios
FROM conversion_events ce JOIN user_profiles up ON up.id=ce.user_id
LEFT JOIN LATERAL (
  SELECT h.fecha FROM convocatoria_hitos h JOIN oposiciones o ON o.id=h.oposicion_id
  WHERE o.slug=replace(up.target_oposicion,'_','-') AND h.titulo ILIKE '%examen%'
    AND h.fecha>=ce.created_at::date ORDER BY h.fecha ASC LIMIT 1) ex ON true
WHERE ce.event_type='payment_completed' GROUP BY 1;
```

**C) Fecha de examen por campaña**: sacar `ad_group_ad.ad.final_urls` de la API →
slug → `SELECT exam_date::text, exam_date_approximate FROM oposiciones WHERE slug=…`.
Esa columna ya tiene el **próximo** examen de la OEP vigente (NO derivar de hitos).
El panel `/admin/ads` ya lo hace (`lib/services/googleAds/roi.ts → examInfoBySlug`).

---

## Framework de decisión de presupuesto

En orden de prioridad:
1. **¿Examen ya pasó?** → apagar/reducir (salvo nueva convocatoria a la vista). Único veredicto casi seguro.
2. **¿Examen ≤ ~60 días?** → es la ventana de venta; **empujar** aunque los registros sean caros.
3. **¿Oposición que vende histórico pero SIN campaña?** (estado, valencia…) → **crear/financiar campaña**. Suele ser la mayor oportunidad.
4. **Cuando `ads:roi` muestre ingreso > 0** (atribución real fluyendo) → validar con ROI real, no solo con registros.

---

## Crear una campaña nueva para una oposición (apartado 02/06/2026)

**Modelo de las exitosas:** Search · **Maximizar clics** (`target_spend`) con **CPC máx
0,05€** (`cpc_bid_ceiling_micros: 50000`) · **~3€/día** · geo = **comunidad de la oposición**
(regional, NO toda España) · idioma español · 1 grupo · 1 anuncio RSA · keywords de
intención (SIN marca).

**Nombre de la campaña (norma Manuel):** SIEMPRE prefijo de grupo **`C2`** (Auxiliar
Administrativo, Auxilio Judicial…) o **`C1`** (Administrativo, Tramitación Procesal…) +
nombre claro. Si hay ambigüedad territorial, desambiguar (ej: `C2 Aux Admin Generalitat
Valenciana` para la comunidad, NO confundir con el ayuntamiento). Ejemplos:
`C2 Aux Admin Generalitat Valenciana`, `C2 Auxilio Judicial`.

**Antes de crear:**
1. **`oposiciones.exam_date`** — rellénalo si está NULL (sin él no sabes la ventana de venta).
2. **Territorial: NO confundir ayuntamiento vs comunidad** — hay oposiciones distintas con nombre parecido (Generalitat Valenciana ≠ Ayuntamiento de Valencia). Verifica el `nombre` y usa el geo correcto (comunidad autónoma vs ciudad).
3. Datos: `nombre`, `plazas_libres`, landing `vence.es/<slug>`.
4. **Geo correcto** (los nombres están en INGLÉS): `SELECT geo_target_constant.id, name
   FROM geo_target_constant WHERE name LIKE 'Canar%' AND country_code='ES'` →
   "Canary Islands"=20277, "Region of Murcia"=20284, "Valencian Community"=21388, **España=2724
   (oposiciones NACIONALES: Auxilio Judicial, Tramitación, Guardia Civil…)**. Idioma español = `languageConstants/1003`.

**Keywords:** solo intención de oposición (slug, nombre largo, variantes). **NUNCA la marca
("vence oposiciones")** — ya rankeas gratis en orgánico; pujar por marca = malgastar (y si
acaso, va en una campaña de marca aparte, defensiva). Con **Basic Access**: generar con
`customer.keywordPlanIdeas.generateKeywordIdeas({customer_id, url_seed:{url}})` (volumen
real). Sin Basic (explorer) está bloqueado → a mano.

**Copy RSA:** titulares **≤30 car** (mín 3), descripciones **≤90 car** (mín 2). Ganchos
reales: **nº de plazas**, "temario oficial", "empieza gratis". **NO** referencias de BOC/BORM
(ruido para el usuario).

**Creación = `customer.mutateResources([...])` atómico** (temp IDs negativos), en orden:
`campaign_budget(-1)` → `campaign(-2)` → 2×`campaign_criterion`(geo+idioma) → `ad_group(-3)`
→ `ad_group_ad`(RSA) → N×`ad_group_criterion`(keywords). **SIEMPRE `{validate_only:true}`
(dry-run) antes de aplicar.**

**Gotchas (errores reales):**
- `campaign.contains_eu_political_advertising='DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'` — **OBLIGATORIO** desde 2025.
- `generateKeywordIdeas` necesita `customer_id` explícito **y Basic Access**.
- `campaign.network_settings` (target_google_search:true, content:false), `delivery_method:'STANDARD'`.
- El anuncio pasa **revisión de Google** (minutos-horas) antes de servir.
- Crear como `status:'ENABLED'` publica; `'PAUSED'` la deja en pausa.
- ⚠️ **`target_spend:{}` SIN `cpc_bid_ceiling_micros` = sin techo de CPC** → puede pagar de
  más por clic y fundir el presupuesto en pocos clics. Pon SIEMPRE el techo en el create:
  `target_spend:{cpc_bid_ceiling_micros:50000}` (0,05€, el estándar de las campañas; carm usa 0,10€).

**Caso real 02/06:** `Aux Admin SCS Canarias` (campaña `23897199300`), 3€/día, geo Canarias
(20277), español, 4 keywords sin marca, 7 titulares/3 descripciones, 643 plazas. Creada
activa con un solo `mutateResources` (10 recursos) tras dry-run OK.

## Caveats (no olvidar)

- `metrics.conversions` = **registros**, no compras. No es ROI.
- La atribución de ingreso **por campaña** solo existe **hacia delante** (post deploy 02/06). Para histórico, usar `target_oposicion` (por oposición, no por campaña).
- La ventana de compra es correlación (cerca del examen el pool es mayor), pero la señal accionable —*las ventas se concentran cerca del examen*— es robusta.
- Verificar siempre si hay **nueva convocatoria** antes de apagar una campaña por "examen pasado".
