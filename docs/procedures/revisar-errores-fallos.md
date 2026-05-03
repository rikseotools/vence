# Revisar Errores y Fallos — Guía Unificada

Guía rápida para investigar errores de producción. Combina las 3 fuentes de datos disponibles.

## Las 3 fuentes de errores

| Fuente | Qué captura | Dónde se ve | Cuándo usarla |
|--------|------------|-------------|---------------|
| **Errores API** (BD) | Respuestas 4xx/5xx de endpoints | Panel admin `/admin/errores-validacion` | Errores de servidor, fallos de guardado, auth |
| **Sentry** | Excepciones client-side + server-side | API de Sentry o panel admin (badge) | Errores de UI, componentes que crashean, TTS watchdog |
| **Vercel Logs** | stdout/stderr del runtime | Dashboard Vercel o logs que el usuario copie | Errores de build, cold starts, timeouts de función |

## Flujo rápido de revisión

### 1. Errores API (lo más común)

```bash
# Errores no revisados de las últimas 24h
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase
    .from('validation_error_logs')
    .select('created_at, endpoint, error_type, error_message, http_status, severity, user_id, deploy_version')
    .is('reviewed_at', null)
    .gte('created_at', new Date(Date.now() - 86400000).toISOString())
    .neq('deploy_version', 'local')
    .order('created_at', { ascending: false })
    .limit(20);
  (data||[]).forEach(e => console.log(
    e.created_at?.slice(0,16), '|', e.severity, '|', e.endpoint, '|', e.error_type, '|', e.error_message?.slice(0,80), '|', e.http_status
  ));
})();
"
```

**Filtrar ruido:** `deploy_version = 'local'` → desarrollo. `error_type = 'network'` → red del usuario.

Manual detallado: `docs/maintenance/revisar-errores-api.md`

### 2. Sentry (errores client-side)

```bash
# Issues sin resolver — producción
node -e "
require('dotenv').config({ path: '.env.local' });
fetch('https://sentry.io/api/0/organizations/vence-x2/issues/?statsPeriod=24h&query=is:unresolved+environment:vercel-production', {
  headers: { 'Authorization': 'Bearer ' + process.env.SENTRY_AUTH_TOKEN }
})
.then(r => r.json())
.then(issues => {
  console.log('Issues sin resolver:', issues.length);
  issues.forEach(i => console.log(
    i.count + 'x |', i.title?.slice(0,80), '|', i.culprit?.slice(0,40), '| last:', i.lastSeen?.slice(0,16)
  ));
});
"
```

```bash
# Filtrar por componente específico (ej: TTS)
# query=is:unresolved+ArticleTTS
# query=is:unresolved+tts/watchdog
# query=is:unresolved+DynamicTest
# query=is:unresolved+ExamLayout
```

```bash
# Ver detalles de un issue (stacktrace, breadcrumbs, device)
node -e "
require('dotenv').config({ path: '.env.local' });
const issueId = 'PONER_ISSUE_ID';
fetch('https://sentry.io/api/0/organizations/vence-x2/issues/' + issueId + '/events/latest/', {
  headers: { 'Authorization': 'Bearer ' + process.env.SENTRY_AUTH_TOKEN }
})
.then(r => r.json())
.then(data => {
  console.log('Date:', data.dateCreated);
  console.log('Tags:', JSON.stringify(data.tags?.filter(t =>
    ['browser', 'os', 'device', 'url', 'component', 'endpoint', 'deploy'].includes(t.key)
  ), null, 2));
  // Excepciones
  data.entries?.forEach(entry => {
    if (entry.type === 'exception') {
      entry.data.values.forEach(exc => {
        console.log('Exception:', exc.type, '-', exc.value);
        exc.stacktrace?.frames.slice(-5).forEach(f => {
          console.log('  -', f.function, '|', f.filename?.split('/').pop());
        });
      });
    }
  });
});
"
```

```bash
# Cerrar/ignorar un issue
curl -X PUT \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}' \
  "https://sentry.io/api/0/organizations/vence-x2/issues/ISSUE_ID/"
```

**Tags importantes para filtrar:**

| Tag | Valores | Qué indica |
|-----|---------|------------|
| `component` | `ArticleTTS`, `DynamicTest`, `ExamLayout`... | Qué componente falló |
| `endpoint` | `tts/watchdog`, `/api/answer`... | Qué endpoint o sistema |
| `source` | `client` | Error del navegador del usuario |
| `deploy` | SHA del commit | Qué versión del código |

Manual detallado: `docs/maintenance/sentry-troubleshooting.md`

### 3. Vercel Logs (cuando las otras 2 no muestran nada)

Los logs de Vercel no se consultan por API desde aquí. El usuario los copia del dashboard de Vercel y los pega en la conversación.

**Qué buscar:**
- `ERR` o `Error` → errores de runtime
- `FUNCTION_INVOCATION_TIMEOUT` → función serverless tardó >60s
- `504 Gateway Timeout` → BD no respondió
- `EDGE_FUNCTION_INVOCATION_FAILED` → error en middleware
- `⚠️ [...] Respuesta lenta: Xms` → warning, no error 5xx — ver sección 4

### 4. Investigar lentitud (warnings ⚠️ que no son errores 5xx)

Cuando los logs de Vercel muestran warnings de respuesta lenta sin que haya error real (status 200 con warning de 2-10s), la metodología es distinta. **No es un fallo, es performance degradada** — y el camino para diagnosticar evita varias trampas que parecen obvias pero no lo son.

#### Trampa #1: NO confíes en `pg_stat_statements` sin verificar `stats_reset`

`pg_stat_statements` agrega cumulativamente desde el último reset. Si la última vez que se reseteó fue hace meses, una query que se OPTIMIZÓ entre medias seguirá apareciendo con el `mean_exec_time` viejo durante mucho tiempo. **Las cifras viejas dominan las nuevas hasta que la query nueva se ejecuta cientos de veces.**

Verifica SIEMPRE antes de interpretar means:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const r = await c.query('SELECT stats_reset FROM pg_stat_statements_info');
  console.log('stats_reset:', r.rows[0].stats_reset);
  console.log('Si es de hace > 1 semana y has hecho optimizaciones, las medias mienten.');
  await c.end();
})();
"
```

Si las stats son antiguas y has hecho optimizaciones recientes, **resetea**:

```sql
SELECT pg_stat_statements_reset();
```

Espera 2-4 horas con tráfico real antes de volver a interpretar.

#### Trampa #2: NO asumas que la media coincide con la realidad actual

Mide el query DIRECTAMENTE para 3 top users. Si pg_stat_statements dice 8s mean pero el bench da 50-160ms, la cifra acumulada es ruido histórico. Usa este patrón:

```bash
# Ejemplo: medir el query del endpoint sospechoso para los 3 usuarios con más actividad
node -e "
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const top = await c.query(\`SELECT user_id FROM tests WHERE user_id IS NOT NULL GROUP BY user_id ORDER BY count(*) DESC LIMIT 3\`);
  for (const u of top.rows) {
    const t0 = Date.now();
    await c.query(\`SELECT ... WHERE user_id = \$1\`, [u.user_id]);  // tu query real
    console.log('user', u.user_id.slice(0,8) + ':', Date.now() - t0 + 'ms');
  }
  await c.end();
})();
"
```

#### Checklist completo de health (ejecutar TODO de una pasada)

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();

  // 1. Reset timing
  const reset = await c.query('SELECT stats_reset FROM pg_stat_statements_info');
  console.log('=== pg_stat_statements stats_reset:', reset.rows[0].stats_reset, '===');

  // 2. Top queries lentas (RECUERDA: medias acumuladas desde stats_reset)
  const top = await c.query(\`
    SELECT calls, ROUND(mean_exec_time::numeric, 1) AS mean_ms,
           ROUND(max_exec_time::numeric, 1) AS max_ms,
           substring(query, 1, 150) AS q
    FROM pg_stat_statements
    WHERE mean_exec_time > 100
    ORDER BY mean_exec_time DESC LIMIT 10
  \`);
  console.log('\\n=== Top queries lentas ===');
  top.rows.forEach((r, i) => console.log(i+1+'.', r.mean_ms+'ms |', r.calls, 'calls |', r.q.replace(/\\s+/g,' ').slice(0,100)));

  // 3. Crons salud (si la tabla existe)
  try {
    const cron = await c.query(\`
      SELECT cron_name, count(*) AS runs, ROUND(avg(duration_ms)) AS avg_ms,
             max(duration_ms) AS max_ms,
             sum(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failures,
             max(started_at) AS last
      FROM cron_runs
      WHERE started_at > now() - interval '12 hours'
      GROUP BY cron_name ORDER BY avg_ms DESC
    \`);
    console.log('\\n=== Cron runs últimas 12h ===');
    if (cron.rows.length === 0) console.log('  (vacío — verifica si los crons están corriendo)');
    cron.rows.forEach(r => console.log(' ', r.cron_name, 'runs:', r.runs, 'avg:', r.avg_ms+'ms', 'fails:', r.failures, 'last:', r.last));
  } catch {}

  // 4. Backlog dirty
  const dirty = await c.query(\`SELECT count(*) FILTER (WHERE stats_dirty=true) AS s, count(*) FILTER (WHERE global_dirty=true) AS g FROM questions\`);
  console.log('\\n=== Backlog dirty (preguntas pendientes de recálculo) ===\\n ', dirty.rows[0]);

  // 5. Pool state
  const conns = await c.query(\`SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY state\`);
  console.log('\\n=== Conexiones activas ===');
  conns.rows.forEach(r => console.log(' ', r.state || '(null)', ':', r.count));

  // 6. Locks
  const locks = await c.query(\`SELECT count(*) AS waiting FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()\`);
  console.log('  locks waiting:', locks.rows[0].waiting);

  // 7. Triggers ENABLED en tablas calientes (smoke test post-migración)
  for (const tbl of ['test_questions', 'tests', 'questions']) {
    const tr = await c.query(\`
      SELECT t.tgname, p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = \$1::regclass AND NOT t.tgisinternal AND t.tgenabled != 'D'
      ORDER BY t.tgname
    \`, [tbl]);
    console.log(\`\\n=== Triggers ENABLED en \${tbl} ===\`);
    tr.rows.forEach(r => console.log(' ', r.tgname, '->', r.proname));
  }

  await c.end();
})();
"
```

#### Cómo interpretar lo que sale

| Síntoma | Diagnóstico | Acción |
|---|---|---|
| `stats_reset` antiguo + means altos pero benchmark per-user rápido | Las cifras son fantasmas históricos | Reset stats, esperar 2-4h, re-evaluar |
| Cron `runs` mucho menor de lo esperado para 12h | Schedule mal configurado o GH Actions parado | Verificar `.github/workflows/*.yml` y panel GH Actions |
| Backlog `stats_dirty` o `global_dirty` creciendo (>1000) | Cron procesa menos que tasa de inserción | Subir LIMIT por run, o aumentar frecuencia, o ambos |
| Pool con muchos `idle` y pocos `active` (ratio > 5:1) | Conexiones huérfanas que no se cierran | Revisar transacciones largas; `kill` selectivo si hay sesiones zombie |
| `locks waiting > 0` repetidamente | Lock contention | `SELECT * FROM pg_locks WHERE NOT granted` para ver qué espera qué |
| Triggers nuevos aparecen sin documentar | Migración aplicada sin actualizar docs | Actualizar `docs/database/tablas.md` y `docs/ARCHITECTURE_ROADMAP.md` |

#### Trampa #3: warnings ≠ outliers ≠ problema sistémico

Un warning de `2228ms` ocasional es probablemente cold start de Vercel Fluid (lambda recién despierta, conexión BD por inicializar). Solo te debe preocupar si:
- Aparece >5 veces por hora
- Los picos suben (5s, 7s, 10s+)
- Coincide con cron pesado u otra actividad correlacionada

Antes de gastar horas optimizando, **resetea `pg_stat_statements`** y **espera 2-4h con tráfico real**. Si tras eso siguen apareciendo medias altas en queries específicas, ahí sí merece la pena ir a fondo.

#### Logs intencionales que NO son problemas

Algunos `console.warn` se loguean a propósito como auditoría. No son bugs:

| Patrón | Origen | Significado |
|---|---|---|
| `🔍 [shadow] /api/profile ... sin Bearer token` | `app/api/profile/route.ts` | Migración de auth paso 3/7 — log para identificar callers antes del enforcement |
| `📉 [DailyLimit] Graduated limit applied` | `lib/api/dailyLimit.ts` | Observabilidad de límites graduados — info, no error |
| `🚫 [DailyLimit] Graduated user blocked` | idem | Usuario bloqueado por límite — comportamiento correcto |
| `🧟 [API/v2/user-stats] FK violation (zombie session...)` | `app/api/v2/user-stats/route.ts` | Sesión de usuario eliminado, devuelve 401 deliberado |

Si encuentras un `console.warn` que no entiendes, **busca su origen primero** antes de declararlo bug — la mayoría de warnings deliberados están comentados explicando por qué.

## Componentes que loguean a Sentry (client-side)

| Componente | Endpoint en Sentry | Qué captura |
|------------|-------------------|-------------|
| `ArticleTTS` | `tts/watchdog` | Watchdog detecta speech muerto o chunk zombie |
| `DynamicTest` | `/api/answer` | Error al validar respuesta |
| `ExamLayout` | `/api/exam/validate` | Error al validar examen |
| `TestLayout` | `/api/answer` | Error al validar respuesta |

Todos usan `logClientError()` de `lib/logClientError.ts`.

## Tabla de errores API en BD

**Tabla:** `validation_error_logs`

**Campos clave:** `severity`, `endpoint`, `error_type`, `error_message`, `user_id`, `http_status`, `deploy_version`, `reviewed_at`

**Indices:** `created_at`, `endpoint`, `error_type`, `user_id`, `deploy_version`

## Archivos clave

| Archivo | Función |
|---------|---------|
| `lib/api/withErrorLogging.ts` | Wrapper server-side: captura 4xx/5xx → BD |
| `lib/logClientError.ts` | Helper client-side: captura errores → Sentry |
| `sentry.client.config.ts` | Config Sentry client (ignoreErrors, etc.) |
| `docs/maintenance/revisar-errores-api.md` | Manual detallado errores API |
| `docs/maintenance/sentry-troubleshooting.md` | Manual detallado Sentry |

**Nota (2026-05-03):** El antiguo badge admin con count de issues Sentry
(`/api/admin/sentry-issues` + `hooks/useSentryIssues.ts`) fue eliminado
por desuso (badge hardcoded a 0 desde hace meses, hook no importado por
ningún componente). Para revisar issues Sentry: usa la **CLI con curl**
documentada en la sección 2 (`Sentry`) más arriba, o el dashboard web
de Sentry directamente (https://sentry.io).
