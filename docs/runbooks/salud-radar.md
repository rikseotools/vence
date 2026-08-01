# Runbook — Salud del RADAR (la máquina que produce las señales)

**Cuándo seguir este runbook (CUALQUIERA de estas frases → aquí):** *"revisa el radar"*, *"revisa señales de radar"*, *"revisa la salud del radar"*, o cuando veas el panel **`/admin/radar-salud`** en ámbar/rojo.

> ⚠️ **NO confundir con *"revisa las señales OEPs"*** (badge 🎯 → `oeps-convocatorias-seguimiento.md`).
> Son **dos cosas distintas y las dos hacen falta**:
>
> | | qué es | qué se mira |
> |---|---|---|
> | **OEPs** 🎯 | **el TRABAJO** | las señales pendientes de triar |
> | **RADAR** | **la MÁQUINA** | ¿los sensores están vivos y viendo lo que deberían? |
>
> **Un badge de OEPs a cero puede significar "todo tranquilo"… o "el motor está muerto".** Sin este
> runbook no se distinguen.

## Por qué existe (16/07/2026)

Dos averías reales, las dos invisibles durante meses porque **nadie miraba la máquina**:

1. **101 de 173 fuentes (58%) en error, 99 sin funcionar jamás, 45 días sin ejecutarse.** Todas
   marcadas `is_active=true`. Ninguna alerta.
2. **Los 16 boletines autonómicos tiraban TODAS las convocatorias** (`candidatesText: ''`) porque "ya
   lo cubre la Capa 1" — que solo ve el 19% del catálogo. **30 convocatorias C1/C2 descartadas al
   día**, durante meses, sin que nada lo dijera.

**El badge de OEPs seguía dando señales todo ese tiempo.** El trabajo parecía normal.

## Procedimiento

### 1. ¿Está produciendo cada sensor?

```sql
SELECT sensor_type, max(created_at)::date AS ultima,
       count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS ultimos_7d
  FROM oep_detection_signals GROUP BY 1 ORDER BY 2 DESC NULLS LAST;
```

**Un sensor con `ultima` vieja está MUERTO, aunque nadie se queje.** Referencia sana (16/07):
`llm_semantic` ~180/30d · `pag_empleo` ~177 · `boe_api` ~46 · `regional_scan` ~43.

### 🚨 El sensor que ARRANCA y no TERMINA — `max(created_at)` no lo ve (28/07/2026)

`detect-oep-llm` (`llm_semantic`) escribe un `cron_tick {phase:'start'}` al arrancar y un `cron_run`
con las stats al terminar. **Comparando las dos series salen jornadas sin cierre:**

```
17/07 start 10:00 → cron_run 10:41  (472 escaneadas)   ✅
20/07 start 10:00 → cron_run 10:39  (495)              ✅
21/07 start 10:00 → (nada)          1 señal y muere    ❌
22/07 start 10:00 → (nada)          12 señales         ❌
23/07 start 10:00 → cron_run 12:37  (2.205, 441 err)   ✅
24/07 start 10:00 → cron_run 12:49  (2.206, 529 err)   ✅
27/07 start 10:00 → (nada)          17 señales, última 11:05 ❌
```

**3 de las últimas 7 jornadas mueren a media pasada.** El sensor emite algunas señales y desaparece:
las oposiciones que quedaban por barrer ese día **no se miran y nadie avisa** — el badge de OEPs
incluso parece sano porque sí llegaron señales.

**Causa probable: el barrido creció 4,7×** (472 → 2.206 URLs, al subir la cobertura de
`seguimiento_url`) y el trabajo pasó de ~40 min a **~2 h 50 min** sin que se ajustara el presupuesto
del cron. Además la tasa de error es del **24 %** (529/2.206).

**Cómo mirarlo (no basta el `max(created_at)` del §1):**

```sql
SELECT ts::date d,
       count(*) FILTER (WHERE event_type='cron_tick')::int arranques,
       count(*) FILTER (WHERE event_type='cron_run')::int  cierres
  FROM observable_events
 WHERE endpoint='detect-oep-llm' AND ts > now() - interval '14 days'
 GROUP BY 1 ORDER BY 1 DESC;
```

**`arranques > cierres` = el sensor muere a media pasada.** Aplica a cualquier cron con el par
tick/run. Es un modo de fallo distinto del sensor MUERTO (no produce nada) y del SORDO (produce 0
señales reportando `success`): aquí produce *a medias*, que es el más fácil de dar por bueno.

### ⚠️ Mudo por DECISIÓN ≠ mudo por avería — míralo aquí ANTES de "arreglarlo"

| sensor | estado | por qué |
|---|---|---|
| **`hash_change`** | **JUBILADO a propósito** (26/06, commit `73417467`) | Emitía una señal por cada hash distinto y las páginas cambian solas (timestamps, banners): **130+ señales por re-baseline, 0 con dato extraído, todas descartadas en triaje**, y el badge OEP inflado a «99+» sin valor. Y era REDUNDANTE: el cambio ya queda en `oposiciones.seguimiento_change_status='changed'` y se revisa en `/admin/seguimiento-convocatorias`, con su propio badge. **NO lo resucites**: `check-seguimiento` sigue corriendo y detectando (101 cambios de 469 fuentes el 16/07) — lo que se quitó fue la SEÑAL, no la detección. |
| **`generic_source`** | reparado 16/07 | Ver abajo. |

**El 16/07 reporté `hash_change` como avería y estuve a punto de devolver 130 señales basura al día
que Manuel ya había matado.** Un sensor callado puede estar jubilado: comprueba el git log del cron
(`git log -S "<sensor>" -- backend/src/<modulo>`) antes de tocar nada.

### El caso `generic_source`: no estaba muerto, estaba SORDO (16/07)

Diagnóstico real, con el dato del `cron_run` delante:
```
{"total":6,"checked":6,"hashChanged":5,"signals":0,"errors":0,"status":"success"}
```
**Corría a diario, veía 5 cambios y emitía 0 señales — reportando `success`.** Dos causas, las dos
arregladas:

1. **Se comía sus propios errores.** `extractGenericSourceChanges()` devuelve `null` en CUATRO casos
   (texto <200 chars, respuesta sin JSON, JSON inválido, excepción de la API) y el llamador los metía
   en el mismo saco que «cambio cosmético» **actualizando el hash** → el cambio quedaba marcado como
   visto y se perdía PARA SIEMPRE. **Un sensor que se traga sus errores es peor que uno caído: el
   caído se nota.** Ahora un fallo NO toca el hash (se reintenta) y cuenta como `error`.
2. **La Moncloa no podía funcionar nunca — y sigue sin poder: RETIRADA.** Su web pinta todo con JS: a
   fetch plano devuelve **2.428 chars de menús** (las otras 5 fuentes dan 66k, 51k, 48k, 36k y 5.7k de
   contenido real). El LLM no veía un solo resumen.
   - Primero la marqué `headless` dando por hecho que la Lambda lo resolvía. **Probado contra la Lambda
     real: FALSO** — 4.204 chars, **0 fechas**, sigue siendo el menú; y la Lambda **ignora**
     `waitMs`/`waitUntil` (renderiza ~2s y devuelve). Tampoco es cosa de esa URL: `/referencias/`,
     `/consejodeministros/` y una referencia concreta dan 1.2k-1.6k de menús.
   - **Una fuente que el fetcher no sabe leer NO es una fuente: es un hueco con nombre.** Dejarla
     activa fingiendo que vigila es peor que no tenerla — el panel la cuenta como cubierta. → retirada
     (`is_active=false`, migración `20260716_moncloa_no_legible.sql`).
   - **Merece la pena recuperarla**: Moncloa resume el Consejo de Ministros el MISMO día que aprueba la
     OEP; el BOE la publica días después. Haría falta que la Lambda espere a un selector real de la
     lista, o encontrar el endpoint de datos de SharePoint.

   Queda `generic_source_checks.fetcher_type` (`http`|`headless`), que es el modelado correcto y sirve
   para las próximas fuentes JS — pero **marcar `headless` no es un arreglo: hay que COMPROBAR que la
   Lambda devuelve contenido**, no que responde.

**✅ VERIFICADO EN PROD (17/07, la ejecución siguiente al fix).** El `cron_run` de las 08:00 UTC:
```
{"total":5,"checked":5,"hashChanged":3,"signals":0,"errors":0,"status":"success"}
```
`total` bajó de 6 a **5** (La Moncloa ya no se cuenta — retirada bien) y `checked` = `errors` + los que
cambian, ahora campos separados y honestos. `errors:0` es REAL, no un silencio: las 5 fuentes están
sanas, así que no hay error que contar. La diferencia del fix solo se ve cuando una fuente falla de
verdad (entonces `errors>0` y su hash NO se toca); no se puede forzar un fallo en prod, así que esto es
lo máximo verificable sin romper una fuente a propósito. **Dónde mirar:** `observable_events WHERE
endpoint='detect-generic-sources'` (NO `cron_runs`, que este cron no usa — solo tiene datos viejos de
mayo). El evento `{phase:'start'}` (severity debug) marca el arranque; el `info` con las stats, el fin.

### 🔌 El contrato de la Lambda headless (lo probé mal y saqué conclusiones falsas)

`backend/infra/headless-fetcher/handler.mjs` acepta **`wait_for`** (selector CSS) y **`timeout_ms`** —
snake_case. El 16/07 la invoqué con `waitMs`/`waitUntil`, que **no existen**, y concluí que «la Lambda
ignora los parámetros de espera». Falso: los ignoraba porque me los había inventado.

Y con los parámetros BUENOS, el resultado fue el mismo, lo que enseña algo más útil:
- **La Moncloa**: `wait_for` + 50 s → 4.204 chars, 0 fechas. Retirarla estuvo bien.
- **BOJA**: la Lambda devuelve **7.656 chars — exactamente lo mismo que `curl`**. El headless NO
  aportaba nada… porque el problema nunca fue el render: **los href a los PDF SÍ estaban en el HTML** y
  el ciego era mi extracción de TEXTO (que se quedaba en los menús).

**Antes de pedir headless para una fuente, comprueba qué aporta de verdad frente a `curl`.**

> **Y desde T-453 (01/08/2026) esa comprobación la hace sola la herramienta que escribe la URL.**
> `scripts/seguimiento/repuntar-url.cjs` mide con navegador cuando el fetch plano no ve nada y
> **promueve a `headless` solo si está medido que aporta**; si el navegador tampoco ve nada,
> rechaza — el problema es la URL. Antes solo existía el camino contrario (degradar), así que una
> fuente SPA quedaba invigilable para siempre: **13 oposiciones activas** en ese estado ese día. Hoy:
**cero de cinco**.

**Medición 26/07/2026 (T-125), los dos casos nuevos — y un fallo de la Lambda que sale a la luz:**

| Fuente | `curl` (texto útil) | Lambda headless | ¿aporta? |
|---|---|---|---|
| `jgpa.convoca.online` (Junta General Asturias) | 200 · 6.040 chars · 0 anclas | **304** · 1.527 chars · 0 anclas | **NO — devuelve MENOS** |
| `interior.gob.es` (Ayudantes IIPP) | 403 (WAF) | **403** · 0 anclas | **NO — el WAF también la bloquea** |

Dos cosas que dejan esto cerrado:

- **El headless NO cura un bloqueo por WAF.** Interior responde 403 a la Lambda igual que al UA del cron. Marcarla `headless` habría sido crear un hueco con nombre.
- **La causa real de Asturias: la web RECHAZA el navegador de la Lambda.** Persiguiendo esto se pasa por dos pistas falsas, así que van documentadas para que nadie las repita:
  1. *"Devuelve 304, será caché"*: cierto a medias. El navegador se reutiliza entre invocaciones warm (`cachedBrowser`) y Chromium sirve de su caché → `304`. Pero con un **cache-buster** (`?_=<ts>`) pasa a `200` y **el contenido es idéntico**: 1.527 chars. La caché explicaba el código de estado, **no** el vacío.
  2. *"Será que `wait_for` no funciona"*: falso, sí se honra (`page.waitForSelector`, línea 118 del handler). Esperó los 10 s completos porque el selector **no iba a aparecer nunca**.
  Volcando el texto que devuelve se ve el motivo, y es inequívoco: **«Este navegador no es soportado por Convoca… ¡No hay datos a la vista!»**. La aplicación hace *sniffing* y se niega a montar los datos. No es el UA (la Lambda manda un Chrome 130 normal y acepta `user_agent` por parámetro); un Playwright local, que ni lo fija, SÍ pasa. Diferencia probable: `@sparticuz/chromium` frente al Chromium de Playwright.
- **⚠️ `ok` da por bueno cualquier 3xx** (`status >= 200 && status < 400`), así que un `304` con armazón cacheado se reporta como fetch correcto. Quien consuma la Lambda no puede fiarse de `ok`: hay que mirar el TEXTO.
- **Sonda para no volver a suponerlo:** `node scripts/seguimiento/sim-headless-aporta.cjs` mide, fuente por fuente, el texto útil por `curl` frente al de la Lambda y clasifica en `aporta` / `no_aporta` / `rechaza_bot` / `ambos_ciegos`. No escribe nada.

**Barrido de las 67 marcadas `headless` (26/07/2026) — el 82% no gana nada:**

| Veredicto | Nº | Qué significa |
|---|---:|---|
| ✅ `aporta` | 12 | la Lambda entrega bastante más texto: el marcado se paga |
| ➖ `no_aporta` | 47 | `curl` da lo mismo o más: **una invocación por pasada tirada** |
| ❌ `ambos_ciegos` | 7 | ni `curl` ni headless sirven → hueco con nombre (3 en oposiciones ACTIVAS: `auxiliar-administrativo-diputacion-zaragoza`, `ayudante-instituciones-penitenciarias`, `auxiliar-administrativo-la-rioja`) |
| 🤖 `rechaza_bot` | 0 | — |

Con el sensor LLM corriendo L-V y el de notas a diario, eso son **55 invocaciones diarias que no compran un solo carácter**.

**Para revertirlo: `node scripts/seguimiento/ajustar-fetcher-type.cjs` (dry-run por defecto).** No se fía de la tabla de arriba: **vuelve a medir en el momento** y solo escribe el caso inequívoco (`no_aporta` estando en `headless`). NO toca los `ambos_ciegos` —ahí el problema es la URL y cambiar el fetcher lo enmascara— ni los `rechaza_bot`. Comparte núcleo con la sonda (`veredictoHeadless`/`decidirFetcherType`, testeados) para que las dos no puedan tener criterios distintos, y deja traza en `observable_events` (`fetcher_type_ajustado`).

⚠️ **Ojo al umbral:** exige `1,5x` **y** `+500` chars. Un caso como `auxiliar-administrativo-andalucia` (2.563 → 3.237) gana 674 caracteres pero se queda en `no_aporta` por el ratio. Es deliberado —evita contar como "aporta" un salto grande sobre textos minúsculos, tipo Tenerife 40 → 444— pero si un día interesa afinarlo, es ahí y en sus tests.

⚠️ **Una fuente que el fetcher no sabe leer no es una fuente: es un hueco con nombre.** Al añadir una,
comprueba cuánto TEXTO ÚTIL devuelve — no que responda 200.

### 2. ¿Están vivas las fuentes?

```sql
SELECT count(*)::int total,
       count(*) FILTER (WHERE last_error IS NOT NULL)::int con_error,
       count(*) FILTER (WHERE last_success_at IS NULL)::int nunca_ok,
       max(last_checked)::date AS ultimo_check,
       (now()::date - max(last_checked)::date) AS dias_sin_mirar
  FROM detection_sources;
```

> ⚠️ **`is_active=true` NO significa que funcione.** Es una intención, no un hecho. Mira
> `last_error` y `last_success_at`. Y si `dias_sin_mirar` > 2, **el cron no está corriendo**: eso es
> lo primero, antes que ninguna URL.
>
> ⚠️ **`detection_sources` es la capa VIEJA** (portales de entidad que se reorganizan y mueren: 61×
> HTTP 404). La capa viva son los **16 adapters de `ccaa-boletines.ts`**, que leen **sumarios de
> boletín** (estables, con API/XML) y tienen 2 boletines documentados como inviables con su motivo.
> **Al arreglar una fuente rota, pregúntate primero si esa fuente debería existir**: si su contenido
> ya lo cubre el boletín, se retira en vez de resucitarla.

### 3. ¿Ve el radar lo que debería? (cobertura)

```sql
SELECT count(*)::int catalogo,
       count(*) FILTER (WHERE seguimiento_url IS NOT NULL)::int con_fuente,
       count(*) FILTER (WHERE seguimiento_url IS NULL)::int sin_fuente
  FROM oposiciones;
```

Referencia (16/07): **2.542 en catálogo · 472 con fuente · 2.070 (81%) SIN NINGUNA**.

**Las 2.070 solo las puede ver el BOLETÍN**, que por ley tiene todas las convocatorias de España y
es un conjunto acotado (~70) frente a 8.000 ayuntamientos. Si alguien propone "añadir más páginas de
entidad" para cubrir el catálogo, **es el camino equivocado**: no escala y esas URLs mueren.

### 4. Simular un sensor SIN escribir (antes de tocarlo)

```bash
cd backend
# ¿qué ven hoy los 16 boletines autonómicos? (adapters reales, sin insertar)
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/sim-radar-por-fuente.ts [ref-del-corpus]
```
Los prompts del sensor regional (`REGIONAL_SYSTEM_PROMPT`, `regionalUserPrompt`) están **exportados a
propósito**: el rendimiento de un prompt es un hecho verificable. Mídelo antes de opinar — el 16/07,
una réplica "equivalente" del prompt dio un resultado **falsamente pesimista** (7 de 30 con basura;
el real: 8 de 30 limpias).

## Qué NO hacer

- **No añadir fuentes de entidad para "cubrir más".** El catálogo se cubre por boletín.
- **No fiarse de `is_active`.** Mira el error y el último éxito.
- **No arreglar una URL sin preguntar si esa fuente debe existir.**
- **No dar por bueno un badge tranquilo.** Puede ser que el motor esté parado.

## Relacionados
- `docs/maintenance/oeps-convocatorias-seguimiento.md` — el **trabajo** (triar las señales). Badge 🎯.
- `docs/roadmap/radar-por-fuente.md` — la reforma del bucle + los números de cobertura.
- `docs/roadmap/radar-multicapa.md` — arquitectura de capas y panel `/admin/radar-salud`.
- `backend/src/detect-boletines/ccaa-boletines.ts` — los 16 boletines (la capa que SÍ escala).
