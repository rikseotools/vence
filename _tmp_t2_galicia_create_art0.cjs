require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STRUCTURE_CONTENT = `ESTRUCTURA COMPLETA DEL ESTATUTO DE AUTONOMÍA DE GALICIA (LO 1/1981, de 6 de abril):

PREÁMBULO

TÍTULO PRELIMINAR (Arts. 1-8): Galicia como nacionalidad histórica, territorio, condición política de gallegos, derechos fundamentales, lengua (gallego como lengua propia, cooficial con el castellano), bandera, Comunidades gallegas fuera de Galicia, sede de las instituciones.

TÍTULO I - DEL PODER GALLEGO (Arts. 9-26):
• Art. 9: Los poderes de la Comunidad Autónoma se ejercen a través del Parlamento, de la Junta o Xunta y de su Presidente.
• Cap. I - Del Parlamento (Arts. 10-14)
  - Art. 10: Funciones del Parlamento de Galicia
  - Art. 11: Composición del Parlamento (sufragio universal, igual, libre, directo y secreto; sistema de representación proporcional)
  - Art. 12: Presidente, Mesa y Diputación Permanente
  - Art. 13: Iniciativa legislativa
  - Art. 14: Valedor do Pobo (creación y organización)
• Cap. II - De la Junta y de su Presidente (Arts. 15-20)
  - Art. 15: Funciones del Presidente de la Junta
  - Art. 16: Composición y naturaleza de la Junta
  - Art. 17: Responsabilidad política de la Junta
  - Art. 18: Inviolabilidad y aforamiento del Presidente y miembros de la Junta
  - Art. 19: Recursos de inconstitucionalidad
  - Art. 20: Competencias de la Comunidad Autónoma en materia institucional
• Cap. III - De la Administración de Justicia en Galicia (Arts. 21-26)
  - Art. 21: Tribunal Superior de Justicia de Galicia
  - Art. 22: Competencia de los órganos jurisdiccionales en Galicia
  - Art. 23: Nombramiento del Presidente del TSJ de Galicia
  - Art. 24: Concursos y oposiciones
  - Art. 25: Resolución de concursos para provisión de plazas
  - Art. 26: Notarios y Registradores

TÍTULO II - DE LAS COMPETENCIAS DE GALICIA (Arts. 27-38): Competencias exclusivas, desarrollo legislativo, ejecución de legislación del Estado, convenios con otras Comunidades Autónomas.

TÍTULO III - DE LA ADMINISTRACIÓN PÚBLICA GALLEGA (Arts. 39-41): Organización administrativa y personal al servicio de la Administración gallega.

TÍTULO IV - DE LA ECONOMÍA Y HACIENDA (Arts. 42-55): Hacienda autónoma, recursos económicos, emisión de deuda pública, tutela financiera sobre los entes locales, tratamiento fiscal.

TÍTULO V - DE LA REFORMA DEL ESTATUTO (Arts. 56-57):
  - Art. 56: Procedimiento ordinario de reforma
  - Art. 57: Procedimiento de reforma especial

DISPOSICIONES:
• Disposiciones Adicionales
• Disposiciones Transitorias
• Disposición Final

TOTAL: 57 artículos + Preámbulo + Disposiciones

DATOS HISTÓRICOS:
• Aprobado por referéndum: 21 de diciembre de 1980
• Aprobado por Ley Orgánica: 1/1981, de 6 de abril
• Publicado en BOE: 28 de abril de 1981
• Entrada en vigor: 28 de abril de 1981`;

(async () => {
  const { data: law } = await supabase.from('laws').select('id').eq('short_name', 'LO 1/1981').single();

  // Check if art 0 already exists
  const { data: existing } = await supabase.from('articles')
    .select('id').eq('law_id', law.id).eq('article_number', '0').maybeSingle();
  if (existing) {
    console.log('Art 0 ya existe:', existing.id);
    process.exit(0);
  }

  const contentHash = crypto.createHash('sha256').update(STRUCTURE_CONTENT.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');

  const { data, error } = await supabase.from('articles').insert({
    law_id: law.id,
    article_number: '0',
    title: 'Estructura del Estatuto de Autonomía de Galicia',
    content: STRUCTURE_CONTENT,
    is_active: true,
    content_hash: contentHash,
  }).select('id').single();

  if (error) {
    console.error('❌', error.message);
    process.exit(1);
  }
  console.log('✅ Art 0 creado:', data.id);
})();
