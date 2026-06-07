# Tracker: crear landing de TODAS las convocatorias que captan leads

> **Origen:** "revisa oeps" 2026-06-04. Directiva Manuel: **crear todas las landings que capten leads, anotar la tarea de crear cada oposición, hacerlas poco a poco** ([[feedback_pensar_en_grande_no_por_tamano]]). No descartar ninguna convocatoria real.
>
> **Universo:** `oposiciones` tiene **465 filas `catalogada`** (`is_active=false`, no públicas, con `seguimiento_url`). De ellas **123 captan leads AHORA** (inscripción abierta o examen por venir) — 30 ADMIN core, 40 policía, 29 bombero, 19 sanitario, 5 otros. Otras 81 ADMIN están en `oep_aprobada` (captación SEO futura).
>
> **Prioridad de construcción:** ADMIN core primero (temario normativo reutilizable del banco Aux Admin Estado → coste marginal bajo) y dentro de ADMIN por captación: inscripción abierta > examen por venir > volumen de plazas/candidatos. Luego policía/bombero/sanitario. `oep_aprobada` = relleno SEO.

## Pipeline de build por oposición (manual `docs/maintenance/crear-nueva-oposicion.md`)

Cada tarea de "crear oposición" = este checklist:
- [ ] **FASE 1** — verificar convocatoria oficial (BOE/boletín) + extraer temario con epígrafes LITERALES + estructura examen + penalización.
- [ ] **FASE 2** — data layer: completar fila `oposiciones` (estado, plazas, fechas, landing_description, seo, examen_config, faqs, estadísticas) + `convocatoria_hitos`.
- [ ] **FASE 2b** — crear `topics` con epígrafes literales (`position_type` = slug con underscores).
- [ ] **FASE 3** — `topic_scope`: reutilizar banco Aux Admin Estado (CE, L39, L40, EBEP, igualdad, LOPD, contratos, PRL) + ofimática (leyes virtuales) + específicos (importar ley si falta en BD).
- [ ] **FASE 4** — entrada en `lib/config/oposiciones.ts` (+`examScoring` con penalización del BOE, +aliases) [código → build/test/commit].
- [ ] **FASE 5-6** — frontend/rutas, build, tests (`oposicionesDataConsistency`, `examPenaltyCoherence`), revalidar.
- [ ] **GO-LIVE** — `is_active=true` (SOLO con temario + preguntas; si no, tarjeta vacía rota).

> Atajo de coste: las preguntas se HEREDAN vía `topic_scope` (mismos artículos → mismas preguntas). Un Aux-Admin con temario estatal estándar entra en producción casi sin generar preguntas. Los temas específicos sin ley en BD quedan `disponible:false` hasta importar la norma.

---

## 🔨 EN CURSO

| Oposición | Plz | Estado | Avance | Falta |
|---|---|---|---|---|
| **auxiliar-administrativo-ingesa** | 9 (7+2) | inscr. abierta hasta 09/06 | ✅ FASE 1 + FASE 2 (data layer) | FASE 2b→GO-LIVE. Temario 35 temas (≈14 estatales reutilizables + Ley 55/2003 Estatuto Marco, Ley 14/1986 Gral Sanidad, RD 118/2023 INGESA, contrato gestión, estatutos Ceuta/Melilla LO 1+2/1995, Ley 41/2002, ofimática). examScoring 1/4. BOE-A-2026-10140. |
| **auxiliar-administrativo-universidad-uned** | 54 (48+6) | inscr. abierta hasta 25/06 | ✅ FASE 1 + FASE 2 (data layer) | FASE 2b→GO-LIVE. **Manuel: hacerla la ÚLTIMA.** Temario 21 (11 estatales reutilizables + LOSU + Estatutos UNED RD 181/2026 a importar + ofimática). BOE-A-2026-11556. |

## 📋 COLA — ADMIN core que capta leads (30) — orden de build

### Tier 1 · inscripción abierta / convocada (4 + UNED + INGESA ya en curso)
- [ ] `auxiliar-administrativo-universidad-cadiz` — 10 plz, inscr. hasta **10/06** ⚠️urge
- [ ] `auxiliar-administrativo-diputacion-cordoba` — 15 plz, convocada
- [ ] `administrativo-baleares` — 12 plz, inscr. abierta
- [ ] `administrativo-asturias` — 1 plz, convocada

### Tier 2 · examen por venir — ordenar por volumen/captación
- [ ] `administrativo-pais-vasco` — 350 plz ⭐ (verificar convocatoria C1; ≠ la dismissed de aux C2)
- [ ] `auxiliar-administrativo-osakidetza` — 708 plz ⭐ (OPE gigante; verificar fase)
- [ ] `auxiliar-administrativo-ibsalut` — 241 plz ⭐
- [ ] `administrativo-cataluna` — 201 plz ⭐ (temario institucional catalán) — ⚠️ verificar si examen ya pasó (inscr. cerró feb)
- [ ] `auxiliar-administrativo-sergas` — 84 plz
- [ ] `auxiliar-administrativo-universidad-complutense` — 53 plz
- [ ] `auxiliar-administrativo-universidad-alcala` — 52 plz
- [ ] `administrativo-canarias` — 46 plz
- [ ] `administrativo-murcia` — 45 plz
- [ ] `auxiliar-administrativo-universidad-huelva` — 38 plz
- [ ] `auxiliar-administrativo-diputacion-alicante` — 32 plz
- [ ] `administrativo-extremadura` — 29 plz
- [ ] `auxiliar-administrativo-melilla` — 26 plz
- [ ] `administrativo-aragon` — 25 plz
- [ ] `administrativo-madrid` — 23 plz (⚠️ inscr. cerró 06/2025, verificar fase)
- [ ] `auxiliar-administrativo-diputacion-sevilla` — 21 plz
- [ ] `auxiliar-administrativo-universidad-extremadura` — 17 plz
- [ ] `auxiliar-administrativo-universidad-autonoma-madrid` — 17 plz
- [ ] `auxiliar-administrativo-seris` — 8 plz
- [ ] `auxiliar-administrativo-universidad-leon` — 8 plz
- [ ] `auxiliar-administrativo-universidad-burgos` — 3 plz
- [ ] `auxiliar-administrativo-universidad-internacional-andalucia` — 2 plz
- [ ] `auxiliar-administrativo-ics` — ⚠️ inscr. cerró 07/2025, examen probablemente pasado, verificar
- [ ] `auxiliar-administrativo-scs-cantabria`

## 📋 COLA — no-core que capta leads (después de ADMIN)
- **Policía local (40)**, **Bombero (29)**, **Sanitario celador/enfermero (19)**, **otros (5)** en tier 1+2. Mayor coste de temario (más específico). Construir tras agotar ADMIN o por demanda explícita. Lista completa: `SELECT slug,estado_proceso,plazas_libres FROM oposiciones WHERE coverage_level='catalogada' AND is_active=false AND estado_proceso IN ('inscripcion_abierta','convocada','pendiente_examen','lista_admitidos','inscripcion_cerrada') ORDER BY slug;`

## ⚪ Captación SEO futura (oep_aprobada, 81 ADMIN + más)
Sin convocatoria aún → captan leads de la PRÓXIMA OEP (SEO, manual §11). Prioridad baja. Ej. relevantes: `auxiliar-administrativo-ayuntamiento-madrid` (gran ciudad).

## 🆕 Sin fila (en `discovered_processes`, manuel_status=new)
Cabildo Gran Canaria (Administrativo C1 / Oficial Conductor), Cabildo Tenerife (Administrativo PI), Ayto Las Palmas (Aux Admin C2), Dip Palencia (Secretaría). Crear fila al construir.

## Notas
- Verificar SIEMPRE la fase real contra boletín al construir (los `estado_proceso` de catalogada vienen del barrido y pueden estar stale: hay "pendiente_examen" cuyo examen ya pasó).
- `seguimiento_url` debe ser server-rendered y específica (no agregador genérico).
