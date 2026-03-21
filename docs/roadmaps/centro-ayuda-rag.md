# Centro de Ayuda + RAG para Chat IA

## Objetivo

Crear un sistema unificado donde la misma documentacion sirve para:
1. **Centro de ayuda publico** (`/ayuda/*`) — SEO + usuarios
2. **RAG para el chat IA** — busqueda semantica en los articulos de ayuda
3. **Actualizacion automatica** — al cambiar docs, se regeneran embeddings

## Problema actual

- Las respuestas sobre la plataforma estan hardcodeadas en `KnowledgeBaseService.ts`
- Cada funcionalidad nueva requiere tocar codigo
- No hay documentacion publica de la plataforma (SEO perdido)
- El chat IA no conoce funcionalidades nuevas hasta que alguien las hardcodea

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│  /ayuda (paginas publicas, SSG, indexables)      │
│  ├── /como-hacer-test                            │
│  ├── /imprimir-temario                           │
│  ├── /mis-estadisticas                           │
│  ├── /simulacros-examen                          │
│  ├── /planes-premium                             │
│  ├── /psicotecnicos                              │
│  ├── /impugnaciones                              │
│  ├── /repaso-de-fallos                           │
│  └── ...                                         │
└──────────────┬──────────────────────────────────┘
               │ Contenido de
               ▼
┌─────────────────────────────────────────────────┐
│  BD: help_articles                               │
│  ├── id, slug, title, category                   │
│  ├── content (markdown)                          │
│  ├── embedding (vector 1536d)                    │
│  ├── keywords (text[])                           │
│  ├── related_urls (text[])                       │
│  ├── updated_at                                  │
│  └── is_published (boolean)                      │
└──────────────┬──────────────────────────────────┘
               │ Busqueda semantica
               ▼
┌─────────────────────────────────────────────────┐
│  Chat IA: KnowledgeBaseDomain                    │
│  1. isPlatformQuery() detecta pregunta           │
│  2. Genera embedding del mensaje del usuario     │
│  3. Busca los 3 articulos mas similares          │
│  4. Pasa al LLM como contexto                    │
│  5. LLM responde basandose en la documentacion   │
│  6. Incluye link al articulo publico             │
└─────────────────────────────────────────────────┘
```

## Stack tecnologico

### Embeddings
- **OpenAI text-embedding-3-small** (ya lo usamos para articulos de leyes)
- 1536 dimensiones, $0.02/1M tokens
- pgvector en Supabase (ya configurado)

### Paginas publicas
- **Next.js SSG** con `generateStaticParams` desde la BD
- **MDX o markdown renderizado** para el contenido
- Schema.org `FAQPage` para SEO
- Sitemap automatico

### Dependencias necesarias
- **Ninguna nueva** — ya tenemos todo:
  - `openai` SDK para embeddings
  - pgvector en Supabase para busqueda vectorial
  - Next.js SSG para paginas estaticas
  - Drizzle para queries

### Alternativas evaluadas
| Opcion | Pros | Contras |
|--------|------|---------|
| **pgvector (recomendada)** | Ya configurado, sin coste extra, integrado con Supabase | - |
| Pinecone | UI bonita, escalable | Coste mensual, dependencia externa |
| Algolia | Busqueda rapida, typo-tolerant | No semantica, coste por query |
| Markdown files (git) | Simple, versionado | Sin busqueda semantica, rebuild en cada cambio |

## Hoja de ruta

### Fase 1: Base de datos y contenido (1-2 dias)

1. **Crear tabla `help_articles`**
   ```sql
   CREATE TABLE help_articles (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     slug TEXT UNIQUE NOT NULL,
     title TEXT NOT NULL,
     category TEXT NOT NULL, -- 'tests', 'contenido', 'cuenta', 'funcionalidades'
     content TEXT NOT NULL, -- markdown
     keywords TEXT[] DEFAULT '{}',
     related_urls TEXT[] DEFAULT '{}',
     embedding VECTOR(1536),
     is_published BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_help_articles_embedding ON help_articles
     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
   ```

2. **Crear contenido inicial** (15-20 articulos):
   - Como hacer un test (aleatorio, rapido, por ley, por articulo)
   - Simulacros de examen (modo examen real)
   - Imprimir temario (boton PDF)
   - Mis estadisticas (5 pestañas)
   - Repaso de fallos
   - Psicotecnicos
   - Planes premium y precios
   - Impugnaciones de preguntas
   - Cambiar de oposicion
   - Chat IA (que puede hacer)
   - Convocatorias del BOE
   - Leyes navegables
   - Test multi-ley
   - Meta diaria y rachas
   - Cuenta y perfil

3. **Script de generacion de embeddings**
   - Lee cada articulo de la BD
   - Genera embedding con OpenAI
   - Guarda en la columna `embedding`
   - Se ejecuta como script CLI o via API admin

### Fase 2: RAG en el chat IA (1 dia)

1. **Funcion `searchHelpArticles(query)`**
   - Genera embedding del mensaje del usuario
   - Busca los 3 articulos mas cercanos por coseno
   - Devuelve titulo, contenido y URLs

2. **Actualizar KnowledgeBaseDomain**
   - En vez de respuestas predefinidas, buscar en help_articles
   - Pasar los articulos encontrados como contexto al LLM
   - El LLM responde basandose en la documentacion real
   - Incluye links a `/ayuda/{slug}`

3. **Mantener respuestas predefinidas criticas**
   - Las de pago/suscripcion (requieren urgencia)
   - Cambiar oposicion (flujo especifico)
   - El resto migra a RAG

### Fase 3: Paginas publicas SEO (1 dia)

1. **Crear `/ayuda` layout**
   - Sidebar con categorias
   - Buscador
   - Breadcrumbs

2. **Crear `/ayuda/[slug]` pagina dinamica**
   - SSG con `generateStaticParams` desde BD
   - Renderiza markdown a HTML
   - Schema.org FAQPage
   - Links internos a la app

3. **Sitemap y SEO**
   - Añadir `/ayuda/*` al sitemap
   - Meta tags optimizados
   - Open Graph para compartir

### Fase 4: Automatizacion (medio dia)

1. **Panel admin para editar articulos**
   - CRUD en `/admin/ayuda`
   - Editor markdown con preview
   - Regenerar embedding al guardar

2. **Revalidacion automatica**
   - Al guardar un articulo, `revalidatePath('/ayuda/' + slug)`
   - Embeddings se regeneran automaticamente

3. **Metricas**
   - Tracking de que articulos se consultan mas
   - Que preguntas del chat no encuentran articulo relevante (para crear nuevos)

## Metricas de exito

- **Chat IA**: % de preguntas de plataforma respondidas correctamente sube de ~60% a ~95%
- **SEO**: Nuevas paginas indexadas en Google con keywords de oposiciones
- **Soporte**: Reduccion de feedbacks repetitivos sobre funcionalidades
- **Mantenimiento**: 0 cambios de codigo al añadir nueva funcionalidad (solo BD)

## Estimacion

| Fase | Tiempo | Dependencias |
|------|--------|-------------|
| 1. BD + contenido | 1-2 dias | Ninguna |
| 2. RAG en chat | 1 dia | Fase 1 |
| 3. Paginas publicas | 1 dia | Fase 1 |
| 4. Automatizacion | 0.5 dias | Fases 1-3 |
| **Total** | **3-4 dias** | |

## Notas

- El sistema de embeddings ya existe para articulos de leyes (`ai_chat_traces` con `searchMethod: semantic`)
- pgvector ya esta habilitado en Supabase
- El modelo `text-embedding-3-small` ya se usa en `lib/chat/shared/openai.ts`
- No hace falta ninguna dependencia nueva
