const path = require('path');
const fs = require('fs');
const { parseLlmJson } = require(path.join(__dirname, '..', '..', '..', 'lib', 'llm', 'parseLlmJson.cjs'));

/**
 * Parser canónico del JSON que devuelve un LLM (T-174).
 *
 * Fijan el CONTRATO, que es lo que hacía falta: había 4 copias con robustez
 * distinta y las débiles reventaban en cuanto el modelo añadía prosa.
 */
describe('parseLlmJson', () => {
  it('extrae el objeto pelado y entre vallas', () => {
    expect(parseLlmJson('{"plazas":10}')).toEqual({ plazas: 10 });
    expect(parseLlmJson('```json\n{"plazas":10}\n```')).toEqual({ plazas: 10 });
    expect(parseLlmJson('```\n{"plazas":10}\n```')).toEqual({ plazas: 10 });
  });

  it('RESCATA el JSON con prosa alrededor — lo que las variantes débiles no hacían', () => {
    expect(parseLlmJson('Aquí tienes:\n{"a":1}')).toEqual({ a: 1 });
    expect(parseLlmJson('Claro:\n{"a":1}\nEspero que sirva.')).toEqual({ a: 1 });
  });

  it('acepta array en la raíz', () => {
    expect(parseLlmJson('[{"a":1},{"b":2}]')).toEqual([{ a: 1 }, { b: 2 }]);
    expect(parseLlmJson('Esto:\n[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it('un escalar NO es extracción válida: enmascararía un fallo del modelo', () => {
    for (const v of ['42', '"hola"', 'true', 'null']) {
      expect(parseLlmJson(v)).toBeNull();
    }
  });

  it('NUNCA lanza; devuelve null y quien llama decide', () => {
    for (const v of ['', '   ', null, undefined, 'no puedo ayudarte', '{"a": ', 0, {}]) {
      expect(() => parseLlmJson(v)).not.toThrow();
    }
    expect(parseLlmJson('no puedo ayudarte')).toBeNull();
    expect(parseLlmJson('')).toBeNull();
  });

  it('no se confunde con llaves dentro de cadenas', () => {
    expect(parseLlmJson('{"t":"un {ejemplo} raro","n":3}')).toEqual({ t: 'un {ejemplo} raro', n: 3 });
  });

  describe('anti-silo: que nadie vuelva a escribir su propia copia', () => {
    const FICHEROS = [
      'scripts/sim-seguimiento-ciego.cjs',
      'scripts/sim-notas-pipeline.cjs',
      'scripts/observabilidad/ab-modelo-notas.cjs',
    ];
    const raiz = path.join(__dirname, '..', '..', '..');

    it.each(FICHEROS)('%s usa el canónico y no desvalla por su cuenta', (f) => {
      const s = fs.readFileSync(path.join(raiz, f), 'utf8');
      expect(s).toContain('parseLlmJson');
      expect(s).not.toMatch(/replace\(\/\^```json/);
    });
  });
});
