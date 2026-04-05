-- Migración: Rellenar epígrafes oficiales Ayuntamiento Valencia
-- Fuente: BOP Valencia nº 134 del 12/07/2024 (bases convocatoria 176 plazas Auxiliar Administrativo)
-- URL: https://bop.dival.es/bop/downloads?anuncioNumReg=2024/09825&lang=va
-- Detectado: test de integridad temarioDataQuality.test.ts marcó 21 topics sin epigrafe
-- Creado: 2026-04-05

-- Actualizar programa_url con enlace directo al PDF del BOP
UPDATE oposiciones
SET programa_url = 'https://bop.dival.es/bop/downloads?anuncioNumReg=2024/09825&lang=va'
WHERE slug = 'auxiliar-administrativo-ayuntamiento-valencia';

-- Actualizar los 21 topics con epígrafes oficiales BOP
-- (previamente: epigrafe=NULL, description=copia del title)

UPDATE topics SET
  epigrafe = 'La Constitución Española de 1978. Principios generales. Derechos y libertades fundamentales de los españoles. Su protección. El Defensor del Pueblo.',
  description = 'La Constitución Española de 1978. Principios generales. Derechos y libertades fundamentales de los españoles. Su protección. El Defensor del Pueblo.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 1;

UPDATE topics SET
  epigrafe = 'La Corona. Las Cortes Generales. El Tribunal Constitucional.',
  description = 'La Corona. Las Cortes Generales. El Tribunal Constitucional.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 2;

UPDATE topics SET
  epigrafe = 'El Gobierno y la Administración. Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales: Título I: Disposiciones Generales, Título II: Principios de Protección de Datos; Título III: Derechos de las Personas.',
  description = 'El Gobierno y la Administración. Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales: Título I: Disposiciones Generales, Título II: Principios de Protección de Datos; Título III: Derechos de las Personas.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 3;

UPDATE topics SET
  epigrafe = 'La organización territorial del Estado: Las Comunidades Autónomas. Los Estatutos de Autonomía. Especial referencia al Estatuto de Autonomía de la Comunidad Valenciana.',
  description = 'La organización territorial del Estado: Las Comunidades Autónomas. Los Estatutos de Autonomía. Especial referencia al Estatuto de Autonomía de la Comunidad Valenciana.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 4;

UPDATE topics SET
  epigrafe = 'Fuentes del derecho público. La Ley: sus clases. Otras fuentes del derecho público.',
  description = 'Fuentes del derecho público. La Ley: sus clases. Otras fuentes del derecho público.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 5;

UPDATE topics SET
  epigrafe = 'El procedimiento administrativo. Principios generales. Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas.',
  description = 'El procedimiento administrativo. Principios generales. Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 6;

UPDATE topics SET
  epigrafe = 'Fases del procedimiento administrativo general. Terminación. El silencio administrativo. Ejecución de los actos administrativos.',
  description = 'Fases del procedimiento administrativo general. Terminación. El silencio administrativo. Ejecución de los actos administrativos.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 7;

UPDATE topics SET
  epigrafe = 'Teoría de la validez de los actos administrativos. Convalidación. Revisión de oficio. Los recursos administrativos: Clases. El recurso contencioso-administrativo.',
  description = 'Teoría de la validez de los actos administrativos. Convalidación. Revisión de oficio. Los recursos administrativos: Clases. El recurso contencioso-administrativo.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 8;

UPDATE topics SET
  epigrafe = 'La Ley de Prevención de Riesgos Laborales.',
  description = 'La Ley de Prevención de Riesgos Laborales.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 9;

UPDATE topics SET
  epigrafe = 'La Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público. La organización administrativa. Principios. Competencia. Jerarquía y coordinación. Descentralización. Desconcentración. Delegación. Avocación.',
  description = 'La Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público. La organización administrativa. Principios. Competencia. Jerarquía y coordinación. Descentralización. Desconcentración. Delegación. Avocación.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 10;

UPDATE topics SET
  epigrafe = 'Régimen Local Español. Principios constitucionales. La Provincia. Competencias de las Provincias. Órganos de las Provincias: atribuciones.',
  description = 'Régimen Local Español. Principios constitucionales. La Provincia. Competencias de las Provincias. Órganos de las Provincias: atribuciones.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 11;

UPDATE topics SET
  epigrafe = 'El Municipio. El término municipal y su población. El empadronamiento. Consideración especial del vecino. Información y participación ciudadana.',
  description = 'El Municipio. El término municipal y su población. El empadronamiento. Consideración especial del vecino. Información y participación ciudadana.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 12;

UPDATE topics SET
  epigrafe = 'Competencias municipales. Los órganos municipales: atribuciones de los distintos órganos.',
  description = 'Competencias municipales. Los órganos municipales: atribuciones de los distintos órganos.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 13;

UPDATE topics SET
  epigrafe = 'Ordenanzas y Reglamentos de las Entidades Locales. Clases. Procedimiento de elaboración y aprobación.',
  description = 'Ordenanzas y Reglamentos de las Entidades Locales. Clases. Procedimiento de elaboración y aprobación.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 14;

UPDATE topics SET
  epigrafe = 'Régimen de funcionamiento de los órganos colegiados locales. Convocatoria y Orden del Día. Requisitos de constitución. Votaciones. Actas y certificados de acuerdos.',
  description = 'Régimen de funcionamiento de los órganos colegiados locales. Convocatoria y Orden del Día. Requisitos de constitución. Votaciones. Actas y certificados de acuerdos.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 15;

UPDATE topics SET
  epigrafe = 'Personal al servicio de la Administración Local. La Función Pública Local. Clases de funcionarios. Personal no funcionario. Derechos y deberes de los funcionarios públicos locales. Incompatibilidades. Régimen disciplinario.',
  description = 'Personal al servicio de la Administración Local. La Función Pública Local. Clases de funcionarios. Personal no funcionario. Derechos y deberes de los funcionarios públicos locales. Incompatibilidades. Régimen disciplinario.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 16;

UPDATE topics SET
  epigrafe = 'Principios generales de la contratación del sector público. Clases de contratos de las administraciones públicas. Procedimientos de selección del contratista. Prerrogativas de la administración.',
  description = 'Principios generales de la contratación del sector público. Clases de contratos de las administraciones públicas. Procedimientos de selección del contratista. Prerrogativas de la administración.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 17;

UPDATE topics SET
  epigrafe = 'Procedimiento de otorgamiento de licencias. El servicio público en la esfera local. Los modos de gestión de los servicios públicos.',
  description = 'Procedimiento de otorgamiento de licencias. El servicio público en la esfera local. Los modos de gestión de los servicios públicos.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 18;

UPDATE topics SET
  epigrafe = 'Haciendas Locales. Clasificación de los ingresos. Las ordenanzas fiscales.',
  description = 'Haciendas Locales. Clasificación de los ingresos. Las ordenanzas fiscales.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 19;

UPDATE topics SET
  epigrafe = 'Marco normativo en materia de Igualdad efectiva de mujeres y hombres y de Protección Integral contra la Violencia de Género. Plan de Igualdad para empleadas y empleados del Ayuntamiento de Valencia.',
  description = 'Marco normativo en materia de Igualdad efectiva de mujeres y hombres y de Protección Integral contra la Violencia de Género. Plan de Igualdad para empleadas y empleados del Ayuntamiento de Valencia.'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 20;

UPDATE topics SET
  epigrafe = 'Plataforma Integral de Administración Electrónica en el Ayuntamiento de Valencia (PIAE).',
  description = 'Plataforma Integral de Administración Electrónica en el Ayuntamiento de Valencia (PIAE).'
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND topic_number = 21;

-- Regenerar descripcion_corta desde el nuevo epigrafe (primera 1-2 oraciones, máx 180 chars)
UPDATE topics
SET descripcion_corta = (
  CASE
    WHEN length(epigrafe) <= 180 THEN epigrafe
    ELSE substring(epigrafe FROM 1 FOR 177) || '...'
  END
)
WHERE position_type = 'auxiliar_administrativo_ayuntamiento_valencia' AND is_active = true;
