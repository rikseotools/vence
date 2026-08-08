require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const APPLY = process.argv.includes('--apply');
const ART = '2fd741a4-26af-439c-a8c1-b2507f6e4cb5';

const FILA = '| Tamaño máximo de un campo Texto largo (programación) | 1 gigabyte |';
const NUEVA = FILA + '\n| Caracteres que un control de formulario o informe puede mostrar de un campo Texto largo | **64.000 caracteres** |';
const ANCLA = 'posiblemente dividiendo la información en tablas relacionadas).';
const PARRAFO = ANCLA + '\n\nNo debe confundirse el límite de **almacenamiento** con el de **visualización**: un campo Texto largo puede contener hasta un gigabyte de texto, aunque los controles de formularios e informes solo pueden mostrar los primeros 64.000 caracteres.';

(async () => {
  const [a] = await sql`SELECT content FROM articles WHERE id=${ART}`;
  let c = a.content;
  if (c.includes('64.000')) { console.log('YA APLICADO'); return await sql.end(); }
  if (c.split(FILA).length !== 2 || c.split(ANCLA).length !== 2) { console.log('❌ ancla no única'); return await sql.end(); }
  c = c.replace(FILA, NUEVA).replace(ANCLA, PARRAFO);
  console.log('longitud', a.content.length, '->', c.length);
  if (!APPLY) { console.log('DRY-RUN (pasa --apply)'); return await sql.end(); }
  await sql`UPDATE articles SET content=${c}, updated_at=now() WHERE id=${ART}`;
  console.log('✅ artículo actualizado');
  await sql.end();
})();
