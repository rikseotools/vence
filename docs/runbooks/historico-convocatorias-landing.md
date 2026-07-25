# Apartado histórico de convocatorias (landing)

> **Qué es:** el bloque «📊 Histórico de convocatorias» al final de cada landing de oposición
> (antes del CTA). Muestra la evolución año a año: **plazas de acceso libre, año de OEP,
> convocatoria, examen, plazo convocatoria→examen e inscritos/plaza**, con enlace al BOE de
> cada convocatoria. Objetivo: ser **la fuente de datos más completa y verificada** de cada
> oposición → SEO (JSON-LD `Dataset`) + confianza del opositor.
>
> **Cuándo tocar esto (frases-gatillo):** *"pobla el histórico de <oposición>"*, *"añade el
> histórico de convocatorias"*, o al crear una oposición nueva (FASE 5, ver
> `crear-nueva-oposicion.md`).

## 1. Cómo funciona (arquitectura)

- **Componente:** `app/[oposicion]/HistoricoConvocatorias.tsx` (server, solo lectura). Se
  **auto-oculta si hay <2 años** cargados (el histórico solo aporta comparando).
- **Datos:** `getHistoricoConvocatorias(slug)` (`lib/api/convocatoria/queries.ts`). Cada fila
  es una **convocatoria**; el **AÑO y los decretos de OEP salen de la ENTIDAD `oep`** vía el
  puente `convocatoria_oep` (T-108, `docs/roadmap/oep-entidad-modelo.md`) — **NO del slice de
  `oep_fecha`**. El año-OEP = `MAX(año_oep)` de las OEP que agrupa la convocatoria.
- **Cálculos:** helper puro `lib/convocatoria/historico.ts` (`resumenHistorico`): plazos,
  medias, ratios. Testeado (`__tests__/lib/convocatoria/historico.test.ts`).
- **SEO:** JSON-LD `Dataset` emitido en `page.tsx` cuando hay ≥2 años.

## 2. Cómo poblar el histórico de una oposición

**Regla nuclear:** contenido legal — **NUNCA inventar ni estimar** un dato. Sin fuente oficial
verificada, se deja `null` (la UI muestra «—»).

1. **Investiga las convocatorias anteriores** en el **BOE / boletín oficial** (buscador BOE,
   OEP por Real Decreto). Por cada convocatoria pasada, con enlace oficial a cada dato:
   `convocatoria_fecha`, `boe_reference`, `oep_decreto`+`oep_fecha`, `exam_date`, `plazas_libres`.
   (Las OEP del Auxiliar se **acumulan**: una convocatoria puede ejecutar varias OEP.)
2. **Inserta las convocatorias históricas** en `convocatorias` con `is_current=false` y
   `archived_at=now()` (son ciclos cerrados; así no compiten con la vigente ni ensucian
   `oposiciones_ssot`/hitos). `convocatoria_numero` = el `boe_reference` (identidad única).
   `plazas_libres` = total del turno libre; deja `plazas_discapacidad` null para no doble-contar.
3. **Corre el backfill de la entidad OEP** para que el histórico lea el año-OEP estructurado:
   `node scripts/oep/backfill-oep-entidad.cjs` (parsea `oep_decreto` → filas `oep` + enlaces
   `convocatoria_oep`). Verifica con: por cada convocatoria, ¿tiene sus OEP enlazadas?
4. **Inscritos / presentados** (columnas `convocatorias.inscritos`/`presentados`): SOLO si
   constan en fuente oficial (acta del tribunal / INAP / listas del BOE). Si no, null. Al
   poblarlas aparece la 2ª tarjeta de media («X inscritos por plaza») y la columna se rellena.
5. **Revalida** el tag `landing` (`POST /api/admin/revalidate`) tras poblar.

## 3. Guardarraíles (por qué no se cuela un dato malo)

- **Fecha de convocatoria (`celdaConvocatoria`, en `historico.ts`):** la columna Convocatoria
  SOLO pinta `convocatoria_fecha` real. Si falta → «Pendiente de convocar». **Jamás** se
  sustituye por la fecha de la OEP ni la de publicación en BOE (eso publicaría una fecha
  errónea). Guardarraíl estructural (la función solo acepta `convocatoriaFecha`).
- **Coherencia del enlace (`lib/convocatoria/linkCoherence.cjs`):** el sweep de salud caza que
  el enlace «Ver en BOE» (`programa_url`) apunte al mismo documento que la referencia mostrada
  (`boe_reference`). Frase-gatillo *"revisa los enlaces de convocatoria"* (kind
  `convocatoria_link_mismatch`).

## 4. NO confundir con
- **Rollover** (`rollover-oposiciones.md`): pivotar la landing VIGENTE hacia delante cuando pasa
  el examen. El histórico es el registro de ciclos PASADOS, no la convocatoria viva.
- **Provenance** (`provenance-convocatorias.md`): clonar el documento oficial en el hub. El
  histórico consume las fechas/plazas, no gestiona los documentos.
