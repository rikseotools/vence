import { lastmodDiffers, shouldFinalizeBaseline } from './competitor-sync.service';
import { CompetitorQueriesService, buildOposicionMatch } from './competitor-queries.service';

describe('matchCourse (identidad estructurada + nombre)', () => {
  // Instancia sin BD: matchCourse es puro (no toca this.db).
  const svc = new CompetitorQueriesService({} as never);
  const catalog = [
    buildOposicionMatch({ id: 'op-cordoba', nombre: 'Auxiliar Administrativo del Ayuntamiento de Córdoba', shortName: null, administracion: 'Ayuntamiento de Córdoba' }),
    buildOposicionMatch({ id: 'op-estado', nombre: 'Auxiliar Administrativo del Estado', shortName: null, administracion: 'Estado' }),
  ];
  const match = (name: string, text = name) => svc.matchCourse(name, text, catalog).oposicionId;

  it('empareja pese al conector "de" vs "del"', () => {
    expect(match('Auxiliar Administrativo Ayuntamiento de Cordoba')).toBe('op-cordoba');
  });
  it('no empareja cuerpos distintos', () => {
    expect(match('Guardia Civil')).toBeNull();
  });
  it('genérico de una palabra ("Administrativo") NO matchea un cuerpo específico', () => {
    const cat = [buildOposicionMatch({ id: 'x', nombre: 'Administrativo de Castilla-La Mancha', shortName: null, administracion: 'Autonómica' })];
    expect(svc.matchCourse('Administrativo', 'Administrativo', cat).oposicionId).toBeNull();
  });
  it('genérico que encaja en varias oposiciones → ambiguo → gap', () => {
    expect(match('Auxiliar Administrativo')).toBeNull();
  });
  it('empareja abreviatura GVA y plural con la oposición catalogada', () => {
    const cat = [buildOposicionMatch({ id: 'op-sub-gva', nombre: 'Subalterno/a de la Generalitat Valenciana', shortName: null, administracion: 'Generalitat Valenciana' })];
    expect(svc.matchCourse('Subalternos Generalitat Valenciana', 'Subalternos Generalitat Valenciana', cat).oposicionId).toBe('op-sub-gva'); // plural
    expect(svc.matchCourse('Subalterno GVA', 'https://x.com/oposiciones/generalitat-valenciana/subalterno Subalterno GVA', cat).oposicionId).toBe('op-sub-gva'); // abreviatura
  });

  it('expande acrónimos INEQUÍVOCOS de servicios de salud (SAS/SERGAS) → matchea la oposición larga', () => {
    const cat = [
      buildOposicionMatch({ id: 'sas-admin', nombre: 'Administrativo/a - Servicio Andaluz de Salud (SAS)', shortName: null, administracion: 'Servicio Andaluz de Salud' }),
      buildOposicionMatch({ id: 'sergas-cel', nombre: 'Celador/a del Servicio Gallego de Salud (SERGAS)', shortName: null, administracion: 'Servicio Gallego de Salud' }),
    ];
    expect(svc.matchCourse('Administrativos del SAS', 'Administrativos del SAS', cat).oposicionId).toBe('sas-admin');
    expect(svc.matchCourse('Celadores SERGAS', 'Celadores SERGAS', cat).oposicionId).toBe('sergas-cel');
    // precisión: un curso del SAS NO se cuela en la oposición gallega (identidad distinta).
    expect(svc.matchCourse('Celadores SAS', 'Celadores SAS', cat).oposicionId).not.toBe('sergas-cel');
  });

  it('expande TCAE e IIPP (acrónimos de cuerpo) → matchea la oposición', () => {
    const cat = [
      buildOposicionMatch({ id: 'tcae', nombre: 'Técnico en Cuidados Auxiliares de Enfermería (TCAE)', shortName: null, administracion: 'Sanidad' }),
      buildOposicionMatch({ id: 'iipp', nombre: 'Ayudante de Instituciones Penitenciarias', shortName: null, administracion: 'Estado' }),
    ];
    expect(svc.matchCourse('TCAE a distancia', 'TCAE a distancia', cat).oposicionId).toBe('tcae');
    expect(svc.matchCourse('Ayudantes de IIPP', 'Ayudantes de IIPP', cat).oposicionId).toBe('iipp');
  });

  it('SERMAS (Madrid salud) matchea tras deduplicar el catálogo (E≡AP)', () => {
    const cat = [buildOposicionMatch({ id: 'sermas-cel', nombre: 'Celador del Servicio Madrileño de Salud (SERMAS)', shortName: null, administracion: 'Servicio Madrileño de Salud' })];
    expect(svc.matchCourse('Celadores SERMAS', 'Celadores SERMAS', cat).oposicionId).toBe('sermas-cel');
  });

  it('expande AGE → Administración General del Estado (desambigua un genérico)', () => {
    const cat = [buildOposicionMatch({ id: 'aux-estado', nombre: 'Auxiliar Administrativo del Estado', shortName: null, administracion: 'Estado' })];
    expect(svc.matchCourse('Auxiliares Administrativos AGE', 'Auxiliares Administrativos AGE', cat).oposicionId).toBe('aux-estado');
  });

  it('sin subset completo → revisión con la mejor apuesta (no gap silencioso)', () => {
    const cat = [buildOposicionMatch({ id: 'ah', nombre: 'Agente de la Hacienda Pública', shortName: null, administracion: 'Estado' })];
    const r = svc.matchCourse('Agentes de Hacienda Turno Libre', 'Agentes de Hacienda Turno Libre', cat);
    expect(r.oposicionId).toBeNull(); // no auto-enlace
    expect(r.method).toBe('needs_review'); // pero no gap silencioso…
    expect(r.candidateId).toBe('ah'); // …sino con la mejor apuesta para el humano
  });

  it('plural de vocal+s no rompe el stem (ayudantes ≈ ayudante)', () => {
    const cat = [buildOposicionMatch({ id: 'iipp', nombre: 'Ayudante de Instituciones Penitenciarias', shortName: null, administracion: 'Estado' })];
    expect(svc.matchCourse('Ayudantes de Instituciones Penitenciarias', 'Ayudantes de Instituciones Penitenciarias', cat).oposicionId).toBe('iipp');
  });

  // La guarda de ámbito: el fallo Estado↔local que motivó todo esto.
  it('un curso LOCAL no empareja una oposición de Estado (guarda de ámbito)', () => {
    const cat = [buildOposicionMatch({ id: 'tai-estado', nombre: 'Técnico Auxiliar de Informática', shortName: null, administracion: 'Estado' })];
    // curso del Ayuntamiento de Zaragoza: mismo cuerpo, ámbito distinto → NO estado.
    const r = svc.matchCourse('Técnico Auxiliar de Informática', 'https://adams.es/oposiciones/ayuntamiento-de-zaragoza/tai Técnico Auxiliar Informática Ayuntamiento de Zaragoza', cat);
    expect(r.oposicionId).toBeNull();
    // curso de Estado: sí empareja.
    const ok = svc.matchCourse('Técnicos Auxiliares de Informática de Estado (TAI)', 'https://adams.es/oposiciones/estado/tai Técnicos Auxiliares de Informática de Estado (TAI)', cat);
    expect(ok.oposicionId).toBe('tai-estado');
  });
});

describe('lastmodDiffers (regresión: gateo de re-descarga)', () => {
  it('NO difiere si es el mismo instante en formato crudo vs normalizado por la BD', () => {
    // El sitemap da el crudo; la columna timestamptz lo devuelve normalizado.
    expect(lastmodDiffers('2025-05-06T10:18:38+00:00', '2025-05-06 10:18:38+00')).toBe(false)
  })

  it('difiere si el instante cambió', () => {
    expect(lastmodDiffers('2025-05-06T10:18:38+00:00', '2025-06-01 09:00:00+00')).toBe(true)
  })

  it('maneja nulls (uno tiene lastmod, el otro no)', () => {
    expect(lastmodDiffers(null, null)).toBe(false)
    expect(lastmodDiffers('2025-05-06T10:18:38+00:00', null)).toBe(true)
  })
})

describe('shouldFinalizeBaseline (baseline silencioso de competidor nuevo)', () => {
  it('cierra el baseline cuando el backfill acaba (pending 0, fuentes OK, aún no done)', () => {
    expect(shouldFinalizeBaseline(false, true, 0)).toBe(true)
  })

  it('NO cierra si el competidor ya tenía el baseline hecho (no re-salda cambios reales)', () => {
    expect(shouldFinalizeBaseline(true, true, 0)).toBe(false)
  })

  it('NO cierra en pasadas intermedias del backfill (quedan cursos por el tope)', () => {
    expect(shouldFinalizeBaseline(false, true, 254)).toBe(false)
  })

  it('NO cierra si alguna fuente falló (no hemos visto el catálogo entero)', () => {
    expect(shouldFinalizeBaseline(false, false, 0)).toBe(false)
  })
})
