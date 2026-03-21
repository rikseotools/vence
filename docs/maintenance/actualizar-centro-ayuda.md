# Actualizar Centro de Ayuda (help_articles)

## Cuándo actualizar

- Cuando el panel admin (`/admin/ayuda`) muestra artículos con estado "Deploy" (cambios detectados automáticamente)
- Cuando el usuario lo pide explícitamente
- Cuando se añade una funcionalidad nueva a la plataforma

## Tabla: help_articles

| Campo | Descripción |
|-------|-------------|
| `slug` | Identificador único, usado en URL `/ayuda/{slug}` |
| `title` | Título del artículo |
| `category` | `tests`, `contenido`, `funcionalidades`, `cuenta` |
| `content` | Contenido en texto plano (sin markdown complejo) |
| `keywords` | Array de palabras clave para búsqueda |
| `related_urls` | URLs de la app relacionadas (ej: `/test/aleatorio`) |
| `related_paths` | Globs de archivos del código (ej: `app/test/**`) |
| `embedding` | Vector 1536d para búsqueda semántica (RAG) |
| `needs_review` | `true` si un deploy cambió archivos relacionados |
| `review_reason` | Descripción de qué cambió |
| `is_published` | Si se muestra en `/ayuda` y en el chat IA |

## Proceso completo para actualizar un artículo

### 1. Actualizar contenido en la BD

```javascript
const { Pool } = require('/home/manuel/Documentos/github/vence/node_modules/pg');
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`
  UPDATE help_articles SET
    content = $1,
    keywords = $2,
    related_urls = $3,
    related_paths = $4,
    needs_review = false,
    review_reason = NULL,
    updated_at = NOW()
  WHERE slug = $5
`, [nuevoContenido, nuevosKeywords, nuevasUrls, nuevosPaths, 'slug-del-articulo']);

await pool.end();
```

### 2. Regenerar embedding

Después de actualizar el contenido, hay que regenerar el embedding para que el RAG del chat IA encuentre el artículo con las nuevas palabras:

```javascript
const { Pool } = require('/home/manuel/Documentos/github/vence/node_modules/pg');
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Obtener API key de OpenAI
const { rows } = await pool.query("SELECT api_key_encrypted FROM ai_api_config WHERE provider = 'openai' AND is_active = true LIMIT 1");
const apiKey = Buffer.from(rows[0].api_key_encrypted, 'base64').toString('utf-8');

const OpenAI = require('/home/manuel/Documentos/github/vence/node_modules/openai').default;
const openai = new OpenAI({ apiKey });

// Obtener artículo actualizado
const { rows: articles } = await pool.query('SELECT id, slug, title, content, keywords FROM help_articles WHERE slug = $1', ['slug-del-articulo']);
const art = articles[0];

// Generar embedding
const text = art.title + ' ' + (art.keywords || []).join(' ') + ' ' + art.content;
const response = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
const embedding = '[' + response.data[0].embedding.join(',') + ']';

// Guardar
await pool.query('UPDATE help_articles SET embedding = $1 WHERE id = $2', [embedding, art.id]);

await pool.end();
```

### 3. Revalidar página pública

Después de actualizar, revalidar la página para que se regenere:

```bash
curl "https://www.vence.es/api/revalidate?secret=vence-revalidate-2024&path=/ayuda/slug-del-articulo"
curl "https://www.vence.es/api/revalidate?secret=vence-revalidate-2024&path=/ayuda"
```

O en local:
```bash
curl "http://localhost:3000/api/revalidate?secret=vence-revalidate-2024&path=/ayuda/slug-del-articulo"
```

## Crear un artículo nuevo

### 1. Insertar en la BD

```javascript
await pool.query(`
  INSERT INTO help_articles (slug, title, category, content, keywords, related_urls, related_paths)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
`, [slug, titulo, categoria, contenido, keywords, urls, paths]);
```

### 2. Generar embedding

Mismo proceso que en "Regenerar embedding" arriba.

### 3. Revalidar

```bash
curl "https://www.vence.es/api/revalidate?secret=vence-revalidate-2024&path=/ayuda"
```

## Eliminar un artículo

```javascript
await pool.query('UPDATE help_articles SET is_published = false WHERE slug = $1', ['slug-del-articulo']);
```

No borrar de la BD, solo despublicar. Así se mantiene el historial.

## Marcar artículos como revisados (después de un deploy)

```javascript
// Marcar todos los que tenían needs_review
await pool.query('UPDATE help_articles SET needs_review = false, review_reason = NULL WHERE needs_review = true');
```

## Cómo funciona el sistema

### Detección automática (en cada deploy de Vercel)

1. `scripts/check-help-articles.mjs` se ejecuta durante `npm run build`
2. Compara `git diff` entre el SHA anterior y el actual
3. Para cada artículo, verifica si algún archivo cambiado matchea sus `related_paths`
4. Si hay match, marca `needs_review = true` con la razón

### RAG en el chat IA

1. Usuario pregunta sobre la plataforma (detectado por `isPlatformQuery`)
2. Se genera embedding del mensaje del usuario
3. Se busca en `help_articles` por similitud semántica (`match_help_articles` RPC)
4. Los artículos más relevantes se pasan al LLM como contexto
5. El LLM responde basándose en la documentación real

### Páginas públicas SEO

- `/ayuda` — listado de todos los artículos por categoría
- `/ayuda/{slug}` — artículo individual con Schema.org
- SSG con revalidate 1h
- Schema.org FAQPage para SEO

## Categorías disponibles

| Categoría | Descripción |
|-----------|-------------|
| `tests` | Tests, simulacros, repaso de fallos |
| `contenido` | Temario, leyes, convocatorias |
| `funcionalidades` | Chat IA, estadísticas, meta diaria, impugnaciones |
| `cuenta` | Perfil, premium, suscripción |

## Artículos actuales (15)

| Slug | Categoría |
|------|-----------|
| como-hacer-test | tests |
| simulacros-examen | tests |
| repaso-fallos | tests |
| psicotecnicos | tests |
| imprimir-temario | contenido |
| temario | contenido |
| convocatorias | contenido |
| mis-estadisticas | funcionalidades |
| guardar-resultados | funcionalidades |
| chat-ia | funcionalidades |
| impugnaciones | funcionalidades |
| meta-diaria | funcionalidades |
| planes-premium | cuenta |
| cambiar-oposicion | cuenta |
| cuenta-perfil | cuenta |
