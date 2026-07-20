// Cierra la completitud de las 2 leyes CyL tocadas en cubo3 GrupoA, importando VERBATIM
// (fuente oficial, verificado) los artículos que aún faltaban del articulado operativo.
//   Ley 13/1990 CES CyL (BOE-A-1991-2826): art.15 (Los Vicepresidentes)
//   Decreto 12/2024 CyL (BOCyL): arts 1 (Objeto), 6 (Calidad), 12 (Info y asistencia), 13 (Contacta)
// + completa el topic_scope del Decreto a la ley entera (epígrafe = Servicio 012 completo).
const fs = require('fs');
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres');
const APPLY = process.argv.includes('--apply');
function getUrl(){ return process.env.DATABASE_URL || fs.readFileSync('/home/manuel/Documentos/github/vence/.env.local','utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim(); }

const LEY = 'b666ffed';
const DEC = '74f74ab0-c391-4985-8d52-12c1bc19f851';

const LEY_ART15 = `1. El Pleno del Consejo elegirá, de entre sus miembros, dos Vicepresidentes, que deberán pertenecer a dos grupos de representación distintos al que pertenezca el Presidente.

2. Son funciones propias de los Vicepresidentes:

a) Sustituir al Presidente en los casos en que dicho cargo estuviera vacante y en los de ausencia o enfermedad. La sustitución se llevará a cabo en la forma que se establezca en el reglamento de organización y funcionamiento del Consejo.

b) Colaborar con el Presidente en todos los asuntos para los que sean requeridos.

c) Cualesquiera otras que les sean expresamente delegadas o encomendadas por el Pleno del Consejo.

3. Los Vicepresidentes no tendrán derecho a retribución económica, ni percibirán indemnización alguna, incluidas dietas y gastos de locomoción, por el desempeño de su cargo.`;

const DEC_ART1 = `El presente decreto tiene por objeto la regulación del servicio de información y atención a la ciudadanía a través del Servicio 012 de la Administración de la Comunidad Autónoma de Castilla y León, y la gestión de su sede electrónica.`;
const DEC_ART6 = `1. El Servicio 012 mantendrá su compromiso con la calidad y mejora continua de los servicios que presta a la ciudadanía.

2. Con el fin de conocer la opinión ciudadana y mejorar la calidad de los servicios, se podrán realizar estudios o encuestas de análisis de satisfacción, necesidades y expectativas ciudadanas sobre el servicio.

Los resultados de estos estudios o encuestas serán puestos a disposición de la ciudadanía como elemento de transparencia y de calidad, para garantizar el acceso a la información del sector público, para lo que estarán disponibles en formatos reutilizables y se deberán tener en cuenta a efectos de la mejora continua del sistema de información y atención a la ciudadanía que se presta a través del 012.

3. El Servicio 012 dispondrá de una Carta de Servicios como documento compresivo de toda la información sobre los servicios prestados, los derechos de las personas usuarias en relación con ellos, los compromisos y estándares de calidad en su prestación, así como los indicadores de gestión que permiten seguir el grado de cumplimiento de dichos compromisos.`;
const DEC_ART12 = `El Servicio 012 prestará apoyo a las personas usuarias de la Sede electrónica de Castilla y León, guiándoles en su contenido y prestándoles la asistencia electrónica que precisen.`;
const DEC_ART13 = `Se ofrecerá a las personas usuarias de la Sede electrónica, que puedan contactar directamente con las unidades administrativas competentes de cada contenido, mediante un acceso directo en la publicación (Contacta).`;

(async () => {
  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const ley = (await sql`SELECT id FROM laws WHERE id::text LIKE ${LEY+'%'}`)[0].id;
    const inserts = [
      [ley, '15', 'Los Vicepresidentes', LEY_ART15, '1990-11-28'],
      [DEC, '1',  'Objeto', DEC_ART1, '2024-06-27'],
      [DEC, '6',  'Calidad y mejora continua de la información a la ciudadanía', DEC_ART6, '2024-06-27'],
      [DEC, '12', 'Información y asistencia técnica', DEC_ART12, '2024-06-27'],
      [DEC, '13', 'Acceso directo: Contacta', DEC_ART13, '2024-06-27'],
    ];
    // pre-check
    for (const [lid,num] of inserts) {
      const ex = await sql`SELECT 1 FROM articles WHERE law_id::text LIKE ${lid.slice(0,8)+'%'} AND article_number=${num} AND is_active`;
      console.log(`  ${lid===ley?'Ley 13/1990':'Decreto 12/2024'} art.${num}: ${ex.length?'YA EXISTE (skip)':'a importar'}`);
    }
    if (!APPLY) { console.log('\n(DRY-RUN — pasa --apply)'); await sql.end(); return; }

    await sql.begin(async (tx) => {
      for (const [lid,num,title,body,mod] of inserts) {
        await tx`INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified, verification_date, last_modification_date, embedding_stale)
          VALUES (${lid}, ${num}, ${title}, ${body}, true, true, CURRENT_DATE, ${mod}, true)
          ON CONFLICT DO NOTHING`;
      }
      // scope Decreto → ley entera (arts 1..14)
      await tx`UPDATE topic_scope SET article_numbers = (
          SELECT array(SELECT DISTINCT unnest(article_numbers || ARRAY['1','6','12','13']))
        ) WHERE law_id=${DEC}`;
    });

    // verificación final
    for (const [name,id] of [['Ley 13/1990','b666ffed'],['Decreto 12/2024','74f74ab0']]) {
      const arts = await sql`SELECT article_number FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.id::text LIKE ${id+'%'} AND a.is_active ORDER BY (article_number ~ '^[0-9]+$') DESC, length(article_number), article_number`;
      console.log(`\n${name}: ${arts.length} arts → ${arts.map(a=>a.article_number).join(', ')}`);
    }
    const sc = await sql`SELECT t.position_type, t.topic_number, ts.article_numbers FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id WHERE ts.law_id=${DEC}`;
    console.log('\nScope Decreto 12/2024:'); sc.forEach(s=>console.log(`  ${s.position_type} T${s.topic_number} = ${JSON.stringify(s.article_numbers.sort((a,b)=>(+a||99)-(+b||99)))}`));
  } catch (e) { console.error('❌', e.message); process.exitCode=1; }
  finally { await sql.end(); }
})();
