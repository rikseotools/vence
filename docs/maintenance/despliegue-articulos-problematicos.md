# Despliegue gradual: artículos problemáticos

Runbook para el despliegue gradual del reemplazo de la RPC
`get_user_problematic_articles_weekly` por el helper Drizzle tipado con scope
por `target_oposicion`.

Contexto: refactor oposicion-scope, FASE 5. Bug original: dispute
`4e247ddc-313b-46d7-81e9-cf20f6a48acc` (Mar Vazquez — Aux Estado recibiendo
artículos de leyes CyL).

## Qué controla el rollout

Una sola env var en Vercel:

```
NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT=<0..100>
```

- `0` → todos los usuarios usan la RPC vieja (estado post-deploy inicial).
- `10` → ~10% de usuarios usan el helper nuevo. Mismos usuarios siempre.
- `100` → todos usan el helper nuevo.

El reparto es determinista por `djb2(userId) % 100 < PCT`, definido en
`lib/api/rollout/problematic-articles.ts`.

Afecta a dos lugares que se leen con la misma variable:
- Cliente: `hooks/useIntelligentNotifications.ts` (notificaciones push + UI).
- Server: `lib/emails/emailService.server.ts` (emails de resumen semanal).

El endpoint tipado vive en `app/api/notifications/problematic-articles/route.ts`.

## Procedimiento recomendado

1. **0% (ahora mismo).** Código desplegado, nadie usa el path nuevo todavía.
   Baseline en `__tests__/api/notifications/fixtures/problematic-articles-baseline.json`.

2. **10%.** Cambia la var en Vercel → redeploy automático (~2 min).
   Monitoriza 24-48h en el **panel admin** `/admin/despliegues/articulos-problematicos`
   (link "🚀 Despliegue" en la cabecera). Qué mirar:
   - Bucket "path nuevo" con llamadas registradas (si está a 0 tras varios
     minutos con tráfico, algo va mal).
   - `% con 0 artículos` del path nuevo similar al del viejo (pequeña subida
     es esperable por el filtro de scope). Si supera 50% con >10 llamadas, el
     propio panel muestra aviso en rojo → considera rollback.
   - Media de artículos comparable entre ambos buckets.
   - Tabla de últimas llamadas → filas verdes con `0` en columna `#` son
     sospechosas, investigar ese user_id.
   - Vercel Logs → prefijo `❌ [problematic-articles]` → no debe aparecer.
   - Admin "🐕 Errores API" → no debe haber entradas nuevas del endpoint.

3. **50%.** Mismo monitoreo 24h.

4. **100%.** Mismo monitoreo 24h.

5. **Cleanup** (cuando 100% esté estable ≥3 días):
   - Borrar la rama `else { supabase.rpc(...) }` en
     `hooks/useIntelligentNotifications.ts` y `lib/emails/emailService.server.ts`.
   - Borrar `lib/api/rollout/problematic-articles.ts`,
     `lib/api/rollout/problematic-articles-logs.ts` + sus tests.
   - Borrar el panel admin (`app/admin/despliegues/articulos-problematicos`)
     + API route + link en `layout.tsx`.
   - Borrar la var en Vercel.
   - Crear migration `database/migrations/YYYY-MM-DD-drop-problematic-articles-rpc.sql`
     con `DROP FUNCTION public.get_user_problematic_articles_weekly(uuid);`
     + `DROP TABLE public.problematic_articles_rollout_logs;` y aplicarla.
   - Cerrar dispute `4e247ddc` confirmando el fix a Mar.

## Rollback

Cambia `NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT=0` en Vercel. Redeploy
automático tarda ~2 min. Usuarios con la pestaña abierta siguen con el bundle
viejo hasta recargar — sus requests al endpoint nuevo siguen funcionando
correctamente (no hay regresión, solo el bug cross-oposición ya arreglado).

No hay cambio de esquema en BD, la RPC vieja sigue existiendo intacta.

## Dónde mirar si algo falla

Orden de diagnóstico cuando alguien reporta un problema con notificaciones
de artículos problemáticos:

1. **¿Está el usuario en el bucket del path nuevo?**
   Calcular `djb2(userId) % 100`. Si `< PCT`, está en el nuevo.

2. **Logs del endpoint** — Vercel Logs, buscar
   `/api/notifications/problematic-articles` + su user id.

3. **Scope calculado** — reproducir local:
   ```bash
   node -e "
   require('dotenv').config({ path: '.env.local' });
   const { getAllowedLawIds } = require('./lib/api/oposicion-scope/queries');
   getAllowedLawIds({ userId: '<uuid>' }).then(console.log);
   "
   ```

4. **Output del helper** — reproducir local con el userId afectado y
   compararlo contra el baseline JSON.

5. **Comparar con RPC vieja** — ejecutar la RPC directamente:
   ```sql
   SELECT * FROM public.get_user_problematic_articles_weekly('<uuid>'::uuid);
   ```
   Si el viejo incluye leyes fuera del scope del usuario → comportamiento
   esperado (es el bug). Si el nuevo las incluye → hay regresión en el
   helper Drizzle; revisar `lib/api/notifications/queries.ts`.

## Archivos clave

| Archivo | Rol |
|---|---|
| `lib/api/rollout/problematic-articles.ts` | Helper del bucket por userId |
| `lib/api/rollout/problematic-articles-logs.ts` | Logging del rollout |
| `lib/api/oposicion-scope/queries.ts` | `getAllowedLawIds`, `filterSelectedLawsByScope` |
| `lib/api/notifications/queries.ts` | Helper Drizzle tipado |
| `app/api/notifications/problematic-articles/route.ts` | Endpoint `GET` |
| `app/api/v2/admin/problematic-articles-rollout/route.ts` | API del panel admin |
| `app/admin/despliegues/articulos-problematicos/page.tsx` | Panel admin |
| `hooks/useIntelligentNotifications.ts` (≈ línea 1008) | Consumer cliente |
| `lib/emails/emailService.server.ts` (≈ línea 728) | Consumer server |
| `database/migrations/2026-04-14-baseline-problematic-articles-rpc.sql` | Definición histórica de la RPC |
| `database/migrations/2026-04-14-problematic-articles-rollout-logs.sql` | Tabla de logs del rollout |
| `__tests__/api/notifications/fixtures/problematic-articles-baseline.json` | Snapshot de 3 usuarios pre-fix |
| `__tests__/api/notifications/problematicArticlesScoping.test.ts` | Tests del helper |
| `__tests__/api/rollout/problematicArticlesRollout.test.ts` | Tests del bucket |
