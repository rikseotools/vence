# Monitor de Artículos de Ayuda (Panel Admin)

## Objetivo

Pestaña en el panel admin que avise cuando hay artículos de ayuda desactualizados o faltan artículos para funcionalidades nuevas.

## Funcionalidades

### 1. Detección de rutas sin artículo
- Comparar las rutas públicas de la app con los `related_urls` de `help_articles`
- Si hay rutas nuevas sin artículo → aviso

### 2. Artículos con URLs rotas
- Verificar que las URLs en `related_urls` de cada artículo existen en la app
- Si una URL ya no existe → aviso

### 3. Artículos antiguos
- Si un artículo no se ha actualizado en más de 30 días → aviso de revisión

### 4. Métricas de uso
- Qué artículos se consultan más desde el chat IA (tracking en `ai_chat_logs`)
- Qué preguntas de usuarios no encuentran artículo relevante (similarity < threshold)

## Implementación

- Pestaña "Ayuda" en `/admin`
- API: `/api/v2/admin/help-articles-status`
- Queries sobre `help_articles` + comparación con rutas de la app
- Badge en el menú admin si hay avisos pendientes

## Estado

Pendiente — las 3 fases principales (BD + RAG + SEO) están completadas.
