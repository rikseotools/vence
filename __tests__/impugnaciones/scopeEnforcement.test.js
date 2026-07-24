// __tests__/impugnaciones/scopeEnforcement.test.js
//
// Detección pura del enforcement de scope/epígrafe (Regla previa OBLIGATORIA) usado por
// los dossiers de impugnaciones y feedback. Solo la parte SIN BD (isScopeComplaint); la
// query de estado Paso 1/Paso 2 necesita RDS y no se testea aquí.

const { isScopeComplaint } = require('../../scripts/impugnaciones/lib/scope-enforcement.cjs');

describe('isScopeComplaint — dispara en quejas de temario/epígrafe/scope', () => {
  test('caso Sara (art no entra en la 1ª parte / temario)', () => {
    expect(isScopeComplaint('Creo que este artículo no entra en la 1ª parte de la Ley de Contratos del Sector Público que se exige en el temario de Auxiliar Administrativo')).toBe(true);
  });

  test('caso Mario (¿entra el art X del Tema 8?)', () => {
    expect(isScopeComplaint('tengo mas dudas de si entra el art. 16 y art. 18 del Tema 8: Prevención de Riesgos Laborales')).toBe(true);
  });

  test('variantes de queja de scope', () => {
    const positivos = [
      'este artículo es de otro tema',
      'esta pregunta no corresponde a este tema',
      'falta el artículo X en el temario',
      'este artículo no aparece en mi epígrafe',
      'creo que no debería estar en este tema',
      'esto es de otro bloque',
      'no figura en el programa',
    ];
    positivos.forEach((t) => expect(isScopeComplaint(t)).toBe(true));
  });

  test('con acentos y mayúsculas (normalización)', () => {
    expect(isScopeComplaint('El EPÍGRAFE no incluye este artículo')).toBe(true);
    expect(isScopeComplaint('No ENTRA en la primera parte')).toBe(true);
  });
});

describe('isScopeComplaint — NO dispara en quejas ajenas al scope', () => {
  test('bug de UI (MariSol)', () => {
    expect(isScopeComplaint('Aparece un check verde de más. Sale el correcto y seguidamente sale otro que pone justo ahora')).toBe(false);
  });

  test('facturación / premium', () => {
    expect(isScopeComplaint('no puedo descargar temas, me dice que me haga premium cuando ya lo hice')).toBe(false);
  });

  test('duda de respuesta (clave), no de scope', () => {
    expect(isScopeComplaint('la respuesta correcta debería ser la B según el artículo')).toBe(false);
  });

  test('texto vacío / nulo', () => {
    expect(isScopeComplaint('')).toBe(false);
    expect(isScopeComplaint(null)).toBe(false);
    expect(isScopeComplaint(undefined)).toBe(false);
  });
});
