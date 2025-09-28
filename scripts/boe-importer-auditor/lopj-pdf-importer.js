require("dotenv").config();
// lopj-pdf-importer.js - Importador de la Ley Orgánica 6/1985 del Poder Judicial desde PDF
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Datos de la LOPJ
const LOPJ_DATA = {
  name: 'Ley Orgánica 6/1985, de 1 de julio, del Poder Judicial',
  short_name: 'LO 6/1985',
  description: 'Ley Orgánica del Poder Judicial',
  year: 1985,
  type: 'law',
  scope: 'national',
  category: 'judicial'
};

class LOPJImporter {
  constructor() {
    this.processedArticles = 0;
    this.errors = [];
    this.logs = [];
    this.pdfPath = './LOPJ.pdf'; // Nombre del archivo PDF
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

  // Leer y extraer texto del PDF
  async extractPdfText() {
    try {
      this.log(`📁 Leyendo PDF: ${this.pdfPath}`);
      
      // Verificar que el archivo existe
      const fileStats = await fs.stat(this.pdfPath);
      this.log(`✅ PDF encontrado: ${this.pdfPath} (${fileStats.size} bytes)`);
      
      // Leer el PDF
      const dataBuffer = await fs.readFile(this.pdfPath);
      const pdfData = await pdf(dataBuffer);
      
      this.log(`📄 PDF procesado: ${pdfData.numpages} páginas, ${pdfData.text.length} caracteres`);
      
      return pdfData.text;
      
    } catch (error) {
      this.error('Error leyendo PDF', error);
      throw error;
    }
  }

  // Extraer artículos del texto del PDF
  extractArticlesFromText(text) {
    const articles = [];
    
    this.log(`🔍 Iniciando extracción de artículos...`);
    
    // Limpiar texto inicial
    let cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/BOLETÍN OFICIAL DEL ESTADO/g, '')
      .replace(/LEGISLACIÓN CONSOLIDADA/g, '')
      .replace(/Página \d+/g, '')
      .trim();
    
    // Patrón mejorado para artículos con bis/ter
    const articlePattern = /Artículo\s+(\d+(?:\s+bis|\s+ter)?)\.\s*([\s\S]*?)(?=\nArtículo\s+\d+(?:\s+bis|\s+ter)?\.|$)/g;
    
    let match;
    let articleCount = 0;
    
    while ((match = articlePattern.exec(cleanText)) !== null) {
      const articleNumber = match[1].replace(/\s+/g, ' ').trim(); // Mantener espacios en "4 bis"
      const fullContent = match[2].trim();
      
      // Procesar el contenido
      let title = '';
      let content = '';
      
      // Dividir en líneas para analizar
      const lines = fullContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length > 0) {
        const firstLine = lines[0];
        
        // Detectar si el artículo tiene apartados numerados
        const hasNumberedSections = fullContent.match(/\n\s*[1-9]\.\s+/);
        
        // Detectar si es un artículo de una sola frase (sin apartados)
        const isSingleSentence = !hasNumberedSections && lines.length <= 2 && fullContent.length < 300;
        
        // Si es una sola frase corta SIN apartados, usar título genérico
        if (isSingleSentence) {
          title = `Artículo ${articleNumber}`;
          content = fullContent;
        }
        // Si la primera línea es muy corta (posible título) Y tiene apartados después
        else if (firstLine.length < 80 && hasNumberedSections && !firstLine.match(/^\d+\./)) {
          title = firstLine;
          content = lines.slice(1).join('\n');
        }
        // Para todo lo demás, usar título genérico
        else {
          title = `Artículo ${articleNumber}`;
          content = fullContent;
        }
      }
      
      // Limpiar y formatear el contenido
      const formattedContent = this.formatArticleContent(content, articleNumber);
      
      if (formattedContent && formattedContent.length > 10) {
        articles.push({
          number: articleNumber.replace(/\s+/g, ' '), // "4 bis" no "4bis"
          title: title || `Artículo ${articleNumber}`,
          content: formattedContent
        });
        
        articleCount++;
        this.log(`📝 Artículo ${articleNumber}: ${title.substring(0, 50)}...`);
      }
    }
    
    this.log(`✅ Extraídos ${articleCount} artículos de la LOPJ`);
    return articles;
  }

  // Formatear contenido del artículo con estructura legible
  formatArticleContent(rawContent, articleNumber) {
    if (!rawContent || rawContent.trim() === '') {
      return null;
    }

    let content = rawContent.trim();
    
    // Limpiar caracteres problemáticos y normalizar
    content = content
      .replace(/\u00A0/g, ' ') // Non-breaking space
      .replace(/\u2013/g, '-') // En dash
      .replace(/\u2014/g, '-') // Em dash
      .replace(/\u201C/g, '"') // Left double quote
      .replace(/\u201D/g, '"') // Right double quote
      .replace(/\u2018/g, "'") // Left single quote
      .replace(/\u2019/g, "'") // Right single quote
      .replace(/\s+/g, ' ')    // Múltiples espacios
      .trim();

    // Formatear apartados numerados al inicio de línea (1., 2., 3., etc.)
    content = content.replace(/(^|\n)(\d+)\.\s+/g, '\n\n$2. ');
    
    // Formatear apartados con letras (a), b), c), etc.)
    content = content.replace(/(^|\n)([a-z])\)\s+/g, '\n\n$2) ');
    
    // Formatear apartados ordinales (1.º, 2.º, etc.)
    content = content.replace(/(^|\n)(\d+)\.º\s+/g, '\n\n$2.º ');
    
    // Separar párrafos donde hay punto seguido de mayúscula (nuevo párrafo)
    content = content.replace(/\.\s+([A-Z][a-záéíóúñü])/g, '.\n\n$1');
    
    // Separar párrafos donde hay coma seguida de frase con "cuando", "siempre que", etc.
    content = content.replace(/,\s+(cuando|siempre que|con arreglo|según|conforme|de conformidad)\s+/g, ',\n\n$1 ');
    
    // Limpiar espacios excesivos y saltos de línea
    content = content
      .replace(/^\s+/gm, '') // Espacios al inicio de línea
      .replace(/\n{3,}/g, '\n\n') // Más de 2 saltos de línea
      .replace(/\n\s*\n/g, '\n\n') // Limpiar líneas con solo espacios
      .trim();

    return content;
  }

  // Crear o verificar que existe la ley en la BD
  async ensureLawExists() {
    try {
      // Buscar ley existente por short_name
      const { data: existingLaw, error: selectError } = await supabase
        .from('laws')
        .select('*')
        .eq('short_name', LOPJ_DATA.short_name)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      if (existingLaw) {
        this.log(`📚 Ley existente encontrada: ${LOPJ_DATA.short_name}`);
        return existingLaw;
      }

      // Crear nueva ley
      const { data: newLaw, error: insertError } = await supabase
        .from('laws')
        .insert([{
          name: LOPJ_DATA.name,
          short_name: LOPJ_DATA.short_name,
          description: LOPJ_DATA.description,
          year: LOPJ_DATA.year,
          type: LOPJ_DATA.type,
          scope: LOPJ_DATA.scope,
          is_active: true
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      this.log(`🆕 Nueva ley creada: ${LOPJ_DATA.short_name}`);
      return newLaw;

    } catch (error) {
      this.error(`Error gestionando ley ${LOPJ_DATA.short_name}`, error);
      throw error;
    }
  }

  // Procesar un artículo individual
  async processArticle(article, lawId) {
    try {
      // Verificar si el artículo ya existe
      const { data: existingArticle, error: selectError } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', lawId)
        .eq('article_number', article.number)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      // Datos del artículo
      const articleData = {
        law_id: lawId,
        article_number: article.number,
        title: article.title,
        content: article.content,
        is_active: true,
        is_verified: true
      };

      if (existingArticle) {
        // Actualizar artículo existente
        const { error: updateError } = await supabase
          .from('articles')
          .update(articleData)
          .eq('id', existingArticle.id);

        if (updateError) throw updateError;
        this.log(`🔄 Actualizado: Artículo ${article.number}`);
      } else {
        // Crear nuevo artículo
        const { error: insertError } = await supabase
          .from('articles')
          .insert([articleData]);

        if (insertError) throw insertError;
        this.log(`🆕 Creado: Artículo ${article.number}`);
      }

      this.processedArticles++;

    } catch (error) {
      this.error(`Error procesando artículo ${article.number}`, error);
      throw error;
    }
  }

  // Función principal
  async run() {
    try {
      this.log('🚀 Iniciando importación LOPJ desde PDF...');

      // Verificar conexión a Supabase
      const { data, error } = await supabase.from('laws').select('count').limit(1);
      if (error) {
        throw new Error(`Error de conexión a Supabase: ${error.message}`);
      }
      this.log('✅ Conexión a Supabase verificada');

      // Extraer texto del PDF
      const pdfText = await this.extractPdfText();
      
      // Extraer artículos del texto
      const articles = this.extractArticlesFromText(pdfText);
      
      if (articles.length === 0) {
        throw new Error('No se encontraron artículos en el PDF');
      }

      this.log(`📄 Encontrados ${articles.length} artículos en la LOPJ`);

      // Crear/verificar la ley en la BD
      const law = await this.ensureLawExists();
      
      // Procesar cada artículo
      this.log('📝 Insertando artículos en la base de datos...');
      
      for (const article of articles) {
        try {
          await this.processArticle(article, law.id);
          
          // Pausa pequeña entre artículos para no saturar la BD
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (articleError) {
          this.error(`Error procesando artículo ${article.number}`, articleError);
        }
      }

      // Resumen final
      this.log('🎉 IMPORTACIÓN LOPJ COMPLETADA');
      this.log(`📊 Estadísticas:`);
      this.log(`   - Artículos procesados: ${this.processedArticles}`);
      this.log(`   - Errores: ${this.errors.length}`);
      
      if (this.errors.length > 0) {
        this.log('❌ Errores encontrados:');
        this.errors.forEach(error => this.log(`   ${error}`));
      }

      // Guardar log
      await this.saveLogFile();

    } catch (error) {
      this.error('Error crítico en la importación', error);
      await this.saveLogFile();
      process.exit(1);
    }
  }

  // Guardar archivo de log
  async saveLogFile() {
    try {
      const logContent = this.logs.join('\n');
      const filename = `lopj-import-${new Date().toISOString().slice(0,10)}.log`;
      await fs.writeFile(filename, logContent);
      this.log(`💾 Log guardado en: ${filename}`);
    } catch (error) {
      this.error('Error guardando archivo de log', error);
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const importer = new LOPJImporter();
  importer.run().catch(console.error);
}

module.exports = LOPJImporter;