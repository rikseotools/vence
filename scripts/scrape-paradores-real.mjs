#!/usr/bin/env node
/**
 * Script para Paradores - VERSIÓN DIRECTA
 * Va directo a la página de reservas y prueba varios paradores
 */

import { connect } from 'puppeteer-real-browser';

const PARADORES_A_PROBAR = [
  // Castilla y León
  'Parador de Salamanca',
  'Parador de Segovia',
  'Parador de Ávila',
  'Parador de León',
  'Parador de Zamora',
  'Parador de Soria',
  'Parador de Lerma',
  'Parador de Tordesillas',
  'Parador de Villafranca del Bierzo',
  'Parador de Ciudad Rodrigo',
  'Parador de Gredos',
  'Parador de Cervera de Pisuerga',
  // Madrid y alrededores
  'Parador de Chinchón',
  'Parador de Alcalá de Henares',
  'Parador de Sigüenza',
  // Castilla-La Mancha
  'Parador de Toledo',
  'Parador de Cuenca',
  'Parador de Almagro',
  'Parador de Oropesa',
  'Parador de Albacete',
  'Parador de Manzanares',
  // Andalucía
  'Parador de Granada',
  'Parador de Córdoba',
  'Parador de Sevilla',
  'Parador de Málaga',
  'Parador de Cádiz',
  'Parador de Ronda',
  'Parador de Úbeda',
  'Parador de Jaén',
  'Parador de Carmona',
  'Parador de Arcos de la Frontera',
  'Parador de Antequera',
  'Parador de Mojácar',
  'Parador de Mazagón',
  'Parador de Ayamonte',
  'Parador de Cazorla',
  'Parador de Nerja',
  // Galicia
  'Parador de Santiago de Compostela',
  'Parador de Pontevedra',
  'Parador de Baiona',
  'Parador de Tui',
  'Parador de Monforte de Lemos',
  'Parador de Ribadeo',
  'Parador de Ferrol',
  'Parador de Verín',
  'Parador de Cambados',
  'Parador Costa da Morte',
  // Asturias y Cantabria
  'Parador de Gijón',
  'Parador de Cangas de Onís',
  'Parador de Corias',
  'Parador de Santillana del Mar',
  'Parador de Fuente Dé',
  'Parador de Limpias',
  // País Vasco y Navarra
  'Parador de Hondarribia',
  'Parador de Argómaniz',
  'Parador de Olite',
  // Aragón
  'Parador de Teruel',
  'Parador de Alcañiz',
  'Parador de Bielsa',
  'Parador de Sos del Rey Católico',
  // Cataluña
  'Parador de Cardona',
  'Parador de Vic-Sau',
  'Parador de Tortosa',
  'Parador de Aiguablava',
  'Parador de Artíes',
  // Valencia y Murcia
  'Parador de Jávea',
  'Parador de El Saler',
  'Parador de Benicarló',
  'Parador de Lorca',
  // Extremadura
  'Parador de Mérida',
  'Parador de Cáceres',
  'Parador de Plasencia',
  'Parador de Trujillo',
  'Parador de Zafra',
  'Parador de Guadalupe',
  'Parador de Jarandilla de la Vera',
  // La Rioja
  'Parador de Santo Domingo de la Calzada',
  'Parador de Calahorra',
  // Canarias
  'Parador de La Palma',
  'Parador de Las Cañadas del Teide',
  'Parador de La Gomera',
  'Parador de El Hierro',
  'Parador de Cruz de Tejeda',
  'Parador de Fuerteventura',
  // Baleares
  // Ceuta y Melilla
  'Parador de Ceuta',
  'Parador de Melilla',
];

async function scrapeParadores() {
  console.log('🏨 Paradores.es - BÚSQUEDA DIRECTA');
  console.log('📅 14-15 febrero 2026 (1 noche)');
  console.log(`🔍 Probando ${PARADORES_A_PROBAR.length} paradores\n`);

  let browser, page;

  try {
    console.log('1️⃣  Iniciando Chrome...');
    const response = await connect({
      headless: false,
      turnstile: true,
      fingerprint: true,
      args: ['--start-maximized'],
    });

    browser = response.browser;
    page = response.page;

    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const randomDelay = (min, max) => delay(Math.random() * (max - min) + min);

    // Ir directo a la página de reservas
    console.log('2️⃣  Navegando a página de reservas...');
    await page.goto('https://paradores.es/es/reservas/parador', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await randomDelay(3000, 5000);

    // Aceptar cookies si aparecen
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const aceptar = btns.find(b => b.textContent && b.textContent.includes('ACEPTAR'));
      if (aceptar) aceptar.click();
    });
    await randomDelay(2000, 3000);

    await page.screenshot({ path: '/tmp/p-01-reservas.png' });
    console.log('   📸 /tmp/p-01-reservas.png');

    // Continuar sin iniciar sesión si aparece
    console.log('3️⃣  Continuando sin login...');
    const loginSkipped = await page.evaluate(() => {
      const btn = document.querySelector('#edit-next');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (loginSkipped) {
      console.log('   ✅ Login omitido');
      await randomDelay(3000, 5000);
    }

    await page.screenshot({ path: '/tmp/p-02-form.png' });

    // Configurar fechas: 14/02/2026 - 15/02/2026
    console.log('4️⃣  Configurando fechas...');

    // Hacer clic en el campo de llegada para abrir datepicker
    const arrivalInput = await page.$('#booking-input-arrival, .booking-arrival');
    if (arrivalInput) {
      await arrivalInput.click();
      await randomDelay(1000, 1500);

      // Navegar a febrero (clic en siguiente mes)
      const nextBtn = await page.$('.ui-datepicker-next:not(.ui-state-disabled)');
      if (nextBtn) {
        await nextBtn.click();
        await randomDelay(500, 800);
        console.log('   ➡️ Febrero');
      }

      // Seleccionar día 14
      const days = await page.$$('.ui-datepicker:not([style*="display: none"]) .ui-datepicker-calendar td:not(.ui-datepicker-unselectable) a');
      for (const day of days) {
        const text = await page.evaluate(el => el.textContent, day);
        if (text === '14') {
          await day.click();
          console.log('   ✅ Llegada: 14/02/2026');
          await randomDelay(800, 1200);
          break;
        }
      }
    }

    await randomDelay(1000, 1500);

    // Hacer clic en el campo de salida
    const departureInput = await page.$('#booking-input-departure, .booking-departure');
    if (departureInput) {
      await departureInput.click();
      await randomDelay(1000, 1500);

      // Seleccionar día 15
      const days2 = await page.$$('.ui-datepicker:not([style*="display: none"]) .ui-datepicker-calendar td:not(.ui-datepicker-unselectable) a');
      for (const day of days2) {
        const text = await page.evaluate(el => el.textContent, day);
        if (text === '15') {
          await day.click();
          console.log('   ✅ Salida: 15/02/2026');
          await randomDelay(800, 1200);
          break;
        }
      }
    }

    await page.screenshot({ path: '/tmp/p-03-fechas.png' });
    console.log('   📸 /tmp/p-03-fechas.png');

    // Probar cada parador
    console.log('\n5️⃣  Buscando paradores con disponibilidad...\n');

    const resultados = [];

    for (const parador of PARADORES_A_PROBAR) {
      console.log(`   🔍 Probando: ${parador}...`);

      // Limpiar y escribir nuevo parador
      await page.evaluate(() => {
        const input = document.querySelector('#edit-search-parador');
        if (input) {
          input.value = '';
          input.focus();
        }
      });
      await randomDelay(500, 800);

      // Escribir nombre del parador
      await page.keyboard.type(parador, { delay: 50 });
      await randomDelay(2500, 3500); // Esperar que cargue el autocomplete

      // Seleccionar con Enter (primera opción del desplegable)
      console.log(`      ⌨️ Pulsando Enter para seleccionar...`);
      await page.keyboard.press('Enter');
      await randomDelay(2000, 3000);

      // Hacer clic en botón RESERVAR (dos veces según flujo de la web)
      const reservarClicked = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const reservar = btns.find(b => b.value === 'RESERVAR' || b.textContent.includes('RESERVAR'));
        if (reservar) {
          reservar.click();
          return true;
        }
        return false;
      });

      if (reservarClicked) {
        console.log(`      🔘 Clic en RESERVAR`);
        await randomDelay(3000, 4000);

        // Verificar si hay disponibilidad o necesita continuar
        const estadoPantalla = await page.evaluate(() => {
          const body = document.body.textContent || '';

          // Comprobar si no hay disponibilidad
          if (body.includes('no tiene habitaciones disponibles') ||
              body.includes('No hay disponibilidad')) {
            return { estado: 'sin_disponibilidad' };
          }

          // Comprobar si hay botón "Continuar sin iniciar sesión"
          const btnContinuar = document.querySelector('#edit-next, button[value="Continuar sin iniciar sesión"]');
          if (btnContinuar) {
            return { estado: 'necesita_continuar' };
          }

          return { estado: 'otro' };
        });

        if (estadoPantalla.estado === 'sin_disponibilidad') {
          console.log(`   ❌ ${parador}: Sin disponibilidad`);
          // Volver atrás para siguiente parador
          await page.goBack();
          await randomDelay(2000, 3000);
          continue; // Siguiente parador
        }

        if (estadoPantalla.estado === 'necesita_continuar') {
          console.log(`      🔘 Clic en "Continuar sin iniciar sesión"`);
          await page.evaluate(() => {
            const btn = document.querySelector('#edit-next, button[value="Continuar sin iniciar sesión"]');
            if (btn) btn.click();
          });
          await randomDelay(4000, 6000);
        }
      }

      // Verificar disponibilidad y precios
      const disponibilidad = await page.evaluate(() => {
        const body = document.body.textContent || '';

        // Comprobar de nuevo si no hay disponibilidad
        if (body.includes('no tiene habitaciones disponibles') ||
            body.includes('No hay disponibilidad') ||
            body.includes('sin disponibilidad')) {
          return { disponible: false, mensaje: 'Sin disponibilidad' };
        }

        // Buscar precios de habitaciones
        const precios = body.match(/(\d{2,3})[,.]?\d{0,2}\s*€/g) || [];
        const preciosValidos = precios.filter(p => {
          const n = parseInt(p);
          return n >= 70 && n <= 500;
        });

        // Buscar tipos de habitación
        const habitaciones = body.match(/Habitación[^€]*\d+[,.]?\d*\s*€/gi) || [];

        return {
          disponible: preciosValidos.length > 0 || habitaciones.length > 0,
          precios: [...new Set(preciosValidos)].slice(0, 5),
          habitaciones: habitaciones.slice(0, 3)
        };
      });

      if (disponibilidad.disponible) {
        console.log(`   ✅ ${parador}: DISPONIBLE`);
        if (disponibilidad.precios.length > 0) {
          console.log(`      💰 Precios: ${disponibilidad.precios.join(', ')}`);
        }
        if (disponibilidad.habitaciones && disponibilidad.habitaciones.length > 0) {
          disponibilidad.habitaciones.forEach(h => console.log(`      🛏️  ${h.substring(0, 60)}`));
        }
        resultados.push({ parador, precios: disponibilidad.precios });

        // Tomar screenshot
        await page.screenshot({ path: `/tmp/p-${parador.replace(/\s+/g, '-')}.png` });
        console.log(`      📸 /tmp/p-${parador.replace(/\s+/g, '-')}.png`);
      } else {
        console.log(`   ❌ ${parador}: Sin disponibilidad`);
      }

      // Volver a la página de reservas para el siguiente parador
      console.log(`      🔄 Volviendo al formulario...`);
      await page.goto('https://paradores.es/es/reservas/parador', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      await randomDelay(2000, 3000);

      // Saltar login si aparece
      await page.evaluate(() => {
        const btn = document.querySelector('#edit-next');
        if (btn) btn.click();
      });
      await randomDelay(1500, 2500);

      // Reconfigurar fechas si se han perdido
      const fechasOk = await page.evaluate(() => {
        const arrival = document.querySelector('#booking-input-arrival, .booking-arrival');
        return arrival && arrival.value && arrival.value.includes('14');
      });

      if (!fechasOk) {
        console.log(`      📅 Reconfigurando fechas...`);
        const arrivalInput = await page.$('#booking-input-arrival, .booking-arrival');
        if (arrivalInput) {
          await arrivalInput.click();
          await new Promise(r => setTimeout(r, 1000));

          // Navegar a febrero
          const nextBtn = await page.$('.ui-datepicker-next:not(.ui-state-disabled)');
          if (nextBtn) {
            await nextBtn.click();
            await new Promise(r => setTimeout(r, 500));
          }

          // Seleccionar día 14
          const days = await page.$$('.ui-datepicker:not([style*="display: none"]) .ui-datepicker-calendar td:not(.ui-datepicker-unselectable) a');
          for (const day of days) {
            const text = await page.evaluate(el => el.textContent, day);
            if (text === '14') {
              await day.click();
              await new Promise(r => setTimeout(r, 800));
              break;
            }
          }
        }

        await new Promise(r => setTimeout(r, 1000));

        // Seleccionar salida día 15
        const departureInput = await page.$('#booking-input-departure, .booking-departure');
        if (departureInput) {
          await departureInput.click();
          await new Promise(r => setTimeout(r, 1000));

          const days2 = await page.$$('.ui-datepicker:not([style*="display: none"]) .ui-datepicker-calendar td:not(.ui-datepicker-unselectable) a');
          for (const day of days2) {
            const text = await page.evaluate(el => el.textContent, day);
            if (text === '15') {
              await day.click();
              await new Promise(r => setTimeout(r, 800));
              break;
            }
          }
        }
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMEN - 14-15 febrero 2026 (1 noche)');
    console.log('='.repeat(60));

    if (resultados.length > 0) {
      console.log('\n💰 PARADORES CON DISPONIBILIDAD:\n');
      for (const r of resultados) {
        console.log(`   🏨 ${r.parador}`);
        if (r.precios.length > 0) {
          console.log(`      Precios: ${r.precios.join(', ')}`);
        }
      }
    } else {
      console.log('\n❌ Ningún parador tiene disponibilidad para esas fechas');
      console.log('   Prueba otras fechas o contacta directamente: 91 374 25 00');
    }

    console.log('\n📁 Screenshots: /tmp/p-*.png');
    console.log('='.repeat(60));

    // Mantener navegador abierto
    console.log('\n🖥️  Navegador abierto 30s para inspección...');
    await delay(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

scrapeParadores();
