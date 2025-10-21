// scripts/setup-supabase-mcp.js - Configurar MCP de Supabase en Claude Desktop
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function expanduser(filepath) {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2))
  }
  return filepath
}

const CONFIG_PATH = expanduser('~/.claude_cuenta1/.claude.json')

async function setupSupabaseMCP() {
  try {
    console.log('🔧 Configurando MCP de Supabase...')
    console.log(`📁 Archivo de configuración: ${CONFIG_PATH}`)
    
    // Leer configuración actual
    const configPath = CONFIG_PATH
    let config = {}
    
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8')
      config = JSON.parse(configContent)
      console.log('✅ Configuración actual cargada')
    } else {
      console.log('⚠️ No existe configuración, creando nueva...')
    }
    
    // Verificar si ya existe configuración MCP
    if (!config.mcpServers) {
      config.mcpServers = {}
    }
    
    // Agregar/actualizar configuración de Supabase
    config.mcpServers.supabase = {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-supabase"
      ],
      "env": {
        "SUPABASE_URL": "https://yqbpstxowvgipqspqrgo.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NzY3MDMsImV4cCI6MjA2NjQ1MjcwM30.XOB0HLZ1R8m2W4vPk_f-S2N1oVnWUJ9QQcgHRuJ-qqE"
      }
    }
    
    // Guardar configuración actualizada
    const updatedConfig = JSON.stringify(config, null, 2)
    fs.writeFileSync(configPath, updatedConfig, 'utf8')
    
    console.log('✅ Configuración de MCP Supabase agregada exitosamente')
    console.log('')
    console.log('🔄 IMPORTANTE: Reinicia Claude Desktop para aplicar los cambios')
    console.log('   - Cierra completamente Claude Desktop')
    console.log('   - Vuelve a abrir con: claude1')
    console.log('')
    console.log('🛠️ Herramientas MCP que estarán disponibles:')
    console.log('   - mcp_supabase_select: Para consultas SELECT')
    console.log('   - mcp_supabase_insert: Para insertar datos')
    console.log('   - mcp_supabase_update: Para actualizar datos')
    console.log('   - mcp_supabase_delete: Para eliminar datos')
    console.log('')
    console.log('📝 Una vez reiniciado, podrás ejecutar:')
    console.log('   ALTER TABLE feedback_conversations ADD COLUMN admin_viewed_at timestamp with time zone;')
    console.log('')
    
  } catch (error) {
    console.error('❌ Error configurando MCP:', error)
    process.exit(1)
  }
}

setupSupabaseMCP()