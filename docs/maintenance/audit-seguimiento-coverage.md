# Audit Fase 0 — Cobertura seguimiento_url

> **Fecha:** 2026-06-01
> **Roadmap padre:** `docs/roadmap/deteccion-convocatorias-oeps-completo.md`
> **Script ejecutado:** `audit-fase0-estricto.cjs` (no commiteado — temporal)
> **JSON detallado:** `/tmp/audit_fase0_seguimiento.json`

## Metodología

Audit estricto sobre 45 oposiciones activas con `seguimiento_url`. Para cada URL:

1. Fetch HTTP con el mismo User-Agent del cron (`VenceBot/1.0`), follow 5 redirects.
2. `cleanHtml()` idéntico al del cron real (`backend/src/oep-signals/oep-signals-llm.service.ts`).
3. Buscar tokens **muy específicos** derivados de los datos BD de cada oposición:
   - `boe_reference` (formato discriminante: BOE-A-YYYY-X, número/año, etc.)
   - `convocatoria_fecha` (DD/MM/YYYY)
   - `convocatoria_dogv`
   - `exam_date`
   - `plazas_libres` con contexto (`N plazas` / `N puestos`)
   - Títulos de `convocatoria_hitos` (primeros 30 chars)

   Y tokens débiles (palabras del nombre de la oposición, vocabulario del `estado_proceso`).

4. Clasificación:
   - ✅ `static_ok` — ≥2 hits específicos. Cron funciona.
   - 🟡 `partial` — 1 hit específico. Cron detecta parcialmente.
   - ⚪ `weak_signal` — 0 hits específicos, ≥2 débiles. Falso positivo del audit naive anterior.
   - ❌ `js_rendered` — 0 hits específicos y ≤1 débil en ≥1500b de texto. Página renderizada por JavaScript.
   - ⚠️ `too_short` — <1500b de texto tras cleanHtml. Página vacía/error.
   - 🚫 `fetch_fail` — HTTP no-200.

## Resultados agregados

- ✅ static_ok: **7 (15.6%)**
- 🟡 partial: **12 (26.7%)**
- ⚪ weak_signal: **4 (8.9%)**
- ❌ js_rendered: **17 (37.8%)**
- ⚠️ too_short: **3 (6.7%)**
- 🚫 fetch_fail: **2 (4.4%)**

**Conclusión:** **38 de 45 oposiciones (84%)** tienen algún grado de problema. Solo 7 (15.6%) reciben todas las señales esperadas del cron actual.

El audit anterior (`audit-seguimiento-urls.cjs`, 1 hora antes) reportó 16% problemático. La discrepancia es por la metodología: el audit naive contaba keywords genéricas (`convocatoria`, `auxiliar`, `plazas`) que aparecen en sidebars, breadcrumbs y enlaces a otras convocatorias del mismo portal sin tener nada que ver con el proceso específico monitorizado.

## Verdict por oposición (firme)

### ✅ static_ok (7) — el cron funciona

| Oposición | Hits específicos confirmados |
|---|---|
| `administrativo-estado` | hitos "criterios de corrección", "nota informativa de acceso a fichero" |
| `auxiliar-administrativo-baleares` | hitos "lista provisional de admitidos", "segunda lista", "lista provisional de aprobados" |
| `auxiliar-administrativo-carm` | boe_ref "12/11", fecha_conv 12/11/2025, exam 21/06/2026 |
| `auxiliar-administrativo-clm` | boe_ref "18/12", fecha_conv 18/12/2024, exam 14/10/2025 |
| `auxiliar-administrativo-cyl` | hitos "nota informativa", "distribución de aspirantes" |
| `auxiliar-administrativo-estado` | hitos "criterios de corrección", "nota informativa de acceso" |
| `enfermero-sas-andalucia` | fecha_conv 17/02/2025, exam 17/05/2025 |

**Patrón común:** portales que sirven HTML estático (sede.inap.gob.es, gobcan.es/sede, jcyl.es, juntadeandalucia.es/empleadopublico). Estado y SAS son los mejor cubiertos.

### 🟡 partial (12) — el cron detecta parcialmente

Estas oposiciones tienen un único hit específico (típicamente la `convocatoria_fecha` o `boe_reference` que aparece en un enlace al BOE). Captan la convocatoria base pero **no detectan los cambios de fase posteriores** (apertura inscripción, listas, examen).

| Oposición | Único hit confirmado | Probable razón |
|---|---|---|
| `administrativo-gva` | hito "nombramiento del tribunal" | Sede dinámica con resoluciones puntuales |
| `administrativo-navarra` | boe_ref "1322/2025" | Portal Empleo Navarra parcialmente dinámico |
| `administrativo-seguridad-social` | boe_ref "boe-a-2025-27158" | INSS dinámico, solo enlace BOE estático |
| `auxiliar-administrativo-aragon` | hito "composición comisión permanente" | DGA Aragón con texto fijo + resto JS |
| **`auxiliar-administrativo-ayuntamiento-badajoz`** | **fecha_conv 31/03/2026 (en enlace BOP)** | **Ayto.es JS-rendered. Solo capta la fecha porque está hardcoded en el link al PDF de bases.** |
| `auxiliar-administrativo-canarias` | fecha_conv 24/03/2026 | Mismo patrón fecha en enlace |
| `auxiliar-administrativo-cantabria` | plazas:75 | Portal Empleo Cantabria parcialmente estático |
| `auxiliar-administrativo-diputacion-leon` | boe_ref "11/02" | Dip. León solo BOP en estático |
| `auxiliar-administrativo-diputacion-zaragoza` | fecha_conv 12/03/2026 | Igual patrón Dip |
| `auxiliar-administrativo-madrid` | plazas:645 | CAM portal estático, hits limitados |
| `auxiliar-administrativo-valencia` | hito "nombramiento del tribunal" | GVA dinámica |
| `tcae-aragon` | hito "llamamiento extraordinario" | SALUD Aragón texto fijo |

**Para todos estos:** el cron NUNCA detectará el cambio de fase. Necesitan headless browser (Fase 1) o sensor secundario (BOP/extracto BOE en Fases 3-5).

### ⚪ weak_signal (4) — falsos positivos del audit naive

| Oposición | Análisis |
|---|---|
| `auxiliar-administrativo-andalucia` | El audit anterior la marcó "static_ok score 5/7" pero 0 hits específicos. Solo captaba palabras genéricas del sidebar Junta. JS-rendered en la práctica. |
| `auxiliar-administrativo-galicia` | Idem. Xunta usa SPA dinámica. |
| `auxiliar-enfermeria-osakidetza` | Portal Osakidetza dinámico. |
| `celador-scs-canarias` | SCS dinámico. |

**Acción:** tratar como JS-rendered. Necesitan headless browser en Fase 1.

### ❌ js_rendered (17) — el cron NO funciona

Confirmados por audit estricto. Todos necesitan headless browser:

```
administrativo-galicia
auxiliar-administrativo-asturias
auxiliar-administrativo-ayuntamiento-murcia
auxiliar-administrativo-ayuntamiento-valencia
auxiliar-administrativo-catalunya
auxiliar-administrativo-diputacion-cadiz
auxiliar-administrativo-la-rioja
auxiliar-administrativo-pais-vasco
auxiliar-enfermeria-gva
auxilio-judicial
celador-sermas-madrid
celador-sescam-clm
correos-personal-operativo
guardia-civil
tcae-canarias
tcae-sermas-madrid
tramitacion-procesal
```

### ⚠️ too_short (3) — páginas vacías/error

| Oposición | Tamaño texto | Probable causa |
|---|---|---|
| `auxiliar-administrativo-extremadura` | 248b | Portal JCEX devuelve shell vacío |
| `policia-nacional` | 938b | Sede Policía Nacional dinámica |
| `tcae-murcia` | 717b | SMS Murcia dinámica |

### 🚫 fetch_fail (2) — bloqueo o redirect

| Oposición | Status | Probable causa |
|---|---|---|
| `policia-municipal-madrid` | HTTP 403 | Anti-bot del portal Ayto Madrid |
| `tcae-galicia` | HTTP 302 | Redirect loop o redirect a página que requiere cookies |

## Universo total de fallo (Fase 1 target)

Oposiciones que necesitan headless browser para el sensor primario:

- ❌ js_rendered: 17
- ⚪ weak_signal: 4
- ⚠️ too_short: 3
- 🚫 fetch_fail: 2

**Total: 26 oposiciones (57.8% del catálogo)** dependen de la Fase 1 para detectar cambios de fase.

Más las 12 `partial` que se beneficiarían parcialmente del headless browser → **38 oposiciones (84%) mejorarían con Fase 1**.

## Insumos para fases siguientes

### Para Fase 1 (headless browser)

Lista priorizada de las 26 oposiciones que necesitan headless. Para piloto inicial recomendado: **8 oposiciones** con tráfico/demanda confirmada o casos donde ya tenemos usuarios reportando:

1. `auxiliar-administrativo-ayuntamiento-badajoz` (origen del audit, usuario premium Sara)
2. `auxiliar-administrativo-extremadura` (too_short, usuario premium Sara segundo objetivo)
3. `tcae-galicia` (cabo previo 31/05)
4. `tcae-murcia` (cabo previo 31/05)
5. `policia-nacional` (alta demanda histórica)
6. `correos-personal-operativo` (cabo previo 31/05)
7. `guardia-civil` (alta demanda histórica)
8. `tramitacion-procesal` (oposición Justicia core)

Si las 8 funcionan con la opción elegida (ScrapingBee o Playwright Lambda), rollout a las 18 restantes.

### Para Fase 2 (PDF extractor)

`auxiliar-administrativo-ayuntamiento-badajoz` es el caso de uso #1. La página oficial tiene un PDF "FECHAS Y PLAZOS" que es donde se actualizan las fechas de cada hito. Hash + extract de ese PDF detectaría los cambios sin necesidad de headless browser para el contenido HTML.

### Para Fase 3 (BOPs provinciales)

Aún sin la Fase 1, añadir BOPs como sensor secundario reduciría falsos negativos. Caso Badajoz: el BOP Badajoz publicará todos los anuncios sucesivos (apertura inscripción, listas, examen) — si lo monitorizamos, no dependemos del Ayuntamiento.

### Para Fase 4 (OEPs anuales)

Sin datos específicos del audit. Diseño base ya en roadmap §3.4.

### Para Fase 5 (extracto BOE)

Caso Ayto Badajoz: el extracto BOE NO se ha publicado al 01/06/2026 (verificado en aytobadajoz.es PDF FECHAS Y PLAZOS, sección "PUBLICACIÓN ANUNCIO BASES B.O.E." vacía). El cron Fase 5 lo detectaría cuando aparezca y auto-actualizaría:
- Hito "Publicación extracto BOE" (status=completed)
- Hito "Apertura plazo inscripción" (BOE+1)
- Hito "Cierre plazo inscripción" (BOE+20 días hábiles)
- `estado_proceso='inscripcion_abierta'`

## Próximos pasos

1. ✅ **Fase 0 completada** (este documento).
2. **Decisión humana:** ScrapingBee SaaS ($49/mes) vs Playwright Lambda ($5-15/mes) para Fase 1.
3. **Fase 1** ejecutable en cuanto haya decisión.

## Referencias

- Roadmap: `docs/roadmap/deteccion-convocatorias-oeps-completo.md`
- Manual seguimiento: `docs/maintenance/oeps-convocatorias-seguimiento.md`
- Cabos: `[[project_pending_seguimiento_url_genericas]]` (absorbido aquí)
- Memoria: `[[project_roadmap_deteccion_convocatorias]]`
