// add-cache-safe.cjs
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

// Modificar TestClient.js para guardar resultados (método más seguro)
function addCacheToTestClient(filePath) {
  console.log(`Procesando TestClient: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Extraer tema y test del path
  const pathMatch = filePath.match(/tema-(\d+)\/test-(\d+)/);
  if (!pathMatch) return;
  
  const tema = pathMatch[1];
  const test = pathMatch[2];
  const cacheKey = `test_${tema}_${test}_result`;
  
  // 1. Añadir useState para caché si no existe
  if (!content.includes('const [testResult, setTestResult]')) {
    content = content.replace(
      'const [answeredQuestions, setAnsweredQuestions] = useState([])',
      `const [answeredQuestions, setAnsweredQuestions] = useState([])
  const [testResult, setTestResult] = useState(null)`
    );
  }
  
  // 2. Añadir función para guardar resultado si no existe
  if (!content.includes('const saveTestResult =')) {
    const saveFunction = `
  const saveTestResult = (score, totalQuestions, timeSeconds) => {
    const result = {
      score,
      totalQuestions,
      timeSeconds,
      date: Date.now(),
      percentage: Math.round((score / totalQuestions) * 100)
    };
    localStorage.setItem('${cacheKey}', JSON.stringify(result));
    setTestResult(result);
  };`;
    
    // Insertar después de formatTime
    const formatTimeEnd = content.indexOf('};', content.indexOf('const formatTime ='));
    if (formatTimeEnd !== -1) {
      content = content.slice(0, formatTimeEnd + 2) + saveFunction + content.slice(formatTimeEnd + 2);
    }
  }
  
  // 3. Añadir useEffect para cargar caché si no existe
  if (!content.includes('useEffect(')) {
    const useEffectCode = `
  useEffect(() => {
    try {
      const cached = localStorage.getItem('${cacheKey}');
      if (cached) {
        setTestResult(JSON.parse(cached));
      }
    } catch (e) {
      // Ignorar errores
    }
  }, []);`;
    
    // Insertar después de los imports
    const importEnd = content.lastIndexOf("import");
    const lineEnd = content.indexOf('\n', importEnd);
    content = content.slice(0, lineEnd + 1) + useEffectCode + content.slice(lineEnd + 1);
    
    // Añadir import de useEffect si no existe
    if (!content.includes('useEffect')) {
      content = content.replace(
        "import { useState } from 'react'",
        "import { useState, useEffect } from 'react'"
      );
    }
  }
  
  // 4. Llamar a saveTestResult en pantalla de resultados (método más seguro)
  if (!content.includes('saveTestResult(score, questions.length')) {
    // Buscar la línea específica donde está el emoji de resultado
    const emojiLine = 'score >= Math.ceil(questions.length * 0.8) ? \'🏆\' :';
    if (content.includes(emojiLine)) {
      content = content.replace(
        emojiLine,
        `(() => {
                saveTestResult(score, questions.length, Math.floor((Date.now() - startTime) / 1000));
                return score >= Math.ceil(questions.length * 0.8) ? '🏆' :`
      );
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Actualizado TestClient: ${filePath}`);
}

// Ejecutar el script solo para TestClient.js
function main() {
  const testDir = './app/es/auxiliar-administrativo-estado/test';
  
  if (!fs.existsSync(testDir)) {
    console.error('❌ No se encontró el directorio de tests');
    return;
  }
  
  // Solo procesar TestClient.js files (más seguro)
  const testFiles = findTestClientFiles(testDir);
  console.log(`🔍 Encontrados ${testFiles.length} archivos TestClient.js`);
  testFiles.forEach(addCacheToTestClient);
  
  console.log(`\n✅ Completado! Se han actualizado ${testFiles.length} archivos TestClient.js para guardar resultados en caché.`);
  console.log(`\n📝 Nota: Las páginas de temas se actualizarán manualmente para evitar errores de sintaxis.`);
}

main();
