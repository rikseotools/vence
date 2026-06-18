# Manual: Eliminación de Cuentas de Usuario (RGPD)

Este documento describe el proceso para eliminar cuentas de usuario cuando lo solicitan, cumpliendo con el **Art. 17 RGPD** (derecho al olvido) y manteniendo la **obligación legal de retención contable** (Art. 30 Código de Comercio, Art. 66 LGT).

## Resumen del Proceso

```
1. INVESTIGAR     → Reconstruir journey completo (no resumen)
2. DOCUMENTAR     → Escribir deletion_reason exhaustivo con el journey
3. REGISTRAR      → Insertar en deleted_users_log
4. EJECUTAR       → /api/admin/delete-user (archiva + cascade + auth)
5. VERIFICAR      → Confirmar user_profiles=0, auth.users=0, archived_data OK
```

---

## 1. Investigar al Usuario (IMPORTANTE)

**El `deletion_reason` debe contener el journey completo, no un resumen de tres líneas.** Es el único sitio donde queda preservada la investigación tras eliminar la cuenta. Si algún día alguien quiere entender por qué se fue un usuario, el deletion_reason es la referencia — no escribas "Se fue" y ya. Escribe:

- Perfil completo (email, plan, días activo, oposición, ciudad, fuente)
- **Cómo entró (captación):** canal real, anuncio/campaña y landing — de la tabla `user_acquisition`, **NO** de `registration_source` (que casi siempre vale `organic` y engaña). Ver §2bis. Sirve para detectar **campañas de pago mal configuradas** (gente que se da de baja a los minutos de llegar por un anuncio = dinero tirado).
- Actividad cuantificada (tests, respuestas, chat IA, disputas, errores)
- Subscripción y ciclo de pago
- **Journey completo del día de la solicitud** reconstruido de `user_interactions` minuto a minuto
- Hallazgos UX (bugs descubiertos, patrones de frustración, clicks repetidos, etc.)
- Motivo probable (natural vs frustración técnica)

### Ejemplo de deletion_reason exhaustivo

```
USUARIA PREMIUM CON USO CONSISTENTE, CESE NATURAL (58 DÍAS).

=== PERFIL ===
- Cristina H. · gimher@hotmail.com · Terrassa
- Registro: 2026-02-11 (Aux Administrativo Estado C2)
- Fuente: organic | funnel: test | stripe_customer: cus_TxvkmRbfonlJXK
- Plan: premium_monthly (sub_1Szzw3IeJQ31GiECKMqxfvkD)

=== ACTIVIDAD ===
- Días totales: 58 (11-feb a 10-abr)
- Tests realizados: 61
- Primer test: 12-feb (día siguiente al registro)
- Último test: 21-feb
- Periodo activo real: 10 días (12-21 feb), ráfaga intensiva
- Periodo inactivo antes de pedir eliminación: 48 días
- Errores técnicos: 0 | Impugnaciones: 0 | Mensajes chat IA: 0

=== SUBSCRIPCIÓN ===
- Creada: 12-feb (pago inmediato tras probar)
- Cancelación: cancel_at_period_end=true
- Current period end: 12-abr

=== JOURNEY DEL DÍA DE LA SOLICITUD (2026-04-10) ===
07:35:29  page_view /auxiliar-administrativo-estado/temario/tema-1
07:35:45  click [Mi Perfil] → /perfil
07:36:10  click [🗑️Solicitar eliminación]
07:36:17  click input [ELIMINAR]
07:36:24  click [🗑️Confirmar eliminación]  ← PRIMER INTENTO
07:39:24  page unload (3 minutos sin feedback visual)
... etc

=== HALLAZGO UX ===
Clicó 'Confirmar eliminación' DOS VECES con 4 minutos de diferencia.
El primer click no produjo feedback visible → pensó que no funcionó.
Mismo patrón que Ana María (07-feb-2026).

=== MOTIVO PROBABLE ===
Cese natural de uso. Sin señales de frustración técnica.
```

**Cualquier cosa más corta que esto es pereza.** El valor del log está en la exhaustividad.

---

## 2. Cómo investigar el journey (query reutilizable)

```js
const { data: events } = await supabase.from('user_interactions')
  .select('created_at, event_type, action, element_text, page_url, deploy_version, value')
  .eq('user_id', userId)
  .gte('created_at', 'YYYY-MM-DDT00:00:00')
  .order('created_at', { ascending: true })
```

**Señales a buscar**:

- **Frustración**: clicks repetidos en la misma página/botón → UI confusa
- **Bugs**: clicks en "Confirmar" sin efecto visible, luego reintento → falta feedback UX
- **Abandono**: page_exit sin test_test_completed → test abandonado
- **Deploy mid-test**: cambio de `deploy_version` durante una sesión activa → bug caso francofila (ver useVersionCheck.ts)

Ver también: `docs/procedures/investigar-journey-usuario.md`

---

## 2bis. Cómo entró el usuario (captación) — detectar campañas mal configuradas

**Objetivo:** ver de qué canal/anuncio vino quien se da de baja. Si muchas bajas tempranas concentran el mismo `channel`/`utm_campaign`/`landing_path`, esa campaña atrae gente que no encaja (mala segmentación, anuncio engañoso o landing equivocado) → estás **pagando por registros que se van**. Es la señal para apagar o reorientar la campaña.

**Fuente correcta:** tabla `user_acquisition` (1 fila por usuario, escrita al registrarse). **NO** uses `user_profiles.registration_source` (por defecto `'organic'`, no fiable). El `channel` se deriva del `referrer` de la 1ª visita (p.ej. `https://chatgpt.com/` → `chatgpt.com`); los anuncios de pago se reconocen por los click-IDs en la URL (`gclid` Google, `fbclid` Meta) y `utm_campaign`, no por el referrer. (Cobertura: datos solo desde 2026-06-02.)

```js
const { data: acq } = await supabase.from('user_acquisition')
  .select('channel, gclid, fbclid, utm_source, utm_medium, utm_campaign, landing_path, referrer, captured_at')
  .eq('user_id', userId).maybeSingle();
// channel='google_ads'/'meta_ads' + utm_campaign → vino de un anuncio de pago concreto.
// channel='chatgpt.com'/'organic'/'direct' → no es publicidad de pago.
```

> ⚠️ **GOTCHA crítico — captúralo ANTES de borrar.** `user_acquisition` tiene FK `ON DELETE CASCADE`: al ejecutar el borrado **desaparece**. Por eso la captación (canal, `gclid`/`fbclid`, `utm_campaign`, `landing_path`) **debe quedar escrita en el `deletion_reason`** (bloque `=== CAPTACIÓN ===`) durante la investigación. Si no, después no hay forma de saber por qué campaña entró. Para el análisis agregado de campañas (§8) esa info se lee del `deletion_reason`, porque la fila original ya no existe.

Bloque a incluir SIEMPRE en el `deletion_reason`:

```
=== CAPTACIÓN ===
- channel: google_ads | utm_campaign: 23727564870 | landing: /auxiliar-administrativo-carm
- gclid: SÍ | fbclid: no   (→ vino de publicidad de pago de Google)
```

(Si no hay fila en `user_acquisition` o no es de pago, anótalo igual: "sin fila / channel organic / sin click-IDs".)

**Para el panorama de canales en vivo** (no solo bajas), ver el método de análisis de captación→conversión por canal (memoria `reference_analisis_captacion_canales`): agrupar `user_acquisition` por `channel`/`utm_campaign` y cruzar con `tests` (activó) y `payment_settlements` (pagó), ventana 7/15 días, separando captación nueva de re-engagement.

---

## 3. Arquitectura del flujo de eliminación

### Tablas involucradas

Tras la migración `2026-04-11-deleted-users-log-archived-data.sql`, `deleted_users_log` tiene una columna `archived_data` (JSONB) donde se preservan los datos con obligación legal de retención.

El módulo `lib/api/admin-delete-user/` implementa el flujo:

```
┌────────────────────────────────────────────────┐
│  /api/admin/delete-user (DELETE, Zod-validado) │
└────────────────────┬───────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│ lib/api/admin-delete-user/queries.ts           │
│                                                │
│ 1. archiveUserLegalData(userId)                │
│    → SELECT payment_settlements                │
│    → devuelve JSONB { archived_at, tables }    │
│                                                │
│ 2. persistArchivedData(userId, archived)       │
│    → UPDATE deleted_users_log SET archived_data│
│                                                │
│ 3. deleteUserData(userId)                      │
│    → DELETE TABLES_WITH_LEGAL_RETENTION        │
│    → DELETE TABLES_TO_CLEAN_NO_CASCADE         │
│    → DELETE TABLES_TO_CLEAN_GDPR               │
│    → DELETE user_profiles (CASCADE las demás)  │
│                                                │
│ 4. supabase.auth.admin.deleteUser              │
└────────────────────────────────────────────────┘
```

### Tres categorías de tablas

Las 59 tablas con columna `user_id` se clasifican en:

| Categoría | Qué hacer | Dónde está la lista | Por qué |
|---|---|---|---|
| **CASCADE con user_profiles.id** (11 tablas) | **Nada** — se limpian solas, EXCEPTO si tienen triggers materializadores que las repueblen (ver siguiente sección) | FK constraint en BD | `ON DELETE CASCADE` ya hace el trabajo |
| **Con obligación legal de retención** | **Archivar** + delete | `TABLES_WITH_LEGAL_RETENTION` en queries.ts | Art. 17.3.b RGPD: no se pueden borrar del todo |
| **NO CASCADE + no legal** | **DELETE explícito** | `TABLES_TO_CLEAN_NO_CASCADE` en queries.ts | Bloquearían el DELETE de user_profiles |
| **Sin FK pero con user_id** | **DELETE explícito** | `TABLES_TO_CLEAN_GDPR` en queries.ts | No bloquean, pero cumplen derecho al olvido |
| **Stats materializadas** (5 tablas + tests + test_questions) | **DELETE explícito ANTES de user_profiles, en orden** | `TABLES_TO_CLEAN_NO_CASCADE` en queries.ts | Triggers AFTER DELETE las repueblan vía UPSERT durante la cascada (ver sección «Triggers materializadores» abajo) |

### Triggers materializadores — invariante crítico

Desde la migración `20260523_materialized_stats_triggers.sql`, 15 triggers `AFTER INSERT/UPDATE/DELETE` sobre `test_questions` hacen UPSERT en estas 5 tablas:

- `user_stats_summary`
- `user_article_stats`
- `user_daily_stats`
- `user_difficulty_stats`
- `user_hourly_stats`

Todas tienen FK `CASCADE` a `user_profiles.id`. Si dependes sólo de la cascada de `user_profiles`, PG procesa las cascadas en orden no determinista. Cuando llega a `DELETE FROM test_questions`, los triggers AFTER DELETE repueblan las stats con un `user_id` que ya está siendo borrado en la misma transacción → **FK violation → ROLLBACK silencioso del DELETE entero**. La API reporta `success: true` pero `user_profiles` y `auth.users` siguen vivos.

**Defensa en dos capas** (ambas activas desde 2026-05-25):

1. **En `queries.ts`** (`TABLES_TO_CLEAN_NO_CASCADE`): `test_questions` + `tests` se borran ANTES (disparan triggers, repueblan stats una vez), luego las 5 stats tables (limpian repueblos), después `user_profiles`. Orden documentado en el comentario de `TABLES_TO_CLEAN_NO_CASCADE`.
2. **En los triggers** (`20260525_triggers_guard_user_exists.sql`): guard `IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) RETURN` antes del UPSERT. Cubre cualquier flujo futuro de DELETE de tests/test_questions que no pase por este endpoint (SQL manual, crons de cleanup, otros endpoints).

**Cuando añadas una nueva tabla materializada con trigger AFTER en `test_questions` o `tests`:**

1. Añade la tabla a `TABLES_TO_CLEAN_NO_CASCADE` en `queries.ts` (en la sección de stats).
2. Añade el guard `EXISTS user_profiles` al cuerpo de la función de trigger.
3. El test `__tests__/api/admin/delete-user.test.ts` («RGPD regression») verificará el orden — actualízalo si añades stats nuevas.

### Mantener la lista de tablas actualizada

**Cada vez que se añade una tabla con columna `user_id`, hay que decidir qué categoría es y, si no es CASCADE, añadirla a la lista correspondiente en `queries.ts`.** Query para detectar tablas nuevas:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'user_id'
ORDER BY table_name;
```

Y para detectar FKs bloqueantes (NO ACTION) que hay que añadir a `TABLES_TO_CLEAN_NO_CASCADE`:

```sql
SELECT tc.table_name, kcu.column_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'user_profiles'
  AND ccu.column_name = 'id'
  AND rc.delete_rule = 'NO ACTION'
ORDER BY tc.table_name;
```

---

## 4. Retención legal de pagos

### Base legal

El **Art. 17.3.b RGPD** establece que el derecho al olvido **no aplica** cuando el tratamiento es necesario para cumplir una obligación legal. Para los registros contables/fiscales:

- **Art. 30 Código de Comercio**: conservar libros, justificantes y documentación durante **6 años**
- **Art. 66 LGT**: la Agencia Tributaria puede comprobar operaciones durante **4 años** (+ prescripción)

### Qué hacer con payment_settlements

1. **NO borrar los importes, fechas y referencias Stripe** → son necesarios para contabilidad
2. **Archivar la fila completa en `archived_data` JSONB** → queda preservado de forma estructurada sin vincular a la tabla operacional
3. **Borrar de `payment_settlements`** → la FK a `user_profiles` deja de existir y el DELETE del perfil funciona

Tras la eliminación, los datos quedan:
- **En `deleted_users_log.archived_data`**: disponibles para auditoría fiscal durante el plazo legal
- **Sin vínculo FK**: no bloquean el DELETE ni aparecen en las queries operacionales
- **Sin identificación directa**: aunque el dump contiene email/nombre, vive sólo en la tabla de bajas, no en producción

### Si la AEPD alguna vez pregunta

- **Tienes el log**: `deletion_reason` + `archived_data` prueban qué se eliminó, cuándo, y por qué se conservó lo mínimo.
- **Justificación legal**: el `archived_data` tiene su base en Art. 17.3.b RGPD + Art. 30 CdC.
- **Minimización**: los datos archivados son sólo los estrictamente necesarios para cumplir la obligación fiscal.

---

## 5. Ejecución práctica

### Vía API (recomendado en producción)

> 🔒 **Desde 18/06/2026 el endpoint exige Bearer token de admin** (`requireAdmin`).
> Antes era invocable sin auth (no hay middleware `/api/admin/*`) — una llamada
> con solo `Content-Type` borraba la cuenta. Mintea el token como en
> `/api/v2/feedback/respond`: `supabase.auth.admin.generateLink({type:'magiclink',
> email:'manueltrader@gmail.com'})` → `verifyOtp({type:'magiclink', token_hash})`
> → `session.access_token`.

```js
const response = await fetch('https://www.vence.es/api/admin/delete-user', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`, // email en la whitelist de requireAdmin
  },
  body: JSON.stringify({ userId })
})
const result = await response.json()
```

**Antes de llamar a la API, primero hay que insertar la fila en `deleted_users_log`** con el `deletion_reason` investigado. La API asume que la fila ya existe para hacer el `UPDATE` del `archived_data`.

### Vía Node script (para desarrollo/casos puntuales)

Si el deploy de la API no está listo, puedes replicar el flujo con un script Node que use `pg` directamente. El script debe seguir el orden exacto:

```
1. Leer perfil y tests count
2. INSERT en deleted_users_log con deletion_reason completo
3. Cerrar feedback como resolved (si vino por feedback)
4. SELECT de payment_settlements (y otras tablas de retención legal)
5. UPDATE deleted_users_log SET archived_data = JSONB_del_punto_4
6. DELETE de payment_settlements (ya archivada)
7. DELETE de TABLES_TO_CLEAN_NO_CASCADE
8. DELETE de TABLES_TO_CLEAN_GDPR
9. DELETE de user_profiles
10. supabase.auth.admin.deleteUser
11. Verificar
```

### Verificación post-eliminación (OBLIGATORIO)

Tras cada eliminación confirma que todo quedó limpio:

```js
// user_profiles debe devolver 0 filas
const { data: p } = await supabase.from('user_profiles').select('id').eq('id', userId)
console.assert(p?.length === 0, '❌ user_profiles aún existe')

// auth.users debe haber desaparecido
const { data: a } = await supabase.auth.admin.getUserById(userId)
console.assert(!a?.user, '❌ auth.users aún existe')

// deleted_users_log debe tener archived_data si había retención legal
const { data: log } = await supabase.from('deleted_users_log')
  .select('archived_data, deletion_reason')
  .eq('original_user_id', userId)
  .single()
console.assert(log?.deletion_reason?.length > 500, '❌ deletion_reason demasiado corto')
```

---

## 6. Fallos comunes y su diagnóstico

### "violates foreign key constraint"

Si el DELETE falla con un mensaje del tipo:
```
Key (id)=(XXX) is still referenced from table "Y"
```

Significa que la tabla `Y` tiene una FK NO CASCADE a `user_profiles.id` y **NO está en las listas de `queries.ts`**. Añadirla:
- Si tiene obligación legal → `TABLES_WITH_LEGAL_RETENTION` + actualizar `archiveUserLegalData` si procede
- Si no → `TABLES_TO_CLEAN_NO_CASCADE`

### "column 'user_id' does not exist"

La tabla no tiene columna `user_id`. Opciones:
- No debería estar en la lista → quitar
- Usa otra columna (ej. `sender_id`) → añadir con `{ column: 'sender_id' }`

### Tests locales pasan pero producción falla

La API en producción puede estar desplegando una versión anterior. Verificar con:
```bash
curl https://www.vence.es/api/version
```
Si el hash no coincide con HEAD, esperar al deploy de Vercel.

---

## 7. Ejemplos Reales

### Ana María (07-Feb-2026) — Usuaria nueva, 6 min, UX

Usuaria nueva. Se registró, saltó onboarding, pidió eliminar cuenta en 6 minutos (doble clic). 0 tests, 0 chat, 0 pagos.

**Aprendizaje**: el botón de eliminar no tenía feedback visual → fix pendiente.

### Tania (07-Abr-2026) — 3 bugs descubiertos

Usuaria nueva, 14 min activa. Completó 25 preguntas pero 0 se guardaron.

**Bugs descubiertos**:
1. "Test recuperado - Tema 0" (nombre confuso, fix: usar nombre de ley)
2. 25 respuestas perdidas (bug `!tema` bloqueando `tema=0`)
3. Doble redirect a /test-recuperado (fix: `location.replace`)

### Cristina (10-Abr-2026) — Premium con pagos, cese natural

Usuaria premium 58 días, 61 tests en 10 días (12-21 feb), luego silencio 48 días. Ya había cancelado la subscripción. Volvió para cerrar el círculo RGPD.

**Primera investigación**: `deletion_reason` inicial era un resumen de 200 chars. Reescrito a 2763 chars con journey completo + hallazgos.

**Primera eliminación (fallida)**: la API tenía lista desactualizada de tablas. 3 tablas fallaron (`detailed_answers`, `test_questions`, `test_sessions` no tienen columna `user_id` — se limpian por CASCADE de `tests`). Luego `user_profiles` falló con FK violation de `payment_settlements` (8 filas, no estaba en la lista).

**Segunda eliminación (exitosa)**: con el código reescrito y la migración `archived_data` aplicada, se archivaron los 8 pagos (~2000€ cada uno) en `deleted_users_log.archived_data` como JSONB, se borraron 5053 filas de GDPR (incluidas 3841 de `user_interactions`), y `user_profiles` + `auth.users` quedaron a 0. El `deleted_users_log` preservó `deletion_reason` (2763 chars) + `archived_data` (8 payment_settlements completos).

**Aprendizajes del caso**:
1. El `deletion_reason` debe ser exhaustivo, no un resumen
2. La lista `TABLES_TO_CLEAN` de la API se desactualizaba con cada nueva tabla — ahora separada en 3 categorías semánticas con query SQL para detectar huecos
3. Las tablas con retención legal necesitan flujo de archivado (JSONB), no simple DELETE
4. `deleted_users_log` NO tiene FK constraint → no hay que re-insertarlo después del DELETE (como decía el manual anterior, erróneamente)

---

## 8. Análisis Periódico

Consultar `deleted_users_log` mensualmente para identificar patrones:

```sql
-- Usuarios que se fueron en menos de 1 día
SELECT deletion_reason, COUNT(*)
FROM deleted_users_log
WHERE days_active < 1
GROUP BY deletion_reason;

-- Por fuente de registro
SELECT
  requested_via,
  AVG(days_active) AS avg_days,
  AVG(total_tests) AS avg_tests,
  COUNT(*) AS total
FROM deleted_users_log
GROUP BY requested_via;

-- 🎯 Campañas mal configuradas: bajas tempranas (<2 días) agrupadas por canal/campaña.
-- La captación se lee del bloque "=== CAPTACIÓN ===" del deletion_reason (la fila de
-- user_acquisition se borró en cascada). Si un mismo channel/utm_campaign concentra
-- muchas bajas a los minutos/horas de registrarse → revisar/pausar esa campaña.
SELECT
  COALESCE(substring(deletion_reason FROM 'channel:\s*([^\s|]+)'), 'desconocido') AS channel,
  substring(deletion_reason FROM 'utm_campaign:\s*([^\s|]+)') AS utm_campaign,
  COUNT(*) AS bajas,
  AVG(days_active) AS avg_days_active
FROM deleted_users_log
WHERE days_active < 2
  AND deleted_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY bajas DESC;
-- Foco en channel IN ('google_ads','meta_ads') o gclid presente: ahí es donde se paga.
-- Complementar con el análisis en vivo de user_acquisition (memoria
-- reference_analisis_captacion_canales) para ver registros que churnean sin pedir baja.

-- Eliminaciones con datos archivados (tenían pagos)
SELECT COUNT(*)
FROM deleted_users_log
WHERE archived_data IS NOT NULL;

-- Tamaño promedio del dump archivado
SELECT
  AVG(jsonb_array_length(archived_data -> 'tables' -> 'payment_settlements')) AS avg_payments_per_user
FROM deleted_users_log
WHERE archived_data ? 'tables';
```
