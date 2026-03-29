# Broadcast: Enviar notificaciones masivas por oposición

## Casos de uso

- Nueva oposición creada (ej: CyL) → avisar a usuarios de esa oposición
- Nuevas preguntas añadidas → avisar a usuarios del tema
- Cambio en convocatoria → avisar a afectados
- Captar usuarios de otras oposiciones que viven en la región

## Canales disponibles

| Canal | Cómo llega | Requiere |
|-------|-----------|----------|
| **Email** | Correo electrónico | El usuario no ha hecho opt-out |
| **Push** | Notificación en el navegador/móvil | El usuario aceptó notificaciones push |

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
    "channels": ["email", "push"],
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
    "channels": ["email", "push"],
    "testMode": false
  }'
```

## Parámetros

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `oposicion` | string | Uno de los dos | Slug de oposición (ej: `auxiliar-administrativo-cyl`) |
| `region` | string | Uno de los dos | Región (ej: `castilla-y-leon`, `madrid`, `andalucia`, `galicia`, `valencia`) |
| `subject` | string | Sí | Asunto del email / título del push |
| `message` | string | Sí | Cuerpo del mensaje |
| `channels` | array | Sí | `["email"]`, `["push"]`, o `["email", "push"]` |
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

### Push notifications
1. Ir a `/admin/pwa`
2. Escribir título y mensaje
3. Seleccionar audiencia (ahora soporta filtro por oposición)
4. Enviar

### Newsletter/email
1. Ir a `/admin/newsletters`
2. Seleccionar audiencia por oposición
3. Escribir mensaje
4. Enviar (soporta test mode)

## Flujo recomendado para nueva oposición

1. **Test mode primero**: enviar con `testMode: true` para verificar que llega bien
2. **Email a la oposición**: enviar a usuarios que ya tienen esa oposición seleccionada
3. **Email a la región**: enviar a usuarios que viven en la zona pero estudian otra oposición
4. **Push a la oposición**: enviar push notification a los que la tienen activada

## Notas

- Los emails respetan las preferencias del usuario (`email_preferences.unsubscribed_all`)
- Las push solo llegan a usuarios que aceptaron notificaciones en el navegador
- El filtro por región usa el campo `ciudad` del perfil (rellenado en onboarding)
- Rate limiting: 100ms entre emails para no saturar Resend
- Push se envía en batches de 50 con 100ms entre batches
- Todo queda registrado en `notification_events` y `email_events`
