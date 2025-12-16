# Consultas a la Base de Datos Supabase desde Claude Code

## ✅ Estado Actual: MCP Oficial Compatible con Supabase (Diciembre 2025)

**ACTUALIZACIÓN IMPORTANTE**: A diferencia del estado en noviembre 2024, ahora **SÍ existe un servidor MCP oficial de Supabase** que funciona con Claude Code CLI.

**Última actualización**: 13 de diciembre de 2025
**Proyecto**: Vence
**Database**: Supabase PostgreSQL (yqbpstxowvgipqspqrgo)
**Métodos disponibles**:
1. ✅ **MCP oficial de Supabase** (recomendado)
2. ✅ **Node.js + @supabase/supabase-js** (alternativa)

---

## 🎯 Método 1: MCP Oficial de Supabase (RECOMENDADO)

### ¿Qué cambió desde noviembre 2024?

**Antes (noviembre 2024)**:
- ❌ Servidores MCP locales no funcionaban con Supabase
- ❌ Problemas con poolers regionales
- ❌ Bugs en librerías base de MCP

**Ahora (diciembre 2025)**:
- ✅ Servidor MCP oficial cloud-hosted de Supabase
- ✅ Autenticación OAuth dinámica
- ✅ Compatible con Claude Code CLI
- ✅ No requiere tokens manuales
- ✅ Actualizado hace 18 horas (al momento de esta documentación)

### Configuración

#### Estado Actual
Ya está configurado en este proyecto. La configuración se agregó a `~/.claude_cuenta1/.claude.json`:

```json
{
  "projects": {
    "/Users/manuel/Documents/github/vence": {
      "mcpServers": {
        "supabase": {
          "type": "http",
          "url": "https://mcp.supabase.com/mcp"
        }
      }
    }
  }
}
```

#### Reconfigurar (si es necesario)

Si necesitas reconfigurar el MCP:

```bash
node scripts/setup-supabase-mcp.cjs
```

### Herramientas MCP Disponibles

Una vez autenticado con Supabase, tendrás acceso a:

| Herramienta | Descripción |
|------------|-------------|
| `mcp_supabase_select` | Consultas SELECT a cualquier tabla |
| `mcp_supabase_insert` | Insertar registros |
| `mcp_supabase_update` | Actualizar registros |
| `mcp_supabase_delete` | Eliminar registros |
| `mcp_supabase_list_tables` | Listar todas las tablas |
| `mcp_supabase_describe_table` | Ver estructura de una tabla |

### Autenticación

**Primera vez**:
1. Al usar una herramienta MCP, Claude Code abrirá tu navegador
2. Inicia sesión con tu cuenta de Supabase
3. Autoriza el acceso al proyecto
4. Las herramientas funcionarán automáticamente después

**Siguientes usos**:
- No se requiere autenticación nuevamente
- Las herramientas estarán listas para usar

### Ventajas del MCP Oficial

- ✅ **Interfaz nativa**: Herramientas integradas en Claude Code
- ✅ **Sin configuración compleja**: Solo autenticación OAuth
- ✅ **Seguro**: No expone credenciales de base de datos
- ✅ **Actualizado**: Mantenido oficialmente por Supabase
- ✅ **Respeta RLS**: Policies de seguridad aplicadas automáticamente

---

## 🔧 Método 2: Node.js + Supabase (ALTERNATIVA)

Este método sigue funcionando y es útil como alternativa o para casos específicos.

### Consultas Básicas

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Listar primeras 5 preguntas
  const { data, error } = await supabase
    .from('questions')
    .select('id, text, difficulty')
    .limit(5);

  if (error) console.error('❌ Error:', error);
  else console.log('✅ Preguntas:', data);
})();
"
```

### Consultas Complejas

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Contar preguntas por dificultad
  const { data } = await supabase
    .from('questions')
    .select('difficulty, is_active')
    .eq('is_active', true);

  const counts = {};
  data?.forEach(q => {
    counts[q.difficulty] = (counts[q.difficulty] || 0) + 1;
  });

  console.log('📊 Preguntas por dificultad:');
  Object.entries(counts).forEach(([diff, count]) => {
    console.log('  -', diff + ':', count);
  });
})();
"
```

### Ejemplos Prácticos

#### Ver estructura de una tabla
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data } = await supabase.from('questions').select('*').limit(1);
  if (data?.[0]) {
    console.log('📋 Columnas de questions:');
    Object.keys(data[0]).forEach(col => console.log('  -', col));
  }
})();
"
```

#### Buscar registros específicos
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data } = await supabase
    .from('questions')
    .select('id, text')
    .eq('difficulty', 'hard')
    .limit(10);

  console.log('📋 Preguntas difíciles:', data);
})();
"
```

### Ventajas del Método Node.js

- ✅ **100% confiable** (usa las mismas credenciales que la app)
- ✅ **No requiere contraseña de Postgres** (usa ANON_KEY)
- ✅ **Respeta RLS policies** automáticamente
- ✅ **Variables de entorno** ya configuradas (`.env.local`)
- ✅ **Sintaxis familiar** (misma que en la app)
- ✅ **Funciona sin autenticación adicional**

---

## 📊 Comparación de Métodos

| Característica | MCP Oficial | Node.js + Supabase |
|----------------|-------------|-------------------|
| **Facilidad de uso** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Configuración inicial** | ⭐⭐⭐⭐⭐ (OAuth simple) | ⭐⭐⭐⭐⭐ (ya configurado) |
| **Integración con Claude** | ⭐⭐⭐⭐⭐ (nativo) | ⭐⭐⭐ (vía Bash) |
| **Fiabilidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Seguridad** | ⭐⭐⭐⭐⭐ (OAuth) | ⭐⭐⭐⭐⭐ (ANON_KEY) |
| **Flexibilidad** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Velocidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🚀 Recomendación

### Usa MCP Oficial cuando:
- ✅ Necesites herramientas integradas en Claude Code
- ✅ Prefieras interfaz nativa sin escribir código
- ✅ Quieras aprovechar todas las funcionalidades MCP

### Usa Node.js cuando:
- ✅ Necesites consultas muy complejas o personalizadas
- ✅ Quieras procesar datos antes de mostrarlos
- ✅ Las herramientas MCP no estén disponibles temporalmente
- ✅ Prefieras tener control total sobre las queries

---

## 📚 Recursos Adicionales

### Documentación Oficial
- [Supabase MCP Server](https://supabase.com/docs/guides/getting-started/mcp)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [GitHub: supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp)

### Documentación del Proyecto
- `PROJECT_CONTEXT.md` - Configuración general del proyecto
- `docs/database/tablas.md` - Estructura detallada de la base de datos
- `CLAUDE.md` - Instrucciones principales para Claude

---

## ⚠️ Notas Importantes

### Para Claude Code (Nota interna)

**Si en el futuro te preguntan "¿MCP funciona con Supabase?":**

1. **Respuesta corta**: SÍ (actualizado diciembre 2025). Usa el servidor oficial cloud-hosted.

2. **Configuración**:
   - Ya está configurado en este proyecto
   - Script de reconfiguración: `node scripts/setup-supabase-mcp.cjs`
   - Autenticación OAuth automática la primera vez

3. **Herramientas disponibles**:
   - `mcp_supabase_select`
   - `mcp_supabase_insert`
   - `mcp_supabase_update`
   - `mcp_supabase_delete`
   - `mcp_supabase_list_tables`
   - `mcp_supabase_describe_table`

4. **Alternativa**:
   - Si MCP no está disponible, usar método Node.js + @supabase/supabase-js

5. **NO reintentar configurar servidores MCP locales** como:
   - ❌ `@modelcontextprotocol/server-postgres` (local)
   - ❌ `@henkey/postgres-mcp-server`
   - Estos NO funcionan con Supabase debido a bugs con poolers

6. **Servidor correcto**:
   - ✅ `https://mcp.supabase.com/mcp` (cloud-hosted oficial)

---

## 📝 Historial de Cambios

### Diciembre 2025
- ✅ Servidor MCP oficial de Supabase disponible
- ✅ Configurado en el proyecto Vence
- ✅ Documentación actualizada

### Noviembre 2024 (Referencia histórica)
- ❌ Servidores MCP locales no funcionaban con Supabase
- ✅ Método Node.js era la única opción confiable
- 📋 Investigación exhaustiva documentada en otros proyectos

---

**Próxima revisión recomendada**: Marzo 2026 (verificar actualizaciones del servidor MCP oficial)
