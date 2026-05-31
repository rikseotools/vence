# Banner global "Inscripción abierta"

**Estado:** ✅ v1 implementada + hardening de datos (2026-05-27, sin push)
**Owner:** Manuel · Claude

## Objetivo

Captar el ángulo **boca-oreja**: el usuario que estudia Aux Admin Estado
puede tener un familiar/amigo al que le interese la convocatoria de
Guardia Civil con plazo abierto. Vence se beneficia de la red personal
del usuario sin emails/push intrusivos.

## Decisiones de diseño (alineadas con Manuel)

| Decisión | Elegido | Razón |
|---|---|---|
| Visibilidad | Global excepto test activo + admin | Máxima exposición sin interrumpir estudio |
| Sin target_oposicion | Mostrar con copy genérico | Captura curiosos/familiares que aún no eligieron target |
| Persistencia dismiss logueado | Tabla dedicada `user_inscription_banner_dismissals` | Semántica clara, fácil extender |
| Persistencia dismiss anónimo | localStorage (`vence_dismissed_inscription_banners`) | Sin auth, ligero |
| Source-of-truth "abierta" | Fechas (`inscription_start ≤ hoy ≤ inscription_deadline`) | NO usar `estado_proceso` — se desincroniza (caso Guardia Civil 27/05) |
| Múltiples abiertas | Mostrar la más urgente (deadline asc), 1 a la vez | Evitar ruido |
| Invalidación de dismiss | Cuando cambia `boe_reference` de la oposición | Nueva convocatoria = información nueva |

## Arquitectura

```
┌─────────────────────────────────────────────┐
│  BD: user_inscription_banner_dismissals     │
│  (user_id, oposicion_slug, boe_at_dismiss)  │
└─────────────────────────────────────────────┘
                  ▲           ▲
                  │           │
   GET /api/v2/banner/        POST /api/v2/banner/
   open-inscriptions          open-inscriptions/dismiss
   ↓ devuelve:                ← UPSERT con boe snapshot
   { open: [...] ordenado     ← anon: 200 OK no-op
     por deadline asc,
     dismissed: [...] del
     user logueado,
     targetOposicion }
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  components/OpenInscriptionBanner.tsx       │
│  - Fetch al endpoint                        │
│  - Mezcla dismissed servidor + localStorage │
│  - Excluye target_oposicion                 │
│  - Renderiza la 1ª restante con CTA + X     │
└─────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  app/ClientLayoutContent.tsx                │
│  Inyectado tras los banners existentes,     │
│  oculto en /test/, /admin/, /auth/, /debug/ │
└─────────────────────────────────────────────┘
```

## Archivos tocados

- `supabase/migrations/20260527_inscription_banner_dismissals.sql` (nueva tabla + RLS)
- `app/api/v2/banner/open-inscriptions/route.ts` (GET)
- `app/api/v2/banner/open-inscriptions/dismiss/route.ts` (POST)
- `components/OpenInscriptionBanner.tsx` (componente)
- `app/ClientLayoutContent.tsx` (integración)

## Estado de datos (auditoría 2026-05-27, post-hardening)

- **0 oposiciones elegibles HOY** → banner no se dispara mal de inicio
- **0 columnas NULL con hito existente** ("banner ciego") — Cádiz y GVA corregidas
- **0 drift real** entre columna y hito (Baleares tiene mismatch legítimo: hito original + ampliación coexisten)
- ✅ Guardia Civil: `estado_proceso` actualizado a `inscripcion_cerrada` (deadline 25/05 ya pasó)
- **5 sin fechas + sin hitos:** coherente con estados `oep_aprobada` (3) / `sin_oep` (1) / `inscripcion_cerrada` (1)

### Fixes aplicados (verificados contra fuente oficial)

| Slug | Antes | Después | Fuente |
|---|---|---|---|
| `auxiliar-administrativo-diputacion-cadiz` | `start=NULL, deadline=NULL` | `start=2024-01-26, deadline=2024-02-22` | BOE-A-2024-1395 |
| `auxiliar-enfermeria-gva` | `start=NULL, deadline=NULL` | `start=2026-03-13, deadline=2026-03-27` | DOGV núm. 10321 |
| `guardia-civil` | `estado_proceso=inscripcion_abierta` con deadline pasado | `estado_proceso=inscripcion_cerrada` | (deadline 25/05 pasado) |

### Hardening estructural

- ✅ Manual `docs/maintenance/oeps-convocatorias-seguimiento.md` **§4g-bis nueva**: regla "al añadir hito apertura/cierre inscripción → sincronizar columna `inscription_*`" + caso real + **footgun de driver pg con DATE en Node.js** documentado (`.toISOString().slice(0,10)` resta 1 día desde Madrid; usar `::text` en SQL).
- ✅ Test `__tests__/integration/oposicionesDataConsistency.test.ts` ampliado: `inscription_start ↔ hito apertura` (simétrico al de `inscription_deadline`). Regex restrictiva: requiere "inscripción/solicitudes" en la misma frase, no matchea "apertura plazo de méritos". 2 tests passing.

## Próximos pasos / deuda

### Antes de push a producción

- [ ] Smoke test manual: levantar dev server, visitar `/leyes` (anon) y `/mis-estadisticas` (logueado), comprobar:
  - Hoy NO aparece banner (0 open). ✅ esperado.
  - Forzar artificialmente con un INSERT temporal en `oposiciones` (deadline futuro) y volver a probar.
  - Pulsar X → desaparece. Recargar → sigue desaparecido (localStorage anon / tabla logueado).
- [ ] Configurar `git push` cuando Manuel autorice.
- [ ] Tras deploy: monitor de Vercel + verificar que el endpoint responde 200.

### Mejoras futuras (v2+)

- **Crear hitos apertura faltantes** en 8 oposiciones con `inscription_start` pero sin hito (Navarra, Baleares, Cádiz, León, Celador SERMAS, Celador SESCAM, Enfermero SAS, Policía Municipal Madrid). NO afecta al banner, sí a la coherencia del timeline visual.
- **Cron auto-update `estado_proceso`**: tras pasar deadline, marcar automáticamente `inscripcion_cerrada`. Independiente del banner pero ayuda a coherencia general (caso Guardia Civil 27/05).
- **Métricas**: contador de impresiones vs clicks vs dismisses por oposicion_slug (¿`observable_events`?). Permitiría calibrar el copy.
- **A/B copy**: probar variantes ("Sabemos que preparas X..." vs "Plazo abierto: Y..." simple).
- **Banner stacking**: cuando hay >1 abierta, rotar o permitir avanzar. v1 muestra solo la más urgente.

## Riesgos / tradeoffs

| Riesgo | Mitigación |
|---|---|
| `inscription_deadline` está mal → banner miente | Auditoría exhaustiva 27/05 completada: 0 drift real, 0 banner ciego. Manual + test ahora previenen reincidencia. |
| Spam si hay 5+ oposiciones abiertas (ej. AGE Enero-Febrero) | 1 banner a la vez + dismiss persistente por slug |
| Hydration mismatch al leer localStorage en SSR | Resuelto: `useEffect` lee tras mount, banner inicial es `null` hasta `loaded=true` |
| Convocatoria nueva pero user ya dismisseó la anterior | Snapshot de `boe_reference_at_dismiss` invalida cuando cambia BOE |
| Cache CDN sirve mismo banner a todos | `Cache-Control: private` — no compartido entre usuarios |

## Rollback

```sql
DROP TABLE IF EXISTS public.user_inscription_banner_dismissals;
```

```bash
git revert <commit-hash>
# o eliminar manualmente los 4 archivos nuevos + el cambio en ClientLayoutContent.tsx
```
