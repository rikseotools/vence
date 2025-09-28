// add-timer.cjs
const fs = require('fs');
const path = require('path');

// Función para formatear tiempo
const formatTimeFunction = `
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) {
      return \`\${secs} segundo\${secs !== 1 ? 's' : ''}\`;
    } else if (secs === 0) {
      return \`\${mins} minuto\${mins !== 1 ? 's' : ''}\`;
    } else {
      return \`\${mins} minuto\${mins !== 1 ? 's' : ''} y \${secs} segundo\${secs !== 1 ? 's' : ''}\`;
    }
  };`;

// Función para encontrar y procesar archivos TestClient.js
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

// Función para modificar el contenido del archivo
function addTimerToFile(filePath) {
  console.log(`Procesando: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Añadir startTime al estado inicial
  if (!content.includes('const [startTime, setStartTime]')) {
    content = content.replace(
      'const [answeredQuestions, setAnsweredQuestions] = useState([])',
      `const [answeredQuestions, setAnsweredQuestions] = useState([])
  const [startTime, setStartTime] = useState(Date.now())`
    );
  }
  
  // 2. Añadir función formatTime después de la declaración del config
  if (!content.includes('const formatTime =')) {
    content = content.replace(
      /const config = \{[\s\S]*?\}/,
      (match) => match + formatTimeFunction
    );
  }
  
  // 3. Añadir tiempo en la pantalla de resultados
  if (!content.includes('Tiempo empleado:')) {
    const resultTimeHTML = `
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="text-center">
                  <div className="text-blue-800 font-bold text-lg mb-2">⏱️ Tiempo empleado</div>
                  <div className="text-blue-700 text-xl font-semibold">
                    {formatTime(Math.floor((Date.now() - startTime) / 1000))}
                  </div>
                </div>
              </div>`;
    
    // Buscar donde insertar el tiempo (después del emoji y antes del mensaje de felicitación)
    content = content.replace(
      /(<h2 className="text-4xl font-bold text-gray-800 mb-4">[\s\S]*?<\/h2>)/,
      `$1${resultTimeHTML}`
    );
  }
  
  // 4. Reset startTime en handleRestartTest
  if (!content.includes('setStartTime(Date.now())')) {
    content = content.replace(
      'setAnsweredQuestions([])',
      `setAnsweredQuestions([])
    setStartTime(Date.now())`
    );
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Actualizado: ${filePath}`);
}

// Ejecutar el script
function main() {
  const projectRoot = './app/es/auxiliar-administrativo-estado/test';
  
  if (!fs.existsSync(projectRoot)) {
    console.error('❌ No se encontró el directorio de tests');
    return;
  }
  
  const testFiles = findTestClientFiles(projectRoot);
  
  if (testFiles.length === 0) {
    console.log('⚠️  No se encontraron archivos TestClient.js');
    return;
  }
  
  console.log(`🔍 Encontrados ${testFiles.length} archivos TestClient.js`);
  
  testFiles.forEach(addTimerToFile);
  
  console.log(`\n🎉 ¡Completado! Se han actualizado ${testFiles.length} archivos con la funcionalidad de tiempo.`);
}

main();
