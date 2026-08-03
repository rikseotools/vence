/**
 * Todo spec del scaffolder que entre en `data/temarios/` tiene que VALIDAR.
 *
 * ── POR QUÉ ─────────────────────────────────────────────────────────────────────────────────
 *
 * `validateSpec`/`validateScope` son la puerta que evita tocar la BD con un spec malo, pero solo
 * se ejecutaban al correr el scaffolder sobre UN fichero. Un spec commiteado con un valor inválido
 * no lo notaba nadie hasta que alguien lo aplicaba — y entonces el error salía a mitad de la
 * transacción, con la fila de `oposiciones` ya actualizada (así aparecieron el `familia` fuera del
 * CHECK y las entradas de scope con `articles:null` en vez de `wholeLaw`, 03/08/2026).
 *
 * ── EL CORTE, y por qué es por FORMA y no por lista de nombres ───────────────────────────────
 *
 * De los 59 ficheros de `data/temarios/`, 49 son ANTERIORES al scaffolder: otro formato, sin
 * `identity` ni `examScoring`, y no se pueden validar con estas funciones. Exentarlos por nombre
 * envejecería mal (cada oposición nueva habría que acordarse de NO añadirla). Se distinguen por su
 * FORMA: si trae `identity` + `examScoring`, es un spec de scaffolder y tiene que validar.
 *
 * El TECHO de legacy es un trinquete: solo puede BAJAR. Migrar uno viejo al formato nuevo lo hace
 * bajar solo; añadir uno viejo pone el test en rojo, que es lo que se quiere.
 */
const fs = require('fs');
const path = require('path');
const { validateSpec, validateScope } = require('../../scripts/create-oposicion.cjs');

const DIR = path.join(__dirname, '../../data/temarios');
const TECHO_LEGACY = 49; // 03/08/2026. Solo puede bajar.

const ficheros = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));

function leer(f) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { return null; }
}
const esDeScaffolder = s => !!(s && s.identity && s.examScoring);

describe('data/temarios — los specs del scaffolder validan', () => {
  const delScaffolder = ficheros.filter(f => esDeScaffolder(leer(f)));

  it('hay al menos uno (si no, el test no estaría comprobando nada)', () => {
    expect(delScaffolder.length).toBeGreaterThan(0);
  });

  it.each(delScaffolder)('%s pasa validateSpec + validateScope', f => {
    const spec = leer(f);
    const errores = [...validateSpec(spec), ...validateScope(spec)];
    expect(errores).toEqual([]);
  });

  it(`los specs de formato ANTIGUO no crecen (techo ${TECHO_LEGACY})`, () => {
    const legacy = ficheros.filter(f => !esDeScaffolder(leer(f)));
    expect(legacy.length).toBeLessThanOrEqual(TECHO_LEGACY);
  });
});

describe('validateSpec — informa, no revienta', () => {
  // Se descubrió recorriendo los 59 ficheros: con un `temario` que no es array, apuntaba el error
  // y acto seguido llamaba a `.forEach` sobre él → TypeError. Un validador que lanza no se puede
  // usar en bucle, que es justo como se usa aquí.
  it('un temario que no es array se REPORTA, no lanza', () => {
    const spec = { identity: {}, examScoring: { penaltyDivisor: 3, source: 'x' }, temario: 'no soy un array' };
    let errores;
    expect(() => { errores = validateSpec(spec); }).not.toThrow();
    expect(errores.join(' ')).toMatch(/temario\[\] es obligatorio/);
  });

  it('un spec vacío tampoco lanza', () => {
    expect(() => validateSpec({})).not.toThrow();
    expect(() => validateSpec(null)).not.toThrow();
  });

  it('un scope con `articles: null` se rechaza pidiendo wholeLaw (el error real del 03/08)', () => {
    const spec = {
      temario: [{ topic_number: 1, bloque: 1, titulo: 't', epigrafe: 'e' }],
      scope: { 1: [{ law: 'CE', articles: null }] },
    };
    expect(validateScope(spec).join(' ')).toMatch(/necesita 'articles' \(array\) o 'wholeLaw:true'/);
  });
});
