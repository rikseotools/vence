# Roadmap SEO — keywords a atacar (análisis competidor testdeley.com)

**Origen:** análisis del export orgánico de testdeley.com (Semrush, 02/06/2026,
106 keywords) cruzado con las leyes que vence ya tiene en BD. Complementa el
runbook `docs/runbooks/seo-oportunidades.md` (el bucle y los comandos `gsc:*`).

> Datos de volumen/posición = de **testdeley** (Semrush). Las posiciones de
> **vence** se sacan con `npm run gsc:seo` / `gsc:keywords -- <slug>`.

---

## La lección (por qué testdeley rankea y nosotros no)

testdeley **no tiene mejor producto** — tiene páginas **crawleables**. Su arma es
una página por ley `/[ley]/sumario.php` que sirve el **índice de títulos en HTML
estático**, y rankea para DOS tipos de búsqueda:

1. **"test [ley]"** — intención comercial (nuestro funnel): "test ley 39/2015",
   "test constitución española", "test de leyes".
2. **El nombre de la ley a pelo** — intención informacional, mucha gente busca
   solo "ebep", "lprl", "lo 3 2018", "ley del gobierno". testdeley capta ese
   tráfico con la MISMA página.

Vence tiene **todas** esas leyes, pero las servía client-side (`LawArticlesClient`,
"Cargando teoría…") → Google veía una página vacía. **El fix SSR del temario
(commit `f918a514`, 02/06/2026) replica exactamente el arma de testdeley** y, al
estar en la ruta dinámica `/leyes/[law]`, cubre las 833 leyes a la vez. Este
roadmap es la lista de a qué leyes exprimir ese fix primero.

---

## Tier 1 — máximo volumen, ganable ya (vence tiene la ley + SSR ya aplica)

- **EBEP / TREBEP (RDL 5/2015)** — `/leyes/rdl-5-2015`
  - "ebep" = **18.100/mes**, KD 25, testdeley solo en **p43** → poquísima
    competencia arriba, es la mayor oportunidad del catálogo. También "trebep",
    "estatuto básico del empleado público".
  - Acción: el `<title>`/H1/meta de la página DEBE incluir "EBEP" y "TREBEP"
    (siglas que busca la gente), no solo "Real Decreto Legislativo 5/2015".
- **Constitución Española** — `/leyes/constitucion-espanola`
  - "test constitución española" 5.400 (testdeley p1, vence ~p7) + "test
    constitucion" 1.600 + "test constitución" 880 + "test de la constitución
    española" 1.000. KD 8-10 (bajo). Magneto enorme.
- **LPRL (Ley 31/1995)** — `/leyes/lprl` (y `ley-prevencion-riesgos-laborales`)
  - "lprl" 5.400 (testdeley p45) + "ley 31 del 95" 1.300. OJO: hay dos slugs
    para la misma ley → consolidar/canonical para no competir contra nosotros.
  - ⚠️ **SSR VACÍO HOY**: 0 títulos en `law_sections` (tiene 82 artículos) → el
    bloque temario no renderiza. Bloqueado por el gap de abajo. Es Tier 1, urge.
- **Genéricos "test de ley(es)"** — páginas hub `/leyes`, `/teoria`
  - "test de ley" 5.400 (testdeley p1, su homepage) + "test de leyes" 1.000 +
    "test oposiciones" 1.300. KD 11-17. Atacar con la página índice de leyes.

## Tier 2 — alto volumen, ley presente

- **Ley del Gobierno (Ley 50/1997)** — `/leyes/ley-50-1997`
  - "ley 50/1997" 3.600 + "ley del gobierno" 2.900 + "ley 50 1997" 1.900 +
    "ley gobierno" 880 + "50/1997" 1.000 = **~9.300/mes** combinado. testdeley
    p19-43 → muy ganable. Title debe incluir "Ley del Gobierno".
- **Ley 39/2015** — `/leyes/ley-39-2015`
  - "test ley 39/2015" 1.900 + "test ley 39 2015" 1.600 (KD **4-5**, regalo) +
    "ley 39 2015 pdf" 1.300 + "ley 39 2015 boe" 1.000. vence ~p6.
- **Ley 40/2015** — `/leyes/ley-40-2015`
  - "test ley 40/2015" 880 + "test ley 40 2015" 880, KD 8-9. vence ~p4.7.
- **Ley 9/2017 (contratos sector público)** — `/leyes/ley-9-2017`
  - "9 2017" 1.900 (testdeley p31). También "ley 9/2017", "ley de contratos".
  - ⚠️ **SSR VACÍO HOY**: 0 títulos en `law_sections` (tiene 349 artículos).
- **LO 3/2018 (LOPDGDD)** — `/leyes/lo-3-2018`
  - "lo 3 2018" 1.600 (testdeley p64 → mal posicionado, ganable). + "lopd".
- **Ley 55/2003 (Estatuto Marco personal estatutario)** — `/leyes/ley-55-2003-estatuto-marco`
  - 1.600 (testdeley p60). Relevante para la cola sanitaria (SCS, SAS, etc.).
  - ⚠️ **SSR VACÍO HOY**: 0 títulos en `law_sections` (tiene 85 artículos).

## Tier 3 — autonómicas / nicho (volumen medio, según oposición objetivo)

- "ley función pública andalucía" 1.600, "ley 7 2007" 880 (¿RDL 7/2007 vs Ley
  7/2007 CARM? desambiguar intención).
- "estatuto de autonomía de aragón" 880, "lorafna" 880 (Navarra) → leyes
  autonómicas; crear/mejorar si la oposición de esa CCAA es prioritaria.
- "ley 13/2007" (Violencia Género Andalucía) 880 — vence ya la tiene.
- Estatales sueltas con demanda: "ley 23/2014" 1.000, "ley 17/2015" 1.000
  (Sistema Nacional Protección Civil), "ley 6/2014", "rdl 1/2007" 880
  (consumidores), "rdl 1/2013" 1.000 (discapacidad). Verificar si están en BD.

---

## ⚠️ Gap del fix SSR: leyes con artículos pero SIN títulos (`law_sections` vacío)

El bloque SSR del temario está guardado por `lawSections.length > 0` y renderiza
los **títulos** (`law_sections`). Una ley sin filas en `law_sections` → bloque
vacío → **cero beneficio SEO**, aunque tenga artículos. Verificado 02/06/2026
(origen, cache-buster) — estado SSR de las Tier 1/2:

- ✅ Renderiza: `rdl-5-2015` (8 títulos), `ley-50-1997` (6), `ley-39-2015`,
  `ley-40-2015`, `lo-3-2018`.
- ⚠️ **VACÍO** (0 títulos, sí artículos): `lprl` (82 arts, **5.400/mes — Tier 1**),
  `ley-9-2017` (349 arts), `ley-55-2003-estatuto-marco` (85 arts).

**Solución recomendada (1 cambio, desbloquea las 3 + cualquier ley sin títulos):**
en `app/leyes/[law]/page.tsx`, cuando `lawSections` venga vacío, hacer **fallback a
`fetchLawArticles(slug)`** y renderizar el índice de artículos (número + título)
en su lugar. Es lo que hace testdeley (su sumario lista la estructura). Aditivo,
mismo patrón cacheable (`unstable_cache` tag `teoria`). Alternativa peor: crear a
mano las `law_sections` de cada ley (no escala a 833 leyes).

## Acciones (orden recomendado)

1. **Cerrar el gap de arriba** (fallback a artículos en el SSR). Sin esto, LPRL
   (Tier 1) y otras siguen invisibles para Google aunque tengan contenido.
   Re-verificar con el loop:
   ```bash
   for slug in rdl-5-2015 lprl ley-50-1997 ley-39-2015 ley-40-2015 ley-9-2017 lo-3-2018 ley-55-2003-estatuto-marco; do
     n=$(curl -s "https://www.vence.es/leyes/$slug?nocache=$RANDOM" | grep -c "Practica con tests de")
     echo "$slug → SSR temario: $n"
   done
   ```
2. **Title/H1/meta con el nombre que busca la gente**: siglas + nombre común
   (EBEP, TREBEP, LPRL, LOPD, "Ley del Gobierno"), no solo el identificador
   normativo. Es lo que hace que la página rankee para el nombre a pelo, no solo
   para "test X". (Revisar `app/leyes/[law]/page.tsx` generateMetadata.)
3. **Consolidar slugs duplicados** (LPRL: `lprl` vs `ley-prevencion-riesgos-laborales`)
   con canonical, para no dividir autoridad.
4. **Profundidad**: nº de títulos/artículos crawleables + FAQ + (fase 2) preguntas
   de ejemplo SIN respuesta (respeta anti-scraping de `correct_option`).
5. **Enlaces internos** a estas páginas desde las landings que ya rankean fuerte.
6. **Medir** con `npm run gsc:seo` a las **4-8 semanas** (SEO es lento). Vigilar la
   Δ de "ebep", "test constitución española", "test ley 39/2015", "lprl".

---

## 📌 Baseline 02/06/2026 (posición de VENCE hoy — re-revisar ~02/07/2026)

Medido con GSC, ventana ~28d (`2026-05-02…2026-05-30`). **Para comparar dentro de
1 mes y ver si el fix SSR + fallback mueve la aguja.** Revisión agendada (cron).

**Queries de demanda donde YA rankeamos (intención "test"):**
- `test de ley` → **pos 6.0** · 6588 impr · 20 clics (↓2.3)
- `test constitución española` → **pos 7.0** · 5026 impr · 199 clics (↑2.8)
- `test ley 39/2015` → **pos 6.4** · 3556 impr · 123 clics (↓1.5)
- `test ce` → **pos 4.1** · 418 impr · 20 clics (↑3.1)
- `test ley 40/2015` → **pos 4.7** · 994 impr · 43 clics
- `test de leyes` → **pos 5.9** · 727 impr · 13 clics
- `test de la constitución española` → **pos 7.7** · 597 impr · 30 clics
- `test constitucion` → **pos 10.6** · 605 impr
- `test psicotécnicos` → **pos 10.4** · 1020 impr · 13 clics
- `examen auxiliar administrativo estado` → **pos 8.8** · 1180 impr · 4 clics

**Queries de NOMBRE de ley (el gap — aquí somos invisibles, testdeley se lo lleva):**
- `ebep` → **NO rankea** (0 impr en GSC) · Semrush 18.100/mes · testdeley p43
- `lprl` → **NO rankea** · 5.400/mes · testdeley p45
- `ley 50/1997` / `ley del gobierno` → **NO rankea** · 3.600+2.900/mes
- `lo 3 2018` / `lopd` → **NO rankea** · 1.600/mes · testdeley p64
- `ley 55/2003` / `estatuto marco` → **NO rankea** · 1.600/mes
- `ley 9/2017` → **pos 46** · 2 impr (testimonial) · 1.900/mes

Lectura: rankeamos decente para "test [ley]" (la página existe y algo crawlea),
pero somos **invisibles para el nombre de la ley a pelo** — justo el tráfico
informacional que captura testdeley con su sumario crawleable. El fix SSR +
fallback a artículos ataca exactamente eso. Éxito a 1 mes = que `ebep`, `lprl`,
`lo 3 2018` empiecen a tener impresiones, y que las "test [ley]" suban de la p4-7.

---

## 🔍 Auditoría técnica SEO (02/06/2026) — fallos detectados

Auditoría de la web en producción. Lo que está **MAL** (orden por impacto):

1. **Páginas de ley SIN `<h1>`** (crítico, fácil). `/leyes/[law]` tiene **0 `<h1>`**
   y la jerarquía empieza en `<h3>Test …</h3>` (rota: h3 antes que h2). Google usa
   el H1 como señal fuerte de relevancia. Fix: un `<h1>` SSR con el nombre de la
   ley (+ sigla) en `app/leyes/[law]/page.tsx`.
2. **Títulos sin las siglas que busca la gente** (crítico, fácil). El `<title>` usa
   el nombre normativo completo pero NO la sigla:
   - `rdl-5-2015` → "Test Real Decreto Legislativo 5/2015…del Estatuto Básico del
     Empleado Público" — sin **EBEP/TREBEP** (18.100/mes).
   - `lprl` → "…Prevención de Riesgos Laborales" — sin **LPRL** (5.400/mes).
   - `lo-3-2018` → "…Protección de Datos…" — sin **LOPD/LOPDGDD** (1.600/mes).
   Fix: meter el `short_name`/sigla al frente del title y del H1 (el campo
   `laws.short_name` ya tiene "RDL 5/2015", "LPRL", "LO 3/2018"; añadir además el
   acrónimo común EBEP/LOPD donde aplique).
3. **SSR temario vacío** en leyes sin `law_sections` (ver gap arriba): `lprl`
   (Tier 1), `ley-9-2017`, `ley-55-2003`. Fallback a `fetchLawArticles`.
4. **Sin JSON-LD** en páginas de ley (0 bloques). Las landings de oposición sí
   tienen (FAQPage/Event). Añadir `Course` + `BreadcrumbList` (+ FAQ) a las leyes.
5. **Sin `og:image`** en páginas de ley → preview pobre en redes y algún SERP.

Lo que está **BIEN** (no tocar):
- `robots.txt`: `Allow: /`, bloquea admin/api/auth/privadas/legales. Correcto.
- **Canonical + noindex de slugs duplicados**: `generateMetadata` pone
  `alternates.canonical` al slug canónico y `robots.index = (slug === canónico)`
  → los alias tipo `ley-prevencion-riesgos-laborales` NO compiten con `lprl`. Bien.
- **Sitemap**: índice `sitemap.xml` → `sitemap-static.xml` (2454 URLs: 468 `/leyes/`
  + 468 `/teoria/` + páginas de oposición) + `sitemap-oposiciones.xml` (31). Filtra
  `isActive=true` (las ~365 leyes ausentes son inactivas, correcto excluirlas).
- Meta description presente en las páginas de ley.

**Quick wins recomendados (1-2 PRs, tocan solo `app/leyes/[law]/page.tsx`):**
fix #1 (H1) + #2 (siglas en title/H1) + #3 (fallback artículos) → desbloquean los
3 problemas de mayor volumen a la vez. #4 y #5 después.

---

## 🗄️ Tracker en BD (medición automática del progreso)

Desde 02/06/2026 el seguimiento vive en 3 tablas (migración
`20260602_seo_keyword_tracking.sql`, schema Drizzle `seoKeywordTargets` /
`seoKeywordSnapshots` / `seoActions`):

- **`seo_keyword_targets`** — catálogo de keywords objetivo (volumen, intención,
  slug objetivo, tier, competidor). Seeded con 17 keywords del análisis testdeley.
- **`seo_keyword_snapshots`** — histórico de posición (auto desde GSC). Baseline
  02/06 cargado. `position NULL` = no rankea (la señal a vigilar en EBEP/LPRL...).
- **`seo_actions`** — bitácora de cambios SEO (las 5 acciones de hoy registradas)
  para correlacionar acción→ranking.

**Captura automática:** cron `/api/cron/seo-snapshot` (GHA `seo-snapshot.yml`,
lunes 05:17 UTC) insertar un snapshot semanal por keyword desde GSC. Disparable a
mano con `workflow_dispatch` o `curl -H "Authorization: Bearer $CRON_SECRET"`.

**Consultar progreso (ejemplo):**
```sql
select t.priority, t.keyword, t.target_volume,
       s.position, s.impressions, s.captured_on
from seo_keyword_targets t
left join seo_keyword_snapshots s using (keyword)
order by t.target_volume desc, s.captured_on desc;
```
Próximo paso opcional: panel `/admin/seo` (posición + Δ + tendencia + última
acción), clonando el patrón de `/admin/ads`.

---

## Caveats

- **Ads ≠ SEO**: pagar anuncios no sube estas posiciones (ver runbook). Esto se
  gana con contenido crawleable + enlaces.
- El volumen es de testdeley/Semrush; la intención y la posición de vence hay que
  validarlas con GSC antes de invertir tiempo en una keyword concreta.
- "daypo tests" / "testdeley" / "testdeley" son marcas de competidores — no atacar.
