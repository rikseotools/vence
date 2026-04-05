// scripts/seed-detection-sources.js
// Seed inicial de fuentes regionales: estado + 17 CCAA + top 10 ayuntamientos
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const SOURCES = [
  // ESTADO
  { type: 'estado', region: 'Administración General del Estado', boletin: 'BOE', url: 'https://administracion.gob.es/pag_Home/empleoPublico/convocatorias.html' },

  // 17 COMUNIDADES AUTÓNOMAS
  { type: 'ccaa', region: 'Andalucía', boletin: 'BOJA', url: 'https://www.juntadeandalucia.es/organismos/iaap/areas/empleo-publico/procesos-selectivos.html' },
  { type: 'ccaa', region: 'Aragón', boletin: 'BOA', url: 'https://www.aragon.es/-/oposiciones-funcionarios-turno-libre' },
  { type: 'ccaa', region: 'Asturias', boletin: 'BOPA', url: 'https://iaap.asturias.es/web/iaap/procesos-selectivos' },
  { type: 'ccaa', region: 'Islas Baleares', boletin: 'BOIB', url: 'https://www.caib.es/sites/convocatoriesdefeinapublica/es/n/personal_funcionario-85229/' },
  { type: 'ccaa', region: 'Canarias', boletin: 'BOC', url: 'https://www.gobiernodecanarias.org/administracionespublicas/funcionpublica/acceso/convocatorias-en-curso/' },
  { type: 'ccaa', region: 'Cantabria', boletin: 'BOC Cantabria', url: 'https://empleopublico.cantabria.es/convocatorias-abiertas' },
  { type: 'ccaa', region: 'Castilla-La Mancha', boletin: 'DOCM', url: 'https://empleopublico.castillalamancha.es/' },
  { type: 'ccaa', region: 'Castilla y León', boletin: 'BOCyL', url: 'https://empleopublico.jcyl.es/web/jcyl/EmpleoPublico/es/Plantilla100/1284310609435/_/_/_' },
  { type: 'ccaa', region: 'Cataluña', boletin: 'DOGC', url: 'https://administraciopublica.gencat.cat/ca/funcio-publica/proces-seleccio/cos-auxiliar-cos-c2/' },
  { type: 'ccaa', region: 'Extremadura', boletin: 'DOE', url: 'https://procesoselectivo.juntaex.es/portaljuntaexseleccion/' },
  { type: 'ccaa', region: 'Galicia', boletin: 'DOG', url: 'https://www.xunta.gal/es/funcion-publica/procesos-selectivos/consulta' },
  { type: 'ccaa', region: 'La Rioja', boletin: 'BOR', url: 'https://web.larioja.org/servicios/empleo/procesos-selectivos' },
  { type: 'ccaa', region: 'Comunidad de Madrid', boletin: 'BOCM', url: 'https://www.comunidad.madrid/servicios/empleo/oposiciones' },
  { type: 'ccaa', region: 'Región de Murcia', boletin: 'BORM', url: 'https://empleopublico.carm.es/web/pagina?IDCONTENIDO=1&IDTIPO=200' },
  { type: 'ccaa', region: 'Navarra', boletin: 'BON', url: 'https://www.navarra.es/es/empleo-publico/convocatorias/ingreso' },
  { type: 'ccaa', region: 'País Vasco', boletin: 'BOPV', url: 'https://www.euskadi.eus/empleo-publico/empleo-publico-vasco/web01-a2lanemp/es/' },
  { type: 'ccaa', region: 'Comunidad Valenciana', boletin: 'DOGV', url: 'https://hisenda.gva.es/es/web/recursos-humanos/oferta-ocupacio-publica' },
  { type: 'ccaa', region: 'Ceuta', boletin: 'BOCCE', url: 'https://www.ceuta.es/ceuta/empleo-publico' },
  { type: 'ccaa', region: 'Melilla', boletin: 'BOME', url: 'https://www.melilla.es/melillaportal/contenedor.jsp?seccion=bandeja_recursos_humanos.jsp' },

  // TOP 10 AYUNTAMIENTOS (por población)
  { type: 'ayuntamiento', region: 'Ayto. Madrid', boletin: 'BOAM', url: 'https://www-s.madrid.es/oposiciones/listadoOposiciones.do' },
  { type: 'ayuntamiento', region: 'Ayto. Barcelona', boletin: 'BOPB', url: 'https://ajuntament.barcelona.cat/personesiorganitzacio/es/ofertas-de-trabajo' },
  { type: 'ayuntamiento', region: 'Ayto. Valencia', boletin: 'BOP Valencia', url: 'https://www.valencia.es/cas/tramites/seguimiento-de-oposiciones' },
  { type: 'ayuntamiento', region: 'Ayto. Sevilla', boletin: 'BOP Sevilla', url: 'https://www.sevilla.org/servicios/recursos-humanos/ofertas-de-empleo-publico' },
  { type: 'ayuntamiento', region: 'Ayto. Zaragoza', boletin: 'BOP Zaragoza', url: 'https://www.zaragoza.es/sede/portal/oferta-empleo/convocatoria' },
  { type: 'ayuntamiento', region: 'Ayto. Málaga', boletin: 'BOP Málaga', url: 'https://www.malaga.eu/rrhh/oposiciones' },
  { type: 'ayuntamiento', region: 'Ayto. Murcia', boletin: 'BORM', url: 'https://sede.murcia.es/empleo-publico' },
  { type: 'ayuntamiento', region: 'Ayto. Palma', boletin: 'BOIB', url: 'https://www.palma.cat/portal/PALMA/contenedor1.jsp?seccion=s_fper_d1_v1.jsp&contenido=153&tipo=6&nivel=1400' },
  { type: 'ayuntamiento', region: 'Ayto. Las Palmas de G.C.', boletin: 'BOP LPGC', url: 'https://www.laspalmasgc.es/es/ayuntamiento/empleo-publico/' },
  { type: 'ayuntamiento', region: 'Ayto. Bilbao', boletin: 'BOB', url: 'https://www.bilbao.eus/cs/Satellite?c=Page&cid=3000075302&pagename=Bilbaonet%2FPage%2FBIO_contenidoFinal' },
]

;(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  let inserted = 0
  let skipped = 0
  for (const s of SOURCES) {
    const r = await client.query(
      `INSERT INTO detection_sources (source_type, region_name, boletin_name, listing_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (listing_url) DO NOTHING
       RETURNING id`,
      [s.type, s.region, s.boletin, s.url]
    )
    if (r.rowCount > 0) {
      inserted++
      console.log(`  ✅ ${s.region}`)
    } else {
      skipped++
      console.log(`  ⏭️  ${s.region} (ya existe)`)
    }
  }
  console.log(`\n📊 Insertados: ${inserted} | Saltados: ${skipped} | Total: ${SOURCES.length}`)
  await client.end()
})()
