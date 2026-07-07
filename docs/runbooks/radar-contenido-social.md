# Radar de Contenido Social (competidores Instagram)

> **Gatillo:** cuando Manuel diga *"revisa el radar de contenido"*, *"mira el radar de contenido"*,
> *"ideas de posts"* o similar (cada 2-3 días), seguir ESTE runbook. El badge de la pestaña
> **"Radar Contenido"** en `/admin` cuenta las recomendaciones nuevas sin ver.

## Para qué sirve

Vigilar el **Instagram público de nuestros competidores**, detectar **qué posts les funcionan**
(engagement real), y sacar **ideas accionables** para publicar **contenido original nuestro** —
con nuestro logo, estilo y voz. El objetivo es **construir marca poco a poco** y que los alumnos
nos reconozcan.

**Cómo se construye marca aquí:** el radar da las *ideas/conceptos* que triunfan; nosotros
generamos el post **original** (nunca copiamos su imagen). Estilo consistente = marca reconocible.

### ⚠️ Regla de oro (legal + reputación)

**NUNCA reutilizar la imagen/vídeo de un competidor** (ni "cambiándola" ni con nuestro logo encima):
1. **Copyright** — es infracción; pueden reclamar.
2. **Política de Instagram** — republicar contenido ajeno puede costar penalización/baja.
3. **Reputación** — los alumnos reconocen el post copiado → destruye la marca que queremos construir.

Se coge **el concepto/gancho/formato**, no el asset. Siempre original.

## Recomendación de frecuencia de publicación

- **Pregunta del día → diaria.** Es el motor de consistencia (ya automatizada, ver
  [`marketing/social-content/README.md`](../../marketing/social-content/README.md)). No tocar.
- **Posts de marca (los del radar) → cada 2-3 días (~3/semana).** Calidad > volumen. Con la
  pregunta diaria ya hay presencia diaria; estos añaden variedad (reels, carruseles, tips,
  storytelling) sin saturar ni bajar la calidad. **Empezar en 2/semana y subir a 3-4** cuando el
  pipeline madure. El reconocimiento se construye con **constancia y estilo consistente**, no con volumen.
- **El radar se refresca cada 2-3 días** (L/X/V) — es para planificar la semana.

## Patrones que funcionan (aprendizajes reales, 07/07/2026)

Muestra de 134 posts / 29 competidores en 14 días:
- **Reels > todo** en engagement. Carruseles para guardar/comentar.
- **Ganchos ganadores:**
  - *"Oposiciones desconocidas / fáciles con muchas plazas"* — el pelotazo del muestreo
    (Editorial MAD, reel, **4.899 likes = 22,9% de sus seguidores**).
  - *"Errores que comete el opositor cuando…"* (formato relatable — Forvide).
  - **Storytelling emocional** ("la niña que soñaba con ser Guardia Civil" — Prefortia, 845).
  - **Encuestas/participación** ("¿cuál es tu emoji favorito?", "comenta X") — carruseles de Prefortia.
  - **Tips de contenido de examen** ("qué se pregunta en el examen de Inglés").
- **Quién postea más y mejor:** Academia Prefortia (constante, variado), Editorial MAD, ADAMS, MasterD.
- **Idea plantilla inmediata:** reel "3 oposiciones con muchas plazas que casi nadie conoce" con nuestra marca.

## Procedimiento: "revisa el radar de contenido"

1. Abrir la pestaña **Radar Contenido** en `/admin` (o consultar la tabla `content_radar_posts`).
2. Mirar el **Top por engagement absoluto** (lo que arrasa) y el **Top por engagement rate**
   (ideas que funcionan aunque la cuenta sea pequeña — no premiar solo a los grandes).
3. Por cada idea potente: proponer **nuestra versión original** (concepto + gancho + formato),
   NO el asset. Aterrizarla al temario/oposiciones que preparamos.
4. Marcar las vistas (baja el badge). Las que valgan → briefs para producir el post con nuestro estilo.

## Cómo funciona (técnico)

- **Fuente de competidores:** columna `competitors.instagram` (handle sin @). Poblada desde la web
  de cada competidor y **validada contra Business Discovery** (29 cuentas activas a 07/07/2026).
  Para añadir/arreglar handles: ver [`analizador-competidores.md`](./analizador-competidores.md)
  y rellenar `instagram` a mano si la web no lo enlaza.
- **Lectura de posts ajenos:** **Meta Graph API — Business Discovery** (legítimo, público, sin
  scraping). Con nuestro token System User + IG user id (`17841460897412178`):
  ```
  GET /{ig-user-id}?fields=business_discovery.username(<handle>){followers_count,media.limit(15){caption,like_count,comments_count,media_type,timestamp,permalink}}
  ```
  Nota: la API **no** permite leer "a quién seguimos" (edge `/follows` no existe); por eso la
  fuente son los competidores de la BD, no el "siguiendo" de la cuenta.
- **Ranking:** engagement absoluto (`likes + comments`) y **engagement rate** (`eng / followers`,
  para no premiar solo a las cuentas grandes). Ventana: últimos 7-14 días.
- **Refresco:** tarea Fargate L/X/V (06:00 Madrid) por EventBridge Scheduler → escribe `content_radar_posts`.
  Mismo patrón que la pregunta del día (ver README de social-content). Token Meta en SSM `/vence-social/`.
- **Panel:** pestaña `/admin/radar-contenido` (badge = recomendaciones nuevas sin ver).

## Recursos

| Pieza | Dónde |
|---|---|
| Handles competidores | `competitors.instagram` (RDS) |
| Datos del radar | tabla `content_radar_posts` (RDS) |
| Refresco L/X/V | tarea Fargate `vence-content-radar` + EventBridge (L/X/V 06:00 Madrid) |
| Token Meta | SSM `/vence-social/META_ADS_ACCESS_TOKEN`, `/vence-social/META_IG_USER_ID` |
| Panel | `/admin/radar-contenido` |
| Publicación propia | `marketing/social-content/` (pregunta del día = plantilla del pipeline) |
