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
2. **`UPDATE convocatorias` (fila `is_current`)** — es la SSOT, lo que ve la landing:
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

## 4. Caso resuelto de referencia

`crear-nueva-oposicion.md` §2a.1-bis: **Aux. Admin. del Estado (11/06/2026)** — examen 23/05 pasado, OEP 2026 confirmada (RD 387/2026, 1.450 plazas) → `estado_proceso='oep_aprobada'`, oep_decreto/fecha 2026, hitos forward, SEO "OEP 2026: 1.450 plazas", stat de plazas añadido, `exam_date=null`. Y **SERMAS (09/06/2026)** — variante sin OEP nueva firme: se mantuvo estado real pero con hitos+SEO forward.

## Relacionados
- `docs/maintenance/crear-nueva-oposicion.md` §2a.1-bis (procedimiento detallado del pivote forward) y §2c (convocatorias SSOT).
- `docs/runbooks/google-ads-analisis.md` — el **pago** se seca tras el examen (pausar); el **orgánico/leads NO** — es justo lo que sostiene la landing forward.
- Memoria `feedback_convocatoria_caducada_actualizar_inplace`.
