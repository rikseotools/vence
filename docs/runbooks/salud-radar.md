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
`llm_semantic` ~180/30d · `pag_empleo` ~177 · `boe_api` ~46 · `regional_scan` ~43 ·
`generic_source` **0 ← muerto**.

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
