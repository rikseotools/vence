// __tests__/lib/familia.test.ts
// Clasificador de FAMILIA — casos REALES del feed (incluidas las trampas): el género
// '/a', el empleador embebido en el nombre, y 'facultativo' ambiguo (médico vs técnico).
import { classifyFamilia, normalizeFamiliaText, FAMILIA_KEYS } from '@/lib/oposiciones/familia'

describe('normalizeFamiliaText', () => {
  it('quita acentos, género /a y separadores', () => {
    expect(normalizeFamiliaText('Trabajador/a Social')).toBe('trabajador social')
    expect(normalizeFamiliaText('Enfermero/a - Servicio Navarro')).toBe('enfermero servicio navarro')
    expect(normalizeFamiliaText('Técnico/a en Cuidados (TCAE)')).toBe('tecnico en cuidados tcae')
  })
})

describe('classifyFamilia — trampas', () => {
  it('Administrativo en un servicio de salud = Administración, NO Sanidad', () => {
    expect(classifyFamilia('Administrativo/a - Osakidetza - Servicio Vasco de Salud', 'Osakidetza - Servicio Vasco de Salud')).toBe('administracion_general')
  })
  it('Fontanero en un servicio de salud = Oficios, NO Sanidad', () => {
    expect(classifyFamilia('Fontanero/a - Servicio de Salud de Castilla-La Mancha (SESCAM)', 'Servicio de Salud de Castilla-La Mancha (SESCAM)')).toBe('oficios')
  })
  it("'Cuerpo Superior Facultativo, opción Química' = Técnica, NO Sanidad", () => {
    expect(classifyFamilia('Cuerpo Superior Facultativo, opción Química - Región de Murcia')).toBe('tecnica')
  })
  it("'Cos facultatiu superior, escala d'enginyeria' = Técnica", () => {
    expect(classifyFamilia("Cos facultatiu superior, escala d'enginyeria, especialitat enginyeria industrial")).toBe('tecnica')
  })
})

describe('classifyFamilia — sanidad', () => {
  const casos = [
    'Enfermero/a - Servicio Navarro de Salud-Osasunbidea',
    'Técnico/a en Cuidados Auxiliares de Enfermería (TCAE) - Servicio Andaluz de Salud (SAS)',
    'Logopeda - Servicio Cántabro de Salud',
    'Odontólogo/a de Atención Primaria',
    'Facultatiu/iva Especialista en Farmàcia Hospitalària - Institut Català de la Salut (ICS)',
    'Facultativo Especialista de Área en Nefrología - SESCAM',
    'Facultativo/a Especialista de Área en Radiodiagnóstico - IB-Salut',
    'Facultativo Especialista de Área en Urología', // especialidad no listada, cae por la frase FEA
    'Técnico Superior Sanitario de Dietética y Nutrición',
  ]
  it.each(casos)('%s → sanidad', (n) => {
    expect(classifyFamilia(n)).toBe('sanidad')
  })
})

describe('classifyFamilia — resto de familias', () => {
  const map: [string, string][] = [
    ['Auxiliar Administrativo Dip. Foral de Gipuzkoa', 'administracion_general'],
    ['Proceso selectivo - Escala Auxiliar Administrativa - Universidad Carlos III', 'administracion_general'],
    ['Cuerpo de Técnicos Especialistas, opción Tributaria - Murcia', 'administracion_general'],
    ['Profesores de Secundaria - Alemán', 'educacion'],
    ['Cuerpo de Profesores de Enseñanza Secundaria (Navarra)', 'educacion'],
    ['Trabajador/a Social - Gobierno de Navarra', 'social'],
    ['Sociólogo/a - Gobierno de Navarra', 'social'],
    ['Cuerpo de Ayudantes Técnicos - Escala de Delineación - Gobierno Vasco', 'tecnica'],
    ['Ingeniería de Minas de la Generalitat - Generalitat Valenciana', 'tecnica'],
    ['Bombero/a de Ceuta', 'seguridad'],
    ['Ayudante de Instituciones Penitenciarias', 'seguridad'],
    ['Gestión Procesal y Administrativa', 'justicia'],
    ['Fontanero/a - SESCAM', 'oficios'],
    ['Personal de Servicios Generales - SESPA', 'oficios'],
    ['Conductor/a - IB-Salut', 'oficios'],
  ]
  it.each(map)('%s → %s', (n, fam) => {
    expect(classifyFamilia(n)).toBe(fam)
  })
})

describe('classifyFamilia — fallback por empleador + otros', () => {
  it('nombre genérico + organismo de salud → sanidad', () => {
    expect(classifyFamilia('Grupo Profesional 3', 'Servicio Andaluz de Salud (SAS)')).toBe('sanidad')
  })
  it('nada reconocible → otros', () => {
    expect(classifyFamilia('Grupo Profesional 3', 'Ayuntamiento de X')).toBe('otros')
    expect(classifyFamilia('', '')).toBe('otros')
  })
  it('toda familia devuelta es una clave válida de la taxonomía', () => {
    expect(FAMILIA_KEYS).toContain(classifyFamilia('cualquier cosa rara zzz'))
  })
})
