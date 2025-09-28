// add-cache-results.cjs
const fs = require('fs');
const path = require('path');

// Función para encontrar archivos TestClient.js
function findTestClientFiles(dir) {
  const files = [];
  
  function searchDir(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (item.match(/Test\d+Client\.js$/)) {
        files.push(fullPath);
      }
    }
  }
  
  searchDir(dir);
  return files;
}

// Función para encontrar páginas principales de temas
function findThemePages(dir) {
  const files = [];
  const themeDirs = fs.readdirSync(dir).filter(item => 
    fs.statSync(path.join(dir, item)).isDirectory() && item.startsWith('tema-')
  );
  
  for (const themeDir of themeDirs) {
    const pagePath = path.join(dir, themeDir, 'page.js');
    if (fs.existsSync(pagePath)) {
      files.push(pagePath);
    }
  }
  
  return files;
}

// Modificar TestClient.js para guardar resultados
function addCacheToTestClient(filePath) {
  console.log(`Procesando TestClient: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Extraer tema y test del path
  const pathMatch = filePath.match(/tema-(\d+)\/test-(\d+)/);
  if (!pathMatch) return;
  
  const tema = pathMatch[1];
  const test = pathMatch[2];
  const cacheKey = `test_${tema}_${test}_result`;
  
  // Función para guardar resultado
  const saveResultFunction = `
  const saveTestResult = (score, totalQuestions, timeSeconds) => {
    const result = {
      score,
      totalQuestions,
      timeSeconds,
      date: Date.now(),
      percentage: Math.round((score / totalQuestions) * 100)
    };
    localStorage.setItem('${cacheKey}', JSON.stringify(result));
  };`;
  
  // Añadir función después de formatTime si no existe
  if (!content.includes('const saveTestResult =')) {
    content = content.replace(
      /const formatTime = \(seconds\) => \{[\s\S]*?\};/,
      (match) => match + saveResultFunction
    );
  }
  
  // Añadir llamada para guardar resultado en pantalla final
  if (!content.includes('saveTestResult(score, questions.length')) {
    content = content.replace(
      /(<div className="text-7xl font-bold mb-6">)/,
      `{/* Guardar resultado */}
              {(() => {
                saveTestResult(score, questions.length, Math.floor((Date.now() - startTime) / 1000));
                return null;
              })()}
              $1`
    );
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Actualizado TestClient: ${filePath}`);
}

// Modificar página de tema para mostrar caché
function addCacheToThemePage(filePath) {
  console.log(`Procesando página tema: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Extraer número de tema del path
  const themeMatch = filePath.match(/tema-(\d+)/);
  if (!themeMatch) return;
  
  const tema = themeMatch[1];
  
  // Función para obtener resultado guardado
  const getCacheFunction = `
  const getTestResult = (testNumber) => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(\`test_${tema}_\${testNumber}_result\`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const formatDaysAgo = (timestamp) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Hace 1 día";
    return \`Hace \${days} días\`;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: '2-digit'
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) {
      return \`\${secs} seg\`;
    } else if (secs === 0) {
      return \`\${mins} min\`;
    } else {
      return \`\${mins} min \${secs} seg\`;
    }
  };`;
  
  // Añadir funciones después de export default si no existe
  if (!content.includes('const getTestResult =')) {
    content = content.replace(
      /(export default function \w+\(\) \{)/,
      `$1${getCacheFunction}`
    );
  }
  
  // Modificar el mapeo de tests para incluir caché
  if (!content.includes('const result = getTestResult')) {
    content = content.replace(
      /\{testsDisponibles\.map\(\(test, index\) => \(/,
      `{testsDisponibles.map((test, index) => {
            const result = getTestResult(test.numero);
            return (`
    );
    
    // Cerrar el map correctamente
    content = content.replace(
      /\)\)\}/g,
      ')})'
    );
  }
  
  // Actualizar contenido de la tarjeta para mostrar caché
  if (!content.includes('result ? (')) {
    content = content.replace(
      /(<p className="text-gray-600 text-sm mb-4 leading-relaxed">[\s\S]*?<\/p>)/,
      `$1
                  
                  {result ? (
                    <div className="mb-4 space-y-1">
                      <div className="text-sm text-green-700 font-medium">
                        📊 Último: {formatDate(result.date)} ({result.percentage}%) - {formatDaysAgo(result.date)}
                      </div>
                      <div className="text-sm text-blue-700">
                        ⏱️ {formatTime(result.timeSeconds)}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <div className="text-sm text-gray-500">
                        ❓ No realizado anteriormente
                      </div>
                    </div>
                  )}`
    );
  }
  
  // Cambiar texto del botón según el estado
  if (!content.includes('result ? "🔄 Repetir Test"')) {
    content = content.replace(
      /(🚀 Hacer Test \{test\.numero\})/,
      `{result ? "🔄 Repetir Test" : "🚀 Hacer Test"} {test.numero}`
    );
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Actualizado página tema: ${filePath}`);
}

// Ejecutar el script
function main() {
  const testDir = './app/es/auxiliar-administrativo-estado/test';
  
  if (!fs.existsSync(testDir)) {
    console.error('❌ No se encontró el directorio de tests');
    return;
  }
  
  // Procesar TestClient.js files
  const testFiles = findTestClientFiles(testDir);
  console.log(`🔍 Encontrados ${testFiles.length} archivos TestClient.js`);
  testFiles.forEach(addCacheToTestClient);
  
  // Procesar páginas de temas
  const themePages = findThemePages(testDir);
  console.log(`🔍 Encontradas ${themePages.length} páginas de temas`);
  themePages.forEach(addCacheToThemePage);
  
  console.log(`\n🎉 ¡Completado! Se han actualizado ${testFiles.length} tests y ${themePages.length} páginas con caché de resultados.`);
}

main();
