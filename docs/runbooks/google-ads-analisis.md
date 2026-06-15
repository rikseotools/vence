# Runbook: Análisis de Google Ads / Campañas

**Cuándo seguir este runbook:** cuando Manuel diga *"investiga ads"*, *"campañas"*,
*"rendimiento de anuncios"*, *"dónde meto presupuesto"*, *"qué tal van los anuncios"*
o similar. Léelo ANTES de improvisar.

> Integración técnica: ver `scripts/google-ads/README.md` y `lib/services/googleAds/`.
> Decisión rectora de Manuel: **mantener puja por CLIC** (no pujar por valor).

---

## TL;DR — qué dicen los datos (aprendizajes 02/06/2026, 290 ventas / 9.232€)

1. ⚠️ **CUESTIONADA (15/06/2026) — NO usar como hecho.** Afirmación original (02/06):
   "la gente compra premium más cerca del examen; pico 0-30 días antes (85 ventas,
   2.174€, media 15 días)". **Re-comprobada el 15/06 con `oposiciones.exam_date` (no
   `convocatoria_hitos`) sobre 332 pagos: NO se sostiene.** Distribución real (156 con
   fecha de examen conocida; 176 = 53% SIN fecha): 0-30d **7,8%**, 31-60d 3,9%, 61-90d
   3,9%, **91-180d 19,0%** (el mayor), >180d 12,3%. El "pico 0-30 días" se calculó con
   `convocatoria_hitos` (fuente que el propio runbook marca como NO fiable, ver §Modelo
   de datos) → sesgada. **Conclusión: no concentrar la decisión de pausar/activar en la
   cercanía del examen hasta re-analizar bien.** (Pendiente: recomputar la ventana de
   compra con exam_date limpio y rellenar los exam_date NULL.)
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

## 🛑 "Empujar caro en ventana de examen" NO funciona (investigado 15/06/2026)

**Mito refutado.** El TL;DR original sugería empujar gasto/puja cerca del examen "aunque
sea caro". Tres líneas de evidencia independientes dicen que NO genera ventas extra:

1. **Experimento CPC directo (07-11/06):** carm y SS estaban EN ventana de examen cuando se
   les subió la puja 3× (techo 0,05€→0,15€). Resultado: **0 ventas extra**, solo más coste
   (carm ROI 6,4×→4,3×). Pagar más caro no compró ni una venta.
2. **Reparto de canales (post-02/06, tracking fiable, 44 ventas):** Google Ads solo genera el
   **14%** de las ventas (6). El 45% es `direct` (URL/marca/orgánico), el resto email,
   notificaciones, chatgpt. **La demanda caliente cerca del examen la capturan canales
   PROPIOS, no ads.**
3. **Nadie agota presupuesto** (usan 14-19% del diario) → subir presupuesto tampoco mueve la
   aguja. En esta cuenta **no hay palanca de ads efectiva para forzar más ventas**.

**Regla corregida:** cerca del examen, mantener presencia **eficiente** (CPC bajo). El timing
de compra (la gente compra cerca del examen) es real, PERO no se "compra" con ads más caros;
ocurre por canales propios. Invertir en ads a CPC bajo SÍ aporta (14%, rentable); encarecerlo
NO. Matiz: atribución last-click infravalora algo a ads (parte del `direct` pudo nacer de un
anuncio), pero ni así se justifica encarecer. Reproducir: query de canal = `conversion_events`
(payment_completed, ≥2026-06-02) ⋈ `user_acquisition.channel`.

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
2. **¿Examen ≤ ~60 días?** → mantener presencia **EFICIENTE** (CPC bajo), NO encarecer.
   ⚠️ **CORREGIDO 15/06/2026:** el consejo anterior ("empujar aunque sea caro") está
   **REFUTADO por los datos** — ver §"Empujar caro en ventana de examen NO funciona".
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
  `target_spend:{cpc_bid_ceiling_micros:50000}` (0,05€, el estándar de TODAS las campañas — verificado 15/06: carm, SS y Córdoba a 0,05€. Subir el techo cerró en NEGATIVO el 11/06 y carm/SS se revirtieron a 0,05€; ver §"Experimento CERRADO: techo de CPC". El cuello es el Quality Score, no la puja).

**Caso real 02/06:** `Aux Admin SCS Canarias` (campaña `23897199300`), 3€/día, geo Canarias
(20277), español, 4 keywords sin marca, 7 titulares/3 descripciones, 643 plazas. Creada
activa con un solo `mutateResources` (10 recursos) tras dry-run OK.

## 🧪 Experimento CERRADO: techo de CPC (07/06 → 11/06/2026) — RESULTADO NEGATIVO

> **Veredicto (11/06): subir el techo de CPC NO funciona. Revertidas carm + SS a 0,05€.**
> Pagar 2-3× más por clic **no ganó ni una subasta más**: la cuota de impresiones de las
> tratadas se quedó clavada en 13% mientras el control subía a 16% por efecto-examen.
> El cuello **no es la puja, es el Quality Score** (relevancia anuncio/landing). Próxima
> palanca = copy/landing, NO pujar más. Datos y razonamiento abajo.

### Resultado medido (LAST_7_DAYS al 11/06)

| | IS | CPC | coste 7d | ventas | ROI | Lectura |
|---|---|---|---|---|---|---|
| **carm** (tratada 0,15€) | 16% | **0,082€** | 18,42€ | 2 | **4,29×** | mismas 2 ventas que a 0,05€ pero coste 12€→18€: el techo solo encareció el clic (ROI 6,44×→4,29×) |
| **SS** (tratada 0,15€) | 10% | **0,111€** | 12,37€ | **0** | **0×** | 12€ a CPC 0,11€ sin una sola venta |
| **Control** (0,05€) | **16%** media | ~0,04€ | — | varias | — | CAM 15,75× · Extremadura IS 28%/6,63×: las baratas convierten mejor |

- **Métrica decisiva:** IS media **tratadas 13% vs control 16%** (baseline 07/06 era 13%=13%).
  Las tratadas NO se movieron; el control subió por efecto-examen. → la puja no aporta IS.
- **perdRank** siguió en **84-90%** en las tratadas pese a pujar 3×: el techo alto no
  cambió el % de subastas perdidas por rank → confirma que el cuello es **Quality Score**,
  no la puja. Cumplió **dos** filas "Revertir" de la tabla de decisión a la vez (IS plana
  como el control + CPC saltando con IS plana).

**Aprendizaje permanente:** en esta cuenta, con perdRank ~85-90% y `abs-top == IS`, **subir
el techo de CPC es quemar dinero** — no compra presencia, solo encarece el clic. La única
palanca que queda es **mejorar el Quality Score** (copy del RSA + relevancia de landing),
que sube el Ad Rank pagando lo mismo. Pendiente: trabajar copy de SS (CTR esperado bajo).

<details><summary>Diseño original del experimento (histórico)</summary>

**Hallazgo que lo motiva:** las campañas que más venden (carm, Madrid, seg. social)
**NO están limitadas por presupuesto, sino por RANKING.** Métricas 07/06 (LAST_30_DAYS):
cuota de impresiones (`search_impression_share`) ~10%, perdido por **rank** 86-90%,
perdido por **presupuesto** solo 2-3%. Gastan 0,2-0,8€/día de un presupuesto de 3-5€/día.
→ **Subir el presupuesto es un no-op** (no agotan el que tienen). La palanca real es el
**techo de CPC** (todas estaban a 0,05€). Además `abs-top IS == IS`: cuando salen ya son
#1, así que subir la puja **no mejora posición, aumenta presencia** (entrar en más subastas).
Ojo: Google **no ofrece simulador de pujas** para "Maximizar clics" (TARGET_SPEND) → el
único modo de saber el efecto es **probar y medir**.

**Diseño = diferencia-en-diferencias (para que el "efecto examen" no contamine):**
- TRATADAS → techo **0,15€**: `aux admin carm` (23727564870, examen 21-jun) +
  `c1 administrativo ss` (23745484739, examen 28-jun).
- CONTROL → resto de campañas TARGET_SPEND a **0,05€** (viven el mismo mercado/examen).
- **Métrica limpia (insensible al volumen de búsqueda):** cuota de impresiones (`IS`) y
  `% perdido por rank`. Si la IS de las tratadas sube y la del control no → **es la puja,
  no el examen**. Clics/CPC/coste suben por puja *y* por examen (leer con cuidado);
  registros/ventas = N pequeño, solo direccional.
- **Baseline 07/06 (LAST_7_DAYS):** IS media tratadas 13% = control 13% (igualado).

**Herramientas (creadas 07/06):**
- `npm run ads:campaign -- ceiling <id> <eur> [--apply]` — fija el techo de CPC (dry-run
  por defecto; valida que la estrategia sea TARGET_SPEND). Servicio: `setCampaignCpcCeiling`.
- **Lectura del experimento:** `npx tsx --env-file=.env.local scripts/google-ads/cpc-experiment.ts LAST_7_DAYS`
  → imprime tratadas vs control con IS/top/abs-top/perdido-rank/CPC/clics/coste/registros.
  (Editar el set `TREATED` del script si cambian las campañas del experimento.)

**Cómo ANALIZARLO cuando Manuel lo pida de nuevo (~10-12/06):**
1. Correr `cpc-experiment.ts LAST_7_DAYS` (y `YESTERDAY` para ver lo más fresco).
2. Comparar la **IS media de tratadas vs control** contra el baseline (13% = 13%).
3. Aplicar la regla de decisión:

| Resultado | Significado | Acción |
|---|---|---|
| IS tratadas ↑ (13%→25%+) y **control ~plano** | La puja funciona | Mantener + extender a Madrid (23697376522) |
| IS tratadas ↑ **igual que control** | Efecto-examen general, no la puja | Revertir a 0,05€ |
| CPC medio salta a ~0,15€ con **IS plana** | Competencia cara, no se gana ni pujando 3× | Revertir a 0,05€ |
| IS ↑ pero coste/registro empeora sin más ventas | Presencia que no convierte | Revertir |

**Tope de seguridad:** el presupuesto diario (5€ carm / 3€ SS) limita el gasto pase lo que
pase. **Revertir a 0,05€ tras el examen** (carm 21-jun, SS 28-jun) — se cierra la ventana.
Revertir = `ads:campaign -- ceiling <id> 0.05 --apply`.

</details>

**Siguiente frente abierto — Quality Score (la palanca que SÍ queda):**
- Sacar la evolución del **QS por keyword** (query en la sección de abajo). El experimento
  confirmó que dar impresiones pujando no basta: si la IS no sube pese a pujar 3×, el cuello
  es la **relevancia** (anuncio/landing) → tocar copy/landing, no pujar.
- Revisar el **copy de SS**: su punto débil medido es el **CTR esperado "por debajo de la
  media"** (la landing y la relevancia del anuncio están OK). Mejorar titulares/copy del
  RSA sube el CTR → sube el QS → mejor Ad Rank pagando lo mismo. **Es el siguiente paso
  recomendado** ahora que el experimento de puja cerró en negativo.

### Qué se sabe (y qué NO) de Ad Rank / Quality Score

- **Ad Rank ≈ puja × Quality Score + contexto.** Es lo que decide si apareces (umbral
  mínimo) y en qué orden. Subasta de **segundo precio**: pagas lo justo para batir al de
  abajo, nunca más que tu techo (por eso CPC medio 0,038€ < techo 0,05€).
- **Tu Quality Score: SÍ se sabe**, a nivel de KEYWORD (no campaña/anuncio). 1-10 + 3
  sub-notas (relevancia anuncio / experiencia landing / CTR esperado, cada una
  below/avg/above). Solo se puebla con datos suficientes (keywords de poca presencia → "—").
  Query:
  ```sql
  SELECT campaign.name, ad_group_criterion.keyword.text,
         ad_group_criterion.quality_info.quality_score,
         ad_group_criterion.quality_info.creative_quality_score,
         ad_group_criterion.quality_info.post_click_quality_score,
         ad_group_criterion.quality_info.search_predicted_ctr,
         metrics.impressions
  FROM keyword_view
  WHERE campaign.id IN (<ids>) AND segments.date DURING LAST_30_DAYS
  ORDER BY metrics.impressions DESC
  ```
  (enum sub-notas: 2=BELOW_AVERAGE, 3=AVERAGE, 4=ABOVE_AVERAGE). Baseline 07/06:
  SS QS=7 (CTR esperado por debajo media = punto débil = copy); carm sin QS (sin datos).
- **Tu Ad Rank exacto: NO se sabe** (Google nunca da el número). Se infiere por cuota de
  impresiones + `% perdido por rank`.
- **QS / Ad Rank / puja de la COMPETENCIA: imposible** (nadie ve los de otro anunciante).
  Lo más cercano = informe **"Estadísticas de subasta" (Auction Insights)**: dominios con
  los que coincides, outranking/position-above-rate, su cuota de impresiones — **NO su QS
  ni su puja**. Es **solo-UI** (no fiable por API) → mirar a mano en ads.google.com.

**Dos palancas para subir en subastas:** (1) **puja** (techo CPC) → más presencia, lo que
estamos probando; (2) **Quality Score** → gratis y permanente, mejor Ad Rank pagando lo
mismo; se sube con relevancia de anuncio (copy/CTR) y de landing.

## 🎯 Cómo alcanzar a MÁS gente (diagnóstico 11/06/2026)

**Punto de partida (medido):** el **Quality Score es BUENO** donde hay datos (carm 7-10, SS
7-8, Extremadura 7-10; anuncio "alto", landing media/alta). **No hay nada roto que arreglar
en copy/landing.** Y el experimento de puja cerró en negativo. Conclusión: **la búsqueda
(Search) está TOPADA** — el volumen de gente que busca nuestras keywords ya lo capturamos en
buena parte, y el resto se lo llevan academias grandes con presupuestos enormes. Ni pujando
ni mejorando QS sacamos mucho más de Search. El alcance extra viene de **otros canales**:

1. **Remarketing** — a quien ya visitó y no se registró. Lo más rentable (convierte mejor
   que el frío). **⚠️ HOY BLOQUEADO** — ver estado abajo.
2. ~~**Broad match en las 3 ganadoras**~~ **CERRADO/DESCARTADO (11/06): ya estaban en broad.**
   Al ir a montar el experimento se descubrió que las 3 ganadoras **ya usan broad match** en
   su núcleo (Extremadura 22 kw broad, CAM 18 kw broad, carm 3 kw broad que traen 1.753 impr
   vs 396 de sus 11 phrase). El broad **ya es la palanca activa de alcance y funciona** (las
   broad traen el grueso de impresiones; Extremadura/CAM van 100% broad con ROI 8.9×/15.8×).
   → No hay nada que convertir. Lección: **broad + maximizar clics SÍ funciona en esta cuenta**
   (contra la teoría general), seguramente porque las keywords son de intención muy específica
   (nombre de oposición). Verificar match type con `ad_group_criterion.keyword.match_type`
   (enum 2=EXACT 3=PHRASE 4=BROAD) antes de asumir nada.
3. **YouTube / Demand Gen** — vídeo barato por impresión, gran alcance, embudo alto
   (notoriedad, no venta directa). Requiere creatividad en vídeo.
4. **SEO orgánico** (runbook `seo-oportunidades.md`) — la mayor demanda no capturada y sin
   guerra de pujas. Ads NO lo sube; se sube con contenido + enlaces. Mayor potencial a medio
   plazo.
5. **Más oposiciones vendibles** — cada mercado nuevo = gente nueva (lo que ya se hace con
   las TCAE).

### 🔴 Estado del REMARKETING (Punto 1) — investigado 11/06: NO se puede lanzar aún

- **Audiencia vacía:** `All visitors (AdWords)` = **110 en Search / 40 en Display**. Google
  exige **mínimo 1.000 (Search) / 100 (Display)** para servir. No hay a quién mostrar.
  Query: `SELECT user_list.name, user_list.size_for_search, user_list.size_for_display FROM user_list`.
- **Causa = recogida deficiente:** el tag de Google Ads `AW-7929322521` (en
  `components/GoogleAnalytics.js`) **solo se carga si el usuario acepta cookies**
  (`consent.analytics === true`) y **NO hay Google Consent Mode v2**. Sin Consent Mode, el
  que no acepta no entra en la lista ni como señal modelada → en España (mayoría rechaza) la
  lista no crece. Por eso solo 110 personas pese al tráfico real.
- **El "experimento" del punto 1 es un proyecto de habilitación en 3 fases, NO un flip:**
  1. ✅ **HECHO (11/06) — Consent Mode v2** (Advanced) implementado: `components/ConsentModeDefault.tsx`
     (default `denied` en `<head>`, `beforeInteractive`) + `GoogleAnalytics.tsx` (carga el tag
     siempre, ya no condicionado) + `CookieConsent.tsx` (emite `gtag('consent','update')` al
     aceptar). Ahora el tag carga siempre y Google modela audiencias con consent denegado →
     la lista de remarketing debería empezar a crecer respetando RGPD.
  2. ⏳ **MIDIENDO — esperar a que `All visitors` supere 1.000 en Search.** Baseline 11/06:
     **110 Search / 40 Display**. Query de medición:
     `SELECT user_list.name, user_list.size_for_search, user_list.size_for_display FROM user_list`.
     - **Checkpoint 1 — ~18/06/2026 (1 semana):** ¿la lista CRECE vs 110/40? No hace falta que
       llegue a 1.000; solo confirmar tendencia ↑ = el Consent Mode está poblando. Si sigue
       plana → revisar GA4 DebugView/Tag Assistant (pings de consent) y que en la cuenta Ads
       "Orígenes de audiencia" tiene el modelado activo. **Anotar la cifra aquí.**
     - **Checkpoint 2 — ~02/07/2026 (3 semanas):** ¿superó 1.000 en Search? → pasar a fase 3.

     | Fecha | Search | Display | Nota |
     |---|---|---|---|
     | 11/06 (baseline) | 110 | 40 | Consent Mode v2 recién desplegado |
     | ~18/06 | _pendiente_ | _pendiente_ | checkpoint tendencia |
     | ~02/07 | _pendiente_ | _pendiente_ | checkpoint umbral 1.000 |
  3. ⬜ **PENDIENTE — lanzar** campaña de remarketing cuando la lista pase de 1.000 (Search con
     observación/segmentación de audiencia, o Display) a quien visitó y no se registró.
- **Verificación post-deploy pendiente:** GA4 DebugView + Tag Assistant (pings default denied →
  update granted). Revisar que `/privacidad` menciona Consent Mode (tema legal de Manuel).
- **Mientras tanto:** Meta Pixel sí captura (`lib/metaPixelCapture.ts`) → el remarketing en
  Meta/Facebook podría estar menos bloqueado; valorar como vía alternativa.

## Caveats (no olvidar)

- `metrics.conversions` = **registros**, no compras. No es ROI.
- La atribución de ingreso **por campaña** solo existe **hacia delante** (post deploy 02/06). Para histórico, usar `target_oposicion` (por oposición, no por campaña).
- La ventana de compra es correlación (cerca del examen el pool es mayor), pero la señal accionable —*las ventas se concentran cerca del examen*— es robusta.
- Verificar siempre si hay **nueva convocatoria** antes de apagar una campaña por "examen pasado".
