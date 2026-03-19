// Script para capturar convocatorias y supuestos de OpositaTest
// Usa Playwright para extraer JWT y hacer las peticiones

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');
const OUTPUT_DIR = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tramitacion-procesal';

async function main() {
  console.log('🚀 Iniciando captura de datos de OpositaTest...\n');

  // Detectar Chrome
  const { execSync } = require('child_process');
  let chromePath;
  try {
    chromePath = execSync('which google-chrome 2>/dev/null').toString().trim();
  } catch (e) {
    chromePath = '/usr/bin/google-chrome';
  }

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    executablePath: chromePath,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await context.newPage();
  let capturedJWT = null;
  const capturedData = {
    convocatorias: null,
    supuestos: null,
    testsGuardados: null
  };

  // Interceptar requests para capturar JWT y datos
  page.on('request', request => {
    const auth = request.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      capturedJWT = auth.replace('Bearer ', '');
      fs.writeFileSync(path.join(__dirname, 'jwt-token.txt'), capturedJWT);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    try {
      if (url.includes('/exams') && url.includes('previousCall')) {
        capturedData.convocatorias = await response.json();
        console.log('✅ Capturadas convocatorias:', capturedData.convocatorias.resources?.length || 0);
      }
      if (url.includes('/exams') && url.includes('alleged')) {
        capturedData.supuestos = await response.json();
        console.log('✅ Capturados supuestos:', capturedData.supuestos.resources?.length || 0);
      }
      if (url.includes('/tests/saved')) {
        capturedData.testsGuardados = await response.json();
        console.log('✅ Capturados tests guardados:', capturedData.testsGuardados.resources?.length || 0);
      }
    } catch (e) {}
  });

  // Navegar al configurador de test
  console.log('📄 Navegando al configurador de test...');
  await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7', {
    waitUntil: 'networkidle'
  });

  // Esperar un poco para que carguen los datos
  await page.waitForTimeout(3000);

  // Click en "Convocatorias anteriores" para cargar la lista
  console.log('🔍 Buscando pestaña de Convocatorias...');
  try {
    const convocatoriasTab = await page.$('text=Convocatorias anteriores');
    if (convocatoriasTab) {
      await convocatoriasTab.click();
      await page.waitForTimeout(2000);
      console.log('   Clicked en Convocatorias anteriores');
    }
  } catch (e) {
    console.log('   No se encontró pestaña de convocatorias');
  }

  // Click en "Supuesto Práctico" para cargar la lista
  console.log('🔍 Buscando pestaña de Supuestos...');
  try {
    const supuestosTab = await page.$('text=Supuesto Práctico');
    if (supuestosTab) {
      await supuestosTab.click();
      await page.waitForTimeout(2000);
      console.log('   Clicked en Supuesto Práctico');
    }
  } catch (e) {
    console.log('   No se encontró pestaña de supuestos');
  }

  // Esperar a que se capturen los datos
  await page.waitForTimeout(3000);

  // Mostrar resumen
  console.log('\n📊 RESUMEN DE DATOS CAPTURADOS:\n');

  if (capturedJWT) {
    console.log('✅ JWT capturado y guardado en jwt-token.txt');
  }

  if (capturedData.convocatorias?.resources) {
    console.log('\n📋 CONVOCATORIAS ANTERIORES:');
    capturedData.convocatorias.resources.forEach((exam, i) => {
      console.log(`   ${i + 1}. [${exam.id}] ${exam.title}`);
    });
    fs.writeFileSync('/tmp/convocatorias-list.json', JSON.stringify(capturedData.convocatorias, null, 2));
  }

  if (capturedData.supuestos?.resources) {
    console.log('\n📋 SUPUESTOS PRÁCTICOS:');
    capturedData.supuestos.resources.forEach((exam, i) => {
      const opoName = exam.opposition?.name || 'N/A';
      console.log(`   ${i + 1}. [${exam.id}] ${exam.title} (${opoName})`);
    });
    fs.writeFileSync('/tmp/supuestos-list.json', JSON.stringify(capturedData.supuestos, null, 2));
  }

  if (capturedData.testsGuardados?.resources) {
    console.log('\n📋 TESTS GUARDADOS:');
    capturedData.testsGuardados.resources.forEach((test, i) => {
      console.log(`   ${i + 1}. [${test.id}] ${test.exam?.title || 'Sin título'} - Estado: ${test.state}`);
    });
  }

  console.log('\n⏳ El navegador permanecerá abierto para que puedas interactuar...');
  console.log('   Presiona Ctrl+C para cerrar cuando hayas terminado.\n');

  // Mantener abierto
  await new Promise(() => {});
}

main().catch(console.error);
