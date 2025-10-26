// scripts/fix-section-imports.js
// Arreglar imports de SectionClientComponents en todas las secciones

import { readFile, writeFile, readdir } from 'fs/promises'
import { join } from 'path'

const sections = [
  'titulo-preliminar',
  'titulo-i-capitulo-i-capacidad-obrar-concepto-interesado',
  'titulo-i-capitulo-ii-identificacion-firma-interesados',
  'titulo-ii-capitulo-i-normas-generales-actuacion',
  'titulo-ii-capitulo-ii-terminos-plazos',
  'titulo-iii-capitulo-i-requisitos-actos-administrativos',
  'titulo-iii-capitulo-ii-eficacia-actos',
  'titulo-iii-capitulo-iii-nulidad-anulabilidad',
  'titulo-iv-capitulos-i-ii-garantias-iniciacion',
  'titulo-iv-capitulos-iii-iv-ordenacion-instruccion',
  'titulo-iv-capitulos-v-vi-vii-finalizacion-simplificada-ejecucion',
  'titulo-v-capitulo-i-revision-oficio',
  'titulo-v-capitulo-ii-recursos-administrativos',
  'titulo-vi-iniciativa-legislativa-potestad-reglamentaria',
  'test-plazos'
];

async function fixSectionImports(sectionSlug) {
  try {
    const basePath = join(process.cwd(), 'app', 'test-oposiciones', 'test-ley-39-2015', sectionSlug);
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
      
      // Cambiar import default por import nombrado
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
      }
    } catch (error) {
      console.log(`⚠️  No existe page.js en ${sectionSlug}`);
    }
    
  } catch (error) {
    console.error(`❌ Error arreglando ${sectionSlug}:`, error.message);
  }
}

async function fixAllSectionImports() {
  console.log('🔧 Arreglando imports de SectionClientComponents en todas las secciones...');
  console.log(`📝 ${sections.length} secciones a procesar`);
  
  for (const section of sections) {
    await fixSectionImports(section);
  }
  
  console.log('✅ Todos los imports han sido arreglados');
  console.log('🎯 Cambios aplicados:');
  console.log('1. ✅ Exportaciones nombradas en SectionClientComponents.js');
  console.log('2. ✅ Imports nombrados en page.js');
  console.log('3. ✅ Referencias JSX actualizadas');
  console.log('4. ✅ Compatibilidad con renderizado híbrido');
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAllSectionImports();
}

export { fixAllSectionImports };