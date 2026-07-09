// oep-match-cross-family.spec.ts
//
// SIMULACIÓN ADVERSARIA del gate de familia del matcher del radar. Fuerza grupo y
// scope COMPATIBLES (mismo C1/C2, misma CCAA/ámbito) para que el ÚNICO diferenciador
// sea la FAMILIA → aísla el gate. Objetivo: demostrar que un cuerpo de una vertical
// NUNCA casa una oposición de otra (Enfermería/TCAE/Guardia Civil vs Administrativo),
// incluidos los cuerpos NO modelados (path fallback por nombre, sin gate de familia:
// si alguno se colara, ahí habría hueco real para el gate por familia broad).

import { scoreMatch, DetectedOep, OposicionCandidate } from './oep-match';

// Nuestra oposición: Auxiliar Administrativo C2 autonómica de La Rioja.
const OPO_AUX_ADMIN: OposicionCandidate = {
  id: 'rioja-aux', nombre: 'Auxiliar Administrativo La Rioja',
  slug: 'auxiliar-administrativo-la-rioja', shortName: 'Aux. Admin. La Rioja',
  subgrupo: 'C2', administracion: 'autonomica',
};

// Detectado con MISMO grupo+CCAA que la opo → solo la familia puede rechazar.
const det = (cuerpo: string): DetectedOep => ({
  cuerpo, grupo: 'C2', admin: 'Autonómica', ccaa: 'La Rioja', organismo: 'Gobierno de La Rioja',
});

describe('Gate de familia del radar — cruce de verticales (adversario)', () => {
  // Cuerpos MODELADOS (classifyFamily != null) → gate explícito famD !== famO.
  const modelados = [
    'Enfermero/a',
    'Técnico/a en Cuidados Auxiliares de Enfermería (TCAE)',
    'Celador/a',
    'Guardia Civil',
    'Auxilio Judicial',
  ];
  it.each(modelados)('NO casa "%s" con Auxiliar Administrativo', (cuerpo) => {
    expect(scoreMatch(det(cuerpo), OPO_AUX_ADMIN).matched).toBe(false);
  });

  // Cuerpos NO modelados (classifyFamily = null) → path fallback por nombre. Aquí NO
  // hay gate de familia; deben rechazarse porque el nombre no casa "auxiliar administrativo".
  const noModelados = [
    'Ingeniero/a de Caminos, Canales y Puertos',
    'Fontanero/a',
    'Trabajador/a Social',
    'Profesor/a de Enseñanza Secundaria',
    'Enólogo/a',
  ];
  it.each(noModelados)('NO casa (fallback) "%s" con Auxiliar Administrativo', (cuerpo) => {
    expect(scoreMatch(det(cuerpo), OPO_AUX_ADMIN).matched).toBe(false);
  });

  // CONTROL POSITIVO: mismo cuerpo/familia/ámbito → SÍ casa (el gate no bloquea lo válido).
  it('SÍ casa Auxiliar Administrativo con la opo de Auxiliar Administrativo', () => {
    const r = scoreMatch(det('Auxiliar Administrativo'), OPO_AUX_ADMIN);
    expect(r.matched).toBe(true);
    expect(r.oposicionId).toBe('rioja-aux');
  });
});
