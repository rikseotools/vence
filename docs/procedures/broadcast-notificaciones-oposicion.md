# Broadcast: Enviar emails masivos por oposición

## Casos de uso

- Nueva oposición creada (ej: CyL) → avisar a usuarios de esa oposición
- Nuevas preguntas añadidas → avisar a usuarios del tema
- Cambio en convocatoria → avisar a afectados
- Captar usuarios de otras oposiciones que viven en la región

## Canal disponible

| Canal | Cómo llega | Requiere |
|-------|-----------|----------|
| **Email** | Correo electrónico | El usuario no ha hecho opt-out |

> **Nota 2026-05-03**: el sistema de push notifications fue eliminado.
> El broadcast solo soporta email. El parámetro `channels` se mantiene
> en el schema por compatibilidad histórica, pero solo acepta `["email"]`.

## Opción 1: API endpoint (desde Claude Code)

### Enviar por oposición

```bash
curl -X POST 'https://www.vence.es/api/v2/admin/broadcast' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN_ADMIN' \
  -d '{
    "oposicion": "auxiliar-administrativo-cyl",
    "subject": "Ya disponible: Auxiliar Administrativo CyL",
    "message": "Hemos creado la oposición de Auxiliar Administrativo de Castilla y León con 27 temas y casi 3000 preguntas. Ya puedes empezar a practicar.",
    "channels": ["email"],
    "testMode": true
  }'
```

### Enviar por región (captar usuarios que viven en CyL pero estudian otra oposición)

```bash
curl -X POST 'https://www.vence.es/api/v2/admin/broadcast' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN_ADMIN' \
  -d '{
    "region": "castilla-y-leon",
    "subject": "Nueva oposición disponible en tu comunidad",
    "message": "Hemos añadido la oposición de Auxiliar Administrativo de Castilla y León. Si te interesa, ya puedes empezar a practicar.",
    "channels": ["email"],
    "testMode": true
  }'
```

### Enviar a ambos (oposición + residentes en la región)

```bash
curl -X POST 'https://www.vence.es/api/v2/admin/broadcast' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN_ADMIN' \
  -d '{
    "oposicion": "auxiliar-administrativo-cyl",
    "region": "castilla-y-leon",
    "subject": "Auxiliar Administrativo CyL - Ya disponible",
    "message": "...",
    "channels": ["email"],
    "testMode": false
  }'
```

## Parámetros

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `oposicion` | string | Uno de los dos | Slug de oposición (ej: `auxiliar-administrativo-cyl`) |
| `region` | string | Uno de los dos | Región (ej: `castilla-y-leon`, `madrid`, `andalucia`, `galicia`, `valencia`) |
| `subject` | string | Sí | Asunto del email |
| `message` | string | Sí | Cuerpo del mensaje |
| `channels` | array | Sí | Solo `["email"]` (push eliminado 2026-05-03) |
| `testMode` | boolean | No | `true` = solo envía a los 3 primeros usuarios |

## Regiones disponibles

| Región | Ciudades incluidas |
|--------|-------------------|
| `castilla-y-leon` | Valladolid, León, Burgos, Salamanca, Zamora, Palencia, Ávila, Segovia, Soria |
| `madrid` | Madrid, Alcalá, Getafe, Leganés, Móstoles, Fuenlabrada, Torrejón... |
| `andalucia` | Sevilla, Málaga, Córdoba, Granada, Almería, Huelva, Cádiz, Jaén |
| `valencia` | Valencia, Alicante, Castellón, Elche, Torrent, Gandía |
| `galicia` | Coruña, Vigo, Ourense, Pontevedra, Lugo, Santiago, Ferrol |

## Opción 2: Panel de admin (UI)

### Newsletter/email
1. Ir a `/admin/newsletters`
2. Seleccionar audiencia por oposición
3. Escribir mensaje
4. Enviar (soporta test mode)

## Flujo recomendado para nueva oposición

1. **Test mode primero**: enviar con `testMode: true` para verificar que llega bien
2. **Email a la oposición**: enviar a usuarios que ya tienen esa oposición seleccionada
3. **Email a la región**: enviar a usuarios que viven en la zona pero estudian otra oposición

## Notas

- Los emails respetan las preferencias del usuario (`email_preferences.unsubscribed_all`)
- El filtro por región usa el campo `ciudad` del perfil (rellenado en onboarding)
- Rate limiting: 100ms entre emails para no saturar Resend
- Todo queda registrado en `email_events` (la tabla `notification_events` antigua se eliminará en próxima limpieza BD)
