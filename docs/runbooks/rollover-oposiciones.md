# Runbook — Rollover de oposiciones (examen pasado → pivotar landing hacia delante)

**Cuándo seguir este runbook (CUALQUIERA de estas frases → este runbook):** *"haz rollover"*, *"revisa rollover"*, *"revisa los rollover"*, *"revisa exámenes hechos"*, *"revisa exámenes pasados/realizados"*, *"oposiciones con examen pasado/hecho"*, *"actualiza las landings viejas/caducadas"*, o cuando vea el **badge ámbar en el nav "Oposiciones"** (`/admin/oposiciones?tab=rollover`) y me lo indique. **Todas apuntan aquí.** Seguir esto ANTES de improvisar. (OJO: *"revisa OEPs"* es OTRA cosa — seguimiento de convocatorias, `oep_detection_signals`, badge 🎯; no confundir.)

> 🎯 **Principio (runbook `crear-nueva-oposicion.md` §2a.1-bis):** una landing es un **activo de captación que NUNCA debe quedar en un callejón sin salida.** Una oposición **no muere cuando pasa su examen** — casi todas son recurrentes (nueva OEP/convocatoria cada 1-2 años) y el opositor que llega tras el examen se prepara para el **siguiente ciclo**. Cuando el examen pasa, hay que **pivotar la landing hacia delante**.

---

## 0. Qué avisa el badge

- **Badge ámbar** en el nav "Oposiciones" = nº de oposiciones que **preparamos** (activas / con tests / landing) con **`exam_date` ya pasada**. Fuente: `lib/api/oposiciones/rollover.ts` → endpoint `/api/admin/oposiciones/rollover-pending`.
- **Pestaña "Rollover"** (`/admin/oposiciones?tab=rollover`): lista las pendientes **ordenadas por demanda de usuarios** (`target_oposicion`), con estado, fecha de examen y días transcurridos.
- Una oposición **sale de la lista y el badge baja** en cuanto su `exam_date` se pone al día (null o futura). Es auto-vigilante.

## 1. Triaje: prioridad, no espera

> ⚠️ **Criterio Manuel (08/07/2026):** en cuanto **pasa el examen, la landing DEJA DE VENDER** — los registros de esa oposición se secan de inmediato (dato real: CARM −87%, Extremadura −99% de registros en 2 semanas tras el examen). Por tanto **NO se espera a la fase de resultados/reclamaciones**: se hace rollover **en cuanto el examen pasa**, aunque el `estado_proceso` siga en `examen_realizado`. Esperar es tiempo de captación tirado. La fase de resultados, si aún corre, se refleja en un **hito**, pero el SEO/landing pivota YA hacia el próximo ciclo.

- **TODA oposición con `exam_date` pasada → rollover.** Sin excepción por "ciclo vivo".
- **Priorizar por `usuarios`** (columna de la pestaña): la de 541 usuarios antes que la de 1. El orden es de impacto, no de si "toca o no".
- Si el examen es MUY reciente (días) y el próximo ciclo aún no tiene datos oficiales: **pivote suave** (caso SERMAS §4) — SEO + hitos forward al próximo ciclo, sin inventar OEP no confirmada; `exam_date=null` para no seguir mostrando la fecha pasada.

## 2. Procedimiento de rollover (por oposición, con VERIFICACIÓN OFICIAL)

> ⚠️ **BD = RDS, nunca Supabase.** `DATABASE_URL` de `.env.local`, `ssl:{rejectUnauthorized:false}`. NUNCA inventar plazas/fechas — verificar en fuente oficial.

> 🧩 **DÓNDE SE ESCRIBE (unificado, 08/07/2026):** la landing lee de la VISTA `oposiciones_ssot`, que resuelve `COALESCE(c.<campo>, o.<campo>)` — la fila **`is_current` de `convocatorias` GANA** sobre `oposiciones` para TODO campo de convocatoria (exam_date, estado_proceso, plazas_*, oep_*, inscription_*, boe_*, landing_estadisticas, landing_description, landing_faqs, examen_config, requisitos_especiales, convocatoria_*). Por tanto:
> - **Poner un VALOR nuevo → escribir en `convocatorias` (fila `is_current`)**: `c` gana sobre `o`, se ve al instante. Escribir solo en `oposiciones` NO se ve (la convocatoria lo tapa).
> - **Poner un campo a NULL (p.ej. `exam_date`) → anular en `convocatorias` Y en `oposiciones`**: como es `COALESCE(c, o)`, si dejas `o.exam_date` con la fecha vieja, la vista cae al fallback y **sigue mostrando la fecha pasada**. Hay que ponerlo null en las DOS. (Si la oposición NO tiene fila en `convocatorias`, el valor sale de `oposiciones` → basta con esa.)
> - Verificar SIEMPRE con `SELECT exam_date FROM oposiciones_ssot WHERE slug=...`.
> - **`seo_title` / `seo_description` → en `oposiciones`** (NO existen en `convocatorias`; ahí sí es el sitio).
> - **Hitos → `convocatoria_hitos`** (por `oposicion_id`).

1. **Investigar la próxima OEP/convocatoria** (fuentes: sede/portal de empleo público de esa administración, BOE/boletín autonómico; contrastar con ADAMS/opositatest). Anotar: ¿hay plazas de ESA categoría pendientes de convocar en OEP recientes? Cifras + año, **verificado**. Si NO hay convocatoria nueva firme → **pivote suave** (SEO/hitos forward, `exam_date=null`, sin inventar plazas).
2. **⛔ ABRIR CICLO NUEVO — `rollover_convocatoria()`, NUNCA `UPDATE` de la fila viva** (corregido 16/07/2026):

   ```sql
   -- archiva el ciclo saliente (conserva su verdad INTACTA) e INSERTA el nuevo, vacío de hechos
   SELECT public.rollover_convocatoria('<oposicion_id>', 2026, 'oep_aprobada', 'claude');
   ```

   > **Por qué cambió (16/07):** este runbook prescribía *"`UPDATE convocatorias` (fila `is_current`) …
   > `oep_decreto`/`plazas_libres` → de la **próxima** OEP"* — es decir, **reescribir la fila del ciclo
   > viejo con los datos del nuevo**. Eso destruye el ciclo anterior sin traza, y **la provenance sobre una
   > fila mutable MUERE en el rollover**: las citas quedan apuntando a documentos de un ciclo que la fila ya
   > no representa. Como `convocatoria_documentos` va a colgar de aquí, el ciclo debe ser inmutable ANTES.
   > Migración `20260716_convocatoria_ciclo_inmutable.sql`.
   >
   > **Honestidad sobre la evidencia:** solo **2 de 2.490** oposiciones conservan más de un ciclo (el resto
   > son mayormente catalogadas sin proceso seguido, así que ese número NO prueba destrucción masiva). El
   > riesgo está **verificado en la estructura** (el `DELETE` documentado + `CASCADE` a hitos se llevaba el
   > timeline entero; ver §2 de `crear-nueva-oposicion.md`), no en un censo de víctimas. No se ha probado
   > un caso concreto de ciclo machacado: el historial arranca el 16/07 y no alcanza al pasado.
   >
   > - El **`año` es INMUTABLE** (trigger): cambiarlo lanza excepción.
   > - **Toda** mutación queda en `convocatorias_history` (fila entera antes/después). Nada se pierde.
   > - **Borrar una convocatoria con hitos FALLA** (`ON DELETE RESTRICT`): antes se llevaba el timeline en
   >   silencio. Un ciclo **no se borra: se archiva**.
   > - El ciclo nuevo nace **VACÍO de hechos** (sin `exam_date`/`plazas_*`/`oep_*` heredados) — a propósito:
   >   copiar las plazas del ciclo viejo "de referencia" es presentar un dato viejo como nuevo (el bug de
   >   Marta). Se rellenan **desde fuente verificada**. Lo que quieras contar del ciclo anterior sale de su
   >   fila archivada, como historia, no como si fuera el ciclo actual.

   Después, sobre la fila **nueva** (`is_current`), rellenar SOLO lo verificado en fuente oficial:
   - **`exam_date`** → **null** si el próximo examen no tiene fecha firme (si no, la landing sigue mostrando la fecha PASADA como "el examen"). `exam_date_approximate` → null también. La previsión va en un hito `upcoming`.
   - `estado_proceso` → si hay OEP nueva: `oep_aprobada`; si no, mantener real (`examen_realizado`/`resultados`) pero con SEO/hitos forward.
   - `oep_decreto` / `oep_fecha`, `plazas_libres` (y `plazas_*`) → de la **próxima** OEP (verificado en BOE/boletín). Si no hay, dejar los de referencia.
   - `landing_estadisticas` → quitar la stat "Examen [fecha pasada]" (deja la landing caducada); poner algo forward ("Temas", "Plazas OEP", o "Próxima convocatoria").
3. **`UPDATE oposiciones`** SOLO `seo_title` / `seo_description` → mirar al **próximo ciclo/OEP** ("OEP 20XX", "próxima convocatoria"), NUNCA al examen/año pasado.
4. **Hitos** (`convocatoria_hitos`): marcar el examen pasado `status='completed'`; añadir un hito `upcoming` forward ("Próxima convocatoria (OEP siguiente)" — con fecha si hay, si no placeholder). El timeline pasa a mostrar el pipeline futuro, no a terminar en el examen.
5. **Re-verificar en la VISTA:** `SELECT exam_date, estado_proceso, landing_estadisticas FROM oposiciones_ssot WHERE slug='...'` — debe reflejar el cambio (si sigue viejo, es que escribiste en `oposiciones` y la convocatoria lo tapa).
6. **Revalidar caché** (si no, el cambio no se ve): tag `landing` + invalidar CloudFront `--paths "/<slug>*"` (ver `docs/maintenance/cache-revalidation.md`).
7. **Verificar** con los tests de consistencia: `npx jest __tests__/integration/oposicionesDataConsistency --no-coverage`.

## 3. Qué NO tocar

- **NO** tocar temario / epígrafes / `topic_scope` / tests. El rollover es de **datos de convocatoria** (fechas/plazas/estado/SEO/hitos), no de contenido. El temario del ciclo anterior suele servir para el siguiente (o cambia poco).

## 4. La regla, y el caso que enseña por qué

### La regla (Manuel, 16/07/2026)

> **Se activa siempre la VENDIBLE.** Si el examen pasó, no es vendible → se activa la **siguiente OEP y
> convocatoria si las hay**; si no hay, una **previsión**. *"Pero debe indicarse si es previsión o son
> datos reales: las previsiones son previsiones."*

| situación | fila viva | plazas |
|---|---|---|
| OEP publicada | ciclo nuevo, `estado='oep_aprobada'` | **reales**, del decreto, con cita + documento clonado |
| Convocatoria abierta | ciclo nuevo, `estado='inscripcion_abierta'`… | **reales**, de la resolución |
| Nada publicado aún | ciclo nuevo, `estado='sin_oep'` | `plazas_prevision=true` + `plazas_prevision_motivo` (un CHECK lo exige), o **NULL** |

### ⛔ NO se pivota en la misma fila — se hace ROLLOVER

`convocatorias."año"` es **inmutable por trigger**. La única vía legítima:

```sql
SELECT public.rollover_convocatoria(<oposicion_id>, <año_nuevo>, '<estado>', 'claude:<tarea>');
```
Archiva la vigente (`is_current=false`, `archived_at`) e **inserta una nueva viva**. El ciclo nuevo
**nace VACÍO a propósito** (solo hereda temario/examen/requisitos, que no son hechos del proceso): se
rellena **solo** desde fuente verificada. Copiar las plazas del ciclo anterior "de referencia" es el
bug de Marta — un dato viejo presentado como el del ciclo nuevo.

Y **cada ciclo con su documento**: `clonar-documento.ts --slug=… --anio=<año>` (con `--anio` también el
archivado, que sin él se queda sin prueba para siempre).

### El caso que lo enseñó: Aux. Admin. del Estado (destapado 16/07/2026)

La versión anterior de este runbook daba como **modelo a seguir** el pivote *in-place* del 11/06: se
actualizó la fila 2025 con los datos de la OEP 2026 (`plazas_libres=1.450`, hitos y SEO forward). El
resultado, tres semanas después:

```
fila año=2025:  plazas_libres = 1.450  ← OEP 2026 (RD 387/2026)
                plazas_promocion_interna = 720  ← convocatoria 2025 (Res. 18/12/2025)
                boe_reference = BOE-A-2025-26262 ← 2025
                → "total" = 2.170 : un número que NO EXISTE en ningún documento
```

La fila real de 2025 convocó **1.700** (156 de reserva) + 720; la OEP 2026 ofrece **1.450** (141) + 120.
Ninguna de las dos verdades sobrevivió: quedó una mezcla. Y no se pudo recuperar del historial porque
`convocatorias_history` nació después.

Arreglado con rollover: `2025 archivada` (1.700/720/156, con su Resolución clonada) + `2026 vigente`
(1.450/120/141, con el RD 387/2026 clonado). Igual en `administrativo-estado` y `tecnico-informatica`.

**Lección:** el pivote in-place parece inocuo porque la landing "queda bien" — y deja la BD contando
plazas de dos procesos distintos. Con un ciclo por fila y un documento por ciclo, es imposible.

### Variante sin OEP nueva firme

**SERMAS (09/06/2026)**: se mantuvo el estado real con hitos + SEO forward. Hoy eso sería un ciclo nuevo
con `plazas_prevision=true` y su motivo, o sin plazas — nunca las del ciclo viejo "de referencia".

## Relacionados
- `docs/maintenance/crear-nueva-oposicion.md` §2a.1-bis (procedimiento detallado del pivote forward) y §2c (convocatorias SSOT).
- `docs/runbooks/google-ads-analisis.md` — el **pago** se seca tras el examen (pausar); el **orgánico/leads NO** — es justo lo que sostiene la landing forward.
- Memoria `feedback_convocatoria_caducada_actualizar_inplace`.
