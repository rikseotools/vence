# Google Ads API — gestión de publicidad

Gestión programática de campañas de Google Ads para la cuenta **Vence**
(Customer ID `914-896-7335`, conversión `AW-7929322521`).

## Arquitectura

Capa de servicio tipada y única (fuente de verdad), consumida por scripts CLI
y, en el futuro, por endpoints de `/admin`:

```
lib/services/googleAds/
  config.ts    Config validada (fail-fast) desde .env.local
  client.ts    Cliente singleton de la cuenta Vence
  errors.ts    Normalización de errores → GoogleAdsError
  reports.ts   Operaciones de LECTURA tipadas (rendimiento de campañas, …)
  mutations.ts Operaciones de ESCRITURA (pausar/activar/presupuesto) con dryRun
  index.ts     API pública — importa siempre desde '@/lib/services/googleAds'

scripts/google-ads/
  get-refresh-token.ts   Bootstrap OAuth (un solo uso)
  report.ts              CLI de lectura (rendimiento de campañas)
  campaign.ts            CLI de gestión (pause/enable/budget) — dry-run por defecto
```

Tests: `__tests__/services/googleAds.test.ts` (lógica pura: config + errores).

La observabilidad se emite en el borde (endpoints con `withErrorLogging`), no en
el servicio — así es reutilizable desde scripts sin escribir en producción.

### Gestión de campañas (escrituras)

⚠️ Gastan dinero real. Por defecto **dry-run** (Google valida con `validate_only`
sin aplicar). Para ejecutar de verdad, añade `--apply`:

```bash
npm run ads:campaign -- pause  <campaignId>            # prueba
npm run ads:campaign -- pause  <campaignId> --apply    # APLICA
npm run ads:campaign -- enable <campaignId> [--apply]
npm run ads:campaign -- budget <campaignId> <eur> [--apply]
```

## Variables de entorno (`.env.local`, ya en `.gitignore`)

```bash
GOOGLE_ADS_CLIENT_ID=         # = GOOGLE_CLIENT_ID si reutilizas el OAuth existente
GOOGLE_ADS_CLIENT_SECRET=     # = GOOGLE_CLIENT_SECRET
GOOGLE_ADS_DEVELOPER_TOKEN=   # Centro de API de la cuenta Manager (MCC)
GOOGLE_ADS_CUSTOMER_ID=9148967335          # cuenta operada (sin guiones)
GOOGLE_ADS_LOGIN_CUSTOMER_ID=              # ID de la MCC (sin guiones)
GOOGLE_ADS_REFRESH_TOKEN=     # lo genera `npm run ads:auth`
```

## Puesta en marcha (orden)

1. **Cloud Console** (proyecto del OAuth existente): habilita "Google Ads API",
   añade el scope `.../auth/adwords` a la pantalla de consentimiento y el
   redirect URI `http://localhost:3456/oauth2callback` al OAuth client.
2. **Refresh token** (no necesita developer token):
   ```bash
   npm run ads:auth
   ```
   Autoriza en el navegador y pega `GOOGLE_ADS_REFRESH_TOKEN` en `.env.local`.
3. **Cuenta Manager (MCC)** + **developer token** con Basic Access (1-3 días).
   Enlaza la cuenta `914-896-7335` a la MCC; su ID va en `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
4. **Prueba de lectura**:
   ```bash
   npm run ads:report                  # últimos 7 días
   npm run ads:report -- LAST_30_DAYS  # otro rango
   ```

## Seguridad

- Developer token y refresh token son credenciales sensibles: solo en `.env.local`,
  nunca commiteadas.
- Toda operación de escritura gastará dinero real → `--dry-run` + confirmación.
