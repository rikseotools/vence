#!/usr/bin/env node
/**
 * Generación IA — lote 1 de las Normas de Uso de los Sistemas de Información de la UAL
 * (T22 del temario de Aux. Admin. UAL, tarea T-044). Norma sin articulado formal: 13
 * APARTADOS numerados, importados como "artículos" 1-13.
 *
 * Protocolo anti-colisión aplicado (ver `docs/roadmap/build-almeria-aux-admin.md`):
 * comprobado que la norma estaba a 0 preguntas y sin actividad previa, y anunciada en la
 * tabla del documento antes de empezar. Al terminar se pasa `detectar-duplicados-lote.cjs`.
 *
 * Sigue `generar-preguntas-con-ia.md` v2.5: correcta = cita literal, distractores dentro de
 * ±30% (ratio ≤1,4), posición uniforme, explicación con blockquote.
 *
 * Uso: node scripts/oposiciones/gen-t22b-normas-uso-ual-batch1.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const LEY = 'Normas Uso Sistemas Información UAL'
const PROV = 'claude_code_gen_t22b_ual'

const Q = [
  { art: '2', pos: 0,
    q: 'Según el apartado 2 (Ámbito objetivo) de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, el acceso y tratamiento de datos personales que regula esta normativa se refiere:',
    o: ['A nivel informático y en papel',
        'Exclusivamente a nivel informático',
        'Solo a los ficheros en soporte papel',
        'Únicamente a los servicios en la nube'],
    cita: 'Esta normativa establece las normas de uso de los equipos informáticos corporativos (ordenadores personales y portátiles) asignados o vinculados al puesto de trabajo de la red corporativa, de los servicios corporativos necesarios para el desarrollo de tareas administrativas, de aplicaciones informáticas corporativas, así como el acceso y tratamiento de datos personales, a nivel informático y en papel.' },

  { art: '2', pos: 1,
    q: 'Conforme al apartado 2 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, los equipos informáticos corporativos cuyo uso se regula son:',
    o: ['Los servidores centrales y los sistemas de almacenamiento del centro de proceso de datos de la Universidad',
        'Los ordenadores personales y portátiles asignados o vinculados al puesto de trabajo de la red corporativa',
        'Los dispositivos personales del empleado siempre que se conecten a la red inalámbrica de la Universidad',
        'Los equipos de las aulas de docencia y de los laboratorios docentes adscritos a los departamentos'],
    cita: 'Esta normativa establece las normas de uso de los equipos informáticos corporativos (ordenadores personales y portátiles) asignados o vinculados al puesto de trabajo de la red corporativa.' },

  { art: '3', pos: 2,
    q: 'De acuerdo con el apartado 3 (Ámbito de aplicación) de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, lo dispuesto en esta normativa:',
    o: ['Es de obligado cumplimiento únicamente para el personal de administración y servicios que utilice equipamiento corporativo y trate información de carácter personal',
        'Tiene carácter meramente orientativo para los usuarios que utilicen equipamiento informático corporativo y accedan a información de carácter personal o no personal',
        'Es de obligado cumplimiento para todos los usuarios de la Universidad de Almería que utilizan equipamiento informático corporativo y accedan o traten información de carácter personal o no personal',
        'Es de obligado cumplimiento para todos los usuarios de la UAL solo cuando traten datos de carácter personal especialmente protegidos o de categorías especiales'],
    cita: 'Lo dispuesto en esta normativa es de obligado cumplimiento para todos los usuarios de la Universidad de Almería (en adelante, UAL) que utilizan equipamiento informático corporativo y accedan o traten información de carácter personal o no personal, para la realización de sus funciones y tareas.' },

  { art: '3', pos: 3,
    q: 'Según el apartado 3 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, ¿a quién corresponde aprobar normas de uso específicas para algunos servicios TIC?',
    o: ['Al Área de Tecnologías de la Información y las Comunicaciones, que podrá aprobar normas de uso específicas y darles la publicidad necesaria',
        'Al Consejo de Gobierno, que podrá aprobar normas de uso específicas a propuesta del Vicerrectorado con competencias en la materia',
        'A la Gerencia de la Universidad, que podrá aprobar normas de uso específicas oída la representación del personal',
        'A la Comisión de Seguridad, que podrá aprobar normas de uso específicas y promover las acciones necesarias para dar publicidad a dichas normas'],
    cita: 'La Comisión de Seguridad podrá aprobar normas de uso específicas para algunos servicios de Tecnologías de la Información y las Comunicaciones (en adelante, TIC) y promover las acciones necesarias para dar publicidad a dichas normas.' },

  { art: '4', pos: 0,
    q: 'Conforme al apartado 4 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, entre las finalidades con las que en ningún caso se podrá acceder a los recursos informáticos y telemáticos figura:',
    o: ['Introducir o difundir en la red virus informáticos o cualquier sistema físico o lógico susceptible de causar daños',
        'Utilizar los recursos para fines de investigación no vinculados directamente al proyecto asignado al usuario',
        'Acceder a servicios de mensajería instantánea distintos de los corporativos durante la jornada laboral',
        'Almacenar en el equipo corporativo documentación personal del usuario aunque no ocupe espacio relevante'],
    cita: 'Dentro de estas normas generales se tendrá en cuenta que en ningún caso se podrá acceder a los recursos informáticos y telemáticos con las siguientes finalidades: […] Introducir o difundir en la red virus informáticos o cualquier sistema físico o lógico susceptible de causar daños.' },

  { art: '4', pos: 1,
    q: 'Según el apartado 4 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, también está prohibido acceder a los recursos informáticos y telemáticos para:',
    o: ['Difundir contenidos que puedan afectar a la reputación académica de los centros y departamentos de la UAL',
        'Difundir contenidos contrarios a los principios enunciados en los Estatutos de la UAL',
        'Difundir contenidos publicitarios de entidades ajenas sin la autorización previa de la Gerencia',
        'Difundir contenidos que excedan de la capacidad de almacenamiento asignada a cada cuenta de usuario'],
    cita: 'Difundir contenidos contrarios a los principios enunciados en los Estatutos de la UAL.' },

  { art: '5', pos: 2,
    q: 'De acuerdo con el apartado 5 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, la red corporativa se define como:',
    o: ['Un recurso de acceso libre para la comunidad universitaria, sin limitaciones de capacidad ni de uso',
        'Un servicio externalizado cuya titularidad corresponde al proveedor de comunicaciones contratado',
        'Un recurso compartido y limitado, que sirve para el acceso de los usuarios internos de la UAL a la intranet o Internet',
        'Una infraestructura reservada a las aplicaciones de gestión académica y económica de la Universidad'],
    cita: 'La red corporativa es un recurso compartido y limitado, que sirve para el acceso de los usuarios internos de la UAL a la intranet o Internet, y para el acceso a las distintas aplicaciones informáticas corporativas.' },

  { art: '5', pos: 3,
    q: 'Según el apartado 5 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, respecto de la información que circula por la red de la UAL:',
    o: ['Es propiedad del usuario que la genera, correspondiéndole a él en exclusiva su custodia y protección',
        'Es propiedad compartida entre la Universidad y el proveedor del servicio de comunicaciones electrónicas',
        'Carece de titularidad definida mientras no se incorpore a un expediente administrativo electrónico',
        'Es propiedad de la UAL, y como tal, esta es responsable del uso y protección de la misma'],
    cita: 'La información que circula por la red de la UAL es de su propiedad, y como tal, es responsable del uso y protección de la misma.' },

  { art: '5', pos: 0,
    q: 'Conforme al apartado 5 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, sobre el acceso desde fuera de la Universidad, la norma establece que:',
    o: ['No estará permitido el acceso desde el exterior a los equipos dentro de la Universidad sin la conexión remota, segura y cifrada que proporciona el ATIC',
        'El acceso desde el exterior estará permitido siempre que el usuario emplee una contraseña robusta y renovada periódicamente',
        'El acceso desde el exterior requerirá autorización expresa del responsable de la unidad y comunicación previa a la Gerencia',
        'El acceso desde el exterior solo se permitirá al personal técnico del Área de Tecnologías de la Información y Comunicaciones'],
    cita: 'El ATIC proporcionará a los empleados y estudiantes un servicio de conexión remota segura y cifrada al sistema de información de la Universidad, para cuando estos se encuentren fuera de la Universidad de Almería. Por consiguiente, no estará permitido el acceso desde el exterior a los equipos dentro de la Universidad sin esta conexión remota, segura y cifrada.' },

  { art: '6', pos: 1,
    q: 'Según el apartado 6 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, la Universidad asignará a sus empleados:',
    o: ['Una cuenta de usuario por cada aplicación corporativa a la que deba acceder según su perfil',
        'Una cuenta de usuario institucional única que permitirá identificar unívocamente al usuario',
        'Una cuenta genérica de unidad administrativa, compartida por el personal adscrito a la misma',
        'Una cuenta de usuario temporal que deberá renovarse al inicio de cada curso académico'],
    cita: 'La Universidad de Almería asignará a sus empleados una cuenta de usuario institucional única que permitirá identificar unívocamente al usuario.' },

  { art: '6', pos: 2,
    q: 'Conforme al apartado 6 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, la creación de la cuenta institucional conlleva el alta automática, entre otros, en:',
    o: ['La cuenta de Campus, la sede electrónica y el registro electrónico general de la Universidad',
        'La cuenta de Campus, el gestor documental corporativo y la plataforma de docencia virtual',
        'La cuenta de Campus, la cuenta en Microsoft 365 y Google Workspace, y la aplicación portafirmas',
        'La cuenta de Campus, el directorio de personal y la aplicación de gestión económica y contable'],
    cita: 'La creación de esta cuenta institucional conlleva el alta automática y acceso a los usuarios, dependiendo del perfil correspondiente, a los siguientes servicios institucionales de gestión de la información: Creación de la cuenta de Campus. Creación de la cuenta en Microsoft 365 y Google Workspace. Creación de la cuenta en la aplicación portafirmas.' },

  { art: '7', pos: 3,
    q: 'Según el apartado 7 de las Normas de Uso de los Sistemas de Información de la Universidad de Almería, las instrucciones sobre acceso y tratamiento de datos personales se dictan en aplicación y observancia del cumplimiento de:',
    o: ['La Ley 39/2015 del Procedimiento Administrativo Común, la Ley 40/2015 de Régimen Jurídico del Sector Público y las normas de desarrollo de ambas',
        'El Esquema Nacional de Interoperabilidad, la normativa de administración electrónica de la Universidad y las instrucciones técnicas complementarias',
        'Los Estatutos de la Universidad de Almería, el Reglamento de Administración Electrónica de la propia UAL y la Política de Seguridad de la Información',
        'El Esquema Nacional de Seguridad, el Reglamento General de Protección de Datos y la Ley Orgánica de Protección de Datos Personales y garantía de los derechos digitales'],
    cita: 'Las instrucciones descritas en este documento lo son en aplicación y en la observancia del cumplimiento del Esquema Nacional de Seguridad, el Reglamento General de Protección de Datos y la Ley Orgánica de Protección de Datos Personales y garantía de los derechos digitales.' },
]

const L = ['A', 'B', 'C', 'D']

function explicacion(item) {
  const letra = L[item.pos]
  const otras = [0, 1, 2, 3].filter((i) => i !== item.pos)
    .map((i) => `- Por qué ${L[i]} no: no se corresponde con lo que establece el apartado ${item.art} de las Normas de Uso de los Sistemas de Información de la Universidad de Almería; altera el contenido de la norma.`)
    .join('\n')
  return `> ${item.cita}\n\nPor qué ${letra} es correcta: reproduce lo dispuesto en el apartado ${item.art} de las Normas de Uso de los Sistemas de Información de la Universidad de Almería (aprobadas en Consejo de Gobierno de 15/07/2024).\n\nPor qué las demás no:\n${otras}`
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const dist = [0, 0, 0, 0]
  Q.forEach((x) => dist[x.pos]++)
  console.log(`posición de la correcta → A:${dist[0]} B:${dist[1]} C:${dist[2]} D:${dist[3]}`)
  let malos = 0
  Q.forEach((x, i) => {
    const lc = x.o[x.pos].length
    const min = Math.min(...x.o.filter((_, j) => j !== x.pos).map((o) => o.length))
    if (lc / min > 1.4) { console.log(`  ⚠️ Q${i + 1} (ap ${x.art}): ratio ${(lc / min).toFixed(2)}`); malos++ }
  })
  // ABORTA, no solo avisa: en el lote anterior el aviso se ignoró y hubo que regenerar.
  if (malos) throw new Error(`${malos} pregunta(s) incumplen §2.2-bis (tell de longitud) — corrige antes de insertar`)
  console.log('✅ equilibrio de longitud OK (§2.2-bis)')

  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    // Protocolo anti-colisión: abortar si otra sesión ha generado aquí mientras tanto.
    const previas = await c.query(
      `SELECT count(*)::int n FROM questions q JOIN articles a ON a.id=q.primary_article_id
       JOIN laws l ON l.id=a.law_id WHERE l.short_name=$1`, [LEY])
    if (previas.rows[0].n > 0) throw new Error(`la norma ya tiene ${previas.rows[0].n} preguntas — otra sesión se ha adelantado, abortando para no duplicar`)

    const arts = new Map()
    for (const r of (await c.query(
      `SELECT a.id, a.article_number n FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name=$1`, [LEY])).rows) arts.set(r.n, r.id)

    let n = 0
    for (const item of Q) {
      const aid = arts.get(item.art)
      if (!aid) throw new Error(`no encuentro el apartado ${item.art}`)
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option,
                                explanation, difficulty, primary_article_id, lifecycle_state, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium',$8,'draft',$9)`,
        [item.q, item.o[0], item.o[1], item.o[2], item.o[3], item.pos, explicacion(item), aid,
         ['normas-uso-ti', 'ual', 'universidad-almeria', 'ia-generada', PROV]])
      n++
    }
    console.log(`\n${n} pregunta(s) insertadas como draft`)
    if (DRY) { await c.query('ROLLBACK'); console.log('--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('✅ COMMIT') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
