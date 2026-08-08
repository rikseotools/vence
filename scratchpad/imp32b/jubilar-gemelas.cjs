require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const APPLY = process.argv.includes('--apply');
const ADMIN = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';

// Gemelas activas con enunciado y opciones idénticos pero clave contradictoria (T-408).
// Cada una verificada contra su fuente: Microsoft Support (máscaras de Access, función IGUAL)
// y BOE-A-2007-6115 art. 72.2 (el contenido NO es del art. 71, que es donde estaban vinculadas).
const JUBILAR = [
  { pref: 'a997b705', nota: 'Clave errónea: la máscara >? 90.000.000 >? exige 7 dígitos obligatorios (0), así que rechaza el NIE, que solo tiene 7 dígitos tras la letra inicial; la válida usa dígitos opcionales (9). Duplicada de 26cac6c0, con la clave correcta.' },
  { pref: 'e8d5c1ca', nota: 'Clave errónea: en este enunciado los argumentos SÍ van entre comillas, luego =IGUAL("ejemplo";"ejemplo") devuelve VERDADERO. Su explicación es la de la variante sin comillas. Duplicada de 2b10a3a5, con la clave correcta.' },
  { pref: '63fc8fb3', nota: 'Clave errónea: los argumentos van SIN comillas, luego Excel los lee como nombres inexistentes y devuelve #¿NOMBRE?. Duplicada de 1a6a1dd5, con la clave correcta.' },
  { pref: '6ce0d945', nota: 'Clave errónea: el enunciado pregunta por ">" (mayúsculas) y tanto la clave como la explicación describen "<" (minúsculas). Microsoft: ">" convierte a mayúsculas todos los caracteres que le siguen. Duplicada de 0ad3b52a.' },
  { pref: 'e7a1ad70', nota: 'Clave errónea: el enunciado pregunta por ">" (mayúsculas) y tanto la clave como la explicación describen "<" (minúsculas). Duplicada de 0ad3b52a.' },
  { pref: '7c40e6be', nota: 'Duplicada exacta de 0ad3b52a (misma clave correcta); se conserva 0ad3b52a, cuya explicación cita el carácter y su efecto.' },
  { pref: 'b5831b3a', nota: 'Clave errónea: el art. 72.2 LO 3/2007 termina en «manteniéndose en los restantes extremos la validez y eficacia del contrato»; la opción marcada añade «y sin perjuicio del derecho a la indemnización», que no está en el texto. Duplicada de b49017b3, con la clave literal.' },
];

(async () => {
  for (const { pref, nota } of JUBILAR) {
    const [q] = await sql`SELECT id, lifecycle_state, is_active FROM questions WHERE id::text LIKE ${pref + '%'}`;
    if (!q) { console.log('❌ no encontrada', pref); continue; }
    if (!APPLY) { console.log('DRY', pref, q.lifecycle_state, '→ retired_duplicate'); continue; }
    try {
      await sql`
        SELECT public.transition_question_state(
          ${q.id}::uuid, ${q.lifecycle_state}::text, 'retired_duplicate'::text,
          'admin_duplicate_of'::text, ${ADMIN}::uuid, NULL::uuid, ${nota}::text)`;
      const [after] = await sql`SELECT lifecycle_state, is_active FROM questions WHERE id = ${q.id}`;
      console.log('✅', pref, '→', after.lifecycle_state, '| activa:', after.is_active);
    } catch (e) { console.log('❌', pref, e.message); }
  }
  await sql.end();
})();
