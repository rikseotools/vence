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

### 🔌 El contrato de la Lambda headless (lo probé mal y saqué conclusiones falsas)

`backend/infra/headless-fetcher/handler.mjs` acepta **`wait_for`** (selector CSS) y **`timeout_ms`** —
snake_case. El 16/07 la invoqué con `waitMs`/`waitUntil`, que **no existen**, y concluí que «la Lambda
ignora los parámetros de espera». Falso: los ignoraba porque me los había inventado.

Y con los parámetros BUENOS, el resultado fue el mismo, lo que enseña algo más útil:
- **La Moncloa**: `wait_for` + 50 s → 4.204 chars, 0 fechas. Retirarla estuvo bien.
- **BOJA**: la Lambda devuelve **7.656 chars — exactamente lo mismo que `curl`**. El headless NO
  aportaba nada… porque el problema nunca fue el render: **los href a los PDF SÍ estaban en el HTML** y
  el ciego era mi extracción de TEXTO (que se quedaba en los menús).

**Antes de pedir headless para una fuente, comprueba qué aporta de verdad frente a `curl`.** Hoy:
cero de tres.

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
