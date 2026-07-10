// competitor-match-cross-family.spec.ts
//
// SIMULACIÓN ADVERSARIA del matcher de competidores. El gate anti-cruce de familia
// aquí NO es una familia explícita, sino la CONTENCIÓN DE TOKENS: la oposición solo
// casa un curso si TODOS sus tokens significativos están en el curso. Un token genérico
// compartido ("auxiliar") NO basta; el token distintivo de la vertical (administrativo
// vs enfermeria/fontanero) diferencia. Casos con MISMO ámbito (Estado) para aislar la
// familia del scope: si algún cruce casara, habría hueco para el gate por familia.

import { CompetitorQueriesService, buildOposicionMatch } from './competitor-queries.service';

describe('Matcher competidores — cruce de familia (adversario)', () => {
  const svc = new CompetitorQueriesService({} as never);
  const catalog = [
    buildOposicionMatch({ id: 'aux-estado', nombre: 'Auxiliar Administrativo del Estado', shortName: null, administracion: 'Estado' }),
  ];
  const match = (name: string) => svc.matchCourse(name, name, catalog).oposicionId;

  // Mismo ámbito (Estado) + token genérico "auxiliar" compartido, familia distinta → NO casa.
  const cruces = [
    'Auxiliar de Enfermería del Estado',
    'Enfermero del Estado',
    'Técnico en Cuidados Auxiliares de Enfermería del Estado',
    'Fontanero del Estado',
    'Guardia Civil',
    'Trabajador Social del Estado',
    'Ingeniero del Estado',
  ];
  it.each(cruces)('NO casa "%s" con Auxiliar Administrativo del Estado', (name) => {
    expect(match(name)).toBeNull();
  });

  // CONTROL POSITIVO: misma familia + ámbito → SÍ casa.
  it('SÍ casa "Auxiliar Administrativo del Estado" (control)', () => {
    expect(match('Auxiliar Administrativo del Estado')).toBe('aux-estado');
  });
});
