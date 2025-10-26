// scripts/fix-constitucion-imports.js
// Arreglar imports de componentes cliente en secciones de Constitución

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const constitucionSections = [
  'preambulo-y-titulo-preliminar',
  'titulo-i-derechos-y-deberes-fundamentales',
  'titulo-ii-de-la-corona',
  'titulo-iii-de-las-cortes-generales',
  'titulo-iv-del-gobierno-y-la-administracion',
  'titulo-v-relaciones-gobierno-cortes',
  'titulo-vi-del-poder-judicial',
  'titulo-vii-economia-y-hacienda',
  'titulo-viii-organizacion-territorial',
  'titulo-ix-del-tribunal-constitucional',
  'titulo-x-de-la-reforma-constitucional'
];

async function fixSectionImports(sectionSlug) {
  try {
    const basePath = join(process.cwd(), 'app', 'test-oposiciones', 'test-de-la-constitucion-espanola-de-1978', sectionSlug);
    const pageFilePath = join(basePath, 'page.js');
    const clientFilePath = join(basePath, 'SectionClientComponents.js');
    
    // 1. Arreglar exports en SectionClientComponents.js
    try {
      let clientContent = await readFile(clientFilePath, 'utf8');
      
      // Verificar si ya tiene las exportaciones nombradas
      if (!clientContent.includes('export { StartTestButton, TabsSection }')) {
        // Agregar exportaciones nombradas antes del export default
        clientContent = clientContent.replace(
          '// Exportar componentes\nconst SectionClientComponents = {',
          '// Exportar componentes\nexport { StartTestButton, TabsSection }\n\nconst SectionClientComponents = {'
        );
        
        await writeFile(clientFilePath, clientContent, 'utf8');
        console.log(`✅ Fixed exports en ${sectionSlug}/SectionClientComponents.js`);
      }
    } catch (error) {
      console.log(`⚠️  No existe SectionClientComponents.js en ${sectionSlug}`);
    }
    
    // 2. Arreglar imports en page.js
    try {
      let pageContent = await readFile(pageFilePath, 'utf8');
      
      // Cambiar import default por import nombrado si es necesario
      if (pageContent.includes('import SectionClientComponents from')) {
        pageContent = pageContent.replace(
          'import SectionClientComponents from \'./SectionClientComponents\'',
          'import { StartTestButton, TabsSection } from \'./SectionClientComponents\''
        );
        
        // Cambiar referencias en JSX
        pageContent = pageContent.replace(
          /SectionClientComponents\.StartTestButton/g,
          'StartTestButton'
        );
        
        pageContent = pageContent.replace(
          /SectionClientComponents\.TabsSection/g,
          'TabsSection'
        );
        
        await writeFile(pageFilePath, pageContent, 'utf8');
        console.log(`✅ Fixed imports en ${sectionSlug}/page.js`);
      } else {
        console.log(`✅ ${sectionSlug}/page.js ya tiene imports correctos`);
      }
    } catch (error) {
      console.log(`⚠️  No existe page.js en ${sectionSlug}`);
    }
    
  } catch (error) {
    console.error(`❌ Error arreglando ${sectionSlug}:`, error.message);
  }
}

async function fixAllConstitucionImports() {
  console.log('🔧 Arreglando imports de componentes cliente en Constitución...');
  console.log(`📝 ${constitucionSections.length} secciones a procesar`);
  
  for (const section of constitucionSections) {
    await fixSectionImports(section);
  }
  
  console.log('✅ Todos los imports han sido arreglados');
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAllConstitucionImports();
}

export { fixAllConstitucionImports };