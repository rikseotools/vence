// trebep-formatter.js - Reformatear títulos y contenido completo usando GPT-4o-mini
// Requiere: OPENAI_API_KEY en .env
require("dotenv").config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Añadir a tu .env

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const TREBEP_LAW_ID = 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0';

class TREBEPFormatter {
  constructor() {
    this.processed = 0;
    this.errors = [];
    this.logs = [];
    this.updated = 0;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.logs.push(logMessage);
  }

  error(message, err = null) {
    const timestamp = new Date().toISOString();
    let errorMessage = `[ERROR ${timestamp}] ${message}`;
    if (err) errorMessage += ` - ${err.message}`;
    
    console.error(errorMessage);
    this.errors.push(errorMessage);
  }

  // Formatear título y contenido usando GPT-4o-mini
  async formatArticleWithGPT(articleNumber, currentTitle, content) {
    try {
      const prompt = `
TAREA: Formatear completamente este artículo del TREBEP (Real Decreto Legislativo 5/2015) con título oficial y contenido legible.

ARTÍCULO: ${articleNumber}
TÍTULO ACTUAL: ${currentTitle}
CONTENIDO ACTUAL:
${content}

INSTRUCCIONES:
1. TÍTULO: Extrae el título oficial exacto del BOE (sin "Artículo X.")
2. CONTENIDO: Reformatea con estructura legible usando:
   - Saltos de línea apropiados entre apartados
   - Apartados numerados: "1. ", "2. ", etc.
   - Subapartados con letras: "a) ", "b) ", etc.
   - Párrafos separados con líneas en blanco
   - Estructura jerárquica clara

FORMATO DE RESPUESTA:
TÍTULO: [título oficial exacto]
CONTENIDO:
[contenido reformateado con saltos de línea]

EJEMPLO:
TÍTULO: Funcionarios de carrera
CONTENIDO:
1. Son funcionarios de carrera quienes, en virtud de nombramiento legal, están vinculados a una Administración Pública por una relación estatutaria regulada por el Derecho Administrativo para el desempeño de servicios profesionales retribuidos de carácter permanente.

2. En todo caso, el ejercicio de las funciones que impliquen la participación directa o indirecta en el ejercicio de las potestades públicas o en la salvaguardia de los intereses generales del Estado y de las Administraciones Públicas corresponden exclusivamente a los funcionarios públicos.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.1
      });

      const result = response.choices[0].message.content.trim();
      
      // Extraer título y contenido de la respuesta
      const titleMatch = result.match(/TÍTULO:\s*(.+)/);
      const contentMatch = result.match(/CONTENIDO:\s*([\s\S]+)/);

      if (titleMatch && contentMatch) {
        const newTitle = titleMatch[1].trim().replace(/["""]/g, '');
        const newContent = contentMatch[1].trim();
        
        this.log(`🤖 GPT formateó Art. ${articleNumber}:`);
        this.log(`   Título: "${newTitle}"`);
        this.log(`   Contenido: ${newContent.length} caracteres`);
        
        return { title: newTitle, content: newContent };
      } else {
        this.error(`GPT response format error para Art. ${articleNumber}`);
        return null;
      }

    } catch (error) {
      this.error(`Error formateando con GPT Art. ${articleNumber}`, error);
      return null;
    }
  }

  // Verificar si un título necesita corrección
  needsCorrection(articleNumber, currentTitle) {
    // PROCESAR TODOS LOS ARTÍCULOS para asegurar consistencia
    return true;
  }

  // Procesar artículos del TREBEP
  async processArticles() {
    try {
      this.log('🔍 Obteniendo artículos del TREBEP...');
      
      // Obtener artículos que pueden necesitar corrección
      const { data: articles, error } = await supabase
        .from('articles')
        .select('id, article_number, title, content')
        .eq('law_id', TREBEP_LAW_ID)
        .order('article_number');

      if (error) throw error;

      this.log(`📄 Encontrados ${articles.length} artículos del TREBEP`);

      // Procesar cada artículo
      for (const article of articles) {
        this.processed++;
        
        // Verificar si necesita corrección (TODOS los artículos)
        this.log(`🔧 Art. ${article.article_number}: Formateando título y contenido con GPT...`);

        // Formatear título y contenido con GPT
        const formatted = await this.formatArticleWithGPT(
          article.article_number, 
          article.title, 
          article.content
        );
        
        if (formatted) {
          // Verificar si hay cambios
          const titleChanged = formatted.title !== article.title;
          const contentChanged = formatted.content !== article.content;
          
          if (titleChanged || contentChanged) {
            // Actualizar en BD
            const { error: updateError } = await supabase
              .from('articles')
              .update({ 
                title: formatted.title,
                content: formatted.content 
              })
              .eq('id', article.id);

            if (updateError) {
              this.error(`Error actualizando Art. ${article.article_number}`, updateError);
            } else {
              this.log(`✅ Actualizado Art. ${article.article_number}:`);
              if (titleChanged) {
                this.log(`   Título: "${article.title}" → "${formatted.title}"`);
              }
              if (contentChanged) {
                this.log(`   Contenido: ${article.content.length} → ${formatted.content.length} chars`);
              }
              this.updated++;
            }
          } else {
            this.log(`✅ Art. ${article.article_number}: Sin cambios necesarios`);
          }
        }

        // Pausa para no saturar la API de OpenAI
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      this.error('Error procesando artículos', error);
      throw error;
    }
  }

  // Función principal
  async run() {
    try {
      this.log('🚀 Iniciando formateo COMPLETO del TREBEP con GPT-4o-mini...');
      this.log('🎯 Modo: REFORMATEAR títulos y contenido de TODOS los artículos');

      // Verificar conexiones
      const { data, error } = await supabase.from('laws').select('count').limit(1);
      if (error) throw new Error(`Error Supabase: ${error.message}`);
      this.log('✅ Conexión Supabase verificada');

      // Verificar OpenAI
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurada en .env');
      }
      this.log('✅ OpenAI API Key configurada');

      // Procesar artículos
      await this.processArticles();

      // Resumen final
      this.log('🎉 FORMATEO COMPLETO DEL TREBEP FINALIZADO');
      this.log(`📊 Estadísticas:`);
      this.log(`   - Artículos procesados: ${this.processed}`);
      this.log(`   - Artículos actualizados: ${this.updated}`);
      this.log(`   - Errores: ${this.errors.length}`);

      if (this.errors.length > 0) {
        this.log('❌ Errores encontrados:');
        this.errors.forEach(error => this.log(`   ${error}`));
      }

      // Guardar log
      await this.saveLogFile();

    } catch (error) {
      this.error('Error crítico', error);
      await this.saveLogFile();
      process.exit(1);
    }
  }

  // Guardar archivo de log
  async saveLogFile() {
    try {
      const logContent = this.logs.join('\n');
      const filename = `trebep-format-${new Date().toISOString().slice(0,10)}.log`;
      await require('fs').promises.writeFile(filename, logContent);
      this.log(`💾 Log guardado en: ${filename}`);
    } catch (error) {
      this.error('Error guardando log', error);
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const formatter = new TREBEPFormatter();
  formatter.run().catch(console.error);
}

module.exports = TREBEPFormatter;