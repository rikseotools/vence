// scripts/sim/sim-anclas-deteccion.cjs — [T-718]
//
// Demuestra, CONTRA LA BASE DE DATOS REAL, que las anclas habrían parado los tres errores de
// medición del 08/08/2026 antes de que su cifra llegara a ninguna decisión.
//
// No es un test con datos de mentira: coge artículos de verdad del banco, corre sobre ellos los
// criterios que YO usé ese día —los dos malos y el bueno— y comprueba qué dicen las anclas de
// cada uno. Si las anclas fueran decorativas, los tres saldrían igual.
//
// Uso: node scripts/sim/sim-anclas-deteccion.cjs   (SOLO LEE, no escribe nada)

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
const { evaluarAnclas, explicarAnclas } = require('../../lib/calidad/anclas.cjs');

// ── LAS ANCLAS, verificadas a mano el 08/08/2026 ────────────────────────────
// POSITIVA: el art. 11 del Decreto 168/2025 andaluz. Leído: «Bajo la Viceconsejería de
//   Presidencia, gestiona el personal, la organización administrativa…». Es una descripción
//   nuestra en tercera persona, no el articulado del BOJA. Se eligió ADREDE uno que NO empieza
//   por «Atribuye/Regula/Establece», porque es justo el que se le escapaba al criterio malo.
// NEGATIVA: el art. 14 de la Constitución («Los españoles son iguales ante la ley…»). Leído
//   contra el texto oficial: literal. Es la mejor ancla negativa que hay en el banco, porque
//   arrastra 4.606 preguntas activas: marcarla es el error más caro posible.
const ANCLAS = {
  positivos: [{
    clave: ['Decreto 168/2025 Estructura Consejería Sanidad', '11'],
    porque: 'descripción nuestra en 3ª persona, no el articulado del BOJA (verificado a mano 08/08)',
  }],
  negativos: [{
    clave: ['CE', '14'],
    porque: 'la Constitución está importada LITERAL; marcarla arrastraría 4.606 preguntas activas',
  }],
};

// ── LOS TRES CRITERIOS, tal cual se usaron ──────────────────────────────────
const CRITERIOS = [
  {
    nombre: 'malo nº1 — «empieza por un verbo de resumen»',
    queHizo: 'dijo 2 de 21 cuando eran 21 de 21',
    marca: (a) => /^\s*(Atribuye|Regula|Establece|Determina|Recoge|Contempla|Define)\b/i.test(a.content),
  },
  {
    nombre: 'malo nº2 — «no repite la cabecera Artículo N.»',
    queHizo: 'señaló la Constitución entera',
    marca: (a) => !/^\s*Art[íi]culo/.test(a.content),
  },
  {
    nombre: 'malo nº3 — «texto corto, sin cabecera y sin verbos normativos»',
    queHizo: 'mi TERCER intento, el que yo daba por bueno',
    // Parecía razonable: un articulado manda («será», «corresponderá», «podrá») y una ficha
    // nuestra narra. Pues tampoco: el art. 14 CE («Los españoles son iguales ante la ley, sin
    // que pueda prevalecer discriminación alguna…») es corto, no repite cabecera y no usa
    // ninguno de esos verbos. Lo destapó esta misma simulación.
    marca: (a) => Boolean(a.boe_url) && /^https?:/.test(a.boe_url)
      && a.content.length < 700
      && !/^\s*Art[íi]culo/.test(a.content)
      && !/\b(se entender|corresponder|deber[áa]n?|podr[áa]n?|ser[áa]n?|queda[rn]?|tendr[áa]n?)\b/i.test(a.content.slice(0, 260)),
  },
  {
    // CONTROL, y hace falta: sin un criterio que PASE, la simulación no distingue «las anclas
    // protegen» de «las anclas rechazan cualquier cosa». No es un detector — es un oráculo que
    // clasifica bien por construcción, para demostrar que el mecanismo acepta lo correcto.
    control: true,
    nombre: 'CONTROL — oráculo que clasifica bien por construcción',
    queHizo: 'existe para probar que las anclas no rechazan también lo correcto',
    marca: (a) => a.ley === 'Decreto 168/2025 Estructura Consejería Sanidad',
  },
];

const clave = (a) => `${a.ley} · art.${a.article_number}`;

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  // Universo acotado y REAL: el decreto sospechoso entero + la CE + un contraste de leyes bien
  // importadas. Pequeño a propósito: lo que se prueba es el MECANISMO, no el criterio final.
  const { rows: arts } = await c.query(`
    SELECT l.short_name ley, l.boe_url, a.article_number, a.content
      FROM articles a JOIN laws l ON l.id = a.law_id
     WHERE a.is_active AND a.content IS NOT NULL AND length(a.content) > 40
       AND (l.short_name = 'Decreto 168/2025 Estructura Consejería Sanidad'
            OR (l.short_name = 'CE' AND a.article_number IN ('1','14','116','103'))
            OR (l.short_name = 'Ley 8/2008 Galicia' AND a.article_number IN ('68','121')))`);

  if (!arts.length) {
    console.log('❌ NO CONCLUYENTE: no se han podido leer los artículos ancla del banco.');
    await c.end();
    process.exit(1);
  }
  console.log(`universo real: ${arts.length} artículos de ${new Set(arts.map((a) => a.ley)).size} leyes\n`);

  // Traducir las anclas (ley, artículo) a las claves del universo, comprobando que EXISTEN.
  const resolver = (lista) => lista.map((x) => {
    const a = arts.find((r) => r.ley === x.clave[0] && String(r.article_number) === x.clave[1]);
    return a ? { id: clave(a), porque: x.porque } : null;
  });
  const positivos = resolver(ANCLAS.positivos);
  const negativos = resolver(ANCLAS.negativos);
  if (positivos.includes(null) || negativos.includes(null)) {
    // Un ancla que ya no existe invalida la simulación: no se aprueba en falso.
    console.log('❌ NO CONCLUYENTE: alguna ancla ya no está en el banco. Revisarla antes de seguir.');
    await c.end();
    process.exit(1);
  }
  const anclas = { positivos, negativos };
  console.log(`ancla POSITIVA: ${positivos[0].id}`);
  console.log(`ancla NEGATIVA: ${negativos[0].id}\n`);

  let malosCazados = 0, malosQueSeEscaparon = 0, controlOk = null;
  for (const crit of CRITERIOS) {
    const marcados = arts.filter(crit.marca).map(clave);
    const r = evaluarAnclas(marcados, anclas);
    console.log(`── ${crit.nombre}`);
    console.log(`   (${crit.queHizo}) · marca ${marcados.length} de ${arts.length}`);
    if (r.ok) {
      console.log('   ✅ las anclas lo dan por bueno');
      if (crit.control) controlOk = true;
      else { malosQueSeEscaparon++; console.log('   ⚠️  …pero es uno de los MALOS: las anclas NO lo pararon'); }
    } else {
      console.log(explicarAnclas(crit.nombre, r).split('\n').map((l) => '   ' + l).join('\n'));
      if (crit.control) { controlOk = false; console.log('   ⚠️  …y es el CONTROL: las anclas rechazan hasta lo correcto'); }
      else malosCazados++;
    }
    console.log('');
  }

  // La simulación se autocalifica. Dos condiciones, y las dos hacen falta:
  //   · que pare TODOS los criterios que fallaron de verdad,
  //   · y que DEJE PASAR el control — sin esto, «rechaza todo» daría verde y no probaría nada.
  const malos = CRITERIOS.filter((c) => !c.control).length;
  console.log('── VEREDICTO');
  if (malosCazados === malos && malosQueSeEscaparon === 0 && controlOk === true) {
    console.log(`   ✅ CONCLUYENTE: las anclas pararon los ${malos} criterios que fallaron el 08/08`);
    console.log('      —incluido el TERCERO, que yo daba por bueno— y dejaron pasar el control.');
    console.log('      Sin ellas, los tres habrían publicado su cifra como si fuera una medición.');
    await c.end();
    process.exit(0);
  }
  if (controlOk !== true) {
    console.log('   ❌ NO CONCLUYENTE: el control no pasa, así que este verde no distinguiría');
    console.log('      «las anclas protegen» de «las anclas rechazan cualquier cosa».');
  }
  if (malosQueSeEscaparon) {
    console.log(`   ❌ ${malosQueSeEscaparon} criterio(s) malo(s) pasaron el examen — no protegen lo que dicen.`);
  }
  await c.end();
  process.exit(1);
})();
