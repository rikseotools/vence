require("dotenv").config();
// boe-epub-importer.js - Importador de artículos del BOE usando ePUB oficial
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const cheerio = require('cheerio');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Directorio temporal para descargas
const TEMP_DIR = './temp_boe';

// Mapeo de leyes importantes con sus datos del BOE - SOLO LEY 19/2013 PARA PRUEBA
const LAWS_TO_IMPORT = [
  {
    boe_id: 'BOE-A-2013-12887',
    epub_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2013-12887&formato=epub',
    name: 'Ley 19/2013, de 9 de diciembre, de transparencia, acceso a la información pública y buen gobierno',
    short_name: 'Ley 19/2013',
    description: 'Ley de transparencia, acceso a la información pública y buen gobierno',
    category: 'transparencia'
  }
];

class BOEEpubImporter {
  constructor() {
    this.processedArticles = 0;
    this.errors = [];
    this.logs = [];
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

  // Función para decodificar entidades HTML
  decodeHtmlEntities(text) {
    const htmlEntities = {
      '&#xF3;': 'ó',
      '&#xFA;': 'ú',
      '&#xE1;': 'á',
      '&#xE9;': 'é',
      '&#xED;': 'í',
      '&#xF1;': 'ñ',
      '&#xD1;': 'Ñ',
      '&#xAB;': '«',
      '&#xBB;': '»',
      '&#xDA;': 'Ú',
      '&#xC1;': 'Á',
      '&#xC9;': 'É',
      '&#xCD;': 'Í',
      '&#xD3;': 'Ó',
      '&#xDC;': 'Ü',
      '&#xFC;': 'ü',
      '&#xA0;': ' ', // non-breaking space
      '&quot;': '"',
      '&apos;': "'",
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&'
    };

    let decodedText = text;
    for (const [entity, char] of Object.entries(htmlEntities)) {
      decodedText = decodedText.replace(new RegExp(entity, 'g'), char);
    }
    
    // También decodificar entidades numéricas decimales comunes
    decodedText = decodedText.replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(dec);
    });
    
    // Decodificar entidades hexadecimales
    decodedText = decodedText.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return decodedText;
  }

  // Crear directorio temporal
  async createTempDir() {
    try {
      await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
      // Directorio ya existe, no pasa nada
    }
  }

  // Usar archivo ePUB local en lugar de descargarlo
  async useLocalEpub(lawData) {
    try {
      const fileName = `${lawData.boe_id}-consolidado.epub`;
      const filePath = path.join('.', fileName);
      
      this.log(`📁 Usando archivo local: ${fileName}`);
      
      // Verificar que el archivo existe
      try {
        const fileStats = await fs.stat(filePath);
        this.log(`✅ Archivo encontrado: ${fileName} (${fileStats.size} bytes)`);
      } catch (error) {
        throw new Error(`Archivo no encontrado: ${fileName}. Asegúrate de que esté en el directorio actual.`);
      }
      
      // Verificar si es un ZIP válido
      const firstBytes = await fs.readFile(filePath, { start: 0, end: 100 });
      
      if (!firstBytes.includes('PK')) {
        this.log(`⚠️ No es un archivo ZIP válido, parseando como texto/HTML`);
        const content = await fs.readFile(filePath, 'utf8');
        return { isHtml: true, content, filePath };
      }
      
      return { isHtml: false, content: null, filePath };
    } catch (error) {
      this.error(`Error usando archivo local de ${lawData.short_name}`, error);
      throw error;
    }
  }

  // Extraer y parsear contenido del ePUB
  async parseEpubContent(downloadResult, lawData) {
    try {
      this.log(`📖 Parseando contenido: ${path.basename(downloadResult.filePath)}`);
      
      let contentText = '';
      
      if (downloadResult.isHtml) {
        // Si es HTML/texto directo, usarlo tal como está
        contentText = downloadResult.content;
        this.log(`📄 Contenido parseado como HTML/texto directo`);
      } else {
        // Intentar extraer como ePUB ZIP
        const zip = new AdmZip(downloadResult.filePath);
        const zipEntries = zip.getEntries();
        
        // Buscar el archivo principal de contenido
        let contentEntry = null;
        for (const entry of zipEntries) {
          if (entry.entryName.includes('.xhtml') || entry.entryName.includes('.html')) {
            contentEntry = entry;
            break;
          }
        }
        
        if (!contentEntry) {
          throw new Error('No se encontró archivo de contenido en el ePUB');
        }
        
        contentText = contentEntry.getData().toString('utf8');
        this.log(`📄 Contenido extraído del archivo: ${contentEntry.entryName}`);
      }
      
      // Decodificar entidades HTML antes del procesamiento
      contentText = this.decodeHtmlEntities(contentText);
      
      // Parsear artículos del contenido
      return this.extractArticlesFromContent(contentText, lawData);
      
    } catch (error) {
      this.error(`Error parseando contenido`, error);
      throw error;
    }
  }

  // Extraer artículos del contenido usando anclajes específicos
  extractArticlesFromContent(content, lawData) {
    const articles = [];
    
    this.log(`🔍 Comenzando extracción de artículos...`);
    
    // Buscar anclajes específicos de artículos en el contenido original (sin limpiar)
    const articleAnchors = content.match(/\{#conso-2013-12887\.xhtml#a(\d+(?:bis)?)\}/g);
    
    if (articleAnchors) {
      this.log(`🔍 Encontrados ${articleAnchors.length} anclajes de artículos`);
      
      // Extraer cada artículo individualmente usando sus anclajes
      for (let i = 0; i < articleAnchors.length; i++) {
        const currentAnchor = articleAnchors[i];
        const nextAnchor = articleAnchors[i + 1];
        
        // Extraer número del artículo del anclaje
        const articleNumberMatch = currentAnchor.match(/a(\d+(?:bis)?)/);
        if (!articleNumberMatch) continue;
        
        const articleNumber = articleNumberMatch[1];
        
        // Definir punto de inicio y fin para extraer solo este artículo
        const startIndex = content.indexOf(currentAnchor);
        let endIndex;
        
        if (nextAnchor) {
          // Si hay siguiente artículo, terminar antes de él
          endIndex = content.indexOf(nextAnchor);
        } else {
          // Si es el último artículo, buscar siguiente sección principal
          const nextSectionPatterns = [
            /\{#conso-2013-12887\.xhtml#d/,  // Disposiciones
            /\{#conso-2013-12887\.xhtml#t/,  // Títulos
            /\{#conso-2013-12887\.xhtml#c/,  // Capítulos
            /TÍTULO/,
            /CAPÍTULO/,
            /Disposición/
          ];
          
          endIndex = content.length;
          for (const pattern of nextSectionPatterns) {
            const match = content.substring(startIndex + 100).search(pattern);
            if (match !== -1) {
              endIndex = Math.min(endIndex, startIndex + 100 + match);
            }
          }
        }
        
        // Extraer contenido del artículo específico
        const articleContent = content.substring(startIndex, endIndex);
        
        // Buscar título y contenido del artículo
        const articlePattern = new RegExp(
          `Artículo\\s+${articleNumber}\\s*\\.\\s*([^.]+)\\.\\s*([\\s\\S]*?)$`,
          'i'
        );
        
        const match = articlePattern.exec(this.decodeHtmlEntities(articleContent));
        
        if (match) {
          const title = match[1].trim();
          const rawContent = match[2].trim();
          
          this.log(`📝 Artículo ${articleNumber}: ${title} (${rawContent.length} chars)`);
          
          if (rawContent && rawContent.length > 50) {
            const cleanContent = this.cleanArticleContent(rawContent);
            
            if (cleanContent && cleanContent.length > 20) {
              articles.push({
                number: articleNumber,
                title: title,
                content: cleanContent,
                law_data: lawData
              });
            }
          }
        } else {
          this.log(`⚠️ No se pudo parsear el artículo ${articleNumber}`);
        }
      }
    }
    
    // Si no encontramos artículos con anclajes, usar método de respaldo
    if (articles.length === 0) {
      this.log(`🔄 No se encontraron artículos con anclajes, usando método de respaldo...`);
      return this.extractArticlesGeneral(content, lawData);
    }
    
    this.log(`✅ Extraídos ${articles.length} artículos usando anclajes específicos`);
    return articles;
  }

  // Método de respaldo: extracción general mejorada
  extractArticlesGeneral(content, lawData) {
    const articles = [];
    
    // Decodificar entidades HTML
    const decodedContent = this.decodeHtmlEntities(content);
    
    // Limpiar el contenido
    const cleanContent = decodedContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    this.log(`🔍 Longitud del contenido limpio: ${cleanContent.length} caracteres`);
    
    // Dividir en secciones por artículos
    const articleSections = cleanContent.split(/(?=Artículo\s+\d+)/gi);
    
    for (const section of articleSections) {
      if (section.trim().length < 100) continue;
      
      // Extraer número, título y contenido
      const articleMatch = section.match(/^Artículo\s+(\d+(?:\s+bis)?)\.\s+([^.]+)\.\s+(.*)/is);
      
      if (articleMatch) {
        const articleNumber = articleMatch[1].replace(/\s+/g, '');
        const title = articleMatch[2].trim();
        let rawContent = articleMatch[3].trim();
        
        // Limpiar contenido: quitar hasta el siguiente artículo
        const nextArticleIndex = rawContent.search(/Artículo\s+\d+/i);
        if (nextArticleIndex > 0) {
          rawContent = rawContent.substring(0, nextArticleIndex).trim();
        }
        
        // Limpiar contenido: quitar secciones principales
        const stopPatterns = [
          /TÍTULO\s+[IVX]+/i,
          /CAPÍTULO\s+[IVX]+/i,
          /Disposición\s+(adicional|final)/i,
          /Por tanto,/i
        ];
        
        for (const pattern of stopPatterns) {
          const stopIndex = rawContent.search(pattern);
          if (stopIndex > 0) {
            rawContent = rawContent.substring(0, stopIndex).trim();
          }
        }
        
        this.log(`📝 Artículo general ${articleNumber}: ${title} (${rawContent.length} chars)`);
        
        if (rawContent && rawContent.length > 50 && rawContent.length < 5000) {
          const cleanContent = this.cleanArticleContent(rawContent);
          
          if (cleanContent && cleanContent.length > 20) {
            articles.push({
              number: articleNumber,
              title: title,
              content: cleanContent,
              law_data: lawData
            });
          }
        }
      }
    }
    
    return articles;
  }

  // Limpiar contenido del artículo
  cleanArticleContent(rawContent) {
    let content = rawContent;
    
    // Eliminar marcas de ePUB y referencias
    content = content
      .replace(/\[\]\{[^}]*\}/g, '') // Quitar anclajes []{#...}
      .replace(/:::[^:]*:::/g, '') // Quitar bloques :::
      .replace(/<[^>]*>/g, '') // Quitar HTML residual
      .replace(/\n{3,}/g, '\n\n') // Limpiar saltos de línea excesivos
      .trim();
    
    // Limpiar espacios múltiples pero preservar estructura
    content = content.replace(/\s{3,}/g, ' ');
    
    // Formatear apartados principales (1., 2., 3...)
    content = content.replace(/(\d+)\.\s+/g, '\n\n$1. ');
    
    // Formatear apartados con letras - MEJORADO
    content = content.replace(/\b([a-z])\)\s+/g, '\n\n$1) ');
    
    // Formatear apartados con letras seguidos de texto (caso específico)
    content = content.replace(/\s([a-z])\)\s+([A-Z])/g, '\n\n$1) $2');
    
    // Separar frases que empiezan con mayúscula después de punto
    content = content.replace(/\.\s+([A-Z][a-z])/g, '.\n\n$1');
    
    // Limpiar numeración inicial si existe
    content = content.replace(/^\s*[\d\w\.]*\s*/, '');
    
    return content.trim();
  }

  // Formatear contenido del artículo con estructura HTML
  formatArticleContent(rawContent, articleNumber, articleTitle) {
    if (!rawContent || rawContent.trim() === '') {
      return `<div class="article-empty">Contenido del artículo ${articleNumber} no disponible</div>`;
    }

    let formattedContent = rawContent.trim();
    
    // Estructura base del artículo
    let htmlContent = `<div class="article-content">
  <header class="article-header">
    <h4 class="article-title">Artículo ${articleNumber}. ${articleTitle}</h4>
  </header>
  <div class="article-body">`;

    // Procesar apartados principales (1., 2., 3...)
    const sectionPattern = /(\d+)\.\s*([^0-9]*?)(?=\d+\.|$)/g;
    let hasNumberedSections = false;
    
    formattedContent = formattedContent.replace(sectionPattern, (match, number, content) => {
      hasNumberedSections = true;
      const cleanContent = content.trim();
      return `
    <div class="article-section">
      <span class="section-number">${number}.</span>
      <div class="section-content">${this.formatSectionContent(cleanContent)}</div>
    </div>`;
    });

    // Si no hay apartados numerados, procesar como párrafo único
    if (!hasNumberedSections) {
      htmlContent += `
    <div class="article-paragraph">
      <div class="paragraph-content">${this.formatSectionContent(formattedContent)}</div>
    </div>`;
    } else {
      htmlContent += formattedContent;
    }

    htmlContent += `
  </div>
</div>`;

    return htmlContent;
  }

  // Formatear contenido de secciones con letras (a), b), c)...)
  formatSectionContent(content) {
    if (!content) return '';

    let formatted = content;

    // Procesar subapartados con letras
    formatted = formatted.replace(
      /([a-z])\)\s*([^a-z\)]*?)(?=[a-z]\)|$)/g,
      (match, letter, text) => {
        const cleanText = text.trim();
        if (cleanText.length < 10) return match;
        
        return `
      <div class="article-subsection">
        <span class="subsection-letter">${letter})</span>
        <span class="subsection-content">${cleanText}</span>
      </div>`;
      }
    );

    // Procesar números ordinales (1.º, 2.º...)
    formatted = formatted.replace(
      /(\d+)\.º\s*([^0-9]*?)(?=\d+\.º|$)/g,
      (match, number, content) => {
        const cleanContent = content.trim();
        return `
      <div class="article-ordinal">
        <span class="ordinal-number">${number}.º</span>
        <span class="ordinal-content">${cleanContent}</span>
      </div>`;
      }
    );

    return formatted;
  }

  // Limpiar archivos temporales
  async cleanupTempFiles() {
    try {
      await fs.rmdir(TEMP_DIR, { recursive: true });
      this.log(`🗑️ Archivos temporales eliminados`);
    } catch (error) {
      // No es crítico si no se pueden eliminar
    }
  }

  // Descargar y procesar una ley
  async processLaw(lawData) {
    let epubPath = null;
    
    try {
      this.log(`🔄 Procesando: ${lawData.short_name}`);
      
      // Usar archivo ePUB local
      const downloadResult = await this.useLocalEpub(lawData);
      
      // Parsear contenido
      const articles = await this.parseEpubContent(downloadResult, lawData);
      
      if (articles.length === 0) {
        this.error(`No se encontraron artículos en ${lawData.short_name}`);
        return;
      }

      this.log(`📄 Encontrados ${articles.length} artículos en ${lawData.short_name}`);

      // Verificar/crear la ley en la BD
      const law = await this.ensureLawExists(lawData);
      
      // Procesar cada artículo
      for (const article of articles) {
        try {
          await this.processArticle(article, law.id);
        } catch (articleError) {
          this.error(`Error procesando artículo ${article.number} de ${lawData.short_name}`, articleError);
        }
      }

      this.log(`✅ Completado: ${lawData.short_name}`);

    } catch (error) {
      this.error(`Error procesando ${lawData.short_name}`, error);
    } finally {
      // No limpiar archivo local, solo temporales si los hay
    }
  }

  // Asegurar que la ley existe en la BD
  async ensureLawExists(lawData) {
    try {
      // Buscar ley existente por short_name
      const { data: existingLaw, error: selectError } = await supabase
        .from('laws')
        .select('*')
        .eq('short_name', lawData.short_name)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      if (existingLaw) {
        this.log(`📚 Ley existente encontrada: ${lawData.short_name}`);
        return existingLaw;
      }

      // Extraer año de la ley para el campo year
      const yearMatch = lawData.short_name.match(/(\d{4})/);
      const lawYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

      // Crear nueva ley usando la estructura actual de la BD
      const { data: newLaw, error: insertError } = await supabase
        .from('laws')
        .insert([{
          name: lawData.name,
          short_name: lawData.short_name,
          description: lawData.description,
          year: lawYear,
          type: 'law',
          scope: 'estatal',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      this.log(`🆕 Nueva ley creada: ${lawData.short_name}`);
      return newLaw;

    } catch (error) {
      this.error(`Error gestionando ley ${lawData.short_name}`, error);
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

      // Formatear contenido HTML
      const formattedContent = this.formatArticleContent(
        article.content, 
        article.number, 
        article.title
      );

      // Datos del artículo usando la estructura actual de la BD
      const articleData = {
        law_id: lawId,
        article_number: article.number,
        title: article.title,
        content: formattedContent, // Guardar HTML formateado
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
      this.log('🚀 Iniciando importación de artículos del BOE (ePUB local)...');
      this.log(`📋 Leyes a procesar: ${LAWS_TO_IMPORT.length}`);

      // Crear directorio temporal
      await this.createTempDir();

      // Verificar conexión a Supabase
      const { data, error } = await supabase.from('laws').select('count').limit(1);
      if (error) {
        throw new Error(`Error de conexión a Supabase: ${error.message}`);
      }
      this.log('✅ Conexión a Supabase verificada');

      for (const lawData of LAWS_TO_IMPORT) {
        try {
          await this.processLaw(lawData);
        } catch (lawError) {
          this.error(`Error procesando ley ${lawData.short_name}`, lawError);
        }
        
        // Pausa entre leyes
        this.log('⏱️ Pausando 3 segundos...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Resumen final
      this.log('🎉 IMPORTACIÓN COMPLETADA');
      this.log(`📊 Estadísticas:`);
      this.log(`   - Artículos procesados: ${this.processedArticles}`);
      this.log(`   - Errores: ${this.errors.length}`);
      
      if (this.errors.length > 0) {
        this.log('❌ Errores encontrados:');
        this.errors.forEach(error => this.log(`   ${error}`));
      }

      // Limpiar archivos temporales
      await this.cleanupTempFiles();

      // Guardar log completo
      await this.saveLogFile();

    } catch (error) {
      this.error('Error crítico en la importación', error);
      await this.cleanupTempFiles();
      await this.saveLogFile();
      process.exit(1);
    }
  }

  // Guardar archivo de log
  async saveLogFile() {
    try {
      const logContent = this.logs.join('\n');
      const filename = `boe-epub-import-${new Date().toISOString().slice(0,10)}.log`;
      await fs.writeFile(filename, logContent);
      this.log(`💾 Log guardado en: ${filename}`);
    } catch (error) {
      this.error('Error guardando archivo de log', error);
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const importer = new BOEEpubImporter();
  importer.run().catch(console.error);
}

module.exports = BOEEpubImporter;