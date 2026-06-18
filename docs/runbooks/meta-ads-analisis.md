# Runbook: Análisis y gestión de Meta Ads (Facebook / Instagram)

**Cuándo seguir este runbook:** cuando Manuel diga *"meta ads"*, *"facebook ads"*,
*"instagram ads"*, *"campañas de meta"*, *"publi en meta"* o similar. Léelo ANTES de improvisar.

> Hermano del runbook de Google Ads (`docs/runbooks/google-ads-analisis.md`).
> Decisión rectora de Manuel: **pujar por CLIC con techo bajo** (no por conversiones, que
> arrancan caras en Meta por la fase de aprendizaje). Mismo criterio que en Google Ads.

---

## TL;DR — aprendizajes (17/06/2026, primer lanzamiento)

1. **Cliente ideal que PAGA (datos reales sobre 343-344 pagadores con suscripción):**
   - **Género: 73% MUJERES**, 26% hombres → segmentar **mujeres**.
   - **Edad: media 39, mediana 39.** Tramos: 18-24 **3%**, 25-34 34%, 35-44 33%, 45-54 **25%**,
     55-64 6%, 65+ 0%. → segmentar **25-55** (captura ~92%; NO 18-45, que tira dinero en
     jóvenes que no pagan y excluye el 45-54 que es 1 de cada 4 ventas).
   - Regla por defecto para CUALQUIER campaña: **mujer, 25-55, de la comunidad de la oposición.**
2. **Conversiones vs clic:** las campañas de objetivo *Conversiones* arrancan caras (Meta
   necesita ~50 conv/semana para optimizar; con presupuesto bajo no aprende). Para el volumen
   de Vence → **objetivo Tráfico + puja por clic con techo (LOWEST_COST_WITH_BID_CAP)**.
3. **Histórico (campañas viejas, dic-2025):** la de "tráfico 5 céntimos" tuvo CTR **5,3%** y
   clic a **0,049€** (excelente como tráfico) PERO **0 ventas** atribuidas a `meta` y solo 17
   registros → el clic barato traía curiosos. Lección: el clic barato sirve si **segmentas al
   perfil que paga** (mujer 25-55 de la comunidad) y apuntas a oposición **en ventana 1-6 meses**.
4. **Qué anunciar:** cruzar oposiciones que YA convierten en Google Ads (Madrid, Valencia,
   Galicia, Extremadura…) con examen en **ventana 1-6 meses** y ámbito = su comunidad.
5. **Geo según ámbito:** autonómicas/locales → su comunidad (ej. Madrid región key `1019`);
   estatales (Aux. Estado, Tramitación, Auxilio Judicial, Guardia Civil) → toda España.

---

## Estado actual (17/06/2026)

- **Campaña LIVE:** `Vence - Aux Admin Madrid - CPC 0,05` (id `120248843615420287`).
  - Conjunto `120248843621630287`: **3 €/día**, puja máx **0,05 €/clic**
    (`LOWEST_COST_WITH_BID_CAP`, optimiza `LINK_CLICKS`), **mujeres 25-55, Comunidad de Madrid**,
    ubicaciones automáticas (FB + IG).
  - **6 anuncios** A/B (verde/rojo/carmesí/bandera, logo arriba-izq vs abajo-dcha), link
    `vence.es/auxiliar-administrativo-madrid?utm_source=meta&utm_medium=cpc&utm_campaign=aux-admin-madrid&utm_content=<variante>`.
- Campañas viejas pausadas: "trafico vence 5 centimos", "Clientes potenciales",
  "Aux Administrativo precio-click" (usaban la página vieja ILoveTest).

---

## Dónde mirar (herramientas)

- **Panel Meta:** [adsmanager.facebook.com](https://adsmanager.facebook.com) (cuenta `1434555860947951`).
- **API (Marketing API v21.0)** con credenciales en `.env.local`:
  - `META_ADS_ACCESS_TOKEN` — token System User "Conversions API System User" (no caduca;
    scopes `ads_management`, `ads_read`, `business_management`, `pages_manage_ads`).
  - `META_AD_ACCOUNT_ID=act_1434555860947951`
  - `META_ADS_APP_ID=1814354752867148` (app "Vence Ads Manager", en modo **Live**)
  - `META_PAGE_ID=1222080577647979` (página **Vence Oposiciones** — identidad de los anuncios)
  - `META_PIXEL_ID` + `META_ACCESS_TOKEN` → Conversions API (medición, distinto del de ads).
- **Atribución en BD:** registros de Meta llegan con `user_profiles.registration_source='meta'`
  (lo dispara `fbclid` que Meta añade al clic, o `utm_source∈{facebook,fb,instagram,ig,meta}`).
  El panel `/admin/conversiones` y `/admin/ads` ya cuentan `meta` (corregido 17/06: antes
  buscaban `'meta_ads'` y mostraban 0 — ojo, NO volver a ese valor).

---

## Comandos API listos (cargar `set -a; source .env.local; set +a`)

```bash
TOK="$META_ADS_ACCESS_TOKEN"; ACC="$META_AD_ACCOUNT_ID"

# Listar campañas
curl -s -G "https://graph.facebook.com/v21.0/${ACC}/campaigns" \
  --data-urlencode "fields=name,status,objective,effective_status" \
  --data-urlencode "access_token=${TOK}" | python3 -m json.tool

# Rendimiento (gasto/clics/CTR/CPC) por campaña, histórico
curl -s -G "https://graph.facebook.com/v21.0/${ACC}/campaigns" \
  --data-urlencode "fields=name,insights.date_preset(maximum){spend,impressions,inline_link_clicks,ctr,cost_per_inline_link_click,actions}" \
  --data-urlencode "access_token=${TOK}" | python3 -m json.tool

# Rendimiento por ANUNCIO (qué variante A/B gana) — usar utm_content para cruzar con BD
curl -s -G "https://graph.facebook.com/v21.0/<ADSET_ID>/insights" \
  --data-urlencode "level=ad" \
  --data-urlencode "fields=ad_name,spend,inline_link_clicks,ctr,cost_per_inline_link_click" \
  --data-urlencode "date_preset=maximum" --data-urlencode "access_token=${TOK}" | python3 -m json.tool

# Pausar / activar (campaña, adset o ad: mismo patrón con su id)
curl -s -X POST "https://graph.facebook.com/v21.0/<ID>" \
  --data-urlencode "status=PAUSED" --data-urlencode "access_token=${TOK}"   # o ACTIVE

# Cambiar presupuesto (céntimos: 300=3€) o puja (bid_amount céntimos: 5=0,05€) en el ADSET
curl -s -X POST "https://graph.facebook.com/v21.0/<ADSET_ID>" \
  --data-urlencode "daily_budget=500" --data-urlencode "access_token=${TOK}"

# Buscar la clave geo de una región/ciudad
curl -s -G "https://graph.facebook.com/v21.0/search" \
  --data-urlencode "type=adgeolocation" --data-urlencode "q=Valencia" \
  --data-urlencode "location_types=[\"region\"]" --data-urlencode "access_token=${TOK}" | python3 -m json.tool
```

### Cruce con ingresos reales (lo que importa, no solo clics)
```bash
node --env-file=.env.local -e '
const {createClient}=require("@supabase/supabase-js");
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  // pagadores por edad/género (perfil de cliente ideal)
  let subs=[],f=0; while(true){const{data}=await s.from("user_subscriptions").select("user_id").range(f,f+999);if(!data||!data.length)break;subs=subs.concat(data);if(data.length<1000)break;f+=1000;}
  const ids=[...new Set(subs.map(x=>x.user_id))]; let p=[];
  for(let i=0;i<ids.length;i+=300){const{data}=await s.from("user_profiles").select("age,gender,registration_source").in("id",ids.slice(i,i+300));if(data)p=p.concat(data);}
  console.log("pagadores:",p.length);
})();'
```

---

## Crear una campaña nueva para otra oposición (playbook)

1. **Elegir oposición:** que YA convierta en Google Ads + examen en ventana 1-6 meses
   (ver `oposiciones.exam_date`). Geo = su comunidad (autonómica) o España (estatal).
2. **Generar creativos** con la plantilla (cambiar título/plazas y carpeta de salida):
   `marketing/ad-creatives/meta/generate.py` → produce 6 variantes A/B 1080×1080.
3. **Subir imágenes** (multipart, NO base64 inline — argv se desborda):
   `curl -F "filename=@img.jpg" -F "access_token=$TOK" .../act_xxx/adimages` → devuelve `hash`.
4. **Campaña** (objetivo `OUTCOME_TRAFFIC`, `special_ad_categories=[]`,
   `is_adset_budget_sharing_enabled=false`, sin `bid_strategy` a nivel campaña).
5. **Conjunto** (`daily_budget` céntimos, `billing_event=IMPRESSIONS`,
   `optimization_goal=LINK_CLICKS`, `bid_strategy=LOWEST_COST_WITH_BID_CAP`, `bid_amount` céntimos,
   `destination_type=WEBSITE`, `targeting` con `genders:[2]` mujeres, `age_min:25,age_max:55`,
   `geo_locations.regions:[{key:"<REGION>"}]`).
6. **Creativo** (`object_story_spec.link_data` con `image_hash`, `message`, `name`=titular,
   `description`, `link` con UTM, `call_to_action.type=SIGN_UP`) → **anuncio** (`creative_id`).
7. Activar campaña + conjunto + anuncios. Los anuncios entran `IN_PROCESS` (revisión de Meta).

---

## ⚠️ Gotchas de configuración (descubiertos 17/06, NO repetir el viacrucis)

- **La app debe estar en modo Live** (no Desarrollo), o crear creativos da
  `(#3) Application does not have the capability` / "app en modo de desarrollo".
  Publicar la app pide: icono 1024×1024, URL privacidad (`vence.es/privacidad`), categoría.
  El campo "Eliminación de datos de usuario" es buggy (`name_placeholder should represent a
  valid URL`) — solo es obligatorio si la app tiene "Inicio de sesión con Facebook".
- **Política de no discriminación:** sin firmarla, crear anuncios por API da
  `error_subcode 2859024 "Se requiere certificación"`. Va ligada al **System User**: se firma
  en **Business Settings → Usuarios del sistema → botón "+ Agregar"** (¡el flujo de crear
  usuario muestra la política al inicio; aceptar y cancelar la creación!). Aceptarla por la
  UI/Publicar NO basta para la API.
- **Renombrar una página NO se puede por API** (`(#3) ... capability`) — manual en FB, y Meta
  lo restringe en páginas nuevas/pequeñas. Por eso se creó **Vence Oposiciones** desde cero.
- **Página de anuncios = `META_PAGE_ID`** (id de negocio `1222080577647979`), distinto del id
  de la URL del perfil (`61590634215409`). Usar siempre el de negocio para la API.
- **Unidades:** `daily_budget` y `bid_amount` en **céntimos** (300=3€, 5=0,05€).
- **Géneros:** `1`=hombres, `2`=mujeres. **Geo Madrid (región):** key `1019`.
- **Subir imágenes:** multipart `-F filename=@ruta`, nunca base64 en argv (peta "lista de
  argumentos demasiado larga").

---

## Creatividades

- Generador: `marketing/ad-creatives/meta/generate.py` (Pillow, texto pixel-perfect sin
  erratas; NO IA generativa, que escribe mal el texto). README en esa carpeta.
- Variantes A/B estándar: verde/rojo/carmesí + bandera CAM, logo arriba-izq vs abajo-dcha.
- Icono de app 1024×1024: `marketing/ad-creatives/meta/app-icon-1024.png`.
- **No reutilizar creativos viejos sin mirarlos**: muchos tienen marca vieja "iLoveTest",
  plazas/precios caducados o "del Estado" (no sirve para autonómicas).

---

## 📷 Instagram orgánico — "Pregunta del día" (auto, 17/06/2026)

Cuenta **@vence.es** (id `17841460897412178`, ~19.700 seguidores — es ILoveTest rebautizada),
vinculada a la página **Vence Oposiciones** y a la cuenta publicitaria.

**Publicación automática diaria:**
- Workflow GitHub Actions `.github/workflows/instagram-pregunta-dia.yml` → cron `0 8,9 * * *`
  UTC + guard `TZ=Europe/Madrid date +%H == 10` → publica **exactamente a las 10:00 Madrid**
  (robusto ante cambio de hora). `workflow_dispatch` con input `dry_run` para probar a mano.
- Script `marketing/social-content/instagram_daily.py`: elige pregunta fiable (BD) →
  imagen 1080² (Pillow) → sube a S3 `vence-uploads` (bucket público) → publica vía Graph API
  (`/{ig}/media` contenedor → `/{ig}/media_publish`) → registra en tabla `instagram_posts`.
- **Criterios de pregunta:** lifecycle approved/tech_approved + leyes transversales
  (CE, EBEP/RDL 5/2015, Ley 39/2015, Ley 40/2015) + `difficulty_sample_size>=40` +
  acierto ≥80% + sin impugnaciones + `option_e IS NULL` + no publicada antes.
- Secrets GitHub: `DATABASE_URL`, `META_ADS_ACCESS_TOKEN`, `META_IG_USER_ID`,
  `AWS_ACCESS_KEY_ID/SECRET`, `AWS_S3_REGION`, `AWS_S3_BUCKET`.
- Prueba local: `DRY_RUN=1 python3 marketing/social-content/instagram_daily.py`.

**Gotchas Instagram (NO repetir el viacrucis del 17/06):**
- Para publicar por API el token del System User necesita `instagram_basic` +
  `instagram_content_publish` → caso de uso "Administrar mensajes y contenido en Instagram"
  en la app + **regenerar token** (los scopes no se añaden a tokens ya emitidos).
- **NO App Review** para tu propia cuenta vía System User (igual que ads).
- La imagen DEBE estar en **URL pública** (Instagram la descarga); `vence-uploads` ya es
  público (`s3:GetObject` en bucket policy) → no hace falta presign.
- Para asignar identidad IG a un ANUNCIO, la cuenta IG debe estar vinculada a la **PÁGINA**
  (no solo a la cuenta publicitaria), o crear el creativo da *"La página no tiene acceso a la
  cuenta de Instagram"*. Vincular en Business Suite → página → "Conectar con Instagram"
  (si estaba en otra página, "Cambiar de página"). `gen NOT IN` con subquery que tenga NULLs
  devuelve 0 filas → usar `NOT EXISTS` en la selección de preguntas.
- `bid`/`budget` en céntimos. Géneros 1=hombre 2=mujer.

**Fase 2 pendiente (no hecha):** migrar el job al backend NestJS (`@Cron`) cuando se valide
el formato — requiere secret en SSM + permiso S3 al task role del backend + `sharp` + deploy.

## Caveats (no olvidar)

- Lanzar **2-4 creativos por conjunto** y dejar que Meta reparta hacia el de mejor CTR/coste;
  a los pocos días pausar los flojos.
- Medir **registros/ventas reales en BD** (`registration_source='meta'` + `utm_content` por
  variante), no solo clics. El clic barato sin ventas es la trampa del histórico.
- Con presupuesto bajo + puja con techo, Meta puede **infra-gastar** (no llega al diario) si no
  encuentra clics a ese precio: es control de coste, no un fallo.
- Examen pasado → pausar (igual que en Google Ads).
