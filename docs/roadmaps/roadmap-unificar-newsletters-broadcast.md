# Roadmap: Unificar sistema de newsletters y broadcast

## Problema

Las plantillas de email, el envío de newsletters y el broadcast están dispersos:

- **Plantillas** → hardcodeadas en `lib/emails/templates.ts` (24 tipos)
- **Admin newsletters** → `/admin/newsletters` (UI con audiencias, pero sin usar las plantillas de código)
- **Broadcast API** → `/api/v2/admin/broadcast` (envía por oposición/región pero con plantilla fija)
- **sendEmailV2** → `lib/api/emails/queries.ts` (motor de envío con Zod, pero acoplado a plantillas hardcodeadas)

Para enviar un email de nueva oposición hay que editar código, no se puede hacer desde el admin panel.

## Objetivo

Un sistema unificado donde:
1. Las plantillas se gestionan desde BD (CRUD desde admin)
2. El admin panel permite seleccionar plantilla → rellenar datos → previsualizar → enviar
3. La misma API sirve para enviar desde el panel o desde Claude Code
4. Todo con Drizzle + Zod + TypeScript

## Arquitectura propuesta

```
┌──────────────────────────────────────────────────┐
│  BD: email_templates                             │
│  - id, slug, name, subject_template, html_template│
│  - variables (JSON), category, is_active         │
└────────────┬─────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────┐
│  lib/api/newsletters/                            │
│  - schemas.ts (Zod: template, send request)      │
│  - queries.ts (Drizzle: CRUD templates, send)    │
│  - renderer.ts (reemplazar variables en template)│
└────────────┬──────────────┬──────────────────────┘
             │              │
    API endpoints       Admin UI
    /api/v2/admin/      /admin/newsletters
    newsletters/
    ├── templates/      ┌─────────────────────┐
    │   GET (list)      │ Pestaña: Plantillas │
    │   POST (create)   │ - Lista de templates│
    │   PUT (update)    │ - Editor con preview│
    │                   │ - Variables dinámicas│
    ├── preview/        ├─────────────────────┤
    │   POST (render)   │ Pestaña: Enviar     │
    │                   │ - Seleccionar template│
    ├── send/           │ - Rellenar variables│
    │   POST (broadcast)│ - Filtrar audiencia │
    │                   │ - Preview email     │
    └── audiences/      │ - Test mode / Enviar│
        GET (stats)     └─────────────────────┘
```

## Fases

### Fase 1: Tabla email_templates en BD

```sql
CREATE TABLE email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'broadcast',
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  preview_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Variables es un array de `{ key, label, type, default_value }`:
```json
[
  { "key": "nombreOposicion", "label": "Nombre oposición", "type": "text", "default_value": "" },
  { "key": "plazas", "label": "Plazas", "type": "text", "default_value": "" },
  { "key": "temas", "label": "Temas", "type": "text", "default_value": "" }
]
```

El `html_template` usa `{{variable}}` que se reemplazan al renderizar.

**Migrar plantillas existentes:** nueva_oposicion, mejoras_producto, lanzamiento_premium.

### Fase 2: API endpoints (Drizzle + Zod)

**Schemas** (`lib/api/newsletters/schemas.ts`):
```typescript
const TemplateSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: z.enum(['broadcast', 'transactional', 'marketing']),
  subjectTemplate: z.string(),
  htmlTemplate: z.string(),
  variables: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'url', 'list']),
    defaultValue: z.string().optional(),
  })),
})

const SendRequestSchema = z.object({
  templateSlug: z.string(),
  variables: z.record(z.unknown()),
  audience: z.object({
    oposicion: z.string().optional(),
    region: z.string().optional(),
    planType: z.enum(['all', 'free', 'premium']).optional(),
  }),
  channels: z.array(z.enum(['email', 'push'])),
  testMode: z.boolean().default(false),
})
```

**Endpoints:**
- `GET /api/v2/admin/newsletters/templates` — lista templates
- `POST /api/v2/admin/newsletters/templates` — crear template
- `PUT /api/v2/admin/newsletters/templates/[slug]` — editar template
- `POST /api/v2/admin/newsletters/preview` — renderizar preview con variables
- `POST /api/v2/admin/newsletters/send` — enviar broadcast
- `GET /api/v2/admin/newsletters/audiences` — estadísticas de audiencia por filtro

### Fase 3: Admin UI unificada

Reescribir `/admin/newsletters/page.tsx` con 3 pestañas:

1. **Plantillas** — CRUD de templates con editor HTML y preview en vivo
2. **Enviar** — Seleccionar template → rellenar variables → elegir audiencia → preview → enviar
3. **Historial** — Emails enviados con métricas (open rate, click rate)

### Fase 4: Migrar plantillas hardcodeadas a BD

- Mover las plantillas de `lib/emails/templates.ts` a la tabla `email_templates`
- `sendEmailV2` busca la plantilla en BD en vez de en el código
- `lib/emails/templates.ts` se convierte en fallback para plantillas legacy

## Uso desde Claude Code

```bash
# Listar plantillas disponibles
curl GET /api/v2/admin/newsletters/templates

# Preview
curl POST /api/v2/admin/newsletters/preview \
  -d '{"templateSlug": "nueva-oposicion", "variables": {"nombreOposicion": "Aux CyL", "plazas": "362"}}'

# Enviar
curl POST /api/v2/admin/newsletters/send \
  -d '{"templateSlug": "nueva-oposicion", "variables": {...}, "audience": {"oposicion": "auxiliar-administrativo-cyl"}, "channels": ["email"], "testMode": true}'
```

## Uso desde admin panel

1. Ir a `/admin/newsletters`
2. Pestaña "Enviar"
3. Seleccionar plantilla "Nueva oposición"
4. Rellenar: nombre, plazas, temas
5. Seleccionar audiencia: oposición CyL
6. Click "Preview" → ver email renderizado
7. Click "Enviar test" → llega a tu email
8. Click "Enviar a todos" → broadcast

## Estimación

| Fase | Esfuerzo |
|------|----------|
| 1. Tabla BD + migración | 1 hora |
| 2. API endpoints | 2 horas |
| 3. Admin UI | 3-4 horas |
| 4. Migrar templates | 1 hora |

Total: 1 sesión completa.
