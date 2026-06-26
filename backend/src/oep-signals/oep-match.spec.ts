import {
  classifyFamily,
  detectedScope,
  oposicionScope,
  ccaaAliases,
  scoreMatch,
  pickBestMatch,
  type OposicionCandidate,
  type DetectedOep,
} from './oep-match';

// Subconjunto REAL del catálogo (94 activas) relevante para los casos de hoy.
const CATALOG: OposicionCandidate[] = [
  { id: 'iipp', nombre: 'Estado', slug: 'ayudante-instituciones-penitenciarias', shortName: 'Ayudante II.PP.', subgrupo: 'C1', administracion: 'Estado' },
  { id: 'rioja-c1', nombre: 'Gobierno de La Rioja', slug: 'administrativo-la-rioja', shortName: 'Administrativo La Rioja', subgrupo: 'C1', administracion: 'autonomica' },
  { id: 'canarias-c1', nombre: 'Gobierno de Canarias', slug: 'administrativo-canarias', shortName: 'Administrativo Canarias', subgrupo: 'C1', administracion: 'autonomica' },
  { id: 'cantabria-c1', nombre: 'Cantabria', slug: 'administrativo-cantabria', shortName: '', subgrupo: 'C1', administracion: 'Autonómica' },
  { id: 'madrid-c1', nombre: 'Madrid', slug: 'administrativo-madrid', shortName: '', subgrupo: 'C1', administracion: 'Autonómica' },
  { id: 'cyl-aux', nombre: 'Comunidad Autónoma de Castilla y León', slug: 'auxiliar-administrativo-cyl', shortName: 'Aux. CyL', subgrupo: 'C2', administracion: 'autonomica' },
  { id: 'cyl-c1', nombre: 'Junta de Castilla y León', slug: 'administrativo-castilla-leon', shortName: 'Administrativo CyL', subgrupo: 'C1', administracion: 'autonomica' },
  { id: 'uni-leon-c1', nombre: 'Universidad de León', slug: 'administrativo-universidad-leon', shortName: 'Administrativo U. León', subgrupo: 'C1', administracion: 'Universidad de León' },
  { id: 'uni-leon-c2', nombre: 'Universidad de León', slug: 'auxiliar-administrativo-universidad-leon', shortName: 'Aux. Admin. ULE', subgrupo: 'C2', administracion: 'Universidad de León' },
  { id: 'aragon-aux', nombre: 'Comunidad Autónoma de Aragón', slug: 'auxiliar-administrativo-aragon', shortName: 'Aux. Admin. Aragón', subgrupo: 'C2', administracion: 'autonomica' },
  { id: 'dip-huesca', nombre: 'Diputación Provincial de Huesca', slug: 'auxiliar-administrativo-diputacion-huesca', shortName: 'Aux. Dip. Huesca', subgrupo: 'C2', administracion: 'Local' },
  { id: 'ayto-marbella', nombre: 'Ayuntamiento de Marbella', slug: 'auxiliar-administrativo-ayuntamiento-marbella', shortName: 'Aux. Ayto. Marbella', subgrupo: 'C2', administracion: 'local' },
  { id: 'gva-c1', nombre: 'Generalitat Valenciana', slug: 'administrativo-gva', shortName: 'Admin. GVA', subgrupo: 'C1', administracion: 'autonomica' },
  { id: 'valencia-aux', nombre: 'Comunitat Valenciana', slug: 'auxiliar-administrativo-valencia', shortName: 'Aux. Valencia', subgrupo: 'C2', administracion: 'autonomica' },
  { id: 'guardia-civil', nombre: 'Ministerio del Interior - Guardia Civil', slug: 'guardia-civil', shortName: 'Guardia Civil', subgrupo: 'C1', administracion: 'Ministerio del Interior - Guardia Civil' },
];

const find = (id: string) => CATALOG.find((o) => o.id === id)!;

describe('classifyFamily (solo cuerpo)', () => {
  it('clasifica las familias modeladas', () => {
    expect(classifyFamily('AYUDANTES DE INSTITUCIONES PENITENCIARIAS')).toBe('penitenciarias');
    expect(classifyFamily('ADMINISTRATIVO')).toBe('admin');
    expect(classifyFamily('AUXILIAR ADMINISTRATIVO')).toBe('aux_admin');
    expect(classifyFamily('GUARDIA CIVIL')).toBe('guardia_civil');
  });

  it('devuelve null para cuerpos no modelados → novel', () => {
    expect(classifyFamily('TÉCNICO AUXILIAR')).toBeNull();
    expect(classifyFamily('AGENTE TRIBUTARIO')).toBeNull();
    expect(classifyFamily('ESCALA BÁSICA')).toBeNull();
    expect(classifyFamily('COCINERO')).toBeNull();
    expect(classifyFamily('UJIER')).toBeNull();
    expect(classifyFamily('AUXILIAR DE ARCHIVOS')).toBeNull();
    expect(classifyFamily('AUXILIAR DE SERVICIOS GENERALES')).toBeNull();
  });

  it('clasifica el slug+short_name de la oposición', () => {
    expect(classifyFamily('administrativo-universidad-leon Administrativo U. León')).toBe('admin');
    expect(classifyFamily('auxiliar-administrativo-cyl Aux. CyL')).toBe('aux_admin');
  });
});

describe('scopes', () => {
  it('detecta el scope de la convocatoria PAG', () => {
    expect(detectedScope('Estatal', 'Ministerio del Interior').scope).toBe('national');
    expect(detectedScope('Autonómica', 'Consejería X').scope).toBe('autonomic');
    expect(detectedScope('Universidad', 'Universidad de León').scope).toBe('university');
    expect(detectedScope('Local', 'Ayuntamiento de Ávila').scope).toBe('local-ayto');
    expect(detectedScope('Local', 'Diputación Provincial de Huesca').scope).toBe('local-dip');
  });

  it('detecta el scope de la oposición desde el slug', () => {
    expect(oposicionScope('ayudante-instituciones-penitenciarias', 'Estado').scope).toBe('national');
    expect(oposicionScope('administrativo-la-rioja', 'autonomica').scope).toBe('autonomic');
    expect(oposicionScope('administrativo-universidad-leon', 'Universidad de León').scope).toBe('university');
    expect(oposicionScope('auxiliar-administrativo-ayuntamiento-marbella', 'local').scope).toBe('local-ayto');
    expect(oposicionScope('auxiliar-administrativo-diputacion-huesca', 'Local').scope).toBe('local-dip');
  });

  it('extrae el lugar de universidad/local', () => {
    expect(detectedScope('Universidad', 'Universidad de León').place).toContain('leon');
    expect(oposicionScope('administrativo-universidad-leon').place).toContain('leon');
    expect(detectedScope('Local', 'Ayuntamiento de Huesca').place).toContain('huesca');
  });

  it('mapea alias de CCAA', () => {
    expect(ccaaAliases('Castilla y León')).toContain('cyl');
    expect(ccaaAliases('La Rioja')).toContain('la rioja');
    expect(ccaaAliases('C. Valenciana')).toContain('gva');
  });
});

describe('scoreMatch — los 23 casos reales del 26/06', () => {
  // --- DEBEN casar ---
  it('IIPP (Estatal) → ayudante-instituciones-penitenciarias [era falso negativo]', () => {
    const d: DetectedOep = { cuerpo: 'AYUDANTES DE INSTITUCIONES PENITENCIARIAS', grupo: 'C1', admin: 'Estatal', ccaa: 'Nacional', organismo: 'Ministerio del Interior' };
    expect(scoreMatch(d, find('iipp')).matched).toBe(true);
    // No debe casar con ninguna autonómica/local pese a compartir nada.
    expect(pickBestMatch(d, CATALOG).oposicionId).toBe('iipp');
  });

  it('Administrativos La Rioja (Autonómica) → administrativo-la-rioja', () => {
    const d: DetectedOep = { cuerpo: 'ADMINISTRATIVOS DE ADMINISTRACIÓN GENERAL', grupo: 'C1', admin: 'Autonómica', ccaa: 'La Rioja', organismo: 'Consejería de Hacienda' };
    expect(pickBestMatch(d, CATALOG).oposicionId).toBe('rioja-c1');
  });

  it('Administrativo Agencia Tributaria Canaria (Autonómica) → administrativo-canarias', () => {
    const d: DetectedOep = { cuerpo: 'ADMINISTRATIVO', grupo: 'C1', admin: 'Autonómica', ccaa: 'Canarias', organismo: 'Agencia Tributaria Canaria' };
    expect(pickBestMatch(d, CATALOG).oposicionId).toBe('canarias-c1');
  });

  it('Administrativo Universidad de León → administrativo-universidad-leon (no la autonómica) [era doblemente erróneo]', () => {
    const d: DetectedOep = { cuerpo: 'ADMINISTRATIVO', grupo: 'C1', admin: 'Universidad', ccaa: 'Castilla y León', organismo: 'Universidad de León' };
    const best = pickBestMatch(d, CATALOG);
    expect(best.oposicionId).toBe('uni-leon-c1');
    // jamás la autonómica cyl
    expect(scoreMatch(d, find('cyl-aux')).matched).toBe(false);
    expect(scoreMatch(d, find('cyl-c1')).matched).toBe(false);
  });

  // --- DEBEN quedar NOVEL (eran falsos positivos) ---
  it('Administrativo Ayuntamiento de Ávila (Local) → NOVEL (no auxiliar-administrativo-cyl)', () => {
    const d: DetectedOep = { cuerpo: 'ADMINISTRATIVO', grupo: 'C1', admin: 'Local', ccaa: 'Castilla y León', organismo: 'Ayuntamiento de Ávila' };
    expect(pickBestMatch(d, CATALOG).oposicionId).toBeNull();
    expect(scoreMatch(d, find('cyl-aux')).matched).toBe(false);
  });

  it('Auxiliar Administrativo Ayuntamiento de Huesca (Local) → NOVEL (no la autonómica ni la Diputación)', () => {
    const d: DetectedOep = { cuerpo: 'AUXILIAR ADMINISTRATIVO', grupo: 'C2', admin: 'Local', ccaa: 'Aragón', organismo: 'Ayuntamiento de Huesca' };
    expect(pickBestMatch(d, CATALOG).oposicionId).toBeNull();
    expect(scoreMatch(d, find('aragon-aux')).matched).toBe(false);
    // misma palabra "huesca" pero Diputación ≠ Ayuntamiento
    expect(scoreMatch(d, find('dip-huesca')).matched).toBe(false);
  });

  it('Técnico Auxiliar Cantabria → NOVEL (familia distinta; no debe casar por "Administración" del organismo)', () => {
    const d: DetectedOep = { cuerpo: 'TÉCNICO AUXILIAR', grupo: 'C1', admin: 'Autonómica', ccaa: 'Cantabria', organismo: 'Consejería de Presidencia, Justicia, Seguridad y Administración' };
    expect(pickBestMatch(d, CATALOG).oposicionId).toBeNull();
    expect(scoreMatch(d, find('cantabria-c1')).matched).toBe(false);
  });

  it.each([
    ['AGENTE TRIBUTARIO', 'Autonómica', 'La Rioja'],
    ['TÉCNICOS AUXILIARES', 'Autonómica', 'Madrid'],
    ['AUXILIAR DE ARCHIVOS', 'Local', 'Castilla-La Mancha'],
    ['COCINERO', 'Local', 'Madrid'],
    ['OPERADORES', 'Local', 'Castilla y León'],
    ['UJIER', 'Otra', 'La Rioja'],
    ['AUXILIAR DE SERVICIOS GENERALES', 'Universidad', 'Andalucía'],
    ['ESCALA BÁSICA', 'Universidad', 'C. Valenciana'],
    ['TÉCNICA AUXILIAR DE INFORMÁTICA', 'Universidad', 'Madrid'],
  ])('cuerpo no modelado "%s" (%s/%s) → NOVEL', (cuerpo, admin, ccaa) => {
    const d: DetectedOep = { cuerpo, grupo: 'C1', admin, ccaa, organismo: 'x' };
    expect(pickBestMatch(d, CATALOG).oposicionId).toBeNull();
  });
});

describe('guardas anti-falso-positivo', () => {
  it('grupo incompatible no casa (C1 detectado vs C2 oposición)', () => {
    const d: DetectedOep = { cuerpo: 'AUXILIAR ADMINISTRATIVO', grupo: 'C1', admin: 'Autonómica', ccaa: 'C. Valenciana', organismo: 'x' };
    // familia aux_admin → candidata valencia-aux es C2 → incompatible
    expect(scoreMatch(d, find('valencia-aux')).matched).toBe(false);
  });

  it('Administrativo C1 Autonómica C.Valenciana → administrativo-gva (no la aux C2)', () => {
    const d: DetectedOep = { cuerpo: 'ADMINISTRATIVO', grupo: 'C1', admin: 'Autonómica', ccaa: 'C. Valenciana', organismo: 'Generalitat' };
    expect(pickBestMatch(d, CATALOG).oposicionId).toBe('gva-c1');
  });

  it('detección sin familia nunca casa aunque scope/region coincidan', () => {
    const d: DetectedOep = { cuerpo: 'BOMBERO', grupo: 'C1', admin: 'Autonómica', ccaa: 'La Rioja', organismo: 'x' };
    expect(pickBestMatch(d, CATALOG).oposicionId).toBeNull();
  });
});
