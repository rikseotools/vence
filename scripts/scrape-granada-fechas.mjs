#!/usr/bin/env node
/**
 * Script para buscar disponibilidad del Parador de Granada en varias fechas
 */

import { connect } from 'puppeteer-real-browser';

const FECHAS_A_PROBAR = [
  { llegada: '21', salida: '22', mes: 'febrero' },
  { llegada: '22', salida: '23', mes: 'febrero' },
  { llegada: '28', salida: '1', mes: 'febrero', mesSalida: 'marzo' },
  { llegada: '7', salida: '8', mes: 'marzo' },
  { llegada: '8', salida: '9', mes: 'marzo' },
  { llegada: '14', salida: '15', mes: 'marzo' },
  { llegada: '15', salida: '16', mes: 'marzo' },
  { llegada: '21', salida: '22', mes: 'marzo' },
  { llegada: '22', salida: '23', mes: 'marzo' },
  { llegada: '28', salida: '29', mes: 'marzo' },
];

async function buscarGranada() {
  console.log('🏰 Buscando disponibilidad: PARADOR DE GRANADA (La Alhambra)');
  console.log('📅 Probando varias fechas de febrero y marzo 2026\n');

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

    const resultados = [];

    for (const fecha of FECHAS_A_PROBAR) {
      console.log(`\n📅 Probando: ${fecha.llegada} ${fecha.mes} - ${fecha.salida} ${fecha.mesSalida || fecha.mes} 2026...`);

      // Ir a la página de reservas
      await page.goto('https://paradores.es/es/reservas/parador', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });
      await randomDelay(2000, 3000);

      // Aceptar cookies si aparecen
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const aceptar = btns.find(b => b.textContent && b.textContent.includes('ACEPTAR'));
        if (aceptar) aceptar.click();
      });
      await randomDelay(1500, 2500);

      // Saltar login si aparece
      await page.evaluate(() => {
        const btn = document.querySelector('#edit-next');
        if (btn) btn.click();
      });
      await randomDelay(1500, 2500);

      // Configurar fechas
      const arrivalInput = await page.$('#booking-input-arrival, .booking-arrival');
      if (arrivalInput) {
        await arrivalInput.click();
        await randomDelay(1000, 1500);

        // Navegar al mes correcto
        const mesActual = fecha.mes === 'febrero' ? 1 : 2; // Cuántos clics en "siguiente"
        for (let i = 0; i < mesActual; i++) {
          const nextBtn = await page.$('.ui-datepicker-next:not(.ui-state-disabled)');
          if (nextBtn) {
            await nextBtn.click();
            await randomDelay(400, 600);
          }
        }

        // Seleccionar día de llegada
        const days = await page.$$('.ui-datepicker:not([style*="display: none"]) .ui-datepicker-calendar td:not(.ui-datepicker-unselectable) a');
        for (const day of days) {
          const text = await page.evaluate(el => el.textContent, day);
          if (text === fecha.llegada) {
            await day.click();
            await randomDelay(800, 1200);
            break;
          }
        }
      }

      await randomDelay(1000, 1500);

      // Seleccionar salida
      const departureInput = await page.$('#booking-input-departure, .booking-departure');
      if (departureInput) {
        await departureInput.click();
        await randomDelay(1000, 1500);

        // Si el mes de salida es diferente, navegar
        if (fecha.mesSalida && fecha.mesSalida !== fecha.mes) {
          const nextBtn = await page.$('.ui-datepicker-next:not(.ui-state-disabled)');
          if (nextBtn) {
            await nextBtn.click();
            await randomDelay(400, 600);
          }
        }

        const days2 = await page.$$('.ui-datepicker:not([style*="display: none"]) .ui-datepicker-calendar td:not(.ui-datepicker-unselectable) a');
        for (const day of days2) {
          const text = await page.evaluate(el => el.textContent, day);
          if (text === fecha.salida) {
            await day.click();
            await randomDelay(800, 1200);
            break;
          }
        }
      }

      // Escribir Granada
      await page.evaluate(() => {
        const input = document.querySelector('#edit-search-parador');
        if (input) {
          input.value = '';
          input.focus();
        }
      });
      await randomDelay(500, 800);

      await page.keyboard.type('Parador de Granada', { delay: 50 });
      await randomDelay(2500, 3500);

      // Enter para seleccionar
      await page.keyboard.press('Enter');
      await randomDelay(2000, 3000);

      // Clic en RESERVAR
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
        await randomDelay(3000, 4000);

        // Verificar disponibilidad
        const estado = await page.evaluate(() => {
          const body = document.body.textContent || '';

          if (body.includes('no tiene habitaciones disponibles') ||
              body.includes('No hay disponibilidad')) {
            return { disponible: false };
          }

          // Buscar botón continuar (significa que hay disponibilidad)
          const btnContinuar = document.querySelector('#edit-next');
          if (btnContinuar) {
            return { disponible: true, necesitaContinuar: true };
          }

          return { disponible: false };
        });

        if (estado.disponible && estado.necesitaContinuar) {
          // Hacer clic en continuar sin iniciar sesión
          await page.evaluate(() => {
            const btn = document.querySelector('#edit-next');
            if (btn) btn.click();
          });
          await randomDelay(4000, 6000);

          // Extraer precios
          const precios = await page.evaluate(() => {
            const body = document.body.textContent || '';
            const matches = body.match(/(\d{2,3})[,.]?\d{0,2}\s*€/g) || [];
            const validos = matches.filter(p => {
              const n = parseInt(p);
              return n >= 100 && n <= 800;
            });
            return [...new Set(validos)].slice(0, 5);
          });

          console.log(`   ✅ DISPONIBLE - Precios: ${precios.join(', ')}`);
          resultados.push({
            fecha: `${fecha.llegada}-${fecha.salida} ${fecha.mesSalida || fecha.mes}`,
            precios
          });

          await page.screenshot({ path: `/tmp/granada-${fecha.llegada}-${fecha.mes}.png` });
        } else {
          console.log(`   ❌ Sin disponibilidad`);
        }
      }
    }

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMEN - PARADOR DE GRANADA (La Alhambra)');
    console.log('='.repeat(60));

    if (resultados.length > 0) {
      console.log('\n✅ FECHAS CON DISPONIBILIDAD:\n');
      for (const r of resultados) {
        console.log(`   📅 ${r.fecha} 2026`);
        console.log(`      💰 Precios: ${r.precios.join(', ')}`);
      }
    } else {
      console.log('\n❌ No hay disponibilidad en ninguna de las fechas probadas');
      console.log('   Prueba fechas más alejadas o contacta: 91 374 25 00');
    }

    console.log('\n' + '='.repeat(60));

    // Mantener navegador abierto
    console.log('\n🖥️  Navegador abierto 15s...');
    await delay(15000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

buscarGranada();
