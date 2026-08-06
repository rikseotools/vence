// lib/temario/bloquesPorOposicion.ts
//
// GENERADO por scripts/temario/generar-bloques-por-oposicion.cjs (T-611).
//
// Los bloques del temario de cada oposición, sacados de las 131 `getBlockInfo` que
// vivían copiadas en `app/<oposicion>/temario/[slug]/TopicContentView.tsx`. No eran
// código: eran una tabla de rangos escrita a mano 131 veces, y por eso el componente
// tenía que estar duplicado. Ahora el componente es UNO y esto es su dato.
//
// La clave es el SLUG de la ruta (`app/<slug>/…`), que es lo que la página ya pasa
// como `oposicion=`. Su equivalencia con las funciones originales está congelada en
// `__tests__/temario/fixtures/bloques-originales.json`.
//
// AL DAR DE ALTA UNA OPOSICIÓN: añade aquí su entrada. Si no, su temario se sirve sin
// bloques y con el número de tema crudo — y el guardarraíl de
// `__tests__/temario/bloquesPorOposicion.test.ts` te para antes.
import type { TramoBloque } from './bloquesTemario'

export const BLOQUES_POR_OPOSICION: Record<string, TramoBloque[]> = {
  'administrativa-universidad-de-murcia': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Parte General Común" },
    { desde: 8, hasta: 18, offset: 7, bloque: "Parte Específica" },
  ],
  'administrativo-agencia-tributaria-canaria': [
    { desde: 1, hasta: 15, offset: 0, bloque: "Bloque I: Derecho Constitucional, Europeo, Administrativo y de Canarias" },
    { desde: 201, hasta: 225, offset: 0, bloque: "Bloque II: Derecho Tributario" },
  ],
  'administrativo-andalucia': [
    { desde: 1, hasta: 16, offset: 0, bloque: "Área Jurídico-Administrativa General" },
    { desde: 17, hasta: 24, offset: 16, bloque: "Gestión Financiera" },
    { desde: 25, hasta: 29, offset: 24, bloque: "Gestión de Personal" },
    { desde: 30, hasta: 37, offset: 29, bloque: "Organización y Gestión Administrativa" },
    { desde: 38, hasta: 42, offset: 37, bloque: "Tecnología" },
  ],
  'administrativo-aragon': [
    { desde: 1, hasta: 5, offset: 0, bloque: "Materias comunes" },
    { desde: 101, hasta: 130, offset: 100, bloque: "Materias específicas" },
  ],
  'administrativo-asturias': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Bloque I: Derecho Constitucional y Organización Administrativa" },
    { desde: 201, hasta: 216, offset: 193, bloque: "Bloque II: Derecho Administrativo y Comunitario" },
    { desde: 301, hasta: 306, offset: 277, bloque: "Bloque III: Gestión de Recursos Humanos" },
    { desde: 401, hasta: 405, offset: 371, bloque: "Bloque IV: Gestión Financiera" },
    { desde: 501, hasta: 504, offset: 466, bloque: "Bloque V: Ofimática" },
  ],
  'administrativo-canarias': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Organización del Estado" },
    { desde: 9, hasta: 14, offset: 0, bloque: "Organización de Canarias" },
    { desde: 15, hasta: 20, offset: 0, bloque: "La Unión Europea" },
    { desde: 21, hasta: 24, offset: 0, bloque: "Régimen Jurídico, Transparencia y Datos" },
    { desde: 25, hasta: 30, offset: 0, bloque: "Derechos, Igualdad, Empleo Público y Prevención" },
  ],
  'administrativo-cantabria': [
    { desde: 1, hasta: 21, offset: 0, bloque: "Derecho Administrativo y Constitucional" },
    { desde: 22, hasta: 28, offset: 21, bloque: "Gestión de Personal" },
    { desde: 29, hasta: 34, offset: 28, bloque: "Gestión Financiera" },
    { desde: 35, hasta: 40, offset: 34, bloque: "Organización de las Oficinas Públicas" },
  ],
  'administrativo-carm': [
    { desde: 1, hasta: 14, offset: 0, bloque: "Organización del Estado y Gestión Administrativa" },
    { desde: 15, hasta: 21, offset: 0, bloque: "Gestión de Recursos Humanos" },
    { desde: 22, hasta: 28, offset: 0, bloque: "Gestión Económico-Presupuestaria y Tributaria" },
  ],
  'administrativo-castilla-la-mancha': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Parte Común" },
    { desde: 11, hasta: 36, offset: 10, bloque: "Parte Específica" },
  ],
  'administrativo-castilla-leon': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Grupo I" },
    { desde: 201, hasta: 209, offset: 190, bloque: "Grupo II" },
    { desde: 301, hasta: 305, offset: 281, bloque: "Grupo III" },
    { desde: 401, hasta: 406, offset: 376, bloque: "Grupo IV" },
    { desde: 501, hasta: 511, offset: 470, bloque: "Grupo V" },
  ],
  'administrativo-diputacion-jaen': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Materias Comunes" },
    { desde: 9, hasta: 21, offset: 0, bloque: "Derecho Administrativo General" },
    { desde: 22, hasta: 28, offset: 0, bloque: "Régimen Local y Protección de Datos" },
    { desde: 29, hasta: 33, offset: 0, bloque: "Función Pública Local" },
    { desde: 34, hasta: 38, offset: 0, bloque: "Haciendas Locales" },
    { desde: 39, hasta: 40, offset: 0, bloque: "Documentación y Administración Electrónica" },
  ],
  'administrativo-diputacion-valencia': [
    { desde: 1, hasta: 15, offset: 0, bloque: "Bloque I" },
    { desde: 16, hasta: 40, offset: 0, bloque: "Bloque II" },
  ],
  'administrativo-estado': [
    { desde: 1, hasta: 11, offset: 0, bloque: "Bloque I" },
    { desde: 201, hasta: 204, offset: 200, bloque: "Bloque II" },
    { desde: 301, hasta: 307, offset: 300, bloque: "Bloque III" },
    { desde: 401, hasta: 409, offset: 400, bloque: "Bloque IV" },
    { desde: 501, hasta: 506, offset: 500, bloque: "Bloque V" },
    { desde: 601, hasta: 608, offset: 600, bloque: "Bloque VI" },
  ],
  'administrativo-extremadura': [
    { desde: 1, hasta: 13, offset: 0, bloque: "Organizacion y Empleo Publico de Extremadura" },
    { desde: 14, hasta: 30, offset: 0, bloque: "Derecho Administrativo, Contratacion y Hacienda" },
  ],
  'administrativo-galicia': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Bloque I: Parte General" },
    { desde: 8, hasta: 19, offset: 0, bloque: "Bloque II: Parte Específica" },
  ],
  'administrativo-gva': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Materias Comunes" },
    { desde: 11, hasta: 24, offset: 0, bloque: "Materias Especificas" },
  ],
  'administrativo-junta-general-asturias': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Bloque I: Derecho Constitucional y Organización" },
    { desde: 8, hasta: 19, offset: 0, bloque: "Bloque II: La Junta General del Principado" },
    { desde: 20, hasta: 26, offset: 0, bloque: "Bloque III: Lengua Española y Documentación" },
    { desde: 27, hasta: 36, offset: 0, bloque: "Bloque IV: Derecho Administrativo y Laboral" },
    { desde: 37, hasta: 40, offset: 0, bloque: "Bloque V: Ofimática" },
  ],
  'administrativo-la-rioja': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Organización del Estado" },
    { desde: 11, hasta: 16, offset: 0, bloque: "Organización de La Rioja" },
    { desde: 17, hasta: 26, offset: 0, bloque: "Derecho Administrativo General" },
    { desde: 27, hasta: 31, offset: 0, bloque: "Gestión de Personal" },
    { desde: 32, hasta: 39, offset: 0, bloque: "Gestión Financiera" },
    { desde: 40, hasta: 42, offset: 0, bloque: "Informática" },
  ],
  'administrativo-madrid': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Organización del Estado y de la Comunidad de Madrid" },
    { desde: 9, hasta: 24, offset: 8, bloque: "Derecho Administrativo General" },
    { desde: 25, hasta: 32, offset: 24, bloque: "Gestión de Recursos Humanos" },
    { desde: 33, hasta: 39, offset: 32, bloque: "Gestión Financiera" },
    { desde: 40, hasta: 47, offset: 39, bloque: "Informática y Ofimática" },
  ],
  'administrativo-navarra': [
    { desde: 1, hasta: 5, offset: 0, bloque: "Parte I: Actividad Administrativa" },
    { desde: 6, hasta: 23, offset: 0, bloque: "Parte II: Normativa" },
    { desde: 24, hasta: 27, offset: 0, bloque: "Parte III: Informatica" },
  ],
  'administrativo-pais-vasco': [
    { desde: 1, hasta: 13, offset: 0, bloque: "Temario General" },
  ],
  'administrativo-seguridad-social': [
    { desde: 1, hasta: 23, offset: 0, bloque: "Bloque I: Temario general" },
    { desde: 101, hasta: 113, offset: 100, bloque: "Bloque II: Temario específico de Seguridad Social" },
  ],
  'administrativo-universidad-leon': [
    { desde: 1, hasta: 5, offset: 0, bloque: "Bloque 1" },
    { desde: 6, hasta: 11, offset: 0, bloque: "Bloque 2" },
    { desde: 12, hasta: 15, offset: 0, bloque: "Bloque 3" },
    { desde: 16, hasta: 21, offset: 0, bloque: "Bloque 4" },
    { desde: 22, hasta: 25, offset: 0, bloque: "Bloque 5" },
  ],
  'agente-hacienda': [
    { desde: 1, hasta: 12, offset: 0, bloque: "Materias Comunes" },
    { desde: 13, hasta: 32, offset: 0, bloque: "Materias Específicas (Hacienda Pública y Derecho Tributario)" },
  ],
  'agrupacion-profesional-servicios-publicos-carm': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Parte General" },
    { desde: 8, hasta: 12, offset: 0, bloque: "Funciones de Servicios Públicos" },
  ],
  'auxiliar-administrativo-andalucia': [
    { desde: 1, hasta: 12, offset: 0, bloque: "Bloque I" },
    { desde: 13, hasta: 22, offset: 0, bloque: "Bloque II" },
  ],
  'auxiliar-administrativo-aragon': [
    { desde: 1, hasta: 15, offset: 0, bloque: "Materias Comunes" },
    { desde: 16, hasta: 20, offset: 0, bloque: "Materias Especificas" },
  ],
  'auxiliar-administrativo-asturias': [
    { desde: 1, hasta: 6, offset: 0, bloque: "Derecho Constitucional y Organizacion Administrativa" },
    { desde: 7, hasta: 20, offset: 0, bloque: "Derecho Administrativo y Comunitario" },
    { desde: 21, hasta: 25, offset: 0, bloque: "Ofimatica" },
  ],
  'auxiliar-administrativo-ayuntamiento-alcala-henares': [
    { desde: 1, hasta: 5, offset: 0, bloque: "Materias Comunes" },
    { desde: 6, hasta: 24, offset: 5, bloque: "Materias Específicas" },
  ],
  'auxiliar-administrativo-ayuntamiento-badajoz': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Bloque I" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Bloque II" },
  ],
  'auxiliar-administrativo-ayuntamiento-cordoba': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Materias Comunes" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Materias Específicas" },
  ],
  'auxiliar-administrativo-ayuntamiento-granada': [
    { desde: 1, hasta: 5, offset: 0, bloque: "Materias Comunes" },
    { desde: 6, hasta: 22, offset: 5, bloque: "Materias Específicas" },
  ],
  'auxiliar-administrativo-ayuntamiento-huesca': [
    { desde: 1, hasta: 11, offset: 0, bloque: "Bloque I: Derecho Constitucional y Administrativo" },
    { desde: 12, hasta: 19, offset: 0, bloque: "Bloque II: Régimen Local y Hacienda Local" },
    { desde: 20, hasta: 24, offset: 0, bloque: "Bloque III: Prevención y Gestión Documental" },
    { desde: 25, hasta: 25, offset: 0, bloque: "Bloque IV: Ofimática e Informática" },
    { desde: 26, hasta: 28, offset: 0, bloque: "Bloque V: Protección de Datos e Igualdad" },
  ],
  'auxiliar-administrativo-ayuntamiento-madrid': [
    { desde: 1, hasta: 20, offset: 0, bloque: "Parte teórica" },
    { desde: 21, hasta: 22, offset: 0, bloque: "Ofimática" },
  ],
  'auxiliar-administrativo-ayuntamiento-marbella': [
    { desde: 1, hasta: 6, offset: 0, bloque: "Materias Comunes" },
    { desde: 7, hasta: 11, offset: 0, bloque: "Administración Local" },
    { desde: 12, hasta: 18, offset: 0, bloque: "Régimen Jurídico y Derechos" },
    { desde: 19, hasta: 25, offset: 0, bloque: "Gestión y Función Pública Local" },
    { desde: 26, hasta: 27, offset: 0, bloque: "Transparencia e Informática" },
  ],
  'auxiliar-administrativo-ayuntamiento-murcia': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Bloque I" },
    { desde: 11, hasta: 20, offset: 0, bloque: "Bloque II" },
  ],
  'auxiliar-administrativo-ayuntamiento-salamanca': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Derecho Constitucional y Administrativo" },
    { desde: 11, hasta: 22, offset: 0, bloque: "Administración Local" },
    { desde: 23, hasta: 29, offset: 0, bloque: "Atención, Transparencia, Protección de Datos y Archivo" },
    { desde: 30, hasta: 34, offset: 0, bloque: "Calidad, Igualdad y Violencia de Género" },
    { desde: 35, hasta: 41, offset: 0, bloque: "Ofimática e Informática" },
  ],
  'auxiliar-administrativo-ayuntamiento-sevilla': [
    { desde: 1, hasta: 18, offset: 0, bloque: "Parte I: Organización pública y Derecho administrativo" },
    { desde: 19, hasta: 26, offset: 0, bloque: "Parte II: Ofimática" },
  ],
  'auxiliar-administrativo-ayuntamiento-valencia': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Bloque I" },
    { desde: 11, hasta: 21, offset: 0, bloque: "Bloque II" },
  ],
  'auxiliar-administrativo-ayuntamiento-valladolid': [
    { desde: 1, hasta: 6, offset: 0, bloque: "Organización del Estado y de Castilla y León" },
    { desde: 7, hasta: 10, offset: 0, bloque: "El Ayuntamiento de Valladolid" },
    { desde: 11, hasta: 19, offset: 0, bloque: "Derecho Administrativo y Contratación" },
    { desde: 20, hasta: 22, offset: 0, bloque: "Personal, Igualdad y Prevención de Riesgos" },
    { desde: 23, hasta: 31, offset: 0, bloque: "Información, Archivo, Transparencia e Informática" },
  ],
  'auxiliar-administrativo-ayuntamiento-zaragoza': [
    { desde: 1, hasta: 9, offset: 0, bloque: "Organización Jurídica y Administrativa" },
    { desde: 10, hasta: 20, offset: 0, bloque: "Administración Local y Empleo Público" },
    { desde: 21, hasta: 25, offset: 0, bloque: "Ofimática e Informática" },
  ],
  'auxiliar-administrativo-baleares': [
    { desde: 1, hasta: 20, offset: 0, bloque: "Materias Comunes" },
    { desde: 21, hasta: 36, offset: 0, bloque: "Ofimatica" },
  ],
  'auxiliar-administrativo-canarias': [
    { desde: 1, hasta: 20, offset: 0, bloque: "Parte General" },
    { desde: 21, hasta: 40, offset: 0, bloque: "Parte Practica" },
  ],
  'auxiliar-administrativo-cantabria': [
    { desde: 1, hasta: 18, offset: 0, bloque: "Parte General" },
    { desde: 19, hasta: 25, offset: 0, bloque: "Informatica" },
  ],
  'auxiliar-administrativo-carm': [
    { desde: 1, hasta: 9, offset: 0, bloque: "Bloque I" },
    { desde: 10, hasta: 16, offset: 0, bloque: "Bloque II" },
  ],
  'auxiliar-administrativo-catalunya': [
    { desde: 1, hasta: 15, offset: 0, bloque: "Temari General" },
  ],
  'auxiliar-administrativo-clm': [
    { desde: 1, hasta: 12, offset: 0, bloque: "Organizacion Administrativa" },
    { desde: 13, hasta: 24, offset: 0, bloque: "Ofimatica" },
  ],
  'auxiliar-administrativo-consell-formentera': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Temario General" },
    { desde: 9, hasta: 20, offset: 0, bloque: "Temario Específico" },
  ],
  'auxiliar-administrativo-cyl': [
    { desde: 1, hasta: 19, offset: 0, bloque: "Grupo I" },
    { desde: 20, hasta: 28, offset: 0, bloque: "Grupo II" },
  ],
  'auxiliar-administrativo-diputacion-alicante': [
    { desde: 1, hasta: 18, offset: 0, bloque: "Materias jurídico-administrativas" },
    { desde: 19, hasta: 20, offset: 0, bloque: "Ofimática" },
  ],
  'auxiliar-administrativo-diputacion-avila': [
    { desde: 1, hasta: 24, offset: 0, bloque: "Materias Comunes" },
    { desde: 25, hasta: 30, offset: 0, bloque: "Materias Específicas" },
  ],
  'auxiliar-administrativo-diputacion-barcelona': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Temario General" },
    { desde: 5, hasta: 20, offset: 4, bloque: "Temario Específico" },
  ],
  'auxiliar-administrativo-diputacion-cadiz': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Materias Comunes" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Materias Específicas" },
  ],
  'auxiliar-administrativo-diputacion-cordoba': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Materias Comunes" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Materias Específicas" },
  ],
  'auxiliar-administrativo-diputacion-cuenca': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Materia Común" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Materia Específica" },
  ],
  'auxiliar-administrativo-diputacion-girona': [
    { desde: 1, hasta: 20, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-diputacion-huelva': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Temas Comunes" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Temas Específicos" },
  ],
  'auxiliar-administrativo-diputacion-huesca': [
    { desde: 1, hasta: 23, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-diputacion-leon': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Bloque I: Derecho Constitucional, Autonómico y Comunitario" },
    { desde: 9, hasta: 16, offset: 0, bloque: "Bloque II: Derecho Administrativo General" },
    { desde: 17, hasta: 25, offset: 0, bloque: "Bloque III: Administración Local y Función Pública" },
  ],
  'auxiliar-administrativo-diputacion-ourense': [
    { desde: 1, hasta: 20, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-diputacion-segovia': [
    { desde: 1, hasta: 30, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-diputacion-zamora': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Parte General" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Parte Específica" },
  ],
  'auxiliar-administrativo-diputacion-zaragoza': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Materias Comunes" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Materias Específicas" },
  ],
  'auxiliar-administrativo-estado': [
    { desde: 1, hasta: 16, offset: 0, bloque: "Bloque I" },
    { desde: 101, hasta: 112, offset: 100, bloque: "Bloque II" },
  ],
  'auxiliar-administrativo-extremadura': [
    { desde: 1, hasta: 14, offset: 0, bloque: "Empleo Publico y Organizacion" },
    { desde: 15, hasta: 25, offset: 0, bloque: "Derecho Administrativo y Ofimatica" },
  ],
  'auxiliar-administrativo-galicia': [
    { desde: 1, hasta: 13, offset: 0, bloque: "Parte General" },
    { desde: 14, hasta: 17, offset: 0, bloque: "Parte Especifica" },
  ],
  'auxiliar-administrativo-ingesa': [
    { desde: 1, hasta: 15, offset: 0, bloque: "Parte general" },
    { desde: 16, hasta: 35, offset: 0, bloque: "Parte específica" },
  ],
  'auxiliar-administrativo-la-rioja': [
    { desde: 1, hasta: 21, offset: 0, bloque: "Parte General" },
    { desde: 22, hasta: 23, offset: 0, bloque: "Informatica" },
  ],
  'auxiliar-administrativo-madrid-2027': [
    { desde: 1, hasta: 15, offset: 0, bloque: "Bloque I" },
    { desde: 16, hasta: 21, offset: 0, bloque: "Bloque II" },
  ],
  'auxiliar-administrativo-madrid': [
    { desde: 1, hasta: 15, offset: 0, bloque: "Bloque I" },
    { desde: 16, hasta: 21, offset: 0, bloque: "Bloque II" },
  ],
  'auxiliar-administrativo-pais-vasco': [
    { desde: 1, hasta: 13, offset: 0, bloque: "Temario General" },
  ],
  'auxiliar-administrativo-scs-canarias': [
    { desde: 1, hasta: 20, offset: 0, bloque: "Materias jurídicas, sanitarias y de personal" },
    { desde: 21, hasta: 22, offset: 0, bloque: "Ofimática y herramientas informáticas" },
  ],
  'auxiliar-administrativo-sermas': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Bloque I — Organización Política y Sanitaria" },
    { desde: 9, hasta: 11, offset: 0, bloque: "Bloque II — Derecho Administrativo" },
    { desde: 12, hasta: 19, offset: 0, bloque: "Bloque III — Personal y Legislación Laboral" },
    { desde: 20, hasta: 26, offset: 0, bloque: "Bloque IV — Gestión Administrativa y Sanitaria" },
    { desde: 27, hasta: 31, offset: 0, bloque: "Bloque V — Informática y Administración Electrónica" },
  ],
  'auxiliar-administrativo-sms': [
    { desde: 1, hasta: 6, offset: 0, bloque: "Parte general" },
    { desde: 7, hasta: 24, offset: 0, bloque: "Parte especifica" },
  ],
  'auxiliar-administrativo-universidad-alcala': [
    { desde: 1, hasta: 18, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-universidad-almeria': [
    { desde: 1, hasta: 17, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-universidad-cadiz': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Bloque I: Organización de la Administración" },
    { desde: 8, hasta: 14, offset: 0, bloque: "Bloque II: Derecho Administrativo" },
    { desde: 15, hasta: 19, offset: 0, bloque: "Bloque III: Gestión de personal" },
    { desde: 20, hasta: 27, offset: 0, bloque: "Bloque IV: Gestión universitaria" },
  ],
  'auxiliar-administrativo-universidad-carlos-iii': [
    { desde: 1, hasta: 12, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-universidad-complutense': [
    { desde: 1, hasta: 12, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-universidad-huelva': [
    { desde: 1, hasta: 17, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-universidad-leon': [
    { desde: 1, hasta: 21, offset: 0, bloque: "Programa oficial" },
  ],
  'auxiliar-administrativo-universidad-uned': [
    { desde: 1, hasta: 11, offset: 0, bloque: "Materia General" },
    { desde: 12, hasta: 19, offset: 11, bloque: "Materia Específica (UNED)" },
    { desde: 20, hasta: 21, offset: 19, bloque: "Ofimática" },
    { desde: 22, hasta: 999, offset: 0, bloque: "Temario" },
  ],
  'auxiliar-administrativo-valencia': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Materias Comunes" },
    { desde: 11, hasta: 24, offset: 0, bloque: "Materias Especificas" },
  ],
  'auxiliar-archivos-estado': [
    { desde: 1, hasta: 11, offset: 0, bloque: "Legislación" },
    { desde: 101, hasta: 107, offset: 100, bloque: "Historia cultural" },
    { desde: 201, hasta: 227, offset: 200, bloque: "Archivística (parte específica)" },
    { desde: 301, hasta: 303, offset: 300, bloque: "Parte práctica" },
  ],
  'auxiliar-biblioteca-estado': [
    { desde: 1, hasta: 11, offset: 0, bloque: "Legislación" },
    { desde: 101, hasta: 104, offset: 100, bloque: "Historia del libro y las bibliotecas" },
    { desde: 201, hasta: 230, offset: 200, bloque: "Biblioteconomía (parte específica)" },
    { desde: 301, hasta: 303, offset: 300, bloque: "Parte práctica" },
  ],
  'auxiliar-clinica-diputacion-sevilla': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Materias Comunes" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Materias Específicas (atención sociosanitaria residencial)" },
  ],
  'auxiliar-enfermeria-geriatria-diputacion-cadiz': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Materias Comunes" },
    { desde: 9, hasta: 25, offset: 0, bloque: "Materias Específicas" },
  ],
  'auxiliar-enfermeria-gva': [
    { desde: 1, hasta: 19, offset: 0, bloque: "Bloque I — Temario Común" },
    { desde: 101, hasta: 130, offset: 100, bloque: "Bloque II — Temario Específico" },
  ],
  'auxiliar-enfermeria-osakidetza': [
    { desde: 1, hasta: 19, offset: 0, bloque: "Bloque I — Temario Común" },
    { desde: 101, hasta: 130, offset: 100, bloque: "Bloque II — Temario Específico" },
  ],
  'auxiliar-museos-estado': [
    { desde: 1, hasta: 11, offset: 0, bloque: "Legislación" },
    { desde: 101, hasta: 110, offset: 100, bloque: "Historia cultural" },
    { desde: 201, hasta: 224, offset: 200, bloque: "Museología (parte específica)" },
    { desde: 301, hasta: 303, offset: 300, bloque: "Parte práctica" },
  ],
  'auxilio-judicial': [
    { desde: 1, hasta: 5, offset: 0, bloque: "Bloque I" },
    { desde: 6, hasta: 15, offset: 0, bloque: "Bloque II" },
    { desde: 16, hasta: 26, offset: 0, bloque: "Bloque III" },
  ],
  'ayudante-instituciones-penitenciarias': [
    { desde: 1, hasta: 17, offset: 0, bloque: "Bloque I" },
    { desde: 101, hasta: 110, offset: 100, bloque: "Bloque II" },
    { desde: 201, hasta: 220, offset: 200, bloque: "Bloque III" },
    { desde: 301, hasta: 303, offset: 300, bloque: "Bloque IV" },
  ],
  'ayudantes-ejecucion-penal-pais-vasco': [
    { desde: 1, hasta: 25, offset: 0, bloque: "Parte general" },
    { desde: 101, hasta: 128, offset: 100, bloque: "Parte específica" },
  ],
  'celador-galicia': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Parte Común" },
    { desde: 9, hasta: 17, offset: 0, bloque: "Parte Específica" },
  ],
  'celador-ibsalut': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Parte Común" },
    { desde: 9, hasta: 17, offset: 0, bloque: "Parte Específica" },
  ],
  'celador-ics': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Parte Común" },
    { desde: 9, hasta: 17, offset: 0, bloque: "Parte Específica" },
  ],
  'celador-murcia': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Parte general (materias comunes)" },
    { desde: 8, hasta: 14, offset: 0, bloque: "Parte específica (Celador-Subalterno)" },
  ],
  'celador-sas': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Parte Común" },
    { desde: 11, hasta: 19, offset: 0, bloque: "Parte Específica" },
  ],
  'celador-scs-canarias': [
    { desde: 1, hasta: 14, offset: 0, bloque: "Temario Oficial" },
  ],
  'celador-sermas-madrid': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Parte Común" },
    { desde: 9, hasta: 17, offset: 0, bloque: "Parte Específica" },
  ],
  'celador-sescam-clm': [
    { desde: 1, hasta: 8, offset: 0, bloque: "Parte Común" },
    { desde: 9, hasta: 17, offset: 0, bloque: "Parte Específica" },
  ],
  'correos-personal-operativo': [
    { desde: 1, hasta: 6, offset: 0, bloque: "Bloque I: La Empresa y sus Productos" },
    { desde: 7, hasta: 12, offset: 0, bloque: "Bloque II: Operaciones y Normativa" },
  ],
  'cuidador-diputacion-cordoba': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Materias Comunes" },
    { desde: 5, hasta: 20, offset: 0, bloque: "Materias Específicas" },
  ],
  'enfermero-ics': [
    { desde: 1, hasta: 11, offset: 0, bloque: "Temario Transversal" },
    { desde: 12, hasta: 19, offset: 0, bloque: "Temario Específico" },
  ],
  'enfermero-sacyl': [
    { desde: 1, hasta: 9, offset: 0, bloque: "Parte General" },
    { desde: 10, hasta: 54, offset: 0, bloque: "Parte Específica" },
  ],
  'enfermero-sas-andalucia': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Temario Común" },
    { desde: 11, hasta: 79, offset: 0, bloque: "Temario Específico" },
  ],
  'enfermero-scs-canarias': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Temario Común" },
    { desde: 8, hasta: 50, offset: 0, bloque: "Temario Específico" },
  ],
  'enfermero-scs-cantabria': [
    { desde: 1, hasta: 5, offset: 0, bloque: "Parte General" },
    { desde: 6, hasta: 65, offset: 0, bloque: "Parte Específica" },
  ],
  'enfermero-sms': [
    { desde: 1, hasta: 15, offset: 0, bloque: "Parte Común" },
    { desde: 16, hasta: 71, offset: 15, bloque: "Parte Específica" },
  ],
  'escala-administrativa-universidad-de-granada': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Parte General Común" },
    { desde: 8, hasta: 18, offset: 7, bloque: "Parte Específica" },
  ],
  'etgoa-sanidad-consumo': [
    { desde: 1, hasta: 20, offset: 0, bloque: "Parte común" },
    { desde: 101, hasta: 200, offset: 100, bloque: "Área de Consumo" },
  ],
  'guardia-civil': [], // temario sin bloques
  'mecanico-conductor-estado': [
    { desde: 1, hasta: 5, offset: 0, bloque: "Parte común: organización y funcionamiento de la Administración General del Estado" },
    { desde: 6, hasta: 15, offset: 0, bloque: "Parte específica: conducción y seguridad vial" },
  ],
  'oficial-de-gestion-parlamento-de-andalucia': [
    { desde: 1, hasta: 16, offset: 0, bloque: "Bloque I. Materia General del Estado" },
    { desde: 17, hasta: 44, offset: 0, bloque: "Bloque II. Andalucía y el Parlamento" },
  ],
  'ordenanza-ayuntamiento-cordoba': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Temas Generales" },
    { desde: 5, hasta: 10, offset: 0, bloque: "Temas Específicos" },
  ],
  'policia-municipal-madrid': [
    { desde: 1, hasta: 26, offset: 0, bloque: "Bloque A: Ciencias Jurídicas" },
    { desde: 27, hasta: 37, offset: 0, bloque: "Bloque B: Ciencias Sociales" },
    { desde: 38, hasta: 999, offset: 0, bloque: "Bloque C: Ciencias Técnico-Científicas" },
  ],
  'policia-nacional': [
    { desde: 1, hasta: 26, offset: 0, bloque: "Bloque A: Ciencias Jurídicas" },
    { desde: 27, hasta: 37, offset: 0, bloque: "Bloque B: Ciencias Sociales" },
    { desde: 38, hasta: 999, offset: 0, bloque: "Bloque C: Ciencias Técnico-Científicas" },
  ],
  'subalterno-gva': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Materias Comunes" },
    { desde: 8, hasta: 15, offset: 0, bloque: "Materias Especificas" },
  ],
  'subalterno-parlamento-andalucia': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Bloque I. Materia General y de Andalucía" },
    { desde: 11, hasta: 15, offset: 0, bloque: "Bloque II. El Parlamento de Andalucía" },
  ],
  'tcae-aragon': [
    { desde: 1, hasta: 19, offset: 0, bloque: "Bloque I — Temario Común" },
    { desde: 101, hasta: 130, offset: 100, bloque: "Bloque II — Temario Específico" },
  ],
  'tcae-canarias': [
    { desde: 1, hasta: 19, offset: 0, bloque: "Bloque I — Temario Común" },
    { desde: 101, hasta: 130, offset: 100, bloque: "Bloque II — Temario Específico" },
  ],
  'tcae-extremadura': [
    { desde: 1, hasta: 4, offset: 0, bloque: "Temario Común" },
    { desde: 5, hasta: 30, offset: 0, bloque: "Temario Específico" },
    { desde: 31, hasta: 999, offset: 0, bloque: "Temario" },
  ],
  'tcae-galicia': [
    { desde: 1, hasta: 19, offset: 0, bloque: "Bloque I — Temario Común" },
    { desde: 101, hasta: 130, offset: 100, bloque: "Bloque II — Temario Específico" },
  ],
  'tcae-murcia': [
    { desde: 1, hasta: 19, offset: 0, bloque: "Bloque I — Temario Común" },
    { desde: 101, hasta: 130, offset: 100, bloque: "Bloque II — Temario Específico" },
  ],
  'tcae-sas': [
    { desde: 1, hasta: 10, offset: 0, bloque: "Materia Común" },
    { desde: 11, hasta: 29, offset: 10, bloque: "Materia Específica" },
    { desde: 30, hasta: 999, offset: 0, bloque: "Temario" },
  ],
  'tcae-sermas-madrid': [
    { desde: 1, hasta: 19, offset: 0, bloque: "Bloque I — Temario Común" },
    { desde: 101, hasta: 130, offset: 100, bloque: "Bloque II — Temario Específico" },
  ],
  'tcae-sescam': [
    { desde: 1, hasta: 5, offset: 0, bloque: "Temario Común" },
    { desde: 6, hasta: 30, offset: 0, bloque: "Temario Específico" },
    { desde: 31, hasta: 999, offset: 0, bloque: "Temario" },
  ],
  'tecnico-auxiliar-universidad-de-murcia': [
    { desde: 1, hasta: 7, offset: 0, bloque: "Parte General Común" },
    { desde: 8, hasta: 18, offset: 7, bloque: "Parte Específica" },
  ],
  'tecnico-informatica': [
    { desde: 101, hasta: 109, offset: 100, bloque: "Bloque I: Organizacion del Estado y Administracion electronica" },
    { desde: 201, hasta: 205, offset: 200, bloque: "Bloque II: Tecnologia basica" },
    { desde: 301, hasta: 309, offset: 300, bloque: "Bloque III: Desarrollo de sistemas" },
    { desde: 401, hasta: 410, offset: 400, bloque: "Bloque IV: Sistemas y comunicaciones" },
  ],
  'tramitacion-procesal': [
    { desde: 1, hasta: 11, offset: 0, bloque: "Bloque I" },
    { desde: 201, hasta: 204, offset: 200, bloque: "Bloque II" },
    { desde: 301, hasta: 307, offset: 300, bloque: "Bloque III" },
    { desde: 401, hasta: 409, offset: 400, bloque: "Bloque IV" },
    { desde: 501, hasta: 506, offset: 500, bloque: "Bloque V" },
    { desde: 601, hasta: 608, offset: 600, bloque: "Bloque VI" },
  ],
  'ujieres-cortes-generales': [
    { desde: 1, hasta: 17, offset: 0, bloque: "Programa oficial (Anexo I)" },
  ],
}
