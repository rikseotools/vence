# Runbook: Revisar señales de fraude

**Cuándo consultarlo (CUALQUIERA de estas frases → este runbook):** el usuario dice *"revisa las señales de fraude"*, *"revisa los fraudes"*, *"revisa el fraude"*, *"señales de fraude"*, o toca el **badge 🚨 de la pestaña "Fraudes"** del admin. Seguir este runbook ANTES de improvisar.

Sistema **Claude-en-el-bucle**: el sweep detecta y alerta (badge); **el humano dispara y Claude revisa cada señal, la verifica contra los datos y la marca revisada** (`dismissed` = falso positivo, `confirmed` = fraude real). NO es un cron autónomo que bloquee: el enforcement (bloqueo/límite) es fase aparte y siempre con aprobación de Manuel.

## Qué es cada pieza
- **Detección:** `scripts/fraud-sweep.cjs` (cron GHA diario `fraud-sweep.yml`) escribe SEÑALES en `fraud_alerts` (`status='new'`) con dedup por `match_criteria = kind:subject`.
- **Badge:** `/api/v2/admin/fraud/pending-count` cuenta `fraud_alerts status='new'` → badge 🚨 en `app/admin/layout.tsx` (rojo si hay `critical`, naranja si no).
- **Panel:** `/admin/fraudes` (pestaña "Señales") lista las pendientes; también `/api/v2/admin/fraud/signals?status=new`.
- **Revisar:** `POST /api/v2/admin/fraud/signals/review` `{id, action: reviewed|dismissed|confirmed, notes}` → sale del badge.

## Los `kind` de señal (qué mira cada uno)
| kind | Qué detecta | Falso positivo típico |
|---|---|---|
| `multi_account_device` | ≥N cuentas distintas en un mismo dispositivo | familia/academia que comparte equipo (pocas cuentas, uso normal) |
| `multi_account_reg_ip` | ≥N cuentas registradas desde una misma IP | red compartida (universidad, oficina, CGNAT operador) |
| `device_daily_farming` | un dispositivo suma > umbral preguntas/día across cuentas | poco frecuente; casi siempre farmeo real del límite free |
| `curl_scraping` | uso de API sin dispositivo Y sin navegador (page_views ~0) | humano cuyo fingerprint no se registró (pero ESE sí tiene page_views → no salta) |
| `premium_sharing` | dispositivo compartido que incluye premium + ≥2 cuentas activas | pareja/familia con una premium legítima |
| `bot_detected` / `suspicious_behavior` | (heredado) respuestas muy rápidas | usuario rápido real |

## Procedimiento de revisión (Claude en el bucle)
1. **Vuelca las pendientes** (RDS, `pg`/`DATABASE_URL`, NUNCA supabase-js):
   ```sql
   SELECT id, alert_type, severity, user_ids, details, detected_at
   FROM fraud_alerts WHERE status='new'
   ORDER BY (severity='critical') DESC, detected_at DESC;
   ```
2. **Verifica cada señal contra los datos** (no te fíes del título):
   - Multicuenta: ¿altas el mismo día en el mismo device? (`user_profiles.created_at`) ¿emails casi idénticos? → farmeo. ¿Uso repartido y espaciado, emails dispares? → posible familia/academia.
   - Farmeo: mira `daily_question_usage` sumado por device/día.
   - `curl_scraping`: confirma **0/pocos** `page_view` en `user_interactions` (si tiene page_views es humano → `dismissed`).
   - IP compartida: ¿es una IP residencial con N cuentas (granja) o una IP de operador/CGNAT/campus? (heurística: nº de cuentas + patrón de nombres).
   - Premium sharing: ¿la premium se usa desde N cuentas free en el mismo device? → sharing.
3. **Adjudica** con `POST /api/v2/admin/fraud/signals/review`:
   - `dismissed` = uso legítimo (falso positivo). Anota el motivo en `notes`.
   - `confirmed` = fraude real. Anota evidencia. **NO bloquees aún**: el bloqueo lo decide Manuel (enforcement fase 1/2).
   - `reviewed` = vista, sin veredicto duro (p.ej. dudosa, a vigilar).
4. **Resume a Manuel** los `confirmed` y propón acción (bloqueo/límite) para su OK. El auto-bloqueo NO está activo en F0.

## Umbrales (env del sweep, calibrables)
`FRAUD_DEVICE_ACCOUNTS` (3), `FRAUD_IP_ACCOUNTS` (5), `FRAUD_DEVICE_DAILY_Q` (60), `FRAUD_SCRAPE_MIN_Q` (30), `FRAUD_SCRAPE_MAX_PV` (5), `FRAUD_WINDOW_DAYS` (30). Subirlos = menos ruido; bajarlos = más sensibilidad. Ajustar con datos reales (fase F3).

## Gaps conocidos / roadmap (enforcement, aún NO activo)
F0 (esto) = **solo detección + revisión**. Pendiente en `docs/roadmap/`:
- **F1:** límite diario por `device_id`+IP además de por cuenta (mata el farmeo).
- **F2:** require-device anti-curl + cap de altas free por device/IP + bloqueo de `confirmed`.
- El límite free hoy es **25/día POR CUENTA** (`lib/api/daily-limit/config.ts`) → N cuentas = N×25. Ese es el hueco que F1 cierra.
