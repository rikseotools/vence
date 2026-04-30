#!/usr/bin/env node
/**
 * Create all missing laws for Policía Nacional import.
 *
 * Phase 1: Insert laws into BD with BOE URLs
 * Phase 2: Sync articles via API for laws with boe_url
 *
 * Usage: node scripts/_tmp_pn_create_laws.cjs
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ══════════════════════════════════════════════════════════════════
// COMPLETE LAW DEFINITIONS — 120 laws for Policía Nacional
// Each entry: { short_name, name, boe_url (null if no consolidated text), scope, type }
// ══════════════════════════════════════════════════════════════════

const LAWS_TO_CREATE = [
  // ── LEYES ORGÁNICAS ──
  { leyId: '25',  short_name: 'LO 4/2010',   name: 'Ley Orgánica 4/2010, de 20 de mayo, del Régimen disciplinario del Cuerpo Nacional de Policía', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-8115', scope: 'national', type: 'organic_law' },
  { leyId: '44',  short_name: 'LO 9/2015',   name: 'Ley Orgánica 9/2015, de 28 de julio, de Régimen de Personal de la Policía Nacional', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-8468', scope: 'national', type: 'organic_law' },
  { leyId: '199', short_name: 'LO 7/2021',   name: 'Ley Orgánica 7/2021, de 26 de mayo, de protección de datos personales tratados para fines de prevención, detección, investigación y enjuiciamiento de infracciones penales', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2021-8806', scope: 'national', type: 'organic_law' },
  { leyId: '41',  short_name: 'LO 4/1981',   name: 'Ley Orgánica 4/1981, de 1 de junio, de los estados de alarma, excepción y sitio', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1981-12774', scope: 'national', type: 'organic_law' },
  { leyId: '119', short_name: 'LO 11/2002',  name: 'Ley Orgánica 11/2002, de 6 de mayo, reguladora del Centro Nacional de Inteligencia', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2002-8628', scope: 'national', type: 'organic_law' },
  { leyId: '398', short_name: 'LO 2/1989',   name: 'Ley Orgánica 2/1989, de 13 de abril, Procesal Militar', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1989-8819', scope: 'national', type: 'organic_law' },
  { leyId: '621', short_name: 'LO 8/2021',   name: 'Ley Orgánica 8/2021, de 4 de junio, de protección integral a la infancia y la adolescencia frente a la violencia', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2021-9347', scope: 'national', type: 'organic_law' },
  { leyId: '207', short_name: 'LO 9/2021',   name: 'Ley Orgánica 9/2021, de 1 de julio, de aplicación del Reglamento (UE) 2017/1939 - Fiscalía Europea', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2021-11083', scope: 'national', type: 'organic_law' },
  { leyId: '63',  short_name: 'LO 4/1997',   name: 'Ley Orgánica 4/1997, de 4 de agosto, por la que se regula la utilización de videocámaras por las Fuerzas y Cuerpos de Seguridad', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1997-17574', scope: 'national', type: 'organic_law' },
  { leyId: '89',  short_name: 'Ley 27/2003',  name: 'Ley 27/2003, de 31 de julio, reguladora de la Orden de protección de las víctimas de la violencia doméstica', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-15411', scope: 'national', type: 'law' },

  // ── LEYES ORDINARIAS ──
  { leyId: '29',  short_name: 'Ley 12/2009',  name: 'Ley 12/2009, de 30 de octubre, reguladora del derecho de asilo y de la protección subsidiaria', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2009-17242', scope: 'national', type: 'law' },
  { leyId: '53',  short_name: 'Ley 8/2011',   name: 'Ley 8/2011, de 28 de abril, por la que se establecen medidas para la protección de las infraestructuras críticas', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-7630', scope: 'national', type: 'law' },
  { leyId: '204', short_name: 'Ley 7/2021',   name: 'Ley 7/2021, de 20 de mayo, de cambio climático y transición energética', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2021-8447', scope: 'national', type: 'law' },
  { leyId: '181', short_name: 'Ley 20/2011',  name: 'Ley 20/2011, de 21 de julio, del Registro Civil', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-12628', scope: 'national', type: 'law' },
  { leyId: '35',  short_name: 'Ley 50/1981',  name: 'Ley 50/1981, de 30 de diciembre, por la que se regula el Estatuto Orgánico del Ministerio Fiscal', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1982-837', scope: 'national', type: 'law' },
  { leyId: '336', short_name: 'Ley 1/1996',   name: 'Ley 1/1996, de 10 de enero, de Asistencia Jurídica Gratuita', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1996-750', scope: 'national', type: 'law' },
  { leyId: '351', short_name: 'Ley 52/1997',  name: 'Ley 52/1997, de 27 de noviembre, de Asistencia Jurídica al Estado e Instituciones Públicas', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1997-25340', scope: 'national', type: 'law' },
  { leyId: '358', short_name: 'Ley 21/2013',  name: 'Ley 21/2013, de 9 de diciembre, de evaluación ambiental', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2013-12913', scope: 'national', type: 'law' },
  { leyId: '373', short_name: 'Ley 14/2013',  name: 'Ley 14/2013, de 27 de septiembre, de apoyo a los emprendedores y su internacionalización', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2013-10074', scope: 'national', type: 'law' },
  { leyId: '390', short_name: 'Ley 53/1984',  name: 'Ley 53/1984, de 26 de diciembre, de Incompatibilidades del Personal al Servicio de las Administraciones Públicas', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1985-151', scope: 'national', type: 'law' },
  { leyId: '356', short_name: 'Ley 45/2007',  name: 'Ley 45/2007, de 13 de diciembre, para el desarrollo sostenible del medio rural', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-21493', scope: 'national', type: 'law' },
  { leyId: '366', short_name: 'Ley 20/2022',  name: 'Ley 20/2022, de 19 de octubre, de Memoria Democrática', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-17099', scope: 'national', type: 'law' },
  { leyId: '389', short_name: 'Ley 5/1964',   name: 'Ley 5/1964, de 29 de abril, sobre condecoraciones policiales', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1964-7342', scope: 'national', type: 'law' },
  { leyId: '194', short_name: 'Ley 30/1984',  name: 'Ley 30/1984, de 2 de agosto, de medidas para la reforma de la Función Pública', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1984-17387', scope: 'national', type: 'law' },
  { leyId: '196', short_name: 'RDL 4/2000',   name: 'Real Decreto Legislativo 4/2000, de 23 de junio, por el que se aprueba el texto refundido de la Ley sobre Seguridad Social de los Funcionarios Civiles del Estado', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2000-12059', scope: 'national', type: 'royal_decree' },
  { leyId: '85',  short_name: 'LO 2/1979',   name: 'Ley Orgánica 2/1979, de 3 de octubre, del Tribunal Constitucional', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1979-23709', scope: 'national', type: 'organic_law' },
  { leyId: '127', short_name: 'RDL 8/2015 LGSS', name: 'Real Decreto Legislativo 8/2015, de 30 de octubre, por el que se aprueba el texto refundido de la Ley General de la Seguridad Social', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724', scope: 'national', type: 'royal_decree' },
  { leyId: '101', short_name: 'RDL 6/2015',   name: 'Real Decreto Legislativo 6/2015, de 30 de octubre, por el que se aprueba el texto refundido de la Ley sobre Tráfico, Circulación de Vehículos a Motor y Seguridad Vial', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11722', scope: 'national', type: 'royal_decree' },

  // ── REALES DECRETOS ──
  { leyId: '375', short_name: 'Orden INT/28/2013', name: 'Orden INT/28/2013, de 18 de enero, por la que se desarrolla la estructura orgánica y funciones de los Servicios Centrales y Periféricos de la Dirección General de la Policía', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2013-662', scope: 'national', type: 'ministerial_order' },
  { leyId: '64',  short_name: 'RD 1428/2003', name: 'Real Decreto 1428/2003, de 21 de noviembre, por el que se aprueba el Reglamento General de Circulación', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23514', scope: 'national', type: 'royal_decree' },
  { leyId: '34',  short_name: 'RD 704/2011',  name: 'Real Decreto 704/2011, de 20 de mayo, por el que se aprueba el Reglamento de protección de las infraestructuras críticas', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-8849', scope: 'national', type: 'royal_decree' },
  { leyId: '292', short_name: 'RD 220/2022',  name: 'Real Decreto 220/2022, de 29 de marzo, por el que se aprueba el Reglamento por el que se regula el sistema de acogida en materia de protección internacional', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-4978', scope: 'national', type: 'royal_decree' },
  { leyId: '323', short_name: 'RD 853/2022',  name: 'Real Decreto 853/2022, de 11 de octubre, por el que se aprueba el Reglamento de procesos selectivos y de formación de la Policía Nacional', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-16652', scope: 'national', type: 'royal_decree' },
  { leyId: '143', short_name: 'RD 203/1995',  name: 'Real Decreto 203/1995, de 10 de febrero, por el que se aprueba el Reglamento de aplicación de la Ley 5/1984, de 26 de marzo, reguladora del derecho de asilo y de la condición de refugiado', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-6450', scope: 'national', type: 'royal_decree' },
  { leyId: '32',  short_name: 'RD 865/2001',  name: 'Real Decreto 865/2001, de 20 de julio, por el que se aprueba el Reglamento de reconocimiento del estatuto de apátrida', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2001-15163', scope: 'national', type: 'royal_decree' },
  { leyId: '45',  short_name: 'RD 364/1995 PN', name: 'Real Decreto 364/1995, de 10 de marzo, por el que se aprueba el Reglamento General de Ingreso del Personal al servicio de la Administración general del Estado', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-9524', scope: 'national', type: 'royal_decree' },
  { leyId: '252', short_name: 'RD 365/1995',  name: 'Real Decreto 365/1995, de 10 de marzo, por el que se aprueba el Reglamento de Situaciones Administrativas de los Funcionarios Civiles de la AGE', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-9525', scope: 'national', type: 'royal_decree' },
  { leyId: '186', short_name: 'RD 1087/2010', name: 'Real Decreto 1087/2010, de 3 de septiembre, por el que se aprueba el Reglamento que regula las Juntas Locales de Seguridad', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-14138', scope: 'national', type: 'royal_decree' },
  { leyId: '357', short_name: 'RD 1556/1995', name: 'Real Decreto 1556/1995, de 21 de septiembre, de desarrollo y aplicación de la Ley 26/1994, de 29 de septiembre, por la que se regula la situación de segunda actividad en el Cuerpo Nacional de Policía', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-22380', scope: 'national', type: 'royal_decree' },
  { leyId: '364', short_name: 'RD 2669/1998', name: 'Real Decreto 2669/1998, de 11 de diciembre, por el que se aprueba el procedimiento a seguir en materia de rehabilitación de los funcionarios públicos en el ámbito de la AGE', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1998-29744', scope: 'national', type: 'royal_decree' },
  { leyId: '350', short_name: 'RD 203/2010',  name: 'Real Decreto 203/2010, de 26 de febrero, por el que se aprueba el Reglamento de prevención de la violencia, el racismo, la xenofobia y la intolerancia en el deporte', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-3904', scope: 'national', type: 'royal_decree' },
  { leyId: '380', short_name: 'RD 43/2021',   name: 'Real Decreto 43/2021, de 26 de enero, por el que se desarrolla el Real Decreto-ley 12/2018, de 7 de septiembre, de seguridad de las redes y sistemas de información', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2021-1192', scope: 'national', type: 'royal_decree' },
  { leyId: '111', short_name: 'RD 39/1997',   name: 'Real Decreto 39/1997, de 17 de enero, por el que se aprueba el Reglamento de los Servicios de Prevención', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1997-1853', scope: 'national', type: 'royal_decree' },
  { leyId: '130', short_name: 'RD 2822/1998', name: 'Real Decreto 2822/1998, de 23 de diciembre, por el que se aprueba el Reglamento General de Vehículos', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1999-1826', scope: 'national', type: 'royal_decree' },
  { leyId: '131', short_name: 'RD 818/2009',  name: 'Real Decreto 818/2009, de 8 de mayo, por el que se aprueba el Reglamento General de Conductores', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2009-9481', scope: 'national', type: 'royal_decree' },
  { leyId: '310', short_name: 'RD 563/2010',  name: 'Real Decreto 563/2010, de 7 de mayo, por el que se aprueba el Reglamento de artículos pirotécnicos y cartuchería', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-8404', scope: 'national', type: 'royal_decree' },
  { leyId: '341', short_name: 'Decreto 315/1964', name: 'Decreto 315/1964, de 7 de febrero, por el que se aprueba la Ley articulada de Funcionarios Civiles del Estado', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1964-2236', scope: 'national', type: 'royal_decree' },
  { leyId: '17',  short_name: 'RD 2/2006 PRL PN', name: 'Real Decreto 2/2006, de 16 de enero, por el que se establecen normas sobre prevención de riesgos laborales en la actividad de los funcionarios del Cuerpo Nacional de Policía', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2006-829', scope: 'national', type: 'royal_decree' },
  { leyId: '74',  short_name: 'RD 67/2010',   name: 'Real Decreto 67/2010, de 29 de enero, de adaptación de la legislación de Prevención de Riesgos Laborales a la AGE', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-2161', scope: 'national', type: 'royal_decree' },

  // ── ÓRDENES MINISTERIALES Y RESOLUCIONES ──
  { leyId: '140', short_name: 'Orden 22/07/1987', name: 'Orden de 22 de julio de 1987 por la que se aprueba el Reglamento de Organización de los Servicios de la DGP', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1987-18218', scope: 'national', type: 'ministerial_order' },
  { leyId: '88',  short_name: 'Resolución Uniformidad CNP', name: 'Resolución por la que se regula la uniformidad en el Cuerpo Nacional de Policía', boe_url: null, scope: 'national', type: 'resolution' },
  { leyId: '102', short_name: 'RD 1040/1981', name: 'Real Decreto 1040/1981, de 22 de mayo, por el que se establece el régimen electoral del Consejo de Policía', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1981-12776', scope: 'national', type: 'royal_decree' },
  { leyId: '365', short_name: 'RD Condecoraciones PN', name: 'Real Decreto por el que se regulan las Condecoraciones a la Dedicación al Servicio Policial', boe_url: null, scope: 'national', type: 'royal_decree' },
  { leyId: '367', short_name: 'Resolución Uniformidad CNP 2', name: 'Resolución sobre excepciones y particularidades en el uso del uniforme CNP', boe_url: null, scope: 'national', type: 'resolution' },
  { leyId: '388', short_name: 'Resolución Baremo CGM CNP', name: 'Resolución por la que se aprueba el baremo de méritos para la provisión de puestos de trabajo por CGM en el CNP', boe_url: null, scope: 'national', type: 'resolution' },
  { leyId: '363', short_name: 'Orden INT Centro Universitario PN', name: 'Orden por la que se aprueban los Estatutos del Centro Universitario de Formación de la Policía Nacional', boe_url: null, scope: 'national', type: 'ministerial_order' },
  { leyId: '354', short_name: 'Instrucción Conducción DGP', name: 'Instrucción sobre modelo de autorización temporal para la conducción de vehículos de la DGP', boe_url: null, scope: 'national', type: 'instruction' },
  { leyId: '378', short_name: 'RD 2073/1999', name: 'Real Decreto 2073/1999, de 30 de diciembre, por el que se modifica el Reglamento del Registro Central de Personal', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2000-629', scope: 'national', type: 'royal_decree' },

  // ── ESTRUCTURAS ORGÁNICAS MINISTERIALES ──
  { leyId: '166', short_name: 'RD Estructura Min Igualdad', name: 'Real Decreto por el que se desarrolla la estructura orgánica básica del Ministerio de Igualdad', boe_url: null, scope: 'national', type: 'royal_decree' },
  { leyId: '362', short_name: 'RD Estructura Min Inclusión', name: 'Real Decreto por el que se establece la estructura orgánica básica del Ministerio de Inclusión, Seguridad Social y Migraciones', boe_url: null, scope: 'national', type: 'royal_decree' },
  { leyId: '403', short_name: 'RD Estructura Min Transformación Digital', name: 'Real Decreto por el que se establece la estructura orgánica básica del Ministerio para la Transformación Digital y de la Función Pública', boe_url: null, scope: 'national', type: 'royal_decree' },
  { leyId: '404', short_name: 'RD Estructura Min Juventud', name: 'Real Decreto por el que se establece la estructura orgánica básica del Ministerio de Juventud e Infancia', boe_url: null, scope: 'national', type: 'royal_decree' },
  { leyId: '135', short_name: 'RD Estructura Min Derechos Sociales', name: 'Real Decreto por el que se establece la estructura orgánica básica del Ministerio de Derechos Sociales y Agenda 2030', boe_url: null, scope: 'national', type: 'royal_decree' },
  { leyId: '514', short_name: 'RD Estructura Min Transición Ecológica', name: 'Real Decreto por el que se establece la estructura orgánica básica del Ministerio para la Transición Ecológica y el Reto Demográfico', boe_url: null, scope: 'national', type: 'royal_decree' },
  { leyId: '612', short_name: 'RD Estructura Min Inclusión 2', name: 'Real Decreto por el que se establece la estructura orgánica básica del Ministerio de Inclusión, Seguridad Social y Migraciones (2)', boe_url: null, scope: 'national', type: 'royal_decree' },

  // ── PROTOCOLOS E INSTRUCCIONES POLICIALES ──
  { leyId: '490', short_name: 'Instrucción Detención Policial', name: 'Instrucción sobre el Procedimiento Integral de la Detención Policial', boe_url: null, scope: 'national', type: 'instruction' },
  { leyId: '413', short_name: 'Instrucción Detención Policial 2', name: 'Instrucción sobre el Procedimiento Integral de la Detención Policial (complementaria)', boe_url: null, scope: 'national', type: 'instruction' },
  { leyId: '418', short_name: 'Protocolo VioGen', name: 'Protocolo para la valoración y gestión policial del nivel de riesgo de Violencia de Género', boe_url: null, scope: 'national', type: 'protocol' },
  { leyId: '427', short_name: 'Protocolo Menores Policía', name: 'Protocolo de actuación policial con menores', boe_url: null, scope: 'national', type: 'protocol' },
  { leyId: '492', short_name: 'Protocolo Gestantes LGTBI', name: 'Protocolo de actuación con mujeres gestantes, personas LGTBI y Trans, y otras personas necesitadas de especial protección', boe_url: null, scope: 'national', type: 'protocol' },
  { leyId: '491', short_name: 'Instrucción Libros Registro SES', name: 'Instrucción sobre el Sistema informático de Libros de Registro Oficiales de la SES', boe_url: null, scope: 'national', type: 'instruction' },
  { leyId: '339', short_name: 'Código Ético CNP', name: 'Código Ético del Cuerpo Nacional de Policía (2013)', boe_url: null, scope: 'national', type: 'code' },
  { leyId: '441', short_name: 'Instrucción Protección Internacional', name: 'Instrucción sobre el Procedimiento de Protección Internacional', boe_url: null, scope: 'national', type: 'instruction' },

  // ── VEHÍCULOS POLICIALES ──
  { leyId: '93',  short_name: 'Orden INT Vehículos Celulares', name: 'Orden INT por la que se establecen las normas técnicas que deben reunir los vehículos celulares para el transporte de detenidos', boe_url: null, scope: 'national', type: 'ministerial_order' },
  { leyId: '94',  short_name: 'Orden INT Vehículos Celulares 2', name: 'Orden INT por la que se establecen las normas técnicas de vehículos celulares (parte 2)', boe_url: null, scope: 'national', type: 'ministerial_order' },
  { leyId: '177', short_name: 'Resolución ITV Policía', name: 'Resolución por la que se regula la inspección técnica de los vehículos de la Dirección General de la Policía', boe_url: null, scope: 'national', type: 'resolution' },
  { leyId: '627', short_name: 'RD ITV', name: 'Real Decreto por el que se regula la Inspección Técnica de Vehículos', boe_url: null, scope: 'national', type: 'royal_decree' },
  { leyId: '628', short_name: 'Orden Armas Guardas', name: 'Orden por la que se determinan las armas de fuego a utilizar por los Guardas particulares del Campo', boe_url: null, scope: 'national', type: 'ministerial_order' },

  // ── CIBERSEGURIDAD ──
  { leyId: '139', short_name: 'CCN-CERT Ciberseguridad', name: 'Principios y recomendaciones básicas en Ciberseguridad del CCN-CERT', boe_url: null, scope: 'national', type: 'guide' },
  { leyId: '212', short_name: 'CCN-STIC-425', name: 'Guía de Seguridad CCN-STIC-425: Ciclo de Inteligencia y Análisis de Intrusiones', boe_url: null, scope: 'national', type: 'guide' },
  { leyId: '149', short_name: 'Estrategia Ciberseguridad 2019', name: 'Estrategia Nacional de Ciberseguridad 2019', boe_url: null, scope: 'national', type: 'strategy' },

  // ── TRATADOS INTERNACIONALES (con BOE cuando tienen instrumento de ratificación) ──
  { leyId: '5',   short_name: 'DUDH', name: 'Declaración Universal de los Derechos Humanos de 10 de diciembre de 1948', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1979-24010', scope: 'international', type: 'treaty' },
  { leyId: '95',  short_name: 'CEDH', name: 'Convenio Europeo para la Protección de los Derechos Humanos y de las Libertades Fundamentales', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1979-24010', scope: 'international', type: 'treaty' },
  { leyId: '47',  short_name: 'CEDH (derechos)', name: 'Convenio Europeo de Derechos Humanos — Derechos sustantivos', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1979-24010', scope: 'international', type: 'treaty' },
  { leyId: '203', short_name: 'Protocolo 15 CEDH', name: 'Protocolo número 15 al Convenio Europeo de Derechos Humanos', boe_url: null, scope: 'international', type: 'treaty' },
  { leyId: '40',  short_name: 'OPCAT', name: 'Protocolo Facultativo de la Convención contra la Tortura y otros Tratos o Penas Crueles, Inhumanos o Degradantes', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2006-12676', scope: 'international', type: 'treaty' },
  { leyId: '97',  short_name: 'Convención Tortura', name: 'Convención contra la Tortura y Otros Tratos o Penas Crueles, Inhumanos o Degradantes', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1987-25053', scope: 'international', type: 'treaty' },
  { leyId: '7',   short_name: 'PIDCP', name: 'Pacto Internacional de Derechos Civiles y Políticos', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1977-10733', scope: 'international', type: 'treaty' },
  { leyId: '8',   short_name: 'PIDESC', name: 'Pacto Internacional de Derechos Económicos, Sociales y Culturales', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1977-10734', scope: 'international', type: 'treaty' },
  { leyId: '28',  short_name: 'Convención Desplazados', name: 'Convención sobre el Estatuto de los Refugiados — definición de desplazado', boe_url: null, scope: 'international', type: 'treaty' },
  { leyId: '142', short_name: 'Convención Apátridas', name: 'Convención sobre el Estatuto de los Apátridas, hecha en Nueva York el 28 de septiembre de 1954', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1997-18681', scope: 'international', type: 'treaty' },
  { leyId: '397', short_name: 'Convención Apátridas 1954', name: 'Convención sobre el Estatuto de los Apátridas de 1954 — Estatuto personal', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1997-18681', scope: 'international', type: 'treaty' },
  { leyId: '150', short_name: 'Convenio Prevención Tortura', name: 'Convenio Europeo para la Prevención de la Tortura y de las Penas o Tratos Inhumanos o Degradantes', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1989-11634', scope: 'international', type: 'treaty' },
  { leyId: '91',  short_name: 'Estatuto de Roma', name: 'Estatuto de Roma de la Corte Penal Internacional', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2002-10139', scope: 'international', type: 'treaty' },
  { leyId: '62',  short_name: 'Declaración 1789', name: 'Declaración de los Derechos del Hombre y del Ciudadano de 1789', boe_url: null, scope: 'international', type: 'declaration' },
  { leyId: '164', short_name: 'Carta Social Europea', name: 'Carta Social Europea Revisada', boe_url: null, scope: 'international', type: 'treaty' },
  { leyId: '137', short_name: 'Convenio Budapest', name: 'Convenio sobre la Ciberdelincuencia, hecho en Budapest el 23 de noviembre de 2001', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2010-14221', scope: 'international', type: 'treaty' },
  { leyId: '132', short_name: 'Protocolo Budapest', name: 'Protocolo adicional al Convenio sobre la Ciberdelincuencia relativo a la penalización de actos de índole racista y xenófoba', boe_url: null, scope: 'international', type: 'treaty' },
  { leyId: '82',  short_name: 'Convenio Schengen', name: 'Convenio de Aplicación del Acuerdo de Schengen', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1994-9268', scope: 'international', type: 'treaty' },
  { leyId: '83',  short_name: 'Acervo Schengen', name: 'Acervo de Schengen — Convenio de Aplicación', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-1994-9268', scope: 'international', type: 'treaty' },
  { leyId: '393', short_name: 'Convenio Dublín', name: 'Convenio relativo a la determinación del Estado responsable del examen de las solicitudes de asilo — Dublín', boe_url: null, scope: 'international', type: 'treaty' },
  { leyId: '333', short_name: 'Tratado Prüm', name: 'Tratado de Prüm relativo a la profundización de la cooperación transfronteriza', boe_url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2006-19339', scope: 'international', type: 'treaty' },
  { leyId: '84',  short_name: 'Ley 12/2015 Sefardíes', name: 'Ley 12/2015, de 24 de junio, en materia de concesión de la nacionalidad española a los sefardíes originarios de España', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-7045', scope: 'national', type: 'law' },

  // ── NORMATIVA UE ──
  { leyId: '184', short_name: 'Estatuto TJUE', name: 'Protocolo sobre el Estatuto del Tribunal de Justicia de la Unión Europea', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '81',  short_name: 'RGPD UE 2016/679', name: 'Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo — Reglamento General de Protección de Datos', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '198', short_name: 'Reglamento Schengen 2016/399', name: 'Reglamento (UE) 2016/399 — Código de fronteras Schengen', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '171', short_name: 'Reglamento Visados 810/2009', name: 'Reglamento (CE) 810/2009 — Código comunitario sobre visados', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '99',  short_name: 'Reglamento Eurojust 2018/1727', name: 'Reglamento (UE) 2018/1727 — Agencia de la UE para la Cooperación Judicial Penal (Eurojust)', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '134', short_name: 'Ley 23/2014 Reconocimiento Mutuo Penal', name: 'Ley 23/2014, de 20 de noviembre, de reconocimiento mutuo de resoluciones penales en la Unión Europea', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-12029', scope: 'national', type: 'law' },
  { leyId: '209', short_name: 'Reglamento Procedimiento TJUE', name: 'Reglamento de Procedimiento del Tribunal de Justicia de la Unión Europea', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '210', short_name: 'Reglamento Interno PE', name: 'Reglamento Interno del Parlamento Europeo', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '124', short_name: 'Reglamento Procedimiento TEDH', name: 'Reglamento de Procedimiento del Tribunal Europeo de Derechos Humanos', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '383', short_name: 'Reglamento Agencia Drogas UE', name: 'Reglamento de la Agencia de la Unión Europea sobre Drogas', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '445', short_name: 'Reglamento EURODAC 2024/1358', name: 'Reglamento (UE) 2024/1358 — EURODAC', boe_url: null, scope: 'eu', type: 'eu_regulation' },
  { leyId: '408', short_name: 'Directiva Eficiencia Energética 2023/1791', name: 'Directiva (UE) 2023/1791 — eficiencia energética', boe_url: null, scope: 'eu', type: 'eu_directive' },
  { leyId: '382', short_name: 'Directiva Residencia 3ros Países', name: 'Directiva UE relativa a las condiciones de entrada y residencia de nacionales de terceros países', boe_url: null, scope: 'eu', type: 'eu_directive' },
  { leyId: '414', short_name: 'Directiva Violencia Mujer 2024/1385', name: 'Directiva (UE) 2024/1385 sobre la lucha contra la violencia contra las mujeres', boe_url: null, scope: 'eu', type: 'eu_directive' },
  { leyId: '103', short_name: 'Carta DDFF UE', name: 'Carta de los Derechos Fundamentales de la Unión Europea', boe_url: null, scope: 'eu', type: 'eu_charter' },

  // ── ORGANISMOS INTERNACIONALES ──
  { leyId: '46',  short_name: 'Resolución Consejo DDHH 5/1', name: 'Resolución 5/1 del Consejo de Derechos Humanos — Paquete de creación de instituciones', boe_url: null, scope: 'international', type: 'resolution' },
  { leyId: '205', short_name: 'Resolución 60/251 AGNU', name: 'Resolución 60/251 de la Asamblea General de la ONU — Consejo de Derechos Humanos', boe_url: null, scope: 'international', type: 'resolution' },
  { leyId: '114', short_name: 'Carta Foro Social Mundial', name: 'Carta de Principios del Foro Social Mundial', boe_url: null, scope: 'international', type: 'charter' },
  { leyId: '146', short_name: 'Carta Seguridad Vial Europea', name: 'Carta Europea de la Seguridad Vial', boe_url: null, scope: 'eu', type: 'eu_charter' },
  { leyId: '120', short_name: 'Convenio EUROPOL Art K.3', name: 'Convenio basado en el artículo K.3 del TUE por el que se crea una Oficina Europea de Policía (EUROPOL)', boe_url: null, scope: 'eu', type: 'eu_regulation' },

  // ── NACIONALIDAD ──
  { leyId: '342', short_name: 'RD 1004/2015 Nacionalidad', name: 'Real Decreto 1004/2015, de 6 de noviembre, por el que se aprueba el Reglamento de nacionalidad española por residencia', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-12047', scope: 'national', type: 'royal_decree' },
  { leyId: '396', short_name: 'RD 1004/2015 Nacionalidad proc', name: 'Real Decreto 1004/2015 — Procedimiento para la adquisición de la nacionalidad por residencia', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-12047', scope: 'national', type: 'royal_decree' },

  // ── MEDIO AMBIENTE ──
  { leyId: '24',  short_name: 'Ley 27/2006 Info Ambiental', name: 'Ley 27/2006, de 18 de julio, por la que se regulan los derechos de acceso a la información, de participación pública y de acceso a la justicia en materia de medio ambiente', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2006-13010', scope: 'national', type: 'law' },
  { leyId: '513', short_name: 'RD Consejo Nacional Clima', name: 'Real Decreto por el que se regula la composición y funciones del Consejo Nacional del Clima', boe_url: null, scope: 'national', type: 'royal_decree' },

  // ── LEYES CON POCAS PREGUNTAS (completar para no dejar cabos sueltos) ──
  { leyId: '125', short_name: 'RD 2364/1994 Seg Privada', name: 'Real Decreto 2364/1994, de 9 de diciembre, por el que se aprueba el Reglamento de Seguridad Privada', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-608', scope: 'national', type: 'royal_decree' },
  { leyId: '386', short_name: 'RD 389/2021 AEPD', name: 'Real Decreto 389/2021, de 1 de junio, por el que se aprueba el Estatuto de la Agencia Española de Protección de Datos', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2021-9176', scope: 'national', type: 'royal_decree' },
  { leyId: '407', short_name: 'Ley 10/2010 Blanqueo', name: 'Ley 10/2010, de 28 de abril, de prevención del blanqueo de capitales y de la financiación del terrorismo', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-6737', scope: 'national', type: 'law' },
  { leyId: '446', short_name: 'RD Registro Documental', name: 'Real Decreto por el que se establecen las obligaciones de registro documental e información', boe_url: null, scope: 'national', type: 'royal_decree' },
  { leyId: '27',  short_name: 'RD 557/2011 Extranjería Regl', name: 'Real Decreto 557/2011, de 20 de abril, por el que se aprueba el Reglamento de la LO 4/2000, sobre derechos y libertades de los extranjeros', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-7703', scope: 'national', type: 'royal_decree' },
  { leyId: '442', short_name: 'RD 557/2011 Extranjería Regl 2', name: 'Real Decreto 557/2011 — Reglamento de extranjería (segunda referencia)', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-7703', scope: 'national', type: 'royal_decree' },
  { leyId: '129', short_name: 'RD 1428/2003 RGC ref', name: 'RD 1428/2003 Reglamento General de Circulación (referencia adicional)', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23514', scope: 'national', type: 'royal_decree' },
  { leyId: '405', short_name: 'RD 2822/1998 RGV Anexo', name: 'RD 2822/1998 Reglamento General de Vehículos — Anexo XI Señales', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1999-1826', scope: 'national', type: 'royal_decree' },
  { leyId: '447', short_name: 'RDL 6/2015 Tráfico ref', name: 'RDL 6/2015 Ley sobre Tráfico (referencia vehículos urgencia)', boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11722', scope: 'national', type: 'royal_decree' },
];

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════

// Map custom types to valid DB types (constitution, code, law, regulation)
function mapType(t) {
  if (['organic_law', 'law', 'treaty', 'declaration'].includes(t)) return 'law';
  if (['constitution'].includes(t)) return 'constitution';
  if (['code'].includes(t)) return 'code';
  return 'regulation'; // royal_decree, ministerial_order, instruction, protocol, guide, etc.
}

// Map custom scopes to valid DB scopes (national, regional, local, eu)
function mapScope(s) {
  if (s === 'international') return 'national'; // ratified treaties are national law
  if (['eu'].includes(s)) return 'eu';
  return s; // national, regional, local
}

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

async function main() {
  console.log('🚀 Creating laws for Policía Nacional');
  console.log('Total laws to create:', LAWS_TO_CREATE.length);

  const pnMap = JSON.parse(fs.readFileSync('preguntas-para-subir/innotest-policia-nacional/_law_map.json', 'utf-8'));

  let created = 0, skipped = 0, errors = 0;
  const createdLaws = [];

  for (const law of LAWS_TO_CREATE) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('laws')
      .select('id, short_name')
      .eq('short_name', law.short_name)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  SKIP ${law.short_name} (already exists: ${existing[0].id.substring(0, 8)})`);
      // Update the map
      pnMap[law.leyId] = { law_id: existing[0].id, short_name: existing[0].short_name };
      skipped++;
      continue;
    }

    // Also check by boe_url if provided
    if (law.boe_url) {
      const { data: byUrl } = await supabase
        .from('laws')
        .select('id, short_name')
        .eq('boe_url', law.boe_url)
        .limit(1);

      if (byUrl && byUrl.length > 0) {
        console.log(`  SKIP ${law.short_name} (same boe_url: ${byUrl[0].short_name})`);
        pnMap[law.leyId] = { law_id: byUrl[0].id, short_name: byUrl[0].short_name };
        skipped++;
        continue;
      }
    }

    // Insert
    const slug = slugify(law.short_name);
    const { data: inserted, error: err } = await supabase
      .from('laws')
      .insert({
        short_name: law.short_name,
        name: law.name,
        slug,
        boe_url: law.boe_url,
        scope: mapScope(law.scope),
        type: mapType(law.type),
        is_active: true,
      })
      .select('id')
      .single();

    if (err) {
      console.log(`  ERROR ${law.short_name}: ${err.message}`);
      errors++;
      continue;
    }

    console.log(`  ✅ ${law.short_name} → ${inserted.id.substring(0, 8)}`);
    pnMap[law.leyId] = { law_id: inserted.id, short_name: law.short_name };
    createdLaws.push({ ...law, id: inserted.id });
    created++;
  }

  // Save updated map
  fs.writeFileSync('preguntas-para-subir/innotest-policia-nacional/_law_map.json', JSON.stringify(pnMap, null, 2));

  console.log(`\n✅ Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log('Laws with boe_url (syncable):', createdLaws.filter(l => l.boe_url && l.boe_url.includes('act.php')).length);
  console.log('Laws without boe_url (manual art 0):', createdLaws.filter(l => !l.boe_url).length);
  console.log('Laws with doc.php (no sync, manual art 0):', createdLaws.filter(l => l.boe_url && l.boe_url.includes('doc.php')).length);

  // Save list of created laws for sync phase
  fs.writeFileSync('/tmp/pn_created_laws.json', JSON.stringify(createdLaws, null, 2));
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
