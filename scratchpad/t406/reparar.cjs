/**
 * T-406 — repara distractores clonados: sustituye UNA de las dos opciones idénticas
 * por el distractor que le tocaba. NUNCA toca la opción marcada como clave.
 * Dry-run por defecto; escribe con --apply.
 */
require('dotenv').config({ path: '.env.local' })
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')

const APPLY = process.argv.includes('--apply')
const COL = ['option_a', 'option_b', 'option_c', 'option_d']
const L = 'ABCD'

// id -> { opcion: índice 0-3 a reescribir, texto: nuevo distractor, motivo }
const REPARACIONES = {
  // Biblioteconomía — la rejilla evidente es Uniform/Universal × Locator/Library
  'e8d1767e-f2d0-4bc8-a257-950aad76ef36': { opcion: 0, texto: 'Universal Resource Locator', motivo: 'completa la rejilla Uniform/Universal × Locator/Library' },
  // 456 = 111001000 (clave B); 111001001 = 457, fallo de un bit
  '92277697-6a5d-4224-a967-e27fbdebd163': { opcion: 3, texto: '111001001', motivo: 'valor próximo (457), error de un bit' },
  // CDU: orden correcto 003, 22, 512, 7 = C,A,B,D (clave A)
  '4c431818-5e0e-4aca-bf29-22e5f92874fa': { opcion: 3, texto: 'B, C, A, D', motivo: 'otra permutación incorrecta' },
  // PAE: las cinco fases en orden alterado
  '68bb1c3f-68c8-46ad-aaf3-3b76160303ea': { opcion: 1, texto: 'Valoración, Diagnóstico, Ejecución, Planificación y Evaluación.', motivo: 'fases correctas en orden alterado' },
  '6a7ec873-2309-4467-ad25-862321c1c0db': { opcion: 2, texto: 'Cuadro Médico Básico de Diagnóstico.', motivo: 'otro desarrollo falso de las siglas' },
  '8f0dfcb3-8cfc-4150-9f86-ed74ecf41116': { opcion: 1, texto: 'Una persona adulta sana con ingesta hídrica normal.', motivo: 'perfil sin riesgo' },
  // Bioética: los cuatro principios
  '805ed6e2-de1f-4ca5-8d82-d0747de29cbf': { opcion: 2, texto: 'No maleficencia.', motivo: 'cuarto principio de la bioética' },
  '48c47379-f03f-4444-a601-95111f23e5a5': { opcion: 3, texto: 'Principio de No Maleficencia.', motivo: 'cuarto principio de la bioética' },
  '3de7a508-7e3b-48b7-991e-13e3c71c97a5': { opcion: 2, texto: 'Valor predictivo positivo.', motivo: 'parámetro simétrico al de la clave' },
  // Inmunidad: rejilla natural/artificial × activa/pasiva
  '31e3b957-3d8e-44b9-b267-f7e29f5f6fdf': { opcion: 3, texto: 'Inmunidad artificial activa.', motivo: 'completa la rejilla natural/artificial × activa/pasiva' },
  // Clases morales de secreto: natural, prometido, pactado (confiado)
  'bb2e2bcc-ec3a-4b43-b2bf-036efd0ec7ae': { opcion: 3, texto: 'Secreto pactado.', motivo: 'tercera clase moral de secreto' },
  '6462d24b-fce1-4105-9082-30c590d00184': { opcion: 3, texto: 'Por urgencia.', motivo: 'otro tipo real de incontinencia, no el más frecuente' },
  '2c250fb2-83ca-4958-9e2d-2f754cbc38ef': { opcion: 2, texto: 'La coexistencia de dos trastornos mentales graves sin consumo de sustancias.', motivo: 'confusión plausible con el término' },
  'ac638b91-2c7d-4005-a1c6-6f7aec60b861': { opcion: 2, texto: 'Emotividad excesiva y búsqueda constante de atención mediante la teatralidad.', motivo: 'rasgos del trastorno histriónico' },
  '2980141f-905a-4091-9bb2-af0852b5f493': { opcion: 2, texto: 'Reduce el gasto sanitario asociado al envejecimiento.', motivo: 'efecto falso atribuido al edadismo' },
  'd9cd4255-cd9f-4955-ae29-fd73aa82aa36': { opcion: 3, texto: 'Diabetes tipo 1.', motivo: 'patología no incluida en el cribado neonatal' },
  '159283e1-52a7-4950-8742-7e945e9defe9': { opcion: 2, texto: 'Presentan bordes irregulares y profundidad desigual.', motivo: 'lo contrario del patrón por inmersión (bordes netos y profundidad uniforme)' },
  '26676b34-baed-471d-852f-ca4cdb1c8067': { opcion: 3, texto: 'Lesión exclusivamente muscular, sin afectación ligamentosa y con recuperación en 24 horas.', motivo: 'descripción que no corresponde a un esguince' },
  // Criterios OMS: categorías 1 a 4
  '67678bfc-da33-45f5-b759-80d6257fb598': { opcion: 2, texto: 'Categoría 3 (Los riesgos superan las ventajas).', motivo: 'completa las cuatro categorías OMS' },
  '77021af6-64fc-4aa0-9351-539519074ce4': { opcion: 3, texto: 'Tiene una dependencia leve en las actividades básicas de la vida diaria (ABVD).', motivo: 'completa la rejilla ABVD/AIVD × leve/severa' },
  '4d0f2602-2d89-4a22-b92f-83b90818e2dc': { opcion: 1, texto: 'Limitar las visitas para favorecer el descanso del paciente.', motivo: 'intervención plausible ajena al enfoque biopsicosocial' },
  'c21c054d-30ee-47a7-9b74-341e29582bdc': { opcion: 2, texto: 'Aplicar contención mecánica de forma preventiva en todos los casos.', motivo: 'intervención improcedente como norma general' },
  'a3c9fdce-6a66-460a-bccf-704090d5b778': { opcion: 1, texto: 'Las vacunas pueden permanecer a temperatura ambiente hasta 24 horas antes de administrarse.', motivo: 'afirmación falsa sobre la cadena de frío' },
  '54073e7a-93a8-4881-b44c-ac035ec35132': { opcion: 2, texto: 'Exclusivamente los datos de facturación de la prestación farmacéutica.', motivo: 'ámbito falso del sistema de información' },
  'ac031628-af4f-4276-bf6b-0201a235c707': { opcion: 3, texto: 'El consumo de tabaco entre los adultos es el más bajo de la Unión Europea.', motivo: 'afirmación falsa sobre el mismo informe' },
  '99bb3711-35e0-4fca-bb0b-ed88165f5946': { opcion: 3, texto: 'Es el conjunto de estímulos focales, contextuales y residuales que rodean al individuo.', motivo: 'definición de entorno de otro modelo (Roy)' },
  'b0a06f71-1f92-40b9-ab04-3c182cd8c8ce': { opcion: 3, texto: 'Número de personas diagnosticadas de ansiedad y depresión x 100 / Número total de personas mayores de 65 años del cupo.', motivo: 'denominador ajeno al indicador' },
  '665bfc82-b4ba-4dba-8f13-1f44a1783caa': { opcion: 3, texto: 'Un método de desinfección que emplea vapor seco a 180 ºC durante dos horas.', motivo: 'describe el calor seco (Poupinel), no el autoclave' },
  'd4206cec-ec69-4990-b1c2-990678958778': { opcion: 3, texto: 'Las notas de contenido y el resumen del recurso', motivo: 'campos MARC distintos (505/520)' },
  '478aac1d-f798-4d43-89cd-8eda03ba038c': { opcion: 2, texto: 'ActiveSync exige una conexión VPN permanente para sincronizar con el servidor Exchange.', motivo: 'afirmación falsa sobre el mismo protocolo' },
  '516bf5c8-84b4-4523-90b0-e13ad8858833': { opcion: 3, texto: 'Compilación automática del kernel con los módulos propietarios en cada arranque.', motivo: 'mecanismo inexistente en la distribución' },
  '6ebca38f-06ab-4e7e-8bf0-8c09918eb858': { opcion: 1, texto: 'Alcohol etílico al 70 %.', motivo: 'desinfectante de nivel intermedio' },
  // «Señale la FALSA»: el distractor tiene que ser una afirmación VERDADERA sobre la HBP
  'b30ad9fd-758f-4956-95fd-17bdef494571': { opcion: 2, texto: 'El riesgo aumenta con la edad y es poco frecuente antes de los 40 años.', motivo: 'afirmación verdadera (el enunciado pide la FALSA)' },
  '4c431818-5e0e-4aca-bf29-22e5f92874fa-DUP': null,
}
delete REPARACIONES['4c431818-5e0e-4aca-bf29-22e5f92874fa-DUP']

const norm = (s) => (s == null ? null : String(s).trim().replace(/\s+/g, ' '))

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  let ok = 0
  const problemas = []
  for (const [id, rep] of Object.entries(REPARACIONES)) {
    const { rows } = await c.query(
      'SELECT id, option_a, option_b, option_c, option_d, correct_option, is_active FROM questions WHERE id = $1', [id])
    if (!rows.length) { problemas.push(`${id}: no existe`); continue }
    const q = rows[0]
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d].map(norm)

    // Guarda 1: jamás tocar la clave.
    if (q.correct_option === rep.opcion) { problemas.push(`${id}: la opción ${L[rep.opcion]} ES LA CLAVE — abortado`); continue }
    // Guarda 2: la opción a reescribir tiene que estar hoy duplicada.
    const duplicada = opts.some((o, k) => k !== rep.opcion && o && o === opts[rep.opcion])
    if (!duplicada) { problemas.push(`${id}: la opción ${L[rep.opcion]} ya no está duplicada — ¿reparada por otra sesión?`); continue }
    // Guarda 3: el texto nuevo no puede coincidir con ninguna otra opción.
    if (opts.some((o, k) => k !== rep.opcion && o && o === norm(rep.texto))) { problemas.push(`${id}: el texto nuevo choca con otra opción`); continue }

    console.log(`── ${id}  ${L[rep.opcion]}: «${opts[rep.opcion]}»\n     →  «${rep.texto}»   (${rep.motivo})`)
    if (APPLY) {
      await c.query(`UPDATE questions SET ${COL[rep.opcion]} = $1, updated_at = now() WHERE id = $2`, [rep.texto, id])
    }
    ok++
  }
  console.log(`\n${APPLY ? 'APLICADAS' : 'A APLICAR'}: ${ok} de ${Object.keys(REPARACIONES).length}`)
  if (problemas.length) { console.log('\n⚠️ PROBLEMAS:'); problemas.forEach((p) => console.log('  ' + p)) }
  if (!APPLY) console.log('\n(dry-run — repite con --apply)')
  await c.end()
})()
