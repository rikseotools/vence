// __tests__/backend/tipoDocumentoMirror.test.ts
//
// Guardarraíl de SYNC (T-147): el cron `tipificar-documentos` del backend lleva un MIRROR
// INLINE de `lib/convocatoria/tipoDocumento.cjs` (el backend es self-contained — su Dockerfile
// solo `COPY src ./src`, nunca `../lib`). Si el mirror diverge del núcleo, el cron tiparía
// documentos DISTINTO de lo que dicen los tests/simulación del núcleo — un `convocatoria` falso
// puesto en producción es peor que el `nota` de hoy (se usa como fuente de verdad). Este test
// corre las MISMAS cabeceras reales contra las dos implementaciones y exige el mismo veredicto.
/* eslint-disable @typescript-eslint/no-var-requires */
const { clasificarTipoDocumento: clasificarNucleo } = require('../../lib/convocatoria/tipoDocumento.cjs') as {
  clasificarTipoDocumento: (doc: { texto?: string; titulo?: string; url?: string }) => { tipo: string; confianza: 'alta' | 'media' | null }
}
import {
  clasificarTipoDocumento as clasificarMirror,
} from '../../backend/src/tipificar-documentos/tipo-documento-mirror'

// Mismas cabeceras reales que __tests__/lib/convocatoria/tipoDocumento.test.js (27/07/2026),
// incluidos los 3 casos de regresión que costaron precisión real. Repetirlas aquí no es
// duplicar el test: es fijar que el ESPEJO ve lo mismo que el núcleo en cada uno.
const CASOS: Array<[string, string]> = [
  ['lista_admitidos', 'Resolución por la que se aprueba la relación provisional de personas aspirantes admitidas y excluidas'],
  ['lista_admitidos (Orden)', 'Orden TDF/969/2025, por la que se aprueba la relación provisional de personas admitidas'],
  ['anuncio_fecha (cronograma)', 'Cronograma procesos selectivos de acceso libre, a la escala de funcionarios'],
  ['anuncio_fecha (aulas)', 'ACUERDO de la Comisión Permanente de Selección: distribución de opositores por aulas'],
  ['correccion_errores', 'DIPUTACIÓN PROVINCIAL DE HUESCA 4852 CORRECCIÓN DE ERRORES se hace público'],
  ['resolucion_tribunal', 'Orden por la que se acuerda la modificación del tribunal calificador del proceso'],
  ['convocatoria', 'Resolución de 22 de diciembre de 2025, de la Subsecretaría, por la que se convoca proceso selectivo'],
  ['convocatoria (referente a)', 'Resolución del Ayuntamiento de Córdoba, referente a la convocatoria para proveer varias plazas'],
  ['bases (aprobó)', 'EDICTO. La Teniente Alcalde aprobó mediante Decreto las bases de la convocatoria para la provisión'],
  ['bases (específicas)', 'Anuncio: bases específicas para la cobertura de varias plazas OEP 2023'],
  ['oep_decreto', 'Real Decreto 651/2025, de 15 de julio, por el que se aprueba la oferta de empleo público para 2025'],
  ['temario (Granada, sin "Tema N")', 'Ayuntamiento de Granada. Subdirección General de Recursos Humanos. Auxiliar de Administración General (15 plazas). Oferta de Empleo Público 2023, 2024 y 2025. ANEXO I: PROGRAMA DE MATERIAS para el turno libre. 1. La Constitución Española. 2. La Administración Local.'],
  ['temario (SAS, plural)', 'Resolución de 2 de agosto de 2024, de la Dirección General de Personal del Servicio Andaluz de Salud, por la que se aprueban y publican los nuevos programas de materias que habrán de regir las pruebas selectivas'],
  ['bases (Salamanca)', 'IV. Administración Local. Ayuntamiento de Salamanca. Anuncio: convocatoria y bases para la cobertura en propiedad, mediante oposición libre, de veintiocho plazas de auxiliar administrativo'],
  ['REGRESIÓN: convocatoria que cita el decreto de OEP no es oep_decreto', 'Resolución de 23 de abril de 2026, del Instituto Nacional de Gestión Sanitaria, por la que se convoca proceso selectivo. Con el fin de atender las necesidades de personal y en cumplimiento de lo dispuesto en el Real Decreto 651/2025, de 15 de julio, por el que se aprueba la oferta de empleo público correspondiente al ejercicio 2025'],
  ['REGRESIÓN: extracto BOE admin. local no es bases', 'Resolución de 13 de julio de 2026, del Ayuntamiento de Córdoba, referente a la convocatoria para proveer varias plazas. En el «Boletín Oficial de la Provincia de Córdoba» se han publicado las bases que han de regir la convocatoria para proveer veintitrés plazas de Ordenanza'],
  ['REGRESIÓN: convocatoria que cita "corrección de errores" no lo es', 'Resolución de 15 de junio de 2026, de la Universidad de León, por la que se convoca proceso selectivo para ingreso en la escala administrativa. La Resolución de 20 de noviembre de 2023 y su corrección de errores establecen'],
  ['REGRESIÓN: nota informativa que enumera temas no es temario', 'Nota informativa del órgano de selección de las pruebas selectivas para ingreso en el Cuerpo Auxiliar de la Administración de la Comunidad Autónoma de Aragón. Se informa del reparto: Tema 1. Tema 2. Tema 3. Tema 4. Tema 5. Tema 6. Tema 7. Tema 8. Tema 9. Tema 10.'],
  ['nota (certificado ENS)', 'Certificado de conformidad con el Esquema Nacional de Seguridad'],
  ['nota (guía tutoría)', 'Guía para la tutoría. Instituto Asturiano de Administración Pública'],
  ['nota (instrucciones subsanación)', 'Instrucciones para la subsanación de solicitudes. Procesos selectivos de acceso libre'],
]

describe('paridad núcleo (lib/) ↔ mirror (backend/) de clasificarTipoDocumento', () => {
  it.each(CASOS)('%s', (_nombre, texto) => {
    const nucleo = clasificarNucleo({ texto })
    const mirror = clasificarMirror({ texto })
    expect(mirror.tipo).toBe(nucleo.tipo)
    expect(mirror.confianza).toBe(nucleo.confianza)
  })

  it('sin texto ni título: los dos dicen nota sin inventar', () => {
    expect(clasificarNucleo({}).tipo).toBe('nota')
    expect(clasificarMirror({}).tipo).toBe('nota')
  })

  it('confianza sube a alta en los dos cuando el título repite la señal', () => {
    const doc = {
      texto: 'Resolución por la que se aprueba la relación provisional de personas aspirantes admitidas y excluidas',
      titulo: 'admitidos provisional relacion de aspirantes admitidos.pdf',
    }
    expect(clasificarNucleo(doc)).toMatchObject({ tipo: 'lista_admitidos', confianza: 'alta' })
    expect(clasificarMirror(doc)).toMatchObject({ tipo: 'lista_admitidos', confianza: 'alta' })
  })
})
