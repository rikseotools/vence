# Runbook: Oportunidades SEO (mejorar posición orgánica)

**Cuándo seguir este runbook:** cuando Manuel diga *"oportunidades SEO"*, *"qué mejoro
de SEO"*, *"subir en Google"*, *"posiciones orgánicas"*, *"por qué no rankeamos"* o
similar. Datos de **Google Search Console** (ya conectado por API, ver
`lib/services/googleSearchConsole/`).

> Relacionado: `docs/runbooks/google-ads-analisis.md` (Ads). Ads y SEO son cosas
> distintas — **el dinero de Ads NO sube tu posición orgánica** (Google lo dice oficial).
> SEO se sube con CONTENIDO + enlaces, no pagando.

---

## El bucle: identificar → estudiar competidor → mejorar → medir

### 1. Identificar (automático)
```bash
npm run gsc:seo                    # oportunidades: demanda alta + posición 4-20, con TENDENCIA
npm run gsc:keywords -- <slug>     # búsquedas reales de una oposición concreta
```
`gsc:seo` saca las búsquedas con **muchas impresiones** donde rankeas en **"distancia de
tiro" (pos 4-20)**: estás en página 1-2, un empujón te sube al top y captas mucho tráfico
gratis. Incluye **Δ vs el mes anterior** (↑ subió / ↓ bajó / =) → así ves si tus cambios funcionan.

### 2. Estudiar al competidor (manual — GSC NO da datos de otros)
GSC solo enseña TUS datos. Para ver por qué rankean otros, por cada oportunidad:
- **Gratis:** busca esa query en Google → mira el **top 3** → estudia su página: ¿qué
  cubre que la tuya no? (profundidad, estructura, nº de preguntas, frescura, FAQ, enlaces).
- **Con herramienta:** Semrush / Ahrefs / Moz (ya disponibles) → keywords del competidor,
  sus páginas top y **content gaps** (lo que ellos rankean y tú no).

### 3. Mejorar (el trabajo real, contenido)
- **Encajar la intención**: si buscan "test ley 39/2015", la página debe ser un test/temario
  de esa ley, completo y mejor que el top 3.
- **Profundidad y frescura**: más preguntas/contenido, actualizado, bien estructurado.
- **Enlaces internos**: enlazar a esa página desde tus páginas fuertes (las que ya rankean).
- **Técnico**: título/meta que incluya la query, velocidad, encabezados claros.

### 4. Medir (a las 3-4 semanas)
```bash
npm run gsc:seo                    # mira la Δ: ¿subió la query que tocaste?
```
SEO es **lento** (semanas-meses). No esperes resultados en días. Si tras 4-6 semanas no
sube, revisa contenido/competidor de nuevo.

---

## Oportunidades top (snapshot 02/06/2026)

Lo que más demanda tiene y dónde estás cerca:
- **Tests de leyes genéricos**: "test de ley" (6.588 impr, pos 6), "test ley 39/2015"
  (3.556, pos 6,4), "test ley 40/2015" (994, pos 4,7), "test ce", "test procedimiento
  administrativo". → **Prioridad nº1**: son imanes de tráfico, mejorar estas páginas de tests rinde muchísimo.
- **"test constitución española"** (5.026 impr, pos 7) — magneto enorme.
- **"examen auxiliar administrativo estado"** (1.180 impr, pos 8,8, solo 4 clics) — es tu
  oposición **#1 en ingresos** (2.797€) y captas poca demanda orgánica → doble premio.
- **"test psicotécnicos"** (1.020 impr, pos 10,4) — demanda de psicotécnicos, página 2.
- Temarios concretos: carm, extremadura, auxilio judicial.

---

## 🔧 Acción técnica nº1: SSR del contenido de las páginas de ley (02/06/2026)

**Hallazgo (analizando a testdeley.com, #1 en "test constitución española"):** la
arquitectura de Vence es correcta (página por ley `/leyes/[law]` + páginas por título
`/test-oposiciones/.../titulo-i...`), PERO el contenido (la teoría/artículos) lo pinta un
componente **cliente** (`app/teoria/[law]/LawArticlesClient.tsx`, `'use client'`, fetch en
navegador) → Google recibe **"Cargando teoría…"** y una página vacía. Por eso `/leyes/
constitucion-espanola` está en pos 7 y testdeley #1 (su `/ce/sumario.php` sirve los tests
crawleables). **Mismo problema mata SEO Y conversión** (el usuario busca "test", entra,
ve "configura tu test"/"cargando" y se va).

**Decisión Manuel:** mantener el **registro** (es el funnel — como PreparaOposiciones, que
rankea mostrando muestra crawleable + registra para el banco completo). Pero **SSR sí hay
que hacerlo**.

**Fix (aditivo, bajo riesgo):** `app/leyes/[law]/page.tsx` YA es server component con acceso
a BD (llama `resolveLawBySlug`, `queryLawStats`). Añadir un **bloque SSR** que llame
`fetchLawSections(slug)` / `fetchLawArticles(slug)` (server-usables, en `lib/teoriaFetchers`)
y renderice el **índice de artículos (número + título) + texto SEO** como HTML estático →
Google crawlea contenido legal real que casa con "test [ley]"/"temario [ley]". Mantener
`LawArticlesClient` para lo interactivo (modales, hacer el test). Opcional fase 2: SSR de
preguntas de ejemplo SIN respuesta (respeta anti-scraping de `correct_option`).

**Medir:** tras desplegar, seguir la posición de "test constitución española", "test ley
39/2015" con `npm run gsc:seo` durante 4-8 semanas.

## Caveats
- **Ads ≠ SEO.** Pagar anuncios no sube el orgánico. Se confunde a menudo.
- GSC tiene **~3 días de lag**; las ventanas usan [hoy-31 … hoy-3].
- La "posición" del informe es media ponderada por impresiones (mezcla queries) → úsala
  como señal direccional, no exacta.
- Excluye marca ("vence") — ya rankeas #1 ahí, no es oportunidad.
