const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// 🔧 CONFIGURACIÓN SUPABASE
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔧 CONFIGURACIÓN APIs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ NUEVA CONFIGURACIÓN CLAUDE
const claude = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
  defaultHeaders: {
    'anthropic-version': '2023-06-01'
  }
});

// ✅ CONFIGURACIÓN CRÍTICA
const CONFIG_CRITICA = {
  // 🚀 ACTIVAR NUEVA VERSIÓN DE AUDITORÍA
  NUEVA_AUDITORIA_ACTIVADA: true,
  
  // 📊 PARÁMETROS DE AUDITORÍA
  LIMITE_PREGUNTAS_AUDITORIA: 5000,
  FILTRO_INCLUIR_EXAMENES_OFICIALES: true,
  EXCLUIR_PREGUNTAS_GENERADAS_IA: true,
  
  // 🎯 CONFIGURACIÓN DE ANÁLISIS
  USAR_CLAUDE_PARA_ANALISIS: true,
  USAR_GEMINI_COMO_BACKUP: true,
  
  // 📝 CONFIGURACIÓN DE REPORTES
  GENERAR_REPORTE_DETALLADO: true,
  EXPORTAR_RESULTADOS_JSON: true,
  
  // ⚡ CONFIGURACIÓN DE PERFORMANCE
  BATCH_SIZE_ANALISIS: 100,
  DELAY_ENTRE_BATCHES_MS: 1000,
  
  // 🎨 CONFIGURACIÓN DE PRESENTACIÓN
  INCLUIR_GRAFICOS_ANALISIS: true,
  FORMATO_SALIDA: 'markdown', // 'markdown' | 'html' | 'json'
};

console.log('🚀 INICIANDO AUDITORÍA DE TOPIC SCOPE v2.0');
console.log('📊 Configuración:', JSON.stringify(CONFIG_CRITICA, null, 2));

module.exports = {
  CONFIG_CRITICA,
  supabase,
  claude,
  genAI
};