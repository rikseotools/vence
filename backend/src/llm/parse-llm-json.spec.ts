import * as path from 'path';
import { parseLlmJson } from './parse-llm-json';

// El canónico vive en lib/ y el backend no puede importarlo en runtime, pero un
// test SÍ puede requerirlo: es lo que convierte la paridad en algo comprobable
// en vez de una promesa en un comentario.
// require() a propósito: es la ÚNICA forma de cruzar a lib/ desde el backend, y
// cruzarlo es justo lo que hace la paridad comprobable en vez de una promesa.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseLlmJson: parseLib } = require(
  path.join(__dirname, '..', '..', '..', 'lib', 'llm', 'parseLlmJson.cjs'),
) as { parseLlmJson: (raw: unknown) => Record<string, unknown> | null };

/**
 * Casos REALES de lo que devuelve un LLM. Origen (T-174): había 4 copias de este
 * parser con robustez distinta; las débiles reventaban en cuanto el modelo metía
 * una frase antes del JSON.
 */
const CASOS: Array<[string, unknown]> = [
  ['JSON pelado', '{"plazas": 10}'],
  ['con valla json', '```json\n{"plazas": 10}\n```'],
  ['con valla sin lenguaje', '```\n{"plazas": 10}\n```'],
  ['con prosa delante', 'Aquí tienes el JSON:\n{"plazas": 10}'],
  ['con prosa delante y detrás', 'Claro:\n{"plazas": 10}\nEspero que sirva.'],
  ['array en la raíz', '[{"a":1},{"b":2}]'],
  ['anidado con llaves dentro de cadenas', '{"t":"un {ejemplo} raro","n":3}'],
  ['vacío', ''],
  ['solo espacios', '   \n  '],
  ['null', null],
  ['undefined', undefined],
  ['no es JSON', 'lo siento, no puedo ayudarte con eso'],
  ['JSON roto irrecuperable', '{"plazas": '],
  ['escalar: número', '42'],
  ['escalar: cadena entrecomillada', '"hola"'],
  ['literal null', 'null'],
];

describe('parseLlmJson (backend)', () => {
  it('extrae el objeto en los formatos que devuelve un modelo', () => {
    expect(parseLlmJson('{"plazas": 10}')).toEqual({ plazas: 10 });
    expect(parseLlmJson('```json\n{"plazas": 10}\n```')).toEqual({
      plazas: 10,
    });
  });

  it('rescata el JSON aunque el modelo añada prosa alrededor', () => {
    // Esto es lo que las dos variantes inline NO hacían: reventaban aquí.
    expect(parseLlmJson('Aquí tienes:\n{"a":1}\nUn saludo.')).toEqual({ a: 1 });
  });

  it('NUNCA lanza: devuelve null y quien llama decide', () => {
    for (const [, entrada] of CASOS) {
      expect(() => parseLlmJson(entrada)).not.toThrow();
    }
    expect(parseLlmJson('no puedo ayudarte')).toBeNull();
    expect(parseLlmJson('')).toBeNull();
    expect(parseLlmJson(null)).toBeNull();
  });

  it('un escalar NO es una extracción válida (enmascararía un fallo del modelo)', () => {
    expect(parseLlmJson('42')).toBeNull();
    expect(parseLlmJson('"hola"')).toBeNull();
    expect(parseLlmJson('null')).toBeNull();
  });

  it('acepta un array en la raíz', () => {
    expect(parseLlmJson('[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  describe('PARIDAD con lib/llm/parseLlmJson.cjs', () => {
    // El backend no puede importar lib/ en runtime, así que hay dos copias. Este
    // test es lo único que impide que se separen en silencio.
    it.each(CASOS)('mismo veredicto para %s', (_, entrada) => {
      expect(parseLlmJson(entrada)).toEqual(parseLib(entrada));
    });
  });
});
