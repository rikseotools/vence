import { deriveIdentity, identityCompatible } from './oposicion-identity';

describe('deriveIdentity — ámbito', () => {
  const cases: [string, string, string | null][] = [
    // texto → ámbito esperado, región esperada
    ['Técnico Auxiliar de Informática del Estado (TAI)', 'estado', null],
    ['Auxiliar Administrativo del Estado', 'estado', null],
    ['Auxilio Judicial', 'estado', null],
    ['Tramitación Procesal y Administrativa', 'estado', null],
    ['Guardia Civil', 'estado', null],
    ['Policía Nacional Escala Básica', 'estado', null],
    ['Ayudantes de Instituciones Penitenciarias', 'estado', null],
    ['Subalternos Generalitat Valenciana', 'autonomica', 'comunidad-valenciana'],
    ['Subalterno GVA', 'autonomica', 'comunidad-valenciana'],
    ['Administrativo Junta de Andalucía', 'autonomica', 'andalucia'],
    ['Auxiliar Xunta de Galicia', 'autonomica', 'galicia'],
    ['Administrativo Comunidad de Madrid', 'autonomica', 'madrid'],
    ['Técnico Auxiliar Informático Ayuntamiento de Zaragoza', 'local', 'zaragoza'],
    ['Subalternos Ayuntamiento de Valencia', 'local', 'valencia'],
    ['Policía Local de Murcia', 'local', 'murcia'],
    ['Técnica Auxiliar de Informática - Universidad Politécnica de Madrid', 'universidad', 'upm'],
    ['Gestión de Sistemas e Informática - Universidad de Murcia', 'universidad', 'murcia'],
  ];
  it.each(cases)('%s → ámbito/región correctos', (text, ambito, region) => {
    const id = deriveIdentity(text);
    expect(id.ambito).toBe(ambito);
    expect(id.region).toBe(region);
  });
});

describe('identityCompatible — guarda dura de ámbito/región', () => {
  it('Estado vs Local NO compatibles (el fallo que hay que evitar)', () => {
    const estado = deriveIdentity('Técnico Auxiliar de Informática del Estado (TAI)');
    const local = deriveIdentity('Técnico Auxiliar Informático Ayuntamiento de Zaragoza');
    expect(identityCompatible(estado, local).compatible).toBe(false);
  });
  it('Dos CCAA distintas NO compatibles', () => {
    const gva = deriveIdentity('Subalternos Generalitat Valenciana');
    const and = deriveIdentity('Subalternos Junta de Andalucía');
    expect(identityCompatible(gva, and).compatible).toBe(false);
  });
  it('Misma CCAA y cuerpo → compatible y REFORZADO', () => {
    const opo = deriveIdentity('Generalitat Valenciana Subalterno/a de la Generalitat Valenciana');
    const curso = deriveIdentity('https://adams.es/oposiciones/generalitat-valenciana/subalternos Subalternos Generalitat Valenciana');
    const r = identityCompatible(opo, curso);
    expect(r.compatible).toBe(true);
    expect(r.reinforced).toBe(true);
  });
  it('Ámbito desconocido no bloquea (se decide por nombre)', () => {
    const unknown = deriveIdentity('Curso de preparación intensivo');
    const estado = deriveIdentity('Auxiliar Administrativo del Estado');
    expect(identityCompatible(unknown, estado).compatible).toBe(true);
    expect(identityCompatible(unknown, estado).reinforced).toBe(false);
  });
  it('Mismo ámbito, una región null → compatible pero no reforzado', () => {
    const gva = deriveIdentity('Subalternos Generalitat Valenciana');
    const autonomicaGen = deriveIdentity('Administrativo Autonómico');
    const r = identityCompatible(gva, autonomicaGen);
    expect(r.compatible).toBe(true);
    expect(r.reinforced).toBe(false);
  });
});
