# PROJECT_CONTEXT.md

## Configuración de Desarrollo

### MCP de Supabase
El proyecto tiene configurado el **Model Context Protocol (MCP) de Supabase** para interactuar directamente con la base de datos desde Claude Desktop.

#### Estado: ✅ CONFIGURADO
- **Servidor MCP:** `@modelcontextprotocol/server-supabase`
- **URL:** `https://yqbpstxowvgipqspqrgo.supabase.co`
- **Configuración:** Ya existe en `~/.claude_cuenta1/.claude.json`

#### Herramientas MCP Disponibles
- `mcp_supabase_select` - Consultas SELECT
- `mcp_supabase_insert` - Insertar datos
- `mcp_supabase_update` - Actualizar datos
- `mcp_supabase_delete` - Eliminar datos

#### Script de Configuración
Si necesitas reconfigurar el MCP:
```bash
node scripts/setup-supabase-mcp.js
```

#### Uso
Las herramientas MCP están disponibles directamente en Claude Desktop sin necesidad de configuración adicional.

## Base de Datos
- **Proveedor:** Supabase
- **Documentación:** Ver `README-todas-tablas.md` para estructura completa
- **Variables de entorno:** Configuradas en `.env.local`

## Documentación del Proyecto

### READMEs Disponibles
- **`README.md`** - Documentación principal del proyecto
- **`README-todas-tablas.md`** - ⭐ Estructura completa de base de datos
- **`README-sistema-notificaciones.md`** - Sistema de notificaciones push
- **`README-push-notifications.md`** - Configuración de push notifications
- **`README-newsletter.md`** - Sistema de newsletter y emails
- **`README-google-ads.md`** - Integración con Google Ads
- **`README-psicotecnico.md`** - Tests psicotécnicos
- **`README-impugnaciones-usuarios.md`** - Sistema de impugnaciones
- **`README-TEST-VALIDATION.md`** - Validación de tests
- **`README-curar-preguntas.md`** - Proceso de curación de preguntas
- **`README-reparar-preguntas.md`** - Reparación de preguntas
- **`README-revision-preguntas-problematicas.md`** - Revisión de problemas
- **`READMEreparar-huerfanas.md`** - Reparar preguntas huérfanas
- **`READMEagregar-tema.md`** - Agregar nuevos temas
- **`README-actualizar.md`** - Proceso de actualización
- **`README-pte actualizar-nueva-ley.md`** - Actualización de leyes

### Archivos de Instrucciones
- **`CLAUDE.md`** - ⭐ Instrucciones principales para Claude (ya incluido en contexto)

## Comandos de Desarrollo
```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run lint     # Linter
npm run typecheck # Verificación de tipos
git push origin main # Siempre usar origin main
```