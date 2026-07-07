# Runbook — Rollover de oposiciones (examen pasado → pivotar landing hacia delante)

**Cuándo seguir este runbook (CUALQUIERA de estas frases → este runbook):** *"haz rollover"*, *"revisa rollover"*, *"revisa los rollover"*, *"revisa exámenes hechos"*, *"revisa exámenes pasados/realizados"*, *"oposiciones con examen pasado/hecho"*, *"actualiza las landings viejas/caducadas"*, o cuando vea el **badge ámbar en el nav "Oposiciones"** (`/admin/oposiciones?tab=rollover`) y me lo indique. **Todas apuntan aquí.** Seguir esto ANTES de improvisar. (OJO: *"revisa OEPs"* es OTRA cosa — seguimiento de convocatorias, `oep_detection_signals`, badge 🎯; no confundir.)

> 🎯 **Principio (runbook `crear-nueva-oposicion.md` §2a.1-bis):** una landing es un **activo de captación que NUNCA debe quedar en un callejón sin salida.** Una oposición **no muere cuando pasa su examen** — casi todas son recurrentes (nueva OEP/convocatoria cada 1-2 años) y el opositor que llega tras el examen se prepara para el **siguiente ciclo**. Cuando el examen pasa, hay que **pivotar la landing hacia delante**.

---

## 0. Qué avisa el badge

- **Badge ámbar** en el nav "Oposiciones" = nº de oposiciones que **preparamos** (activas / con tests / landing) con **`exam_date` ya pasada**. Fuente: `lib/api/oposiciones/rollover.ts` → endpoint `/api/admin/oposiciones/rollover-pending`.
- **Pestaña "Rollover"** (`/admin/oposiciones?tab=rollover`): lista las pendientes **ordenadas por demanda de usuarios** (`target_oposicion`), con estado, fecha de examen y días transcurridos.
- Una oposición **sale de la lista y el badge baja** en cuanto su `exam_date` se pone al día (null o futura). Es auto-vigilante.

## 1. Triaje: no todas necesitan rollover YA

- **Examen reciente (< ~6-8 semanas) + `estado_proceso='examen_realizado'`:** el ciclo sigue vivo (resultados/reclamaciones pendientes). Es **correcto**, no urgente. Se pivota cuando salgan resultados y/o se confirme la próxima OEP.
- **Examen antiguo (cerrado: `resultados`/`nombramientos`, o meses atrás):** landing en callejón sin salida → **pivotar YA**.
- Priorizar por **usuarios** (la columna de la pestaña). Una de 541 usuarios pesa más que una de 1.

## 2. Procedimiento de rollover (por oposición, con VERIFICACIÓN OFICIAL)

> ⚠️ **BD = RDS, nunca Supabase.** `DATABASE_URL` de `.env.local`, `ssl:{rejectUnauthorized:false}`. NUNCA inventar plazas/fechas — verificar en fuente oficial.

1. **Investigar la próxima OEP/convocatoria** (fuentes: sede/portal de empleo público de esa administración, BOE/boletín autonómico; contrastar con ADAMS/opositatest). Anotar: ¿hay plazas de ESA categoría pendientes de convocar en OEP recientes? Cifras + año, **verificado**.
2. **`UPDATE oposiciones`** (los campos que apliquen, ver `crear-nueva-oposicion.md` §2a.1-bis y §2c):
   - `estado_proceso` → según fase real (si hay OEP nueva: `oep_aprobada`; si aún no: mantener real pero con SEO/hitos forward).
   - `oep_decreto` / `oep_fecha` → de la **próxima** OEP (verificado en BOE/boletín).
   - `plazas_libres` (y `plazas_*`) → de la próxima OEP.
   - **`exam_date`** → **null** si el próximo examen no tiene fecha firme (si no, la landing sigue mostrando la fecha PASADA como "el examen"). La previsión va en un hito `upcoming`.
   - `seo_title` / `seo_description` → mirar al **próximo ciclo/OEP** ("OEP 20XX", "próxima convocatoria"), NUNCA al examen/año pasado.
3. **Hitos forward** (`convocatoria_hitos`): añadir la próxima OEP como hito `upcoming` ("OEP 20XX: N plazas, pendiente de convocar" + fecha placeholder). El timeline pasa a mostrar el **pipeline futuro**.
4. **Plazas VISIBLES** en `landing_estadisticas` (el bloque hero) — no solo en `plazas_libres`; si el array no tiene stat de plazas, añadirlo ("N Plazas OEP 20XX").
5. **Fila `is_current=true` de `convocatorias`** (SSOT §2c): dual-write consistente con `oposiciones` (estado_proceso, plazas, inscription_*).
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
